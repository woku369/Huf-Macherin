# Roadmap – Die Huf-Macherin App

> **Zuletzt aktualisiert:** 10. April 2026 (Session 2)  
> **App-Version:** 0.0.0 (Entwicklungsphase)  
> **Stack:** Electron + React + Vite + TypeScript + SQLite (better-sqlite3)

---

## Gesamtfortschritt

```
Kernfunktionen    ████████████░░░░░░░░  60%
Kalender          ████████████████░░░░  80%
Google Calendar   ████░░░░░░░░░░░░░░░░  20%
PWA / Synology    ░░░░░░░░░░░░░░░░░░░░   0%
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
- [x] DevTools in Production aktiviert (für Debugging)
- [x] **April 2026:** Backend neu gebaut – `dist/db.js`, `dist/preload.js`, `dist/ipc-handler.js` aktuell

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

### Export
- [x] Kalender als PDF exportieren (html2canvas + jsPDF)
- [x] Google Calendar Export (Grundstruktur vorhanden)

---

## 🚧 In Arbeit / Offene Bugs

### Kritisch

| # | Problem | Datei | Priorität |
|---|---------|-------|-----------|
| B1 | `window.api.updateTerminStatus` (flat) existiert in `dist/preload.js` nicht mehr – nur noch `window.api.termine.updateStatus` (nested). Alte Aufrufe würden scheitern. | preload.ts / window-api.d.ts | **Hoch** |
| B2 | Bearbeitungsmaske öffnet bei "Bestätigt" – logisch falsch: "Bestätigt" = Termin zugesagt, Dokumentation sollte erst bei "Abschließen" kommen. | Kalender.tsx | **Mittel** |
| B3 | `naechsterTermin`-Wert aus der Bearbeitungsmaske (4/6/8/12 Wochen) wird nicht für den Folgetermin genutzt – der ipc-handler.ts `termine:update` erstellt immer fix 4 Wochen. Das neue Speichern via `termine:updateStatus` erstellt überhaupt keinen Folgetermin. | Kalender.tsx / ipc-handler.ts | **Mittel** |
| B4 | "Neuen Kunden anlegen" Button im Termin-Dialog zeigt nur alert(). Nicht implementiert. | Kalender.tsx ~Z.1100 | **Mittel** |

### Nicht-kritisch

| # | Problem | Datei |
|---|---------|-------|
| B5 | DevTools werden immer geöffnet (auch in Production). Sollte nur für Dev-Builds sein. | electron-main.cjs |
| B6 | `window.api.updateTerminStatus` in `window-api.d.ts` deklariert aber `dist/preload.js` hat es nicht mehr als Flat-API | window-api.d.ts |
| B7 | Kein Fehler-Feedback wenn DB-Operation fehlschlägt (nur alert()) | alle Formulare |
| B8 | `TerminVerwaltung` + `TerminListe` sind ältere Komponenten (pre-Kalender), redundant mit neuem Kalender-Workflow | TerminVerwaltung.tsx |

---

## 📋 Geplante Features

### Phase 0: GitHub Repository (dringend!)
- [x] GitHub-Repo anlegen: https://github.com/woku369/Huf-Macherin
- [x] `.gitignore` korrigiert (dist/assets ignoriert, dist/db.js + Backend behalten, *.db ausgeschlossen)
- [ ] Initial-Commit & Push (Git Bash oder Git-fähiges Terminal nötig)

---

### Phase 1: Stabilisierung

- [ ] **B4 Fix:** Neuen Kunden im Termin-Dialog anlegen (Modal-in-Modal)
- [ ] **B5 Fix:** DevTools nur im Dev-Modus öffnen

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
- [ ] Termin-Dialog: Typ-Auswahl am Anfang (schaltet Felder um)
- [ ] Kalender: Farblegende um Reitstunde + Eigener Termin erweitern
- [ ] Tooltip: Anzeige und Status-Buttons passend zum Typ
- [ ] Status-Farbgebung: eigene Farben pro Typ
- [ ] Folgetermin-Logik: nur bei Hufbearbeitung
- [ ] Google Calendar Export: Typ → Calendar-Kategorie

---

### Phase 3: Pferde-Historie & Bearbeitungs-Übersicht

- [ ] **PferdHistorie:** Alle Hufbearbeitungen eines Pferdes chronologisch anzeigen
- [ ] **Bearbeitungsnotizen** beim Termin im Tooltip anzeigen
- [ ] **Österreichische Feiertage** im Kalender markieren
- [ ] Kundenverwaltung: Pferde-Übersicht mit letzter Bearbeitungszeit
- [ ] Termin bearbeiten (Edit-Modal)
- [ ] Termin löschen direkt im Tooltip

---

### Phase 4: Google Calendar Integration (optimiert)

> Ziel: Alle Termin-Typen auf Wunsch in den Google Kalender übertragen

- [ ] Echte OAuth2-Credentials einrichten (Google Cloud Console)
  - Aktuell: Platzhalter `DEIN_CLIENT_ID` in `google-calendar.ts`
  - Veraltete Redirect-URI `urn:ietf:wg:oauth:2.0:oob` ersetzen
  - Loopback-Redirect (`http://127.0.0.1:PORT`) für Desktop-Apps verwenden
