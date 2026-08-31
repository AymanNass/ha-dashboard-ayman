import { useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { HA_URL } from '../config';

const TV_ID = 'media_player.lg_tv';

type CallHA = (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;

interface Props {
  entities: HassEntities;
  callHA: CallHA;
  onOpenDetail: (entityId: string) => void;
}

const APP_ICONS: Record<string, string> = {
  netflix: 'mdi-netflix', youtube: 'mdi-youtube', 'disney+': 'mdi-disney',
  'prime video': 'mdi-amazon', spotify: 'mdi-spotify', 'apple tv': 'mdi-apple',
  dazn: 'mdi-soccer', raiplay: 'mdi-television-classic', stremio: 'mdi-filmstrip',
  now: 'mdi-television-play',
};

function appIcon(source?: string): string {
  const k = (source || '').toLowerCase();
  for (const [name, icon] of Object.entries(APP_ICONS)) if (k.includes(name)) return icon;
  if (k.includes('hdmi')) return 'mdi-video-input-hdmi';
  return 'mdi-television';
}

/** Compact TV widget for homepage — click to expand controls. */
export function TvWidget({ entities, callHA, onOpenDetail }: Props) {
  const entity = entities[TV_ID];
  const [expanded, setExpanded] = useState(false);

  const state = entity?.state ?? 'unavailable';
  const isOff = state === 'off' || state === 'unavailable' || state === 'standby';
  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';

  const attrs = entity?.attributes ?? {};
  const source = attrs.source as string | undefined;
  const volume = attrs.volume_level as number | undefined;
  const muted = attrs.is_volume_muted as boolean | undefined;
  const title = attrs.media_title as string | undefined;
  const picture = attrs.entity_picture as string | undefined;
  const artUrl = picture ? (picture.startsWith('http') ? picture : `${HA_URL}${picture}`) : undefined;
  const volPct = volume != null ? Math.round(volume * 100) : null;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOff) {
      // Wake-on-LAN to turn on
      callHA('button', 'press', undefined, { entity_id: 'button.wake_on_lan_ac_b6_87_2f_d3_be' });
    } else {
      // WebOS to turn off
      callHA('media_player', 'turn_off', undefined, { entity_id: TV_ID });
    }
  };

  return (
    <div className={`tvw ${isOff ? 'off' : ''} ${isPlaying ? 'playing' : ''}`} onClick={() => setExpanded((v) => !v)}>
      {artUrl && !isOff && <div className="tvw-art" style={{ backgroundImage: `url("${artUrl}")` }} />}

      <div className="tvw-top">
        <span className={`mdi ${appIcon(source)} tvw-icon`} />
        <div className="tvw-info">
          <span className="tvw-name">TV LG{!isOff && source ? ` · ${source}` : ''}</span>
          {isOff ? <span className="tvw-status">Spenta</span> : title ? <span className="tvw-title">{title}</span> : null}
        </div>
        <button className={`tvw-power ${isOff ? '' : 'on'}`} onClick={toggle}>
          <span className="mdi mdi-power" />
        </button>
      </div>

      {/* Expanded controls */}
      {expanded && !isOff && (
        <div className="tvw-controls" onClick={(e) => e.stopPropagation()}>
          <div className="tvw-vol">
            <button className="tvw-btn" onClick={() => callHA('media_player', 'volume_mute', { is_volume_muted: !muted }, { entity_id: TV_ID })}>
              <span className={`mdi ${muted ? 'mdi-volume-off' : 'mdi-volume-high'}`} />
            </button>
            <input type="range" className="tvw-vol-slider" min={0} max={100} value={volPct ?? 0}
              onChange={(e) => callHA('media_player', 'volume_set', { volume_level: parseInt(e.target.value) / 100 }, { entity_id: TV_ID })} />
            <span className="tvw-vol-val">{volPct ?? 0}%</span>
          </div>
          <div className="tvw-btns">
            {(isPlaying || isPaused) && (
              <button className="tvw-btn" onClick={() => callHA('media_player', 'media_play_pause', undefined, { entity_id: TV_ID })}>
                <span className={`mdi ${isPlaying ? 'mdi-pause' : 'mdi-play'}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {volPct != null && !isOff && <div className="tvw-bar"><div className="tvw-bar-fill" style={{ width: `${volPct}%` }} /></div>}
    </div>
  );
}
