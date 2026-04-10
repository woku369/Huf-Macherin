# Skill: Synology-Tailscale-Upload (Huf-Macherin PWA)

> **Status:** Gerüst – Tailscale-Zugangsdaten fehlen noch (werden ergänzt sobald im Heimnetz)

## Kontext

Fotos werden mit einem Android-Smartphone direkt nach der Hufbearbeitung aufgenommen
und sollen strukturiert auf einer Synology DS124 gespeichert werden.
Zugriff erfolgt über Tailscale (VPN-Mesh), da kein WebDAV verfügbar.

---

## Infrastruktur

| Komponente | Details |
|---|---|
| NAS | Synology DS124 |
| DSM | Version 7.x |
| Tailscale-Node NAS | ⏳ Tailscale-IP/Hostname folgt |
| Tailscale-Node PC | ⏳ folgt |
| Synology API | File Station HTTP API (SYNO.FileStation.Upload) |
| API-Port | 5001 (HTTPS) |
| Auth-Methode | ⏳ API-Key oder Session-Token (folgt) |
| NAS-Basisordner | `/volume1/HufMacherin/` ⏳ Pfad bestätigen |
| Staging-Ordner | `/volume1/HufMacherin/_untagged/` |

---

## Upload-Protokoll: Synology File Station API (DSM 7)

### Authentifizierung
```
POST https://[TAILSCALE-IP]:5001/webapi/auth.cgi
Body: api=SYNO.API.Auth&version=7&method=login&account=[USER]&passwd=[PASS]&session=FileStation&format=sid
Response: { "data": { "sid": "SESSION_TOKEN" }, "success": true }
```

### Datei hochladen
```
POST https://[TAILSCALE-IP]:5001/webapi/entry.cgi
Content-Type: multipart/form-data
Form-Felder:
  api=SYNO.FileStation.Upload
  version=2
  method=upload
  path=[ZIEL-ORDNER-PFAD]
  create_parents=true
  overwrite=false
  _sid=[SESSION_TOKEN]
  file=[BINÄRDATEN]
```

### Ordner erstellen (falls nicht vorhanden)
```
POST .../entry.cgi
api=SYNO.FileStation.CreateFolder&version=2&method=create
&folder_path=[ELTERNPFAD]&name=[ORDNERNAME]&force_parent=true&_sid=[SID]
```

---

## Ordnerstruktur auf dem NAS

```
/volume1/HufMacherin/
  _untagged/                     ← Staging: von der PWA hochgeladen, noch nicht getaggt
    2026-04-10_Luna/
      IMG_001.jpg
      IMG_002.jpg
    2026-04-10_Balu/
      IMG_003.jpg
  Mustermann_Maria/              ← Nach Tagging in der PC-App verschoben
    Luna/
      2026-04-10/
        VL_vorher.jpg
        VL_nachher.jpg
        VR_vorher.jpg
        ...
```

---

## PWA-Architektur

**Framework:** Vite + React + TypeScript (gleicher Stack wie Desktop-App)  
**Deployment:** Lokal auf dem PC gehostet (Electron öffnet separaten Port) ODER eigenständige statische PWA auf dem PC, die über Tailscale vom Handy erreichbar ist.

> Empfehlung: PWA als separate statische App, gehostet auf dem PC (immer an),
> über Tailscale vom Handy erreichbar → kein eigener Server nötig.

**Manifest:**
- `display: standalone`
- `start_url: /`
- Icons für Android-Homescreen

**Service Worker:**
- Offline-Upload-Queue: IndexedDB speichert wartende Uploads
- Background Sync API: sendet nach Wiederherstellung der Verbindung

---

## Vor-Ort-Workflow (Handy-PWA)

1. App öffnen (installiert am Android-Homescreen)
2. Kunde wählen (Dropdown, aus zentraler Kundenliste)
3. Pferd wählen (Dropdown, gefiltert nach Kunde)
4. Fotos aufnehmen (Kamera-Button, direkt native Kamera)
5. "Hochladen" → geht in Staging-Ordner auf NAS
6. **Fertig** – keine weiteren Schritte vor Ort

**Kein Taggen vor Ort** (zu langsam, Pferd ungeduldig, Bearbeiter müde):
- Huf-Position (VL/VR/HL/HR) → später am PC
- Vorher/Nachher → später am PC

---

## PC-Workflow (Electron-App, Tagging)

1. Tab "Fotos" öffnen → Staging-Ordner wird angezeigt
2. Bilder aus Staging einzeln oder gruppen-weise einem Termin zuordnen
3. Pro Bild: Huf-Position (VL/VR/HL/HR) + Vorher/Nachher setzen (Klick, kein Tippen)
4. Optional: Bemerkung als Text
5. "Fertig" → Bild wird in strukturierten Ordner verschoben, aus Staging entfernt
6. Metadaten in SQLite gespeichert (verknüpft mit terminId, pferdId)

---

## Datenbankschema (Erweiterung der Electron-App)

```sql
CREATE TABLE fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terminId INTEGER,          -- FK auf termine.id (kann NULL sein wenn noch im Staging)
  pferdId INTEGER,           -- FK auf pferde.id
  dateiname TEXT NOT NULL,   -- z.B. "IMG_001.jpg"
  nasPfad TEXT NOT NULL,     -- vollständiger NAS-Pfad
  aufnahmedatum TEXT,        -- ISO-Datum
  hufPosition TEXT,          -- 'VL' | 'VR' | 'HL' | 'HR' | NULL
  zeitpunkt TEXT,            -- 'vorher' | 'nachher' | NULL
  bemerkung TEXT,
  staging INTEGER DEFAULT 1, -- 1 = noch in _untagged, 0 = fertig einsortiert
  FOREIGN KEY (terminId) REFERENCES termine(id),
  FOREIGN KEY (pferdId) REFERENCES pferde(id)
);
```

---

## Offene Punkte (zu ergänzen wenn im Heimnetz)

- [ ] Tailscale-IP/Hostname der DS124
- [ ] Synology API-Key oder Benutzername/Passwort für File Station API
- [ ] Konkreter Basisordnerpfad auf dem Volume
- [ ] PC-seitiger Tailscale-Status (automatisch verbunden?)
- [ ] Entscheidung: PWA gehostet auf PC (Port 3030?) oder als separate Node?
- [ ] Zertifikat: self-signed auf Synology akzeptieren oder Let's Encrypt über Tailscale?
