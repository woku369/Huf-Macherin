# Roadmap – Die Huf-Macherin App

> **Zuletzt aktualisiert:** 14. April 2026 (Session 8 – Block B + C fertig: Server-CRUD + index.html vollständig)  
> **App-Version:** 0.0.0 (Entwicklungsphase)  
> **Stack:** Electron + React + Vite + TypeScript + SQLite (better-sqlite3)

---

## Gesamtfortschritt

```
Kernfunktionen    ██████████████░░░░░░  72%
Kalender          █████████████████░░░  84%
Google Calendar   ████████████████░░░░  80%
PWA / Synology    █████████████░░░░░░░  65%
```

## Fachliche Grundlagen (Workflow-Kontext)

### Bearbeitungsrhythmus
- Intervall: **4–6 Wochen** pro Pferd (fixer Bereich)
- Kunden können **bis zu 10 Pferde** haben → mehrere Tage möglich
- **Zweiter Bearbeiter** arbeitet nicht mit der App → kein Multi-User/Login nötig
- **Kein Tourenplaner** nötig (Aufwand > Nutzen)

### Bearbeitungsarten
- Hauptsächlich **Barhuf** (Korrektur & Erhalt)
- Selten **Klebebeschlag**
- Kein Eisenbeschlag
- Bemerkungsfeld pro Termin reicht (kein Huf-für-Huf-Detail nötig)
- 4 eigene Pferde werden zu Hause bearbeitet, Rest auswärts

### Foto-Dokumentation – das Kernproblem

**Aktueller Ist-Zustand (Chaos):**
- Fotos auf Android-Handy → Handy voll
- Google Fotos: überfüllt, unstrukturiert
- WhatsApp-Versand hin & her: unübersichtlich
- NAS-Ordner: Bilder da, aber keinem Kontext mehr zuzuordnen

**Soll-Zustand:**
1. **Eigene Dokumentation** (strukturiert auf Synology DS124):
   - Vorher/Nachher-Bilder pro Huf, mehrere Ansichten
   - Ordnerstruktur: `Kunde → Pferd → Datum`
   - Chronologische Galerie zur Verlaufsdokumentation
   - PC-App: Bilder sichtbar, mit Tags & Bemerkungen versehbar
   - (Langfristig optional: KI-Vergleich Vorher/Nachher wie ehem. "LTZ Huf-App")
2. **Beweis-Foto** nach Bearbeitung → manuell via WhatsApp an Kunden (Automatisierung später)

### Infrastruktur (Foto)
- Gerät: **Android-Smartphone** (ausschließlich)
- Speicher: **Synology DS124** (bereits in Betrieb, Tailscale für andere Projekte aktiv)
- Für Huf-Macherin: **noch kein Tailscale-Node** auf der DS124 eingerichtet
- Bilder landen auf DS124, sind am Windows-PC sichtbar & mit Metadaten versehbar

### Zurückgestellt (bewusst)
- WhatsApp-Automatisierung (Terminanfragen, Foto-Versand)
- Rechnungslegung (aktuell: Papier-Rechnungsblock)

---



### Build & Infrastruktur
- [x] Electron + Vite + React + TypeScript Setup
- [x] SQLite Datenbank mit better-sqlite3
- [x] IPC-Kommunikation Main ↔ Renderer
- [x] Build-Script mit Backend + Frontend Trennung
- [x] HTML-Pfade-Fix für Produktion (`fix-html-paths`)
- [x] DevTools nur im Dev-Modus
- [x] **April 2026:** Backend neu gebaut – `dist/db.js`, `dist/preload.js`, `dist/ipc-handler.js` aktuell
- [x] Startfehler behoben: `build-frontend` leert `dist` nicht mehr (`vite.config.ts` + `vite.config.js` mit `emptyOutDir: false`)

