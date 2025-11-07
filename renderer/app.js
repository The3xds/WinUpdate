// app.js
let currentView = 'available';
let updateHistory = [];
let hasScanned = false;
let darkMode = false;
let updatingApps = new Map();
let selectedUpdates = new Set();
let selectedApps = new Set();
let selectedAppNames = new Map();
let activeProfiles = new Set();

const installProfiles = {
  '3xds': {
    name: '3xds Setup',
    apps: [
      { id: 'Brave.Brave', name: 'Brave Browser' },
      { id: 'Valve.Steam', name: 'Steam' },
	  { id: 'EpicGames.EpicGamesLauncher', name: 'Epic Games' },
      { id: 'Discord.Discord', name: 'Discord' },
      { id: 'Spotify.Spotify', name: 'Spotify' },
	  { id: 'Nvidia.GeForceExperience', name: 'GeForce Experience' },
      { id: 'Notepad++.Notepad++', name: 'Notepad++' },
	  { id: 'brianlima.uwphook', name: 'UWPHook' },
	  { id: 'Elgato.StreamDeck', name: 'Elgato Stream Deck' },
	  { id: 'Logitech.GHUB', name: 'Logitech G HUB' },
	  { id: 'WinSCP.WinSCP', name: 'WinSCP' },
	  { id: 'RevoUninstaller.RevoUninstaller', name: 'Revo Uninstaller' },
	  { id: 'Modrinth.ModrinthApp', name: 'Modrinth App' },
	  { id: '7zip.7zip', name: '7-Zip' },
	  { id: 'CPUID.CPU-Z', name: 'CPUID CPU-Z' },
	  { id: 'CPUID.HWMonitor', name: 'CPUID HWMonitor' }
    ]
  },
  'nbq': {
    name: 'NBQ Setup',
    apps: [
	  { id: 'CPUID.CPU-Z', name: 'CPUID CPU-Z' },
	  { id: 'CPUID.HWMonitor', name: 'CPUID HWMonitor' },
	  { id: 'RARLab.WinRAR', name: 'WinRAR' },
	  { id: 'OBSProject.OBSStudio', name: 'OBS Studio' },
	  { id: 'Valve.Steam', name: 'Steam' },
	  { id: 'Ubisoft.Connect', name: 'Ubisoft Connect' },
	  { id: 'Discord.Discord', name: 'Discord' },
	  { id: 'Spotify.Spotify', name: 'Spotify' },
	  { id: 'Google.Chrome', name: 'Google Chrome' },
	  { id: 'RevoUninstaller.RevoUninstaller', name: 'Revo Uninstaller' },
	  { id: 'Windscribe.Windscribe', name: 'Windscribe' }
    ]
  },
  'jens': {
    name: 'Jens Setup',
    apps: [
      { id: 'Brave.Brave', name: 'Brave Browser' },
      { id: 'Valve.Steam', name: 'Steam' },
      { id: 'VideoLAN.VLC', name: 'VLC Media Player' },
      { id: 'Notepad++.Notepad++', name: 'Notepad++' }
    ]
  },
  'gaming': {
    name: 'Gaming Setup',
    apps: [
      { id: 'Valve.Steam', name: 'Steam' },
      { id: 'EpicGames.EpicGamesLauncher', name: 'Epic Games' },
      { id: 'Discord.Discord', name: 'Discord' },
      { id: 'Nvidia.GeForceExperience', name: 'GeForce Experience' }
    ]
  },
  'developer': {
    name: 'Developer Setup',
    apps: [
      { id: 'Microsoft.VisualStudioCode', name: 'VS Code' },
      { id: 'Git.Git', name: 'Git' },
      { id: 'Docker.DockerDesktop', name: 'Docker Desktop' },
      { id: 'Microsoft.WindowsTerminal', name: 'Windows Terminal' },
      { id: 'Postman.Postman', name: 'Postman' },
      { id: 'Brave.Brave', name: 'Brave Browser' }
    ]
  }
};

// Initialize
loadHistoryFromStorage();
loadDarkModePreference();

// Listen for update progress
window.appAPI.onUpdateProgress((data) => {
  const { appId, progress, status } = data;
  updateProgressBar(appId, progress, status);
});

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    loadApps();
  }, 500);
});

// Event Listeners
document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    currentView = item.getAttribute('data-view');
    loadView(currentView);
  });
});

document.getElementById("scan").addEventListener("click", () => {
  currentView = 'available';
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelector('.sidebar-item[data-view="available"]').classList.add('active');
  loadApps();
});

document.getElementById("history-btn").addEventListener("click", () => {
  currentView = 'history';
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  loadHistoryView();
});

document.getElementById("settings-btn").addEventListener("click", () => {
  currentView = 'settings';
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  loadSettingsView();
});

// View Functions
async function loadView(view) {
  // Immediately update header before loading content
  updateHeaderForView(view);
  
  if (view === 'available') {
    loadApps();
  } else if (view === 'installed') {
    loadInstalledApps();
  } else if (view === 'pending') {
    loadPendingApps();
  } else if (view === 'history') {
    loadHistoryView();
  } else if (view === 'winget') {
    loadWingetSearch();
  } else if (view === 'tweaks') {
    loadTweaksView();
  }
}

