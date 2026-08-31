import { useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { HA_URL } from '../config';

const TV_ID = 'media_player.lg_tv';

type CallHA = (
  domain: string,
  service: string,
  data?: Record<string, unknown>,
  target?: { entity_id: string | string[] },
) => Promise<void>;

interface Props {
  entities: HassEntities;
  callHA: CallHA;
  onOpenDetail: (entityId: string) => void;
}

const APP_ICONS: Record<string, string> = {
  netflix: 'mdi-netflix',
  youtube: 'mdi-youtube',
  'disney+': 'mdi-disney',
  'prime video': 'mdi-amazon',
  spotify: 'mdi-spotify',
  'apple tv': 'mdi-apple',
  dazn: 'mdi-soccer',
  raiplay: 'mdi-television-classic',
  stremio: 'mdi-filmstrip',
  now: 'mdi-television-play',
};

function getAppIcon(source?: string): string {
  const key = (source || '').toLowerCase();
  for (const [k, icon] of Object.entries(APP_ICONS)) {
    if (key.includes(k)) return icon;
  }
  if (key.includes('hdmi')) return 'mdi-video-input-hdmi';
  return 'mdi-television';
}

export function TvWidget({ entities, callHA, onOpenDetail }: Props) {
  const entity = entities[TV_ID];
  const [powering, setPowering] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const state = entity?.state ?? 'unavailable';
  const isOff = state === 'off' || state === 'unavailable' || state === 'standby';
  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';

  const attrs = entity?.attributes ?? {};
  const source = attrs.source as string | undefined;
  const volume = attrs.volume_level as number | undefined;
  const muted = attrs.is_volume_muted as boolean | undefined;
  const sourceList = (attrs.source_list as string[]) || [];
  const picture = attrs.entity_picture as string | undefined;
  const artUrl = picture ? (picture.startsWith('http') ? picture : `${HA_URL}${picture}`) : undefined;
  const title = attrs.media_title as string | undefined;
  const artist = attrs.media_artist as string | undefined;

  const volPct = volume != null ? Math.round(volume * 100) : null;
  const appIcon = getAppIcon(source);

  const togglePower = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPowering(true);
    try {
      await callHA('media_player', isOff ? 'turn_on' : 'turn_off', undefined, { entity_id: TV_ID });
    } finally {
      setTimeout(() => setPowering(false), 2000);
    }
  };

  const selectSource = (s: string) => {
    callHA('media_player', 'select_source', { source: s }, { entity_id: TV_ID });
    setShowSources(false);
  };

  return (
    <div
      className={`tvw ${isOff ? 'off' : ''} ${isPlaying ? 'playing' : ''}`}
      onClick={() => onOpenDetail(TV_ID)}
    >
      {/* Artwork background — dark overlay for readability */}
      {artUrl && !isOff && (
        <div className="tvw-art" style={{ backgroundImage: `url("${artUrl}")` }} />
      )}

      {/* Content */}
      <div className="tvw-top">
        <span className={`mdi ${appIcon} tvw-icon`} />
        <div className="tvw-info">
          <span className="tvw-name">TV LG</span>
          {isOff ? (
            <span className="tvw-status">Spenta</span>
          ) : (
            <span className="tvw-source">{source || 'Accesa'}</span>
          )}
          {!isOff && title && <span className="tvw-title">{title}</span>}
          {!isOff && artist && <span className="tvw-artist">{artist}</span>}
        </div>
        <button
          className={`tvw-power ${isOff ? '' : 'on'} ${powering ? 'spin' : ''}`}
          onClick={togglePower}
          title={isOff ? 'Accendi' : 'Spegni'}
        >
          <span className="mdi mdi-power" />
        </button>
      </div>

      {/* Controls — only when on */}
      {!isOff && (
        <div className="tvw-controls" onClick={(e) => e.stopPropagation()}>
          {/* Volume */}
          <div className="tvw-vol">
            <button className="tvw-btn" onClick={() => callHA('media_player', 'volume_mute', { is_volume_muted: !muted }, { entity_id: TV_ID })}>
              <span className={`mdi ${muted ? 'mdi-volume-off' : 'mdi-volume-high'}`} />
            </button>
            <input
              type="range"
              className="tvw-vol-slider"
              min={0}
              max={100}
              value={volPct ?? 0}
              onChange={(e) => callHA('media_player', 'volume_set', { volume_level: parseInt(e.target.value) / 100 }, { entity_id: TV_ID })}
            />
            <span className="tvw-vol-val">{volPct ?? 0}%</span>
          </div>

          {/* Transport + source */}
          <div className="tvw-btns">
            {(isPlaying || isPaused) && (
              <button className="tvw-btn" onClick={() => callHA('media_player', 'media_play_pause', undefined, { entity_id: TV_ID })}>
                <span className={`mdi ${isPlaying ? 'mdi-pause' : 'mdi-play'}`} />
              </button>
            )}
            <div className="tvw-source-wrap">
              <button className="tvw-btn tvw-btn-source" onClick={() => setShowSources((v) => !v)}>
                <span className="mdi mdi-import" /> <span className="tvw-btn-label">{source || 'Input'}</span>
              </button>
              {showSources && (
                <div className="tvw-source-menu">
                  {sourceList.slice(0, 12).map((s) => (
                    <button key={s} className={`tvw-source-item ${s === source ? 'active' : ''}`} onClick={() => selectSource(s)}>
                      <span className={`mdi ${getAppIcon(s)}`} /> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Volume bar */}
      {volPct != null && !isOff && (
        <div className="tvw-bar"><div className="tvw-bar-fill" style={{ width: `${volPct}%` }} /></div>
      )}
    </div>
  );
}
