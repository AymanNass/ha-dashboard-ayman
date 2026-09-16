import { useState } from 'react';
import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { HA_URL, spotifyPlaylists, spotifyDevices } from '../config';

type CallHA = (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;

interface Props {
  entities: HassEntities;
  callHA: CallHA;
  onOpenDetail: (entityId: string) => void;
}

interface DeviceDef {
  entity_id: string;
  name: string;
  icon: string;
  room: string;
  type: 'echo' | 'tv' | 'spotify' | 'group';
}

const DEVICES: DeviceDef[] = [
  { entity_id: 'media_player.echo_dot_di_martina', name: 'Echo Camera', icon: 'mdi-speaker', room: 'Camera', type: 'echo' },
  { entity_id: 'media_player.3o_echo_dot_di_martina', name: 'Echo Salotto', icon: 'mdi-speaker', room: 'Salotto', type: 'echo' },
  { entity_id: 'media_player.echo_dot_bagno', name: 'Echo Bagno', icon: 'mdi-speaker', room: 'Bagno', type: 'echo' },
  { entity_id: 'media_player.ovunque', name: 'Ovunque', icon: 'mdi-speaker-group', room: 'Tutta casa', type: 'group' },
  { entity_id: 'media_player.spotify_martina', name: 'Spotify', icon: 'mdi-spotify', room: 'Streaming', type: 'spotify' },
  { entity_id: 'media_player.lg_tv', name: 'TV LG', icon: 'mdi-television', room: 'Salotto', type: 'tv' },
];

function DeviceCard({ device, entity, callHA, onOpenDetail }: { device: DeviceDef; entity: HassEntity | undefined; callHA: CallHA; onOpenDetail: (id: string) => void }) {
  const state = entity?.state ?? 'unavailable';
  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';
  const isActive = isPlaying || isPaused;
  const isOff = state === 'off' || state === 'unavailable';

  const volume = entity?.attributes.volume_level as number | undefined;
  const muted = entity?.attributes.is_volume_muted as boolean | undefined;
  const title = entity?.attributes.media_title as string | undefined;
  const artist = entity?.attributes.media_artist as string | undefined;
  const app = entity?.attributes.app_name as string | undefined;
  const source = entity?.attributes.source as string | undefined;
  const picture = entity?.attributes.entity_picture as string | undefined;
  const artUrl = picture ? (picture.startsWith('http') ? picture : `${HA_URL}${picture}`) : undefined;

  const volPct = volume != null ? Math.round(volume * 100) : null;

  const typeColor = device.type === 'spotify' ? '#1db954' : device.type === 'tv' ? '#a855f7' : device.type === 'group' ? '#06b6d4' : '#3b82f6';

  return (
    <div className={`mp2-card ${isActive ? 'active' : ''} ${isOff ? 'is-off' : ''}`} onClick={() => onOpenDetail(device.entity_id)}>
      {/* Artwork background */}
      {artUrl && isActive && <div className="mp2-art" style={{ backgroundImage: `url("${artUrl}")` }} />}

      <div className="mp2-card-top">
        {artUrl && isActive ? (
          <img className="mp2-card-thumb" src={artUrl} alt="" />
        ) : (
          <span className={`mdi ${device.icon} mp2-device-icon`} style={{ color: isActive ? typeColor : undefined }} />
        )}
        <div className="mp2-device-info">
          <span className="mp2-device-name">{device.name}</span>
          <span className="mp2-device-room">{device.room}</span>
        </div>
        <span className={`mp2-state ${isActive ? 'playing' : ''}`}>
          {isOff ? 'Off' : isPlaying ? '▶' : isPaused ? '⏸' : 'Idle'}
        </span>
      </div>

      {/* Now playing info */}
      {isActive && (title || artist || source) && (
        <div className="mp2-now">
          {title && <span className="mp2-title">{title}</span>}
          {artist && <span className="mp2-artist">{artist}</span>}
          {!title && source && <span className="mp2-title">{source}</span>}
          {!title && !source && app && <span className="mp2-app">{app}</span>}
        </div>
      )}
      {!isActive && source && !isOff && (
        <div className="mp2-now">
          <span className="mp2-app">{source}</span>
        </div>
      )}

      {/* Controls (only when active or idle echo) */}
      {!isOff && (
        <div className="mp2-controls">
          <div className="mp2-btns">
            {isPlaying ? (
              <button className="mp2-btn" onClick={(e) => { e.stopPropagation(); callHA('media_player', 'media_pause', undefined, { entity_id: device.entity_id }); }}>
                <span className="mdi mdi-pause" />
              </button>
            ) : (
              <button className="mp2-btn" onClick={(e) => { e.stopPropagation(); callHA('media_player', 'media_play', undefined, { entity_id: device.entity_id }); }}>
                <span className="mdi mdi-play" />
              </button>
            )}
            <button className="mp2-btn" onClick={(e) => { e.stopPropagation(); callHA('media_player', 'media_stop', undefined, { entity_id: device.entity_id }); }}>
              <span className="mdi mdi-stop" />
            </button>
          </div>
          {volPct != null && (
            <div className="mp2-vol">
              <button className="mp2-vol-btn" onClick={(e) => { e.stopPropagation(); callHA('media_player', 'volume_mute', { is_volume_muted: !muted }, { entity_id: device.entity_id }); }}>
                <span className={`mdi ${muted ? 'mdi-volume-off' : volPct < 30 ? 'mdi-volume-low' : volPct < 70 ? 'mdi-volume-medium' : 'mdi-volume-high'}`} />
              </button>
              <input
                type="range"
                className="mp2-vol-slider"
                min={0}
                max={100}
                value={volPct}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => callHA('media_player', 'volume_set', { volume_level: parseInt(e.target.value) / 100 }, { entity_id: device.entity_id })}
              />
              <span className="mp2-vol-val">{volPct}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Music launcher: pick a playlist + target speakers, play via spotcast ──
function MusicLauncher({ callHA }: { callHA: CallHA }) {
  const [device, setDevice] = useState<string>(spotifyDevices[0]?.deviceName ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  const play = async (uri: string) => {
    if (!device) return;
    setBusy(uri);
    try {
      await callHA('spotcast', 'start', {
        uri,
        device_name: device,
        random_song: true,
        shuffle: true,
      });
    } catch {
      // spotcast can throw spurious errors but still start playback
    } finally {
      setTimeout(() => setBusy(null), 1800);
    }
  };

  return (
    <div className="mp2-section">
      <span className="mp2-stitle">MUSICA</span>

      {/* Target speaker selector */}
      <div className="ml-targets">
        {spotifyDevices.map((d) => (
          <button
            key={d.deviceName}
            className={`ml-target ${device === d.deviceName ? 'active' : ''}`}
            onClick={() => setDevice(d.deviceName)}
          >
            <span className={`mdi ${d.icon || 'mdi-speaker-wireless'}`} />
            <span>{d.name}</span>
          </button>
        ))}
      </div>

      {/* Playlist tiles — tap to play on the selected speaker */}
      <div className="ml-grid">
        {spotifyPlaylists.map((pl) => (
          <button
            key={pl.uri}
            className={`ml-tile ${busy === pl.uri ? 'busy' : ''}`}
            onClick={() => play(pl.uri)}
            disabled={busy !== null}
          >
            <span className="ml-tile-art">
              <span className={`mdi ${busy === pl.uri ? 'mdi-loading mdi-spin' : pl.icon || 'mdi-playlist-music'}`} />
            </span>
            <span className="ml-tile-name">{pl.name}</span>
            <span className="ml-tile-play">
              <span className="mdi mdi-play" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MediaPageV2({ entities, callHA, onOpenDetail }: Props) {
  // Find what's currently playing
  const playing = DEVICES.filter((d) => {
    const e = entities[d.entity_id];
    return e && (e.state === 'playing' || e.state === 'paused');
  });

  const idle = DEVICES.filter((d) => {
    const e = entities[d.entity_id];
    return e && e.state === 'idle';
  });

  const offline = DEVICES.filter((d) => {
    const e = entities[d.entity_id];
    return !e || e.state === 'off' || e.state === 'unavailable';
  });

  const allDevices = [...playing, ...idle, ...offline].filter((d) => d.entity_id !== 'media_player.lg_tv');

  const stopAll = () => {
    if (confirm('Fermare la musica su tutti i dispositivi?')) {
      callHA('media_player', 'media_stop', undefined, { entity_id: DEVICES.map((d) => d.entity_id) });
    }
  };

  return (
    <div className="mp2">
      {/* Header */}
      <div className="mp2-header">
        <div>
          <span className="mp2-page-title">Media</span>
          <span className="mp2-page-sub">{playing.length > 0 ? `${playing.length} in riproduzione` : 'Nessuna riproduzione'}</span>
        </div>
        {playing.length > 0 && (
          <button className="mp2-stop-all" onClick={stopAll}>
            <span className="mdi mdi-stop-circle" /> Ferma tutto
          </button>
        )}
      </div>

      {/* Now playing section — removed, devices are shown in unified grid below with active ones highlighted */}

      {/* Music launcher — playlists + target speakers */}
      <MusicLauncher callHA={callHA} />

      {/* TV Control Center */}
      {(() => {
        const tv = entities['media_player.lg_tv'];
        if (!tv) return null;
        const tvState = tv.state;
        const tvOff = tvState === 'off' || tvState === 'unavailable' || tvState === 'standby';
        const tvAttrs = tv.attributes ?? {};
        const tvSource = tvAttrs.source as string | undefined;
        const tvVol = tvAttrs.volume_level as number | undefined;
        const tvMuted = tvAttrs.is_volume_muted as boolean | undefined;
        const tvTitle = tvAttrs.media_title as string | undefined;
        const tvArtist = tvAttrs.media_artist as string | undefined;
        const tvPic = tvAttrs.entity_picture as string | undefined;
        const tvArt = tvPic ? (tvPic.startsWith('http') ? tvPic : `${HA_URL}${tvPic}`) : undefined;
        const tvVolPct = tvVol != null ? Math.round(tvVol * 100) : null;
        const tvPlaying = tvState === 'playing';
        const tvPaused = tvState === 'paused';

        const APPS = [
          { name: 'Netflix', icon: 'mdi-netflix', color: '#e50914' },
          { name: 'Prime Video', icon: 'mdi-amazon', color: '#00a8e1' },
          { name: 'Disney+', icon: 'mdi-disney', color: '#113ccf' },
          { name: 'YouTube', icon: 'mdi-youtube', color: '#ff0000' },
          { name: 'DAZN', icon: 'mdi-soccer', color: '#f8f8f5' },
          { name: 'RaiPlay', icon: 'mdi-television-classic', color: '#003fa2' },
          { name: 'Stremio', icon: 'mdi-filmstrip', color: '#8b5cf6' },
          { name: 'NOW', icon: 'mdi-television-play', color: '#06b6d4' },
          { name: 'Mediaset Infinity', icon: 'mdi-television-classic', color: '#1e40af' },
          { name: 'Apple TV', icon: 'mdi-apple', color: '#a3a3a3' },
          { name: 'Spotify', icon: 'mdi-spotify', color: '#1db954' },
          { name: 'HDMI 1', icon: 'mdi-video-input-hdmi', color: '#64748b' },
          { name: 'HDMI 2', icon: 'mdi-video-input-hdmi', color: '#64748b' },
        ];

        return (
          <div className="mp2-section">
            <span className="mp2-stitle">TV LG</span>
            <div className="mp2-tv">
              {/* TV status + artwork */}
              <div className="mp2-tv-head">
                {tvArt && !tvOff && <div className="mp2-tv-art" style={{ backgroundImage: `url("${tvArt}")` }} />}
                {tvArt && !tvOff && <img className="mp2-tv-thumb" src={tvArt} alt="" />}
                <div className="mp2-tv-info">
                  <span className="mp2-tv-state">{tvOff ? 'Spenta' : tvSource || 'Accesa'}</span>
                  {tvTitle && <span className="mp2-tv-title">{tvTitle}</span>}
                  {tvArtist && <span className="mp2-tv-artist">{tvArtist}</span>}
                </div>
                <button className={`mp2-tv-power ${tvOff ? '' : 'on'}`} onClick={() => {
                  if (tvOff) callHA('button', 'press', undefined, { entity_id: 'button.wake_on_lan_ac_b6_87_2f_d3_be' });
                  else callHA('media_player', 'turn_off', undefined, { entity_id: 'media_player.lg_tv' });
                }}>
                  <span className="mdi mdi-power" />
                </button>
              </div>

              {!tvOff && (
                <>
                  {/* Volume */}
                  <div className="mp2-tv-vol">
                    <button className="mp2-tv-btn" onClick={() => callHA('media_player', 'volume_mute', { is_volume_muted: !tvMuted }, { entity_id: 'media_player.lg_tv' })}>
                      <span className={`mdi ${tvMuted ? 'mdi-volume-off' : 'mdi-volume-high'}`} />
                    </button>
                    <input type="range" className="mp2-tv-slider" min={0} max={100} value={tvVolPct ?? 0}
                      onChange={(e) => callHA('media_player', 'volume_set', { volume_level: parseInt(e.target.value) / 100 }, { entity_id: 'media_player.lg_tv' })} />
                    <span className="mp2-tv-volval">{tvVolPct}%</span>
                    {(tvPlaying || tvPaused) && (
                      <button className="mp2-tv-btn" onClick={() => callHA('media_player', 'media_play_pause', undefined, { entity_id: 'media_player.lg_tv' })}>
                        <span className={`mdi ${tvPlaying ? 'mdi-pause' : 'mdi-play'}`} />
                      </button>
                    )}
                  </div>

                  {/* App launcher */}
                  <div className="mp2-apps">
                    {APPS.map((app) => (
                      <button key={app.name} className={`mp2-app ${tvSource === app.name ? 'active' : ''}`}
                        onClick={() => callHA('media_player', 'select_source', { source: app.name }, { entity_id: 'media_player.lg_tv' })}>
                        <span className={`mdi ${app.icon}`} style={{ color: app.color }} />
                        <span className="mp2-app-name">{app.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* All devices — playing ones first, highlighted */}
      <div className="mp2-section">
        <span className="mp2-stitle">DISPOSITIVI</span>
        <div className="mp2-grid">
          {allDevices.map((d) => (
            <DeviceCard key={d.entity_id} device={d} entity={entities[d.entity_id]} callHA={callHA} onOpenDetail={onOpenDetail} />
          ))}
        </div>
      </div>

      {/* Quick zones */}
      <div className="mp2-section">
        <span className="mp2-stitle">ZONE RAPIDE</span>
        <div className="mp2-zones">
          <button className="mp2-zone" onClick={() => callHA('media_player', 'volume_set', { volume_level: 0.3 }, { entity_id: ['media_player.3o_echo_dot_di_martina', 'media_player.echo_dot_di_martina', 'media_player.echo_dot_bagno'] })}>
            <span className="mdi mdi-volume-medium" /> Volume 30% ovunque
          </button>
          <button className="mp2-zone" onClick={() => callHA('media_player', 'volume_set', { volume_level: 0.15 }, { entity_id: ['media_player.3o_echo_dot_di_martina', 'media_player.echo_dot_di_martina', 'media_player.echo_dot_bagno'] })}>
            <span className="mdi mdi-volume-low" /> Volume basso
          </button>
          <button className="mp2-zone" onClick={() => { if (confirm('Fermare tutto l\'audio?')) callHA('media_player', 'media_stop', undefined, { entity_id: DEVICES.map((d) => d.entity_id) }); }}>
            <span className="mdi mdi-volume-off" /> Silenzio totale
          </button>
        </div>
      </div>
    </div>
  );
}
