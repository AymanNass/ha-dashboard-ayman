import { useState } from 'react';
import type { DashView } from '../types';

interface Props {
  views: DashView[];
  activeView: string;
  onNavigate: (view: string) => void;
  onOpenSettings: () => void;
}

/** View ids that live under the "Altro" (More) menu instead of the main bar. */
const SECONDARY_VIEW_IDS = new Set(['calendar', 'automations']);

/**
 * Phone bottom navigation (mobile layout only). The primary pages sit inline;
 * the secondary ones (Calendario, Automazioni) plus Impostazioni are grouped
 * under a single "Altro" button that opens a popup sheet — keeps the bar
 * uncluttered on a narrow screen.
 */
export function BottomNav({ views, activeView, onNavigate, onOpenSettings }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = views.filter((v) => !SECONDARY_VIEW_IDS.has(v.id));
  const secondary = views.filter((v) => SECONDARY_VIEW_IDS.has(v.id));
  const moreActive = SECONDARY_VIEW_IDS.has(activeView);

  const go = (id: string) => {
    setMoreOpen(false);
    onNavigate(id);
  };

  return (
    <>
      {moreOpen && (
        <>
          <div className="bottom-more-scrim" onClick={() => setMoreOpen(false)} />
          <div className="bottom-more-sheet" role="menu">
            {secondary.map((v) => (
              <button key={v.id} className="bottom-more-item" onClick={() => go(v.id)}>
                <span className={`mdi ${v.icon}`} />
                <span>{v.name}</span>
              </button>
            ))}
            <button
              className="bottom-more-item"
              onClick={() => { setMoreOpen(false); onOpenSettings(); }}
            >
              <span className="mdi mdi-cog" />
              <span>Impostazioni</span>
            </button>
          </div>
        </>
      )}

      <nav className="bottom-nav" aria-label="Navigazione">
        <div className="bottom-nav-scroll">
          {primary.map((view) => (
            <button
              key={view.id}
              className={`bottom-nav-btn ${activeView === view.id ? 'active' : ''}`}
              onClick={() => go(view.id)}
            >
              <span className={`mdi ${view.icon}`} />
              <span className="bottom-nav-label">{view.name}</span>
            </button>
          ))}
          <button
            className={`bottom-nav-btn ${moreActive || moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <span className="mdi mdi-dots-horizontal" />
            <span className="bottom-nav-label">Altro</span>
          </button>
        </div>
      </nav>
    </>
  );
}
