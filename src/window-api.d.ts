// Typdefinition für window.api im Renderer
export interface Kunde {
  id: number;
  name: string;
  vorname: string;
  adresse: string;
}

export interface Pferd {
  id: number;
  name: string;
  geburtsjahr?: number;
  alterJahre?: number;
  geschlecht: 'Stute' | 'Wallach' | 'Hengst';
  bemerkungen?: string;
  besitzerId: number;
}

export interface Hufbearbeitung {
  terminId: number;
  datum: string;
  bearbeitung: string;
  bemerkungen: string;
}

export interface BearbeitungsHistorieEintrag {
  terminId: number;
  datum: string;
  status: string;
  terminBemerkung: string | null;
  bearbeitung: string | null;
  bearbeitungsBemerkung: string | null;
  intervallTage: number | null;
  intervallWochen: number | null;
}

export interface PferdHistorieGruppe {
  pferdId: number;
  pferdName: string;
  eintraege: BearbeitungsHistorieEintrag[];
  letzterTermin: string | null;
  durchschnittIntervallWochen: number | null;
}

declare global {
  interface Window {
    api: {
      listKunden: () => Promise<Kunde[]>;
      addKunde: (kunde: Omit<Kunde, 'id'>) => Promise<Kunde>;
      updateKunde: (kunde: Kunde) => Promise<Kunde>;
      deleteKunde: (id: number) => Promise<boolean>;
      listPferde: (besitzerId: number) => Promise<Pferd[]>;
      addPferd: (pferd: Omit<Pferd, 'id'>) => Promise<Pferd>;
      updatePferd: (pferd: Pferd) => Promise<Pferd>;
      deletePferd: (id: number) => Promise<boolean>;
      getLastBearbeitung: (pferdId: number) => Promise<{datum: string, wochenSeither: number, status: string} | null>;
      getPferdHistorie: (pferdId: number) => Promise<BearbeitungsHistorieEintrag[]>;
      getKundenHistorie: (besitzerId: number) => Promise<PferdHistorieGruppe[]>;
      listTermine: (pferdId: number) => Promise<Termin[]>;
      addTermin: (termin: Omit<Termin, 'id'>) => Promise<Termin>;
      addMultipleTermine: (terminDaten: {pferdIds: number[], datum: string, ende?: string | null, bemerkung: string, titel?: string, status?: string}) => Promise<any[]>;
      deleteTermin: (id: number) => Promise<boolean>;
      updateTermin: (termin: Termin) => Promise<boolean>;
      listAlleTermine: () => Promise<any[]>;
      googleLogin: () => Promise<boolean>;
      googleAuthCode: (code: string) => Promise<boolean>;
      googleIsLoggedIn: () => Promise<boolean>;
      googleExportTermin: (termin: { titel: string; bemerkung?: string; datum: string; }) => Promise<boolean>;
      hufbearbeitung: {
        add: (bearbeitung: Hufbearbeitung) => Promise<{ success: boolean; id?: number }>;
        list: (terminId: number) => Promise<Hufbearbeitung[]>;
      };
      termine: {
        updateStatus: (terminId: number, status: string) => Promise<boolean>;
        abschliessen: (terminId: number, folgeWochen: number) => Promise<boolean>;
      };
    };
  }
}
