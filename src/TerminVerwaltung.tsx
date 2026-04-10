import { useEffect, useState } from 'react';

interface Pferd {
  id: number;
  name: string;
}

import TerminListe from './TerminListe';

export default function TerminVerwaltung({ besitzerId }: { besitzerId: number }) {
  const [pferde, setPferde] = useState<Pferd[]>([]);

  useEffect(() => {
    window.api.listPferde(besitzerId).then(setPferde);
  }, [besitzerId]);

  if (pferde.length === 0) return null;

  return (
    <div style={{ marginTop: 30 }}>
      <h2>Termine verwalten</h2>
      <TerminListe pferde={pferde} />
    </div>
  );
}
