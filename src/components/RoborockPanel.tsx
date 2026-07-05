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
  { id: 'quiet', name: 'Silenzioso', icon: 'mdi-fan-speed-1' },
  { id: 'balanced', name: 'Bilanciato', icon: 'mdi-fan-speed-2' },
  { id: 'turbo', name: 'Turbo', icon: 'mdi-fan-speed-3' },
  { id: 'max', name: 'Max', icon: 'mdi-fan-alert' },
];

const VACUUM_ID = 'vacuum.roborock_qv_35a';
const MAP_ID = 'image.roborock_qv_35a_map_0';
const BATTERY_ID = 'sensor.roborock_qv_35a_batteria';
const AREA_ID = 'sensor.roborock_qv_35a_area_di_pulizia';
const TIME_ID = 'sensor.roborock_qv_35a_tempo_di_pulizie';
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
  const cleanTime = entities[TIME_ID]?.state ?? '—';
  const mapUrl = entities[MAP_ID]?.attributes?.entity_picture as string | undefined;

  // Last clean time formatted
  const lastClean = entities[LAST_CLEAN_ID]?.state;
  const lastCleanFormatted = lastClean
    ? new Date(lastClean).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  // Maintenance hours remaining
  const brushMain = entities[BRUSH_MAIN_ID]?.state ? Math.round(parseFloat(entities[BRUSH_MAIN_ID].state)) : null;
  const brushSide = entities[BRUSH_SIDE_ID]?.state ? Math.round(parseFloat(entities[BRUSH_SIDE_ID].state)) : null;
  const filter = entities[FILTER_ID]?.state ? Math.round(parseFloat(entities[FILTER_ID].state)) : null;
  const maintenanceOk = (brushMain ?? 999) > 10 && (brushSide ?? 999) > 10 && (filter ?? 999) > 10;

  // Sync fan speed from entity
  useEffect(() => {
    if (fanCurrent && FAN_SPEEDS.some((s) => s.id === fanCurrent)) {
      setFanSpeed(fanCurrent);
    }
  }, [fanCurrent]);

  const toggleRoom = (id: number) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRooms.size === ROOMS.length) setSelectedRooms(new Set());
    else setSelectedRooms(new Set(ROOMS.map((r) => r.id)));
  };

  const startCleaning = async () => {
    if (selectedRooms.size === 0) return;
    setStarting(true);
    await callHA('vacuum', 'set_fan_speed', { fan_speed: fanSpeed }, { entity_id: VACUUM_ID });
    try {
      await callHA('vacuum', 'send_command', {
        command: 'app_segment_clean',
        params: Array.from(selectedRooms),
      }, { entity_id: VACUUM_ID });
    } catch { /* may throw but works */ }
    setTimeout(() => setStarting(false), 2000);
  };

  const pause = () => callHA('vacuum', 'pause', undefined, { entity_id: VACUUM_ID });
  const dock = () => callHA('vacuum', 'return_to_base', undefined, { entity_id: VACUUM_ID });
  const resume = () => callHA('vacuum', 'start', undefined, { entity_id: VACUUM_ID });

  const batteryColor = (battery ?? 100) > 50 ? '#10b981' : (battery ?? 100) > 20 ? '#f59e0b' : '#ef4444';

  return (
    <div className="robo-layout">
      {/* ── Top row: Status + Map + Rooms ── */}
      <div className="robo-top">
        {/* Status card */}
        <div className="robo-card robo-status-card">
          <div className="robo-status-header">
            <span className={`robo-dot ${cleaning ? 'active' : docked ? 'docked' : ''}`} />
            <div>
              <div className="robo-status-title">
                {status === 'cleaning' ? 'In pulizia' :
                 status === 'docked' ? 'In base' :
                 status === 'returning' ? 'Torna alla base' :
                 status === 'paused' ? 'In pausa' : 'Pronto'}
              </div>
              <div className="robo-status-sub">
                {cleaning && currentRoom ? `Stanza: ${currentRoom}` : 'Completamente carico'}
              </div>
            </div>
          </div>

          {/* Battery ring */}
          <div className="robo-battery-ring">
            <svg viewBox="0 0 100 100" className="robo-ring-svg">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={batteryColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(battery ?? 100) * 2.64} 264`}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 0.5s' }}
              />
            </svg>
            <div className="robo-battery-text">
              <span className="robo-battery-pct">{battery ?? '—'}%</span>
              <span className="mdi mdi-lightning-bolt robo-battery-bolt" />
            </div>
          </div>

          {/* Info pills */}
          <div className="robo-info-pills">
            <div className="robo-pill">
              <span className="mdi mdi-information-outline" />
              <div><small>Stato</small><span>{status === 'docked' ? 'In carica' : status}</span></div>
            </div>
            <div className="robo-pill">
              <span className="mdi mdi-fan" />
              <div><small>Modalità</small><span>Aspirazione {fanCurrent}</span></div>
            </div>
            <div className="robo-pill">
              <span className="mdi mdi-clock-outline" />
              <div><small>Ultima pulizia</small><span>{lastCleanFormatted}</span></div>
            </div>
            <div className="robo-pill">
              <span className="mdi mdi-texture-box" />
              <div><small>Area pulita</small><span>{area} m²</span></div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="robo-status-actions">
            <button className="robo-action-btn" onClick={dock} disabled={docked}>
              <span className="mdi mdi-home-import-outline" /> Torna alla base
            </button>
            {docked ? (
              <button
                className={`robo-start-btn ${starting ? 'starting' : ''}`}
                onClick={startCleaning}
                disabled={selectedRooms.size === 0 || starting}
              >
                <span className={`mdi ${starting ? 'mdi-loading mdi-spin' : 'mdi-play-circle'}`} />
                Avvia pulizia
              </button>
            ) : cleaning ? (
              <button className="robo-action-btn pause" onClick={pause}>
                <span className="mdi mdi-pause-circle" /> Pausa
              </button>
            ) : status === 'paused' ? (
              <button className="robo-start-btn" onClick={resume}>
                <span className="mdi mdi-play-circle" /> Riprendi
              </button>
            ) : null}
          </div>
        </div>

        {/* Map */}
        <div className="robo-card robo-map-card">
          <h4><span className="mdi mdi-map" /> Mappa della casa</h4>
          <div className="robo-map-container">
            {mapUrl ? (
              <img src={mapUrl} alt="Mappa Roborock" className="robo-map-img" />
            ) : (
              <div className="robo-map-placeholder">
                <span className="mdi mdi-map-marker-question" />
                <span>Mappa non disponibile</span>
              </div>
            )}
          </div>
        </div>

        {/* Room selector */}
        <div className="robo-card robo-rooms-card">
          <div className="robo-rooms-header">
            <h4><span className="mdi mdi-target" /> Pulizia rapida</h4>
            <button className="robo-select-all" onClick={selectAll}>
              {selectedRooms.size === ROOMS.length ? 'Nessuna' : 'Tutte'}
            </button>
          </div>
          <div className="robo-room-list">
            <button
              className={`robo-room-item ${selectedRooms.size === ROOMS.length ? 'active' : ''}`}
              onClick={selectAll}
            >
              <span className="mdi mdi-home" />
              <span>Tutte le stanze</span>
            </button>
            {ROOMS.map((room) => (
              <button
                key={room.id}
                className={`robo-room-item ${selectedRooms.has(room.id) ? 'active' : ''}`}
                onClick={() => toggleRoom(room.id)}
              >
                <span className={`mdi ${room.icon}`} />
                <span>{room.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom row: Clean mode + Fan speed + Maintenance ── */}
      <div className="robo-bottom">
        <div className="robo-card robo-options-card">
          <h4><span className="mdi mdi-broom" /> Tipo di pulizia</h4>
          <div className="robo-option-chips">
            {CLEAN_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`robo-option-chip ${cleanMode === mode.id ? 'active' : ''}`}
                onClick={() => setCleanMode(mode.id)}
              >
                <span className={`mdi ${mode.icon}`} />
                <span>{mode.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="robo-card robo-options-card">
          <h4><span className="mdi mdi-fan" /> Potenza aspirazione</h4>
          <div className="robo-option-chips">
            {FAN_SPEEDS.map((speed) => (
              <button
                key={speed.id}
                className={`robo-option-chip ${fanSpeed === speed.id ? 'active' : ''}`}
                onClick={() => setFanSpeed(speed.id)}
              >
                <span className={`mdi ${speed.icon}`} />
                <span>{speed.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="robo-card robo-maint-card">
          <h4><span className="mdi mdi-wrench" /> Manutenzione</h4>
          <div className={`robo-maint-status ${maintenanceOk ? '' : 'warn'}`}>
            <span className={`mdi ${maintenanceOk ? 'mdi-check-circle' : 'mdi-alert-circle'}`} />
            <span>{maintenanceOk ? 'Filtro e spazzole OK' : 'Controllo necessario'}</span>
          </div>
          <div className="robo-maint-items">
            <div className="robo-maint-item">
              <span>Spazzola principale</span>
              <span>{brushMain != null ? `${brushMain}h` : '—'}</span>
            </div>
            <div className="robo-maint-item">
              <span>Spazzola laterale</span>
              <span>{brushSide != null ? `${brushSide}h` : '—'}</span>
            </div>
            <div className="robo-maint-item">
              <span>Filtro</span>
              <span>{filter != null ? `${filter}h` : '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
