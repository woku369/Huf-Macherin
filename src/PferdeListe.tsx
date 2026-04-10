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

interface BearbeitungsHistorieEintrag {
  terminId: number;
  datum: string;
  status: string;
  terminBemerkung: string | null;
  bearbeitung: string | null;
  bearbeitungsBemerkung: string | null;
  intervallTage: number | null;
  intervallWochen: number | null;
}

interface PferdHistorieGruppe {
  pferdId: number;
  pferdName: string;
  eintraege: BearbeitungsHistorieEintrag[];
  letzterTermin: string | null;
  durchschnittIntervallWochen: number | null;
}

export default function PferdeListe({ besitzerId }: { besitzerId: number }) {
  const [pferde, setPferde] = useState<Pferd[]>([]);
  const [historie, setHistorie] = useState<PferdHistorieGruppe[]>([]);
  const [historieLoading, setHistorieLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', geburtsjahr: '', geschlecht: 'Stute', bemerkungen: '' });
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'warning' | 'info'; message: string } | null>(null);
  const [pendingDeletePferdId, setPendingDeletePferdId] = useState<number | null>(null);
  
  // Bearbeitungsmodus
  const [editingPferd, setEditingPferd] = useState<Pferd | null>(null);
  const [editForm, setEditForm] = useState({ name: '', geburtsjahr: '', geschlecht: 'Stute', bemerkungen: '' });

  const loadPferde = async () => {
    const data = await window.api.listPferde(besitzerId);
    setPferde(data);
  };

  const loadHistorie = async () => {
    setHistorieLoading(true);
    try {
      const data = await window.api.getKundenHistorie(besitzerId);
      setHistorie(data);
    } finally {
      setHistorieLoading(false);
    }
  };

  useEffect(() => {
    loadPferde();
    loadHistorie();
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
    setNotice({ type: 'success', message: `Pferd "${neuesPferd.name}" wurde angelegt.` });
    await loadHistorie();
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
    setNotice({ type: 'success', message: `Pferd "${updatedPferd.name}" wurde gespeichert.` });
    await loadHistorie();
  };

  const cancelEditPferd = () => {
    setEditingPferd(null);
    setEditForm({ name: '', geburtsjahr: '', geschlecht: 'Stute', bemerkungen: '' });
  };

  const deletePferd = (id: number) => {
    setPendingDeletePferdId(id);
    setNotice({
      type: 'warning',
      message: 'Pferdelöschung vorgemerkt: Alle zugehörigen Termine werden ebenfalls gelöscht.'
    });
  };

  const confirmDeletePferd = async () => {
    if (!pendingDeletePferdId) return;
    const id = pendingDeletePferdId;
    await window.api.deletePferd(id);
    setPferde(pferde.filter(p => p.id !== id));
    setPendingDeletePferdId(null);
    setNotice({ type: 'success', message: 'Pferd wurde gelöscht.' });
    await loadHistorie();
  };

  const cancelDeletePferd = () => {
    setPendingDeletePferdId(null);
    setNotice({ type: 'info', message: 'Löschvorgang abgebrochen.' });
  };

  const formatDatum = (iso: string) => {
    const date = new Date(iso);
    return `${date.toLocaleDateString('de-AT')} ${date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div style={{ marginTop: 10, marginBottom: 20, padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#f9f9f9' }}>
      <h3 style={{ marginTop: 0, color: '#2c3e50' }}>🐴 Pferde</h3>

      {notice && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: `1px solid ${notice.type === 'error' ? '#c07d71' : notice.type === 'success' ? '#7f9b84' : notice.type === 'warning' ? '#ba9968' : '#8f9ea3'}`,
            backgroundColor: notice.type === 'error' ? '#f7ece9' : notice.type === 'success' ? '#e6efe8' : notice.type === 'warning' ? '#f5efdf' : '#e9eef0',
            color: notice.type === 'error' ? '#6e3429' : notice.type === 'success' ? '#2f4e36' : notice.type === 'warning' ? '#6e5129' : '#2f454b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <span>{notice.message}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {pendingDeletePferdId && notice.type === 'warning' && (
              <>
                <button type="button" onClick={confirmDeletePferd} style={{ padding: '6px 10px', backgroundColor: '#a55d4e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Löschen bestätigen
                </button>
                <button type="button" onClick={cancelDeletePferd} style={{ padding: '6px 10px', backgroundColor: '#8a8f8b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Abbrechen
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setPendingDeletePferdId(null);
              }}
              style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: '18px', lineHeight: 1, cursor: 'pointer' }}
              aria-label="Hinweis schließen"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
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

      <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #ddd6cb' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#2f3636' }}>Bearbeitungshistorie</h3>
        <p style={{ margin: '0 0 14px 0', color: '#6d665c', fontSize: '13px' }}>
          Verlauf je Pferd mit Abständen zwischen abgeschlossenen Bearbeitungsterminen und hinterlegten Bemerkungen.
        </p>

        {historieLoading ? (
          <div style={{ color: '#6d665c', fontSize: '13px' }}>Historie wird geladen...</div>
        ) : historie.length === 0 ? (
          <div style={{ color: '#6d665c', fontSize: '13px', fontStyle: 'italic' }}>
            Für diesen Kunden sind noch keine abgeschlossenen Hufbearbeitungen mit Historie vorhanden.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {historie.map((gruppe) => (
              <div
                key={gruppe.pferdId}
                style={{
                  border: '1px solid #ddd6cb',
                  borderRadius: '10px',
                  backgroundColor: '#fcfaf7',
                  padding: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#2f3636' }}>{gruppe.pferdName}</div>
                  <div style={{ fontSize: '12px', color: '#6d665c', display: 'flex', gap: '12px' }}>
                    <span>Letzter Termin: {gruppe.letzterTermin ? formatDatum(gruppe.letzterTermin) : '-'}</span>
                    <span>Ø Intervall: {gruppe.durchschnittIntervallWochen ? `${gruppe.durchschnittIntervallWochen} Wochen` : '-'}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  {gruppe.eintraege.map((eintrag) => (
                    <div
                      key={eintrag.terminId}
                      style={{
                        border: '1px solid #e5ded2',
                        borderRadius: '8px',
                        backgroundColor: 'white',
                        padding: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <strong style={{ color: '#2f3636' }}>{formatDatum(eintrag.datum)}</strong>
                        <span style={{ fontSize: '12px', color: '#6d665c' }}>
                          {eintrag.intervallWochen !== null
                            ? `Abstand: ${eintrag.intervallWochen} Wochen`
                            : 'Erster dokumentierter Eintrag'}
                        </span>
                      </div>

                      {(eintrag.bearbeitung || eintrag.bearbeitungsBemerkung || eintrag.terminBemerkung) ? (
                        <div style={{ fontSize: '13px', color: '#4a433a', display: 'grid', gap: '4px' }}>
                          {eintrag.bearbeitung && <div><strong>Bearbeitung:</strong> {eintrag.bearbeitung}</div>}
                          {eintrag.bearbeitungsBemerkung && <div><strong>Notiz:</strong> {eintrag.bearbeitungsBemerkung}</div>}
                          {eintrag.terminBemerkung && <div><strong>Termin:</strong> {eintrag.terminBemerkung}</div>}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#8a8f8b', fontStyle: 'italic' }}>
                          Keine Bemerkungen hinterlegt.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
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
