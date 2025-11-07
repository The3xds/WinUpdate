// main.js
const { spawn } = require("child_process");
const {
    app,
    BrowserWindow,
    ipcMain
} = require("electron");
const path = require("path");
const {
    exec
} = require("child_process");

const {
    execFile
} = require("child_process");
const util = require("util");
const execFileAsync = util.promisify(execFile);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.loadFile("renderer/index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

/**
 * Helper: run a command with encoding utf8 and return Promise(stdout)
 */
function runCommand(cmd, options = {}) {
    return new Promise((resolve, reject) => {
        exec(cmd, {
            encoding: "utf8",
            ...options
        }, (err, stdout, stderr) => {
            if (err && !stdout) return reject({
                err,
                stderr
            });
            resolve({
                stdout: stdout || "",
                stderr: stderr || ""
            });
        });
    });
}

/**
 * Normalize names for fuzzy comparison
 */
function normalizeName(s = "") {
    return s
        .toString()
        .toLowerCase()
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Resolve the "real" full package id for a given display name.
 * Uses `winget list --exact "<name>"` and parses that table output (left-to-right).
 * Returns the package identifier string or null if not resolvable.
 */
async function resolveRealIdByName(name) {
    try {
        const {
            stdout
        } = await runCommand(`winget list --exact "${name}"`);
        if (!stdout) return null;

        const lines = stdout.split("\n").map(l => l.replace(/\r/, ""));

        let start = false;
        for (let raw of lines) {
            const line = raw.trim();
            if (!start) {
                // wait until we hit the "-----" separator
                if (line.match(/^[-\s]+$/)) start = true;
                continue;
            }
            if (!line) continue;
            if (line.startsWith("---")) continue;

            // Now parse the real row
            const cols = line.split(/\s+/);
            if (cols.length < 4) continue;

            const source = cols.pop();
            const available = cols.pop();
            const version = cols.pop();
            const id = cols.pop();

            // ignore bogus IDs
            if (!id || /^[\d.]+$/.test(id) || id.toLowerCase() === "winget" || id.toLowerCase() === "id")
                continue;

            return id;
        }

        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Handler: Get outdated apps
 * Strategy:
 *  1. Parse `winget upgrade` table (right-to-left) to get name/installed/available/source/truncatedId
 *  2. For each entry, try `winget list --exact "<name>"` to obtain full ID (left-to-right parsing)
 *  3. If no full ID and truncatedId isn't '…' truncated, use truncatedId as fallback
 *  4. Normalize/fuzzy matching already inherent (we query list by exact name)
 */
ipcMain.handle("get-outdated-apps", async () => {
    try {
        // 1. Get full list of installed packages (winget list)
        const {
            stdout: listOut
        } = await runCommand("winget list");
        const listLines = listOut.split("\n").map(l => l.replace(/\r/, ""));

        // Build name → fullID map
        const idMap = {};
        let listStarted = false;

        for (const raw of listLines) {
            const line = raw.trim();
            if (!listStarted) {
                if (line.match(/^[-\s]+$/)) listStarted = true;
                continue;
            }
            if (!line) continue;

            const parts = line.split(/\s{2,}/).filter(Boolean);
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const id = parts[1].trim();
                if (id && !/^[\d.]+$/.test(id) && id.toLowerCase() !== "winget") {
                    idMap[name.toLowerCase()] = id;
                }
            }
        }

        // 2. Parse upgrade list (winget upgrade)
        const {
            stdout: upOut
        } = await runCommand("winget upgrade");
        const upLines = upOut.split("\n").map(l => l.replace(/\r/, ""));
        let upStarted = false;
        const result = [];

        for (const raw of upLines) {
            const line = raw.trim();
            if (!upStarted) {
                if (line.match(/^[-\s]+$/)) upStarted = true;
                continue;
            }
            if (!line || line.includes("upgrades available")) continue;

            const columns = line.split(/\s+/);
            if (columns.length < 5) continue;

            const source = columns.pop();
            const available = columns.pop();
            const installed = columns.pop();
            const truncatedId = columns.pop();
            const name = columns.join(" ").trim();

            // FAST: use idMap instead of shelling out
            let fullId = idMap[name.toLowerCase()] || null;

            // fallback if ID not truncated
            if (!fullId && truncatedId && !truncatedId.endsWith("…")) {
                fullId = truncatedId;
            }

            if (!fullId || /^[\d.]+$/.test(fullId)) continue;

            result.push({
                name,
                id: fullId,
                installedVersion: installed,
                availableVersion: available,
                source
            });
        }

        console.log(`Found ${result.length} outdated apps`);
        return result;
    } catch (e) {
        console.error("Failed to get outdated apps:", e);
        return [];
    }
});

/**
 * Handler: Update a specific app by package identifier (id).
 * Expects the correct PackageIdentifier (e.g. Microsoft.VisualStudio.2022.Community)
 */
ipcMain.handle("update-app", async (event, appId) => {
    if (!appId || typeof appId !== "string") {
        return {
            success: false,
            reason: "invalid_id"
        };
    }

    console.log(`\n=== Starting update for: ${appId} ===`);

    // Basic validation: don't accept plain versions or "winget"
    if (/^[\d.]+$/.test(appId) || appId.toLowerCase() === "winget") {
        console.log("Rejected invalid package id:", appId);
        return {
            success: false,
            reason: "invalid_id"
        };
    }

    try {
        // Send initial progress
        event.sender.send('update-progress', {
            appId,
            progress: 0,
            status: 'starting'
        });

        // Try a machine-scope upgrade first (some packages require machine scope)
        // We will attempt both machine and user scope if necessary.
        let tried = [];
        const attempts = [
            `winget upgrade --id "${appId}" --silent --accept-source-agreements --accept-package-agreements`,
            `winget upgrade --id "${appId}" --silent --scope machine --accept-source-agreements --accept-package-agreements`
        ];

        for (const cmd of attempts) {
            tried.push(cmd);
            try {
                event.sender.send('update-progress', {
                    appId,
                    progress: 25,
                    status: 'downloading'
                });

                const {
                    stdout,
                    stderr
                } = await runCommand(cmd);

                event.sender.send('update-progress', {
                    appId,
                    progress: 75,
                    status: 'installing'
                });

                console.log(`\n--- Output for ${appId} ---`);
                if (stdout) console.log("STDOUT:", stdout.trim());
                if (stderr) console.log("STDERR:", stderr.trim());

                // Check output for common failure indicators even if exit code is 0
                const output = (stdout + stderr).toLowerCase();

                // Check if package cannot be upgraded (often means app is running or needs manual update)
                if (output.includes("package cannot be upgraded") ||
                    output.includes("cannot be upgraded using winget") ||
                    output.includes("use the method provided by the publisher")) {
                    console.log(`Update FAILED for ${appId}: cannot be upgraded (likely running or requires manual update)`);
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "running"
                    };
                }

                // Check if app is running
                if (output.includes("application is currently running") ||
                    output.includes("close the application") ||
                    output.includes("app is running") ||
                    output.includes("must be closed")) {
                    console.log(`Update FAILED for ${appId}: app is running`);
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "running"
                    };
                }

                // Check if no update was actually performed
                if (output.includes("no applicable upgrade found") ||
                    output.includes("no newer package versions")) {
                    console.log(`No update needed for ${appId}`);
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "no_update_available"
                    };
                }

                // Winget usually exits non-zero on failure; if we get here, consider success
                console.log(`Update SUCCESS for ${appId}`);
                console.log(`=== Finished update for: ${appId} ===\n`);
                event.sender.send('update-progress', {
                    appId,
                    progress: 100,
                    status: 'complete'
                });
                return {
                    success: true
                };
            } catch (err) {
                // parse err to determine reason
                const errOut = (err.stderr || (err.err && err.err.message) || "").toString().toLowerCase();
                const stdOut = (err.stdout || "").toString().toLowerCase();
                const fullOutput = errOut + " " + stdOut;

                console.log(`Attempt failed for ${appId}:`, errOut || err);

                // Check if package cannot be upgraded (often means app is running or needs manual update)
                if (fullOutput.includes("package cannot be upgraded") ||
                    fullOutput.includes("cannot be upgraded using winget") ||
                    fullOutput.includes("use the method provided by the publisher")) {
                    console.log(`Update FAILED for ${appId}: cannot be upgraded (likely running or requires manual update)`);
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "running"
                    };
                }

                // Check if app is running
                if (fullOutput.includes("application is currently running") ||
                    fullOutput.includes("close the application") ||
                    fullOutput.includes("app is running") ||
                    fullOutput.includes("must be closed")) {
                    console.log(`Update FAILED for ${appId}: app is running`);
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "running"
                    };
                }

                // Common causes we can detect
                if (fullOutput.includes("no installed package found matching input criteria") ||
                    fullOutput.includes("no installed package found")) {
                    console.log(`Update FAILED for ${appId}: not installed`);
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "not_installed"
                    };
                }

                if (fullOutput.includes("exit code: 1618") || fullOutput.includes("another installation is in progress")) {
                    console.log("Detected installer busy (1618).");
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "installer_busy"
                    };
                }

                if (fullOutput.includes("administrator") || fullOutput.includes("elevated")) {
                    console.log("Detected permissions issue.");
                    event.sender.send('update-progress', {
                        appId,
                        progress: 0,
                        status: 'failed'
                    });
                    return {
                        success: false,
                        reason: "permissions"
                    };
                }

                // otherwise continue to next attempt
            }
        }

        // If we reached here, all attempts failed and none provided a clear reason
        console.log(`Update FAILED for ${appId}; attempted commands: ${tried.join(" || ")}`);
        console.log(`=== Finished update for: ${appId} ===\n`);
        event.sender.send('update-progress', {
            appId,
            progress: 0,
            status: 'failed'
        });
        return {
            success: false,
            reason: "unknown"
        };
    } catch (e) {
        console.error("Unhandled error updating app:", e);
        event.sender.send('update-progress', {
            appId,
            progress: 0,
            status: 'failed'
        });
        return {
            success: false,
            reason: "unknown"
        };
    }
});

