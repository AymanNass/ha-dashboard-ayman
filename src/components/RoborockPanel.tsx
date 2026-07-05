import { useState, useEffect } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';

interface Props {
  entities: HassEntities;
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
}

const ROOMS = [
  { id: 1, name: 'Soggiorno', icon: 'mdi-sofa' },
  { id: 2, name: 'Cucina', icon: 'mdi-countertop' },
  { id: 3, name: 'Bagno', icon: 'mdi-shower' },
  { id: 4, name: 'Corridoio', icon: 'mdi-foot-print' },
  { id: 5, name: 'Camera', icon: 'mdi-bed-king' },
  { id: 6, name: 'Cameretta', icon: 'mdi-baby-face-outline' },
];

const CLEAN_MODES = [
  { id: 'vacuum', name: 'Aspira', icon: 'mdi-vacuum' },
  { id: 'mop', name: 'Aspira e lava', icon: 'mdi-broom' },
  { id: 'mop_only', name: 'Solo lava', icon: 'mdi-water' },
];

const FAN_SPEEDS = [
  { id: 'quiet', name: 'Silenzioso' },
  { id: 'balanced', name: 'Bilanciato' },
  { id: 'turbo', name: 'Turbo' },
  { id: 'max', name: 'Max' },
];

const VACUUM_ID = 'vacuum.roborock_qv_35a';
const MAP_ID = 'image.roborock_qv_35a_map_0';
const BATTERY_ID = 'sensor.roborock_qv_35a_batteria';
const AREA_ID = 'sensor.roborock_qv_35a_area_di_pulizia';
const LAST_CLEAN_ID = 'sensor.roborock_qv_35a_inizio_dell_ultima_pulizia';
const BRUSH_MAIN_ID = 'sensor.roborock_qv_35a_tempo_residuo_della_spazzola_principale';
const BRUSH_SIDE_ID = 'sensor.roborock_qv_35a_tempo_residuo_della_spazzola_laterale';
const FILTER_ID = 'sensor.roborock_qv_35a_tempo_di_filtraggio_rimanente';

