const { contextBridge, ipcRenderer } = require('electron');

// API für das Frontend bereitstellen
contextBridge.exposeInMainWorld('api', {
  // Kunden-API (Frontend verwendet diese Namen)
  listKunden: () => ipcRenderer.invoke('kunden:list'),
  addKunde: (kunde: any) => ipcRenderer.invoke('kunden:add', kunde),
  updateKunde: (kunde: any) => ipcRenderer.invoke('kunden:update', kunde),
  deleteKunde: (id: number) => ipcRenderer.invoke('kunden:delete', id),

  // Pferde-API (erweitert)
  listPferde: (besitzerId: number) => ipcRenderer.invoke('pferde:list', besitzerId),
  addPferd: (pferd: any) => ipcRenderer.invoke('pferde:add', pferd),
  updatePferd: (pferd: any) => ipcRenderer.invoke('pferde:update', pferd),
  deletePferd: (id: number) => ipcRenderer.invoke('pferde:delete', id),
  getLastBearbeitung: (pferdId: number) => ipcRenderer.invoke('pferde:getLastBearbeitung', pferdId),
  getPferdHistorie: (pferdId: number) => ipcRenderer.invoke('pferde:history', pferdId),
  getKundenHistorie: (besitzerId: number) => ipcRenderer.invoke('kunden:history', besitzerId),

  // Termine-API
  listTermine: (pferdId: number) => ipcRenderer.invoke('termine:list', pferdId),
  addTermin: (termin: any) => ipcRenderer.invoke('termine:add', termin),
  addMultipleTermine: (terminDaten: any) => ipcRenderer.invoke('termine:addMultiple', terminDaten),
  deleteTermin: (id: number) => ipcRenderer.invoke('termine:delete', id),
  updateTermin: (termin: any) => ipcRenderer.invoke('termine:update', termin),
  listAlleTermine: () => ipcRenderer.invoke('alleTermine:list'),

  // Hufbearbeitung-API
  hufbearbeitung: {
    add: (bearbeitung: any) => ipcRenderer.invoke('hufbearbeitung:add', bearbeitung),
    list: (terminId: number) => ipcRenderer.invoke('hufbearbeitung:list', terminId),
  },

  // Termine-API (erweitert)
  termine: {
    updateStatus: (terminId: number, status: string) => ipcRenderer.invoke('termine:updateStatus', terminId, status),
    abschliessen: (terminId: number, folgeWochen: number) => ipcRenderer.invoke('termine:abschliessen', terminId, folgeWochen),
  },

  // Google Calendar
  googleLogin: () => ipcRenderer.invoke('google:login'),
  googleIsLoggedIn: () => ipcRenderer.invoke('google:isLoggedIn'),
  googleExportTermin: (termin: any) => ipcRenderer.invoke('google:exportTermin', termin),
});