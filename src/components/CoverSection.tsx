import { useState, useEffect, useRef } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';

interface CoverDef {
  entity_id: string;
  name: string;
}

interface Props {
  entities: HassEntities;
  covers: CoverDef[];
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
  onOpenDetail: (entityId: string) => void;
}

function CoverCard({ entity_id, name, entities, callHA, onOpenDetail }: CoverDef & { entities: HassEntities; callHA: Props['callHA']; onOpenDetail: Props['onOpenDetail'] }) {
  const entity = entities[entity_id];
  const position = (entity?.attributes.current_position as number) ?? (entity?.state === 'open' ? 100 : 0);
  const display = position;
  // Shutter covers from top: 100% open = 0% covered, 0% open = 100% covered
  const shutterPct = 100 - display;

  // Track the direction WE last commanded so only THAT button turns into a stop
  // (not both). Cleared when we press stop or after a timeout, since these
  // covers don't reliably report opening/closing. The layout never changes —
  // only the one pressed button swaps its icon.
  const [movingDir, setMovingDir] = useState<null | 'up' | 'down'>(null);
  const moveTimer = useRef<number | null>(null);

  const clearMove = () => {
    if (moveTimer.current != null) { window.clearTimeout(moveTimer.current); moveTimer.current = null; }
    setMovingDir(null);
  };

  useEffect(() => () => { if (moveTimer.current != null) window.clearTimeout(moveTimer.current); }, []);

  const startMove = (dir: 'up' | 'down') => {
    callHA('cover', dir === 'up' ? 'open_cover' : 'close_cover', undefined, { entity_id });
    setMovingDir(dir);
    if (moveTimer.current != null) window.clearTimeout(moveTimer.current);
    // Reset after the travel is likely done, in case the cover never reports
    // a resting state.
    moveTimer.current = window.setTimeout(() => setMovingDir(null), 30_000);
  };

  const stopMove = () => {
    callHA('cover', 'stop_cover', undefined, { entity_id });
    clearMove();
  };

  // Label stays as the percentage/state — never a "moving…" string, so the
  // layout doesn't shift when you tap.
  const stateLabel = display === 100 ? 'Aperta' : display === 0 ? 'Chiusa' : `${display}%`;

  // Only the pressed button becomes a stop. Up: if it's the one moving, stop;
  // otherwise open. Down likewise. stopPropagation so the tap doesn't also open
  // the detail flyout.
  const pressUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (movingDir === 'up') stopMove(); else startMove('up');
  };
  const pressDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (movingDir === 'down') stopMove(); else startMove('down');
  };

  // Tapping the card body opens the detail flyout, which has Open/Stop/Close
  // plus a large, comfortable position slider for picking an exact percentage.
  return (
    <div className="cv-card" onClick={() => onOpenDetail(entity_id)}>
      {/* Shutter: green block from top with slat lines */}
      <div className="cv-shutter" style={{ height: `${shutterPct}%` }}>
        <div className="cv-slats" />
      </div>

      {/* Content overlay */}
      <div className="cv-info">
        <span className="cv-name">{name.replace('Tapparella ', '')}</span>
        <span className="cv-pct">{stateLabel}</span>
      </div>

      {/* Only the button you pressed turns into a stop; the other stays as its
          normal chevron. For an exact %, tap the card. */}
      <div className="cv-quick">
        <button
          className={`cv-quick-btn ${movingDir === 'up' ? 'is-moving' : ''}`}
          onClick={pressUp}
          disabled={movingDir == null && display === 100}
          aria-label={movingDir === 'up' ? 'Ferma tapparella' : 'Apri tapparella'}
          title={movingDir === 'up' ? 'Ferma' : 'Apri'}
        >
          <span className={`mdi ${movingDir === 'up' ? 'mdi-stop' : 'mdi-chevron-up'}`} />
        </button>
        <button
          className={`cv-quick-btn ${movingDir === 'down' ? 'is-moving' : ''}`}
          onClick={pressDown}
          disabled={movingDir == null && display === 0}
          aria-label={movingDir === 'down' ? 'Ferma tapparella' : 'Chiudi tapparella'}
          title={movingDir === 'down' ? 'Ferma' : 'Chiudi'}
        >
          <span className={`mdi ${movingDir === 'down' ? 'mdi-stop' : 'mdi-chevron-down'}`} />
        </button>
      </div>
    </div>
  );
}

export function CoverSection({ entities, covers, callHA, onOpenDetail }: Props) {
  const allIds = covers.map(c => c.entity_id);

  return (
    <div className="cv-section">
      <div className="cv-toolbar">
        <span className="cv-toolbar-label">Tutte le tapparelle</span>
        <div className="cv-toolbar-btns">
          <button className="cv-tb-text" onClick={() => { if (confirm('Aprire tutte le tapparelle?')) callHA('cover', 'open_cover', undefined, { entity_id: allIds }); }}>Apri tutto</button>
          <button className="cv-tb-text" onClick={() => { if (confirm('Chiudere tutte le tapparelle?')) callHA('cover', 'close_cover', undefined, { entity_id: allIds }); }}>Chiudi tutto</button>
        </div>
      </div>
      <div className="cv-cards">
        {covers.map((c) => (
          <CoverCard key={c.entity_id} {...c} entities={entities} callHA={callHA} onOpenDetail={onOpenDetail} />
        ))}
      </div>
    </div>
  );
}
