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
  netflix: 'mdi-netflix', youtube: 'mdi-youtube', 'disney+': 'mdi-disney', disney: 'mdi-disney',
  'prime video': 'mdi-amazon', 'amazon prime video': 'mdi-amazon', spotify: 'mdi-spotify',
  'apple tv': 'mdi-apple', dazn: 'mdi-soccer', raiplay: 'mdi-television-classic',
  'mediaset infinity': 'mdi-television-classic', stremio: 'mdi-play-circle', now: 'mdi-television-play',
};

function getAppIcon(source?: string): string {
  const key = (source || '').toLowerCase();
  for (const [k, icon] of Object.entries(APP_ICONS)) {
    if (key.includes(k)) return icon;
  }
  if (key.startsWith('hdmi')) return 'mdi-video-input-hdmi';
  return 'mdi-television';
}

export function TvWidget({ entities, callHA, onOpenDetail }: Props) {
  const entity = entities[TV_ID];
  const [showSources, setShowSources] = useState(false);

  const state = entity?.state ?? 'unavailable';
  const isOff = state === 'off' || state === 'unavailable' || state === 'standby';
  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';

  const attrs = entity?.attributes ?? {};
  const source = attrs.source as string | undefined;
  const sourceList = (attrs.source_list as string[]) ?? [];
  const volume = attrs.volume_level as number | undefined;
  const muted = attrs.is_volume_muted as boolean | undefined;
  const title = attrs.media_title as string | undefined;
  const artist = attrs.media_artist as string | undefined;
  const picture = attrs.entity_picture as string | undefined;
  const artUrl = picture ? (picture.startsWith('http') ? picture : `${HA_URL}${picture}`) : undefined;

  const volPct = volume != null ? Math.round(volume * 100) : null;
  const appIcon = getAppIcon(source);

  const togglePower = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('media_player', isOff ? 'turn_on' : 'turn_off', undefined, { entity_id: TV_ID });
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('media_player', 'volume_mute', { is_volume_muted: !muted }, { entity_id: TV_ID });
  };

  const setSource = (s: string) => {
    callHA('media_player', 'select_source', { source: s }, { entity_id: TV_ID });
    setShowSources(false);
  };

  // Top 6 favorite sources to show as quick buttons
  const favSources = ['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'DAZN', 'RaiPlay']
    .filter((s) => sourceList.some((sl) => sl.toLowerCase() === s.toLowerCase()));

  return (
    <div className="tvw" onClick={() => onOpenDetail(TV_ID)}>
      {/* Artwork blur bg */}
      {artUrl && !isOff && <div className="tvw-art-bg" style={{ backgroundImage: `url("${artUrl}")` }} />}

      <div className="tvw-top">
        <span className={`mdi ${appIcon} tvw-icon`} style={{ color: isOff ? 'var(--text-muted)' : '#a855f7' }} />
        <div className="tvw-info">
          <span className="tvw-name">TV LG</span>
          {isOff ? (
            <span className="tvw-state">Spenta</span>
          ) : (
            <span className="tvw-state">{source || 'Accesa'}</span>
          )}
        </div>
        <button className={`tvw-power ${isOff ? '' : 'on'}`} onClick={togglePower}>
          <span className="mdi mdi-power" />
        </button>
      </div>

      {/* Now playing */}
      {!isOff && (title || artist) && (
        <div className="tvw-now">
          {title && <span className="tvw-title">{title}</span>}
          {artist && <span className="tvw-artist">{artist}</span>}
        </div>
      )}

      {/* Controls — only when on */}
      {!isOff && (
        <div className="tvw-controls" onClick={(e) => e.stopPropagation()}>
          {/* Play/pause */}
          {(isPlaying || isPaused) && (
            <button className="tvw-btn" onClick={() => callHA('media_player', 'media_play_pause', undefined, { entity_id: TV_ID })}>
              <span className={`mdi ${isPlaying ? 'mdi-pause' : 'mdi-play'}`} />
            </button>
          )}

          {/* Mute */}
          <button className={`tvw-btn ${muted ? 'muted' : ''}`} onClick={toggleMute}>
            <span className={`mdi ${muted ? 'mdi-volume-off' : 'mdi-volume-high'}`} />
          </button>

          {/* Volume slider */}
          {volPct != null && (
            <input
              type="range"
              className="tvw-vol"
              min={0}
              max={100}
              value={volPct}
              onChange={(e) => callHA('media_player', 'volume_set', { volume_level: parseInt(e.target.value) / 100 }, { entity_id: TV_ID })}
            />
          )}
          {volPct != null && <span className="tvw-vol-val">{volPct}%</span>}

          {/* Source picker */}
          <button className="tvw-btn tvw-src-btn" onClick={() => setShowSources((v) => !v)}>
            <span className="mdi mdi-import" />
          </button>
        </div>
      )}

      {/* Quick source buttons */}
      {!isOff && favSources.length > 0 && !showSources && (
        <div className="tvw-fav-sources" onClick={(e) => e.stopPropagation()}>
          {favSources.map((s) => (
            <button
              key={s}
              className={`tvw-fav ${source?.toLowerCase() === s.toLowerCase() ? 'active' : ''}`}
              onClick={() => setSource(s)}
            >
              <span className={`mdi ${getAppIcon(s)}`} />
            </button>
          ))}
        </div>
      )}

      {/* Full source list popup */}
      {showSources && (
        <div className="tvw-source-list" onClick={(e) => e.stopPropagation()}>
          {sourceList.map((s) => (
            <button key={s} className={`tvw-source-item ${source === s ? 'active' : ''}`} onClick={() => setSource(s)}>
              <span className={`mdi ${getAppIcon(s)}`} /> {s}
            </button>
          ))}
        </div>
      )}

      {/* Volume bar bottom */}
      {volPct != null && !isOff && (
        <div className="tvw-vol-bar"><div className="tvw-vol-fill" style={{ width: `${volPct}%` }} /></div>
      )}
    </div>
  );
}
