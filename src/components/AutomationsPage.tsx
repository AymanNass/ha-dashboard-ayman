import { useMemo } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';

type CallHA = (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;

interface Props {
  entities: HassEntities;
  callHA: CallHA;
}

// Group automations by category for display
const CATEGORIES: { label: string; icon: string; match: (id: string, name: string) => boolean }[] = [
  { label: 'Pulsantiere', icon: 'mdi-gesture-tap-button', match: (_, n) => n.toLowerCase().includes('pulsantiera') },
  { label: 'Clima', icon: 'mdi-thermostat', match: (_, n) => n.toLowerCase().includes('clima') || n.toLowerCase().includes('condizionatore') },
  { label: 'Vacation Mode', icon: 'mdi-palm-tree', match: (_, n) => n.toLowerCase().includes('vacation') },
  { label: 'Notifiche', icon: 'mdi-bell', match: (_, n) => n.toLowerCase().includes('notifica') },
  { label: 'Alexa', icon: 'mdi-speaker', match: (_, n) => n.toLowerCase().includes('alexa') },
  { label: 'Robot', icon: 'mdi-robot-vacuum', match: (_, n) => n.toLowerCase().includes('aspira') || n.toLowerCase().includes('robot') },
  { label: 'Spotify', icon: 'mdi-spotify', match: (_, n) => n.toLowerCase().includes('spotify') },
  { label: 'Altro', icon: 'mdi-cog', match: () => true },
];

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'Adesso';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min fa`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h fa`;
  if (diff < 172800000) return 'Ieri';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function AutomationsPage({ entities, callHA }: Props) {
  // Collect all automation entities
  const automations = useMemo(() => {
    return Object.values(entities)
      .filter((e) => e.entity_id.startsWith('automation.'))
      .map((e) => ({
        entity_id: e.entity_id,
        name: (e.attributes.friendly_name as string) || e.entity_id.replace('automation.', ''),
        enabled: e.state === 'on',
        lastTriggered: e.attributes.last_triggered as string | undefined,
        currentState: e.attributes.current as number | undefined,
      }))
      .sort((a, b) => {
        // Sort by last triggered (most recent first), nulls last
        if (!a.lastTriggered && !b.lastTriggered) return a.name.localeCompare(b.name);
        if (!a.lastTriggered) return 1;
        if (!b.lastTriggered) return -1;
        return new Date(b.lastTriggered).getTime() - new Date(a.lastTriggered).getTime();
      });
  }, [entities]);

  // Group by category
  const grouped = useMemo(() => {
    const used = new Set<string>();
    const groups: { label: string; icon: string; items: typeof automations }[] = [];
    for (const cat of CATEGORIES) {
      const items = automations.filter((a) => !used.has(a.entity_id) && cat.match(a.entity_id, a.name));
      if (items.length > 0) {
        items.forEach((a) => used.add(a.entity_id));
        groups.push({ label: cat.label, icon: cat.icon, items });
      }
    }
    return groups;
  }, [automations]);

  // Activity log: recent triggers sorted by time
  const recentLog = useMemo(() => {
    return automations
      .filter((a) => a.lastTriggered)
      .sort((a, b) => new Date(b.lastTriggered!).getTime() - new Date(a.lastTriggered!).getTime())
      .slice(0, 20);
  }, [automations]);

  const toggle = (eid: string, enabled: boolean) => {
    callHA('automation', enabled ? 'turn_off' : 'turn_on', undefined, { entity_id: eid });
  };

  const triggerNow = (eid: string) => {
    if (confirm('Eseguire questa automazione adesso?')) {
      callHA('automation', 'trigger', undefined, { entity_id: eid });
    }
  };

  return (
    <div className="atp">
      <div className="atp-cols">
        {/* ── LEFT: Activity log ── */}
        <div className="atp-log">
          <span className="atp-stitle">LOG ATTIVITÀ</span>
          <div className="atp-log-list">
            {recentLog.length === 0 && <span className="atp-empty">Nessuna attività recente</span>}
            {recentLog.map((a) => (
              <div key={a.entity_id} className="atp-log-item">
                <span className="atp-log-time">{formatTime(a.lastTriggered!)}</span>
                <div className="atp-log-dot" />
                <div className="atp-log-info">
                  <span className="atp-log-name">{a.name}</span>
                  <span className="atp-log-ago">{timeAgo(a.lastTriggered!)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Automations by category ── */}
        <div className="atp-main">
          <div className="atp-stitle-row">
            <span className="atp-stitle">AUTOMAZIONI</span>
            <span className="atp-count">{automations.length} totali · {automations.filter((a) => a.enabled).length} attive</span>
          </div>

          {grouped.map((g) => (
            <div key={g.label} className="atp-group">
              <div className="atp-group-head">
                <span className={`mdi ${g.icon} atp-group-icon`} />
                <span className="atp-group-label">{g.label}</span>
                <span className="atp-group-count">{g.items.length}</span>
              </div>
              <div className="atp-group-items">
                {g.items.map((a) => (
                  <div key={a.entity_id} className={`atp-item ${!a.enabled ? 'atp-disabled' : ''}`}>
                    <div className="atp-item-info">
                      <span className="atp-item-name">{a.name}</span>
                      <span className="atp-item-last">
                        {a.lastTriggered ? timeAgo(a.lastTriggered) : 'Mai eseguita'}
                      </span>
                    </div>
                    <div className="atp-item-actions">
                      <button className="atp-trigger" onClick={() => triggerNow(a.entity_id)} title="Esegui adesso">
                        <span className="mdi mdi-play" />
                      </button>
                      <button
                        className={`atp-toggle ${a.enabled ? 'on' : ''}`}
                        onClick={() => toggle(a.entity_id, a.enabled)}
                        title={a.enabled ? 'Disabilita' : 'Abilita'}
                      >
                        <span className="atp-toggle-knob" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
