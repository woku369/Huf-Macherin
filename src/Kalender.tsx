import { useMemo, useRef, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
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

interface KalenderProps {
  termine: any[];
  onSelectDate?: (date: Date) => void;
  onTermineChange?: () => Promise<void>;
}

export default function Kalender({ termine, onSelectDate, onTermineChange }: KalenderProps) {
  const [selectedEvent, setSelectedEvent] = useState<TerminEvent | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Bearbeitungsmaske
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTermin, setEditingTermin] = useState<any>(null);
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
              backgroundColor: '#3498db',
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
              backgroundColor: '#2c3e50',
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
              backgroundColor: '#3498db',
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
          color: '#2c3e50',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <span>{format(date, 'MMMM yyyy', { locale: de })}</span>
          {view === 'month' && (
            <span style={{ 
              fontSize: '14px', 
              backgroundColor: '#e8f4fd',
              padding: '4px 8px',
              borderRadius: '4px',
              color: '#2980b9'
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
              backgroundColor: view === 'month' ? '#27ae60' : '#95a5a6',
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
              backgroundColor: view === 'week' ? '#27ae60' : '#95a5a6',
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
              backgroundColor: view === 'day' ? '#27ae60' : '#95a5a6',
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
        await window.api.googleLogin();
        const code = prompt('Bitte den Google-Auth-Code eingeben:');
        if (code) await window.api.googleAuthCode(code);
      }
      for (const t of termine) {
        await window.api.googleExportTermin({
          titel: t.titel || t.titelText || t.beschreibung || t.pferdName || 'Termin',
          bemerkung: t.bemerkung,
          datum: t.datum,
        });
      }
      alert('Alle Termine wurden an Google Kalender übertragen!');
    } catch (error) {
      alert('Fehler beim Export: ' + error);
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
      alert('Fehler: Kein Datum ausgewählt!');
      return;
    }
    
    if (createFormData.typ !== 'eigener_termin' && !createFormData.kundeId.trim()) {
      alert('Bitte einen Kunden auswählen!');
      return;
    }

    if (createFormData.typ === 'hufbearbeitung' && createFormData.ausgewaehltePferde.length === 0) {
      alert('Bitte mindestens ein Pferd auswählen!');
      return;
    }

    if (createFormData.typ === 'eigener_termin' && !createFormData.titel.trim()) {
      alert('Bitte einen Titel für den eigenen Termin eingeben!');
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
      
      alert(`${createFormData.ausgewaehltePferde.length} Termine erfolgreich vorreserviert!\n\nTitel: ${terminTitel}\nDatum: ${format(terminStart, 'dd.MM.yyyy')}\nZeit: ${zeitText}\nKunde: ${ausgewaehlterKunde?.name || 'Unbekannt'}\nPferde: ${ausgewaehltePferdeNames}\nBemerkung: ${createFormData.bemerkung || '(keine)'}\n\nStatus: Vorreserviert`);

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
      alert('Fehler beim Erstellen der Termine: ' + error);
    }
  };

  const formatEventDetails = (event: TerminEvent) => {
    const resource = event.resource;
    return {
      kunde: resource.besitzerName ? `${resource.besitzerName} ${resource.besitzerVorname || ''}`.trim() : 'Unbekannt',
      pferd: resource.pferdName || 'Unbekannt',
      datum: format(event.start, 'dd.MM.yyyy HH:mm', { locale: de }),
      bemerkung: resource.bemerkung || 'Keine Bemerkungen',
      status: resource.status || 'geplant'
    };
  };

  // Status-Änderung mit automatischer Bearbeitungsmaske
  const handleStatusChange = async (terminId: number, newStatus: string) => {
    try {
      // "Abschließen" → erst Bearbeitungsmaske öffnen, Status wird dort gesetzt
      if (newStatus === 'abgeschlossen') {
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
      await window.api.updateTerminStatus(terminId, newStatus);

      // Tooltip schließen
      setShowTooltip(false);
      setSelectedEvent(null);

      // Termine aktualisieren
      if (onTermineChange) {
        await onTermineChange();
      }

    } catch (error) {
      alert('Fehler beim Ändern des Status: ' + error);
    }
  };

  // Neues Pferd anlegen
  const handleCreateKunde = async () => {
    if (!kundeFormData.name.trim()) {
      alert('Bitte geben Sie einen Nachnamen ein!');
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
      alert('Fehler beim Anlegen des Kunden: ' + error);
    }
  };

  const handleCreatePferd = async () => {
    if (!createFormData.kundeId) {
      alert('Bitte wählen Sie zuerst einen Kunden aus!');
      return;
    }
    
    if (!pferdFormData.name.trim()) {
      alert('Bitte geben Sie einen Namen für das Pferd ein!');
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

      alert(`Pferd "${neuesPferd.name}" erfolgreich angelegt und ausgewählt!`);

    } catch (error) {
      alert('Fehler beim Anlegen des Pferdes: ' + error);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={handlePdfExport} 
            style={{ 
              padding: '10px 15px',
              backgroundColor: '#e74c3c',
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
                backgroundColor: '#27ae60',
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
          <span style={{ color: '#7f8c8d', fontWeight: 'bold' }}>Status:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#9b59b6', borderRadius: '2px' }}></div>
            <span>Vorreserviert</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#3498db', borderRadius: '2px' }}></div>
            <span>Bestätigt</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#27ae60', borderRadius: '2px' }}></div>
            <span>Abgeschlossen</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#f39c12', borderRadius: '2px' }}></div>
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
              bg = '#c0392b';
            } else if (typ === 'reitstunde') {
              bg = status === 'abgeschlossen' ? '#d35400' : '#e67e22';
            } else {
              // hufbearbeitung
              bg = status === 'abgeschlossen' ? '#27ae60' :
                   status === 'vorschlag'     ? '#f39c12' :
                   status === 'vorreserviert' ? '#9b59b6' :
                   status === 'bestätigt'     ? '#3498db' : '#95a5a6';
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
            backgroundColor: '#2c3e50',
            color: 'white',
            borderRadius: '8px',
            padding: '15px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 1000,
            width: '300px',
            fontSize: '14px',
            border: '2px solid #34495e',
            maxHeight: '380px',
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
            return (
              <>
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '12px', 
                  color: '#ecf0f1',
                  fontSize: '16px',
                  borderBottom: '1px solid #34495e',
                  paddingBottom: '8px'
                }}>
                  📅 {currentEvent.title}
                </div>
                
                <div style={{ lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>👤</span>
                    <strong>Kunde:</strong> 
                    <span style={{ marginLeft: '8px', color: '#bdc3c7' }}>{details.kunde}</span>
                  </div>
                  
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>🐴</span>
                    <strong>Pferd:</strong> 
                    <span style={{ marginLeft: '8px', color: '#bdc3c7' }}>{details.pferd}</span>
                  </div>
                  
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>🕒</span>
                    <strong>Zeit:</strong> 
                    <span style={{ marginLeft: '8px', color: '#bdc3c7' }}>{details.datum}</span>
                  </div>
                  
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>📊</span>
                    <strong>Status:</strong> 
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      marginLeft: '8px',
                      backgroundColor: details.status === 'abgeschlossen' ? '#27ae60' : 
                                      details.status === 'vorschlag' ? '#f39c12' : 
                                      details.status === 'vorreserviert' ? '#9b59b6' :
                                      details.status === 'bestätigt' ? '#3498db' : '#95a5a6',
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      {details.status === 'vorreserviert' ? 'Vorreserviert' : 
                       details.status === 'bestätigt' ? 'Bestätigt' :
                       details.status === 'abgeschlossen' ? 'Abgeschlossen' :
                       details.status === 'vorschlag' ? 'Vorschlag' : details.status}
                    </span>
                  </div>
                  
                  {/* Status-Änderungs-Buttons - IMMER SICHTBAR */}
                  <div style={{ 
                    marginTop: '15px',
                    marginBottom: '12px', 
                    padding: '12px', 
                    backgroundColor: '#34495e', 
                    borderRadius: '6px',
                    border: '2px solid #4a5f7a'
                  }}>
                    <div style={{ fontSize: '13px', marginBottom: '10px', color: '#ecf0f1', fontWeight: 'bold' }}>
                      🔄 Status ändern:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleStatusChange(currentEvent.id, 'vorreserviert')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          backgroundColor: details.status === 'vorreserviert' ? '#7f8c8d' : '#9b59b6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: details.status === 'vorreserviert' ? 'not-allowed' : 'pointer',
                          opacity: details.status === 'vorreserviert' ? 0.6 : 1
                        }}
                        disabled={details.status === 'vorreserviert'}
                      >
                        Vorreserviert
                      </button>
                      <button
                        onClick={() => handleStatusChange(currentEvent.id, 'bestätigt')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          backgroundColor: details.status === 'bestätigt' ? '#7f8c8d' : '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: details.status === 'bestätigt' ? 'not-allowed' : 'pointer',
                          opacity: details.status === 'bestätigt' ? 0.6 : 1
                        }}
                        disabled={details.status === 'bestätigt'}
                      >
                        Bestätigen
                      </button>
                      <button
                        onClick={() => handleStatusChange(currentEvent.id, 'abgeschlossen')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          backgroundColor: details.status === 'abgeschlossen' ? '#7f8c8d' : '#27ae60',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: details.status === 'abgeschlossen' ? 'not-allowed' : 'pointer',
                          opacity: details.status === 'abgeschlossen' ? 0.6 : 1
                        }}
                        disabled={details.status === 'abgeschlossen'}
                      >
                        Abschließen
                      </button>
                      <button
                        onClick={() => handleStatusChange(currentEvent.id, 'vorschlag')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          backgroundColor: details.status === 'vorschlag' ? '#7f8c8d' : '#f39c12',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: details.status === 'vorschlag' ? 'not-allowed' : 'pointer',
                          opacity: details.status === 'vorschlag' ? 0.6 : 1
                        }}
                        disabled={details.status === 'vorschlag'}
                      >
                        Als Vorschlag
                      </button>
                    </div>
                  </div>
                  
                  {details.bemerkung !== 'Keine Bemerkungen' && (
                    <div style={{ 
                      marginTop: '12px', 
                      fontSize: '13px', 
                      color: '#bdc3c7',
                      backgroundColor: '#34495e',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #4a5f7a'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ marginRight: '6px' }}>💭</span>
                        <strong>Bemerkung:</strong>
                      </div>
                      <div style={{ fontStyle: 'italic' }}>{details.bemerkung}</div>
                    </div>
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
                    borderTop: '8px solid #2c3e50'
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowCreateForm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '450px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
              border: '1px solid #e1e8ed'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: '#2c3e50', 
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                📅 Neuer Termin erstellen
              </h3>
              <p style={{ 
                margin: 0, 
                color: '#7f8c8d', 
                fontSize: '14px' 
              }}>
                Datum: {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
              </p>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Termin-Typ Auswahl */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>
                  Termintyp *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {([
                    { value: 'hufbearbeitung', label: '🐴 Hufbearbeitung', color: '#8e44ad' },
                    { value: 'reitstunde', label: '🏇 Reitstunde', color: '#e67e22' },
                    { value: 'eigener_termin', label: '🔴 Eigener Termin', color: '#c0392b' },
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
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  {createFormData.typ === 'eigener_termin' ? 'Titel *' : 'Titel (optional)'}
                </label>
                <input
                  type="text"
                  value={createFormData.titel}
                  onChange={(e) => setCreateFormData({...createFormData, titel: e.target.value})}
                  placeholder="z.B. Hufbearbeitung, Beratung, ..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    Startzeit
                  </label>
                  <select
                    value={createFormData.uhrzeit}
                    onChange={(e) => setCreateFormData({...createFormData, uhrzeit: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e1e8ed',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3498db'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  >
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    Endzeit (optional)
                  </label>
                  <select
                    value={createFormData.bisUhrzeit}
                    onChange={(e) => setCreateFormData({...createFormData, bisUhrzeit: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e1e8ed',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3498db'}
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
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Kunde *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={createFormData.kundeId}
                    onChange={(e) => setCreateFormData({...createFormData, kundeId: e.target.value, ausgewaehltePferde: []})}
                    style={{
                      flexGrow: 1,
                      padding: '10px 12px',
                      border: '2px solid #e1e8ed',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3498db'}
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
                      backgroundColor: '#3498db',
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
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    Pferde auswählen * ({createFormData.ausgewaehltePferde.length} ausgewählt)
                  </label>
                  
                  {verfuegbarePferde.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
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
                              backgroundColor: isSelected ? '#e8f4fd' : 'white',
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
                                <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                                  🐴 {pferd.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                                  {pferd.alterJahre} Jahre, {pferd.geschlecht}
                                  {details?.lastBearbeitung && (
                                    <span style={{ marginLeft: '8px', color: '#e74c3c' }}>
                                      • Letzte Bearbeitung vor {details.lastBearbeitung.wochenSeither} Wochen
                                    </span>
                                  )}
                                </div>
                                {pferd.bemerkungen && (
                                  <div style={{ fontSize: '11px', color: '#95a5a6', marginTop: '2px' }}>
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
                        backgroundColor: '#3498db',
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
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Bemerkung
                </label>
                <textarea
                  value={createFormData.bemerkung}
                  onChange={(e) => setCreateFormData({...createFormData, bemerkung: e.target.value})}
                  placeholder="Zusätzliche Informationen..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginTop: '8px',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#7f8c8d'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#95a5a6'}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleCreateTermin}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#229954'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#27ae60'}
                >
                  💾 Termin erstellen
                </button>
              </div>
            </form>

            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: '#d1ecf1', 
              border: '1px solid #bee5eb',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#0c5460'
            }}>
              <strong>ℹ️ Eingabehilfe:</strong> Geben Sie mindestens einen <strong>Kunden</strong> oder ein <strong>Pferd</strong> ein. Der Titel wird automatisch generiert, falls leer gelassen.
            </div>
          </div>
        </div>
      )}

      {/* Bearbeitungsmaske für abgeschlossene Termine */}
      {showEditForm && editingTermin && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowEditForm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '500px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
              border: '1px solid #e1e8ed'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: '#2c3e50', 
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                🐴 Hufbearbeitung dokumentieren
              </h3>
              <p style={{ 
                margin: 0, 
                color: '#7f8c8d', 
                fontSize: '14px' 
              }}>
                Kunde: {editingTermin.besitzerName} {editingTermin.besitzerVorname} • Pferd: {editingTermin.pferdName}
              </p>
              <p style={{ 
                margin: '4px 0 0 0', 
                color: '#7f8c8d', 
                fontSize: '14px' 
              }}>
                Termin: {format(new Date(editingTermin.datum), 'dd.MM.yyyy HH:mm', { locale: de })}
              </p>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Bearbeitungsnotizen
                </label>
                <textarea
                  placeholder="Was wurde gemacht? Besonderheiten? Befunde?"
                  rows={4}
                  value={bearbeitungsDaten.bearbeitung}
                  onChange={(e) => setBearbeitungsDaten(prev => ({ ...prev, bearbeitung: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Nächster Termin empfohlen in
                </label>
                <select
                  value={bearbeitungsDaten.naechsterTermin}
                  onChange={(e) => setBearbeitungsDaten(prev => ({ ...prev, naechsterTermin: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                >
                  <option value="4">4 Wochen (Standard)</option>
                  <option value="6">6 Wochen</option>
                  <option value="8">8 Wochen</option>
                  <option value="12">12 Wochen</option>
                  <option value="0">Kein Folgetermin</option>
                </select>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginTop: '8px',
                justifyContent: 'flex-end'
              }}>
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
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#7f8c8d'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#95a5a6'}
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
                      alert(`✅ Bearbeitung erfolgreich gespeichert!${folgeText}`);
                    } catch (error) {
                      console.error('Fehler beim Speichern der Bearbeitung:', error);
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      alert(`❌ Fehler beim Speichern der Bearbeitung!\n\n${errorMessage}`);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#229954'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#27ae60'}
                >
                  💾 Bearbeitung speichern
                </button>
              </div>
            </form>

            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: '#d4edda', 
              border: '1px solid #c3e6cb',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#155724'
            }}>
              <strong>✅ Hinweis:</strong> Nach dem Speichern wird automatisch ein Folgetermin-Vorschlag erstellt und der Termin als "abgeschlossen" markiert.
            </div>
          </div>
        </div>
      )}

      {/* Modal für Kunden-Anlegen */}
      {showKundeForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowKundeForm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '400px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
              border: '1px solid #e1e8ed'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50', fontSize: '20px', fontWeight: 'bold' }}>
                👤 Neuen Kunden anlegen
              </h3>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>Nachname *</label>
                  <input
                    type="text"
                    value={kundeFormData.name}
                    onChange={(e) => setKundeFormData({...kundeFormData, name: e.target.value})}
                    placeholder="z.B. Müller"
                    style={{ width: '100%', padding: '10px 12px', border: '2px solid #e1e8ed', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#3498db'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>Vorname</label>
                  <input
                    type="text"
                    value={kundeFormData.vorname}
                    onChange={(e) => setKundeFormData({...kundeFormData, vorname: e.target.value})}
                    placeholder="z.B. Anna"
                    style={{ width: '100%', padding: '10px 12px', border: '2px solid #e1e8ed', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#3498db'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>Adresse</label>
                <input
                  type="text"
                  value={kundeFormData.adresse}
                  onChange={(e) => setKundeFormData({...kundeFormData, adresse: e.target.value})}
                  placeholder="z.B. Hauptstraße 5, 4020 Linz"
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #e1e8ed', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowKundeForm(false)}
                  style={{ padding: '10px 20px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleCreateKunde}
                  style={{ padding: '10px 20px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowPferdForm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '400px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
              border: '1px solid #e1e8ed'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: '#2c3e50', 
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                🐴 Neues Pferd anlegen
              </h3>
              <p style={{ 
                margin: 0, 
                color: '#7f8c8d', 
                fontSize: '14px' 
              }}>
                Für: {kunden.find((k: any) => k.id === parseInt(createFormData.kundeId))?.name || 'Unbekannt'}
              </p>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Name des Pferdes *
                </label>
                <input
                  type="text"
                  value={pferdFormData.name}
                  onChange={(e) => setPferdFormData({...pferdFormData, name: e.target.value})}
                  placeholder="z.B. Luna, Max, Bella..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    Geburtsjahr
                  </label>
                  <input
                    type="number"
                    value={pferdFormData.geburtsjahr}
                    onChange={(e) => setPferdFormData({...pferdFormData, geburtsjahr: e.target.value})}
                    placeholder="z.B. 2018"
                    min="1900"
                    max={new Date().getFullYear()}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e1e8ed',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3498db'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    Geschlecht
                  </label>
                  <select
                    value={pferdFormData.geschlecht}
                    onChange={(e) => setPferdFormData({...pferdFormData, geschlecht: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e1e8ed',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3498db'}
                    onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                  >
                    <option value="Stute">Stute</option>
                    <option value="Wallach">Wallach</option>
                    <option value="Hengst">Hengst</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Bemerkungen
                </label>
                <textarea
                  value={pferdFormData.bemerkungen}
                  onChange={(e) => setPferdFormData({...pferdFormData, bemerkungen: e.target.value})}
                  placeholder="z.B. Besondere Merkmale, Krankheiten, Verhalten..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginTop: '8px',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setShowPferdForm(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#7f8c8d'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#95a5a6'}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleCreatePferd}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#229954'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#27ae60'}
                >
                  🐴 Pferd anlegen
                </button>
              </div>
            </form>

            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: '#d1ecf1', 
              border: '1px solid #bee5eb',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#0c5460'
            }}>
              <strong>ℹ️ Hinweis:</strong> Das neue Pferd wird automatisch für den aktuellen Termin ausgewählt.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
