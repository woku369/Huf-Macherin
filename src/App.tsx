import { useEffect, useState } from 'react';
import './App.css';
import PferdeListe from './PferdeListe';
import TerminVerwaltung from './TerminVerwaltung';
import Kalender from './Kalender';

interface Kunde {
  id: number;
  name: string;
  vorname?: string;
  adresse: string;
}

function App() {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [adresse, setAdresse] = useState('');
  const [selectedKunde, setSelectedKunde] = useState<Kunde | null>(null);
  const [alleTermine, setAlleTermine] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'kalender' | 'kunden' | 'anleitungen' | 'einstellungen'>('kalender');
  
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

  const deleteKunde = async (id: number) => {
    if (confirm('Wirklich löschen? Alle zugehörigen Pferde und Termine werden ebenfalls gelöscht!')) {
      await window.api.deleteKunde(id);
      setKunden(kunden.filter(k => k.id !== id));
      if (selectedKunde?.id === id) setSelectedKunde(null);
    }
  };

  const refreshTermine = async () => {
    if (window.api.listAlleTermine) {
      const termine = await window.api.listAlleTermine();
      setAlleTermine(termine);
    }
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
          <div className="logo-slot">Logo</div>
          <div>
            <div className="brand-title">Die Huf-Macherin</div>
            <div className="brand-subtitle">Kunden, Pferde, Termine</div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-title">Arbeitsbereich</div>
          <button
            className={`nav-item ${activeView === 'kalender' ? 'active' : ''}`}
            onClick={() => setActiveView('kalender')}
          >
            <span>📅</span>
            <span>Kalender</span>
          </button>
          <button
            className={`nav-item ${activeView === 'kunden' ? 'active' : ''}`}
            onClick={() => setActiveView('kunden')}
          >
            <span>👥</span>
            <span>Kundenverwaltung</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-title">Erweiterungen</div>
          <button className="nav-item placeholder" type="button">
            <span>🖼️</span>
            <span>Foto-Dokumentation (bald)</span>
          </button>
          <button className="nav-item placeholder" type="button">
            <span>🧾</span>
            <span>Rechnungen (bald)</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-title">Hilfe</div>
          <button
            className={`nav-item ${activeView === 'anleitungen' ? 'active' : ''}`}
            onClick={() => setActiveView('anleitungen')}
          >
            <span>📘</span>
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
          <span>⚙️</span>
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
                  <TerminVerwaltung besitzerId={selectedKunde.id} />
                </div>
              )}
            </div>
          )}

          {activeView === 'anleitungen' && (
            <div className="content-stack">
              <div className="panel">
                <h3>Schnellstart</h3>
                <p>1. Kalender öffnen und Termin anlegen.</p>
                <p>2. Beim Kunden Pferde auswählen und Zeit setzen.</p>
                <p>3. Terminstatus von vorreserviert auf bestätigt und danach auf abgeschlossen setzen.</p>
              </div>
              <div className="panel">
                <h3>Häufige Fragen</h3>
                <p><strong>Wie erstelle ich einen Folgetermin?</strong><br />Beim Abschließen eines Termins im Dokumentationsdialog die Wochen auswählen und speichern.</p>
                <p><strong>Wie lege ich schnell einen neuen Kunden an?</strong><br />Im Termin-Dialog beim Feld Kunde auf + Neu klicken.</p>
              </div>
            </div>
          )}

          {activeView === 'einstellungen' && (
            <div className="content-stack">
              <div className="panel">
                <h3>App-Einstellungen</h3>
                <p>Hier können später Farbschema, Standardintervalle und Integrationen konfiguriert werden.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
