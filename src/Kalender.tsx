import { useMemo, useRef, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Kalender.css';
import { format, parse, startOfWeek, getDay, getWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface TerminEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any;
}

const locales = {
  'de': de,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Berechnung österreichischer Feiertage (feste + bewegliche)
function getAustrianHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const toKey = (d: Date) => d.toISOString().slice(0, 10);

  // Feste Feiertage
  const fixed: [number, number, string][] = [
    [1,  1,  'Neujahr'],
    [6,  1,  'Heilige Drei Könige'],
    [1,  5,  'Staatsfeiertag'],
    [15, 8,  'Mariä Himmelfahrt'],
    [26, 10, 'Nationalfeiertag'],
    [1,  11, 'Allerheiligen'],
    [8,  12, 'Mariä Empfängnis'],
    [25, 12, 'Weihnachten'],
    [26, 12, 'Stephanitag'],
  ];
  for (const [day, month, name] of fixed) {
    holidays.set(toKey(new Date(year, month - 1, day)), name);
  }

  // Osterberechnung (Gauss-Algorithmus)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const easterDay  = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, easterMonth, easterDay);

  const easterBased: [number, string][] = [
    [-2,  'Karfreitag'],
    [0,   'Ostersonntag'],
    [1,   'Ostermontag'],
    [39,  'Christi Himmelfahrt'],
    [49,  'Pfingstsonntag'],
    [50,  'Pfingstmontag'],
    [60,  'Fronleichnam'],
  ];
  for (const [offset, name] of easterBased) {
    const d = new Date(easter);
    d.setDate(d.getDate() + offset);
    holidays.set(toKey(d), name);
  }

  return holidays;
}

interface KalenderProps {
  termine: any[];
  onSelectDate?: (date: Date) => void;
  onTermineChange?: () => Promise<void>;
}

export default function Kalender({ termine, onSelectDate, onTermineChange }: KalenderProps) {
  type NoticeType = 'error' | 'success' | 'info';
  type TerminTyp = 'hufbearbeitung' | 'reitstunde' | 'eigener_termin';

  const [selectedEvent, setSelectedEvent] = useState<TerminEvent | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipBearbeitung, setTooltipBearbeitung] = useState<any[] | null>(null);
  const [pendingDeleteTerminId, setPendingDeleteTerminId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Hufbearbeitungs-Abschlussmaske
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTermin, setEditingTermin] = useState<any>(null);

  // Termin-Edit-Modal (allgemein)
  const [showTerminEditModal, setShowTerminEditModal] = useState(false);
  const [terminEditData, setTerminEditData] = useState({
    id: 0,
    typ: 'hufbearbeitung' as 'hufbearbeitung' | 'reitstunde' | 'eigener_termin',
    datum: '',
    uhrzeit: '09:00',
    bisUhrzeit: '',
    bemerkung: '',
    titelManuell: '',
  });
  const [bearbeitungsDaten, setBearbeitungsDaten] = useState({
    bearbeitung: '',
    bemerkungen: '',
    naechsterTermin: '4' // Wochen
  });
  
  // Pferd-Anlegen-Formular
  const [showPferdForm, setShowPferdForm] = useState(false);
  const [pferdFormData, setPferdFormData] = useState({
    name: '',
    geburtsjahr: '',
    geschlecht: 'Stute',
    bemerkungen: ''
  });

  // Kunden-Anlegen-Formular
  const [showKundeForm, setShowKundeForm] = useState(false);
  const [kundeFormData, setKundeFormData] = useState({
    name: '',
    vorname: '',
    adresse: ''
  });
  
  // Kunden- und Pferde-Daten
  const [kunden, setKunden] = useState<any[]>([]);
  const [verfuegbarePferde, setVerfuegbarePferde] = useState<any[]>([]);
  const [pferdeDetails, setPferdeDetails] = useState<{[key: number]: any}>({});
  
  const [createFormData, setCreateFormData] = useState({
    titel: '',
    kundeId: '',
    ausgewaehltePferde: [] as number[],
    bemerkung: '',
    uhrzeit: '09:00',
    bisUhrzeit: '10:00',
    typ: 'hufbearbeitung' as 'hufbearbeitung' | 'reitstunde' | 'eigener_termin'
  });

  // Österreichische Feiertage für aktuelles + nächstes Jahr
  const holidays = useMemo(() => {
    const year = new Date().getFullYear();
    const map = new Map([...getAustrianHolidays(year), ...getAustrianHolidays(year + 1)]);
    return map;
  }, []);

  const getHoliday = (date: Date): string | undefined =>
    holidays.get(date.toISOString().slice(0, 10));

  const events: TerminEvent[] = useMemo(() =>
    termine.map((t: any) => {
      const typ = t.typ || 'hufbearbeitung';
      const kundeName = t.besitzerName ? `${t.besitzerName} ${t.besitzerVorname || ''}`.trim() : null;
      const pferdName = t.pferdName || null;

      let displayTitle: string;
      if (typ === 'eigener_termin') {
        displayTitle = t.titelManuell || t.bemerkung || 'Eigener Termin';
      } else if (typ === 'reitstunde') {
        displayTitle = kundeName ? `🏇 ${kundeName}` : '🏇 Reitstunde';
      } else {
        // hufbearbeitung
        if (kundeName && pferdName) {
          displayTitle = `${kundeName} (${pferdName})`;
        } else {
          displayTitle = t.titelText || t.beschreibung || 'Termin';
        }
      }
      
      return {
        id: t.id,
        title: displayTitle,
        start: new Date(t.datum),
        end: t.ende ? new Date(t.ende) : new Date(t.datum),
        allDay: !t.ende,
        resource: t,
      };
    }),
    [termine]
  );

  const kalenderRef = useRef<HTMLDivElement>(null);

  // Generiere Uhrzeitoptionen in 15-Minuten-Schritten
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message });
  };

  const getTerminTyp = (resource: any): TerminTyp => {
    const typ = resource?.typ;
    if (typ === 'reitstunde' || typ === 'eigener_termin') {
      return typ;
    }
    return 'hufbearbeitung';
  };

  const getStatusConfig = (status: string, terminTyp: TerminTyp) => {
    if (terminTyp === 'reitstunde') {
      if (status === 'abgehalten') return { label: 'Abgehalten', color: '#6c8a70' };
      if (status === 'abgesagt') return { label: 'Abgesagt', color: '#a55d4e' };
      return { label: 'Geplant', color: '#a67c52' };
    }

    if (terminTyp === 'eigener_termin') {
      return { label: 'Fixtermin', color: '#8b5e4e' };
    }

    if (status === 'abgeschlossen') return { label: 'Abgeschlossen', color: '#6c8a70' };
    if (status === 'vorschlag') return { label: 'Vorschlag', color: '#b39563' };
    if (status === 'vorreserviert') return { label: 'Vorreserviert', color: '#8a7d90' };
    if (status === 'bestätigt') return { label: 'Bestätigt', color: '#5f7f86' };
    return { label: status || 'Geplant', color: '#8a8f8b' };
  };

  const getStatusActions = (terminTyp: TerminTyp) => {
    if (terminTyp === 'eigener_termin') return [] as Array<{ value: string; label: string; color: string }>;
    if (terminTyp === 'reitstunde') {
      return [
        { value: 'geplant', label: 'Geplant', color: '#a67c52' },
        { value: 'abgehalten', label: 'Abgehalten', color: '#6c8a70' },
        { value: 'abgesagt', label: 'Abgesagt', color: '#a55d4e' }
      ];
    }
    return [
      { value: 'vorreserviert', label: 'Vorreserviert', color: '#8a7d90' },
      { value: 'bestätigt', label: 'Bestätigen', color: '#5f7f86' },
      { value: 'abgeschlossen', label: 'Abschließen', color: '#6c8a70' },
      { value: 'vorschlag', label: 'Als Vorschlag', color: '#b39563' }
    ];
  };

  // Lade Kunden beim Mount
  useEffect(() => {
    const loadKunden = async () => {
      try {
        const alleKunden = await window.api.listKunden();
        setKunden(alleKunden);
      } catch (error) {
        console.error('Fehler beim Laden der Kunden:', error);
      }
    };
    loadKunden();
  }, []);

  // Lade Pferde wenn Kunde ausgewählt wird
  useEffect(() => {
    const loadPferde = async () => {
      if (createFormData.kundeId) {
        try {
          const pferde = await window.api.listPferde(parseInt(createFormData.kundeId));
          setVerfuegbarePferde(pferde);
          
          // Lade Details für jedes Pferd (letzte Bearbeitung)
          const details: {[key: number]: any} = {};
          for (const pferd of pferde) {
            try {
              const lastBearbeitung = await window.api.getLastBearbeitung(pferd.id);
              details[pferd.id] = {
                ...pferd,
                lastBearbeitung
              };
            } catch (error) {
              console.error(`Fehler beim Laden der letzten Bearbeitung für Pferd ${pferd.id}:`, error);
              details[pferd.id] = {
                ...pferd,
                lastBearbeitung: null
              };
            }
          }
          setPferdeDetails(details);
        } catch (error) {
          console.error('Fehler beim Laden der Pferde:', error);
          setVerfuegbarePferde([]);
          setPferdeDetails({});
        }
      } else {
        setVerfuegbarePferde([]);
        setPferdeDetails({});
        setCreateFormData(prev => ({ ...prev, ausgewaehltePferde: [] }));
      }
    };
    loadPferde();
  }, [createFormData.kundeId]);

  // Lade Hufbearbeitungsnotizen wenn Tooltip auf abgeschlossene Hufbearbeitung öffnet
  useEffect(() => {
    if (showTooltip && selectedEvent) {
      const typ = selectedEvent.resource?.typ || 'hufbearbeitung';
      if (typ === 'hufbearbeitung' && selectedEvent.resource?.status === 'abgeschlossen') {
        window.api.hufbearbeitung.list(selectedEvent.id)
          .then(list => setTooltipBearbeitung(list))
          .catch(() => setTooltipBearbeitung(null));
      } else {
        setTooltipBearbeitung(null);
      }
    } else {
      setTooltipBearbeitung(null);
      setPendingDeleteTerminId(null);
    }
  }, [showTooltip, selectedEvent?.id]);

  // Keine automatische Zeitberechnung mehr - Endzeit ist optional und manuell

  // Benutzerdefinierte Toolbar mit Kalenderwochen-Anzeige
  const CustomToolbar = ({ date, onNavigate, onView, view }: any) => {
    const currentWeek = getWeek(date, { locale: de, weekStartsOn: 1 });
    
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px',
        padding: '10px 0',
        borderBottom: '1px solid #e1e8ed'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => onNavigate('PREV')}
            style={{ 
              padding: '8px 12px',
              backgroundColor: '#5f7f86',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ‹ Zurück
          </button>
          <button 
            onClick={() => onNavigate('TODAY')}
            style={{ 
              padding: '8px 12px',
              backgroundColor: '#2f3636',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Heute
          </button>
          <button 
            onClick={() => onNavigate('NEXT')}
            style={{ 
              padding: '8px 12px',
              backgroundColor: '#5f7f86',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Weiter ›
          </button>
        </div>
        
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: '#2f3636',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <span>{format(date, 'MMMM yyyy', { locale: de })}</span>
          {view === 'month' && (
            <span style={{ 
              fontSize: '14px', 
              backgroundColor: '#e7edea',
              padding: '4px 8px',
              borderRadius: '4px',
              color: '#5f7f86'
            }}>
              KW {currentWeek}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onView('month')}
            style={{
              padding: '8px 12px',
              backgroundColor: view === 'month' ? '#6c8a70' : '#8a8f8b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Monat
          </button>
          <button
            onClick={() => onView('week')}
            style={{
              padding: '8px 12px',
              backgroundColor: view === 'week' ? '#6c8a70' : '#8a8f8b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Woche
          </button>
          <button
            onClick={() => onView('day')}
            style={{
              padding: '8px 12px',
              backgroundColor: view === 'day' ? '#6c8a70' : '#8a8f8b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Tag
          </button>
        </div>
      </div>
    );
  };

  // Verbesserte Custom Event Component mit echtem Mouseover
  const CustomEvent = ({ event }: { event: TerminEvent }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const handleMouseEnter = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setSelectedEvent(event);
      setTooltipPosition({ 
        x: rect.left + rect.width / 2, 
        y: rect.top - 10 
      });
      setShowTooltip(true);
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      // Kurzer Delay, damit der Benutzer zum Tooltip wechseln kann
      setTimeout(() => {
        setIsHovered(false);
      }, 100);
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setSelectedEvent(event);
      setTooltipPosition({ 
        x: rect.left + rect.width / 2, 
        y: rect.top - 10 
      });
      setShowTooltip(true);
    };

    return (
      <div
        style={{
          height: '100%',
          padding: '2px 5px',
          fontSize: '12px',
          cursor: 'pointer',
          backgroundColor: isHovered ? 'rgba(255,255,255,0.2)' : 'transparent',
          borderRadius: '3px',
          transition: 'background-color 0.2s ease'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {event.title}
      </div>
    );
  };

  const handlePdfExport = async () => {
    if (!kalenderRef.current) return;
    const canvas = await html2canvas(kalenderRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.save('kalender.pdf');
  };

  const handleGoogleExport = async () => {
    try {
      const isLoggedIn = await window.api.googleIsLoggedIn();
      if (!isLoggedIn) {
        showNotice('info', 'Browser wird geöffnet – bitte Google-Anmeldung im Browser abschließen...');
        await window.api.googleLogin();
        showNotice('success', 'Google-Anmeldung erfolgreich.');
      }
      await doGoogleExport();
    } catch (error) {
      showNotice('error', `Fehler: ${String(error)}`);
    }
  };

  const doGoogleExport = async () => {
    try {
      let exported = 0;
      let skipped  = 0;
      for (const t of termine) {
        if (t.googleExportiert) { skipped++; continue; }
        await window.api.googleExportTermin({
          terminId: t.id,
          titel: t.titelManuell || t.pferdName || t.besitzerName || 'Termin',
          bemerkung: t.bemerkung,
          datum: t.datum,
          ende: t.ende,
          typ: t.typ || 'hufbearbeitung',
        });
        exported++;
      }
      const msg = skipped > 0
        ? `${exported} Termin(e) exportiert, ${skipped} bereits exportiert (übersprungen).`
        : `${exported} Termin(e) an Google Kalender übertragen.`;
      showNotice('success', msg);
      if (onTermineChange) await onTermineChange();
    } catch (error) {
      showNotice('error', `Fehler beim Export: ${String(error)}`);
    }
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setSelectedDate(start);
    const startTime = format(start, 'HH:mm');
    
    setCreateFormData({
      titel: '',
      kundeId: '',
      ausgewaehltePferde: [],
      bemerkung: '',
      uhrzeit: startTime,
      bisUhrzeit: '', // Leer lassen für optionale Endzeit
      typ: 'hufbearbeitung'
    });
    setShowCreateForm(true);
    
    // Rufe auch die ursprüngliche onSelectDate Funktion auf, falls vorhanden
    if (onSelectDate) {
      onSelectDate(start);
    }
  };

  const handleCreateTermin = async () => {
    // Validierung je nach Typ
    if (!selectedDate) {
      showNotice('error', 'Kein Datum ausgewählt.');
      return;
    }
    
    if (createFormData.typ !== 'eigener_termin' && !createFormData.kundeId.trim()) {
      showNotice('error', 'Bitte einen Kunden auswählen.');
      return;
    }

    if (createFormData.typ === 'hufbearbeitung' && createFormData.ausgewaehltePferde.length === 0) {
      showNotice('error', 'Bitte mindestens ein Pferd auswählen.');
      return;
    }

    if (createFormData.typ === 'eigener_termin' && !createFormData.titel.trim()) {
      showNotice('error', 'Bitte einen Titel für den eigenen Termin eingeben.');
      return;
    }

    try {
      // Kombiniere Datum und Uhrzeiten
      const [startHours, startMinutes] = createFormData.uhrzeit.split(':');
      
      const terminStart = new Date(selectedDate);
      terminStart.setHours(parseInt(startHours), parseInt(startMinutes), 0, 0);
      
      let terminEnde = null;
      if (createFormData.bisUhrzeit.trim()) {
        const [endHours, endMinutes] = createFormData.bisUhrzeit.split(':');
        terminEnde = new Date(selectedDate);
        terminEnde.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
      }

      // Finde Kunde und Pferde für Anzeige
      const ausgewaehlterKunde = kunden.find(k => k.id === parseInt(createFormData.kundeId));
      const ausgewaehltePferdeNames = createFormData.ausgewaehltePferde.map(pId => 
        verfuegbarePferde.find(p => p.id === pId)?.name || 'Unbekannt'
      ).join(', ');

      // Automatischer Titel falls leer - Format: "Kunde (Pferd1, Pferd2)"
      const terminTitel = createFormData.titel.trim() || 
                         `${ausgewaehlterKunde?.name || 'Kunde'} (${ausgewaehltePferdeNames})`;

      // Erstelle Termine für alle ausgewählten Pferde mit Status "vorreserviert"
      const terminDaten = {
        pferdIds: createFormData.typ === 'hufbearbeitung' ? createFormData.ausgewaehltePferde : [],
        kundeId: createFormData.kundeId ? parseInt(createFormData.kundeId) : null,
        datum: terminStart.toISOString(),
        ende: terminEnde ? terminEnde.toISOString() : null,
        bemerkung: createFormData.bemerkung,
        titel: terminTitel,
        status: createFormData.typ === 'eigener_termin' ? 'bestaetigt' : 'vorreserviert',
        typ: createFormData.typ,
        titelManuell: createFormData.typ === 'eigener_termin' ? createFormData.titel : null
      };

      await window.api.addMultipleTermine(terminDaten);
      
      const zeitText = terminEnde 
        ? `${format(terminStart, 'HH:mm')} bis ${format(terminEnde, 'HH:mm')}`
        : `ab ${format(terminStart, 'HH:mm')}`;
      
      const erstelltCount = createFormData.typ === 'hufbearbeitung' ? createFormData.ausgewaehltePferde.length : 1;
      showNotice(
        'success',
        `${erstelltCount} Termin(e) gespeichert: ${format(terminStart, 'dd.MM.yyyy')} (${zeitText})`
      );

      // Schließe das Formular
      setShowCreateForm(false);
      setCreateFormData({
        titel: '',
        kundeId: '',
        ausgewaehltePferde: [],
        bemerkung: '',
        uhrzeit: '09:00',
        bisUhrzeit: '',
        typ: 'hufbearbeitung'
      });

      // Aktualisiere Termine falls Callback vorhanden
      if (onTermineChange) {
        await onTermineChange();
      }

    } catch (error) {
      showNotice('error', `Fehler beim Erstellen der Termine: ${String(error)}`);
    }
  };

  const formatEventDetails = (event: TerminEvent) => {
    const resource = event.resource;
    return {
      kunde: resource.besitzerName ? `${resource.besitzerName} ${resource.besitzerVorname || ''}`.trim() : 'Unbekannt',
      pferd: resource.pferdName || 'Unbekannt',
      datum: format(event.start, 'dd.MM.yyyy HH:mm', { locale: de }),
      bemerkung: resource.bemerkung || 'Keine Bemerkungen',
      status: resource.status || 'geplant',
      typ: getTerminTyp(resource)
    };
  };

  // Status-Änderung mit automatischer Bearbeitungsmaske
  const handleStatusChange = async (terminId: number, newStatus: string, terminTyp: TerminTyp) => {
    try {
      // "Abschließen" → erst Bearbeitungsmaske öffnen, Status wird dort gesetzt
      if (terminTyp === 'hufbearbeitung' && newStatus === 'abgeschlossen') {
        const termin = termine.find(t => t.id === terminId);
        if (termin) {
          setEditingTermin(termin);
          setBearbeitungsDaten({
            bearbeitung: '',
            bemerkungen: '',
            naechsterTermin: '4'
          });
          setShowEditForm(true);
          setShowTooltip(false);
          setSelectedEvent(null);
          return; // Status wird erst beim Speichern der Bearbeitung gesetzt
        }
      }

      // Alle anderen Status: sofort setzen
      await window.api.termine.updateStatus(terminId, newStatus);

      // Tooltip schließen
      setShowTooltip(false);
      setSelectedEvent(null);

      // Termine aktualisieren
      if (onTermineChange) {
        await onTermineChange();
      }

    } catch (error) {
      showNotice('error', `Fehler beim Ändern des Status: ${String(error)}`);
    }
  };

  const handleOpenTerminEdit = (event: TerminEvent) => {
    const r = event.resource;
    const start = new Date(r.datum);
    const ende = r.ende ? new Date(r.ende) : null;
    setTerminEditData({
      id: r.id,
      typ: getTerminTyp(r),
      datum: format(start, 'yyyy-MM-dd'),
      uhrzeit: format(start, 'HH:mm'),
      bisUhrzeit: ende ? format(ende, 'HH:mm') : '',
      bemerkung: r.bemerkung || '',
      titelManuell: r.titelManuell || '',
    });
    setShowTerminEditModal(true);
    setShowTooltip(false);
    setSelectedEvent(null);
  };

  const handleSaveTerminEdit = async () => {
    try {
      const [h, m] = terminEditData.uhrzeit.split(':');
      const newStart = new Date(terminEditData.datum);
      newStart.setHours(parseInt(h), parseInt(m), 0, 0);

      let newEnde: string | null = null;
      if (terminEditData.bisUhrzeit.trim()) {
        const [eh, em] = terminEditData.bisUhrzeit.split(':');
        const e = new Date(terminEditData.datum);
        e.setHours(parseInt(eh), parseInt(em), 0, 0);
        newEnde = e.toISOString();
      }

      await window.api.updateTermin({
        id: terminEditData.id,
        datum: newStart.toISOString(),
        ende: newEnde,
        bemerkung: terminEditData.bemerkung,
        titelManuell: terminEditData.titelManuell || null,
      } as any);

      setShowTerminEditModal(false);
      showNotice('success', 'Termin wurde gespeichert.');
      if (onTermineChange) await onTermineChange();
    } catch (error) {
      showNotice('error', `Fehler beim Speichern: ${String(error)}`);
    }
  };

  const handleDeleteTermin = (terminId: number) => {
    setPendingDeleteTerminId(terminId);
  };

  const confirmDeleteTermin = async () => {
    if (!pendingDeleteTerminId) return;
    try {
      await window.api.deleteTermin(pendingDeleteTerminId);
      setPendingDeleteTerminId(null);
      setShowTooltip(false);
      setSelectedEvent(null);
      showNotice('success', 'Termin wurde gelöscht.');
      if (onTermineChange) await onTermineChange();
    } catch (error) {
      showNotice('error', `Fehler beim Löschen des Termins: ${String(error)}`);
    }
  };

  // Neues Pferd anlegen
  const handleCreateKunde = async () => {
    if (!kundeFormData.name.trim()) {
      showNotice('error', 'Bitte einen Nachnamen eingeben.');
      return;
    }
    try {
      const neuerKunde = await window.api.addKunde({
        name: kundeFormData.name,
        vorname: kundeFormData.vorname,
        adresse: kundeFormData.adresse
      });
      // Kunden-Liste aktualisieren
      const updatedKunden = await window.api.listKunden();
      setKunden(updatedKunden);
      // Neuen Kunden automatisch auswählen
      setCreateFormData(prev => ({ ...prev, kundeId: String(neuerKunde.id) }));
      // Pferde für neuen Kunden laden (leer)
      setVerfuegbarePferde([]);
      // Formular zurücksetzen und schließen
      setKundeFormData({ name: '', vorname: '', adresse: '' });
      setShowKundeForm(false);
    } catch (error) {
      showNotice('error', `Fehler beim Anlegen des Kunden: ${String(error)}`);
    }
  };

  const handleCreatePferd = async () => {
    if (!createFormData.kundeId) {
      showNotice('error', 'Bitte zuerst einen Kunden auswählen.');
      return;
    }
    
    if (!pferdFormData.name.trim()) {
      showNotice('error', 'Bitte einen Namen für das Pferd eingeben.');
      return;
    }

    try {
      const alterJahre = pferdFormData.geburtsjahr ? new Date().getFullYear() - Number(pferdFormData.geburtsjahr) : undefined;
      
      const neuesPferd = await window.api.addPferd({
        name: pferdFormData.name,
        geburtsjahr: pferdFormData.geburtsjahr ? Number(pferdFormData.geburtsjahr) : undefined,
        alterJahre,
        geschlecht: pferdFormData.geschlecht as 'Stute' | 'Wallach' | 'Hengst',
        bemerkungen: pferdFormData.bemerkungen,
        besitzerId: parseInt(createFormData.kundeId)
      });

      // Pferde-Liste aktualisieren
      const updatedPferde = await window.api.listPferde(parseInt(createFormData.kundeId));
      setVerfuegbarePferde(updatedPferde);
      
      // Neues Pferd automatisch auswählen
      setCreateFormData(prev => ({
        ...prev,
        ausgewaehltePferde: [...prev.ausgewaehltePferde, neuesPferd.id]
      }));

      // Formular zurücksetzen und schließen
      setPferdFormData({
        name: '',
        geburtsjahr: '',
        geschlecht: 'Stute',
        bemerkungen: ''
      });
      setShowPferdForm(false);

      showNotice('success', `Pferd "${neuesPferd.name}" wurde angelegt und ausgewählt.`);

    } catch (error) {
      showNotice('error', `Fehler beim Anlegen des Pferdes: ${String(error)}`);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {notice && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: `1px solid ${notice.type === 'error' ? '#c07d71' : notice.type === 'success' ? '#7f9b84' : '#8f9ea3'}`,
            backgroundColor: notice.type === 'error' ? '#f7ece9' : notice.type === 'success' ? '#e6efe8' : '#e9eef0',
            color: notice.type === 'error' ? '#6e3429' : notice.type === 'success' ? '#2f4e36' : '#2f454b',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px',
            alignItems: 'center'
          }}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
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
      )}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={handlePdfExport} 
            style={{ 
              padding: '10px 15px',
              backgroundColor: '#a55d4e',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            📄 Kalender als PDF exportieren
          </button>
          <button 
            onClick={handleGoogleExport} 
            style={{ 
              padding: '10px 15px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            📅 Zu Google Kalender exportieren
          </button>
          {onTermineChange && (
            <button 
              onClick={onTermineChange} 
              style={{ 
                padding: '10px 15px',
                backgroundColor: '#6c8a70',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              🔄 Termine aktualisieren
            </button>
          )}
        </div>
        
        {/* Termin-Status Legende */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
          <span style={{ color: '#737873', fontWeight: 'bold' }}>Status:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#8a7d90', borderRadius: '2px' }}></div>
            <span>Vorreserviert</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#5f7f86', borderRadius: '2px' }}></div>
            <span>Bestätigt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#6c8a70', borderRadius: '2px' }}></div>
            <span>Abgeschlossen</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#b39563', borderRadius: '2px' }}></div>
            <span>Vorschlag</span>
          </div>
        </div>
      </div>
      
      <div ref={kalenderRef} style={{ height: 600, margin: '20px 0', position: 'relative' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          defaultView={Views.MONTH}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          components={{
            event: CustomEvent,
            toolbar: CustomToolbar,
            month: {
              dateHeader: ({ date, label }: { date: Date; label: string }) => {
                const holiday = getHoliday(date);
                return (
                  <div style={{ position: 'relative' }}>
                    <span>{label}</span>
                    {holiday && (
                      <span
                        title={holiday}
                        style={{
                          display: 'block',
                          fontSize: '9px',
                          color: '#7a5230',
                          fontWeight: 600,
                          lineHeight: 1.1,
                          maxWidth: '52px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'default'
                        }}
                      >
                        {holiday}
                      </span>
                    )}
                  </div>
                );
              }
            }
          }}
          dayPropGetter={(date) => {
            const holiday = getHoliday(date);
            if (holiday) {
              return { style: { backgroundColor: '#fdf4e7' } };
            }
            return {};
          }}
          messages={{
            month: 'Monat',
            week: 'Woche', 
            day: 'Tag',
            today: 'Heute',
            previous: 'Zurück',
            next: 'Weiter',
            showMore: (total) => `+ ${total} weitere`,
            date: 'Datum',
            time: 'Zeit',
            event: 'Termin',
            allDay: 'Ganztägig',
            noEventsInRange: 'Keine Termine in diesem Zeitraum',
            agenda: 'Agenda',
            work_week: 'Arbeitswoche'
          }}
          style={{ 
            background: 'white', 
            borderRadius: 8, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '20px'
          }}
          eventPropGetter={(event) => {
            const typ = event.resource?.typ || 'hufbearbeitung';
            const status = event.resource?.status;
            let bg: string;
            if (typ === 'eigener_termin') {
              bg = '#8b5e4e';
            } else if (typ === 'reitstunde') {
              bg = status === 'abgeschlossen' ? '#8f6a46' : '#a67c52';
            } else {
              // hufbearbeitung
              bg = status === 'abgeschlossen' ? '#6c8a70' :
                   status === 'vorschlag'     ? '#b39563' :
                   status === 'vorreserviert' ? '#8a7d90' :
                   status === 'bestätigt'     ? '#5f7f86' : '#8a8f8b';
            }
            return {
              style: {
                backgroundColor: bg,
                borderRadius: '3px',
                opacity: 0.85,
                color: 'white',
                border: '0px',
                display: 'block'
              }
            };
          }}
        />
      </div>

      {/* Verbesserter Tooltip für Event-Details */}
      {showTooltip && selectedEvent && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(10, Math.min(tooltipPosition.x - 150, window.innerWidth - 320)),
            top: Math.max(10, Math.min(tooltipPosition.y - 200, window.innerHeight - 400)),
            backgroundColor: '#2f3636',
            color: 'white',
            borderRadius: '8px',
            padding: '15px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 1000,
            width: '300px',
            fontSize: '14px',
            border: '2px solid #3d4746',
            maxHeight: '520px',
            overflow: 'auto'
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => {
            setShowTooltip(false);
            setSelectedEvent(null);
          }}
        >
          {(() => {
            const currentEvent = selectedEvent;
            if (!currentEvent) return null;
            
            const details = formatEventDetails(currentEvent);
            const statusConfig = getStatusConfig(details.status, details.typ);
            const statusActions = getStatusActions(details.typ);
            const typLabel = details.typ === 'hufbearbeitung' ? 'Hufbearbeitung' : details.typ === 'reitstunde' ? 'Reitstunde' : 'Eigener Termin';
            return (
              <>
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '12px', 
                  color: '#f1ece4',
                  fontSize: '16px',
                  borderBottom: '1px solid #3d4746',
                  paddingBottom: '8px'
                }}>
                  📅 {currentEvent.title}
                </div>
                
                <div style={{ lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>🏷️</span>
                    <strong>Typ:</strong>
                    <span style={{ marginLeft: '8px', color: '#bcb4a8' }}>{typLabel}</span>
                  </div>

                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>👤</span>
                    <strong>Kunde:</strong> 
                    <span style={{ marginLeft: '8px', color: '#bcb4a8' }}>{details.typ === 'eigener_termin' ? 'Kein Kunde' : details.kunde}</span>
                  </div>
                  
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>🐴</span>
                    <strong>Pferd:</strong> 
                    <span style={{ marginLeft: '8px', color: '#bcb4a8' }}>
                      {details.typ === 'hufbearbeitung' ? details.pferd : 'Nicht erforderlich'}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>🕒</span>
                    <strong>Zeit:</strong> 
                    <span style={{ marginLeft: '8px', color: '#bcb4a8' }}>{details.datum}</span>
                  </div>
                  
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>📊</span>
                    <strong>Status:</strong> 
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      marginLeft: '8px',
                      backgroundColor: statusConfig.color,
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      {statusConfig.label}
                    </span>
                  </div>
                  
                  {statusActions.length > 0 ? (
                    <div style={{ 
                      marginTop: '15px',
                      marginBottom: '12px', 
                      padding: '12px', 
                      backgroundColor: '#3d4746', 
                      borderRadius: '6px',
                      border: '2px solid #55615f'
                    }}>
                      <div style={{ fontSize: '13px', marginBottom: '10px', color: '#f1ece4', fontWeight: 'bold' }}>
                        🔄 Status ändern:
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {statusActions.map((action) => {
                          const isCurrent = details.status === action.value;
                          return (
                            <button
                              key={action.value}
                              onClick={() => handleStatusChange(currentEvent.id, action.value, details.typ)}
                              style={{
                                padding: '6px 10px',
                                fontSize: '11px',
                                backgroundColor: isCurrent ? '#737873' : action.color,
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isCurrent ? 'not-allowed' : 'pointer',
                                opacity: isCurrent ? 0.6 : 1
                              }}
                              disabled={isCurrent}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '12px', color: '#bcb4a8', fontSize: '12px' }}>
                      Dieser Termin ist fix gesetzt und hat keinen Status-Workflow.
                    </div>
                  )}
                  
                  {details.bemerkung !== 'Keine Bemerkungen' && (
                    <div style={{ 
                      marginTop: '12px', 
                      fontSize: '13px', 
                      color: '#bcb4a8',
                      backgroundColor: '#3d4746',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #55615f'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ marginRight: '6px' }}>💭</span>
                        <strong>Bemerkung:</strong>
                      </div>
                      <div style={{ fontStyle: 'italic' }}>{details.bemerkung}</div>
                    </div>
                  )}

                  {/* Letzte Bearbeitungsnotiz für abgeschlossene Hufbearbeitungen */}
                  {details.typ === 'hufbearbeitung' && details.status === 'abgeschlossen' && tooltipBearbeitung && tooltipBearbeitung.length > 0 && (
                    <div style={{
                      marginTop: '10px',
                      fontSize: '13px',
                      color: '#bcb4a8',
                      backgroundColor: '#3d4746',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #55615f'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ marginRight: '6px' }}>🔧</span>
                        <strong>Bearbeitungsnotiz:</strong>
                      </div>
                      {tooltipBearbeitung[0].bearbeitung && (
                        <div style={{ marginBottom: '3px' }}><strong>Bearbeitung:</strong> {tooltipBearbeitung[0].bearbeitung}</div>
                      )}
                      {tooltipBearbeitung[0].bemerkungen && (
                        <div><strong>Notiz:</strong> {tooltipBearbeitung[0].bemerkungen}</div>
                      )}
                      {!tooltipBearbeitung[0].bearbeitung && !tooltipBearbeitung[0].bemerkungen && (
                        <div style={{ fontStyle: 'italic' }}>Keine Notiz hinterlegt.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Termin bearbeiten + löschen */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #3d4746', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    onClick={() => handleOpenTerminEdit(currentEvent)}
                    style={{ padding: '5px 12px', fontSize: '12px', backgroundColor: '#4d6a62', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
                  >
                    ✏️ Termin bearbeiten
                  </button>
                  {pendingDeleteTerminId === currentEvent.id ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#e8a49a' }}>Termin wirklich löschen?</span>
                      <button
                        onClick={confirmDeleteTermin}
                        style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#a55d4e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Ja, löschen
                      </button>
                      <button
                        onClick={() => setPendingDeleteTerminId(null)}
                        style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#737873', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDeleteTermin(currentEvent.id)}
                      style={{ padding: '5px 12px', fontSize: '12px', backgroundColor: 'transparent', color: '#e8a49a', border: '1px solid #8b5e60', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
                    >
                      🗑️ Termin löschen
                    </button>
                  )}
                </div>
                
                {/* Tooltip-Pfeil */}
                <div 
                  style={{
                    position: 'absolute',
                    bottom: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: '8px solid #2f3636'
                  }}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* Modal für Termin-Erstellung */}
      {showCreateForm && selectedDate && (
        <div
          className="kal-modal-overlay"
          onClick={() => setShowCreateForm(false)}
        >
          <div
            className="kal-modal"
            style={{ width: '450px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kal-modal-header">
              <h3 className="kal-modal-title">
                📅 Neuer Termin erstellen
              </h3>
              <p className="kal-modal-meta">
                Datum: {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
              </p>
            </div>

            <form className="kal-form-stacked">

              {/* Termin-Typ Auswahl */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2f3636', fontSize: '14px' }}>
                  Termintyp *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {([
                    { value: 'hufbearbeitung', label: '🐴 Hufbearbeitung', color: '#8a7d90' },
                    { value: 'reitstunde', label: '🏇 Reitstunde', color: '#a67c52' },
                    { value: 'eigener_termin', label: '🔴 Eigener Termin', color: '#8b5e4e' },
                  ] as const).map(({ value, label, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCreateFormData(prev => ({ ...prev, typ: value, kundeId: '', ausgewaehltePferde: [] }))}
                      style={{
                        padding: '10px 6px',
                        backgroundColor: createFormData.typ === value ? color : '#f0f0f0',
                        color: createFormData.typ === value ? 'white' : '#555',
                        border: `2px solid ${createFormData.typ === value ? color : '#ddd'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="kal-form-label">
                  {createFormData.typ === 'eigener_termin' ? 'Titel *' : 'Titel (optional)'}
                </label>
                <input
                  type="text"
                  value={createFormData.titel}
                  onChange={(e) => setCreateFormData({...createFormData, titel: e.target.value})}
                  placeholder="z.B. Hufbearbeitung, Beratung, ..."
                  className="kal-form-input"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div className="kal-form-grid-2">
                <div>
                  <label className="kal-form-label">
                    Startzeit
                  </label>
                  <select
                    value={createFormData.uhrzeit}
                    onChange={(e) => setCreateFormData({...createFormData, uhrzeit: e.target.value})}
                    className="kal-form-select"
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  >
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="kal-form-label">
                    Endzeit (optional)
                  </label>
                  <select
                    value={createFormData.bisUhrzeit}
                    onChange={(e) => setCreateFormData({...createFormData, bisUhrzeit: e.target.value})}
                    className="kal-form-select"
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  >
                    <option value="">-- Keine Endzeit --</option>
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kunden-Auswahl: nicht bei eigenem Termin */}
              {createFormData.typ !== 'eigener_termin' && (
              <div>
                <label className="kal-form-label">
                  Kunde *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={createFormData.kundeId}
                    onChange={(e) => setCreateFormData({...createFormData, kundeId: e.target.value, ausgewaehltePferde: []})}
                    className="kal-form-select"
                    style={{ flexGrow: 1, width: 'auto' }}
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  >
                    <option value="">-- Kunde auswählen --</option>
                    {kunden.map(kunde => (
                      <option key={kunde.id} value={kunde.id}>
                        {kunde.name} {kunde.vorname}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowKundeForm(true)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#5f7f86',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Neu
                  </button>
                </div>
              </div>

              )}

              {/* Pferde-Auswahl: nur bei Hufbearbeitung und wenn Kunde gewählt */}
              {createFormData.typ === 'hufbearbeitung' && createFormData.kundeId && (
                <div>
                  <label className="kal-form-label">
                    Pferde auswählen * ({createFormData.ausgewaehltePferde.length} ausgewählt)
                  </label>
                  
                  {verfuegbarePferde.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f7f3ec',
                      border: '2px solid #e1e8ed',
                      borderRadius: '6px',
                      color: '#6c757d',
                      fontStyle: 'italic'
                    }}>
                      Keine Pferde für diesen Kunden gefunden.
                    </div>
                  ) : (
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '2px solid #e1e8ed',
                      borderRadius: '6px',
                      backgroundColor: 'white'
                    }}>
                      {verfuegbarePferde.map(pferd => {
                        const isSelected = createFormData.ausgewaehltePferde.includes(pferd.id);
                        const details = pferdeDetails[pferd.id];
                        
                        return (
                          <div
                            key={pferd.id}
                            style={{
                              padding: '10px',
                              borderBottom: '1px solid #e1e8ed',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? '#e7edea' : 'white',
                              transition: 'background-color 0.2s'
                            }}
                            onClick={() => {
                              const newSelected = isSelected 
                                ? createFormData.ausgewaehltePferde.filter(id => id !== pferd.id)
                                : [...createFormData.ausgewaehltePferde, pferd.id];
                              setCreateFormData({...createFormData, ausgewaehltePferde: newSelected});
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by parent onClick
                                style={{ cursor: 'pointer' }}
                              />
                              <div style={{ flexGrow: 1 }}>
                                <div style={{ fontWeight: 'bold', color: '#2f3636' }}>
                                  🐴 {pferd.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#737873' }}>
                                  {pferd.alterJahre} Jahre, {pferd.geschlecht}
                                  {details?.lastBearbeitung && (
                                    <span style={{ marginLeft: '8px', color: '#a55d4e' }}>
                                      • Letzte Bearbeitung vor {details.lastBearbeitung.wochenSeither} Wochen
                                    </span>
                                  )}
                                </div>
                                {pferd.bemerkungen && (
                                  <div style={{ fontSize: '11px', color: '#8a8f8b', marginTop: '2px' }}>
                                    {pferd.bemerkungen}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Button für neues Pferd */}
                  {createFormData.kundeId && (
                    <button
                      type="button"
                      onClick={() => setShowPferdForm(true)}
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: '#5f7f86',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      + 🐴 Neues Pferd anlegen
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="kal-form-label">
                  Bemerkung
                </label>
                <textarea
                  value={createFormData.bemerkung}
                  onChange={(e) => setCreateFormData({...createFormData, bemerkung: e.target.value})}
                  placeholder="Zusätzliche Informationen..."
                  rows={3}
                  className="kal-form-textarea"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div className="kal-form-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="kal-btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleCreateTermin}
                  className="kal-btn-primary"
                >
                  💾 Termin erstellen
                </button>
              </div>
            </form>

            <div className="kal-hint-info">
              <strong>ℹ️ Eingabehilfe:</strong> Geben Sie mindestens einen <strong>Kunden</strong> oder ein <strong>Pferd</strong> ein. Der Titel wird automatisch generiert, falls leer gelassen.
            </div>
          </div>
        </div>
      )}

      {/* Bearbeitungsmaske für abgeschlossene Termine */}
      {showEditForm && editingTermin && (
        <div
          className="kal-modal-overlay"
          onClick={() => setShowEditForm(false)}
        >
          <div
            className="kal-modal"
            style={{ width: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kal-modal-header">
              <h3 className="kal-modal-title">
                🐴 Hufbearbeitung dokumentieren
              </h3>
              <p className="kal-modal-meta">
                Kunde: {editingTermin.besitzerName} {editingTermin.besitzerVorname} • Pferd: {editingTermin.pferdName}
              </p>
              <p className="kal-modal-meta" style={{ marginTop: '4px' }}>
                Termin: {format(new Date(editingTermin.datum), 'dd.MM.yyyy HH:mm', { locale: de })}
              </p>
            </div>

            <form className="kal-form-stacked">
              <div>
                <label className="kal-form-label">
                  Bearbeitungsnotizen
                </label>
                <textarea
                  placeholder="Was wurde gemacht? Besonderheiten? Befunde?"
                  rows={4}
                  value={bearbeitungsDaten.bearbeitung}
                  onChange={(e) => setBearbeitungsDaten(prev => ({ ...prev, bearbeitung: e.target.value }))}
                  className="kal-form-textarea"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div>
                <label className="kal-form-label">
                  Nächster Termin empfohlen in
                </label>
                <select
                  value={bearbeitungsDaten.naechsterTermin}
                  onChange={(e) => setBearbeitungsDaten(prev => ({ ...prev, naechsterTermin: e.target.value }))}
                  className="kal-form-select"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                >
                  <option value="4">4 Wochen (Standard)</option>
                  <option value="6">6 Wochen</option>
                  <option value="8">8 Wochen</option>
                  <option value="12">12 Wochen</option>
                  <option value="0">Kein Folgetermin</option>
                </select>
              </div>

              <div className="kal-form-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingTermin(null);
                    setBearbeitungsDaten({
                      bearbeitung: '',
                      bemerkungen: '',
                      naechsterTermin: '4'
                    });
                  }}
                  className="kal-btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (!editingTermin?.id) {
                        throw new Error('Kein gültiger Termin ausgewählt.');
                      }

                      // Nur Hufbearbeitungen werden in hufbearbeitungen dokumentiert.
                      const terminTyp = editingTermin.typ || 'hufbearbeitung';
                      if (terminTyp === 'hufbearbeitung') {
                        await window.api.hufbearbeitung.add({
                          terminId: editingTermin.id,
                          datum: new Date().toISOString(),
                          bearbeitung: bearbeitungsDaten.bearbeitung,
                          bemerkungen: bearbeitungsDaten.bemerkungen
                        });
                      }

                      // Termin abschließen + Folgetermin mit konfigurierbaren Wochen erstellen
                      const folgeWochen = parseInt(bearbeitungsDaten.naechsterTermin) || 0;
                      await window.api.termine.abschliessen(editingTermin.id, folgeWochen);

                      // Formular zurücksetzen und schließen
                      setBearbeitungsDaten({
                        bearbeitung: '',
                        bemerkungen: '',
                        naechsterTermin: '4'
                      });
                      setShowEditForm(false);
                      setEditingTermin(null);

                      // Termine neu laden
                      if (onTermineChange) {
                        await onTermineChange();
                      }

                      const folgeText = folgeWochen > 0
                        ? `\nFolgetermin-Vorschlag in ${folgeWochen} Wochen wurde erstellt.`
                        : '';
                      showNotice('success', `Bearbeitung erfolgreich gespeichert.${folgeText}`);
                    } catch (error) {
                      console.error('Fehler beim Speichern der Bearbeitung:', error);
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      showNotice('error', `Fehler beim Speichern der Bearbeitung: ${errorMessage}`);
                    }
                  }}
                  className="kal-btn-primary"
                >
                  💾 Bearbeitung speichern
                </button>
              </div>
            </form>

            <div className="kal-hint-success">
              <strong>✅ Hinweis:</strong> Nach dem Speichern wird automatisch ein Folgetermin-Vorschlag erstellt und der Termin als "abgeschlossen" markiert.
            </div>
          </div>
        </div>
      )}

      {/* Modal für Termin bearbeiten */}
      {showTerminEditModal && (
        <div
          className="kal-modal-overlay"
          onClick={() => setShowTerminEditModal(false)}
        >
          <div
            className="kal-modal"
            style={{ width: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', color: '#2f3636', fontSize: '20px', fontWeight: 'bold' }}>
              ✏️ Termin bearbeiten
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {terminEditData.typ === 'eigener_termin' && (
                <div>
                  <label className="kal-form-label">Titel</label>
                  <input
                    type="text"
                    value={terminEditData.titelManuell}
                    onChange={(e) => setTerminEditData(p => ({ ...p, titelManuell: e.target.value }))}
                    className="kal-form-input"
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  />
                </div>
              )}

              <div>
                <label className="kal-form-label">Datum</label>
                <input
                  type="date"
                  value={terminEditData.datum}
                  onChange={(e) => setTerminEditData(p => ({ ...p, datum: e.target.value }))}
                  className="kal-form-input"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="kal-form-label">Startzeit</label>
                  <select
                    value={terminEditData.uhrzeit}
                    onChange={(e) => setTerminEditData(p => ({ ...p, uhrzeit: e.target.value }))}
                    className="kal-form-select"
                  >
                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="kal-form-label">Endzeit (optional)</label>
                  <select
                    value={terminEditData.bisUhrzeit}
                    onChange={(e) => setTerminEditData(p => ({ ...p, bisUhrzeit: e.target.value }))}
                    className="kal-form-select"
                  >
                    <option value="">— keine —</option>
                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="kal-form-label">Bemerkung</label>
                <textarea
                  value={terminEditData.bemerkung}
                  onChange={(e) => setTerminEditData(p => ({ ...p, bemerkung: e.target.value }))}
                  rows={3}
                  className="kal-form-textarea"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  onClick={handleSaveTerminEdit}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#4d6a62', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#3f5953'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4d6a62'}
                >
                  💾 Speichern
                </button>
                <button
                  onClick={() => setShowTerminEditModal(false)}
                  style={{ padding: '10px 20px', backgroundColor: '#e8e4de', color: '#2f3636', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#ddd8d2'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#e8e4de'}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal für Kunden-Anlegen */}
      {showKundeForm && (
        <div
          className="kal-modal-overlay"
          onClick={() => setShowKundeForm(false)}
        >
          <div
            className="kal-modal"
            style={{ width: '400px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kal-modal-header">
              <h3 className="kal-modal-title">
                👤 Neuen Kunden anlegen
              </h3>
            </div>
            <form className="kal-form-stacked">
              <div className="kal-form-grid-2">
                <div>
                  <label className="kal-form-label">Nachname *</label>
                  <input
                    type="text"
                    value={kundeFormData.name}
                    onChange={(e) => setKundeFormData({...kundeFormData, name: e.target.value})}
                    placeholder="z.B. Müller"
                    className="kal-form-input"
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  />
                </div>
                <div>
                  <label className="kal-form-label">Vorname</label>
                  <input
                    type="text"
                    value={kundeFormData.vorname}
                    onChange={(e) => setKundeFormData({...kundeFormData, vorname: e.target.value})}
                    placeholder="z.B. Anna"
                    className="kal-form-input"
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  />
                </div>
              </div>
              <div>
                <label className="kal-form-label">Adresse</label>
                <input
                  type="text"
                  value={kundeFormData.adresse}
                  onChange={(e) => setKundeFormData({...kundeFormData, adresse: e.target.value})}
                  placeholder="z.B. Hauptstraße 5, 4020 Linz"
                  className="kal-form-input"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>
              <div className="kal-form-footer">
                <button
                  type="button"
                  onClick={() => setShowKundeForm(false)}
                  className="kal-btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleCreateKunde}
                  style={{ padding: '10px 20px', backgroundColor: '#5f7f86', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                >
                  👤 Kunden anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal für Pferd-Anlegen */}
      {showPferdForm && createFormData.kundeId && (
        <div
          className="kal-modal-overlay"
          onClick={() => setShowPferdForm(false)}
        >
          <div
            className="kal-modal"
            style={{ width: '400px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kal-modal-header">
              <h3 className="kal-modal-title">
                🐴 Neues Pferd anlegen
              </h3>
              <p className="kal-modal-meta">
                Für: {kunden.find((k: any) => k.id === parseInt(createFormData.kundeId))?.name || 'Unbekannt'}
              </p>
            </div>

            <form className="kal-form-stacked">
              <div>
                <label className="kal-form-label">
                  Name des Pferdes *
                </label>
                <input
                  type="text"
                  value={pferdFormData.name}
                  onChange={(e) => setPferdFormData({...pferdFormData, name: e.target.value})}
                  placeholder="z.B. Luna, Max, Bella..."
                  required
                  className="kal-form-input"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div className="kal-form-grid-2">
                <div>
                  <label className="kal-form-label">
                    Geburtsjahr
                  </label>
                  <input
                    type="number"
                    value={pferdFormData.geburtsjahr}
                    onChange={(e) => setPferdFormData({...pferdFormData, geburtsjahr: e.target.value})}
                    placeholder="z.B. 2018"
                    min="1900"
                    max={new Date().getFullYear()}
                    className="kal-form-input"
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  />
                </div>

                <div>
                  <label className="kal-form-label">
                    Geschlecht
                  </label>
                  <select
                    value={pferdFormData.geschlecht}
                    onChange={(e) => setPferdFormData({...pferdFormData, geschlecht: e.target.value})}
                    className="kal-form-select"
                    onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  >
                    <option value="Stute">Stute</option>
                    <option value="Wallach">Wallach</option>
                    <option value="Hengst">Hengst</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="kal-form-label">
                  Bemerkungen
                </label>
                <textarea
                  value={pferdFormData.bemerkungen}
                  onChange={(e) => setPferdFormData({...pferdFormData, bemerkungen: e.target.value})}
                  placeholder="z.B. Besondere Merkmale, Krankheiten, Verhalten..."
                  rows={3}
                  className="kal-form-textarea"
                  onFocus={(e) => e.target.style.borderColor = '#5f7f86'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div className="kal-form-footer">
                <button
                  type="button"
                  onClick={() => setShowPferdForm(false)}
                  className="kal-btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleCreatePferd}
                  className="kal-btn-primary"
                >
                  🐴 Pferd anlegen
                </button>
              </div>
            </form>

            <div className="kal-hint-info">
              <strong>ℹ️ Hinweis:</strong> Das neue Pferd wird automatisch für den aktuellen Termin ausgewählt.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
