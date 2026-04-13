/**
 * Google Calendar – OAuth2 + Export
 *
 * Zugangsdaten (CLIENT_ID / CLIENT_SECRET) werden NICHT im Code gespeichert.
 * Stattdessen liest die App die Datei:
 *   %APPDATA%\hufmacherin-app\google-oauth-credentials.json
 *
 * Inhalt (simples Format):
 *   { "client_id": "...", "client_secret": "..." }
 *
 * Alternativ direkt die credentials.json aus der Google Cloud Console ablegen
 * (Format: { "installed": { "client_id": "...", "client_secret": "..." } }).
 *
 * Loopback-Redirect (http://127.0.0.1:PORT) ersetzt das veraltete urn:ietf:wg:oauth:2.0:oob.
 * Loopback-Adressen sind bei Google ohne explizite Registrierung erlaubt.
 */

import { app, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { google } from 'googleapis';

const TOKEN_PATH       = path.join(app.getPath('userData'), 'google-token.json');
const CREDENTIALS_PATH = path.join(app.getPath('userData'), 'google-oauth-credentials.json');

// ─── Credentials ──────────────────────────────────────────────────────────────

function loadCredentials(): { clientId: string; clientSecret: string } | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    // Simples Format: { "client_id": "...", "client_secret": "..." }
    if (raw.client_id && raw.client_secret) {
      return { clientId: raw.client_id, clientSecret: raw.client_secret };
    }
    // Google-Console-Format: { "installed": { "client_id": "...", ... } }
    const block = raw.installed ?? raw.web;
    if (block?.client_id && block?.client_secret) {
      return { clientId: block.client_id, clientSecret: block.client_secret };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Token-Persistenz ─────────────────────────────────────────────────────────

function saveToken(token: any) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
}

function tryLoadToken(client: any): boolean {
  if (!fs.existsSync(TOKEN_PATH)) return false;
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    client.setCredentials(token);
    return true;
  } catch {
    return false;
  }
}

// ─── Clients ──────────────────────────────────────────────────────────────────

/** Client für Loopback-OAuth-Flow (redirectUri nötig). */
function makeLoginClient(redirectUri: string): any {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error(
      'Keine Google-Zugangsdaten gefunden.\n' +
      `Bitte google-oauth-credentials.json in ${app.getPath('userData')} ablegen.`
    );
  }
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, redirectUri);
}

/** Authenticated client für API-Aufrufe (nutzt Token + Auto-Refresh). */
async function getAuthenticatedClient(): Promise<any> {
  const creds = loadCredentials();
  if (!creds) throw new Error('Keine Google-Zugangsdaten konfiguriert.');

  const client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  if (!tryLoadToken(client)) {
    throw new Error('Nicht bei Google angemeldet. Bitte zuerst "Google verbinden" klicken.');
  }

  // Refresh-Token bei Erneuerung sofort persistieren
  client.on('tokens', (tokens: any) => {
    if (fs.existsSync(TOKEN_PATH)) {
      const current = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      saveToken({ ...current, ...tokens });
    }
  });
  return client;
}

// ─── Kalender-Routing ─────────────────────────────────────────────────────────

/** Sucht Kalender nach Name oder legt ihn neu an. */
async function getOrCreateCalendar(calApi: any, name: string): Promise<string> {
  const list = await calApi.calendarList.list();
  const found = (list.data.items ?? []).find((c: any) => c.summary === name);
  if (found?.id) return found.id;
  const created = await calApi.calendars.insert({ requestBody: { summary: name } });
  return created.data.id!;
}

// ─── IPC-Handler ──────────────────────────────────────────────────────────────

/** Gibt true zurück wenn Token vorhanden (wird bei nächstem API-Call ggf. auto-refreshed). */
ipcMain.handle('google:isLoggedIn', (): boolean => {
  if (!loadCredentials()) return false;
  if (!fs.existsSync(TOKEN_PATH)) return false;
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    return !!(token.refresh_token || token.access_token);
  } catch {
    return false;
  }
});