/**
 * Get all installed apps (winget list) – returns a coarse list parsed left-to-right
 */
ipcMain.handle("get-all-apps", async () => {
    try {
        const {
            stdout
        } = await runCommand("winget list");
        if (!stdout) return [];

        const lines = stdout.split("\n").map(l => l.replace(/\r/, ""));
        const apps = [];
        let started = false;

        for (const raw of lines) {
            const line = raw.trim();
            if (!started) {
                if (line.match(/^[-\s]+$/)) started = true;
                continue;
            }
            if (!line) continue;

            // Split by 2+ spaces to capture name tokens with spaces
            const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
            if (parts.length >= 3) {
                apps.push({
                    name: parts[0],
                    id: parts[1],
                    version: parts[2],
                    source: parts[3] || "winget"
                });
            }
        }

        return apps;
    } catch (e) {
        console.error("Failed to run winget list:", e);
        return [];
    }
});

/**
 * Search Winget
 */
ipcMain.handle("search-winget", async (_, query) => {
    if (!query) return [];

    const terms = query.trim().toLowerCase().split(/\s+/);

    async function searchTerm(term) {
        try {
            const {
                stdout
            } = await runCommand(`winget search "${term}"`, {
                maxBuffer: 10 * 1024 * 1024
            });
            return stdout;
        } catch (e) {
            console.error("search error:", e);
            return "";
        }
    }

    function parseTable(stdout) {
        const lines = stdout.split(/\r?\n/);

        // skip header until dashed line
        let start = lines.findIndex(l => l.trim().startsWith("---"));
        if (start === -1) return [];

        const results = [];

        for (let i = start + 1; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                results.push({
                    name: parts[0] || "",
                    id: parts[1] || "",
                    version: parts[2] || "",
                    publisher: parts[3] || ""
                });
            }
        }
        return results;
    }

    const resultMap = new Map();

    // search each term separately
    for (const term of terms) {
        const output = await searchTerm(term);
        const parsed = parseTable(output);

        for (const item of parsed) {
            if (!resultMap.has(item.id)) {
                resultMap.set(item.id, item);
            }
        }
    }

    // filter results that match ALL words
    const final = [...resultMap.values()].filter(item => {
        const hay = `${item.name} ${item.id} ${item.publisher}`.toLowerCase();
        return terms.every(t => hay.includes(t));
    });

    return final;
});



