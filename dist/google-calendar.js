"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Google-Authentifizierung und Kalender-Export (Grundstruktur)
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const googleapis_1 = require("googleapis");
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path_1.default.join(electron_1.app.getPath('userData'), 'google-token.json');
// TODO: Ersetze durch eigene OAuth2-Clientdaten aus Google Cloud Console
const CLIENT_ID = 'DEIN_CLIENT_ID.apps.googleusercontent.com';
const CLIENT_SECRET = 'DEIN_CLIENT_SECRET';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const oAuth2Client = new googleapis_1.google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
function saveToken(token) {
    fs_1.default.writeFileSync(TOKEN_PATH, JSON.stringify(token));
}
function loadToken() {
    if (fs_1.default.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs_1.default.readFileSync(TOKEN_PATH, 'utf-8'));
        oAuth2Client.setCredentials(token);
        return true;
    }
    return false;
}
electron_1.ipcMain.handle('google:login', async () => {
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    electron_1.shell.openExternal(authUrl);
    return true;
});
electron_1.ipcMain.handle('google:authcode', async (_event, code) => {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    saveToken(tokens);
    return true;
});
electron_1.ipcMain.handle('google:isLoggedIn', () => loadToken());
// Termin-Export (Beispiel)
electron_1.ipcMain.handle('google:exportTermin', async (_event, termin) => {
    if (!loadToken())
        return false;
    const calendar = googleapis_1.google.calendar({ version: 'v3', auth: oAuth2Client });
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