### Packaging-Notiz (Node-Modules)
- [ ] Dependency- und Packaging-Audit beim **ersten portable Build** durchführen
- [ ] Ziel: nur benötigte Runtime-Abhängigkeiten in das distributable Artefakt
- [ ] Prüfen: ungenutzte direkte Dependencies, transitive Schwergewichte, `dependencies` vs. `devDependencies`
- [ ] Ergebnis dokumentieren (vorher/nachher Größe, entfernte Pakete, Build-/Runtime-Checks)

> Hinweis: Die hohe Anzahl in `node_modules` ist aktuell erwartbar (viele transitive Build- und Tooling-Abhängigkeiten) und wird bewusst erst mit dem ersten portable Build optimiert.

### Datenbankschema
- [x] Tabelle `kunden` (id, name, vorname, adresse)
- [x] Tabelle `pferde` (id, name, geburtsjahr, alterJahre, geschlecht, bemerkungen, besitzerId)
- [x] Tabelle `termine` (id, pferdId, datum, ende, rechnung, bemerkung, status, hufbemerkungen)
- [x] Tabelle `hufbearbeitungen` (id, terminId, datum, bearbeitung, bemerkungen)
- [x] Migration für bestehende Datenbanken (ALTER TABLE Spalten)

### Kundenverwaltung
- [x] Kunde anlegen (Name, Vorname, Adresse)
- [x] Kunde bearbeiten
- [x] Kunde löschen
- [x] Kundenliste in Sidebar mit Direktnavigation

### Pferde-Verwaltung
- [x] Pferd anlegen (Name, Geburtsjahr, Geschlecht, Bemerkungen)
- [x] Pferd bearbeiten
- [x] Pferd löschen
- [x] Pferd direkt im Termin-Dialog anlegen
- [x] Letzte Bearbeitung pro Pferd anzeigen (Wochen seit letzter Bearbeitung)

### Kalender (Kernfunktion)
- [x] react-big-calendar mit deutscher Lokalisierung
- [x] Monat / Woche / Tag Ansicht
- [x] Kalenderwochen-Anzeige in Toolbar
- [x] Termin-Farben nach Status (violett/blau/grün/orange)
- [x] Status-Legende im Kalender
- [x] Termin via Datumsklick erstellen (Modal-Dialog)
  - [x] Kunde wählen
  - [x] Mehrere Pferde gleichzeitig wählen (Checkboxen)
  - [x] Start- und Endzeit (15-Min-Schritte)
  - [x] Automatischer Titel (Kunde + Pferd)
  - [x] Status "vorreserviert" als Standard
- [x] Termin-Tooltip (Mouseover/Click) mit Details
- [x] Status-Workflow im Tooltip:
  - [x] Vorreserviert → Bestätigt → Abgeschlossen
  - [x] Button "Als Vorschlag" für Folgetermin-Vorschläge
- [x] Automatischer Folgetermin-Vorschlag (4 Wochen, Werktag)
- [x] Hufbearbeitungs-Dokumentations-Modal (öffnet bei "Bestätigt")
  - [x] Bearbeitungsnotizen-Textarea
  - [x] Empfehlung nächster Termin (4/6/8/12 Wochen)
  - [x] Speichern in `hufbearbeitungen`-Tabelle
  - [x] Status automatisch auf "abgeschlossen" setzen
- [x] Speichern robuster: validierte Fehlermeldung + DB-Migration für Alt-Schema `hufbearbeitungen` ohne `terminId`

### UI/UX
- [x] Modernisierte App-Struktur mit linker Sidebar
- [x] Logo-Platzhalter links oben integriert
- [x] Gedeckte Farbpalette statt knalliger Standardoptik
- [x] Sidebar mit Bereichen für Erweiterungen, `Anleitungen` und `Einstellungen` (letzter Tab)
- [x] **CSS-Refactor (Session 5):** `src/Kalender.css` neu erstellt – statische Inline-Styles in wiederverwendbare Klassen extrahiert (`.kal-modal-overlay`, `.kal-modal`, `.kal-form-input`, `.kal-form-label`, `.kal-btn-primary`, `.kal-btn-secondary`, `.kal-hint-info`, `.kal-hint-success`, u.a.)

