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
      datum TEXT,
      rechnung INTEGER,
      bemerkung TEXT,
      ende TEXT,
      status TEXT DEFAULT 'geplant',
      hufbemerkungen TEXT,
      FOREIGN KEY (pferdId) REFERENCES pferde(id)
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
}
// Hufbearbeitung-Funktionen
function addHufbearbeitung(bearbeitung) {
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
