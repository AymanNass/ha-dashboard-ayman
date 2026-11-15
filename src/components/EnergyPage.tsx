import { useEffect, useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { energyDevices, energyPricePerKwh, energyRunningWatts, type EnergyDevice } from '../config';
import { isHaConnected } from '../hooks/useHomeAssistant';

export type StatPeriod = '5minute' | 'hour' | 'day' | 'week' | 'month';
export interface StatBucket {
  start: number;
  end: number;
  change?: number | null;
}
export type GetStatistics = (
  statisticIds: string[],
  start: Date,
  end: Date,
  period: StatPeriod,
) => Promise<Record<string, StatBucket[]>>;

interface Props {
  entities: HassEntities;
  getStatistics: GetStatistics;
}

type Range = 'day' | 'week' | 'month';
const RANGES: { id: Range; label: string }[] = [
  { id: 'day', label: 'Oggi' },
  { id: 'week', label: 'Settimana' },
  { id: 'month', label: 'Mese' },
];

interface Bucket {
  key: string;
  /** Short axis label ('' = leave blank to avoid crowding). */
  label: string;
  /** Long description for the detail line. */
  full: string;
  /** kWh per device id. */
  values: Record<string, number>;
  total: number;
}

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const fmtKwh = (v: number): string => {
  const digits = v >= 10 ? 1 : 2;
  return v.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const fmtEuro = (v: number): string => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtWatts = (w: number): string =>
  w >= 1000 ? `${(w / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kW` : `${Math.round(w)} W`;

/** The empty time grid for a range: one bucket per hour (today) or per day. */
function buildBuckets(range: Range, now: Date): { start: Date; buckets: Bucket[]; keyOf: (d: Date) => string } {
  const blank = (key: string, label: string, full: string): Bucket => ({ key, label, full, values: {}, total: 0 });

  if (range === 'day') {
    const start = startOfDay(now);
    const pad = (n: number) => String(n).padStart(2, '0');
    const buckets = Array.from({ length: 24 }, (_, h) =>
      blank(String(h), h % 3 === 0 ? String(h) : '', `${pad(h)}:00 – ${pad((h + 1) % 24)}:00`),
    );
    return { start, buckets, keyOf: (d) => String(d.getHours()) };
  }

  const longDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  if (range === 'week') {
    const start = addDays(startOfDay(now), -6);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return blank(dayKey(d), d.toLocaleDateString('it-IT', { weekday: 'short' }), longDay(d));
    });
    return { start, buckets, keyOf: dayKey };
  }

  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const buckets = Array.from({ length: days }, (_, i) => {
    const n = i + 1;
    const d = new Date(y, m, n);
    return blank(dayKey(d), n === 1 || n % 5 === 0 ? String(n) : '', longDay(d));
  });
  return { start, buckets, keyOf: dayKey };
}

/**
 * Consumption per bucket (kWh) for every monitored device.
 *
 * HA's hourly long-term statistics only contain COMPLETED hours, so on its own
 * the chart would miss whatever the washing machine used in the current hour.
 * We therefore read the hourly stats first, then fill the gap up to "now" with
 * the 5-minute statistics, starting exactly where the hourly ones end (no gap,
 * no double counting).
 */
async function loadBuckets(getStatistics: GetStatistics, range: Range, now: Date): Promise<Bucket[]> {
  const { start, buckets, keyOf } = buildBuckets(range, now);
  const ids = energyDevices.map((d) => d.energyId);

  const hourly = await getStatistics(ids, start, now, 'hour');
  let covered = start.getTime();
  for (const id of ids) {
    for (const s of hourly[id] ?? []) covered = Math.max(covered, s.end);
  }
  const tail = covered < now.getTime() ? await getStatistics(ids, new Date(covered), now, '5minute') : {};

  const index = new Map(buckets.map((b) => [b.key, b]));
  const add = (series: Record<string, StatBucket[]>) => {
    for (const dev of energyDevices) {
      for (const s of series[dev.energyId] ?? []) {
        const bucket = index.get(keyOf(new Date(s.start)));
        if (!bucket) continue;
        const kwh = Math.max(0, s.change ?? 0);
        bucket.values[dev.id] = (bucket.values[dev.id] ?? 0) + kwh;
        bucket.total += kwh;
      }
    }
  };
  add(hourly);
  add(tail);
  return buckets;
}