### Export
- [x] Kalender als PDF exportieren (html2canvas + jsPDF)
- [x] Google Calendar Export (Grundstruktur vorhanden)

---

## 🚧 In Arbeit / Offene Bugs

### Kritisch

| # | Problem | Datei | Priorität |
|---|---------|-------|-----------|
| - | Aktuell keine offenen kritischen Bugs im Kern-Statusworkflow (B2/B3 behoben). | Kalender.tsx / ipc-handler.ts | - |

### Nicht-kritisch

| # | Problem | Datei |
|---|---------|-------|
| ~~B6~~ | ~~`window.api.updateTerminStatus` in `window-api.d.ts` deklariert aber `dist/preload.js` hat es nicht mehr als Flat-API~~ | ✅ **Behoben:** Flat-Alias entfernt, Kalender.tsx migriert auf `window.api.termine.updateStatus` |
| ~~B7~~ | ~~Offen: Google-OAuth-Code-`prompt` im Export-Flow~~ | ✅ **Behoben:** In-App-Modal mit `showOAuthDialog`-State ersetzt `prompt()` vollständig |
| B8 | Behoben: Legacy-Komponenten `TerminVerwaltung` und `TerminListe` aus aktivem Codepfad entfernt und gelöscht. | App.tsx |

---

## 📋 Geplante Features

### Phase 0: GitHub Repository (dringend!)
- [x] GitHub-Repo anlegen: https://github.com/woku369/Huf-Macherin
- [x] `.gitignore` korrigiert (dist/assets ignoriert, dist/db.js + Backend behalten, *.db ausgeschlossen)
- [x] Initial-Commit & Push

---

### Phase 1: Stabilisierung

- [x] **B4 Fix:** Neuen Kunden im Termin-Dialog anlegen (Modal-in-Modal)
- [x] **B5 Fix:** DevTools nur im Dev-Modus öffnen
- [x] **B1 Fix:** Flat-API Alias `updateTerminStatus` für Rückwärtskompatibilität ergänzt
- [x] **B2 Fix:** Bearbeitungsmaske öffnet nur bei `Abschließen`, nicht bei `Bestätigt`
- [x] **B3 Fix:** Folgetermin nutzt konfigurierbare Wochen über `termine:abschliessen`; Legacy-4-Wochen-Automatismus aus `termine:update` entfernt

---

### Phase 2: Termin-Typen (Kalender-Erweiterung)

> Aktuell kennt die App nur Hufbearbeitungs-Termine.  
> Drei Typen werden benötigt, jeder mit anderem Workflow.

#### Datenbankänderung (Grundlage für alles)
```sql
ALTER TABLE termine ADD COLUMN typ TEXT DEFAULT 'hufbearbeitung';
-- Werte: 'hufbearbeitung' | 'reitstunde' | 'trainingsstunde' | 'eigener_termin'
ALTER TABLE termine ADD COLUMN kundeId INTEGER REFERENCES kunden(id);
-- Nötig für Reitstunden (Kunde ohne Pferd)
-- Für Hufbearbeitung bleibt pferdId (→ Kunde via JOIN)
-- Für eigene Termine: kundeId NULL, pferdId NULL
ALTER TABLE termine ADD COLUMN titelManuell TEXT;
-- Freitext-Titel für eigene Termine (Turnier, Kurs, Fortbildung, ...)
```

#### Typ 1: Hufbearbeitung (bestehendes Verhalten)
- Pflichtfelder: Kunde + Pferd
- Status-Workflow: vorreserviert → bestätigt → abgeschlossen
- Bearbeitungsmaske beim Abschließen
- Folgetermin-Vorschlag
- Farbe im Kalender: **Lila / Blau / Grün** (wie bisher)

