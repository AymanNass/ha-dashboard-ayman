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

/** Mini window SVG showing shutter position. */
function WindowIcon({ position }: { position: number }) {
  // position: 0 = fully closed, 100 = fully open
  const shutterHeight = 36 * (1 - position / 100); // how much of window is covered
  return (
    <svg viewBox="0 0 40 48" className="cover-window-svg">
      {/* Window frame */}
      <rect x="2" y="4" width="36" height="40" rx="2" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.4" />
      {/* Center divider */}
      <line x1="20" y1="4" x2="20" y2="44" stroke="var(--text-muted)" strokeWidth="0.8" opacity="0.25" />
      {/* Horizontal divider */}
      <line x1="2" y1="24" x2="38" y2="24" stroke="var(--text-muted)" strokeWidth="0.8" opacity="0.25" />
      {/* Sky/light through open part */}
      <rect x="3" y={5 + shutterHeight} width="34" height={Math.max(0, 38 - shutterHeight)} rx="1" fill="rgba(56, 189, 248, 0.08)" />
      {/* Shutter (closed part) — horizontal slats */}
      {shutterHeight > 0 && (
        <g>
          <rect x="3" y="5" width="34" height={shutterHeight} rx="1" fill="rgba(var(--accent-rgb), 0.12)" />
          {/* Slat lines */}
          {Array.from({ length: Math.floor(shutterHeight / 4) }, (_, i) => (
            <line key={i} x1="4" y1={7 + i * 4} x2="36" y2={7 + i * 4} stroke="var(--text-muted)" strokeWidth="0.5" opacity="0.2" />
          ))}
        </g>
      )}
    </svg>
  );
}

export function CoverSection({ entities, covers, callHA, onOpenDetail }: Props) {
  const allIds = covers.map(c => c.entity_id);

  const openAll = () => callHA('cover', 'open_cover', undefined, { entity_id: allIds });
  const stopAll = () => callHA('cover', 'stop_cover', undefined, { entity_id: allIds });
  const closeAll = () => callHA('cover', 'close_cover', undefined, { entity_id: allIds });

  return (
    <div className="cover-section">
      {/* Toolbar */}
      <div className="cover-toolbar">
        <span className="cover-toolbar-label">Tutte le tapparelle</span>
        <div className="cover-toolbar-btns">
          <button className="cover-tb-btn" onClick={openAll} title="Apri tutte">
            <span className="mdi mdi-arrow-up" />
          </button>
          <button className="cover-tb-btn" onClick={stopAll} title="Stop">
            <span className="mdi mdi-stop" />
          </button>
          <button className="cover-tb-btn" onClick={closeAll} title="Chiudi tutte">
            <span className="mdi mdi-arrow-down" />
          </button>
        </div>
      </div>

      {/* Cover cards */}
      <div className="cover-cards">
        {covers.map((c) => {
          const entity = entities[c.entity_id];
          if (!entity) return null;
          const position = (entity.attributes.current_position as number) ?? (entity.state === 'open' ? 100 : 0);
          const isOpen = entity.state === 'open';
          const label = position === 100 ? 'Aperta' : position === 0 ? 'Chiusa' : `${position}%`;

          return (
            <div
              className={`cover-card ${isOpen ? 'is-open' : ''}`}
              key={c.entity_id}
              onClick={() => onOpenDetail(c.entity_id)}
            >
              <span className="cover-card-name">{c.name.replace('Tapparella ', '')}</span>
              <WindowIcon position={position} />
              <div className="cover-card-status">
                <span className="cover-card-label">{label}</span>
              </div>
              <div className="cover-card-btns">
                <button className="cover-btn" onClick={(e) => { e.stopPropagation(); callHA('cover', 'open_cover', undefined, { entity_id: c.entity_id }); }} title="Apri">
                  <span className="mdi mdi-chevron-up" />
                </button>
                <button className="cover-btn" onClick={(e) => { e.stopPropagation(); callHA('cover', 'stop_cover', undefined, { entity_id: c.entity_id }); }} title="Stop">
                  <span className="mdi mdi-pause" />
                </button>
                <button className="cover-btn" onClick={(e) => { e.stopPropagation(); callHA('cover', 'close_cover', undefined, { entity_id: c.entity_id }); }} title="Chiudi">
                  <span className="mdi mdi-chevron-down" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
