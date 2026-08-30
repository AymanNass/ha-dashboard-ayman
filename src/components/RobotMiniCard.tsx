import type { HassEntities } from 'home-assistant-js-websocket';

interface Props {
  entities: HassEntities;
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
  onNavigate: (viewId: string) => void;
}

export function RobotMiniCard({ entities, callHA, onNavigate }: Props) {
  const vac = entities['vacuum.roborock_qv_35a'];
  if (!vac) return null;

  const state = vac.state;
  const battery = parseFloat(entities['sensor.roborock_qv_35a_batteria']?.state ?? '0');
  const charging = entities['binary_sensor.roborock_qv_35a_in_ricarica']?.state === 'on';
  const isCleaning = state === 'cleaning';
  const dirtyWater = entities['binary_sensor.roborock_qv_35a_dock_dirty_water_box']?.state === 'on';

  const stateLabel = state === 'docked' ? 'In base' : state === 'cleaning' ? 'Sta pulendo' : state === 'returning' ? 'Torna alla base' : state === 'paused' ? 'In pausa' : state ?? '—';
  const stateColor = isCleaning ? '#10b981' : state === 'error' ? '#ef4444' : 'var(--text-muted)';

  const quickClean = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Avviare pulizia tutta casa?')) {
      callHA('vacuum', 'start', undefined, { entity_id: 'vacuum.roborock_qv_35a' });
    }
  };

  return (
    <div className="robot-mini" onClick={() => onNavigate('robot-v2')}>
      <div className="robot-mini-left">
        <span className={`mdi mdi-robot-vacuum robot-mini-icon ${isCleaning ? 'cleaning' : ''}`} style={{ color: stateColor }} />
        <div className="robot-mini-info">
          <span className="robot-mini-name">Roborock</span>
          <span className="robot-mini-state">
            {stateLabel}
            {dirtyWater && <span className="robot-mini-warn"> · ⚠ Acqua sporca</span>}
          </span>
        </div>
      </div>
      <div className="robot-mini-right">
        <span className="robot-mini-batt">
          <span className={`mdi ${battery > 80 ? 'mdi-battery' : battery > 40 ? 'mdi-battery-50' : 'mdi-battery-20'}`} />
          {Math.round(battery)}%
          {charging && <span className="mdi mdi-lightning-bolt" style={{ fontSize: 10, color: '#10b981' }} />}
        </span>
        {!isCleaning && (
          <button className="robot-mini-go" onClick={quickClean} title="Avvia pulizia">
            <span className="mdi mdi-play" />
          </button>
        )}
      </div>
    </div>
  );
}
