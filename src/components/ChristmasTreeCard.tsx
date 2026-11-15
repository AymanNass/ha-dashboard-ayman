import type { HassEntities } from 'home-assistant-js-websocket';
import { christmasTree } from '../config';

type CallHA = (
  domain: string,
  service: string,
  data?: Record<string, unknown>,
  target?: { entity_id: string | string[] },
) => Promise<void>;

interface Props {
  entities: HassEntities;
  callHA: CallHA;
}

// Bulb positions (viewBox 64×82), kept inside the three tiers of the tree.
const BULBS: Array<[number, number]> = [
  [32, 23], [27, 30], [38, 32],
  [22, 46], [33, 44], [44, 48],
  [17, 65], [26, 60], [38, 64], [47, 62],
];
const BULB_COLORS = ['#ef4444', '#fbbf24', '#38bdf8', '#f472b6'];
// 5-point star centred on (32, 8).
const STAR_POINTS =
  '32,1.5 33.59,5.82 38.18,5.99 34.57,8.83 35.82,13.26 32,10.7 28.18,13.26 29.43,8.83 25.82,5.99 30.41,5.82';

/** Small festive caption: days to Christmas in the run-up, greetings around it. */
function christmasCaption(now = new Date()): string | null {
  const month = now.getMonth();
  const day = now.getDate();
  if (month === 0 && day <= 6) return 'Buone feste';
  if (month === 11 && day > 25) return 'Buone feste';
  const today = new Date(now.getFullYear(), month, day);
  const xmas = new Date(now.getFullYear(), 11, 25);
  const diff = Math.round((xmas.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Buon Natale!';
  if (diff === 1) return 'Domani è Natale';
  if (diff > 1 && diff <= 60) return `${diff} giorni a Natale`;
  return null;
}

/**
 * Christmas-tree plug: a living-room widget that switches the Shelly plug the
 * tree is connected to. The tree lights up when on (coloured bulbs, golden
 * star, warm glow) and shows the live power draw. The twinkle animation only
 * runs outside lite mode — lite mode deliberately has no animations.
 */
export function ChristmasTreeCard({ entities, callHA }: Props) {
  const sw = entities[christmasTree.switchId];
  if (!sw) return null;

  const unavailable = sw.state === 'unavailable' || sw.state === 'unknown';
  const on = sw.state === 'on';
  const wattsRaw = Number.parseFloat(entities[christmasTree.powerId]?.state ?? '');
  const watts = Number.isFinite(wattsRaw) ? wattsRaw : null;
  const caption = christmasCaption();

  const status = unavailable
    ? 'Non disponibile'
    : on
      ? `Acceso${watts != null ? ` · ${watts.toFixed(watts < 10 ? 1 : 0)} W` : ''}`
      : 'Spento';

  const toggle = () => {
    if (unavailable) return;
    void callHA('switch', 'toggle', undefined, { entity_id: christmasTree.switchId });
  };

  return (
    <button
      type="button"
      className={`xmas-card ${on ? 'on' : 'off'} ${unavailable ? 'na' : ''}`}
      onClick={toggle}
      disabled={unavailable}
      aria-pressed={on}
      aria-label={`Albero di Natale: ${status}. Tocca per ${on ? 'spegnere' : 'accendere'}`}
    >
      <svg className="xmas-tree" viewBox="0 0 64 82" aria-hidden="true" focusable="false">
        <circle className="xmas-star-halo" cx="32" cy="8" r="9" />
        <polygon className="xmas-star" points={STAR_POINTS} />
        {/* Lower tiers first so the upper ones sit in front. */}
        <polygon className="xmas-tier t3" points="32,40 58,72 6,72" />
        <polygon className="xmas-tier t2" points="32,24 52,54 12,54" />
        <polygon className="xmas-tier t1" points="32,12 46,34 18,34" />
        <rect className="xmas-trunk" x="28" y="72" width="8" height="8" rx="1" />
        {BULBS.map(([cx, cy], i) => (
          <g
            key={i}
            className="xmas-bulb"
            style={{
              ['--c' as string]: BULB_COLORS[i % BULB_COLORS.length],
              animationDelay: `${(i % 5) * 0.28}s`,
            }}
          >
            <circle className="xmas-halo" cx={cx} cy={cy} r="4.2" />
            <circle className="xmas-dot" cx={cx} cy={cy} r="2" />
          </g>
        ))}
      </svg>

      <span className="xmas-info">
        <span className="xmas-name">Albero di Natale</span>
        <span className="xmas-status">{status}</span>
        {caption && <span className="xmas-count">{caption}</span>}
      </span>

      <span className={`xmas-switch ${on ? 'on' : ''}`} aria-hidden="true">
        <span className="xmas-knob" />
      </span>
    </button>
  );
}