/**
 * Install app via winget install
 */
ipcMain.handle("install-app", async (_, appId) => {
    if (!appId) return {
        success: false,
        reason: "invalid_id"
    };

    try {
        const {
            stdout,
            stderr
        } = await runCommand(
            `winget install --id "${appId}" --silent --accept-source-agreements --accept-package-agreements`, {
                maxBuffer: 10 * 1024 * 1024
            }
        );

        const out = (stdout + stderr).toLowerCase();

        // ✅ Comprehensive detection for ALREADY INSTALLED cases
        const alreadyInstalledPhrases = [
            "already installed",
            "is installed",
            "no applicable update",
            "installed. location",
            "package is already installed",
            "installed version is newer",
            "newer version is already installed",
            "no installer provided",
            "no upgrade available",
            "same version is already installed"
        ];

        if (alreadyInstalledPhrases.some(p => out.includes(p))) {
            return {
                success: false,
                reason: "already_installed"
            };
        }

        // ✅ Detect success
        if (
            out.includes("successfully installed") ||
            out.includes("install completed") ||
            out.includes("success") ||
            out.includes("install complete")
        ) {
            return {
                success: true
            };
        }

        // ❌ Unknown result
        return {
            success: false,
            reason: "unknown",
            output: out
        };

    } catch (e) {
        const out = (e.stdout || e.stderr || "").toLowerCase();

        // ✅ Detect already installed even on thrown errors
        const alreadyInstalledPhrases = [
            "already installed",
            "is installed",
            "no applicable update",
            "installed. location",
            "package is already installed",
            "installed version is newer",
            "newer version is already installed",
            "no installer provided",
            "no upgrade available",
            "same version is already installed"
        ];

        if (alreadyInstalledPhrases.some(p => out.includes(p))) {
            return {
                success: false,
                reason: "already_installed"
            };
        }

        return {
            success: false,
            reason: "unknown",
            output: out
        };
    }
});

