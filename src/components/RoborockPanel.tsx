import { useState } from 'react';
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
  { id: 'deep', name: 'Profonda', icon: 'mdi-flash' },
];

const FAN_SPEEDS = [
  { id: 'quiet', name: 'Silenzioso', icon: 'mdi-fan-speed-1' },
  { id: 'balanced', name: 'Bilanciato', icon: 'mdi-fan-speed-2' },
  { id: 'turbo', name: 'Turbo', icon: 'mdi-fan-speed-3' },
  { id: 'max', name: 'Max', icon: 'mdi-fan-alert' },
];

const VACUUM_ID = 'vacuum.roborock_qv_35a';

/**
 * Full Roborock control panel — room selector, clean mode, fan speed,
 * quick actions, and live status.
 */
export function RoborockPanel({ entities, callHA }: Props) {
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [cleanMode, setCleanMode] = useState('vacuum');
  const [fanSpeed, setFanSpeed] = useState('turbo');
  const [starting, setStarting] = useState(false);

  const vacuum = entities[VACUUM_ID];
  const battery = vacuum ? (vacuum.attributes.battery_level as number | undefined) ?? null : null;
  const status = vacuum?.state ?? 'unknown';
  const currentRoom = entities['sensor.roborock_qv_35a_current_room']?.state ?? '';
  const cleaning = status === 'cleaning';
  const docked = status === 'docked' || status === 'idle';

  const toggleRoom = (id: number) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRooms.size === ROOMS.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(ROOMS.map((r) => r.id)));
    }
  };

  const startCleaning = async () => {
    if (selectedRooms.size === 0) return;
    setStarting(true);

    // Set fan speed
    await callHA('vacuum', 'set_fan_speed', { fan_speed: fanSpeed }, { entity_id: VACUUM_ID });

    // Send room clean command
    const rooms = Array.from(selectedRooms);
    try {
      await callHA('vacuum', 'send_command', {
        command: 'app_segment_clean',
        params: rooms,
      }, { entity_id: VACUUM_ID });
    } catch {
      // May throw but still works
    }

    setTimeout(() => setStarting(false), 2000);
  };

  const pause = () => callHA('vacuum', 'pause', undefined, { entity_id: VACUUM_ID });
  const dock = () => callHA('vacuum', 'return_to_base', undefined, { entity_id: VACUUM_ID });
  const resume = () => callHA('vacuum', 'start', undefined, { entity_id: VACUUM_ID });

  return (
    <div className="roborock-panel">
      {/* Status bar */}
      <div className="robo-status">
        <span className={`mdi mdi-robot-vacuum robo-status-icon ${cleaning ? 'cleaning' : ''}`} />
        <div className="robo-status-info">
          <span className="robo-status-state">
            {status === 'cleaning' ? 'Pulizia in corso' :
             status === 'docked' ? 'In base' :
             status === 'returning' ? 'Torna alla base' :
             status === 'paused' ? 'In pausa' :
             status === 'idle' ? 'Pronto' : status}
          </span>
          {currentRoom && cleaning && (
            <span className="robo-status-room">Stanza: {currentRoom}</span>
          )}
        </div>
        {battery != null && (
          <span className="robo-battery">
            <span className={`mdi ${battery > 75 ? 'mdi-battery-high' : battery > 30 ? 'mdi-battery-medium' : 'mdi-battery-low'}`} />
            {battery}%
          </span>
        )}
      </div>

      {/* Room selector */}
      <div className="robo-section">
        <div className="robo-section-header">
          <h4><span className="mdi mdi-floor-plan" /> Stanze</h4>
          <button className="robo-select-all" onClick={selectAll}>
            {selectedRooms.size === ROOMS.length ? 'Deseleziona' : 'Tutte'}
          </button>
        </div>
        <div className="robo-chips">
          {ROOMS.map((room) => (
            <button
              key={room.id}
              className={`robo-chip ${selectedRooms.has(room.id) ? 'active' : ''}`}
              onClick={() => toggleRoom(room.id)}
            >
              <span className={`mdi ${room.icon}`} />
              <span>{room.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clean mode */}
      <div className="robo-section">
        <h4><span className="mdi mdi-cog" /> Tipo pulizia</h4>
        <div className="robo-chips">
          {CLEAN_MODES.map((mode) => (
            <button
              key={mode.id}
              className={`robo-chip ${cleanMode === mode.id ? 'active' : ''}`}
              onClick={() => setCleanMode(mode.id)}
            >
              <span className={`mdi ${mode.icon}`} />
              <span>{mode.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fan speed */}
      <div className="robo-section">
        <h4><span className="mdi mdi-fan" /> Potenza aspirazione</h4>
        <div className="robo-chips">
          {FAN_SPEEDS.map((speed) => (
            <button
              key={speed.id}
              className={`robo-chip ${fanSpeed === speed.id ? 'active' : ''}`}
              onClick={() => setFanSpeed(speed.id)}
            >
              <span className={`mdi ${speed.icon}`} />
              <span>{speed.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="robo-actions">
        {docked && (
          <button
            className={`robo-start-btn ${starting ? 'starting' : ''}`}
            onClick={startCleaning}
            disabled={selectedRooms.size === 0 || starting}
          >
            <span className={`mdi ${starting ? 'mdi-loading mdi-spin' : 'mdi-play-circle'}`} />
            {starting ? 'Avvio...' : `Pulisci ${selectedRooms.size} ${selectedRooms.size === 1 ? 'stanza' : 'stanze'}`}
          </button>
        )}
        {cleaning && (
          <button className="robo-action-btn" onClick={pause}>
            <span className="mdi mdi-pause-circle" /> Pausa
          </button>
        )}
        {status === 'paused' && (
          <button className="robo-action-btn" onClick={resume}>
            <span className="mdi mdi-play-circle" /> Riprendi
          </button>
        )}
        {(cleaning || status === 'paused') && (
          <button className="robo-action-btn dock" onClick={dock}>
            <span className="mdi mdi-home-import-outline" /> Torna alla base
          </button>
        )}
      </div>
    </div>
  );
}