#### Typ 2: Reitstunde / Trainingsstunde
- Pflichtfelder: Kunde (kein Pferd nötig, aber optional)
- Kein Hufbearbeitungs-Workflow
- Einfacher Status: geplant → abgehalten → abgesagt
- Farbe im Kalender: **Orange** 🟠
- Google Calendar: eigene Kategorie/Kalender "Reitstunden"

#### Typ 3: Eigener Termin (persönlich, unverschieblich)
- Keine Kunden- oder Pferd-Verknüpfung
- Titelfeld: Freitext (z.B. "Turnier Wels", "Kurs Biomechanik", "Fortbildung")
- Kein Status-Workflow – einfach blockt den Tag
- Farbe im Kalender: **Dunkelrot / Schwarz** 🔴 (signalisiert: nicht verschiebbar!)
- Google Calendar: "Persönlich" / "Geblockt"
- Im Termin-Dialog: Klick auf "Typ" schaltet die Felder um

#### UI-Änderungen
- [x] Termin-Dialog: Typ-Auswahl am Anfang (schaltet Felder um)
- [x] Kalender: Farbcodierung für Reitstunde + Eigener Termin ergänzt
- [x] Tooltip: Anzeige und Status-Buttons passend zum Typ
- [x] Status-Farbgebung: eigene Farben pro Typ
- [x] Folgetermin-Logik: nur bei Hufbearbeitung
- [ ] Google Calendar Export: Typ → Calendar-Kategorie

---

### Phase 3: Pferde-Historie & Bearbeitungs-Übersicht

- [x] **PferdHistorie (Basis):** Chronologische Historie pro Pferd in der Kundenansicht (inkl. Intervallanzeige und Bemerkungen)
- [x] **Bearbeitungsnotizen** beim Termin im Tooltip anzeigen
- [x] **Ampelhinweis** je Pferd in der Historie (🟢 ≤6 W. / 🟡 7–8 W. / 🔴 >8 W.)
- [x] **Termin löschen** direkt im Tooltip (2-Schritt-Bestätigung)
- [x] **Termin bearbeiten** (Edit-Modal)
- [x] **Österreichische Feiertage** im Kalender markieren
- [x] Kundenverwaltung: Pferde-Übersicht mit letzter Bearbeitungszeit

---

### Phase 4: Google Calendar Integration (optimiert)

> Ziel: Alle Termin-Typen auf Wunsch in den Google Kalender übertragen

- [x] **OAuth2 Loopback-Redirect** (`http://127.0.0.1:PORT`) ersetzt veraltetes `oob`
  - Browser öffnet sich automatisch, kein Code mehr manuell kopieren
  - Vollständiger blockierender Flow: Server startet → Browser öffnet → Redirect abgefangen → Token gespeichert
