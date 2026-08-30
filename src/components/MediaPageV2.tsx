import { useState } from 'react';
import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { HA_URL } from '../config';

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
  { entity_id: 'media_player.lg_webos_tv_oled65g26la', name: 'TV LG', icon: 'mdi-television', room: 'Salotto', type: 'tv' },
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
        <span className={`mdi ${device.icon} mp2-device-icon`} style={{ color: isActive ? typeColor : undefined }} />
        <div className="mp2-device-info">
          <span className="mp2-device-name">{device.name}</span>
          <span className="mp2-device-room">{device.room}</span>
        </div>
        <span className={`mp2-state ${isActive ? 'playing' : ''}`}>
          {isOff ? 'Off' : isPlaying ? '▶' : isPaused ? '⏸' : 'Idle'}
        </span>
      </div>

      {/* Now playing */}
      {isActive && (title || artist) && (
        <div className="mp2-now">
          {title && <span className="mp2-title">{title}</span>}
          {artist && <span className="mp2-artist">{artist}</span>}
          {app && !title && <span className="mp2-app">{app}</span>}
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

      {/* Now playing section */}
      {playing.length > 0 && (
        <div className="mp2-section">
          <span className="mp2-stitle">IN RIPRODUZIONE</span>
          <div className="mp2-grid mp2-grid-playing">
            {playing.map((d) => (
              <DeviceCard key={d.entity_id} device={d} entity={entities[d.entity_id]} callHA={callHA} onOpenDetail={onOpenDetail} />
            ))}
          </div>
        </div>
      )}

      {/* Devices */}
      <div className="mp2-section">
        <span className="mp2-stitle">DISPOSITIVI</span>
        <div className="mp2-grid">
          {idle.map((d) => (
            <DeviceCard key={d.entity_id} device={d} entity={entities[d.entity_id]} callHA={callHA} onOpenDetail={onOpenDetail} />
          ))}
          {offline.map((d) => (
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
