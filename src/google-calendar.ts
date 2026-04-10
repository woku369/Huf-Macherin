// Google-Authentifizierung und Kalender-Export (Grundstruktur)
import { app, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(app.getPath('userData'), 'google-token.json');

// TODO: Ersetze durch eigene OAuth2-Clientdaten aus Google Cloud Console
const CLIENT_ID = 'DEIN_CLIENT_ID.apps.googleusercontent.com';
const CLIENT_SECRET = 'DEIN_CLIENT_SECRET';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

function saveToken(token: any) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
}

function loadToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);
    return true;
  }
  return false;
}

ipcMain.handle('google:login', async () => {
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  shell.openExternal(authUrl);
  return true;
});
ipcMain.handle('google:authcode', async (_event: any, code: string) => {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  saveToken(tokens);
  return true;
});
ipcMain.handle('google:isLoggedIn', () => loadToken());

// Termin-Export (Beispiel)
ipcMain.handle('google:exportTermin', async (_event: any, termin: any) => {
  if (!loadToken()) return false;
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: termin.titel,
      description: termin.bemerkung,
      start: { date: termin.datum },
      end: { date: termin.datum },
    },
  });
  return true;
});
