---
name: style-system-hufmacherin
description: "Use when: styling UI, creating new pages/components, refactoring CSS, introducing colors/icons, or polishing layout. Ensures consistent Cattlework-inspired, earthy, calm design across the whole app."
---

# Skill: Style System - Die Huf-Macherin

## Ziel

Dieses Skill definiert die gestalterischen Grundparameter fuer alle aktuellen und kuenftigen Unterseiten.
Wenn sich Designparameter aendern, wird zuerst dieses Skill aktualisiert und danach die UI angepasst.

Leitbild:
- Handwerklich, klar, robust, ehrlich
- Pferde-/Western-/Cattlework-Anmutung
- Erdige, gedeckte Farben
- Nicht verspielt, nicht knallig
- Gute Lesbarkeit und ruhige Flaechen

## Design-Prinzipien

1. Klarheit vor Deko
- Hierarchie immer durch Kontrast, Abstand, Groesse.
- Wenige starke Akzente, keine bunten Mischpaletten.

2. Gedeckte Farbigkeit
- Basisflaechen: helles Creme/Beige/Grau.
- Akzentfarben: staubiges Petrol, warmes Braun, Salbei/Oliv.
- Rot nur fuer Warnung/Loeschen.

3. Konsistenz
- Gleiche Abstaende, gleiche Radien, gleiche Button-Sprache in allen Views.
- Neue Seite startet immer mit denselben Layout-Bausteinen (Header, Panel, Actions, Lists).

4. Handwerks-Charakter
- Solide Formen, eher eckig-abgerundet statt verspielt-rund.
- Keine verspielten Animationen oder Candy-Farben.

## Globale Tokens (Default)

Nutze bevorzugt CSS-Variablen in einer zentralen Datei (z. B. App.css/root):

```css
:root {
  --bg-page: #f4f1ea;          /* creme-beige, sehr dezent */
  --bg-main: #f8f6f2;
  --bg-sidebar: #232b2b;       /* dunkles, neutrales Graphitgruen */
  --bg-sidebar-soft: #2f3a39;

  --panel: #ffffff;
  --panel-soft: #fcfaf7;
  --panel-border: #ddd6cb;

  --text-main: #2a2824;
  --text-soft: #6d665c;
  --text-on-dark: #e6e2da;

  --accent: #4d6a62;           /* staubiges Petrol/Salbei */
  --accent-strong: #3f5953;
  --accent-soft: #dbe5e1;

  --ok: #56755f;
  --warn: #b08a55;
  --danger: #a55d4e;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-soft: 0 6px 20px rgba(48, 42, 34, 0.08);
}
```

## Typografie

- Primär: Segoe UI / Noto Sans / Arial (ohne Experimente)
- Titel: 600-700, klar und kompakt
- Fliesstext: 13-15px
- Sidebar Labels: 11-13px

Richtwerte:
- H1: 24-28px
- H2/H3: 18-22px
- Body: 14px
- Meta/Hinweis: 12-13px

## Layout-System

1. App Shell
- Linke Sidebar fix
- Hauptbereich mit Header + Content
- Mobile: Sidebar oben gestapelt

2. Spacing
- 4er-Raster (4/8/12/16/24/32)
- Panel-Standard-Padding: 16px
- Zwischen Panels: 12-16px

3. Panel-Sprache
- Heller Hintergrund
- leichter Border
- weicher Schatten
- Radius md oder lg

## Komponenten-Regeln

Buttons:
- Primär: --accent
- Sekundär: neutrales Grau/Beige
- Danger: --danger
- Keine reinen Neon-/Sättigungsfarben
- Hover: nur leichte Abdunkelung/Aufhellung

Inputs:
- Hintergrund nahezu weiss
- Border neutral
- Fokus-Ring in --accent mit niedriger Deckkraft

Badges/Status:
- "vorreserviert": gedecktes Violettgrau
- "bestaetigt": gedecktes Blaugruen
- "abgeschlossen": gedecktes Gruen
- "vorschlag": gedecktes Ocker
- "reitstunde": warmes Sattelbraun
- "eigener termin": dunkles rostiges Rotbraun

## Kalender-Farbprofil (soft)

Empfehlung:
- vorreserviert: #8a7d90
- bestaetigt: #5f7f86
- abgeschlossen: #6c8a70
- vorschlag: #b39563
- reitstunde: #a67c52
- eigener_termin: #8b5e4e

Regel:
- In Legenden, Event-Kacheln und Aktionsbuttons dieselbe semantische Farbe verwenden.
- Keine Mischung aus knalligen Altfarben und neuen Softfarben.

## Icon-System

- Einheitlich Lucide Icons verwenden
- Outline-Style konsistent, groesse meist 16px (Sidebar), 18-20px (Section Header)
- Keine Mischung aus Emoji + unterschiedlichen Icon-Sets in derselben Navigationszone

Empfohlene Icons:
- Kalender: CalendarDays
- Kunden: Users
- Anleitungen: BookOpen
- Einstellungen: Settings
- Foto: Camera
- Rechnungen: ReceiptText

## Motion

- Nur dezente Transitions (120-180ms)
- Kein Bouncing, kein auffaelliger Zoom
- Fokus auf ruhiges UI

## Do / Don't

Do:
- Erst Tokens nutzen, dann Einzelwerte.
- Neue Unterseiten aus bestehenden Bausteinen ableiten.
- Vor Merge visuell pruefen: Sidebar, Header, Panel, Buttons, Kalender-Legende.

Don't:
- Keine knalligen Primärfarben (reines Blau/Gruen/Rot)
- Kein Komponenten-Mix aus mehreren Designstilen
- Keine ad-hoc Inline-Farben ohne Token

## Aenderungsprozess fuer Konsistenz

Wenn ein Designparameter geaendert werden soll:

1. Zuerst dieses Skill aktualisieren
- Token, Regel oder Komponentenvorgabe hier dokumentieren

2. Dann technische Umsetzung
- Betroffene CSS/TSX Dateien anpassen
- Alte Abweichungen entfernen

3. Kurz pruefen
- Sidebar
- Kalender
- Formulare
- Buttons (primary/secondary/danger)
- Anleitungen/Einstellungen

## Mini-Checklist pro neuer Unterseite

- [ ] Nutzt globale Tokens
- [ ] Panel/Spacing entspricht System
- [ ] Buttons entsprechen Button-Sprache
- [ ] Icons aus Lucide, konsistent
- [ ] Farben gedeckt, nicht knallig
- [ ] Mobile Layout bleibt lesbar
