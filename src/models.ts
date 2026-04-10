// Datenmodelle für Die Huf-Macherin

export interface Kunde {
  id: number;
  name: string;
  adresse: string;
}

export type PferdeGeschlecht = 'Stute' | 'Wallach' | 'Hengst';

export interface Pferd {
  id: number;
  name: string;
  geburtsjahr?: number;
  alterJahre?: number;
  geschlecht: PferdeGeschlecht;
  bemerkungen?: string;
  besitzerId: number; // Kunde.id
}

export interface Termin {
  id: number;
  pferdId: number;
  datum: string; // ISO-String
  rechnung: boolean;
  bemerkung?: string;
}
