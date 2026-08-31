import { useState } from 'react';

interface Props {
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
}

interface RoutineItem {
  id: string;
  icon: string;
  label: string;
  color: string;
  action: () => void;
  /** Sub-options shown in a tiny popover */
  sub?: { label: string; action: () => void }[];
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  action: () => void;
}

export function ControlCenter({ callHA }: Props) {
  const [robotMenu, setRobotMenu] = useState(false);
  const [moreRoutines, setMoreRoutines] = useState(false);
  const [moreActions, setMoreActions] = useState(false);

  // Close all menus
  const closeMenus = () => { setRobotMenu(false); setMoreRoutines(false); setMoreActions(false); };

  // ── Routines (call existing HA automations/scripts/scenes) ──
  const routines: RoutineItem[] = [
    {
      id: 'imback', icon: 'mdi-home-import-outline', label: "I'm Back", color: '#10b981',
      action: () => {
        // Triggers the corridor button 1 automation logic
        callHA('script', 'turn_on', undefined, { entity_id: 'script.apri_tutte_le_tapparelle' });
        callHA('light', 'turn_on', undefined, { entity_id: ['light.luce_ingresso', 'light.luce_corridoio'] });
      },
    },
    {
      id: 'imleaving', icon: 'mdi-exit-run', label: "I'm Leaving", color: '#3b82f6',
      action: () => {
        if (confirm('Uscendo: spengo tutto e chiudo. Confermi?')) {
          callHA('light', 'turn_off', undefined, { entity_id: 'all' });
          callHA('climate', 'turn_off', undefined, { entity_id: ['climate.condizionatore_camera_da_letto', 'climate.condizionatore_soggiorno_2'] });
          callHA('script', 'turn_on', undefined, { entity_id: 'script.chiudi_tutte_le_tapparelle' });
          callHA('media_player', 'media_stop', undefined, { entity_id: ['media_player.2o_echo_dot_di_martina', 'media_player.3o_echo_dot_di_martina'] });
        }
      },
    },
    {
      id: 'buonanotte', icon: 'mdi-weather-night', label: 'Buonanotte', color: '#6366f1',
      action: () => callHA('scene', 'turn_on', undefined, { entity_id: 'scene.buonanotte' }),
    },
    {
      id: 'cinema', icon: 'mdi-movie-open', label: 'Film', color: '#a855f7',
      action: () => callHA('scene', 'turn_on', undefined, { entity_id: 'scene.cinema' }),
    },
    {
      id: 'robot', icon: 'mdi-robot-vacuum', label: 'Robot', color: '#06b6d4',
      action: () => setRobotMenu((v) => !v),
      sub: [
        { label: 'Aspira + lava', action: () => { callHA('script', 'turn_on', undefined, { entity_id: 'script.aspira_lava_tutta_casa_molto_bagnato' }); closeMenus(); } },
        { label: 'Solo aspirazione', action: () => { callHA('vacuum', 'start', undefined, { entity_id: 'vacuum.roborock_qv_35a' }); closeMenus(); } },
        { label: 'Pulizia profonda', action: () => { callHA('vacuum', 'set_fan_speed', { fan_speed: 'turbo' }, { entity_id: 'vacuum.roborock_qv_35a' }); setTimeout(() => callHA('vacuum', 'start', undefined, { entity_id: 'vacuum.roborock_qv_35a' }), 1000); closeMenus(); } },
      ],
    },
  ];

  // Extra routines in the "more" menu
  const extraRoutines: RoutineItem[] = [
    {
      id: 'buongiorno', icon: 'mdi-weather-sunny', label: 'Buongiorno', color: '#f59e0b',
      action: () => { callHA('scene', 'turn_on', undefined, { entity_id: 'scene.buongiorno' }); closeMenus(); },
    },
    {
      id: 'riposo', icon: 'mdi-power-sleep', label: 'Riposo', color: '#64748b',
      action: () => { callHA('scene', 'turn_on', undefined, { entity_id: 'scene.riposo' }); closeMenus(); },
    },
    {
      id: 'vacanza', icon: 'mdi-palm-tree', label: 'Vacanza', color: '#ef4444',
      action: () => {
        if (confirm('Attivare la modalità vacanza? Le luci simuleranno la presenza.')) {
          callHA('input_boolean', 'turn_on', undefined, { entity_id: 'input_boolean.vacation_mode' });
        }
        closeMenus();
      },
    },
  ];

  // ── Quick Actions ──
  const quickActions: QuickAction[] = [
    {
      id: 'alloff', icon: 'mdi-power', label: 'Tutto OFF',
      action: () => {
        if (confirm('Spengo tutto?')) {
          callHA('light', 'turn_off', undefined, { entity_id: 'all' });
          callHA('climate', 'turn_off', undefined, { entity_id: ['climate.condizionatore_camera_da_letto', 'climate.condizionatore_soggiorno_2'] });
          callHA('media_player', 'media_stop', undefined, { entity_id: ['media_player.2o_echo_dot_di_martina', 'media_player.3o_echo_dot_di_martina'] });
        }
      },
    },
    { id: 'lightsoff', icon: 'mdi-lightbulb-off', label: 'Luci OFF', action: () => { if (confirm('Spegnere tutte le luci?')) callHA('light', 'turn_off', undefined, { entity_id: 'all' }); } },
    { id: 'coverclose', icon: 'mdi-blinds', label: 'Chiudi', action: () => { if (confirm('Chiudere tutte le tapparelle?')) callHA('script', 'turn_on', undefined, { entity_id: 'script.chiudi_tutte_le_tapparelle' }); } },
    { id: 'coveropen', icon: 'mdi-blinds-open', label: 'Apri', action: () => { if (confirm('Aprire tutte le tapparelle?')) callHA('script', 'turn_on', undefined, { entity_id: 'script.apri_tutte_le_tapparelle' }); } },
    {
      id: 'climaoff', icon: 'mdi-snowflake-off', label: 'Clima OFF',
      action: () => { if (confirm('Spegnere tutti i condizionatori?')) callHA('climate', 'turn_off', undefined, { entity_id: ['climate.condizionatore_camera_da_letto', 'climate.condizionatore_soggiorno_2'] }); },
    },
  ];

  const extraActions: QuickAction[] = [
    { id: 'tvoff', icon: 'mdi-television-off', label: 'TV OFF', action: () => { callHA('media_player', 'turn_off', undefined, { entity_id: 'media_player.lg_tv' }); closeMenus(); } },
    { id: 'audiooff', icon: 'mdi-volume-off', label: 'Audio OFF', action: () => { callHA('media_player', 'media_stop', undefined, { entity_id: ['media_player.2o_echo_dot_di_martina', 'media_player.3o_echo_dot_di_martina', 'media_player.ovunque_2'] }); closeMenus(); } },
    { id: 'salaoff', icon: 'mdi-sofa', label: 'Sala OFF', action: () => { callHA('light', 'turn_off', { }, { entity_id: ['light.luce_soggiorno', 'light.lampada_ciambella', 'light.lampada_sala'] }); closeMenus(); } },
    { id: 'cameraoff', icon: 'mdi-bed', label: 'Camera OFF', action: () => { callHA('light', 'turn_off', { }, { entity_id: ['light.luce_camera', 'light.luce_letto_ayman', 'light.luce_letto_martina'] }); closeMenus(); } },
    { id: 'lockhouse', icon: 'mdi-lock', label: 'Chiudi casa', action: () => { if (confirm('Chiudere porta e tapparelle?')) { callHA('lock', 'lock', undefined, { entity_id: 'lock.pl_2_casa' }); callHA('script', 'turn_on', undefined, { entity_id: 'script.chiudi_tutte_le_tapparelle' }); } closeMenus(); } },
  ];

  return (
    <div className="cc" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('cc')) closeMenus(); }}>
      {/* Routines */}
      <div className="cc-section">
        <span className="cc-title">ROUTINE</span>
        <div className="cc-items">
          {routines.map((r) => (
            <div key={r.id} className="cc-routine-wrap">
              <button className="cc-routine" onClick={r.action}>
                <span className={`mdi ${r.icon}`} style={{ color: r.color }} />
                <span className="cc-rlabel">{r.label}</span>
                {r.sub && <span className="mdi mdi-chevron-down cc-chevron" />}
              </button>
              {r.id === 'robot' && robotMenu && r.sub && (
                <div className="cc-submenu">
                  {r.sub.map((s, i) => (
                    <button key={i} className="cc-submenu-item" onClick={s.action}>{s.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button className="cc-routine cc-more" onClick={() => { setMoreRoutines((v) => !v); setMoreActions(false); }}>
            <span className="mdi mdi-dots-horizontal" />
          </button>
          {moreRoutines && (
            <div className="cc-submenu cc-more-menu">
              {extraRoutines.map((r) => (
                <button key={r.id} className="cc-submenu-item" onClick={r.action}>
                  <span className={`mdi ${r.icon}`} style={{ color: r.color }} /> {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="cc-divider" />

      {/* Quick Actions */}
      <div className="cc-section">
        <span className="cc-title">AZIONI RAPIDE</span>
        <div className="cc-items">
          {quickActions.map((a) => (
            <button key={a.id} className="cc-action" onClick={a.action}>
              <span className={`mdi ${a.icon}`} />
              <span>{a.label}</span>
            </button>
          ))}
          <button className="cc-action cc-more" onClick={() => { setMoreActions((v) => !v); setMoreRoutines(false); }}>
            <span className="mdi mdi-dots-horizontal" />
          </button>
          {moreActions && (
            <div className="cc-submenu cc-more-menu cc-more-actions">
              {extraActions.map((a) => (
                <button key={a.id} className="cc-submenu-item" onClick={a.action}>
                  <span className={`mdi ${a.icon}`} /> {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
