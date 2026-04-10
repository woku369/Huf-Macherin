// IPC-Handler für Kunden- und Pferdeverwaltung im Electron-Main-Prozess
import { ipcMain } from 'electron';
import db from './db.js';
// Kunden-API
ipcMain.handle('kunden:list', () => {
    const stmt = db.prepare('SELECT * FROM kunden');
    return stmt.all();
});
ipcMain.handle('kunden:add', (_event, kunde) => {
    const stmt = db.prepare('INSERT INTO kunden (name, adresse) VALUES (?, ?)');
    const info = stmt.run(kunde.name, kunde.adresse);
    return { id: info.lastInsertRowid, ...kunde };
});
ipcMain.handle('kunden:delete', (_event, id) => {
    const stmt = db.prepare('DELETE FROM kunden WHERE id = ?');
    stmt.run(id);
    return true;
});
// Pferde-API (immer mit BesitzerId)
ipcMain.handle('pferde:list', (_event, besitzerId) => {
    const stmt = db.prepare('SELECT * FROM pferde WHERE besitzerId = ?');
    return stmt.all(besitzerId);
});
ipcMain.handle('pferde:add', (_event, pferd) => {
    const stmt = db.prepare('INSERT INTO pferde (name, geburtsjahr, alterJahre, geschlecht, bemerkungen, besitzerId) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(pferd.name, pferd.geburtsjahr, pferd.alterJahre, pferd.geschlecht, pferd.bemerkungen, pferd.besitzerId);
    return { id: info.lastInsertRowid, ...pferd };
});
ipcMain.handle('pferde:delete', (_event, id) => {
    const stmt = db.prepare('DELETE FROM pferde WHERE id = ?');
    stmt.run(id);
    return true;
});
// Termine-API
ipcMain.handle('termine:list', (_event, pferdId) => {
    const stmt = db.prepare('SELECT * FROM termine WHERE pferdId = ? ORDER BY datum DESC');
    return stmt.all(pferdId);
});
ipcMain.handle('termine:add', (_event, termin) => {
    const stmt = db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung) VALUES (?, ?, ?, ?)');
    const info = stmt.run(termin.pferdId, termin.datum, termin.rechnung ? 1 : 0, termin.bemerkung);
    return { id: info.lastInsertRowid, ...termin };
});
ipcMain.handle('termine:delete', (_event, id) => {
    const stmt = db.prepare('DELETE FROM termine WHERE id = ?');
    stmt.run(id);
    return true;
});
ipcMain.handle('termine:update', (_event, termin) => {
    const stmt = db.prepare('UPDATE termine SET datum = ?, rechnung = ?, bemerkung = ? WHERE id = ?');
    stmt.run(termin.datum, termin.rechnung ? 1 : 0, termin.bemerkung, termin.id);
    return true;
});
// Alle Termine für Kalenderansicht
ipcMain.handle('alleTermine:list', () => {
    const stmt = db.prepare(`
    SELECT termine.id, termine.datum, termine.bemerkung, termine.rechnung, pferde.name as pferdName, kunden.name as besitzerName
    FROM termine
    JOIN pferde ON termine.pferdId = pferde.id
    JOIN kunden ON pferde.besitzerId = kunden.id
  `);
    return stmt.all();
});