- [x] **Credentials-Datei** statt Hardcoding: `google-oauth-credentials.json` in `%APPDATA%\hufmacherin-app\`
  - Unterstützt simples Format `{client_id, client_secret}` und Google-Console-Format `{installed: {...}}`
- [x] **Drei Google-Kalender** nach Typ:
  - `hufbearbeitung` → `primary`
  - `reitstunde` → Kalender „Reitstunden" (wird automatisch angelegt)
  - `eigener_termin` → Kalender „Persönlich" (wird automatisch angelegt)
- [x] **`googleExportiert` Flag** in DB (kein Doppel-Export; bereits exportierte Termine werden übersprungen)
- [x] **Refresh-Token-Handling** (`client.on('tokens', ...)` – automatische Erneuerung + Persistenz)
- [x] **OAuth-Dialog entfernt** (kein manuelles Code-Eingabe-Modal mehr nötig)
- [x] **Exportierter Termin mit Uhrzeit** (dateTime mit Europe/Vienna, Fallback auf Datum ohne Zeit)
- [ ] Einzeltermin aus Tooltip direkt exportieren (aktuell: Bulk-Export aller Termine)
- [ ] Fehlerbehandlung bei fehlgeschlagenem Export verbessern (Retry, UI-Feedback pro Termin)

### Phase 4: PWA – Vollausbau (Smartphone als primäres Arbeitsgerät vor Ort)

> **Philosophie:** Die Userin ist vor Ort **ausschließlich mit dem Smartphone**. Die PWA ist ihr primäres Werkzeug – Termine, Kunden, Pferde, Fotos. Der PC übernimmt nur Bildnachbearbeitung und später Buchhaltung.  
> **Datenstrategie:** NAS-unabhängig (JSON auf der NAS), PC-App hat eigene SQLite. Sync kommt später.  
> **Stack:** Pure-HTML-PWA + Node.js HTTP-Server (Port 3004) + JSON-Dateien als Datenspeicher  
> **NAS-Verzeichnis:** `/volume1/Tenny/HufMacherin App/`

---

#### A · Infrastruktur & Architektur

- [x] `nas/server.js` – Grundgerüst (Port 3004, `safePath`, `safeWriteJson`, `/api/health`, `/api/upload`, statische Dateien)
- [x] `nas/package.json` – nur `sharp` als Dependency
- [x] `nas/public/upload.html` – Foto-Upload-PWA (Hufbearbeitung + Nacherfassung, Offline-Queue)
- [x] `nas/public/manifest.json` – PWA-Manifest
- [x] `nas/public/sw.js` – Service Worker (Cache-first + Background Sync)
- [x] `nas/.gitignore` – `node_modules/` + `test-data/` ausgeschlossen
- [x] `nas/test-lokal.ps1` – lokaler Test-Start auf Windows (zeigt Tailscale-URL)
- [ ] **PWA-Icons erstellen** – `nas/public/icons/icon-192.png` + `icon-512.png` (Huf-Symbol, erdbraun)

---

#### B · Server: CRUD-Routen für Kerndaten

> Alle Daten als JSON in `database/` auf der NAS. `safeWriteJson` schützt vor Datenverlust.  
> Datenmodell: Kunden → Pferde (1:n) → Termine (1:n pro Pferd).

- [x] **`GET /api/kunden`** – alle Kunden laden (`database/kunden.json`)
- [x] **`POST /api/kunden`** – neuen Kunden anlegen (id = `ku_[timestamp]`)
- [x] **`PUT /api/kunden/:id`** – Kunden bearbeiten
- [x] **`DELETE /api/kunden/:id`** – Kunden löschen (nur wenn keine Pferde vorhanden)
- [x] **`GET /api/pferde`** – alle Pferde laden (`database/pferde.json`)
- [x] **`POST /api/pferde`** – neues Pferd anlegen (id = `pf_[timestamp]`, Referenz `kundeId`)
- [x] **`PUT /api/pferde/:id`** – Pferd bearbeiten
- [x] **`DELETE /api/pferde/:id`** – Pferd löschen (nur wenn keine Termine vorhanden)
- [x] **`GET /api/termine`** – alle Termine laden (`database/termine.json`, optional `?pferdId=&von=&bis=`)
- [x] **`POST /api/termine`** – neuen Termin anlegen (id = `te_[timestamp]`)
- [x] **`PUT /api/termine/:id`** – Termin bearbeiten / Status ändern
- [x] **`DELETE /api/termine/:id`** – Termin löschen

---

#### C · PWA: `index.html` (neue Haupt-App, ersetzt `upload.html` als Einstieg)

> Tab-Navigation unten (mobil-üblich): **Termine · Kunden · Pferde · Fotos**  
> `upload.html` bleibt erhalten, leitet aber auf `index.html#fotos` weiter.

**Grundstruktur & Navigation:**
- [x] `nas/public/index.html` anlegen – Shell mit Tab-Bar unten (4 Tabs)
- [x] `nas/public/manifest.json` → `start_url: /`, Name `HufMacherin`
- [x] `nas/public/upload.html` → Redirect auf `index.html#fotos`
- [x] `nas/public/sw.js` → `index.html` in Cache-Liste aufnehmen
- [x] Einstellungen-Modal (NAS-URL, Auto-Open bei erstem Start) in `index.html`
- [x] Verbindungsstatus-Banner

