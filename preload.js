// Import from Electron
const { contextBridge, ipcRenderer } = require("electron");

// ✅ Safe API exposed to the renderer
contextBridge.exposeInMainWorld("appAPI", {
    
    // Winget functions
    getOutdatedApps: () => ipcRenderer.invoke("get-outdated-apps"),
    updateApp: (id) => ipcRenderer.invoke("update-app", id),
    getAllApps: () => ipcRenderer.invoke("get-all-apps"),
    searchWinget: (query) => ipcRenderer.invoke("search-winget", query),
    installApp: (id) => ipcRenderer.invoke("install-app", id),

    // Update + Install progress events
    onUpdateProgress: (callback) =>
        ipcRenderer.on("update-progress", (_, data) => callback(data)),

    // Windows tweaks
    enableClassicMenu: () => ipcRenderer.invoke("enable-classic-menu"),
    disableClassicMenu: () => ipcRenderer.invoke("disable-classic-menu"),
    getClassicMenuState: () => ipcRenderer.invoke("get-classic-menu-state"),

    // PowerShell runner
    runPowerShell: (command) =>
        ipcRenderer.invoke("run-powershell", command)
});
