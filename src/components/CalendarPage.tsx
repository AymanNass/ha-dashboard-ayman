import { useEffect, useMemo, useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';

interface CalEvent {
  start: string;
  end: string;
  summary: string;
  location?: string;
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

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

interface Props {
  entities: HassEntities;
  getCalendarEvents: (entityIds: string[], days?: number) => Promise<Record<string, { events?: unknown[] }>>;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventTime(start: string): string {
  if (start.length <= 10 || !start.includes('T')) return '';
  return new Date(start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function CalendarPage({ entities, getCalendarEvents }: Props) {
  const [person, setPerson] = useState<Person>('condiviso');
  const [events, setEvents] = useState<(CalEvent & { calendarId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthLabel = viewDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  // Fetch events for the visible month range (+ padding)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const ids = PERSON_CALENDARS[person];
    // Fetch 45 days from the start of the month to cover the whole grid
    getCalendarEvents(ids, 45).then((resp) => {
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
  }, [person, getCalendarEvents, monthOffset]);

  // Build the month grid
  const grid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0 in our grid
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: { date: Date; inMonth: boolean; isToday: boolean }[] = [];
    const today = new Date();

    // Fill leading days from previous month
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({ date: d, inMonth: false, isToday: sameDay(d, today) });
    }
    // Fill current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      cells.push({ date, inMonth: true, isToday: sameDay(date, today) });
    }
    // Fill trailing days
    while (cells.length % 7 !== 0 || cells.length < 35) {
      const d = new Date(year, month + 1, cells.length - (startDow + lastDay.getDate()) + 1);
      cells.push({ date: d, inMonth: false, isToday: sameDay(d, today) });
    }

    return cells;
  }, [viewDate]);

  // Map events to day keys
  const eventsByDay = useMemo(() => {
    const map: Record<string, (CalEvent & { calendarId: string })[]> = {};
    for (const ev of events) {
      const d = new Date(ev.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] ??= []).push(ev);
    }
    return map;
  }, [events]);

  return (
    <div className="calp">
      {/* Header */}
      <div className="calp-header">
        <div className="calp-nav">
          <button className="calp-nav-btn" onClick={() => setMonthOffset((o) => o - 1)}>
            <span className="mdi mdi-chevron-left" />
          </button>
          <span className="calp-month">{monthLabel}</span>
          <button className="calp-nav-btn" onClick={() => setMonthOffset((o) => o + 1)}>
            <span className="mdi mdi-chevron-right" />
          </button>
          {monthOffset !== 0 && (
            <button className="calp-nav-today" onClick={() => setMonthOffset(0)}>Oggi</button>
          )}
        </div>
        <div className="calp-person-sel">
          {(['condiviso', 'ayman', 'martina'] as Person[]).map((p) => (
            <button key={p} className={`calp-person ${person === p ? 'active' : ''}`} onClick={() => setPerson(p)}>
              {p === 'condiviso' ? '👨‍👩‍👦 Famiglia' : p === 'ayman' ? '👤 Ayman' : '👤 Martina'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="calp-legend">
        {PERSON_CALENDARS[person].map((id) => (
          <span key={id} className="calp-legend-item">
            <span className="calp-legend-dot" style={{ background: CALENDAR_COLORS[id] }} />
            {CALENDAR_LABELS[id] || id}
          </span>
        ))}
      </div>

      {/* Month grid */}
      <div className="calg">
        {/* Weekday headers */}
        <div className="calg-head">
          {WEEKDAYS.map((d) => (
            <span key={d} className="calg-dow">{d}</span>
          ))}
        </div>

        {/* Day cells */}
        <div className="calg-grid">
          {grid.map((cell, i) => {
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const dayEvents = eventsByDay[key] ?? [];
            return (
              <div
                key={i}
                className={`calg-cell ${cell.inMonth ? '' : 'out'} ${cell.isToday ? 'today' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
              >
                <span className="calg-num">{cell.date.getDate()}</span>
                <div className="calg-events">
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <div key={j} className="calg-ev" style={{ background: CALENDAR_COLORS[ev.calendarId] || '#64748b' }}>
                      {eventTime(ev.start) && <span className="calg-ev-time">{eventTime(ev.start)}</span>}
                      <span className="calg-ev-name">{ev.summary}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="calg-more">+{dayEvents.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <div className="calp-loading">Caricamento...</div>}
    </div>
  );
}