function updateHeaderForView(view) {
  const panelTitle = document.getElementById('panel-title');
  const panelSubtitle = document.getElementById('panel-subtitle');
  const toolbarInfo = document.getElementById('toolbar-info');
  const toolbarStatus = document.getElementById('toolbar-status');
  
  toolbarInfo.style.display = "flex";
  
  const headers = {
    'available': {
      title: 'Available Updates',
      subtitle: 'Scanning...',
      status: 'Scanning...'
    },
    'installed': {
      title: 'Installed Applications',
      subtitle: 'Loading...',
      status: 'Loading...'
    },
    'pending': {
      title: 'Pending Updates',
      subtitle: 'Updates queued for installation',
      status: 'No pending updates'
    },
    'history': {
      title: 'Update History',
      subtitle: 'Loading...',
      status: 'Loading...'
    },
    'winget': {
      title: 'Winget App Store',
      subtitle: 'Search and install applications from Winget',
      status: 'Ready to search'
    },
    'tweaks': {
      title: 'System Tweaks',
      subtitle: 'Customize Windows behavior and appearance',
      status: 'Ready'
    }
  };
  
  const header = headers[view];
  if (header) {
    panelTitle.textContent = header.title;
    panelSubtitle.textContent = header.subtitle;
    toolbarStatus.textContent = header.status;
  }
}

async function loadInstalledApps() {
  const results = document.getElementById("results");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const toolbarInfo = document.getElementById("toolbar-info");
  const toolbarStatus = document.getElementById("toolbar-status");

  document.getElementById('panel-title').textContent = 'Installed Applications';
  
  results.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading installed apps...</div>
    </div>
  `;

  toolbarInfo.style.display = "flex";
  toolbarStatus.textContent = "Loading...";

  const apps = await getAllInstalledApps();
  if (currentView !== 'installed') return;

  
  results.innerHTML = "";

  if (apps.length === 0) {
    results.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">No Apps Found</div>
        <div class="empty-description">No applications found on your system</div>
      </div>
    `;
    panelSubtitle.textContent = "No applications found";
    toolbarStatus.textContent = "Ready";
    return;
  }

  panelSubtitle.textContent = `${apps.length} application${apps.length !== 1 ? 's' : ''} installed`;
  toolbarStatus.textContent = `${apps.length} apps installed`;

  const appList = document.createElement("div");
  appList.className = "app-list";

  const header = document.createElement("div");
  header.className = "list-header";
  header.innerHTML = `
    <div></div>
    <div>Application</div>
    <div>Version</div>
    <div>Source</div>
    <div></div>
  `;
  appList.appendChild(header);

  apps.forEach((app) => {
    const row = document.createElement("div");
    row.className = "app-row";

    row.innerHTML = `
      <div class="app-icon">${getAppIcon(app.name)}</div>
      <div class="app-details">
        <div class="app-name">${app.name}</div>
        <div class="app-publisher">${app.id}</div>
      </div>
      <div class="app-version">${app.version}</div>
      <div class="app-version">${app.source || 'winget'}</div>
      <div class="app-action"></div>
    `;

    appList.appendChild(row);
  });

  results.appendChild(appList);
}

