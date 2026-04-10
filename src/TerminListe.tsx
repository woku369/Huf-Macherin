import { useEffect, useState } from 'react';

interface Termin {
  id: number;
  pferdId: number;
  datum: string; // ISO-String
  rechnung: boolean;
  bemerkung?: string;
}

interface Pferd {
  id: number;
  name: string;
}

export default function TerminListe({ pferde }: { pferde: Pferd[] }) {
  const [termine, setTermine] = useState<Termin[]>([]);
  const [selectedPferd, setSelectedPferd] = useState<Pferd | null>(null);
  const [datum, setDatum] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  const [rechnung, setRechnung] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDatum, setEditDatum] = useState('');
  const [editBemerkung, setEditBemerkung] = useState('');
  const [editRechnung, setEditRechnung] = useState(false);

  useEffect(() => {
    if (selectedPferd) {
      window.api.listTermine(selectedPferd.id).then(setTermine);
    } else {
      setTermine([]);
    }
  }, [selectedPferd]);

  const addTermin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPferd || !datum) return;
    const neuerTermin = await window.api.addTermin({
      pferdId: selectedPferd.id,
      datum,
      rechnung,
      bemerkung
    });
    setTermine([...termine, neuerTermin]);
    setDatum('');
    setBemerkung('');
    setRechnung(false);
  };

  const startEdit = (t: Termin) => {
    setEditId(t.id);
    setEditDatum(t.datum);
    setEditBemerkung(t.bemerkung || '');
    setEditRechnung(t.rechnung);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId == null) return;
    const tOld = termine.find(t => t.id === editId);
    if (!tOld) return;
    await window.api.updateTermin({ id: editId, pferdId: tOld.pferdId, datum: editDatum, bemerkung: editBemerkung, rechnung: editRechnung });
    setTermine(termine.map(t => t.id === editId ? { ...t, datum: editDatum, bemerkung: editBemerkung, rechnung: editRechnung } : t));
    setEditId(null);
  };

  const deleteTermin = async (id: number) => {
    await window.api.deleteTermin(id);
    setTermine(termine.filter(t => t.id !== id));
  };

  return (
    <div style={{ marginTop: 10, padding: 10, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3>Termine</h3>
      <div>
        <label>Pferd auswählen: </label>
        <select value={selectedPferd?.id || ''} onChange={e => {
          const p = pferde.find(p => p.id === Number(e.target.value));
          setSelectedPferd(p || null);
        }}>
          <option value="">--</option>
          {pferde.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {selectedPferd && (
        <form onSubmit={addTermin} style={{ marginTop: 10 }}>
          <input
            type="date"
            value={datum}
            onChange={e => setDatum(e.target.value)}
            required
          />
          <input
            value={bemerkung}
            onChange={e => setBemerkung(e.target.value)}
            placeholder="Bemerkung"
          />
          <label style={{ marginLeft: 10 }}>
            <input
              type="checkbox"
              checked={rechnung}
              onChange={e => setRechnung(e.target.checked)}
            /> Rechnung gestellt
          </label>
          <button type="submit" style={{ marginLeft: 10 }}>Termin anlegen</button>
        </form>
      )}
      <ul style={{ marginTop: 15 }}>
        {termine.map(t => (
          <li key={t.id}>
            {editId === t.id ? (
              <form onSubmit={saveEdit} style={{ display: 'inline' }}>
                <input type="date" value={editDatum} onChange={e => setEditDatum(e.target.value)} required />
                <input value={editBemerkung} onChange={e => setEditBemerkung(e.target.value)} placeholder="Bemerkung" />
                <label style={{ marginLeft: 10 }}>
                  <input type="checkbox" checked={editRechnung} onChange={e => setEditRechnung(e.target.checked)} /> Rechnung gestellt
                </label>
                <button type="submit">Speichern</button>
                <button type="button" onClick={() => setEditId(null)}>Abbrechen</button>
              </form>
            ) : (
              <>
                {t.datum} {t.bemerkung && `– ${t.bemerkung}`} {t.rechnung ? '✅' : ''}
                <button onClick={() => startEdit(t)} style={{ marginLeft: 10 }}>Bearbeiten</button>
                <button onClick={() => deleteTermin(t.id)} style={{ marginLeft: 5 }}>Löschen</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