- [ ] **Drei Google-Kalender** (oder Farb-Tags): Hufbearbeitung / Reitstunden / Persönlich
- [ ] Einzeltermin aus Tooltip direkt exportieren
- [ ] Exportierter Termin mit Uhrzeit (aktuell nur Datum)
- [ ] `googleExportiert` Flag in DB (kein Doppel-Export)
- [ ] Refresh-Token-Handling (automatische Token-Erneuerung)
- [ ] Fehlerbehandlung bei fehlgeschlagenem Export

### Phase 4: PWA für Foto-Upload (Synology via Tailscale)

> Android-Smartphone → PWA (Browser) → Synology DS124 via Tailscale  
> Strukturierte Ablage plus Ansicht + Tagging in der Electron-App  
> Eigener Skill wird vom Benutzer definiert.

**Voraussetzungen (einmalig):**
- [x] Tailscale-Client auf DS124 installiert und aktiv
- [ ] Tailscale-Node ins Huf-Macherin-Netzwerk aufnehmen (⏳ Infos folgen)
- [ ] Synology: **File Station API** aktivieren (kein WebDAV – Provider-seitig gesperrt)
- [ ] Ordnerstruktur auf NAS festlegen: `/HufMacherin/[YYYY-MM-DD]_[PferdName]_[KundeName]/`

**Upload-Protokoll: Synology File Station HTTP API (DSM 7)**
- REST-Endpunkt: `https://[tailscale-ip]:5001/webapi/entry.cgi`
- Methode: `SYNO.FileStation.Upload` (kein WebDAV nötig)
- Auth: Synology-Account Session-Token oder API-Key

**Vor-Ort-Workflow (PWA, Handy):**
- Schnell & simpel – kein Taggen, keine Zuordnung vor Ort
- [ ] **Skill fertigstellen:** `.github/skills/synology-tailscale-upload/SKILL.md` mit Tailscale-Zugangsdaten befüllen (⏳ wenn im Heimnetz)
- [ ] PWA-Grundgerüst (Vite + React + TypeScript, Manifest, als Homescreen-App installierbar)
- [ ] Kamera-Direktaufnahme (`<input capture="environment">`)
- [ ] Kunde + Pferd auswählen (Dropdown, wenige Klicks)
- [ ] Sofort-Upload auf DS124 in Staging-Ordner: `/HufMacherin/_untagged/[Datum]_[Pferd]/`
- [ ] Offline-Upload-Queue (IndexedDB + Background Sync API)
- [ ] **Kein Taggen vor Ort** – Huf-Position & Vorher/Nachher alles später am PC

**Am PC (Electron-App, nachher):**
- Fotos aus NAS-Staging in strukturierte Ordner verschieben
- Huf-Position zuweisen: VL / VR / HL / HR (per Klick/Drag)
- Vorher / Nachher markieren
- Bemerkungen hinzufügen
- Vorher/Nachher-Vergleich: zwei Bilder nebeneinander, gleiche Position
- Chronologische Galerie pro Pferd

**Videos:**
- Zunächst kein Video (Foto reicht) – kann später ergänzt werden

---

### Phase 6: Rechnungswesen (Zukunft)

- [ ] Rechnungsstellung pro Termin aktivieren
- [ ] Rechnungs-PDF generieren
- [ ] Erlöse-Übersicht / einfache Statistik
- [ ] Export für Buchhaltung (CSV)

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
| **agent-customization** (vorhanden) | Copilot-Instruktionen, Skill-Dateien pflegen |
| Performance-Profiling | Wenn Kalender mit vielen Terminen langsam wird |
| Form-Validation | Für Phase 2/3 mit komplexeren Formularen |

---

## 📅 Release-Ziele

| Version | Inhalt | Wann |
|---------|--------|------|
| **v0.1** | Alle kritischen Bugs (B1–B5) behoben, stabile Basisfunktionen | Nächste Session |
| **v0.2** | Pferde-Historie, Feiertage, Termin-Drag&Drop | — |
| **v0.3** | Google Calendar OAuth2 funktionsfähig | — |
| **v1.0** | Stabile Desktop-App mit vollständigem Workflow | — |
| **v1.x** | PWA für Foto-Upload (Synology) | — |

---

*Diese Datei bitte bei jedem Session-Start aktualisieren: abgehakte Punkte verschieben, neue Erkenntnisse hinzufügen.*
