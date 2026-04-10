// IPC-Handler für Kunden- und Pferdeverwaltung im Electron-Main-Prozess
const { ipcMain } = require('electron');
const { db, addHufbearbeitung, listHufbearbeitungen } = require('./db.js');

// Typdefinitionen für die Datenstrukturen
interface Kunde {
  id?: number;
  name: string;
  vorname: string;
  adresse: string;
}

interface Pferd {
  id?: number;
  name: string;
  geburtsjahr: number;
  alterJahre: number;
  geschlecht: string;
  bemerkungen: string;
  besitzerId: number;
}

interface Termin {
  id?: number;
  pferdId: number;
  datum: string;
  rechnung: boolean;
  bemerkung: string;
  ende?: string;
  status?: string;
  hufbemerkungen?: any;
}

interface Hufbearbeitung {
  terminId: number;
  datum: string;
  bearbeitung: string;
  bemerkungen: string;
}

// Kunden-API
ipcMain.handle('kunden:list', () => {
  const stmt = db.prepare('SELECT * FROM kunden');
  return stmt.all();
});
ipcMain.handle('kunden:add', (_event: any, kunde: Kunde) => {
  const stmt = db.prepare('INSERT INTO kunden (name, vorname, adresse) VALUES (?, ?, ?)');
  const info = stmt.run(kunde.name, kunde.vorname, kunde.adresse);
  return { id: info.lastInsertRowid, ...kunde };
});
ipcMain.handle('kunden:update', (_event: any, kunde: Kunde) => {
  const stmt = db.prepare('UPDATE kunden SET name = ?, vorname = ?, adresse = ? WHERE id = ?');
  stmt.run(kunde.name, kunde.vorname, kunde.adresse, kunde.id);
  return kunde;
});
ipcMain.handle('kunden:delete', (_event: any, id: number) => {
  const stmt = db.prepare('DELETE FROM kunden WHERE id = ?');
  stmt.run(id);
  return true;
});

// Pferde-API (immer mit BesitzerId)
ipcMain.handle('pferde:list', (_event: any, besitzerId: number) => {
  const stmt = db.prepare('SELECT * FROM pferde WHERE besitzerId = ?');
  return stmt.all(besitzerId);
});
ipcMain.handle('pferde:add', (_event: any, pferd: Pferd) => {
  const stmt = db.prepare('INSERT INTO pferde (name, geburtsjahr, alterJahre, geschlecht, bemerkungen, besitzerId) VALUES (?, ?, ?, ?, ?, ?)');
  const info = stmt.run(pferd.name, pferd.geburtsjahr, pferd.alterJahre, pferd.geschlecht, pferd.bemerkungen, pferd.besitzerId);
  return { id: info.lastInsertRowid, ...pferd };
});
ipcMain.handle('pferde:update', (_event: any, pferd: Pferd) => {
  const stmt = db.prepare('UPDATE pferde SET name = ?, geburtsjahr = ?, alterJahre = ?, geschlecht = ?, bemerkungen = ?, besitzerId = ? WHERE id = ?');
  stmt.run(pferd.name, pferd.geburtsjahr, pferd.alterJahre, pferd.geschlecht, pferd.bemerkungen, pferd.besitzerId, pferd.id);
  return pferd;
});
ipcMain.handle('pferde:delete', (_event: any, id: number) => {
  const stmt = db.prepare('DELETE FROM pferde WHERE id = ?');
  stmt.run(id);
  return true;
});

// Termine-API
ipcMain.handle('termine:list', (_event: any, pferdId: number) => {
  const stmt = db.prepare('SELECT * FROM termine WHERE pferdId = ? ORDER BY datum DESC');
  return stmt.all(pferdId);
});
ipcMain.handle('termine:add', (_event: any, termin: Termin) => {
  const stmt = db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung, ende, status, hufbemerkungen) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(termin.pferdId, termin.datum, termin.rechnung ? 1 : 0, termin.bemerkung, termin.ende, termin.status || 'geplant', termin.hufbemerkungen ? JSON.stringify(termin.hufbemerkungen) : null);
  return { id: Number(info.lastInsertRowid), ...termin, status: termin.status || 'geplant' };
});
ipcMain.handle('termine:delete', (_event: any, id: number) => {
  const stmt = db.prepare('DELETE FROM termine WHERE id = ?');
  stmt.run(id);
  return true;
});
ipcMain.handle('termine:update', async (_event: any, termin: Termin) => {
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
      } else if (dayOfWeek === 6) { // Samstag -> Montag  
        neuesDatum.setDate(neuesDatum.getDate() + 2);
      }
      
      const stmt2 = db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung, status) VALUES (?, ?, ?, ?, ?)');
      stmt2.run(termin.pferdId, neuesDatum.toISOString(), 0, 'Automatischer Bearbeitungsvorschlag (4 Wochen)', 'vorschlag');
    }
  }
  return termin;
});

