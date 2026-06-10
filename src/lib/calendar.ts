// Calendar agenda support (issue #25). Events come from HA's
// `calendar.get_events` service (a response-returning call, like
// `weather.get_forecasts`), merged across the selected `calendar.*` entities
// and shown on three surfaces: the at-a-glance chip, the optional wide
// "Up next" tile, and the screensaver agenda — all opening the 7-day flyout.

import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { getSettings } from '../settings';
import { clockTime } from './format';

export interface CalendarEvent {
  start: Date;
  end: Date;
  allDay: boolean;
  summary: string;
  location?: string;
  calendarId: string;
}

interface RawEvent {
  start?: string;
  end?: string;
  summary?: string;
  location?: string;
}

export type CalendarServiceResponse = Record<string, { events?: RawEvent[] }>;

/** All `calendar.*` entities, sorted by id for a stable picker / color order. */
export function discoverCalendars(entities: HassEntities): HassEntity[] {
  return Object.values(entities)
    .filter((e) => e.entity_id.startsWith('calendar.'))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
}

/** The calendar entity ids to aggregate: the user's saved selection (minus any
 *  that no longer exist), or every discovered calendar when none is saved. */
export function activeCalendarIds(entities: HassEntities): string[] {
  const saved = getSettings().calendarEntities;
  const all = discoverCalendars(entities).map((e) => e.entity_id);
  if (!saved.length) return all;
  return all.filter((id) => saved.includes(id));
}

/** Per-calendar dot colors, assigned by position in the stable id order. The
 *  first calendar gets the user's accent; the rest a fixed distinct palette. */
const DOT_PALETTE = ['var(--accent-primary)', '#60a5fa', '#2dd4bf', '#c084fc', '#fbbf24', '#f87171'];

export function calendarColor(calendarId: string, orderedIds: string[]): string {
  const i = orderedIds.indexOf(calendarId);
  return DOT_PALETTE[(i < 0 ? 0 : i) % DOT_PALETTE.length];
}

/** Parse a service timestamp: all-day events come as date-only strings
 *  ("2026-06-11", parsed as *local* midnight so they land on the right day),
 *  timed events as full ISO datetimes. */
function parseWhen(s: string): { date: Date; allDay: boolean } {
  if (!s.includes('T')) {
    const [y, m, d] = s.split('-').map(Number);
    return { date: new Date(y, m - 1, d), allDay: true };
  }
  return { date: new Date(s), allDay: false };
}

/** Flatten a get_events response into a single sorted event list. */
export function parseEventsResponse(resp: CalendarServiceResponse): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const [calendarId, data] of Object.entries(resp)) {
    for (const raw of data?.events ?? []) {
      if (!raw.start || !raw.end) continue;
      const start = parseWhen(raw.start);
      const end = parseWhen(raw.end);
      out.push({
        start: start.date,
        end: end.date,
        allDay: start.allDay,
        summary: raw.summary || '(untitled)',
        location: raw.location || undefined,
        calendarId,
      });
    }
  }
  return out.sort((a, b) => {
    if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime();
    // All-day events lead their day.
    return Number(b.allDay) - Number(a.allDay);
  });
}

/** Events still relevant now: anything that hasn't ended yet. */
export function upcomingEvents(events: CalendarEvent[], now = new Date()): CalendarEvent[] {
  return events.filter((e) => e.end.getTime() > now.getTime());
}

/** Local midnight for a date. */
function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** True when the event overlaps the given calendar day. */
export function onDay(e: CalendarEvent, day: Date): boolean {
  const start = dayStart(day);
  const end = start + 86_400_000;
  // An all-day event's `end` is the *next* day's midnight (exclusive).
  return e.start.getTime() < end && e.end.getTime() > start;
}

export interface AgendaDay {
  date: Date;
  label: string;
  events: CalendarEvent[];
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Group upcoming events into per-day buckets over the next `days` days,
 *  skipping empty days. Multi-day events repeat in each day they span. */
export function groupByDay(events: CalendarEvent[], days = 7, now = new Date()): AgendaDay[] {
  const out: AgendaDay[] = [];
  const live = upcomingEvents(events, now);
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayEvents = live.filter((e) => onDay(e, date));
    if (!dayEvents.length) continue;
    const dayLabel = `${WEEKDAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`;
    const label = i === 0 ? `TODAY · ${dayLabel}` : i === 1 ? `TOMORROW · ${dayLabel}` : dayLabel;
    out.push({ date, label, events: dayEvents });
  }
  return out;
}

/** Short start-time label for an event ("3:30 PM" / "15:30" / "All day"). */
export function eventTimeLabel(e: CalendarEvent): string {
  if (e.allDay) return 'All day';
  const { time, suffix } = clockTime(e.start);
  return suffix ? `${time} ${suffix}` : time;
}

/** The headline for the chip/tile: the next event that hasn't ended, plus how
 *  many more are still to come today. */
export function nextEventSummary(
  events: CalendarEvent[],
  now = new Date(),
): { next: CalendarEvent; moreToday: number } | null {
  const live = upcomingEvents(events, now);
  if (!live.length) return null;
  const next = live[0];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const moreToday = live.slice(1).filter((e) => onDay(e, today)).length;
  return { next, moreToday };
}