async function loadPendingApps() {
  const results = document.getElementById("results");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const toolbarInfo = document.getElementById("toolbar-info");
  const toolbarStatus = document.getElementById("toolbar-status");

  document.getElementById('panel-title').textContent = 'Pending Updates';
  panelSubtitle.textContent = "Updates queued for installation";
  
  toolbarInfo.style.display = "flex";
  toolbarStatus.textContent = "No pending updates";

  results.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏱️</div>
      <div class="empty-title">No Pending Updates</div>
      <div class="empty-description">Updates will appear here when queued</div>
    </div>
  `;
}

async function loadApps() {
  const results = document.getElementById("results");
  const scanBtn = document.getElementById("scan");
  const scanText = document.getElementById("scan-text");
  const toolbarInfo = document.getElementById("toolbar-info");
  const toolbarStatus = document.getElementById("toolbar-status");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const sidebarBadge = document.getElementById("sidebar-badge");
  
  document.getElementById('panel-title').textContent = 'Available Updates';
  
  scanBtn.disabled = true;
  scanText.textContent = "Scanning...";
  toolbarInfo.style.display = "flex";
  toolbarStatus.textContent = "Scanning...";
  
  results.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <div class="loading-text">Scanning for updates...</div>
    </div>
  `;

  const apps = await getSimulatedApps();
  
  // Check if user navigated away during scan
  if (currentView !== 'available') {
    scanBtn.disabled = false;
    scanText.textContent = "Check for Updates";
    return;
  }
  
  results.innerHTML = "";
  scanBtn.disabled = false;
  scanText.textContent = "Check for Updates";
  hasScanned = true;

  if (apps.length === 0) {
    results.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <div class="empty-title">Everything Up to Date</div>
        <div class="empty-description">All your applications are running the latest versions</div>
      </div>
    `;
    toolbarStatus.textContent = "All apps up to date";
    panelSubtitle.textContent = "All applications are up to date";
    sidebarBadge.style.display = "none";
    return;
  }

  toolbarStatus.textContent = `${apps.length} update${apps.length > 1 ? 's' : ''} available`;
  panelSubtitle.textContent = `${apps.length} application${apps.length > 1 ? 's' : ''} can be updated`;
  sidebarBadge.style.display = "block";
  sidebarBadge.textContent = apps.length;

  const updateSelectedContainer = document.createElement("div");
  updateSelectedContainer.style.cssText = "padding: 16px 24px; display: none;";
  updateSelectedContainer.className = "update-selected-container";
  updateSelectedContainer.id = "update-selected-container";
  updateSelectedContainer.innerHTML = `
    <button class="toolbar-button primary" id="update-selected-btn" style="margin: 0;">
      <span>⬆️</span>
      <span>Update Selected (0)</span>
    </button>
  `;

  const appList = document.createElement("div");
  appList.className = "app-list";

  const header = document.createElement("div");
  header.className = "list-header";
  header.innerHTML = `
    <div>Select</div>
    <div>Application</div>
    <div>Installed</div>
    <div>Available</div>
    <div></div>
  `;
  appList.appendChild(header);

  apps.forEach((app) => {
    const row = document.createElement("div");
    row.className = "app-row selectable";
    row.dataset.appId = app.id;

    row.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center;">
        <input type="checkbox" class="app-checkbox" data-app-id="${app.id}" ${selectedUpdates.has(app.id) ? 'checked' : ''}>
      </div>
      <div class="app-details">
        <div class="app-name">${app.name}</div>
        <div class="app-publisher">${app.id}</div>
      </div>
      <div class="app-version">${app.installedVersion}</div>
      <div class="app-version">${app.availableVersion}</div>
      <div class="app-action"></div>
    `;

    if (selectedUpdates.has(app.id)) {
      row.classList.add('selected');
    }

    const checkbox = row.querySelector('.app-checkbox');
    const actionCell = row.querySelector(".app-action");
    const btn = document.createElement("button");
    btn.className = "action-button";
    btn.textContent = "Update";

    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        selectedUpdates.add(app.id);
        row.classList.add('selected');
      } else {
        selectedUpdates.delete(app.id);
        row.classList.remove('selected');
      }
      updateSelectedButtonState();
    });

    row.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox' && e.target.tagName !== 'BUTTON') {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });

    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "Updating...";
      
      // Add progress bar
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-container';
      progressContainer.id = `progress-${app.id}`;
      progressContainer.innerHTML = `
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text">Starting...</div>
      `;
      actionCell.appendChild(progressContainer);
      btn.style.display = 'none';

      const result = await simulateUpdate(app.id, app.name);

      progressContainer.remove();
      btn.style.display = 'block';

      if (result.success) {
        btn.className = "action-button success";
        btn.textContent = "✓ Updated";
        
        addToHistory({
          name: app.name,
          id: app.id,
          fromVersion: app.installedVersion,
          toVersion: app.availableVersion,
          timestamp: new Date().toISOString(),
          status: 'success'
        });
        
        setTimeout(() => {
          row.style.opacity = "0";
          row.style.transition = "opacity 0.3s";
          setTimeout(loadApps, 300);
        }, 1000);
      } else {
        btn.className = "action-button error";
        
        if (result.reason === 'running') {
          btn.textContent = "App Running";
          setTimeout(() => {
            btn.textContent = "Close & Retry";
            btn.disabled = false;
            btn.className = "action-button";
          }, 2500);
        } else if (result.reason === 'permissions') {
          btn.textContent = "Need Admin";
          setTimeout(() => {
            btn.textContent = "Retry";
            btn.disabled = false;
            btn.className = "action-button";
          }, 2500);
        } else if (result.reason === 'installer_busy') {
          btn.textContent = "Installer Busy";
          setTimeout(() => {
            btn.textContent = "Retry";
            btn.disabled = false;
            btn.className = "action-button";
          }, 2500);
        } else {
          btn.textContent = "✗ Failed";
          setTimeout(() => {
            btn.textContent = "Retry";
            btn.disabled = false;
            btn.className = "action-button";
          }, 2000);
        }
        
        addToHistory({
          name: app.name,
          id: app.id,
          fromVersion: app.installedVersion,
          toVersion: app.availableVersion,
          timestamp: new Date().toISOString(),
          status: 'failed',
          reason: result.reason || 'unknown'
        });
      }
    };

    actionCell.appendChild(btn);
    appList.appendChild(row);
  });

  results.appendChild(updateSelectedContainer);
  results.appendChild(appList);

  document.getElementById('update-selected-btn').addEventListener('click', async () => {
    if (selectedUpdates.size === 0) return;

    const updateBtn = document.getElementById('update-selected-btn');
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<span>⏳</span><span>Updating...</span>';

    const appsToUpdate = Array.from(selectedUpdates);
    let successCount = 0;

    for (const appId of appsToUpdate) {
      const app = apps.find(a => a.id === appId);
      if (!app) continue;

      // Find the row and action cell for this app
      const row = document.querySelector(`.app-row[data-app-id="${appId}"]`);
      if (row) {
        const actionCell = row.querySelector('.app-action');
        const btn = actionCell.querySelector('.action-button');
        
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Updating...";
          btn.style.display = 'none';
        }

        // Add progress bar
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.id = `progress-${appId}`;
        progressContainer.innerHTML = `
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text">Starting...</div>
        `;
        actionCell.appendChild(progressContainer);
      }

      const result = await simulateUpdate(appId, app.name);

      // Handle result and update UI
      if (row) {
        const actionCell = row.querySelector('.app-action');
        const btn = actionCell.querySelector('.action-button');
        const progressContainer = document.getElementById(`progress-${appId}`);

        if (progressContainer) {
          progressContainer.remove();
        }

        if (btn) {
          btn.style.display = 'block';
        }

        if (result.success) {
          successCount++;
          selectedUpdates.delete(appId);

          if (btn) {
            btn.className = "action-button success";
            btn.textContent = "✓ Updated";
          }

          addToHistory({
            name: app.name,
            id: app.id,
            fromVersion: app.installedVersion,
            toVersion: app.availableVersion,
            timestamp: new Date().toISOString(),
            status: 'success'
          });

          // Fade out successful updates
          setTimeout(() => {
            row.style.opacity = "0";
            row.style.transition = "opacity 0.3s";
          }, 1000);
        } else {
          if (btn) {
            btn.className = "action-button error";
            
            if (result.reason === 'running') {
              btn.textContent = "App Running";
              setTimeout(() => {
                btn.textContent = "Close & Retry";
                btn.disabled = false;
                btn.className = "action-button";
              }, 2500);
            } else if (result.reason === 'permissions') {
              btn.textContent = "Need Admin";
              setTimeout(() => {
                btn.textContent = "Retry";
                btn.disabled = false;
                btn.className = "action-button";
              }, 2500);
            } else if (result.reason === 'installer_busy') {
              btn.textContent = "Installer Busy";
              setTimeout(() => {
                btn.textContent = "Retry";
                btn.disabled = false;
                btn.className = "action-button";
              }, 2500);
            } else {
              btn.textContent = "✗ Failed";
              setTimeout(() => {
                btn.textContent = "Retry";
                btn.disabled = false;
                btn.className = "action-button";
              }, 2000);
            }
          }

          addToHistory({
            name: app.name,
            id: app.id,
            fromVersion: app.installedVersion,
            toVersion: app.availableVersion,
            timestamp: new Date().toISOString(),
            status: 'failed',
            reason: result.reason || 'unknown'
          });
        }
      }
    }

    updateBtn.innerHTML = `<span>✓</span><span>Updated ${successCount}/${appsToUpdate.length}</span>`;
    
    setTimeout(() => {
      loadApps();
    }, 2000);
  });

  function updateSelectedButtonState() {
    const container = document.getElementById('update-selected-container');
    const btn = document.getElementById('update-selected-btn');
    
    if (selectedUpdates.size > 0) {
      container.style.display = 'block';
      btn.innerHTML = `<span>⬆️</span><span>Update Selected (${selectedUpdates.size})</span>`;
    } else {
      container.style.display = 'none';
    }
  }
}

