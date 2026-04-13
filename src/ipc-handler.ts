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
  titelManuell?: string | null;
}

interface Hufbearbeitung {
  terminId: number;
  datum: string;
  bearbeitung: string;
  bemerkungen: string;
}

interface BearbeitungsHistorieEintrag {
  terminId: number;
  datum: string;
  status: string;
  terminBemerkung: string | null;
  bearbeitung: string | null;
  bearbeitungsBemerkung: string | null;
  intervallTage: number | null;
  intervallWochen: number | null;
}

interface PferdHistorieGruppe {
  pferdId: number;
  pferdName: string;
  eintraege: BearbeitungsHistorieEintrag[];
  letzterTermin: string | null;
  durchschnittIntervallWochen: number | null;
}

function mapHistorieMitIntervallen(rows: any[]): BearbeitungsHistorieEintrag[] {
  return rows.map((row, index) => {
    const nextOlder = rows[index + 1];
    let intervallTage: number | null = null;
    if (nextOlder) {
      const currentTs = new Date(row.datum).getTime();
      const olderTs = new Date(nextOlder.datum).getTime();
      const diffMs = currentTs - olderTs;
      if (!Number.isNaN(diffMs) && diffMs >= 0) {
        intervallTage = Math.round(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    return {
      terminId: row.terminId,
      datum: row.datum,
      status: row.status,
      terminBemerkung: row.terminBemerkung || null,
      bearbeitung: row.bearbeitung || null,
      bearbeitungsBemerkung: row.bearbeitungsBemerkung || null,
      intervallTage,
      intervallWochen: intervallTage !== null ? Number((intervallTage / 7).toFixed(1)) : null,
    };
  });
}

function gruppiereKundenHistorie(rows: any[]): PferdHistorieGruppe[] {
  const byPferd = new Map<number, { pferdName: string; rows: any[] }>();
  for (const row of rows) {
    if (!byPferd.has(row.pferdId)) {
      byPferd.set(row.pferdId, { pferdName: row.pferdName, rows: [] });
    }
    byPferd.get(row.pferdId)?.rows.push(row);
  }

  const gruppen: PferdHistorieGruppe[] = [];
  for (const [pferdId, data] of byPferd.entries()) {
    const eintraege = mapHistorieMitIntervallen(data.rows);
    const intervalle = eintraege
      .map(e => e.intervallWochen)
      .filter((w): w is number => typeof w === 'number');
    const durchschnittIntervallWochen = intervalle.length > 0
      ? Number((intervalle.reduce((sum, w) => sum + w, 0) / intervalle.length).toFixed(1))
      : null;

    gruppen.push({
      pferdId,
      pferdName: data.pferdName,
      eintraege,
      letzterTermin: eintraege[0]?.datum || null,
      durchschnittIntervallWochen,
    });
  }

  gruppen.sort((a, b) => a.pferdName.localeCompare(b.pferdName, 'de'));
  return gruppen;
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
  const existing: any = db.prepare('SELECT * FROM termine WHERE id = ?').get(termin.id);
  if (!existing) {
    throw new Error('Termin nicht gefunden');
  }

  const nextDatum = termin.datum ?? existing.datum;
  const nextRechnung = typeof termin.rechnung === 'boolean' ? (termin.rechnung ? 1 : 0) : existing.rechnung;
  const nextBemerkung = termin.bemerkung ?? existing.bemerkung;
  const nextEnde = termin.ende !== undefined ? termin.ende : existing.ende;
  const nextStatus = termin.status ?? existing.status;
  const nextHufbemerkungen = termin.hufbemerkungen === undefined
    ? existing.hufbemerkungen
    : (termin.hufbemerkungen ? JSON.stringify(termin.hufbemerkungen) : null);
  const nextTitelManuell = termin.titelManuell !== undefined ? termin.titelManuell : existing.titelManuell;

  const stmt = db.prepare('UPDATE termine SET datum = ?, rechnung = ?, bemerkung = ?, ende = ?, status = ?, hufbemerkungen = ?, titelManuell = ? WHERE id = ?');
  stmt.run(nextDatum, nextRechnung, nextBemerkung, nextEnde, nextStatus, nextHufbemerkungen, nextTitelManuell, termin.id);

  // Folgetermin-Logik liegt ausschließlich in `termine:abschliessen`, damit dort der gewählte Wochenwert verwendet wird.
  return { ...existing, ...termin, status: nextStatus };
});

// Erweiterte Termin-API für Mehrfach-Pferde-Termine
ipcMain.handle('termine:addMultiple', async (_event: any, terminDaten: { 
  pferdIds: number[], 
  kundeId?: number | null,
  datum: string, 
  ende?: string | null, 
  bemerkung: string, 
  titel?: string,
  status?: string,
  typ?: string,
  titelManuell?: string | null
}) => {
  const erstellteTermine = [];
  const typ = terminDaten.typ || 'hufbearbeitung';

  if (typ === 'eigener_termin') {
    // Eigener Termin: kein Pferd, kein Kunde
    const stmt = db.prepare('INSERT INTO termine (datum, rechnung, bemerkung, ende, status, typ, titelManuell) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(
      terminDaten.datum,
      0,
      terminDaten.bemerkung,
      terminDaten.ende || null,
      'bestaetigt',
      typ,
      terminDaten.titelManuell || terminDaten.titel || null
    );
    erstellteTermine.push({ id: Number(info.lastInsertRowid), datum: terminDaten.datum, typ });
  } else if (typ === 'reitstunde') {
    // Reitstunde: Kunde, kein Pferd nötig
    const stmt = db.prepare('INSERT INTO termine (kundeId, datum, rechnung, bemerkung, ende, status, typ) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(
      terminDaten.kundeId || null,
      terminDaten.datum,
      0,
      terminDaten.bemerkung,
      terminDaten.ende || null,
      terminDaten.status || 'vorreserviert',
      typ
    );
    erstellteTermine.push({ id: Number(info.lastInsertRowid), kundeId: terminDaten.kundeId, datum: terminDaten.datum, typ });
  } else {
    // hufbearbeitung: Pferd(e) + Kunde via Pferd
    const stmt = db.prepare('INSERT INTO termine (pferdId, kundeId, datum, rechnung, bemerkung, ende, status, hufbemerkungen, typ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const pferdId of terminDaten.pferdIds) {
      const info = stmt.run(
        pferdId,
        terminDaten.kundeId || null,
        terminDaten.datum, 
        0,
        terminDaten.bemerkung, 
        terminDaten.ende || null, 
        terminDaten.status || 'vorreserviert',
        null,
        typ
      );
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

// Historie für ein einzelnes Pferd
ipcMain.handle('pferde:history', (_event: any, pferdId: number) => {
  const stmt = db.prepare(`
    SELECT
      termine.id as terminId,
      termine.datum as datum,
      termine.status as status,
      termine.bemerkung as terminBemerkung,
      hb.bearbeitung as bearbeitung,
      hb.bemerkungen as bearbeitungsBemerkung
    FROM termine
    LEFT JOIN hufbearbeitungen hb ON hb.terminId = termine.id
    WHERE termine.pferdId = ?
      AND termine.typ = 'hufbearbeitung'
      AND (termine.status = 'abgeschlossen' OR hb.id IS NOT NULL)
    ORDER BY termine.datum DESC
  `);
  const rows = stmt.all(pferdId);
  return mapHistorieMitIntervallen(rows);
});

// Historie für alle Pferde eines Kunden (gruppiert)
ipcMain.handle('kunden:history', (_event: any, besitzerId: number) => {
  const stmt = db.prepare(`
    SELECT
      pferde.id as pferdId,
      pferde.name as pferdName,
      termine.id as terminId,
      termine.datum as datum,
      termine.status as status,
      termine.bemerkung as terminBemerkung,
      hb.bearbeitung as bearbeitung,
      hb.bemerkungen as bearbeitungsBemerkung
    FROM pferde
    LEFT JOIN termine ON termine.pferdId = pferde.id
    LEFT JOIN hufbearbeitungen hb ON hb.terminId = termine.id
    WHERE pferde.besitzerId = ?
      AND termine.typ = 'hufbearbeitung'
      AND (termine.status = 'abgeschlossen' OR hb.id IS NOT NULL)
    ORDER BY pferde.name ASC, termine.datum DESC
  `);
  const rows = stmt.all(besitzerId);
  return gruppiereKundenHistorie(rows);
});

// Alle Termine für Kalenderansicht
ipcMain.handle('alleTermine:list', () => {
  const stmt = db.prepare(`
    SELECT termine.id, termine.datum, termine.ende, termine.bemerkung, termine.rechnung, termine.status, termine.hufbemerkungen,
           termine.typ, termine.titelManuell, termine.kundeId, termine.googleExportiert,
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
