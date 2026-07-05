import { useState } from 'react';

export interface PlaylistItem {
  name: string;
  uri: string;
  icon?: string;
}

export interface SpotifyDevice {
  name: string;
  /** The friendly name for spotcast (device_name param). */
  deviceName: string;
  icon?: string;
}

interface Props {
  playlists: PlaylistItem[];
  devices: SpotifyDevice[];
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
}

/**
 * Spotify playlist picker + device selector for the Media page.
 * Lets you pick a playlist and an Echo Dot, then plays via spotcast.start.
 */
export function SpotifyPlaylist({ playlists, devices, callHA }: Props) {
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string>(devices[0]?.deviceName ?? '');
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    if (!selectedPlaylist || !selectedDevice) return;
    setPlaying(true);
    try {
      await callHA('spotcast', 'start', {
        uri: selectedPlaylist,
        device_name: selectedDevice,
        random_song: true,
        shuffle: true,
      });
    } finally {
      setTimeout(() => setPlaying(false), 2000);
    }
  };

  return (
    <div className="spotify-picker">
      <div className="spotify-section">
        <h4 className="spotify-heading">
          <span className="mdi mdi-spotify" /> Playlist
        </h4>
        <div className="spotify-chips">
          {playlists.map((pl) => (
            <button
              key={pl.uri}
              className={`spotify-chip ${selectedPlaylist === pl.uri ? 'active' : ''}`}
              onClick={() => setSelectedPlaylist(pl.uri)}
            >
              <span className={`mdi ${pl.icon || 'mdi-playlist-music'}`} />
              <span>{pl.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="spotify-section">
        <h4 className="spotify-heading">
          <span className="mdi mdi-speaker" /> Riproduci su
        </h4>
        <div className="spotify-chips">
          {devices.map((dev) => (
            <button
              key={dev.deviceName}
              className={`spotify-chip ${selectedDevice === dev.deviceName ? 'active' : ''}`}
              onClick={() => setSelectedDevice(dev.deviceName)}
            >
              <span className={`mdi ${dev.icon || 'mdi-speaker-wireless'}`} />
              <span>{dev.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        className={`spotify-play-btn ${playing ? 'playing' : ''}`}
        onClick={play}
        disabled={!selectedPlaylist || !selectedDevice || playing}
      >
        <span className={`mdi ${playing ? 'mdi-loading mdi-spin' : 'mdi-play-circle'}`} />
        {playing ? 'Avvio...' : 'Riproduci'}
      </button>
    </div>
  );
}
