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

  // Home Assistant reports `opening` / `closing` while the motor is running.
  const moving = entity?.state === 'opening' || entity?.state === 'closing';

  const stateLabel = entity?.state === 'opening'
    ? 'In apertura…'
    : entity?.state === 'closing'
      ? 'In chiusura…'
      : display === 100 ? 'Aperta' : display === 0 ? 'Chiusa' : `${display}%`;

  // Live remote-style control: while moving, EITHER button stops it; when
  // stopped, the up button opens and the down button closes. stopPropagation so
  // the tap doesn't also open the detail flyout.
  const pressUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('cover', moving ? 'stop_cover' : 'open_cover', undefined, { entity_id });
  };
  const pressDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('cover', moving ? 'stop_cover' : 'close_cover', undefined, { entity_id });
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

      {/* Live buttons: while moving either one stops; when stopped, up opens /
          down closes. A button is only disabled when stopped AND already at the
          end it would drive toward. For an exact %, tap the card. */}
      <div className="cv-quick">
        <button
          className={`cv-quick-btn ${moving ? 'is-moving' : ''}`}
          onClick={pressUp}
          disabled={!moving && display === 100}
          aria-label={moving ? 'Ferma tapparella' : 'Apri tapparella'}
          title={moving ? 'Ferma' : 'Apri'}
        >
          <span className={`mdi ${moving ? 'mdi-stop' : 'mdi-chevron-up'}`} />
        </button>
        <button
          className={`cv-quick-btn ${moving ? 'is-moving' : ''}`}
          onClick={pressDown}
          disabled={!moving && display === 0}
          aria-label={moving ? 'Ferma tapparella' : 'Chiudi tapparella'}
          title={moving ? 'Ferma' : 'Chiudi'}
        >
          <span className={`mdi ${moving ? 'mdi-stop' : 'mdi-chevron-down'}`} />
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