// Windows 10 Classic Context Menu Tweak
const classicMenuKey = 'HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}';

ipcMain.handle("enable-classic-menu", async () => {
  try {
    await runCommand(`reg add "${classicMenuKey}\\InprocServer32" /f /ve`);
    await runCommand("taskkill /f /im explorer.exe");
    await runCommand("start explorer.exe");
    return true;
  } catch (e) {
    console.error("Enable classic menu failed:", e);
    return false;
  }
});

ipcMain.handle("disable-classic-menu", async () => {
  try {
    await runCommand(`reg delete "${classicMenuKey}" /f`);
    await runCommand("taskkill /f /im explorer.exe");
    await runCommand("start explorer.exe");
    return true;
  } catch (e) {
    console.error("Disable classic menu failed:", e);
    return false;
  }
});

ipcMain.handle("get-classic-menu-state", async () => {
  try {
    const { stdout } = await runCommand(`reg query "${classicMenuKey}\\InprocServer32"`);
    return stdout && stdout.length > 0;
  } catch (_) {
    return false;
  }
});

ipcMain.handle("run-powershell", async (_, command) => {
  return new Promise((resolve) => {
    try {
      // Create a simple batch script approach to avoid quote hell
      // Use PowerShell's -EncodedCommand to pass the command safely
      const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
      
      const fullCommand = `powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-EncodedCommand ${encodedCommand}'"`;
      
      console.log("Executing elevated PowerShell with encoded command");
      
      exec(fullCommand, (error, stdout, stderr) => {
        if (error) {
          console.error("Error launching PowerShell:", error.message);
          resolve({ success: false, error: error.message });
          return;
        }
        
        console.log("PowerShell launched successfully");
        resolve({ success: true });
      });
      
    } catch (err) {
      console.error("Exception launching PowerShell:", err);
      resolve({ success: false, error: err.message });
    }
  });
});