/**
 * Startet den vollständigen OAuth-Flow via Loopback-Redirect.
 * Öffnet den Browser und wartet, bis der Nutzer die Anmeldung abgeschlossen hat
 * (max. 3 Minuten). Löst sich auf, sobald Token gespeichert wurde.
 */
ipcMain.handle('google:login', (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const redirectUri = `http://127.0.0.1:${port}`;

      let client: any;
      try {
        client = makeLoginClient(redirectUri);
      } catch (e) {
        server.close();
        return reject(e);
      }

      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
        prompt: 'consent', // Erzwingt refresh_token bei jeder Anmeldung
      });

      void shell.openExternal(authUrl);

      // Timeout nach 3 Minuten
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Zeitüberschreitung bei der Google-Anmeldung (3 min).'));
      }, 3 * 60 * 1000);

      server.once('request', async (req, res) => {
        clearTimeout(timeout);
        server.close();

        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
        const code  = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error || !code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>Anmeldung abgebrochen.</h2><p>Du kannst dieses Fenster schließen.</p>');
          return reject(new Error(`Google-Anmeldung abgebrochen: ${error ?? 'kein Code erhalten'}`));
        }

        try {
          const { tokens } = await client.getToken(code);
          client.setCredentials(tokens);
          saveToken(tokens);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            '<h2 style="font-family:sans-serif;color:#2e7d32">✓ Anmeldung erfolgreich!</h2>' +
            '<p style="font-family:sans-serif">Du kannst dieses Fenster schließen und zur App zurückkehren.</p>'
          );
          resolve(true);
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h2>Fehler</h2><pre>${String(e)}</pre>`);
          reject(e);
        }
      });
    });

    server.on('error', (e) => reject(e));
  });
});

/**
 * Exportiert einen einzelnen Termin in den passenden Google-Kalender:
 *  - hufbearbeitung → primary
 *  - reitstunde     → Kalender "Reitstunden" (wird ggf. angelegt)
 *  - eigener_termin → Kalender "Persönlich"  (wird ggf. angelegt)
 *
 * Markiert den Termin danach in der DB als googleExportiert = 1.
 */
ipcMain.handle('google:exportTermin', async (_event: any, termin: {
  terminId: number;
  titel: string;
  bemerkung?: string;
  datum: string;
  ende?: string;
  typ?: string;
}): Promise<boolean> => {
  const client = await getAuthenticatedClient();
  const calApi = google.calendar({ version: 'v3', auth: client });
  const typ = termin.typ ?? 'hufbearbeitung';

  // Kalender je nach Typ zuweisen
  let calendarId: string;
  if (typ === 'reitstunde') {
    calendarId = await getOrCreateCalendar(calApi, 'Reitstunden');
  } else if (typ === 'eigener_termin') {
    calendarId = await getOrCreateCalendar(calApi, 'Persönlich');
  } else {
    calendarId = 'primary';
  }

  // Datum mit oder ohne Uhrzeit
  const hasTime = /T|\s\d{2}:\d{2}/.test(termin.datum);
  let startObj: any, endObj: any;
  if (hasTime) {
    const start = new Date(termin.datum);
    const end = termin.ende
      ? new Date(termin.ende)
      : new Date(start.getTime() + 60 * 60 * 1000); // Fallback: +1 h
    startObj = { dateTime: start.toISOString(), timeZone: 'Europe/Vienna' };
    endObj   = { dateTime: end.toISOString(),   timeZone: 'Europe/Vienna' };
  } else {
    const d0 = termin.datum.substring(0, 10);
    const d1 = termin.ende  ? termin.ende.substring(0, 10) : d0;
    startObj = { date: d0 };
    endObj   = { date: d1 };
  }

  await calApi.events.insert({
    calendarId,
    requestBody: {
      summary:     termin.titel,
      description: termin.bemerkung ?? '',
      start: startObj,
      end:   endObj,
    },
  });

  // Termin in DB als exportiert markieren
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { db } = require('./db.js');
  db.prepare('UPDATE termine SET googleExportiert = 1 WHERE id = ?').run(termin.terminId);

  return true;
});
