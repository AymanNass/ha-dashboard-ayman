import { useEffect, useRef, useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import {
  HA_URL,
  SPOTIFY_PLAYER,
  musicPlaylists,
  musicDevices,
  type MusicDevice,
} from '../config';

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

/** Resolve an entity_picture path to a full URL. */
function artUrl(picture?: string): string | undefined {
  if (!picture) return undefined;
  return picture.startsWith('http') ? picture : `${HA_URL}${picture}`;
}

export function MusicaPage({ entities, callHA, onOpenDetail }: Props) {
  const [device, setDevice] = useState<MusicDevice>(musicDevices[0]);
  const [busy, setBusy] = useState<string | null>(null);

  const spotify = entities[SPOTIFY_PLAYER];
  const echo = entities[device.entity_id];

  const state = spotify?.state ?? 'idle';
  const isPlaying = state === 'playing';
  const isActive = isPlaying || state === 'paused';

  const title = spotify?.attributes.media_title as string | undefined;
  const artist = spotify?.attributes.media_artist as string | undefined;
  const source = spotify?.attributes.source as string | undefined;
  const cover = artUrl(spotify?.attributes.entity_picture as string | undefined);
  const shuffle = spotify?.attributes.shuffle as boolean | undefined;
  const repeat = (spotify?.attributes.repeat as string | undefined) ?? 'off';

  // Track position/duration for the seek bar.
  const duration = spotify?.attributes.media_duration as number | undefined;
  const position = spotify?.attributes.media_position as number | undefined;
  const positionUpdatedAt = spotify?.attributes.media_position_updated_at as string | undefined;

  // Volume comes from the target Echo speaker (per-room), fall back to spotify.
  const volEntity = echo?.attributes.volume_level != null ? device.entity_id : SPOTIFY_PLAYER;
  const liveVolume = entities[volEntity]?.attributes.volume_level as number | undefined;
  const liveVolPct = liveVolume != null ? Math.round(liveVolume * 100) : null;

  // Local volume state so dragging the slider is instant (no lag from waiting
  // on HA round-trips). We only send to HA on release, and otherwise stay in
  // sync with the live value when the user isn't dragging.
  const [dragVol, setDragVol] = useState<number | null>(null);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!draggingRef.current) setDragVol(liveVolPct);
  }, [liveVolPct]);
  const volPct = dragVol;

  /** Ask HA to refresh an entity's state now (Spotify can be slow to push). */
  const refresh = (entity_id: string) =>
    callHA('homeassistant', 'update_entity', undefined, { entity_id }).catch(() => {});

  /** Play a playlist on the currently selected device using the proven recipe:
   *  select_source (Spotify Connect device) → short delay → play_media. */
  const playPlaylist = async (uri: string) => {
    setBusy(uri);
    try {
      await callHA('media_player', 'select_source', { source: device.source }, { entity_id: SPOTIFY_PLAYER });
      await new Promise((r) => setTimeout(r, 2500));
      await callHA(
        'media_player',
        'play_media',
        { media_content_id: uri, media_content_type: 'playlist' },
        { entity_id: SPOTIFY_PLAYER },
      );
      // Nudge HA to publish the new now-playing state a few times, since the
      // Spotify integration doesn't always push it immediately.
      for (const ms of [800, 2000, 4000]) setTimeout(() => refresh(SPOTIFY_PLAYER), ms);
    } catch {
      // ignore; state will reflect reality
    } finally {
      setTimeout(() => setBusy(null), 1200);
    }
  };

  const svc = async (service: string, data?: Record<string, unknown>) => {
    try {
      await callHA('media_player', service, data, { entity_id: SPOTIFY_PLAYER });
    } catch {
      // Some services (e.g. media_stop) aren't supported by the Spotify
      // integration and throw. Swallow so the UI doesn't surface a raw error.
    }
    setTimeout(() => refresh(SPOTIFY_PLAYER), 500);
  };

  const commitVolume = (pct: number) =>
    callHA('media_player', 'volume_set', { volume_level: pct / 100 }, { entity_id: volEntity });

  // Cycle repeat: off → all → one → off.
  const cycleRepeat = () => {
    const next = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    svc('repeat_set', { repeat: next });
  };

  // ── Seek bar: interpolate elapsed time while playing ──
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [isPlaying]);

  const hasProgress = duration != null && duration > 0 && position != null;
  const base = positionUpdatedAt ? new Date(positionUpdatedAt).getTime() : now;
  const extra = isPlaying ? Math.max(0, (now - base) / 1000) : 0;
  const elapsed = hasProgress ? Math.min(duration!, position! + extra) : 0;
  const progressPct = hasProgress ? Math.max(0, Math.min(100, (elapsed / duration!) * 100)) : 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasProgress) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    svc('media_seek', { seek_position: ratio * duration! });
  };

  const fmt = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const repeatIcon = repeat === 'one' ? 'mdi-repeat-once' : 'mdi-repeat';

  return (
    <div className="music-page">
      {/* ── Now playing ── */}
      <div className={`music-np ${isActive ? 'active' : ''}`}>
        {cover && <div className="music-np-bg" style={{ backgroundImage: `url("${cover}")` }} />}
        <div className="music-np-inner">
          <div className="music-np-art" onClick={() => onOpenDetail(SPOTIFY_PLAYER)}>
            {cover ? (
              <img src={cover} alt="" />
            ) : (
              <span className="mdi mdi-spotify" />
            )}
          </div>
          <div className="music-np-meta">
            <span className="music-np-title">{title || (isActive ? 'In riproduzione' : 'Niente in riproduzione')}</span>
            <span className="music-np-artist">{artist || source || 'Scegli una playlist'}</span>

            {hasProgress && (
              <div className="music-seek">
                <span className="music-seek-time">{fmt(elapsed)}</span>
                <div className="music-seek-track" onClick={seek}>
                  <div className="music-seek-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="music-seek-time">{fmt(duration!)}</span>
              </div>
            )}

            <div className="music-transport">
              <button
                className={`music-tbtn ${shuffle ? 'on' : ''}`}
                onClick={() => svc('shuffle_set', { shuffle: !shuffle })}
                aria-label="Shuffle"
              >
                <span className="mdi mdi-shuffle-variant" />
              </button>
              <button className="music-tbtn" onClick={() => svc('media_previous_track')} aria-label="Precedente">
                <span className="mdi mdi-skip-previous" />
              </button>
              <button
                className="music-tbtn primary"
                onClick={() => svc('media_play_pause')}
                aria-label={isPlaying ? 'Pausa' : 'Play'}
              >
                <span className={`mdi ${isPlaying ? 'mdi-pause' : 'mdi-play'}`} />
              </button>
              <button className="music-tbtn" onClick={() => svc('media_next_track')} aria-label="Successivo">
                <span className="mdi mdi-skip-next" />
              </button>
              <button
                className={`music-tbtn ${repeat !== 'off' ? 'on' : ''}`}
                onClick={cycleRepeat}
                aria-label="Ripeti"
              >
                <span className={`mdi ${repeatIcon}`} />
              </button>
            </div>

            {volPct != null && (
              <div className="music-vol">
                <span className={`mdi ${volPct === 0 ? 'mdi-volume-off' : volPct < 40 ? 'mdi-volume-low' : volPct < 75 ? 'mdi-volume-medium' : 'mdi-volume-high'}`} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volPct}
                  onChange={(e) => setDragVol(parseInt(e.target.value))}
                  onPointerDown={() => { draggingRef.current = true; }}
                  onPointerUp={(e) => {
                    draggingRef.current = false;
                    commitVolume(parseInt((e.target as HTMLInputElement).value));
                  }}
                  onKeyUp={(e) => commitVolume(parseInt((e.target as HTMLInputElement).value))}
                />
                <span className="music-vol-val">{volPct}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Device selector ── */}
      <div className="music-devices">
        {musicDevices.map((d) => {
          const playingHere = isActive && source === d.source;
          return (
            <button
              key={d.source}
              className={`music-dev ${device.source === d.source ? 'active' : ''} ${playingHere ? 'live' : ''}`}
              onClick={() => setDevice(d)}
            >
              <span className={`mdi ${d.icon}`} />
              <span>{d.name}</span>
              {playingHere && <span className="mdi mdi-volume-high music-dev-live" />}
            </button>
          );
        })}
      </div>

      {/* ── Playlist grid ── */}
      <div className="music-grid">
        {musicPlaylists.map((pl) => (
          <button
            key={pl.uri}
            className={`music-card ${busy === pl.uri ? 'busy' : ''}`}
            onClick={() => playPlaylist(pl.uri)}
            disabled={busy !== null}
          >
            <span className="music-card-art">
              {pl.image ? (
                <img src={pl.image} alt="" loading="lazy" />
              ) : (
                <span className={`mdi ${pl.icon || 'mdi-playlist-music'}`} />
              )}
              <span className="music-card-play">
                <span className={`mdi ${busy === pl.uri ? 'mdi-loading mdi-spin' : 'mdi-play'}`} />
              </span>
            </span>
            <span className="music-card-name">{pl.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
