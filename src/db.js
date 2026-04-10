// SQLite-Initialisierung und Datenbankzugriff für Electron-Main-Prozess
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
const dbPath = path.join(app.getPath('userData'), 'hufmacherin.db');
const db = new Database(dbPath);
// Tabellen anlegen, falls nicht vorhanden
export function initDb() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS kunden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
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
      FOREIGN KEY (pferdId) REFERENCES pferde(id)
    );
  `);
}
export default db;
