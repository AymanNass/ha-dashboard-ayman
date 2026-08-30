import { useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { resolveArtwork } from '../lib/entityInfo';
import { useArtworkColor } from '../hooks/useArtworkColor';

const CAST_ID = 'media_player.lg_webos_tv_oled65g26la';
const WEBOS_ID = 'media_player.lg_tv';

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

/** Known streaming app icons (MDI). */
const APP_ICONS: Record<string, string> = {
  netflix: 'mdi-netflix',
  youtube: 'mdi-youtube',
  'youtube tv': 'mdi-youtube-tv',
  disney: 'mdi-disney',
  'disney+': 'mdi-disney',
  plex: 'mdi-plex',
  spotify: 'mdi-spotify',
  'amazon prime video': 'mdi-amazon',
  'prime video': 'mdi-amazon',
  kodi: 'mdi-kodi',
  'apple tv': 'mdi-apple',
  hbo: 'mdi-alpha-h-box',
  'hbo max': 'mdi-alpha-h-box',
  twitch: 'mdi-twitch',
  dazn: 'mdi-soccer',
  'now tv': 'mdi-television-play',
  raiplay: 'mdi-television-classic',
  mediaset: 'mdi-television-classic',
};

function getAppIcon(appName?: string, source?: string): string {
  const key = (appName || source || '').toLowerCase();
  for (const [k, icon] of Object.entries(APP_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return 'mdi-television';
}

/**
 * Modern multimedia TV card for the LG TV.
 * Shows artwork when playing, app info, quick transport controls,
 * and a power toggle. Tapping opens the full TV detail panel.
 */
export function TvWidget({ entities, callHA, onOpenDetail }: Props) {
  const entity = entities[CAST_ID];
  const webosEntity = entities[WEBOS_ID];
  const [powering, setPowering] = useState(false);

  const isOff =
    !entity ||
    entity.state === 'off' ||
    entity.state === 'unavailable' ||
    entity.state === 'standby';

  const isPlaying = entity?.state === 'playing';
  const isPaused = entity?.state === 'paused';
  const isIdle = entity?.state === 'idle';
  const isActive = isPlaying || isPaused || isIdle;

  const a = entity?.attributes ?? {};
  const title = a.media_title as string | undefined;
  const artist = a.media_artist as string | undefined;
  const appName = a.app_name as string | undefined;
  const source = (entity?.attributes.source as string | undefined) ??
    (webosEntity?.attributes.source as string | undefined);
  const volume = a.volume_level as number | undefined;

  const artwork = isActive ? resolveArtwork(entity, CAST_ID, entities) : undefined;
  const tint = useArtworkColor(artwork);

  const appIcon = getAppIcon(appName, source);

  const togglePower = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPowering(true);
    try {
      if (isOff) {
        await callHA('media_player', 'turn_on', undefined, { entity_id: WEBOS_ID });
      } else {
        await callHA('media_player', 'turn_off', undefined, { entity_id: WEBOS_ID });
      }
    } finally {
      setTimeout(() => setPowering(false), 2000);
    }
  };

  const playPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('media_player', 'media_play_pause', undefined, { entity_id: CAST_ID });
  };

  const volumeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('media_player', 'volume_down', undefined, { entity_id: WEBOS_ID });
  };

  const volumeUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    callHA('media_player', 'volume_up', undefined, { entity_id: WEBOS_ID });
  };

  return (
    <div
      className={`tv-widget ${isOff ? 'is-off' : 'is-on'} ${isPlaying ? 'is-playing' : ''}`}
      style={tint ? ({ '--tv-tint': tint } as React.CSSProperties) : undefined}
      onClick={() => onOpenDetail(CAST_ID)}
      role="button"
      tabIndex={0}
      aria-label="TV LG"
    >
      {/* Artwork backdrop (blurred) */}
      {artwork && (
        <div
          className="tv-widget-backdrop"
          style={{ backgroundImage: `url("${artwork}")` }}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <div className="tv-widget-content">
        {/* Left: app icon or artwork thumbnail */}
        <div className="tv-widget-visual">
          {artwork ? (
            <img className="tv-widget-art" src={artwork} alt={title || 'Now playing'} />
          ) : (
            <div className="tv-widget-icon-wrap">
              <span className={`mdi ${appIcon}`} />
            </div>
          )}
        </div>

        {/* Center: info */}
        <div className="tv-widget-info">
          <div className="tv-widget-name">TV LG</div>
          {isOff ? (
            <div className="tv-widget-status">Spenta</div>
          ) : (
            <>
              {title && <div className="tv-widget-title">{title}</div>}
              {artist && <div className="tv-widget-artist">{artist}</div>}
              {!title && (appName || source) && (
                <div className="tv-widget-app">{appName || source}</div>
              )}
              {!title && !appName && !source && (
                <div className="tv-widget-status">Accesa</div>
              )}
            </>
          )}
        </div>

        {/* Right: controls */}
        <div className="tv-widget-controls">
          {!isOff && (
            <>
              <button className="tv-widget-btn" onClick={volumeDown} title="Volume -" aria-label="Volume giù">
                <span className="mdi mdi-volume-minus" />
              </button>
              {isActive && (
                <button className="tv-widget-btn tv-widget-btn-play" onClick={playPause} title={isPlaying ? 'Pausa' : 'Play'} aria-label={isPlaying ? 'Pausa' : 'Play'}>
                  <span className={`mdi ${isPlaying ? 'mdi-pause' : 'mdi-play'}`} />
                </button>
              )}
              <button className="tv-widget-btn" onClick={volumeUp} title="Volume +" aria-label="Volume su">
                <span className="mdi mdi-volume-plus" />
              </button>
            </>
          )}
          <button
            className={`tv-widget-btn tv-widget-btn-power ${isOff ? '' : 'is-on'} ${powering ? 'powering' : ''}`}
            onClick={togglePower}
            title={isOff ? 'Accendi' : 'Spegni'}
            aria-label={isOff ? 'Accendi TV' : 'Spegni TV'}
          >
            <span className="mdi mdi-power" />
          </button>
        </div>
      </div>

      {/* Volume bar (thin, at the bottom) */}
      {volume != null && !isOff && (
        <div className="tv-widget-vol-track" aria-hidden="true">
          <div className="tv-widget-vol-fill" style={{ width: `${Math.round(volume * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