**Tab 1 – Termine:**
- [x] Listenansicht: nach Datum gruppiert, Datum-Trenner, Heute markiert
- [x] Termin-Karte: Uhrzeit, Pferd, Kunde, Status-Badge (farbig)
- [x] Status-Schnellwechsel direkt auf Termin-Karte
- [x] „+ Neuer Termin“-Button (FAB) → Formular-Modal
- [x] Formular: Datum, Von–Bis (15-Min-Schritte), Pferd-Dropdown aus DB, Bemerkung
- [x] Folgetermin-Vorschlag: nach Abschluss → 4/5/6/8 Wochen wählbar, Werktag-Korrektur
- [x] Termin bearbeiten (Edit-Icon)
- [x] Termin löschen (2-Schritt)

**Tab 2 – Kunden:**
- [x] Kundenliste (alphabetisch, Suchfeld)
- [x] Kunden-Detail: Name, Adresse, Pferde-Anzahl sichtbar
- [x] „+ Neuer Kunde“-Formular: Vorname, Name, Adresse, Telefon (optional)
- [x] Kunden bearbeiten
- [x] Kunden löschen (nur wenn keine Pferde)

**Tab 3 – Pferde:**
- [x] Pferdeliste (gruppiert nach Kunde, Suchfeld)
- [x] Pferd-Detail: Name, Geburtsjahr, Geschlecht, letzter abgeschlossener Termin
- [x] „+ Neues Pferd“-Formular: Name, Geburtsjahr, Geschlecht, Besitzer (Kunde wählen), Bemerkungen
- [x] Pferd bearbeiten
- [x] Pferd löschen (nur wenn keine Termine)

**Tab 4 – Fotos:**
- [x] Foto-Upload-Flow aus `upload.html` übernommen (Session-Start, Huf-Grid, Kamera, Nacherfassung)
- [x] Pferd-Dropdown aus DB (mit Fallback auf Freitext)
- [x] Session-Galerie

---

#### D · Deployment auf Synology DS124

