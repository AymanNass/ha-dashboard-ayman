import type { HassEntities } from 'home-assistant-js-websocket';

interface Props {
  entities: HassEntities;
  onOpenDetail?: (entityId: string) => void;
}

const OUTDOOR_ID = 'weather.forecast_casa';

// Only the rooms that actually have a window.
const ROOMS = [
  { name: 'Sala', tempId: 'sensor.temperatura_salotto', coverId: 'cover.0xc02cedfffe163a38' },
  { name: 'Camera', tempId: 'sensor.temperatura_camera', coverId: 'cover.tapparella_camera' },
];

// Thresholds
const WARM_INDOOR = 24; // indoor considered warm above this
const COLD_INDOOR = 19; // indoor considered cold below this
const MIN_DELTA = 2; // require at least this much difference to bother suggesting

/**
 * Compact banner that compares indoor room temperatures (rooms with windows)
 * against the outdoor temperature and suggests opening a specific window when
 * it would actually help — cool the house down in summer, or warm it up when
 * indoor is cold and outside is milder.
 */
export function WindowSuggestion({ entities, onOpenDetail }: Props) {
  const outdoorRaw = entities[OUTDOOR_ID]?.attributes?.temperature;
  const outdoor = outdoorRaw != null ? parseFloat(String(outdoorRaw)) : null;
  if (outdoor == null || Number.isNaN(outdoor)) return null;

  // Gather rooms with a valid indoor temperature.
  const rooms = ROOMS.map((r) => {
    const raw = entities[r.tempId]?.state;
    const t = raw != null ? parseFloat(raw) : NaN;
    return { ...r, temp: t };
  }).filter((r) => !Number.isNaN(r.temp));

  if (!rooms.length) return null;

  // COOLING case: some room is warm and outside is meaningfully cooler.
  const coolCandidates = rooms
    .filter((r) => r.temp >= WARM_INDOOR && r.temp - outdoor >= MIN_DELTA)
    .sort((a, b) => b.temp - a.temp);

  // HEATING case: some room is cold and outside is meaningfully warmer.
  const warmCandidates = rooms
    .filter((r) => r.temp <= COLD_INDOOR && outdoor - r.temp >= MIN_DELTA)
    .sort((a, b) => a.temp - b.temp);

  let mode: 'cool' | 'warm' | null = null;
  let target: (typeof rooms)[number] | null = null;

  if (coolCandidates.length) {
    mode = 'cool';
    target = coolCandidates[0];
  } else if (warmCandidates.length) {
    mode = 'warm';
    target = warmCandidates[0];
  }

  if (!mode || !target) return null;

  const delta = Math.abs(target.temp - outdoor).toFixed(0);
  const icon = mode === 'cool' ? 'mdi-weather-windy' : 'mdi-white-balance-sunny';
  const accent = mode === 'cool' ? '#38bdf8' : '#f59e0b';
  const msg =
    mode === 'cool'
      ? `Fuori ci sono ${outdoor.toFixed(0)}°, ${delta}° meno che in ${target.name.toLowerCase()}. Conviene aprire la finestra.`
      : `Fuori ci sono ${outdoor.toFixed(0)}°, ${delta}° più che in ${target.name.toLowerCase()}. Puoi aprire per scaldare.`;

  return (
    <div
      className="window-suggest"
      style={{ ['--ws-accent' as string]: accent }}
      onClick={() => onOpenDetail?.(target!.coverId)}
    >
      <span className="ws-icon">
        <span className={`mdi ${icon}`} />
      </span>
      <div className="ws-text">
        <span className="ws-title">Apri la finestra · {target.name}</span>
        <span className="ws-sub">{msg}</span>
      </div>
      <div className="ws-temps">
        <span className="ws-in">{target.temp.toFixed(0)}°</span>
        <span className="mdi mdi-arrow-right ws-arrow" />
        <span className="ws-out">{outdoor.toFixed(0)}°</span>
      </div>
    </div>
  );
}
