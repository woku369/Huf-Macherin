import { contextBridge, ipcRenderer } from 'electron';

// Preload-Skript für sichere Kommunikation zwischen Electron und Renderer
window.addEventListener('DOMContentLoaded', () => {
  // Hier können später APIs bereitgestellt werden
});

contextBridge.exposeInMainWorld('api', {
  // Kunden
  listKunden: () => ipcRenderer.invoke('kunden:list'),
  addKunde: (kunde) => ipcRenderer.invoke('kunden:add', kunde),
  deleteKunde: (id) => ipcRenderer.invoke('kunden:delete', id),
  // Pferde
  listPferde: (besitzerId) => ipcRenderer.invoke('pferde:list', besitzerId),
  addPferd: (pferd) => ipcRenderer.invoke('pferde:add', pferd),
  deletePferd: (id) => ipcRenderer.invoke('pferde:delete', id),
  // Termine
  listTermine: (pferdId) => ipcRenderer.invoke('termine:list', pferdId),
  addTermin: (termin) => ipcRenderer.invoke('termine:add', termin),
  deleteTermin: (id) => ipcRenderer.invoke('termine:delete', id),
  updateTermin: (termin) => ipcRenderer.invoke('termine:update', termin),
  listAlleTermine: () => ipcRenderer.invoke('alleTermine:list'),
  // Google Kalender
  googleLogin: () => ipcRenderer.invoke('google:login'),
  googleAuthCode: (code) => ipcRenderer.invoke('google:authcode', code),
  googleIsLoggedIn: () => ipcRenderer.invoke('google:isLoggedIn'),
  googleExportTermin: (termin) => ipcRenderer.invoke('google:exportTermin', termin),
});
