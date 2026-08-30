import { useEffect, useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';

interface CalEvent {
  start: string;
  end: string;
  summary: string;
  location?: string;
  description?: string;
}

type Person = 'condiviso' | 'ayman' | 'martina';

const PERSON_CALENDARS: Record<Person, string[]> = {
  condiviso: ['calendar.marti_ayman', 'calendar.impegni', 'calendar.vacanze'],
  ayman: ['calendar.impegni', 'calendar.sport', 'calendar.palestra', 'calendar.marti_ayman'],
  martina: ['calendar.impegni', 'calendar.palestra', 'calendar.marti_ayman'],
};

const CALENDAR_COLORS: Record<string, string> = {
  'calendar.marti_ayman': '#ec4899',
  'calendar.impegni': '#3b82f6',
  'calendar.palestra': '#10b981',
  'calendar.sport': '#f59e0b',
  'calendar.vacanze': '#a855f7',
};

const CALENDAR_LABELS: Record<string, string> = {
  'calendar.marti_ayman': 'Marti-Ayman',
  'calendar.impegni': 'Impegni',
  'calendar.palestra': 'Palestra',
  'calendar.sport': 'Sport',
  'calendar.vacanze': 'Vacanze',
};

interface Props {
  entities: HassEntities;
  getCalendarEvents: (entityIds: string[], days?: number) => Promise<Record<string, { events?: unknown[] }>>;
}

function formatEventTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  // All day event check (date only, no time component)
  if (start.length <= 10 || (!start.includes('T'))) return 'Tutto il giorno';
  const st = s.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const et = e.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${st} — ${et}`;
}

function formatDay(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / 86400000;
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  if (diff === 2) return 'Dopodomani';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function CalendarPage({ entities, getCalendarEvents }: Props) {
  const [person, setPerson] = useState<Person>('condiviso');
  const [events, setEvents] = useState<(CalEvent & { calendarId: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const ids = PERSON_CALENDARS[person];
    getCalendarEvents(ids, 14).then((resp) => {
      if (cancelled) return;
      const all: (CalEvent & { calendarId: string })[] = [];
      for (const [calId, data] of Object.entries(resp)) {
        for (const ev of (data.events ?? []) as CalEvent[]) {
          all.push({ ...ev, calendarId: calId });
        }
      }
      all.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setEvents(all);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [person, getCalendarEvents]);

  // Group events by day
  const grouped = events.reduce<Record<string, typeof events>>((acc, ev) => {
    const d = new Date(ev.start);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (acc[key] ??= []).push(ev);
    return acc;
  }, {});

  const days = Object.entries(grouped).map(([key, evts]) => ({
    key,
    date: new Date(evts[0].start),
    events: evts,
  }));

  return (
    <div className="calp">
      <div className="calp-header">
        <div>
          <span className="calp-title">Calendario</span>
          <span className="calp-sub">Prossimi 14 giorni · {events.length} eventi</span>
        </div>
        <div className="calp-person-sel">
          {(['condiviso', 'ayman', 'martina'] as Person[]).map((p) => (
            <button key={p} className={`calp-person ${person === p ? 'active' : ''}`} onClick={() => setPerson(p)}>
              {p === 'condiviso' ? '👨‍👩‍👦 Famiglia' : p === 'ayman' ? '👤 Ayman' : '👤 Martina'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar legend */}
      <div className="calp-legend">
        {PERSON_CALENDARS[person].map((id) => (
          <span key={id} className="calp-legend-item">
            <span className="calp-legend-dot" style={{ background: CALENDAR_COLORS[id] }} />
            {CALENDAR_LABELS[id] || id}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="calp-loading">Caricamento eventi...</div>
      ) : events.length === 0 ? (
        <div className="calp-empty">
          <span className="mdi mdi-calendar-blank" />
          <span>Nessun evento nei prossimi 14 giorni</span>
        </div>
      ) : (
        <div className="calp-days">
          {days.map((day) => (
            <div key={day.key} className="calp-day">
              <div className="calp-day-head">
                <span className="calp-day-label">{formatDay(day.date)}</span>
                <span className="calp-day-date">{day.date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="calp-events">
                {day.events.map((ev, i) => (
                  <div key={i} className="calp-event" style={{ borderLeftColor: CALENDAR_COLORS[ev.calendarId] || 'var(--text-muted)' }}>
                    <div className="calp-event-time">{formatEventTime(ev.start, ev.end)}</div>
                    <div className="calp-event-summary">{ev.summary}</div>
                    {ev.location && <div className="calp-event-loc"><span className="mdi mdi-map-marker" /> {ev.location}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