- [ ] Tailscale-Node ins Huf-Macherin-Netzwerk aufnehmen (⏳ Tailscale-IP noch offen)
- [ ] SSH-Zugang zur DS124 einrichten
- [ ] Verzeichnis anlegen: `ssh admin@[NAS-IP] mkdir -p "/volume1/Tenny/HufMacherin App/nas/public/icons"`
- [ ] Dateien übertragen (SSH-Pipe-Methode aus DOCS.md Kapitel 8)
- [ ] `npm install` auf NAS ausführen (sharp wird für NAS-ARM kompiliert)
- [ ] Health-Check: `http://[Tailscale-IP]:3004/api/health`
- [ ] Task Scheduler (Synology DSM) → Autostart bei Boot einrichten
- [ ] PWA auf Smartphone installieren (Chrome → „Zum Startbildschirm")
- [ ] NAS-URL im Einstellungs-Modal auf Handy eintragen

---

#### E · Feldtest & Feinschliff

- [x] Lokaler Test mit eigenem Smartphone: PWA geladen, 4 Tabs sichtbar, NAS-URL eingetragen ✅
- [ ] Termin-Workflow end-to-end testen (anlegen → Foto → abschließen → Folgetermin)
- [ ] Offline-Verhalten prüfen (Flugmodus → Fotos upload später, DB-Änderungen?)
- [ ] Einrichtung auf Userin-PC + Userin-Smartphone (vor Ort)

---

**Am PC (Electron-App, nachher):**
- Fotos aus NAS `_untagged/` in strukturierte Ordner verschieben
- Kunden/Pferde/Termine zwischen PWA-JSON und PC-SQLite abgleichen (Sync – Phase 5)
- Bildnachbearbeitung, Vorher/Nachher-Vergleich
- Galerie pro Pferd

---

### Phase 6: Rechnungswesen (Zukunft)

- [ ] Rechnungsstellung pro Termin aktivieren
- [ ] Rechnungs-PDF generieren
- [ ] Erlöse-Übersicht / einfache Statistik
- [ ] Export für Buchhaltung (CSV)

### Phase 8: Intelligente Huf-Dokumentation (KI-gestützt, inspiriert von LTZ & Co.)

> **Zur Diskussion** – noch kein Umsetzungsbeschluss.  
> Recherche-Grundlage: LTZ Huf-App (Dr. Michael Zanger), Huf-ID (HoofIDGBR), Happie Horse (Animalytics), horse+ (KADACON).

---

#### Referenz-Apps im Überblick

| App | Plattform | Schwerpunkt | Relevanz für uns |
|-----|-----------|-------------|-----------------|
| **LTZ Huf-App** (Dr. Michael Zanger) | Android ≥14 | Hufzustand analysieren, Hufpass, Lernplattform | Hoch – Hufpass-Konzept & Foto-Analyse |
| **Huf-ID** (HoofIDGBR) | Android/iOS | Vorher/Nachher-Fotoanalyse mit Markierungen, Röntgen | Hoch – Vergleichsfotos mit Overlay |
| **Happie Horse** (Animalytics) | Android/iOS | Ganzheitliches Pferde-Management, Gesundheit, Training | Mittel – Erinnerungen & Gesundheitslog |
| **horse+** (KADACON) | Android/iOS | Reiterhof-Verwaltung, Stall ↔ Einsteller-Kommunikation | Niedrig – B2B-Stall, kein Hufpflege-Fokus |

---

#### LTZ Huf-App – Funktionsumfang (Stand April 2026)

- **Hufzustand-Analyse**: Prüfung ob Huf zu steil/flach, Stabilitäts- & Belastbarkeitsbewertung, Stresserkennung
- **Erziehungs-/Bearbeitungstipps**: automatisch je nach erkanntem Zustand
- **Hufpass**: alle Analysen und Daten strukturiert je Pferd gespeichert
- **3D-Huf-Vermessung**: selbst vermessen, frei drehbar (neu, April 2026)
- **Lernplattform**: Audios (Anatomie, Huf), Videos (Bearbeitungspraxis), Online-Coachings
- **24/7 Wissens-Chat**
- **Therapeuten-Tipps** (weiterführend)
- **Abo-Modell**: 7 Tage kostenlos, dann In-App-Kauf

---

#### Was wir bereits haben (Abgleich)

| LTZ-Funktion | Status in unserer App |
|---|---|
| Terminplanung & Status-Workflow | ✅ vollständig |
| Bearbeitungsnotizen pro Termin | ✅ vorhanden |
| Bearbeitungshistorie mit Intervallen | ✅ vorhanden |
| Folgetermin-Vorschlag | ✅ vorhanden |
| Ampelhinweis (Intervall-Überwachung) | ✅ vorhanden |
| Foto-Dokumentation strukturiert | ⏳ Phase 5 geplant |
| Vorher/Nachher-Vergleich | ⏳ Phase 5 geplant |
| Hufpass (strukturierter Befund) | ❌ fehlt |
| Hufzustand-Klassifizierung | ❌ fehlt |
| KI-Analyse / Bildauswertung | ❌ fehlt (Langfrist) |

---

#### Kandidaten für Integration (zur Diskussion)

**Realistisch, hoher Nutzen:**
- [ ] **Hufpass-Eintrag** pro Termin: standardisiertes Feld für Befund (z.B. Hufwinkel, Trachtenstand, Auffälligkeiten) → ergänzt das bestehende Freitextfeld
- [ ] **Vorher/Nachher-Fotoansicht** in Pferdehistorie: zwei Fotos desselben Pferdes nebeneinander (zeitlich oder Links/Rechts-Vergleich) – baut auf Phase 5 auf

**Mittelfristig, nach Phase 5 (Foto-Upload):**
- [ ] **Bild-Overlay-Markierungen**: farbige Punkte/Linien auf Huffoto einzeichnen (Hufwandlinie, Rotationspunkt) – ähnlich Huf-ID, aber ohne Röntgen
- [ ] **PDF-Export Hufpass**: pro Pferd, mit Verlaufsfoto + Notizen – als Übergabedokument an Tierarzt oder Kunden

**Langfristig / Vision (kein konkreter Plan):**
- [ ] KI-gestützte Hufanalyse (Winkelmessung, Symmetrievergleich) – hoher Aufwand, benötigt Trainingsdaten
- [ ] Integration mit Tierarzt-Befunden oder Röntgenbildern

---

#### Abgrenzung: Was wir bewusst nicht machen

- Lernplattform / Videos / Coachings (kein Kerngeschäft)
- Fruktan-Risiko, Gangarten-Sensorik, Trainingsplanung (horse management ≠ Hufpflege-Tool)
- Stall-Management für Einsteller (horse+, zu breiter B2B-Scope)
- Abo-Modell / Cloud-Sync (App bleibt lokal, DSGVO-sicher)

---

### Phase 7: WhatsApp-Integration (Zukunft)
- [ ] Beweis-Foto nach Bearbeitung automatisch senden
- [ ] Eingehende Terminanfragen strukturiert erfassen

---

## 🔧 Technische Schulden

| Thema | Beschreibung |
|-------|-------------|
| Doppelte Datenhaltung | `src/` und `dist/` divergieren nach Änderungen bis zum nächsten Build. Kein Watch-Mode für Backend. |
| Inline-Styles | Gesamte UI via Inline-Styles in Kalender.tsx (~1800 Zeilen). Sollte in CSS-Module oder Tailwind überführt werden. |
| models.ts veraltet | `src/models.ts` definiert Interfaces, die nicht mit tatsächlichem DB-Schema übereinstimmen (fehlt: `status`, `ende`, `hufbemerkungen`). |
| Kein Error-Boundary | React Error Boundaries fehlen – App-Absturz bei Runtime-Fehler ohne Anzeige. |
| Alert()-Dialoge | Systemdialoge statt eigener UI-Dialoge für Feedback. |
| Kein Logging | Keine strukturierte Fehlerprotokollierung im Main-Prozess. |
| Kein Auto-Updater | Neue Versionen müssen manuell installiert werden. |

---

## 🎓 Empfohlene Skills

Folgende Skills wären hilfreich zu definieren / laden für zukünftige Arbeit:

| Skill | Wofür |
|-------|-------|
| **Synology-Tailscale-Upload** (Gerüst vorhanden) | Phase 4: PWA, Kamera, File Station API, Tailscale – Zugangsdaten werden ergänzt |
| **style-system-hufmacherin** (neu) | Einheitliche UI-Parameter fuer alle Unterseiten: Farben, Typografie, Komponenten, Icons, Konsistenzprozess |
| **agent-customization** (vorhanden) | Copilot-Instruktionen, Skill-Dateien pflegen |
| Performance-Profiling | Wenn Kalender mit vielen Terminen langsam wird |
| Form-Validation | Für Phase 2/3 mit komplexeren Formularen |

---

## 📅 Release-Ziele

| Version | Inhalt | Wann |
|---------|--------|------|
| **v0.1** | Basis stabil: Startfehler behoben, B1/B4/B5 erledigt, modernisierte Sidebar-UI | Erreicht (10. April 2026) |
| **v0.2** | Pferde-Historie, Feiertage, Termin-Drag&Drop | — |
| **v0.3** | Google Calendar OAuth2 funktionsfähig | — |
| **v1.0** | Stabile Desktop-App mit vollständigem Workflow | — |
| **v1.x** | PWA für Foto-Upload (Synology) | — |

---

*Diese Datei bitte bei jedem Session-Start aktualisieren: abgehakte Punkte verschieben, neue Erkenntnisse hinzufügen.*
