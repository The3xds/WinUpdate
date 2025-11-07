// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appAPI", {
  // Get apps with available updates
  getOutdatedApps: () => ipcRenderer.invoke("get-outdated-apps"),

  // Update a specific app
  updateApp: (id) => ipcRenderer.invoke("update-app", id),

  // Get all installed apps
  getAllApps: () => ipcRenderer.invoke("get-all-apps"),

  // Search winget repository
  searchWinget: (query) => ipcRenderer.invoke("search-winget", query),

  // Install an app
  installApp: (id) => ipcRenderer.invoke("install-app", id),

  // Listen to progress updates (updates + installs)
  onUpdateProgress: (callback) => ipcRenderer.on("update-progress", (_, data) => callback(data)),
	
  enableClassicMenu: () => ipcRenderer.invoke("enable-classic-menu"),
  disableClassicMenu: () => ipcRenderer.invoke("disable-classic-menu"),
  getClassicMenuState: () => ipcRenderer.invoke("get-classic-menu-state")
});