// Erweiterte Termin-API für Mehrfach-Pferde-Termine
ipcMain.handle('termine:addMultiple', async (_event: any, terminDaten: { 
  pferdIds: number[], 
  datum: string, 
  ende?: string | null, 
  bemerkung: string, 
  titel?: string,
  status?: string 
}) => {
  const erstellteTermine = [];
  const stmt = db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung, ende, status, hufbemerkungen) VALUES (?, ?, ?, ?, ?, ?, ?)');
  
  for (const pferdId of terminDaten.pferdIds) {
    const info = stmt.run(
      pferdId, 
      terminDaten.datum, 
      0, // rechnung = false per default
      terminDaten.bemerkung, 
      terminDaten.ende || null, 
      terminDaten.status || 'vorreserviert', 
      null
    );
    erstellteTermine.push({ 
      id: Number(info.lastInsertRowid), 
      pferdId, 
      datum: terminDaten.datum,
      ende: terminDaten.ende,
      bemerkung: terminDaten.bemerkung,
      status: terminDaten.status || 'vorreserviert'
    });
  }
  
  return erstellteTermine;
});

// API um letzte Bearbeitung pro Pferd zu finden
ipcMain.handle('pferde:getLastBearbeitung', (_event: any, pferdId: number) => {
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
           pferde.name as pferdName, kunden.name as besitzerName, kunden.vorname as besitzerVorname
    FROM termine
    JOIN pferde ON termine.pferdId = pferde.id
    JOIN kunden ON pferde.besitzerId = kunden.id
    ORDER BY termine.datum ASC
  `);
  return stmt.all();
});

// Termin-Status aktualisieren
ipcMain.handle('termine:updateStatus', (_event: any, terminId: number, status: string) => {
  const stmt = db.prepare('UPDATE termine SET status = ? WHERE id = ?');
  stmt.run(status, terminId);
  return true;
});

// Hufbearbeitung-API
ipcMain.handle('hufbearbeitung:add', (_event: any, bearbeitung: Hufbearbeitung) => {
  return addHufbearbeitung(bearbeitung);
});
ipcMain.handle('hufbearbeitung:list', (_event: any, terminId: number) => {
  return listHufbearbeitungen(terminId);
});

// Termin abschließen mit optionalem Folgetermin (konfigurierbare Wochen)
ipcMain.handle('termine:abschliessen', (_event: any, terminId: number, folgeWochen: number) => {
  db.prepare('UPDATE termine SET status = ? WHERE id = ?').run('abgeschlossen', terminId);

  if (folgeWochen > 0) {
    const termin: any = db.prepare('SELECT * FROM termine WHERE id = ?').get(terminId);
    if (termin) {
      const check: any = db.prepare('SELECT COUNT(*) as cnt FROM termine WHERE pferdId = ? AND status = ?').get(termin.pferdId, 'vorschlag');
      if (check && check.cnt === 0) {
        const neuesDatum = new Date(termin.datum);
        neuesDatum.setDate(neuesDatum.getDate() + folgeWochen * 7);
        const dayOfWeek = neuesDatum.getDay();
        if (dayOfWeek === 0) neuesDatum.setDate(neuesDatum.getDate() + 1); // Sonntag → Montag
        else if (dayOfWeek === 6) neuesDatum.setDate(neuesDatum.getDate() + 2); // Samstag → Montag
        db.prepare('INSERT INTO termine (pferdId, datum, rechnung, bemerkung, status) VALUES (?, ?, ?, ?, ?)').run(
          termin.pferdId,
          neuesDatum.toISOString(),
          0,
          `Automatischer Bearbeitungsvorschlag (${folgeWochen} Wochen)`,
          'vorschlag'
        );
      }
    }
  }
  return true;
});
