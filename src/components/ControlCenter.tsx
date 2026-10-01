interface Props {
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
}

interface Routine {
  id: string;
  icon: string;
  label: string;
  color: string;
  action: () => void;
}

/** A small grouped control: a label + 2+ icon-only sub-buttons. */
interface Cluster {
  id: string;
  label: string;
  icon: string;
  items: { id: string; icon: string; title: string; badge?: string; color: string; action: () => void }[];
}

export function ControlCenter({ callHA }: Props) {
  // ── Hero: Sono tornato / Vado via ──
  // Lanciano le stesse automazioni dei tasti 1 e 2 della pulsantiera del
  // corridoio, così pulsantiera fisica e dashboard fanno esattamente la
  // stessa cosa e c'è un solo posto in cui cambiare il comportamento.
  const sonoTornato = () =>
    callHA('automation', 'trigger', undefined, { entity_id: 'automation.pulsantiera_corridoio_tasto_1_i_m_back' });

  const vadoVia = () => {
    if (confirm('Uscendo: spengo tutto e chiudo le tapparelle. Confermi?'))
      callHA('automation', 'trigger', undefined, { entity_id: 'automation.pulsantiera_corridoio_tasto_2_i_m_leaving' });
  };

  /**
   * Variante di "Vado via" che forza la chiusura delle tapparelle.
   * È l'equivalente della doppia pressione sul tasto 2 della pulsantiera:
   * stessa automazione, così il comportamento resta definito in HA e non
   * duplicato qui.
   */
  const vadoViaConTapparelle = () => {
    if (confirm('Uscendo: spengo tutto e forzo la chiusura di tutte le tapparelle. Confermi?'))
      callHA('automation', 'trigger', undefined, {
        entity_id: 'automation.pulsantiera_corridoio_tasto_2_doppio_spegni_tutto_chiudi_tapparelle',
      });
  };

  // ── Routines (scenes) ──
  const routines: Routine[] = [
    { id: 'buonanotte', icon: 'mdi-weather-night', label: 'Buonanotte', color: '#8b5cf6', action: () => callHA('scene', 'turn_on', undefined, { entity_id: 'scene.buonanotte' }) },
    { id: 'riposo', icon: 'mdi-power-sleep', label: 'Riposo', color: '#6366f1', action: () => callHA('scene', 'turn_on', undefined, { entity_id: 'scene.riposo' }) },
    { id: 'cinema', icon: 'mdi-movie-open', label: 'Cinema', color: '#a855f7', action: () => callHA('scene', 'turn_on', undefined, { entity_id: 'scene.cinema' }) },
    { id: 'buongiorno', icon: 'mdi-weather-sunny', label: 'Buongiorno', color: '#f59e0b', action: () => callHA('scene', 'turn_on', undefined, { entity_id: 'scene.buongiorno' }) },
  ];

  const spegniTutto = () => {
    if (confirm('Spengo tutto (luci, clima, audio)?')) {
      callHA('light', 'turn_off', undefined, { entity_id: 'all' });
      callHA('climate', 'turn_off', undefined, { entity_id: ['climate.condizionatore_camera_da_letto', 'climate.condizionatore_soggiorno_2'] });
      callHA('media_player', 'media_stop', undefined, { entity_id: ['media_player.echo_dot_di_martina', 'media_player.3o_echo_dot_di_martina', 'media_player.echo_dot_bagno'] });
    }
  };

  // ── Quick action clusters (grouped, compact) ──
  const clusters: Cluster[] = [
    {
      id: 'spegni', label: 'Spegni', icon: 'mdi-power',
      items: [
        { id: 'alloff', icon: 'mdi-power', title: 'Spegni tutto', color: '#ef4444', action: spegniTutto },
        { id: 'lightsoff', icon: 'mdi-lightbulb-off', title: 'Spegni luci', color: '#f59e0b', action: () => callHA('light', 'turn_off', undefined, { entity_id: 'all' }) },
      ],
    },
    {
      id: 'tapparelle', label: 'Tapparelle', icon: 'mdi-blinds',
      items: [
        { id: 'coverclose', icon: 'mdi-arrow-down', title: 'Chiudi tapparelle', color: '#0ea5e9', action: () => callHA('script', 'turn_on', undefined, { entity_id: 'script.chiudi_tapparelle_17' }) },
        { id: 'coveropen', icon: 'mdi-arrow-up', title: 'Apri tapparelle', color: '#10b981', action: () => callHA('script', 'turn_on', undefined, { entity_id: 'script.apri_tutte_le_tapparelle' }) },
      ],
    },
    {
      id: 'phones', label: 'Trova iPhone', icon: 'mdi-cellphone-sound',
      items: [
        { id: 'findayman', icon: 'mdi-cellphone-sound', title: 'Trova iPhone Ayman', badge: 'A', color: '#0ea5e9', action: () => callHA('script', 'turn_on', undefined, { entity_id: 'script.fai_suonare_telefono_ayman' }) },
        { id: 'findmarti', icon: 'mdi-cellphone-sound', title: 'Trova iPhone Martina', badge: 'M', color: '#ec4899', action: () => callHA('script', 'turn_on', undefined, { entity_id: 'script.fai_suonare_telefono_martina' }) },
      ],
    },
  ];

  return (
    <div className="cc">
      {/* Hero routines */}
      <button className="cc-hero cc-hero-back" onClick={sonoTornato}>
        <span className="mdi mdi-home-import-outline" />
        <span>Sono tornato</span>
      </button>
      {/* Pulsante diviso: azione principale + variante "con tapparelle".
          Due <button> affiancati, non annidati: un bottone non può contenerne
          un altro, e servono comunque due bersagli distinti. */}
      <div className="cc-hero-split cc-hero-leave">
        <button className="cc-hero" onClick={vadoVia}>
          <span className="mdi mdi-exit-run" />
          <span>Vado via</span>
        </button>
        <button
          className="cc-hero-extra"
          onClick={vadoViaConTapparelle}
          title="Vado via e forza la chiusura delle tapparelle"
          aria-label="Vado via e forza la chiusura delle tapparelle"
        >
          <span className="mdi mdi-blinds" />
        </button>
      </div>

      <div className="cc-divider" />

      {/* Routines */}
      {routines.map((r) => (
        <button key={r.id} className="cc-btn" onClick={r.action}>
          <span className={`mdi ${r.icon}`} style={{ color: r.color }} />
          <span className="cc-btn-label">{r.label}</span>
        </button>
      ))}

      <div className="cc-divider" />

      {/* Quick-action clusters */}
      {clusters.map((c) => (
        <div key={c.id} className="cc-cluster">
          <span className="cc-cluster-label">
            <span className={`mdi ${c.icon}`} /> {c.label}
          </span>
          <div className="cc-cluster-items">
            {c.items.map((it) => (
              <button
                key={it.id}
                className="cc-cluster-btn"
                title={it.title}
                aria-label={it.title}
                onClick={it.action}
              >
                <span className={`mdi ${it.icon}`} style={{ color: it.color }} />
                {it.badge && <span className="cc-cluster-badge">{it.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