function loadWingetSearch() {
  const results = document.getElementById("results");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const toolbarInfo = document.getElementById("toolbar-info");
  const toolbarStatus = document.getElementById("toolbar-status");

  document.getElementById('panel-title').textContent = 'Winget App Store';
  panelSubtitle.textContent = "Search and install applications from Winget";
  toolbarInfo.style.display = "flex";
  toolbarStatus.textContent = "Ready to search";

  selectedApps.clear();

  results.innerHTML = `
    <div class="profiles-section">
      <div class="profiles-header">Quick Install Profiles</div>
      <div class="profiles-grid" id="profiles-grid"></div>
    </div>
    <div class="search-container">
      <div class="search-bar">
        <input type="text" class="search-input" id="winget-search-input" placeholder="Search for apps (e.g., chrome, vscode, discord)...">
        <button class="search-button" id="search-winget-btn">Search</button>
        <button class="install-selected-btn" id="install-selected-btn">Install Selected (0)</button>
      </div>
    </div>
    <div id="selected-apps-container" style="display: none;">

      <div class="selected-container">
        <div style="font-size: 12px; font-weight: 600; color: #0051d5; margin-bottom: 8px;" class="selected-header">SELECTED FOR INSTALLATION</div>
        <div id="selected-apps-list" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
      </div>
    </div>
    <div id="search-results">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Search for Apps</div>
        <div class="empty-description">Enter a search term above to find applications, or select a profile to get started</div>
      </div>
    </div>
  `;

  const profilesGrid = document.getElementById('profiles-grid');
  Object.entries(installProfiles).forEach(([key, profile]) => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.dataset.profileKey = key;
    card.innerHTML = `
      <div class="profile-name">${profile.name}</div>
      <div class="profile-apps">
        ${(() => {
        const names = profile.apps.map(a => a.name);
        const limit = 6; // ✅ show only 6 apps
        return names.length > limit
          ? names.slice(0, limit).join(', ') + ` +${names.length - limit} more`
          : names.join(', ');
        })()}
      </div>
      <div class="profile-count">${profile.apps.length} apps</div>
    `;
    
    card.addEventListener('click', () => {
      const isCardSelected = activeProfiles.has(key);
      
      if (isCardSelected) {
        activeProfiles.delete(key);
        card.classList.remove('selected');
        
        profile.apps.forEach(app => {
          let isInOtherProfile = false;
          
          activeProfiles.forEach(otherProfileKey => {
            const otherProfile = installProfiles[otherProfileKey];
            if (otherProfile.apps.some(a => a.id === app.id)) {
              isInOtherProfile = true;
            }
          });
          
          if (!isInOtherProfile) {
            selectedApps.delete(app.id);
            selectedAppNames.delete(app.id);
          }
        });
      } else {
        activeProfiles.add(key);
        card.classList.add('selected');
        profile.apps.forEach(app => {
          selectedApps.add(app.id);
          selectedAppNames.set(app.id, app.name);
        });
      }
      
      updateInstallButton();
      updateSelectedAppsDisplay();
    });
    
    profilesGrid.appendChild(card);
  });

  const searchInput = document.getElementById('winget-search-input');
  const searchBtn = document.getElementById('search-winget-btn');
  const installSelectedBtn = document.getElementById('install-selected-btn');

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performWingetSearch();
    }
  });

  searchBtn.addEventListener('click', performWingetSearch);

