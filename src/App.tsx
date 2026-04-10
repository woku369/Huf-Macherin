import { useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarDays, Camera, ReceiptText, Settings, Users } from 'lucide-react';
import './App.css';
import PferdeListe from './PferdeListe';
import Kalender from './Kalender';

interface Kunde {
  id: number;
  name: string;
  vorname?: string;
  adresse: string;
}

type ThemeSettings = {
  bgPage: string;
  bgMain: string;
  bgSidebar: string;
  accent: string;
  ok: string;
  danger: string;
};

type AppNoticeType = 'error' | 'success' | 'warning' | 'info';

const DEFAULT_THEME: ThemeSettings = {
  bgPage: '#f4f1ea',
  bgMain: '#f8f6f2',
  bgSidebar: '#232b2b',
  accent: '#4d6a62',
  ok: '#56755f',
  danger: '#a55d4e',
};

function App() {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [adresse, setAdresse] = useState('');
  const [selectedKunde, setSelectedKunde] = useState<Kunde | null>(null);
  const [alleTermine, setAlleTermine] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'kalender' | 'kunden' | 'anleitungen' | 'einstellungen'>('kalender');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [appNotice, setAppNotice] = useState<{ type: AppNoticeType; message: string } | null>(null);
  const [pendingDeleteKundeId, setPendingDeleteKundeId] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  
  // Bearbeitungsmodus
  const [editingKunde, setEditingKunde] = useState<Kunde | null>(null);
  const [editName, setEditName] = useState('');
  const [editVorname, setEditVorname] = useState('');
  const [editAdresse, setEditAdresse] = useState('');

  useEffect(() => {
    window.api.listKunden().then(setKunden);
  }, []);

  useEffect(() => {
    // Alle Termine für Kalender laden
    window.api.listAlleTermine && window.api.listAlleTermine().then(setAlleTermine);
  }, []);

  useEffect(() => {
    const savedLogo = localStorage.getItem('hufmacherinLogo');
    if (savedLogo) {
      setLogoDataUrl(savedLogo);
    }
  }, []);

  useEffect(() => {
    const savedThemeRaw = localStorage.getItem('hufmacherinTheme');
    if (savedThemeRaw) {
      try {
        const savedTheme = JSON.parse(savedThemeRaw) as Partial<ThemeSettings>;
        setTheme({ ...DEFAULT_THEME, ...savedTheme });
      } catch {
        setTheme(DEFAULT_THEME);
      }
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-page', theme.bgPage);
    root.style.setProperty('--bg-main', theme.bgMain);
    root.style.setProperty('--bg-sidebar', theme.bgSidebar);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--ok', theme.ok);
    root.style.setProperty('--danger', theme.danger);
  }, [theme]);

  const addKunde = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const neuerKunde = await window.api.addKunde({ name, vorname, adresse });
    setKunden([...kunden, neuerKunde]);
    setName('');
    setVorname('');
    setAdresse('');
  };

  const startEditKunde = (kunde: Kunde) => {
    setEditingKunde(kunde);
    setEditName(kunde.name);
    setEditVorname(kunde.vorname || '');
    setEditAdresse(kunde.adresse);
  };

  const saveEditKunde = async () => {
    if (!editingKunde) return;
    const updatedKunde = await window.api.updateKunde({
      ...editingKunde,
      name: editName,
      vorname: editVorname,
      adresse: editAdresse
    });
    setKunden(kunden.map(k => k.id === updatedKunde.id ? updatedKunde : k));
    setEditingKunde(null);
    if (selectedKunde?.id === updatedKunde.id) {
      setSelectedKunde(updatedKunde);
    }
  };

  const cancelEditKunde = () => {
    setEditingKunde(null);
    setEditName('');
    setEditVorname('');
    setEditAdresse('');
  };

  const deleteKunde = (id: number) => {
    setPendingDeleteKundeId(id);
    setAppNotice({
      type: 'warning',
      message: 'Kundenlöschung vorgemerkt: Alle zugehörigen Pferde und Termine werden ebenfalls gelöscht.'
    });
  };

  const confirmDeleteKunde = async () => {
    if (!pendingDeleteKundeId) return;
    const id = pendingDeleteKundeId;
    await window.api.deleteKunde(id);
    setKunden(kunden.filter(k => k.id !== id));
    if (selectedKunde?.id === id) setSelectedKunde(null);
    setPendingDeleteKundeId(null);
    setAppNotice({ type: 'success', message: 'Kunde wurde gelöscht.' });
  };

  const cancelDeleteKunde = () => {
    setPendingDeleteKundeId(null);
    setAppNotice({ type: 'info', message: 'Löschvorgang abgebrochen.' });
  };

  const refreshTermine = async () => {
    if (window.api.listAlleTermine) {
      const termine = await window.api.listAlleTermine();
      setAlleTermine(termine);
    }
  };

  const handleLogoPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAppNotice({ type: 'error', message: 'Bitte eine Bilddatei wählen (PNG/JPG/WebP).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setLogoDataUrl(result);
        localStorage.setItem('hufmacherinLogo', result);
        setAppNotice({ type: 'success', message: 'Logo wurde gespeichert.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoDataUrl('');
    localStorage.removeItem('hufmacherinLogo');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
    setAppNotice({ type: 'info', message: 'Logo wurde entfernt.' });
  };

  const updateThemeColor = (key: keyof ThemeSettings, value: string) => {
    setTheme((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('hufmacherinTheme', JSON.stringify(next));
      return next;
    });
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    localStorage.setItem('hufmacherinTheme', JSON.stringify(DEFAULT_THEME));
  };

  const viewTitle: Record<'kalender' | 'kunden' | 'anleitungen' | 'einstellungen', { title: string; subtitle: string }> = {
    kalender: {
      title: 'Terminkalender',
      subtitle: 'Planung, Statuswechsel und Abschluss der Termine'
    },
    kunden: {
      title: 'Kundenverwaltung',
      subtitle: 'Kunden, Pferde und Termine zentral verwalten'
    },
    anleitungen: {
      title: 'Anleitungen',
      subtitle: 'Schnelle Hilfe für die wichtigsten Abläufe'
    },
    einstellungen: {
      title: 'Einstellungen',
      subtitle: 'App-Verhalten, Kategorien und zukünftige Optionen'
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="logo-slot">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="Logo" className="logo-image" />
            ) : (
              <span>Logo</span>
            )}
          </div>
          <div>
            <div className="brand-title">Die Huf-Macherin</div>
            <div className="brand-subtitle">Kunden, Pferde, Termine</div>
            <div className="logo-actions">
              <input
                ref={logoInputRef}
                className="logo-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoPick}
              />
              <button
                type="button"
                className="logo-btn"
                onClick={() => logoInputRef.current?.click()}
              >
                Logo wählen
              </button>
              {logoDataUrl && (
                <button type="button" className="logo-btn ghost" onClick={clearLogo}>
                  Entfernen
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-title">Arbeitsbereich</div>
          <button
            className={`nav-item ${activeView === 'kalender' ? 'active' : ''}`}
            onClick={() => setActiveView('kalender')}
          >
            <CalendarDays size={16} />
            <span>Kalender</span>
          </button>
          <button
            className={`nav-item ${activeView === 'kunden' ? 'active' : ''}`}
            onClick={() => setActiveView('kunden')}
          >
            <Users size={16} />
            <span>Kundenverwaltung</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-title">Erweiterungen</div>
          <button className="nav-item placeholder" type="button">
            <Camera size={16} />
            <span>Foto-Dokumentation (bald)</span>
          </button>
          <button className="nav-item placeholder" type="button">
            <ReceiptText size={16} />
            <span>Rechnungen (bald)</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-title">Hilfe</div>
          <button
            className={`nav-item ${activeView === 'anleitungen' ? 'active' : ''}`}
            onClick={() => setActiveView('anleitungen')}
          >
            <BookOpen size={16} />
            <span>Anleitungen</span>
          </button>
        </div>

        <div className="sidebar-kunden">
          <div className="nav-title">Kunden Schnellzugriff</div>
          <div className="quick-list">
            {kunden.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`quick-item ${selectedKunde?.id === k.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedKunde(k);
                  setActiveView('kunden');
                }}
              >
                <div className="quick-name">{k.name} {k.vorname && k.vorname}</div>
                <div className="quick-address">{k.adresse || 'Keine Adresse'}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          className={`nav-item settings ${activeView === 'einstellungen' ? 'active' : ''}`}
          onClick={() => setActiveView('einstellungen')}
          type="button"
        >
          <Settings size={16} />
          <span>Einstellungen</span>
        </button>
      </aside>

      <main className="main-area">
        <header className="main-header">
          <div>
            <h1>{viewTitle[activeView].title}</h1>
            <p>{viewTitle[activeView].subtitle}</p>
          </div>
        </header>

        <section className="main-content">
          {appNotice && (
            <div
              style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${appNotice.type === 'error' ? '#c07d71' : appNotice.type === 'success' ? '#7f9b84' : appNotice.type === 'warning' ? '#ba9968' : '#8f9ea3'}`,
                backgroundColor: appNotice.type === 'error' ? '#f7ece9' : appNotice.type === 'success' ? '#e6efe8' : appNotice.type === 'warning' ? '#f5efdf' : '#e9eef0',
                color: appNotice.type === 'error' ? '#6e3429' : appNotice.type === 'success' ? '#2f4e36' : appNotice.type === 'warning' ? '#6e5129' : '#2f454b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <span>{appNotice.message}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {pendingDeleteKundeId && appNotice.type === 'warning' && (
                  <>
                    <button className="btn btn-danger" type="button" onClick={confirmDeleteKunde}>Löschen bestätigen</button>
                    <button className="btn btn-muted" type="button" onClick={cancelDeleteKunde}>Abbrechen</button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAppNotice(null);
                    setPendingDeleteKundeId(null);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: '18px',
                    lineHeight: 1,
                    cursor: 'pointer'
                  }}
                  aria-label="Hinweis schließen"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {activeView === 'kalender' && (
            <Kalender termine={alleTermine} onTermineChange={refreshTermine} />
          )}

          {activeView === 'kunden' && (
            <div className="content-stack">
              <div className="panel">
                <h3>Neuen Kunden anlegen</h3>
                <form className="create-form" onSubmit={addKunde}>
                  <div>
                    <label>Nachname</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="z.B. Huber"
                      required
                    />
                  </div>
                  <div>
                    <label>Vorname</label>
                    <input
                      value={vorname}
                      onChange={(e) => setVorname(e.target.value)}
                      placeholder="z.B. Anna"
                    />
                  </div>
                  <div>
                    <label>Adresse</label>
                    <input
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      placeholder="z.B. Musterstraße 12"
                    />
                  </div>
                  <button className="btn btn-primary" type="submit">Anlegen</button>
                </form>
              </div>

              <div className="panel">
                <h3>Alle Kunden</h3>
                <div className="kunden-grid">
                  {kunden.map((k) => (
                    <div
                      key={k.id}
                      className={`kunden-card ${selectedKunde?.id === k.id ? 'selected' : ''}`}
                    >
                      {editingKunde?.id === k.id ? (
                        <div className="edit-grid">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Name"
                          />
                          <input
                            value={editVorname}
                            onChange={(e) => setEditVorname(e.target.value)}
                            placeholder="Vorname"
                          />
                          <input
                            value={editAdresse}
                            onChange={(e) => setEditAdresse(e.target.value)}
                            placeholder="Adresse"
                          />
                          <button className="btn btn-success" onClick={saveEditKunde}>✓</button>
                          <button className="btn btn-muted" onClick={cancelEditKunde}>✗</button>
                        </div>
                      ) : (
                        <div className="card-row">
                          <button
                            className="kunden-main"
                            onClick={() => setSelectedKunde(k)}
                            type="button"
                          >
                            <div className="kunden-name">{k.name} {k.vorname && k.vorname}</div>
                            <div className="kunden-address">{k.adresse || 'Keine Adresse hinterlegt'}</div>
                          </button>
                          <div className="card-actions">
                            <button className="btn btn-info" onClick={() => startEditKunde(k)}>Bearbeiten</button>
                            <button className="btn btn-danger" onClick={() => deleteKunde(k.id)}>Löschen</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedKunde && (
                <div className="panel">
                  <h3>Details für {selectedKunde.name}</h3>
                  <PferdeListe besitzerId={selectedKunde.id} />
                  <div className="settings-note" style={{ marginTop: '12px' }}>
                    Die alte Terminliste ist deaktiviert. Alle Terminabläufe laufen zentral über den Kalender (inkl. Status-Workflow und Abschlussdialog).
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'anleitungen' && (
            <div className="content-stack">
              <div className="panel">
                <h3>Schnellstart: Termin in 60 Sekunden</h3>
                <ol className="guide-list">
                  <li>Kalender öffnen und Datum anklicken.</li>
                  <li>Kunde auswählen und Pferd(e) markieren.</li>
                  <li>Zeit setzen und Termin als vorreserviert speichern.</li>
                  <li>Später Status auf bestätigt setzen.</li>
                  <li>Nach der Bearbeitung abschließen und Folgetermin-Wochen wählen.</li>
                </ol>
              </div>

              <div className="panel">
                <h3>Bereits verfügbar</h3>
                <div className="feature-grid">
                  <div className="feature-item done">
                    <span className="feature-state">Live</span>
                    <strong>Status-Workflow</strong>
                    <p>Vorreserviert → bestätigt → abgeschlossen inklusive Dokumentationsdialog.</p>
                  </div>
                  <div className="feature-item done">
                    <span className="feature-state">Live</span>
                    <strong>Neuer Kunde im Termin-Dialog</strong>
                    <p>Kunde direkt im Terminprozess anlegen über + Neu.</p>
                  </div>
                  <div className="feature-item done">
                    <span className="feature-state">Live</span>
                    <strong>Termin-Typen</strong>
                    <p>Hufbearbeitung, Reitstunde und eigener Termin mit passender Darstellung.</p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Geplant / Platzhalter laut Roadmap</h3>
                <div className="feature-grid">
                  <div className="feature-item planned">
                    <span className="feature-state">Geplant</span>
                    <strong>Foto-Dokumentation (PWA + Synology)</strong>
                    <p>Upload vom Android-Handy auf NAS, spätere Zuordnung und Galerie am PC.</p>
                  </div>
                  <div className="feature-item planned">
                    <span className="feature-state">Geplant</span>
                    <strong>Google Calendar Vollintegration</strong>
                    <p>OAuth2, Typ-basierte Kalender, Vermeidung von Doppel-Exporten.</p>
                  </div>
                  <div className="feature-item planned">
                    <span className="feature-state">Geplant</span>
                    <strong>Rechnungswesen</strong>
                    <p>Rechnung pro Termin, PDF-Erstellung und Export für Buchhaltung.</p>
                  </div>
                  <div className="feature-item planned">
                    <span className="feature-state">Geplant</span>
                    <strong>WhatsApp-Unterstützung</strong>
                    <p>Später: Termin-/Fotoversand teilautomatisiert aus der App.</p>
                  </div>
                  <div className="feature-item planned">
                    <span className="feature-state">Geplant</span>
                    <strong>Feiertage und Historie</strong>
                    <p>AT-Feiertage im Kalender und chronologische Pferde-Historie.</p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Häufige Fragen</h3>
                <p><strong>Wie erstelle ich einen Folgetermin?</strong><br />Beim Abschließen eines Termins im Dokumentationsdialog die Wochen auswählen und speichern.</p>
                <p><strong>Wie lege ich schnell einen neuen Kunden an?</strong><br />Im Termin-Dialog beim Feld Kunde auf + Neu klicken.</p>
                <p><strong>Wo finde ich spätere Funktionen?</strong><br />Links in der Sidebar unter „Erweiterungen" sowie hier in den Platzhaltern.</p>
              </div>
            </div>
          )}

          {activeView === 'einstellungen' && (
            <div className="content-stack">
              <div className="panel">
                <h3>App-Einstellungen</h3>
                <p>Hier können später Farbschema, Standardintervalle und Integrationen konfiguriert werden.</p>
              </div>

              <div className="panel">
                <h3>Theme-Basis (Cattlework)</h3>
                <p className="settings-note">Diese Farben gelten als Grundparameter für neue Unterseiten und bleiben lokal auf diesem Gerät gespeichert.</p>
                <div className="theme-grid">
                  <label className="theme-row">
                    <span>Hintergrund Seite</span>
                    <input type="color" value={theme.bgPage} onChange={(e) => updateThemeColor('bgPage', e.target.value)} />
                  </label>
                  <label className="theme-row">
                    <span>Hintergrund Inhalt</span>
                    <input type="color" value={theme.bgMain} onChange={(e) => updateThemeColor('bgMain', e.target.value)} />
                  </label>
                  <label className="theme-row">
                    <span>Sidebar</span>
                    <input type="color" value={theme.bgSidebar} onChange={(e) => updateThemeColor('bgSidebar', e.target.value)} />
                  </label>
                  <label className="theme-row">
                    <span>Akzent</span>
                    <input type="color" value={theme.accent} onChange={(e) => updateThemeColor('accent', e.target.value)} />
                  </label>
                  <label className="theme-row">
                    <span>Erfolg</span>
                    <input type="color" value={theme.ok} onChange={(e) => updateThemeColor('ok', e.target.value)} />
                  </label>
                  <label className="theme-row">
                    <span>Warnung/Löschen</span>
                    <input type="color" value={theme.danger} onChange={(e) => updateThemeColor('danger', e.target.value)} />
                  </label>
                </div>
                <div className="theme-actions">
                  <button className="btn btn-muted" type="button" onClick={resetTheme}>Standard wiederherstellen</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
