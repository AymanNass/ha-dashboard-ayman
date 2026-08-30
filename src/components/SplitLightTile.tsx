import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';

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

export function SplitLightTile({ leftEntity, rightEntity, leftLabel, rightLabel, callHA, onOpenDetail, leftId, rightId, enterIndex, image }: Props) {
  const leftOn = leftEntity.state === 'on';
  const rightOn = rightEntity.state === 'on';
  const bothOn = leftOn && rightOn;

  const leftBrightness = leftOn ? (leftEntity.attributes.brightness as number | undefined) : undefined;
  const rightBrightness = rightOn ? (rightEntity.attributes.brightness as number | undefined) : undefined;
  const leftPct = leftBrightness != null ? Math.round((leftBrightness / 255) * 100) : undefined;
  const rightPct = rightBrightness != null ? Math.round((rightBrightness / 255) * 100) : undefined;

  const toggle = (entityId: string, isOn: boolean) => {
    callHA('light', isOn ? 'turn_off' : 'turn_on', undefined, { entity_id: entityId });
  };

  const toggleBoth = () => {
    // If any is on, turn both off. Otherwise turn both on.
    const service = (leftOn || rightOn) ? 'turn_off' : 'turn_on';
    callHA('light', service, undefined, { entity_id: [leftId, rightId] });
  };

  return (
    <div
      className={`tile split-tile span tile-enter ${image ? 'has-bg' : ''}`}
      style={{
        '--enter-i': enterIndex ?? 0,
        ...(image ? { '--split-bg': `url("${image}")` } as React.CSSProperties : {}),
      } as React.CSSProperties}
    >
      {image && <div className="split-bg" />}
      {/* Left zone */}
      <button
        className={`split-zone split-left ${leftOn ? 'is-on' : ''}`}
        onClick={() => toggle(leftId, leftOn)}
        onContextMenu={(e) => { e.preventDefault(); onOpenDetail(leftId); }}
      >
        <span className="mdi mdi-lamp split-icon" />
        <span className="split-label">{leftLabel}</span>
        <span className="split-state">{leftOn ? (leftPct != null ? `${leftPct}%` : 'On') : 'Off'}</span>
      </button>

      {/* Center zone — both */}
      <button
        className={`split-zone split-center ${bothOn ? 'is-on' : (leftOn || rightOn) ? 'is-partial' : ''}`}
        onClick={toggleBoth}
      >
        <span className="mdi mdi-lightbulb-group split-icon" />
        <span className="split-state">
          {bothOn ? 'Entrambe' : (leftOn || rightOn) ? '1 accesa' : 'Entrambe off'}
        </span>
      </button>

      {/* Right zone */}
      <button
        className={`split-zone split-right ${rightOn ? 'is-on' : ''}`}
        onClick={() => toggle(rightId, rightOn)}
        onContextMenu={(e) => { e.preventDefault(); onOpenDetail(rightId); }}
      >
        <span className="mdi mdi-lamp split-icon" />
        <span className="split-label">{rightLabel}</span>
        <span className="split-state">{rightOn ? (rightPct != null ? `${rightPct}%` : 'On') : 'Off'}</span>
      </button>
    </div>
  );
}
