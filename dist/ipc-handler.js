// IPC-Handler für Kunden- und Pferdeverwaltung im Electron-Main-Prozess
const { ipcMain } = require('electron');
const { db, addHufbearbeitung, listHufbearbeitungen } = require('./db.js');
// Kunden-API
ipcMain.handle('kunden:list', () => {
    const stmt = db.prepare('SELECT * FROM kunden');
    return stmt.all();
});
ipcMain.handle('kunden:add', (_event, kunde) => {
    const stmt = db.prepare('INSERT INTO kunden (name, vorname, adresse) VALUES (?, ?, ?)');
    const info = stmt.run(kunde.name, kunde.vorname, kunde.adresse);
    return { id: info.lastInsertRowid, ...kunde };
});
ipcMain.handle('kunden:update', (_event, kunde) => {
    const stmt = db.prepare('UPDATE kunden SET name = ?, vorname = ?, adresse = ? WHERE id = ?');
    stmt.run(kunde.name, kunde.vorname, kunde.adresse, kunde.id);
    return kunde;
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
ipcMain.handle('pferde:update', (_event, pferd) => {
    const stmt = db.prepare('UPDATE pferde SET name = ?, geburtsjahr = ?, alterJahre = ?, geschlecht = ?, bemerkungen = ?, besitzerId = ? WHERE id = ?');
    stmt.run(pferd.name, pferd.geburtsjahr, pferd.alterJahre, pferd.geschlecht, pferd.bemerkungen, pferd.besitzerId, pferd.id);
    return pferd;
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
    const stmt = db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung, ende, status, hufbemerkungen) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(termin.pferdId, termin.datum, termin.rechnung ? 1 : 0, termin.bemerkung, termin.ende, termin.status || 'geplant', termin.hufbemerkungen ? JSON.stringify(termin.hufbemerkungen) : null);
    return { id: Number(info.lastInsertRowid), ...termin, status: termin.status || 'geplant' };
});
ipcMain.handle('termine:delete', (_event, id) => {
    const stmt = db.prepare('DELETE FROM termine WHERE id = ?');
    stmt.run(id);
    return true;
});
ipcMain.handle('termine:update', async (_event, termin) => {
    const stmt = db.prepare('UPDATE termine SET datum = ?, rechnung = ?, bemerkung = ?, ende = ?, status = ?, hufbemerkungen = ? WHERE id = ?');
    stmt.run(termin.datum, termin.rechnung ? 1 : 0, termin.bemerkung, termin.ende, termin.status, termin.hufbemerkungen ? JSON.stringify(termin.hufbemerkungen) : null, termin.id);
    // Automatischer Vorschlagstermin nach Abschluss
    if (termin.status === 'abgeschlossen') {
        // Prüfen, ob schon ein Vorschlag für dieses Pferd existiert
        const check = db.prepare('SELECT COUNT(*) as cnt FROM termine WHERE pferdId = ? AND status = ?').get(termin.pferdId, 'vorschlag');
        if (check && check.cnt === 0) {
            // Neuen Vorschlagstermin 4 Wochen später erstellen, auf Werktag verschieben
            const neuesDatum = new Date(termin.datum);
            neuesDatum.setDate(neuesDatum.getDate() + 28); // 4 Wochen
            // Auf nächsten Werktag verschieben, falls Wochenende
            const dayOfWeek = neuesDatum.getDay(); // 0 = Sonntag, 1 = Montag, ..., 6 = Samstag
            if (dayOfWeek === 0) { // Sonntag -> Montag
                neuesDatum.setDate(neuesDatum.getDate() + 1);
            }
            else if (dayOfWeek === 6) { // Samstag -> Montag  
                neuesDatum.setDate(neuesDatum.getDate() + 2);
            }
            const stmt2 = db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung, status) VALUES (?, ?, ?, ?, ?)');
            stmt2.run(termin.pferdId, neuesDatum.toISOString(), 0, 'Automatischer Bearbeitungsvorschlag (4 Wochen)', 'vorschlag');
        }
    }
    return termin;
});
// Erweiterte Termin-API für Mehrfach-Pferde-Termine
ipcMain.handle('termine:addMultiple', async (_event, terminDaten) => {
    const erstellteTermine = [];
    const typ = terminDaten.typ || 'hufbearbeitung';
    if (typ === 'eigener_termin') {
        // Eigener Termin: kein Pferd, kein Kunde
        const stmt = db.prepare('INSERT INTO termine (datum, rechnung, bemerkung, ende, status, typ, titelManuell) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(terminDaten.datum, 0, terminDaten.bemerkung, terminDaten.ende || null, 'bestaetigt', typ, terminDaten.titelManuell || terminDaten.titel || null);
        erstellteTermine.push({ id: Number(info.lastInsertRowid), datum: terminDaten.datum, typ });
    }
    else if (typ === 'reitstunde') {
        // Reitstunde: Kunde, kein Pferd nötig
        const stmt = db.prepare('INSERT INTO termine (kundeId, datum, rechnung, bemerkung, ende, status, typ) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(terminDaten.kundeId || null, terminDaten.datum, 0, terminDaten.bemerkung, terminDaten.ende || null, terminDaten.status || 'vorreserviert', typ);
        erstellteTermine.push({ id: Number(info.lastInsertRowid), kundeId: terminDaten.kundeId, datum: terminDaten.datum, typ });
    }
    else {
        // hufbearbeitung: Pferd(e) + Kunde via Pferd
        const stmt = db.prepare('INSERT INTO termine (pferdId, kundeId, datum, rechnung, bemerkung, ende, status, hufbemerkungen, typ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const pferdId of terminDaten.pferdIds) {
            const info = stmt.run(pferdId, terminDaten.kundeId || null, terminDaten.datum, 0, terminDaten.bemerkung, terminDaten.ende || null, terminDaten.status || 'vorreserviert', null, typ);
            erstellteTermine.push({
                id: Number(info.lastInsertRowid),
                pferdId,
                datum: terminDaten.datum,
                ende: terminDaten.ende,
                bemerkung: terminDaten.bemerkung,
                status: terminDaten.status || 'vorreserviert',
                typ
            });
        }
    }
    return erstellteTermine;
});
// API um letzte Bearbeitung pro Pferd zu finden
ipcMain.handle('pferde:getLastBearbeitung', (_event, pferdId) => {
    const stmt = db.prepare(`
    SELECT datum, status 
    FROM termine 
    WHERE pferdId = ? AND status = 'abgeschlossen' 
    ORDER BY datum DESC 
    LIMIT 1
  `);
    const result = stmt.get(pferdId);
    if (result) {
        const letzteBearbeitung = new Date(result.datum);
        const heute = new Date();
        const wochenSeitBearbeitung = Math.floor((heute.getTime() - letzteBearbeitung.getTime()) / (1000 * 60 * 60 * 24 * 7));
        return {
            datum: result.datum,
            wochenSeither: wochenSeitBearbeitung,
            status: result.status
        };
    }
    return null;
});
// Alle Termine für Kalenderansicht
ipcMain.handle('alleTermine:list', () => {
    const stmt = db.prepare(`
    SELECT termine.id, termine.datum, termine.ende, termine.bemerkung, termine.rechnung, termine.status, termine.hufbemerkungen,
           termine.typ, termine.titelManuell, termine.kundeId,
           pferde.name as pferdName,
           COALESCE(kunden_pferd.name, kunden_direkt.name) as besitzerName,
           COALESCE(kunden_pferd.vorname, kunden_direkt.vorname) as besitzerVorname
    FROM termine
    LEFT JOIN pferde ON termine.pferdId = pferde.id
    LEFT JOIN kunden kunden_pferd ON pferde.besitzerId = kunden_pferd.id
    LEFT JOIN kunden kunden_direkt ON termine.kundeId = kunden_direkt.id
    ORDER BY termine.datum ASC
  `);
    return stmt.all();
});
// Termin-Status aktualisieren
ipcMain.handle('termine:updateStatus', (_event, terminId, status) => {
    const stmt = db.prepare('UPDATE termine SET status = ? WHERE id = ?');
    stmt.run(status, terminId);
    return true;
});
// Hufbearbeitung-API
ipcMain.handle('hufbearbeitung:add', (_event, bearbeitung) => {
    return addHufbearbeitung(bearbeitung);
});
ipcMain.handle('hufbearbeitung:list', (_event, terminId) => {
    return listHufbearbeitungen(terminId);
});
// Termin abschließen mit optionalem Folgetermin (konfigurierbare Wochen)
ipcMain.handle('termine:abschliessen', (_event, terminId, folgeWochen) => {
    db.prepare('UPDATE termine SET status = ? WHERE id = ?').run('abgeschlossen', terminId);
    if (folgeWochen > 0) {
        const termin = db.prepare('SELECT * FROM termine WHERE id = ?').get(terminId);
        if (termin) {
            const check = db.prepare('SELECT COUNT(*) as cnt FROM termine WHERE pferdId = ? AND status = ?').get(termin.pferdId, 'vorschlag');
            if (check && check.cnt === 0) {
                const neuesDatum = new Date(termin.datum);
                neuesDatum.setDate(neuesDatum.getDate() + folgeWochen * 7);
                const dayOfWeek = neuesDatum.getDay();
                if (dayOfWeek === 0)
                    neuesDatum.setDate(neuesDatum.getDate() + 1); // Sonntag → Montag
                else if (dayOfWeek === 6)
                    neuesDatum.setDate(neuesDatum.getDate() + 2); // Samstag → Montag
                db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung, status) VALUES (?, ?, ?, ?, ?)').run(termin.pferdId, neuesDatum.toISOString(), 0, `Automatischer Bearbeitungsvorschlag (${folgeWochen} Wochen)`, 'vorschlag');
            }
        }
    }
    return true;
});
