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
  const isCleaning = state === 'cleaning';
  const dirtyWater = entities['binary_sensor.roborock_qv_35a_dock_dirty_water_box']?.state === 'on';

  const stateLabel = state === 'docked' ? 'In base' : state === 'cleaning' ? 'Sta pulendo' : state === 'returning' ? 'Torna alla base' : state === 'paused' ? 'In pausa' : state ?? '—';
  // Colored only while actively cleaning; neutral (muted) in every other state,
  // including errors — keeps the home tile calm per the dashboard owner's ask.
  const stateColor = isCleaning ? '#10b981' : 'var(--text-muted)';

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
        {!isCleaning && (
          <button className="robot-mini-go" onClick={quickClean} title="Avvia pulizia">
            <span className="mdi mdi-play" />
          </button>
        )}
      </div>
    </div>
  );
}
