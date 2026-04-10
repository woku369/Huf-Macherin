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
  const [activeView, setActiveView] = useState<'kalender' | 'kunden'>('kalender');
  
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

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ 
        width: '300px', 
        backgroundColor: '#f5f5f5', 
        borderRight: '1px solid #ddd',
        overflowY: 'auto',
        padding: '20px'
      }}>
        <h1 style={{ marginTop: 0, color: '#2c3e50', fontSize: '24px' }}>Die Huf-Macherin</h1>
        
        {/* Navigation */}
        <div style={{ marginBottom: '30px' }}>
          <button 
            onClick={() => setActiveView('kalender')}
            style={{ 
              display: 'block',
              width: '100%',
              margin: '5px 0',
              padding: '10px',
              backgroundColor: activeView === 'kalender' ? '#3498db' : '#ecf0f1',
              color: activeView === 'kalender' ? 'white' : '#2c3e50',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            📅 Kalender
          </button>
          <button 
            onClick={() => setActiveView('kunden')}
            style={{ 
              display: 'block',
              width: '100%',
              margin: '5px 0',
              padding: '10px',
              backgroundColor: activeView === 'kunden' ? '#3498db' : '#ecf0f1',
              color: activeView === 'kunden' ? 'white' : '#2c3e50',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            👥 Kundenverwaltung
          </button>
        </div>

        {/* Kunden-Quick-Liste */}
        <div>
          <h3 style={{ color: '#34495e', marginBottom: '15px' }}>Kunden</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {kunden.map(k => (
              <div 
                key={k.id} 
                style={{ 
                  padding: '8px 12px',
                  margin: '5px 0',
                  backgroundColor: selectedKunde?.id === k.id ? '#e8f4fd' : 'white',
                  border: selectedKunde?.id === k.id ? '2px solid #3498db' : '1px solid #ddd',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                onClick={() => {
                  setSelectedKunde(k);
                  setActiveView('kunden');
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{k.name} {k.vorname && k.vorname}</div>
                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>{k.adresse}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {activeView === 'kalender' && (
          <div>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Terminkalender</h2>
            <Kalender termine={alleTermine} onTermineChange={refreshTermine} />
          </div>
        )}

        {activeView === 'kunden' && (
          <div>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Kundenverwaltung</h2>
            
            {/* Kunde hinzufügen */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h3>Neuen Kunden anlegen</h3>
              <form onSubmit={addKunde} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Name:</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nachname"
                    required
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Vorname:</label>
                  <input
                    value={vorname}
                    onChange={e => setVorname(e.target.value)}
                    placeholder="Vorname"
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Adresse:</label>
                  <input
                    value={adresse}
                    onChange={e => setAdresse(e.target.value)}
                    placeholder="Adresse"
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
                  />
                </div>
                <button 
                  type="submit"
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#27ae60', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  Anlegen
                </button>
              </form>
            </div>

            {/* Kundenliste */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h3>Alle Kunden</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {kunden.map(k => (
                  <div 
                    key={k.id} 
                    style={{ 
                      padding: '15px',
                      border: selectedKunde?.id === k.id ? '2px solid #3498db' : '1px solid #ddd',
                      borderRadius: '5px',
                      backgroundColor: selectedKunde?.id === k.id ? '#e8f4fd' : '#f9f9f9',
                    }}
                  >
                    {editingKunde?.id === k.id ? (
                      // Bearbeitungsmodus
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto auto', gap: '8px', alignItems: 'center' }}>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Name"
                          style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <input
                          value={editVorname}
                          onChange={e => setEditVorname(e.target.value)}
                          placeholder="Vorname"
                          style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <input
                          value={editAdresse}
                          onChange={e => setEditAdresse(e.target.value)}
                          placeholder="Adresse"
                          style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <button 
                          onClick={saveEditKunde}
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor: '#27ae60', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer' 
                          }}
                        >
                          ✓
                        </button>
                        <button 
                          onClick={cancelEditKunde}
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor: '#95a5a6', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer' 
                          }}
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      // Anzeigemodus
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div
                          style={{ cursor: 'pointer', flexGrow: 1 }}
                          onClick={() => setSelectedKunde(k)}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                            {k.name} {k.vorname && k.vorname}
                          </div>
                          <div style={{ color: '#7f8c8d', fontSize: '14px' }}>{k.adresse}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button 
                            onClick={() => startEditKunde(k)}
                            style={{ 
                              padding: '5px 10px', 
                              backgroundColor: '#3498db', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: 'pointer' 
                            }}
                          >
                            ✏️ Bearbeiten
                          </button>
                          <button 
                            onClick={() => deleteKunde(k.id)}
                            style={{ 
                              padding: '5px 10px', 
                              backgroundColor: '#e74c3c', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: 'pointer' 
                            }}
                          >
                            🗑️ Löschen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Kundendetails */}
            {selectedKunde && (
              <div style={{ 
                backgroundColor: 'white', 
                padding: '20px', 
                borderRadius: '8px', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3>Details für {selectedKunde.name}</h3>
                <PferdeListe besitzerId={selectedKunde.id} />
                <TerminVerwaltung besitzerId={selectedKunde.id} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