installSelectedBtn.addEventListener('click', async () => {
    if (selectedApps.size === 0) return;

    installSelectedBtn.disabled = true;
    installSelectedBtn.textContent = "Installing...";

    const appsToInstall = Array.from(selectedApps);
    let successCount = 0;

    for (const appId of appsToInstall) {
        const appName = selectedAppNames.get(appId) || appId;

        const row = document.querySelector(`.app-row[data-app-id="${appId}"]`);
        const actionCell = row?.querySelector(".app-action");
        const btn = actionCell?.querySelector(".action-button");
        const checkbox = row?.querySelector(".app-checkbox");

        if (btn) {
            btn.disabled = true;
            btn.style.display = "none";
        }

        // ✅ Create progress bar
        const progressContainer = document.createElement("div");
        progressContainer.className = "progress-container";
        progressContainer.id = `progress-${appId}`;
        progressContainer.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">Starting...</div>
        `;
        if (actionCell) actionCell.appendChild(progressContainer);

        // ✅ Perform install
        const installResult = await installApp(appId);

        // ✅ Remove progress UI
        progressContainer.remove();
        if (btn) btn.style.display = "block";

        // ✅ SUCCESS
        if (installResult.success || installResult.reason === "already_installed") {
            successCount++;
            selectedApps.delete(appId);
            selectedAppNames.delete(appId);

            if (btn) {
                btn.className = "action-button success";
                btn.textContent = installResult.reason === "already_installed"
                    ? "Already Installed"
                    : "✓ Installed";
            }

            if (checkbox) checkbox.disabled = true;
            row?.classList.remove("selectable");

            addToHistory({
                name: appName,
                id: appId,
                fromVersion: "Not Installed",
                toVersion: "Latest",
                timestamp: new Date().toISOString(),
                status: "installed"
            });
        }

        // ❌ FAILURE — BUT DO NOT STOP THE BUTTON
        else {
            if (btn) {
                btn.className = "action-button error";
                btn.textContent = "Failed";

                // ✅ Allow user to retry
                setTimeout(() => {
                    btn.disabled = false;
                    btn.className = "action-button";
                    btn.textContent = "Retry";
                }, 1500);
            }

            addToHistory({
                name: appName,
                id: appId,
                fromVersion: "Not Installed",
                toVersion: "Latest",
                timestamp: new Date().toISOString(),
                status: "install_failed",
                reason: installResult.reason || "unknown"
            });
        }
    }

    // ✅ Update UI after batch finishes
    installSelectedBtn.disabled = false;
    installSelectedBtn.textContent = `Install Selected (${selectedApps.size})`;

    // ✅ If all succeeded → show summary
    if (successCount === appsToInstall.length) {
        installSelectedBtn.textContent = `Installed ${successCount}/${appsToInstall.length}`;
        setTimeout(() => {
            performWingetSearch();
        }, 1000);
    } else {
        // ✅ Some apps failed → button stays clickable
        installSelectedBtn.textContent = `Install Selected (${selectedApps.size})`;
    }

    updateSelectedAppsDisplay();
});




  async function performWingetSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    const searchResults = document.getElementById('search-results');
    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';
    toolbarStatus.textContent = 'Searching...';

    searchResults.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">Searching Winget for "${query}"...</div>
      </div>
    `;

    const apps = await searchWinget(query);

    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
    searchResults.innerHTML = '';
    updateInstallButton();
    updateSelectedAppsDisplay();

    if (apps.length === 0) {
      searchResults.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-title">No Results</div>
          <div class="empty-description">No applications found for "${query}"</div>
        </div>
      `;
      toolbarStatus.textContent = 'No results';
      return;
    }

    toolbarStatus.textContent = `Found ${apps.length} app${apps.length !== 1 ? 's' : ''}`;
    panelSubtitle.textContent = `${apps.length} application${apps.length !== 1 ? 's' : ''} found`;

    const appList = document.createElement("div");
    appList.className = "app-list";

    const header = document.createElement("div");
    header.className = "list-header";
    header.innerHTML = `
      <div>Select</div>
      <div>Application</div>
      <div>Version</div>
      <div>Publisher</div>
      <div></div>
    `;
    appList.appendChild(header);

    apps.forEach((app) => {
      const row = document.createElement("div");
      row.className = "app-row";
      row.dataset.appId = app.id;

      row.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center;">
          <input type="checkbox" class="app-checkbox" data-app-id="${app.id}" ${selectedApps.has(app.id) ? 'checked' : ''}>
        </div>
        <div class="app-details">
          <div class="app-name">${app.name}</div>
          <div class="app-publisher">${app.id}</div>
        </div>
        <div class="app-version">${app.version || 'N/A'}</div>
        <div class="app-version">${app.publisher || 'N/A'}</div>
        <div class="app-action"></div>
      `;

      if (selectedApps.has(app.id)) {
        row.classList.add('selected');
      }

      const checkbox = row.querySelector('.app-checkbox');
      const actionCell = row.querySelector(".app-action");
      const btn = document.createElement("button");
      btn.className = "action-button";
      btn.textContent = "Install";

      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          selectedApps.add(app.id);
          selectedAppNames.set(app.id, app.name);
          row.classList.add('selected');
        } else {
          selectedApps.delete(app.id);
          selectedAppNames.delete(app.id);
          row.classList.remove('selected');
        }
        updateInstallButton();
        updateSelectedAppsDisplay();
      });

      row.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox' && e.target.tagName !== 'BUTTON') {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });

    row.classList.add('selectable');

    btn.onclick = async (e) => {
    e.stopPropagation();

    // Hide the install button
    btn.disabled = true;
    btn.style.display = "none";

    // Create progress bar UI
    const progressContainer = document.createElement("div");
    progressContainer.className = "progress-container";
    progressContainer.id = `progress-${app.id}`;
    progressContainer.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text">Starting...</div>
    `;
    actionCell.appendChild(progressContainer);

    const bar = progressContainer.querySelector(".progress-fill");
    const text = progressContainer.querySelector(".progress-text");

    // ✅ Perform installation via preload → main.js
    const installResult = await installApp(app.id);

    // ✅ Progress bar stays long enough to read
    setTimeout(() => {
        progressContainer.remove();
        btn.style.display = "block";
    }, 500);

    // ✅ ALREADY INSTALLED (green success)
    if (installResult.reason === "already_installed") {
        if (bar) bar.style.width = "100%";
        if (text) text.textContent = "Already Installed ✅";

        btn.className = "action-button success";
        btn.textContent = "Installed";

        checkbox.disabled = true;
        row.classList.remove("selectable");

        selectedApps.delete(app.id);
        selectedAppNames.delete(app.id);
        updateInstallButton();
        updateSelectedAppsDisplay();

        addToHistory({
            name: app.name,
            id: app.id,
            fromVersion: "Not Installed",
            toVersion: app.version || "Latest",
            timestamp: new Date().toISOString(),
            status: "installed"
        });

        return;
    }

    // ✅ SUCCESSFUL INSTALL
    if (installResult.success) {
        if (bar) bar.style.width = "100%";
        if (text) text.textContent = "Installed ✅";

        btn.className = "action-button success";
        btn.textContent = "✓ Installed";

        checkbox.disabled = true;
        row.classList.remove("selectable");

        selectedApps.delete(app.id);
        selectedAppNames.delete(app.id);
        updateInstallButton();
        updateSelectedAppsDisplay();

        addToHistory({
            name: app.name,
            id: app.id,
            fromVersion: "Not Installed",
            toVersion: app.version || "Latest",
            timestamp: new Date().toISOString(),
            status: "installed"
        });

        return;
    }

    // ❌ FAILED INSTALL
    if (bar) bar.style.width = "100%";
    if (text) text.textContent = "Failed ❌";

    btn.className = "action-button error";

    if (installResult.reason === "already_installed") {
        btn.textContent = "Already Installed";
    } else {
        btn.textContent = "✗ Failed";

        setTimeout(() => {
            btn.disabled = false;
            btn.className = "action-button";
            btn.textContent = "Retry";
        }, 2000);
    }

        addToHistory({
            name: app.name,
            id: app.id,
            fromVersion: "Not Installed",
            toVersion: app.version || "Latest",
            timestamp: new Date().toISOString(),
            status: "install_failed",
            reason: installResult.reason || "unknown"
        });
    };


      actionCell.appendChild(btn);
      appList.appendChild(row);
    });

    searchResults.appendChild(appList);
  }

  function updateInstallButton() {
    const installBtn = document.getElementById('install-selected-btn');
    if (selectedApps.size > 0) {
      installBtn.classList.add('show');
      installBtn.textContent = `Install Selected (${selectedApps.size})`;
    } else {
      installBtn.classList.remove('show');
    }
  }

  function updateSelectedAppsDisplay() {
    const container = document.getElementById('selected-apps-container');
    const listDiv = document.getElementById('selected-apps-list');
    
    if (selectedApps.size === 0) {
      container.style.display = 'none';
      activeProfiles.clear();
      document.querySelectorAll('.profile-card').forEach(card => {
        card.classList.remove('selected');
      });
      return;
    }

    container.style.display = 'block';
    listDiv.innerHTML = '';

    document.querySelectorAll('.profile-card').forEach(card => {
      const profileKey = card.dataset.profileKey;
      if (profileKey && activeProfiles.has(profileKey)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    selectedApps.forEach(appId => {
      const appName = selectedAppNames.get(appId) || appId;
      const tag = document.createElement('div');
      tag.className = 'selected-app-tag';
      tag.innerHTML = `
        <span>${appName}</span>
        <span class="remove-tag" data-app-id="${appId}">×</span>
      `;
      
      tag.querySelector('.remove-tag').addEventListener('click', () => {
        selectedApps.delete(appId);
        selectedAppNames.delete(appId);
        
        activeProfiles.forEach(profileKey => {
          const profile = installProfiles[profileKey];
          const allAppsStillSelected = profile.apps.every(app => selectedApps.has(app.id));
          if (!allAppsStillSelected) {
            activeProfiles.delete(profileKey);
          }
        });
        
        const checkbox = document.querySelector(`.app-checkbox[data-app-id="${appId}"]`);
        if (checkbox) {
          checkbox.checked = false;
          checkbox.closest('.app-row').classList.remove('selected');
        }
        
        updateInstallButton();
        updateSelectedAppsDisplay();
      });
      
      listDiv.appendChild(tag);
    });
  }
}

function loadSettingsView() {
  const results = document.getElementById("results");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const toolbarInfo = document.getElementById("toolbar-info");
  const toolbarStatus = document.getElementById("toolbar-status");

  document.getElementById('panel-title').textContent = 'Settings';
  panelSubtitle.textContent = "Customize your app updater experience";
  toolbarInfo.style.display = "flex";
  toolbarStatus.textContent = "Settings";

  results.innerHTML = `
    <div style="padding: 24px;">
      <div class="settings-card" style="background: white; border-radius: 10px; padding: 24px; max-width: 600px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #333;">Appearance</h3>
        
        <div class="setting-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
          <div>
            <div class="setting-label" style="font-size: 14px; font-weight: 500; color: #333; margin-bottom: 4px;">Dark Mode</div>
            <div class="setting-description" style="font-size: 12px; color: #666;">Use dark theme for the interface</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="dark-mode-toggle" ${darkMode ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e0e0e0;" class="about-section">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #333;">About</h3>
          <div style="font-size: 13px; color: #666; line-height: 1.6;" class="about-text">
            <p style="margin: 8px 0;"><strong>Version:</strong> 1.0.0</p>
            <p style="margin: 8px 0;"><strong>App Updater</strong> - Manage and update your applications with ease using Winget</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
    toggleDarkMode();
  });
}

