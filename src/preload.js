const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Kunden
  getKunden: () => ipcRenderer.invoke('get-kunden'),
  addKunde: (kunde) => ipcRenderer.invoke('add-kunde', kunde),
  updateKunde: (id, kunde) => ipcRenderer.invoke('update-kunde', id, kunde),
  deleteKunde: (id) => ipcRenderer.invoke('delete-kunde', id),

  // Pferde
  getPferde: () => ipcRenderer.invoke('get-pferde'),
  getPferdeByKunde: (kundeId) => ipcRenderer.invoke('get-pferde-by-kunde', kundeId),
  addPferd: (pferd) => ipcRenderer.invoke('add-pferd', pferd),
  updatePferd: (id, pferd) => ipcRenderer.invoke('update-pferd', id, pferd),
  deletePferd: (id) => ipcRenderer.invoke('delete-pferd', id),

  // Termine
  getTermine: () => ipcRenderer.invoke('get-termine'),
  addTermin: (termin) => ipcRenderer.invoke('add-termin', termin),
  updateTermin: (id, termin) => ipcRenderer.invoke('update-termin', id, termin),
  deleteTermin: (id) => ipcRenderer.invoke('delete-termin', id),

  // Hufbearbeitung
  getHufbearbeitungen: () => ipcRenderer.invoke('get-hufbearbeitungen'),
  addHufbearbeitung: (hufbearbeitung) => ipcRenderer.invoke('add-hufbearbeitung', hufbearbeitung),
  updateHufbearbeitung: (id, hufbearbeitung) => ipcRenderer.invoke('update-hufbearbeitung', id, hufbearbeitung),
  deleteHufbearbeitung: (id) => ipcRenderer.invoke('delete-hufbearbeitung', id),

  // Google Calendar
  syncGoogleCalendar: () => ipcRenderer.invoke('sync-google-calendar'),
  exportToGoogleCalendar: (termin) => ipcRenderer.invoke('export-to-google-calendar', termin)
});