export function RoborockPanel({ entities, callHA }: Props) {
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [cleanMode, setCleanMode] = useState('vacuum');
  const [fanSpeed, setFanSpeed] = useState('turbo');
  const [starting, setStarting] = useState(false);

  const vacuum = entities[VACUUM_ID];
  const battery = entities[BATTERY_ID]?.state ? parseInt(entities[BATTERY_ID].state) : null;
  const status = vacuum?.state ?? 'unknown';
  const fanCurrent = (vacuum?.attributes.fan_speed as string) ?? 'turbo';
  const currentRoom = entities['sensor.roborock_qv_35a_current_room']?.state ?? '';
  const cleaning = status === 'cleaning';
  const docked = status === 'docked' || status === 'idle';
  const area = entities[AREA_ID]?.state ?? '—';
  const mapUrl = entities[MAP_ID]?.attributes?.entity_picture as string | undefined;

  const lastClean = entities[LAST_CLEAN_ID]?.state;
  const lastCleanFormatted = lastClean
    ? new Date(lastClean).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const brushMain = entities[BRUSH_MAIN_ID]?.state ? Math.round(parseFloat(entities[BRUSH_MAIN_ID].state)) : null;
  const brushSide = entities[BRUSH_SIDE_ID]?.state ? Math.round(parseFloat(entities[BRUSH_SIDE_ID].state)) : null;
  const filter = entities[FILTER_ID]?.state ? Math.round(parseFloat(entities[FILTER_ID].state)) : null;

  useEffect(() => {
    if (fanCurrent && FAN_SPEEDS.some((s) => s.id === fanCurrent)) setFanSpeed(fanCurrent);
  }, [fanCurrent]);

  const toggleRoom = (id: number) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedRooms(selectedRooms.size === ROOMS.length ? new Set() : new Set(ROOMS.map((r) => r.id)));
  };

  const startCleaning = async () => {
    if (selectedRooms.size === 0) return;
    setStarting(true);
    await callHA('vacuum', 'set_fan_speed', { fan_speed: fanSpeed }, { entity_id: VACUUM_ID });
    try {
      await callHA('vacuum', 'send_command', { command: 'app_segment_clean', params: Array.from(selectedRooms) }, { entity_id: VACUUM_ID });
    } catch { /* may throw but works */ }
    setTimeout(() => setStarting(false), 2000);
  };

  const pause = () => callHA('vacuum', 'pause', undefined, { entity_id: VACUUM_ID });
  const dock = () => callHA('vacuum', 'return_to_base', undefined, { entity_id: VACUUM_ID });
  const resume = () => callHA('vacuum', 'start', undefined, { entity_id: VACUUM_ID });

  const statusLabel = status === 'cleaning' ? 'In pulizia' : status === 'docked' ? 'In base' :
    status === 'returning' ? 'Ritorno alla base' : status === 'paused' ? 'In pausa' : 'Pronto';

  const pctBar = (hours: number | null, max: number) => {
    if (hours == null) return 0;
    return Math.max(0, Math.min(100, (hours / max) * 100));
  };

  return (
    <div className="rv-layout">
      {/* ── CARD 1: Stato & Mappa ── */}
      <div className="rv-card rv-card-status">
        <div className="rv-card-title"><span className="mdi mdi-robot-vacuum" /> Stato</div>

        {/* Top: Robot image + Battery ring + Status info */}
        <div className="rv-status-top">
          <div className="rv-robot-img">
            <img src="/roborock.webp" alt="Roborock" />
          </div>
          <div className="rv-battery-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke={battery != null && battery > 50 ? '#10b981' : battery != null && battery > 20 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(battery ?? 100) * 2.51} 251`}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 0.5s' }}
              />
            </svg>
            <div className="rv-battery-center">
              <span className="rv-battery-pct">{battery ?? '—'}%</span>
              <span className="mdi mdi-lightning-bolt rv-bolt" />
            </div>
          </div>
          <div className="rv-status-info">
            <div className="rv-status-line">
              <span className={`rv-dot ${cleaning ? 'pulse' : ''}`} />
              <strong>{statusLabel}</strong>
            </div>
            {cleaning && currentRoom && <div className="rv-status-room">{currentRoom}</div>}
            <div className="rv-status-detail"><span className="mdi mdi-clock-outline" /> {lastCleanFormatted}</div>
            <div className="rv-status-detail"><span className="mdi mdi-texture-box" /> {area} m²</div>
          </div>
        </div>

        {/* Bottom: Map */}
        <div className="rv-map">
          {mapUrl ? <img src={mapUrl} alt="Mappa" /> : (
            <div className="rv-map-empty"><span className="mdi mdi-map-outline" /></div>
          )}
        </div>

        {(cleaning || status === 'paused') && (
          <div className="rv-quick">
            {cleaning && <button className="rv-btn-sm" onClick={pause}><span className="mdi mdi-pause" /> Pausa</button>}
            {status === 'paused' && <button className="rv-btn-sm green" onClick={resume}><span className="mdi mdi-play" /> Riprendi</button>}
            <button className="rv-btn-sm" onClick={dock}><span className="mdi mdi-home-import-outline" /> Base</button>
          </div>
        )}
      </div>

      {/* ── CARD 2: Pulizia ── */}
      <div className="rv-card rv-card-clean">
        <div className="rv-card-title"><span className="mdi mdi-broom" /> Pulizia</div>

        <div className="rv-rooms-grid">
          <button className={`rv-room ${selectedRooms.size === ROOMS.length ? 'active' : ''}`} onClick={selectAll}>
            <span className="mdi mdi-home" /><span>Tutte</span>
          </button>
          {ROOMS.map((r) => (
            <button key={r.id} className={`rv-room ${selectedRooms.has(r.id) ? 'active' : ''}`} onClick={() => toggleRoom(r.id)}>
              <span className={`mdi ${r.icon}`} /><span>{r.name}</span>
            </button>
          ))}
        </div>

        <div className="rv-options">
          <div className="rv-opt-group">
            <label>Modalità</label>
            <div className="rv-opt-row">
              {CLEAN_MODES.map((m) => (
                <button key={m.id} className={`rv-opt ${cleanMode === m.id ? 'active' : ''}`} onClick={() => setCleanMode(m.id)}>
                  <span className={`mdi ${m.icon}`} />{m.name}
                </button>
              ))}
            </div>
          </div>
          <div className="rv-opt-group">
            <label>Potenza</label>
            <div className="rv-opt-row">
              {FAN_SPEEDS.map((s) => (
                <button key={s.id} className={`rv-opt ${fanSpeed === s.id ? 'active' : ''}`} onClick={() => setFanSpeed(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className={`rv-start ${starting ? 'starting' : ''}`}
          onClick={startCleaning}
          disabled={selectedRooms.size === 0 || starting}
        >
          <span className={`mdi ${starting ? 'mdi-loading mdi-spin' : 'mdi-play-circle'}`} />
          {starting ? 'Avvio...' : `Avvia pulizia (${selectedRooms.size} ${selectedRooms.size === 1 ? 'stanza' : 'stanze'})`}
        </button>
      </div>

      {/* ── CARD 3: Manutenzione ── */}
      <div className="rv-card rv-card-maint">
        <div className="rv-card-title"><span className="mdi mdi-wrench" /> Manutenzione</div>
        <div className="rv-maint-list">
          <div className="rv-maint-row">
            <span>Spazzola principale</span>
            <div className="rv-bar"><div className="rv-bar-fill" style={{ width: `${pctBar(brushMain, 300)}%` }} /></div>
            <span className="rv-hours">{brushMain ?? '—'}h</span>
          </div>
          <div className="rv-maint-row">
            <span>Spazzola laterale</span>
            <div className="rv-bar"><div className="rv-bar-fill" style={{ width: `${pctBar(brushSide, 200)}%` }} /></div>
            <span className="rv-hours">{brushSide ?? '—'}h</span>
          </div>
          <div className="rv-maint-row">
            <span>Filtro</span>
            <div className="rv-bar"><div className="rv-bar-fill" style={{ width: `${pctBar(filter, 150)}%` }} /></div>
            <span className="rv-hours">{filter ?? '—'}h</span>
          </div>
        </div>
        <div className="rv-maint-extra">
          <div className="rv-stat"><span className="mdi mdi-counter" /> Pulizie totali: {entities['sensor.roborock_qv_35a_total_cleaning_count']?.state ?? '—'}</div>
          <div className="rv-stat"><span className="mdi mdi-map-marker" /> Area totale: {entities['sensor.roborock_qv_35a_area_di_pulizia_totale']?.state ?? '—'} m²</div>
        </div>
      </div>
    </div>
  );
}