function loadHistoryView() {
  const results = document.getElementById("results");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const toolbarInfo = document.getElementById("toolbar-info");
  const toolbarStatus = document.getElementById("toolbar-status");

  document.getElementById('panel-title').textContent = 'Update History';
  
  toolbarInfo.style.display = "flex";
  
  results.innerHTML = "";
  
  if (updateHistory.length === 0) {
    results.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">No History Yet</div>
        <div class="empty-description">Your update history will appear here after you update apps</div>
      </div>
    `;
    panelSubtitle.textContent = "No updates performed yet";
    toolbarStatus.textContent = "No history";
    return;
  }

  panelSubtitle.textContent = `${updateHistory.length} update${updateHistory.length !== 1 ? 's' : ''} in history`;
  toolbarStatus.textContent = `${updateHistory.length} updates logged`;

  const appList = document.createElement("div");
  appList.className = "app-list";

  const header = document.createElement("div");
  header.className = "list-header";
  header.innerHTML = `
    <div></div>
    <div>Application</div>
    <div>From Version</div>
    <div>To Version</div>
    <div>Date</div>
  `;
  appList.appendChild(header);

  updateHistory.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "app-row";

    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let statusIcon, statusColor;
    
    if (entry.status === 'success') {
      statusIcon = '✓';
      statusColor = '#34c759';
    } else if (entry.status === 'installed') {
      statusIcon = '⬇';
      statusColor = '#007aff';
    } else {
      statusIcon = '✗';
      statusColor = '#ff3b30';
    }

    row.innerHTML = `
      <div class="app-icon" style="background: ${statusColor}">${statusIcon}</div>
      <div class="app-details">
        <div class="app-name">${entry.name}</div>
        <div class="app-publisher">${entry.id}</div>
      </div>
      <div class="app-version">${entry.fromVersion}</div>
      <div class="app-version">${entry.toVersion}</div>
      <div class="app-version" style="font-family: -apple-system, sans-serif;">${dateStr}</div>
    `;

    appList.appendChild(row);
  });

  results.appendChild(appList);
}

// Helper Functions
function getAppIcon(name) {
  const icons = {
    'Google Chrome': '🌐',
    'Visual Studio Code': '💻',
    'Firefox': '🦊',
    'Spotify': '🎵',
    'Discord': '💬',
    'Slack': '💼',
  };
  
  for (let key in icons) {
    if (name.includes(key)) return icons[key];
  }
  return '📦';
}

async function getSimulatedApps() {
  return await window.appAPI.getOutdatedApps();
}

async function simulateUpdate(appId, appName) {
  let result = await window.appAPI.updateApp(appId);
  console.log(`Update attempt for ${appId}:`, result.success ? 'SUCCESS' : 'FAILED');
  if (!result.success && result.reason) {
    console.log(`Failure reason: ${result.reason}`);
    
    if (result.reason === 'installer_busy') {
      console.log('Installer busy, waiting 5 seconds and retrying...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      result = await window.appAPI.updateApp(appId);
      console.log(`Retry attempt for ${appId}:`, result.success ? 'SUCCESS' : 'FAILED');
    }
  }
  return result;
}

async function getAllInstalledApps() {
  return await window.appAPI.getAllApps();
}

async function searchWinget(query) {
  return await window.appAPI.searchWinget(query);
}

async function installApp(appId) {
  return await window.appAPI.installApp(appId);
}

function loadHistoryFromStorage() {
  const stored = localStorage.getItem('updateHistory');
  if (stored) {
    try {
      updateHistory = JSON.parse(stored);
    } catch (e) {
      updateHistory = [];
    }
  }
}

function saveHistoryToStorage() {
  localStorage.setItem('updateHistory', JSON.stringify(updateHistory));
}

function addToHistory(entry) {
  updateHistory.unshift(entry);
  if (updateHistory.length > 100) {
    updateHistory = updateHistory.slice(0, 100);
  }
  saveHistoryToStorage();
}

function loadDarkModePreference() {
  const stored = localStorage.getItem('darkMode');
  if (stored === 'true') {
    darkMode = true;
    document.body.classList.add('dark-mode');
  }
}

function toggleDarkMode() {
  darkMode = !darkMode;
  if (darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  localStorage.setItem('darkMode', darkMode);
}

function updateProgressBar(appId, progress, status) {
  const progressContainer = document.getElementById(`progress-${appId}`);
  if (!progressContainer) return;

  const progressFill = progressContainer.querySelector('.progress-fill');
  const progressText = progressContainer.querySelector('.progress-text');

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }

  if (progressText) {
    const statusTexts = {
      'starting': 'Starting update...',
      'downloading': 'Downloading...',
      'installing': 'Installing...',
      'complete': 'Complete',
      'failed': 'Failed'
    };
    progressText.textContent = statusTexts[status] || `${progress}%`;
  }
}

function loadTweaksView() {
  const results = document.getElementById("results");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const toolbarInfo = document.getElementById("toolbar-info");
  const toolbarStatus = document.getElementById("toolbar-status");

  document.getElementById('panel-title').textContent = 'System Tweaks';
  panelSubtitle.textContent = "Customize Windows behavior and appearance";
  toolbarInfo.style.display = "flex";
  toolbarStatus.textContent = "Ready";

  results.innerHTML = `
    <div class="tweaks-container">
      <div class="tweaks-section">
        <div class="tweaks-section-header">
          <div>
            <div class="tweaks-section-title">Tweaks Menu</div>
            <div class="tweaks-section-description">Customize right-click menu behavior and launch WinUtil</div>
          </div>
        </div>
        
        <div class="tweaks-list">
          <div class="tweak-item">
            <div class="tweak-info">
              <div class="tweak-name">Classic Context Menu</div>
              <div class="tweak-description">Use the Windows 10-style right-click menu instead of Windows 11's modern menu</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="classic-menu-toggle">
              <span class="toggle-slider"></span>
            </label>
          </div>
		  
		<div class="tweak-item">
          <div class="tweak-info">
            <div class="tweak-name">Run Chris Titus Tech WinUtil</div>
              <div class="tweak-description">Downloads and runs the WinUtil script from christitus.com</div>
            </div>
               <button class="action-button" id="run-ctt-script-btn">Run Script</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load toggle initial state
  window.appAPI.getClassicMenuState().then(enabled => {
    document.getElementById('classic-menu-toggle').checked = enabled;
  });
  
    document.getElementById('run-ctt-script-btn').addEventListener('click', async () => {
    const btn = document.getElementById('run-ctt-script-btn');
    btn.disabled = true;
    btn.textContent = "Launching...";
    
    try {
      const result = await window.appAPI.runPowerShell(`irm "https://christitus.com/win" | iex`);
      
      if (result.success) {
        btn.className = "action-button success";
        btn.textContent = "✓ Launched";
        
        setTimeout(() => {
          btn.disabled = false;
          btn.className = "action-button";
          btn.textContent = "Run Script";
        }, 2000);
      } else {
        btn.className = "action-button error";
        btn.textContent = "✗ Failed";
        
        setTimeout(() => {
          btn.disabled = false;
          btn.className = "action-button";
          btn.textContent = "Retry";
        }, 2000);
      }
    } catch (e) {
      btn.className = "action-button error";
      btn.textContent = "✗ Error";
      
      setTimeout(() => {
        btn.disabled = false;
        btn.className = "action-button";
        btn.textContent = "Retry";
      }, 2000);
    }
  });

  // Toggle listener
  document.getElementById('classic-menu-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      window.appAPI.enableClassicMenu();
    } else {
      window.appAPI.disableClassicMenu();
    }
  });
}
