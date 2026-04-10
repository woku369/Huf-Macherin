const { contextBridge, ipcRenderer } = require('electron');
// API für das Frontend bereitstellen
contextBridge.exposeInMainWorld('api', {
    // Kunden-API (Frontend verwendet diese Namen)
    listKunden: () => ipcRenderer.invoke('kunden:list'),
    addKunde: (kunde) => ipcRenderer.invoke('kunden:add', kunde),
    updateKunde: (kunde) => ipcRenderer.invoke('kunden:update', kunde),
    deleteKunde: (id) => ipcRenderer.invoke('kunden:delete', id),
    // Pferde-API (erweitert)
    listPferde: (besitzerId) => ipcRenderer.invoke('pferde:list', besitzerId),
    addPferd: (pferd) => ipcRenderer.invoke('pferde:add', pferd),
    updatePferd: (pferd) => ipcRenderer.invoke('pferde:update', pferd),
    deletePferd: (id) => ipcRenderer.invoke('pferde:delete', id),
    getLastBearbeitung: (pferdId) => ipcRenderer.invoke('pferde:getLastBearbeitung', pferdId),
    getPferdHistorie: (pferdId) => ipcRenderer.invoke('pferde:history', pferdId),
    getKundenHistorie: (besitzerId) => ipcRenderer.invoke('kunden:history', besitzerId),
    // Termine-API
    listTermine: (pferdId) => ipcRenderer.invoke('termine:list', pferdId),
    addTermin: (termin) => ipcRenderer.invoke('termine:add', termin),
    addMultipleTermine: (terminDaten) => ipcRenderer.invoke('termine:addMultiple', terminDaten),
    deleteTermin: (id) => ipcRenderer.invoke('termine:delete', id),
    updateTermin: (termin) => ipcRenderer.invoke('termine:update', termin),
    listAlleTermine: () => ipcRenderer.invoke('alleTermine:list'),
    // Flat-Alias für Kompatibilität
    updateTerminStatus: (terminId, status) => ipcRenderer.invoke('termine:updateStatus', terminId, status),
    // Hufbearbeitung-API
    hufbearbeitung: {
        add: (bearbeitung) => ipcRenderer.invoke('hufbearbeitung:add', bearbeitung),
        list: (terminId) => ipcRenderer.invoke('hufbearbeitung:list', terminId),
    },
    // Termine-API (erweitert)
    termine: {
        updateStatus: (terminId, status) => ipcRenderer.invoke('termine:updateStatus', terminId, status),
        abschliessen: (terminId, folgeWochen) => ipcRenderer.invoke('termine:abschliessen', terminId, folgeWochen),
    },
});
