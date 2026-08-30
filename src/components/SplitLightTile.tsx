import type { HassEntity } from 'home-assistant-js-websocket';

interface Props {
  leftEntity: HassEntity;
  rightEntity: HassEntity;
  leftLabel: string;
  rightLabel: string;
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
  onOpenDetail: (entityId: string) => void;
  leftId: string;
  rightId: string;
  enterIndex?: number;
  image?: string;
}

export function SplitLightTile({ leftEntity, rightEntity, leftLabel, rightLabel, callHA, onOpenDetail, leftId, rightId, enterIndex }: Props) {
  const leftOn = leftEntity.state === 'on';
  const rightOn = rightEntity.state === 'on';

  const toggle = (entityId: string, isOn: boolean) => {
    callHA('light', isOn ? 'turn_off' : 'turn_on', undefined, { entity_id: entityId });
  };

  const toggleBoth = () => {
    const service = (leftOn || rightOn) ? 'turn_off' : 'turn_on';
    callHA('light', service, undefined, { entity_id: [leftId, rightId] });
  };

  return (
    <div
      className="tile split-tile span tile-enter"
      style={{ '--enter-i': enterIndex ?? 0 } as React.CSSProperties}
    >
      {/* Left lamp */}
      <button
        className={`bed-lamp bed-lamp-left ${leftOn ? 'is-on' : ''}`}
        onClick={() => toggle(leftId, leftOn)}
        onContextMenu={(e) => { e.preventDefault(); onOpenDetail(leftId); }}
      >
        <span className="mdi mdi-lamp bed-lamp-icon" />
        <span className="bed-lamp-name">{leftLabel}</span>
      </button>

      {/* Center: minimal bed + both toggle */}
      <button className="bed-center" onClick={toggleBoth}>
        <div className="bed-shape">
          <div className="bed-headboard" />
          <div className="bed-mattress" />
        </div>
        <span className="bed-center-label">
          {leftOn && rightOn ? 'Entrambe' : leftOn || rightOn ? '1 accesa' : 'Spente'}
        </span>
      </button>

      {/* Right lamp */}
      <button
        className={`bed-lamp bed-lamp-right ${rightOn ? 'is-on' : ''}`}
        onClick={() => toggle(rightId, rightOn)}
        onContextMenu={(e) => { e.preventDefault(); onOpenDetail(rightId); }}
      >
        <span className="mdi mdi-lamp bed-lamp-icon" />
        <span className="bed-lamp-name">{rightLabel}</span>
      </button>
    </div>
  );
}
