// SQLite-Initialisierung und Datenbankzugriff für Electron-Main-Prozess
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const dbPath = path.join(app.getPath('userData'), 'hufmacherin.db');
const db = new Database(dbPath);
// Tabellen anlegen, falls nicht vorhanden
function initDb() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS kunden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      vorname TEXT,
      adresse TEXT
    );
    CREATE TABLE IF NOT EXISTS pferde (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      geburtsjahr INTEGER,
      alterJahre INTEGER,
      geschlecht TEXT,
      bemerkungen TEXT,
      besitzerId INTEGER,
      FOREIGN KEY (besitzerId) REFERENCES kunden(id)
    );
    CREATE TABLE IF NOT EXISTS termine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pferdId INTEGER,
      kundeId INTEGER,
      datum TEXT,
      rechnung INTEGER,
      bemerkung TEXT,
      ende TEXT,
      status TEXT DEFAULT 'geplant',
      hufbemerkungen TEXT,
      typ TEXT DEFAULT 'hufbearbeitung',
      titelManuell TEXT,
      FOREIGN KEY (pferdId) REFERENCES pferde(id),
      FOREIGN KEY (kundeId) REFERENCES kunden(id)
    );
    CREATE TABLE IF NOT EXISTS hufbearbeitungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terminId INTEGER,
      datum TEXT,
      bearbeitung TEXT,
      bemerkungen TEXT,
      FOREIGN KEY (terminId) REFERENCES termine(id)
    );
  `);
    // Migration: alte hufbearbeitungen-Schemata auf neues Format bringen.
    try {
        const hufCols = db.prepare(`PRAGMA table_info(hufbearbeitungen)`).all();
        const colNames = hufCols.map(c => c.name);
        const hasTerminId = colNames.includes('terminId');
        if (!hasTerminId) {
            const terminExpr = colNames.includes('termin_id') ? 'termin_id' : 'NULL';
            const datumExpr = colNames.includes('datum') ? 'datum' : (colNames.includes('date') ? 'date' : 'CURRENT_TIMESTAMP');
            const bearbeitungExpr = colNames.includes('bearbeitung') ? 'bearbeitung' : (colNames.includes('typ') ? 'typ' : "''");
            const bemerkungenExpr = colNames.includes('bemerkungen') ? 'bemerkungen' : (colNames.includes('bemerkung') ? 'bemerkung' : 'NULL');
            db.exec(`ALTER TABLE hufbearbeitungen RENAME TO hufbearbeitungen_old;`);
            db.exec(`
        CREATE TABLE hufbearbeitungen (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          terminId INTEGER,
          datum TEXT,
          bearbeitung TEXT,
          bemerkungen TEXT,
          FOREIGN KEY (terminId) REFERENCES termine(id)
        );
      `);
            db.exec(`
        INSERT INTO hufbearbeitungen (terminId, datum, bearbeitung, bemerkungen)
        SELECT ${terminExpr}, ${datumExpr}, ${bearbeitungExpr}, ${bemerkungenExpr}
        FROM hufbearbeitungen_old;
      `);
            db.exec(`DROP TABLE hufbearbeitungen_old;`);
        }
    }
    catch (e) {
        // Falls keine Migration möglich ist, bleibt das bestehende Schema erhalten.
    }
    // Fehlende Spalten hinzufügen (für bestehende Datenbanken)
    try {
        db.exec(`ALTER TABLE termine ADD COLUMN ende TEXT;`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
    try {
        db.exec(`ALTER TABLE termine ADD COLUMN status TEXT DEFAULT 'geplant';`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
    try {
        db.exec(`ALTER TABLE termine ADD COLUMN hufbemerkungen TEXT;`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
    try {
        db.exec(`ALTER TABLE kunden ADD COLUMN vorname TEXT;`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
    try {
        db.exec(`ALTER TABLE termine ADD COLUMN typ TEXT DEFAULT 'hufbearbeitung';`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
    try {
        db.exec(`ALTER TABLE termine ADD COLUMN kundeId INTEGER;`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
    try {
        db.exec(`ALTER TABLE termine ADD COLUMN titelManuell TEXT;`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
    try {
        db.exec(`ALTER TABLE termine ADD COLUMN googleExportiert INTEGER DEFAULT 0;`);
    }
    catch (e) {
        // Spalte existiert bereits
    }
}
// Hufbearbeitung-Funktionen
function addHufbearbeitung(bearbeitung) {
    if (!bearbeitung || !bearbeitung.terminId) {
        throw new Error('Ungültige Bearbeitungsdaten: terminId fehlt.');
    }
    // Sicherheitsnetz für Alt-Datenbanken: Tabelle bei Bedarf erneut sicherstellen.
    db.exec(`
    CREATE TABLE IF NOT EXISTS hufbearbeitungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terminId INTEGER,
      datum TEXT,
      bearbeitung TEXT,
      bemerkungen TEXT,
      FOREIGN KEY (terminId) REFERENCES termine(id)
    );
  `);
    const stmt = db.prepare(`
    INSERT INTO hufbearbeitungen (terminId, datum, bearbeitung, bemerkungen)
    VALUES (?, ?, ?, ?)
  `);
    const result = stmt.run(bearbeitung.terminId, bearbeitung.datum, bearbeitung.bearbeitung, bearbeitung.bemerkungen);
    return { success: true, id: result.lastInsertRowid };
}
function listHufbearbeitungen(terminId) {
    const stmt = db.prepare(`
    SELECT * FROM hufbearbeitungen
    WHERE terminId = ?
    ORDER BY datum DESC
  `);
    return stmt.all(terminId);
}
module.exports = { db, initDb, addHufbearbeitung, listHufbearbeitungen };
