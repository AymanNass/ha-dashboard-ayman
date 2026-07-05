import type { HassEntities } from 'home-assistant-js-websocket';
import type { RoomEntity } from '../types';

interface Props {
  entities: HassEntities;
  entityIds: RoomEntity[];
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
}

/**
 * Compact security status bar — renders alarm + lock entities as
 * status chips instead of regular tiles. Designed to sit at the top of
 * the dashboard and take minimal vertical space.
 */
export function SecurityBar({ entities, entityIds, callHA }: Props) {
  return (
    <div className="security-bar">
      {entityIds.map(({ entity_id, name }) => {
        const ent = entities[entity_id];
        if (!ent) return null;
        const domain = entity_id.split('.')[0];
        const state = ent.state;
        const displayName = name || ent.attributes.friendly_name || entity_id;

        let icon = 'mdi-help-circle';
        let label = state;
        let statusClass = '';

        if (domain === 'alarm_control_panel') {
          if (state.startsWith('armed')) {
            icon = 'mdi-shield-check';
            label = 'Protetta';
            statusClass = 'secure';
          } else if (state === 'disarmed') {
            icon = 'mdi-shield-off-outline';
            label = 'Disarmato';
            statusClass = 'neutral';
          } else if (state === 'triggered') {
            icon = 'mdi-shield-alert';
            label = 'Allarme!';
            statusClass = 'alert';
          } else if (state === 'pending' || state === 'arming') {
            icon = 'mdi-shield-sync';
            label = 'In attesa...';
            statusClass = 'pending';
          }
        } else if (domain === 'lock') {
          if (state === 'locked') {
            icon = 'mdi-lock';
            label = 'Chiusa';
            statusClass = 'secure';
          } else if (state === 'unlocked') {
            icon = 'mdi-lock-open-variant';
            label = 'Aperta';
            statusClass = 'alert';
          } else if (state === 'locking' || state === 'unlocking') {
            icon = 'mdi-lock-clock';
            label = state === 'locking' ? 'Chiudendo...' : 'Aprendo...';
            statusClass = 'pending';
          }
        }

        const toggle = () => {
          if (domain === 'lock') {
            callHA('lock', state === 'locked' ? 'unlock' : 'lock', undefined, { entity_id });
          }
          // Alarm toggling is intentionally not one-tap (safety)
        };

        return (
          <button
            key={entity_id}
            className={`security-chip ${statusClass}`}
            onClick={toggle}
            title={`${displayName}: ${state}`}
          >
            <span className={`mdi ${icon}`} />
            <span className="security-chip-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
