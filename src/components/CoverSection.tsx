import { useState } from 'react';
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
  const [local, setLocal] = useState<number | null>(null);
  const display = local ?? position;
  // Shutter covers from top: 100% open = 0% covered, 0% open = 100% covered
  const shutterPct = 100 - display;

  return (
    <div className="cv-card" onClick={() => onOpenDetail(entity_id)}>
      {/* Shutter: green block from top with slat lines */}
      <div className="cv-shutter" style={{ height: `${shutterPct}%` }}>
        {/* Horizontal slat lines */}
        <div className="cv-slats" />
      </div>

      {/* Content overlay */}
      <div className="cv-info">
        <span className="cv-name">{name.replace('Tapparella ', '')}</span>
        <span className="cv-pct">{display === 100 ? 'Aperta' : display === 0 ? 'Chiusa' : `${display}%`}</span>
      </div>

      {/* Vertical slider on the right */}
      <div className="cv-vslider-track" onClick={(e) => e.stopPropagation()}>
        <input
          type="range"
          className="cv-vslider"
          min={0}
          max={100}
          value={display}
          onChange={(e) => setLocal(parseInt(e.target.value))}
          onPointerUp={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value);
            setLocal(null);
            callHA('cover', 'set_cover_position', { position: v }, { entity_id });
          }}
        />
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
          <button className="cv-tb" onClick={() => callHA('cover', 'open_cover', undefined, { entity_id: allIds })} title="Apri tutte">
            <span className="mdi mdi-arrow-up" />
          </button>
          <button className="cv-tb" onClick={() => callHA('cover', 'stop_cover', undefined, { entity_id: allIds })} title="Stop">
            <span className="mdi mdi-stop" />
          </button>
          <button className="cv-tb" onClick={() => callHA('cover', 'close_cover', undefined, { entity_id: allIds })} title="Chiudi tutte">
            <span className="mdi mdi-arrow-down" />
          </button>
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
