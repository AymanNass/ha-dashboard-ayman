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

  const stateLabel = display === 100 ? 'Aperta' : display === 0 ? 'Chiusa' : `${display}%`;

  // Quick actions stop propagation so they don't also open the detail flyout.
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('cover', 'open_cover', undefined, { entity_id });
  };
  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('cover', 'close_cover', undefined, { entity_id });
  };

  // Tapping the card body opens the detail flyout, which has Open/Stop/Close
  // plus a large, comfortable position slider for picking an exact percentage —
  // far easier on a small screen than a tiny slider embedded in the card.
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

      {/* Quick open / close buttons (one tap). For the exact %, tap the card. */}
      <div className="cv-quick">
        <button
          className="cv-quick-btn"
          onClick={open}
          disabled={display === 100}
          aria-label="Apri tapparella"
          title="Apri"
        >
          <span className="mdi mdi-chevron-up" />
        </button>
        <button
          className="cv-quick-btn"
          onClick={close}
          disabled={display === 0}
          aria-label="Chiudi tapparella"
          title="Chiudi"
        >
          <span className="mdi mdi-chevron-down" />
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
