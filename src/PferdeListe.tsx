import { useEffect, useState } from 'react';

interface Pferd {
  id: number;
  name: string;
  geburtsjahr?: number;
  alterJahre?: number;
  geschlecht: 'Stute' | 'Wallach' | 'Hengst';
  bemerkungen?: string;
  besitzerId: number;
}

export default function PferdeListe({ besitzerId }: { besitzerId: number }) {
  const [pferde, setPferde] = useState<Pferd[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', geburtsjahr: '', geschlecht: 'Stute', bemerkungen: '' });
  
  // Bearbeitungsmodus
  const [editingPferd, setEditingPferd] = useState<Pferd | null>(null);
  const [editForm, setEditForm] = useState({ name: '', geburtsjahr: '', geschlecht: 'Stute', bemerkungen: '' });

  useEffect(() => {
    window.api.listPferde(besitzerId).then(setPferde);
  }, [besitzerId]);

  const addPferd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    const alterJahre = form.geburtsjahr ? new Date().getFullYear() - Number(form.geburtsjahr) : undefined;
    const neuesPferd = await window.api.addPferd({
      name: form.name,
      geburtsjahr: form.geburtsjahr ? Number(form.geburtsjahr) : undefined,
      alterJahre,
      geschlecht: form.geschlecht as Pferd['geschlecht'],
      bemerkungen: form.bemerkungen,
      besitzerId
    });
    setPferde([...pferde, neuesPferd]);
    setForm({ name: '', geburtsjahr: '', geschlecht: 'Stute', bemerkungen: '' });
    setShowForm(false);
  };

  const startEditPferd = (pferd: Pferd) => {
    setEditingPferd(pferd);
    setEditForm({
      name: pferd.name,
      geburtsjahr: pferd.geburtsjahr?.toString() || '',
      geschlecht: pferd.geschlecht,
      bemerkungen: pferd.bemerkungen || ''
    });
  };

  const saveEditPferd = async () => {
    if (!editingPferd) return;
    const alterJahre = editForm.geburtsjahr ? new Date().getFullYear() - Number(editForm.geburtsjahr) : undefined;
    const updatedPferd = await window.api.updatePferd({
      ...editingPferd,
      name: editForm.name,
      geburtsjahr: editForm.geburtsjahr ? Number(editForm.geburtsjahr) : undefined,
      alterJahre,
      geschlecht: editForm.geschlecht as Pferd['geschlecht'],
      bemerkungen: editForm.bemerkungen,
    });
    setPferde(pferde.map(p => p.id === updatedPferd.id ? updatedPferd : p));
    setEditingPferd(null);
  };

  const cancelEditPferd = () => {
    setEditingPferd(null);
    setEditForm({ name: '', geburtsjahr: '', geschlecht: 'Stute', bemerkungen: '' });
  };

  const deletePferd = async (id: number) => {
    if (confirm('Wirklich löschen? Alle zugehörigen Termine werden ebenfalls gelöscht!')) {
      await window.api.deletePferd(id);
      setPferde(pferde.filter(p => p.id !== id));
    }
  };

  return (
    <div style={{ marginTop: 10, marginBottom: 20, padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#f9f9f9' }}>
      <h3 style={{ marginTop: 0, color: '#2c3e50' }}>🐴 Pferde</h3>
      
      {pferde.length === 0 ? (
        <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>Noch keine Pferde angelegt.</p>
      ) : (
        <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
          {pferde.map(p => (
            <div 
              key={p.id}
              style={{
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}
            >
              {editingPferd?.id === p.id ? (
                // Bearbeitungsmodus
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    placeholder="Name"
                    style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    value={editForm.geburtsjahr}
                    onChange={e => setEditForm({...editForm, geburtsjahr: e.target.value})}
                    placeholder="Geburtsjahr"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <select
                    value={editForm.geschlecht}
                    onChange={e => setEditForm({...editForm, geschlecht: e.target.value})}
                    style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="Stute">Stute</option>
                    <option value="Wallach">Wallach</option>
                    <option value="Hengst">Hengst</option>
                  </select>
                  <input
                    value={editForm.bemerkungen}
                    onChange={e => setEditForm({...editForm, bemerkungen: e.target.value})}
                    placeholder="Bemerkungen"
                    style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <button 
                    onClick={saveEditPferd}
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
                    onClick={cancelEditPferd}
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
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#2c3e50' }}>
                      {p.name}
                    </div>
                    <div style={{ color: '#7f8c8d', fontSize: '14px' }}>
                      {p.geschlecht} • {p.geburtsjahr ? `${p.geburtsjahr} (${p.alterJahre} Jahre)` : 'Alter unbekannt'}
                    </div>
                    {p.bemerkungen && (
                      <div style={{ color: '#95a5a6', fontSize: '13px', marginTop: '4px', fontStyle: 'italic' }}>
                        {p.bemerkungen}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button 
                      onClick={() => startEditPferd(p)}
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#3498db', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✏️ Bearbeiten
                    </button>
                    <button 
                      onClick={() => deletePferd(p.id)}
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#e74c3c', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px'
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
      )}
      
      {showForm ? (
        <div style={{ 
          padding: '15px', 
          border: '2px solid #3498db', 
          borderRadius: '8px', 
          backgroundColor: '#e8f4fd' 
        }}>
          <h4 style={{ marginTop: 0, color: '#2c3e50' }}>Neues Pferd anlegen</h4>
          <form onSubmit={addPferd}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: '10px', marginBottom: '10px' }}>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name des Pferdes"
                required
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <input
                value={form.geburtsjahr}
                onChange={e => setForm(f => ({ ...f, geburtsjahr: e.target.value }))}
                placeholder="Geburtsjahr"
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <select
                value={form.geschlecht}
                onChange={e => setForm(f => ({ ...f, geschlecht: e.target.value }))}
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="Stute">Stute</option>
                <option value="Wallach">Wallach</option>
                <option value="Hengst">Hengst</option>
              </select>
              <input
                value={form.bemerkungen}
                onChange={e => setForm(f => ({ ...f, bemerkungen: e.target.value }))}
                placeholder="Bemerkungen (optional)"
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
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
                🐴 Pferd anlegen
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: '#95a5a6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer' 
                }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button 
          onClick={() => setShowForm(true)}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#3498db', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          + Neues Pferd anlegen
        </button>
      )}
    </div>
  );
}