function periodLabel(range: Range, now: Date): string {
  if (range === 'day') return 'oggi';
  if (range === 'week') return 'ultimi 7 giorni';
  return now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

function livePower(entities: HassEntities, dev: EnergyDevice): number | null {
  const n = Number.parseFloat(entities[dev.powerId]?.state ?? '');
  return Number.isFinite(n) ? n : null;
}

/**
 * Consumi: how much the monitored appliances (washer, dryer…) use, per day,
 * week and month, read from Home Assistant's long-term statistics.
 */
export function EnergyPage({ entities, getStatistics }: Props) {
  const [range, setRange] = useState<Range>('day');
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // Bumped when the HA connection comes up/drops so we (re)load once it's ready.
  const [connTick, setConnTick] = useState(0);

  useEffect(() => {
    const onConn = () => setConnTick((n) => n + 1);
    window.addEventListener('ha:connection', onConn);
    return () => window.removeEventListener('ha:connection', onConn);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (document.hidden || !isHaConnected()) return;
      const next = await loadBuckets(getStatistics, range, new Date());
      if (!cancelled) setBuckets(next);
    };
    setBuckets(null);
    setSelected(null);
    void run();
    // The numbers move slowly; once a minute keeps "today" fresh and cheap.
    const timer = window.setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [range, getStatistics, connTick]);

  const now = new Date();
  const perDevice = energyDevices.map((dev) => ({
    dev,
    kwh: buckets?.reduce((sum, b) => sum + (b.values[dev.id] ?? 0), 0) ?? 0,
  }));
  const grand = perDevice.reduce((sum, p) => sum + p.kwh, 0);
  const max = buckets ? Math.max(0.001, ...buckets.map((b) => b.total)) : 1;
  const hasData = grand > 0;
  const sel = selected != null && buckets ? buckets[selected] : null;

  return (
    <div className="en-page">
      <div className="en-hero">
        <div className="en-hero-icon"><span className="mdi mdi-flash" /></div>
        <div className="en-hero-main">
          <span className="en-hero-label">Consumi · {periodLabel(range, now)}</span>
          <span className="en-hero-value">
            {buckets ? fmtKwh(grand) : '—'} <small>kWh</small>
          </span>
          <span className="en-hero-sub">
            ≈ {fmtEuro(grand * energyPricePerKwh)}
            <em>stima a {fmtEuro(energyPricePerKwh)}/kWh</em>
          </span>
        </div>
      </div>

      <div className="en-tabs" role="tablist" aria-label="Periodo">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={`en-tab ${range === r.id ? 'active' : ''}`}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="en-devices">
        {perDevice.map(({ dev, kwh }) => {
          const w = livePower(entities, dev);
          const running = w != null && w > energyRunningWatts;
          return (
            <div key={dev.id} className="en-dev" style={{ ['--en-c' as string]: dev.color }}>
              <div className="en-dev-top">
                <span className="en-dev-icon"><span className={`mdi ${dev.icon}`} /></span>
                <span className="en-dev-id">
                  <span className="en-dev-name">{dev.name}</span>
                  <span className={`en-dev-live ${running ? 'run' : ''}`}>
                    {running ? `In funzione · ${fmtWatts(w)}` : w != null ? 'Spenta / standby' : 'Nessun dato'}
                  </span>
                </span>
              </div>
              <span className="en-dev-kwh">
                {buckets ? fmtKwh(kwh) : '—'} <small>kWh</small>
              </span>
              <span className="en-dev-cost">≈ {fmtEuro(kwh * energyPricePerKwh)}</span>
            </div>
          );
        })}
      </div>

      <div className="en-chart-card">
        <div className="en-chart-head">
          <div className="en-detail" aria-live="polite">
            {sel ? (
              <>
                <b>{sel.full}</b>
                <span>
                  {energyDevices
                    .map((d) => `${d.name} ${fmtKwh(sel.values[d.id] ?? 0)} kWh`)
                    .join(' · ')}
                </span>
              </>
            ) : (
              <span className="en-hint">Tocca una barra per il dettaglio</span>
            )}
          </div>
          <div className="en-legend">
            {energyDevices.map((d) => (
              <span key={d.id} style={{ ['--en-c' as string]: d.color }}>
                <i />
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {buckets == null ? (
          <div className="en-empty">Caricamento…</div>
        ) : (
          <div className="en-plotwrap">
            {hasData && <span className="en-ymax">{fmtKwh(max)} kWh</span>}
            <div className="en-gridtop" />
            <div className="en-bars">
              {buckets.map((b, i) => (
                <button
                  key={b.key}
                  type="button"
                  className={`en-col ${selected === i ? 'sel' : ''}`}
                  onClick={() => setSelected(selected === i ? null : i)}
                  aria-label={`${b.full}: ${fmtKwh(b.total)} kWh`}
                >
                  <span className="en-plot">
                    {b.total > 0 && (
                      <span className="en-stack" style={{ height: `${(b.total / max) * 100}%` }}>
                        {energyDevices.map((d) =>
                          (b.values[d.id] ?? 0) > 0 ? (
                            <span
                              key={d.id}
                              className="en-seg"
                              style={{ flexGrow: b.values[d.id], background: d.color }}
                            />
                          ) : null,
                        )}
                      </span>
                    )}
                  </span>
                  <span className="en-x">{b.label}</span>
                </button>
              ))}
            </div>
            {!hasData && <div className="en-empty en-empty-over">Nessun consumo registrato in questo periodo</div>}
          </div>
        )}
      </div>
    </div>
  );
}
