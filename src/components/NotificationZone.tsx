import { useEffect, useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { plantMoisture, plants } from '../config';
import { readMoisture } from './PlantWidget';

type CallHA = (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;

interface Props {
  entities: HassEntities;
  callHA?: CallHA;
  onOpenDetail?: (entityId: string) => void;
  onNavigate?: (viewId: string) => void;
}

interface Notice {
  id: string;
  icon: string;
  accent: string;
  title: string;
  sub: string;
  /** Optional priority — higher shows first. */
  priority: number;
  onClick?: () => void;
  /** Optional right-side badge (e.g. temps for the window tip). */
  right?: React.ReactNode;
  /** Optional inline action button (label + handler). */
  action?: { label: string; run: () => void };
}

const OUTDOOR_ID = 'weather.forecast_casa';
const ROOMS = [
  { name: 'Sala', tempId: 'sensor.temperatura_salotto', coverId: 'cover.0xc02cedfffe163a38' },
  { name: 'Camera', tempId: 'sensor.temperatura_camera', coverId: 'cover.tapparella_camera' },
];
const WARM_INDOOR = 24;
const COLD_INDOOR = 19;
const MIN_DELTA = 2;

const ROTATE_MS = 6000;

function num(entities: HassEntities, id: string): number | null {
  const raw = entities[id]?.state;
  if (raw == null) return null;
  const v = parseFloat(raw);
  return Number.isNaN(v) ? null : v;
}

/**
 * Home notification zone: gathers actionable alerts from live home state
 * (robot maintenance, water tanks, late-open shutters, low batteries) plus the
 * seasonal window-open tip, and rotates through them every few seconds when
 * there is more than one. Replaces the old single WindowSuggestion banner.
 */
export function NotificationZone({ entities, callHA, onOpenDetail, onNavigate }: Props) {
  const notices: Notice[] = [];
  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();

  // ── Robot: dirty water tank full ──
  if (entities['binary_sensor.roborock_qv_35a_dock_dirty_water_box']?.state === 'on') {
    notices.push({
      id: 'robot-dirty-water',
      icon: 'mdi-cup-water',
      accent: '#f59e0b',
      title: 'Robot · Acqua sporca',
      sub: 'Il serbatoio acqua sporca è pieno, da svuotare.',
      priority: 8,
      onClick: () => onNavigate?.('robot-v2'),
    });
  }
  // ── Robot: out of clean water ──
  if (entities['binary_sensor.roborock_qv_35a_mancanza_d_acqua']?.state === 'on') {
    notices.push({
      id: 'robot-no-water',
      icon: 'mdi-water-alert',
      accent: '#38bdf8',
      title: 'Robot · Manca acqua',
      sub: 'Riempi il serbatoio dell’acqua pulita.',
      priority: 8,
      onClick: () => onNavigate?.('robot-v2'),
    });
  }
  // ── Robot: maintenance expired (filter / brushes / sensor) ──
  const maint: { id: string; label: string }[] = [
    { id: 'sensor.roborock_qv_35a_tempo_di_filtraggio_rimanente', label: 'Filtro' },
    { id: 'sensor.roborock_qv_35a_tempo_residuo_della_spazzola_principale', label: 'Spazzola principale' },
    { id: 'sensor.roborock_qv_35a_tempo_residuo_della_spazzola_laterale', label: 'Spazzola laterale' },
    { id: 'sensor.roborock_qv_35a_tempo_residuo_del_sensore', label: 'Sensori' },
  ];
  const expired = maint.filter((m) => {
    const v = num(entities, m.id);
    return v != null && v < 1;
  });
  if (expired.length) {
    notices.push({
      id: 'robot-maint',
      icon: 'mdi-robot-vacuum-alert',
      accent: '#a855f7',
      title: 'Robot · Manutenzione',
      sub: `Da sostituire: ${expired.map((e) => e.label.toLowerCase()).join(', ')}.`,
      priority: 6,
      onClick: () => onNavigate?.('robot-v2'),
    });
  }

  // ── Robot error ──
  const robotErr = entities['sensor.roborock_qv_35a_errore_aspirapolvere']?.state;
  if (robotErr && !['none', 'unknown', 'unavailable', ''].includes(robotErr)) {
    notices.push({
      id: 'robot-error',
      icon: 'mdi-alert-circle',
      accent: '#ef4444',
      title: 'Robot · Errore',
      sub: `${robotErr}`,
      priority: 9,
      onClick: () => onNavigate?.('robot-v2'),
    });
  }

  // ── Low batteries (<= 15%) ──
  const lowBatt = Object.values(entities)
    .filter((e) => e.attributes.device_class === 'battery' && e.entity_id.startsWith('sensor.'))
    .map((e) => ({ e, lvl: parseFloat(e.state) }))
    .filter((b) => !Number.isNaN(b.lvl) && b.lvl <= 15);
  if (lowBatt.length) {
    const names = lowBatt.map((b) =>
      ((b.e.attributes.friendly_name as string) || b.e.entity_id)
        .replace(/\s*Batteria$/i, '')
        .replace(/\s*Battery Level$/i, '')
        .trim(),
    );
    notices.push({
      id: 'low-batt',
      icon: 'mdi-battery-alert-variant-outline',
      accent: '#ef4444',
      title: `Batteria scarica${lowBatt.length > 1 ? ` (${lowBatt.length})` : ''}`,
      sub: names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : ''),
      priority: 5,
      onClick: () => onNavigate?.('automations'),
    });
  }

  // ── Late-open shutters (after 22:30, tavolo/camera still open) ──
  const isLate = hh >= 22 && (hh > 22 || mm >= 30);
  const openLate = [
    { id: 'cover.tapparella_tavolo', name: 'Tavolo' },
    { id: 'cover.tapparella_camera', name: 'Camera' },
  ].filter((c) => {
    const e = entities[c.id];
    if (e?.state !== 'open') return false;
    // Chiusa fino al 60% (posizione <= 60) → considerata chiusa, niente avviso.
    const pos = e.attributes?.current_position;
    if (pos != null && Number(pos) <= 60) return false;
    return true;
  });
  if (isLate && openLate.length) {
    notices.push({
      id: 'shutters-late',
      icon: 'mdi-blinds-open',
      accent: '#6366f1',
      title: 'Tapparelle aperte',
      sub: `${openLate.map((c) => c.name.toLowerCase()).join(', ')} ancora ${openLate.length > 1 ? 'aperte' : 'aperta'}. È tardi.`,
      priority: 4,
      onClick: () => onOpenDetail?.(openLate[0].id),
    });
  }

  // ── Alarm: arm before sleep (from 23:30) ──
  const alarm = entities['alarm_control_panel.casa'];
  const alarmDisarmed = alarm?.state === 'disarmed';
  const alarmArmed = alarm?.state?.startsWith('armed');
  const afterBedtime = hh === 23 && mm >= 30;
  if (afterBedtime && alarmDisarmed && callHA) {
    notices.push({
      id: 'arm-night',
      icon: 'mdi-shield-moon',
      accent: '#6366f1',
      title: 'Allarme spento',
      sub: 'È tardi e l’allarme è disinserito. Inseriscilo prima di dormire.',
      priority: 7,
      action: { label: 'Inserisci', run: () => callHA('alarm_control_panel', 'alarm_arm_home', undefined, { entity_id: 'alarm_control_panel.casa' }) },
    });
  }

  // ── Alarm: disarm in the morning (06:00–11:00) ──
  const morning = hh >= 6 && hh < 11;
  if (morning && alarmArmed && callHA) {
    notices.push({
      id: 'disarm-morning',
      icon: 'mdi-shield-off-outline',
      accent: '#10b981',
      title: 'Allarme inserito',
      sub: 'Buongiorno! Vuoi disinserire l’allarme?',
      priority: 7,
      action: { label: 'Disinserisci', run: () => callHA('alarm_control_panel', 'alarm_disarm', undefined, { entity_id: 'alarm_control_panel.casa' }) },
    });
  }

  // ── Piante: da annaffiare quando il terreno scende sotto la soglia ──
  // Stessa soglia e stessa lettura del widget piante (plantMoisture in config.ts),
  // così widget e notifica non possono dire cose diverse.
  for (const plant of plants) {
    const moisture = readMoisture(entities, plant.moistureId);
    if (moisture == null) continue;
    if (moisture <= 0 || moisture >= plantMoisture.thirstyBelow) continue;
    const critical = moisture < plantMoisture.criticalBelow;
    notices.push({
      id: `plant-${plant.name.toLowerCase()}`,
      icon: plant.icon || 'mdi-sprout',
      accent: critical ? '#ef4444' : '#22c55e',
      title: `${plant.name} · da annaffiare`,
      sub: `Umidità del terreno al ${Math.round(moisture)}%. Dai acqua alla pianta.`,
      priority: critical ? 4 : 3,
      onClick: () => onOpenDetail?.(plant.moistureId),
    });
  }

  // ── Robot: idle for 3+ days ──
  const lastClean = entities['sensor.roborock_qv_35a_fine_dell_ultima_pulizia']?.state;
  if (lastClean) {
    const t = new Date(lastClean).getTime();
    if (!Number.isNaN(t)) {
      const days = (now.getTime() - t) / 86400000;
      const docked = entities['vacuum.roborock_qv_35a']?.state === 'docked';
      if (days >= 3 && docked && callHA) {
        notices.push({
          id: 'robot-idle',
          icon: 'mdi-robot-vacuum',
          accent: '#06b6d4',
          title: 'Robot fermo da giorni',
          sub: `Ultima pulizia ${Math.floor(days)} giorni fa. Vuoi avviarlo?`,
          priority: 4,
          action: { label: 'Avvia', run: () => callHA('vacuum', 'start', undefined, { entity_id: 'vacuum.roborock_qv_35a' }) },
        });
      }
    }
  }

  // ── Window-open tip (indoor vs outdoor temp) ──
  const outdoor = (() => {
    const raw = entities[OUTDOOR_ID]?.attributes?.temperature;
    return raw != null ? parseFloat(String(raw)) : null;
  })();
  if (outdoor != null && !Number.isNaN(outdoor)) {
    const rooms = ROOMS.map((r) => ({ ...r, temp: num(entities, r.tempId) }))
      .filter((r): r is typeof r & { temp: number } => r.temp != null);
    const cool = rooms
      .filter((r) => r.temp >= WARM_INDOOR && r.temp - outdoor >= MIN_DELTA)
      .sort((a, b) => b.temp - a.temp);
    const warm = rooms
      .filter((r) => r.temp <= COLD_INDOOR && outdoor - r.temp >= MIN_DELTA)
      .sort((a, b) => a.temp - b.temp);
    const target = cool[0] ?? warm[0];
    if (target) {
      const isCool = cool.length > 0;
      const delta = Math.abs(target.temp - outdoor).toFixed(0);
      notices.push({
        id: 'window-tip',
        icon: isCool ? 'mdi-weather-windy' : 'mdi-white-balance-sunny',
        accent: isCool ? '#38bdf8' : '#f59e0b',
        title: `Apri la finestra · ${target.name}`,
        sub: isCool
          ? `Fuori ${outdoor.toFixed(0)}°, ${delta}° meno che in ${target.name.toLowerCase()}.`
          : `Fuori ${outdoor.toFixed(0)}°, ${delta}° più che in ${target.name.toLowerCase()}.`,
        priority: 2,
        onClick: () => onOpenDetail?.(target.coverId),
        right: (
          <div className="nz-temps">
            <span className="nz-in">{target.temp.toFixed(0)}°</span>
            <span className="mdi mdi-arrow-right nz-arrow" />
            <span className="nz-out" style={{ color: isCool ? '#38bdf8' : '#f59e0b' }}>{outdoor.toFixed(0)}°</span>
          </div>
        ),
      });
    }
  }

  notices.sort((a, b) => b.priority - a.priority);

  const PER_PAGE = 3;
  const pageCount = Math.ceil(notices.length / PER_PAGE);

  const [page, setPage] = useState(0);

  // Reset page if the list shrinks below the current position.
  useEffect(() => {
    if (page >= pageCount) setPage(0);
  }, [pageCount, page]);

  // Rotate through pages when there's more than one page.
  useEffect(() => {
    if (pageCount <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pageCount), ROTATE_MS);
    return () => clearInterval(t);
  }, [pageCount]);

  if (!notices.length) return null;

  const start = Math.min(page, pageCount - 1) * PER_PAGE;
  const visible = notices.slice(start, start + PER_PAGE);

  return (
    <div className="nz">
      <div className="nz-row">
        {visible.map((n) => (
          <div
            key={n.id}
            className="nz-card"
            style={{ ['--nz-accent' as string]: n.accent }}
            onClick={n.onClick}
          >
            <span className="nz-icon">
              <span className={`mdi ${n.icon}`} />
            </span>
            <div className="nz-text">
              <span className="nz-title">{n.title}</span>
              <span className="nz-sub">{n.sub}</span>
            </div>
            {n.right}
            {n.action && (
              <button
                className="nz-action"
                onClick={(e) => {
                  e.stopPropagation();
                  n.action!.run();
                }}
              >
                {n.action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="nz-dots">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              className={`nz-dot ${i === page ? 'active' : ''}`}
              aria-label={`Pagina ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setPage(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
