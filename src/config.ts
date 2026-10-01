import type { SceneConfig, PersonConfig, Room, DashView } from './types';
import { getHaUrl, getHaToken } from './settings';

export let HA_URL = getHaUrl();
export let HA_TOKEN = getHaToken();

/** Re-read the effective connection (used after hydrating from the server). */
export function refreshConnection(): void {
  HA_URL = getHaUrl();
  HA_TOKEN = getHaToken();
}

export const scenes: SceneConfig[] = [
  { entity_id: 'scene.buongiorno', name: 'Buongiorno', icon: 'mdi-weather-sunny', color: '#f59e0b' },
  { entity_id: 'scene.buonanotte', name: 'Buonanotte', icon: 'mdi-bed', color: '#6366f1' },
  { entity_id: 'scene.cinema', name: 'Cinema', icon: 'mdi-movie-open', color: '#a855f7' },
  { entity_id: 'scene.riposo', name: 'Riposo', icon: 'mdi-power-sleep', color: '#64748b' },
  { entity_id: 'script.condizionatore_notte', name: 'Condizionatore Notte', icon: 'mdi-snowflake-thermometer', color: '#06b6d4' },
  { entity_id: 'input_boolean.vacation_mode', name: 'Vacanza', icon: 'mdi-palm-tree', color: '#ef4444' },
];

export const persons: PersonConfig[] = [
  { entity_id: 'person.ayman', name: 'Ayman' },
  { entity_id: 'person.martina', name: 'Martina' },
];

export const rooms: Room[] = [
  {
    id: 'soggiorno',
    name: 'Soggiorno',
    icon: 'mdi-sofa',
    entities: [
      { entity_id: 'light.luce_soggiorno', name: 'Muro salotto' },
      { entity_id: 'light.lampada_ciambella', name: 'Lampada ciambella' },
      { entity_id: 'light.lampada_sala', name: 'Lampada sala' },
      { entity_id: 'cover.tapparella_tavolo', name: 'Tapparella Tavolo' },
      { entity_id: 'cover.0xc02cedfffe163a38', name: 'Tapparella Salotto TV' },
      { entity_id: 'cover.tapparella_camera', name: 'Tapparella Camera' },
      { entity_id: 'climate.condizionatore_soggiorno_2', name: 'Condizionatore' },
      { entity_id: 'media_player.lg_tv', name: 'TV' },
    ],
  },
  {
    id: 'cucina',
    name: 'Cucina',
    icon: 'mdi-countertop',
    entities: [
      { entity_id: 'light.luce_cucina', name: 'Luce cucina' },
      { entity_id: 'light.luce_lavandino', name: 'Luce lavandino' },
    ],
  },
  {
    id: 'camera',
    name: 'Camera da letto',
    icon: 'mdi-bed-king',
    entities: [
      { entity_id: 'light.luce_camera', name: 'Luce camera' },
      { entity_id: 'light.luce_letto_ayman', name: 'Luce letto Ayman' },
      { entity_id: 'light.luce_letto_martina', name: 'Luce letto Martina' },
      { entity_id: 'cover.tapparella_camera', name: 'Tapparella camera' },
      { entity_id: 'climate.condizionatore_camera_da_letto', name: 'Condizionatore' },
    ],
  },
  {
    id: 'cameretta',
    name: 'Cameretta',
    icon: 'mdi-baby-face-outline',
    entities: [
      { entity_id: 'light.luce_cameretta', name: 'Luce cameretta' },
    ],
  },
  {
    id: 'bagno',
    name: 'Bagno',
    icon: 'mdi-shower',
    entities: [
      { entity_id: 'light.luce_bagno', name: 'Luce bagno' },
    ],
  },
  {
    id: 'corridoio',
    name: 'Corridoio & Ingresso',
    icon: 'mdi-foot-print',
    entities: [
      { entity_id: 'light.luce_corridoio', name: 'Corridoio' },
      { entity_id: 'light.luce_ingresso', name: 'Ingresso' },
    ],
  },
];

export const cameras: { entity_id: string; name: string }[] = [];

/** Spotify playlists shown in the Media page picker (legacy). */
export const spotifyPlaylists = [
  { name: 'My Ears Fav', uri: 'spotify:playlist:4aD5AzcM210BUZL9etOSHY', icon: 'mdi-heart' },
  { name: 'Nostalgia Canaglia', uri: 'spotify:playlist:6Hr6dKFh9xQbFC1MpQR9FP', icon: 'mdi-emoticon-cool' },
];

/** Devices available as Spotify playback targets (spotcast device_name).
 * These names MUST match the Spotify Connect device names exactly
 * (media_player.spotify_martina source_list). */
export const spotifyDevices = [
  { name: 'Salotto', deviceName: 'Echo Dot Salotto', icon: 'mdi-speaker-wireless' },
  { name: 'Camera', deviceName: 'Echo Dot Camer', icon: 'mdi-speaker-wireless' },
  { name: 'Bagno', deviceName: 'Bagno Echo Dot', icon: 'mdi-speaker-wireless' },
  { name: 'Ovunque', deviceName: 'Ovunque', icon: 'mdi-speaker-group' },
];

// ── Musica page (Spotify control center) ──────────────────────────────

/** The Spotify integration player that receives select_source + play_media. */
export const SPOTIFY_PLAYER = 'media_player.spotify_martina';

/** A Spotify playlist shown in the Musica page grid. */
export interface MusicPlaylist {
  name: string;
  uri: string;
  /** Cover art URL (from Spotify oEmbed). */
  image?: string;
  /** Fallback mdi icon if no image. */
  icon?: string;
}

/** Playlists shown in the Musica page grid. */
export const musicPlaylists: MusicPlaylist[] = [
  { name: "My ears' favs", uri: 'spotify:playlist:4aD5AzcM210BUZL9etOSHY', image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84cc98e9c62335d1df4ca9dbbe', icon: 'mdi-heart' },
  { name: 'Bathtub', uri: 'spotify:playlist:5V7k9UFqx9NIYIvW1AZtz6', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000da84933e874bcbe10985fcbe58b7', icon: 'mdi-bathtub' },
  { name: 'Despaciti e quelle robe lì', uri: 'spotify:playlist:3R0n2BMlrxdGvM9GRjzNF4', image: 'https://mosaic.scdn.co/300/ab67616d00001e027d46593471038b38e40d59a7ab67616d00001e02a5971936e3b8d91f8b616b17ab67616d00001e02ef289e90cdbe56a19ada6b13ab67616d00001e02f634ce4f69fc4a7113d35217', icon: 'mdi-party-popper' },
  { name: 'Nostalgia canaglia', uri: 'spotify:playlist:6Hr6dKFh9xQbFC1MpQR9FP', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000da845d7a759796b12fafdc6f182a', icon: 'mdi-emoticon-cool' },
  { name: '🇮🇹 90s-00s', uri: 'spotify:playlist:2Nljm6GiVdPef3phaTmKTC', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000da84d99c5e7d06d714edd0ba8d68', icon: 'mdi-cassette' },
  { name: 'Car Trip', uri: 'spotify:playlist:00Hvk5bBNmgsX9X774SD9l', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000da84ed95e1cc16af21027d7fd33c', icon: 'mdi-car' },
  { name: 'This Is Fabri Fibra', uri: 'spotify:playlist:37i9dQZF1DZ06evO4qMzMQ', image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/thisisv3/7u710e44HW3K7A5eTnRqHC/it', icon: 'mdi-microphone' },
  { name: 'This Is Kid Yugi', uri: 'spotify:playlist:37i9dQZF1DZ06evO0k90RQ', image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/thisisv3/0EUR8jz8L936AEbV2Spkca/it', icon: 'mdi-microphone' },
  { name: 'This Is Nerissima Serpe', uri: 'spotify:playlist:37i9dQZF1DZ06evO00A48z', image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/thisisv3/08ppjXEpROUgrG1X0DEquB/it', icon: 'mdi-microphone' },
];

/** A playback target for the Musica page. */
export interface MusicDevice {
  /** Label shown in the UI. */
  name: string;
  /** Spotify Connect source name — MUST match media_player.spotify_martina source_list exactly. */
  source: string;
  /** Echo media_player entity used for per-room volume + now-playing fallback. */
  entity_id: string;
  icon: string;
}

/** Speakers available as Spotify playback targets in the Musica page. */
export const musicDevices: MusicDevice[] = [
  { name: 'Camera', source: 'Echo Dot Camer', entity_id: 'media_player.echo_dot_di_martina', icon: 'mdi-bed' },
  { name: 'Salotto', source: 'Echo Dot Salotto', entity_id: 'media_player.3o_echo_dot_di_martina', icon: 'mdi-sofa' },
  { name: 'Bagno', source: 'Bagno Echo Dot', entity_id: 'media_player.echo_dot_bagno', icon: 'mdi-shower' },
  { name: 'Ovunque', source: 'Ovunque', entity_id: 'media_player.ovunque', icon: 'mdi-speaker-group' },
];

export const locks = [
  { entity_id: 'lock.pl_2_casa', name: 'Porta casa' },
];

export const climateEntities = [
  { entity_id: 'climate.condizionatore_soggiorno_2', name: 'Soggiorno' },
  { entity_id: 'climate.condizionatore_camera_da_letto', name: 'Camera' },
];

export const sensorWidgets = [
  { entity_id: 'sensor.temperatura_salotto', name: 'Temp. Salotto', icon: 'mdi-thermometer', unit: '°C' },
  { entity_id: 'sensor.umidita_salotto', name: 'Umidità Salotto', icon: 'mdi-water-percent', unit: '%' },
  { entity_id: 'sensor.temperatura_camera', name: 'Temp. Camera', icon: 'mdi-thermometer', unit: '°C' },
  { entity_id: 'sensor.umidita_camera', name: 'Umidità Camera', icon: 'mdi-water-percent', unit: '%' },
  { entity_id: 'sensor.0xa4c138304177ffff_temperature', name: 'Temp. Bagno', icon: 'mdi-thermometer', unit: '°C' },
  { entity_id: 'sensor.0xa4c138304177ffff_humidity', name: 'Umidità Bagno', icon: 'mdi-water-percent', unit: '%' },
  { entity_id: 'sensor.0xa4c1387ce7871bf9_soil_moisture', name: 'Umidità Strelitzia', icon: 'mdi-flower', unit: '%' },
  { entity_id: 'sensor.0xa4c1381f439ee5f2_soil_moisture', name: 'Umidità Basilico', icon: 'mdi-sprout', unit: '%' },
  { entity_id: 'sensor.roborock_qv_35a_batteria', name: 'Roborock Batteria', icon: 'mdi-robot-vacuum', unit: '%' },
];

/**
 * Piante — soglie di umidità del suolo (%), identiche per tutte.
 *
 * Unica fonte di verità per il widget piante e per la notifica "da annaffiare":
 * tenerle in due posti le aveva già fatte divergere (notifica a 25, widget a 30),
 * lasciando una fascia in cui il widget segnalava e la notifica taceva.
 */
export const plantMoisture = {
  /** Sotto questa: giallo "Annaffia presto" + notifica in home. */
  thirstyBelow: 50,
  /** Sotto questa: rosso "Ha sete". */
  criticalBelow: 35,
  /**
   * Oltre queste ore senza aggiornamenti, il dato è trattato come vecchio:
   * il widget lo mostra in grigio e la notifica non scatta, invece di fidarsi
   * di un valore fermo.
   *
   * Soglia alta di proposito: HA aggiorna `last_updated` solo quando il valore
   * CAMBIA, quindi una sonda sana ma stabile può restare piatta per qualche ora
   * senza essere guasta.
   */
  staleAfterHours: 12,
} as const;

/**
 * Piante monitorate nel widget del soggiorno e nelle notifiche.
 *
 * Usare sempre `..._soil_moisture` (terreno) e NON `..._humidity`, che su questi
 * sensori Tuya è l'umidità dell'aria.
 */
export interface PlantSensor {
  name: string;
  moistureId: string;
  tempId?: string;
  icon?: string;
  /** File immagine sotto public/ (opzionale), al posto dell'icona. */
  image?: string;
}

export const plants: PlantSensor[] = [
  {
    name: 'Strelitzia',
    moistureId: 'sensor.0xa4c1387ce7871bf9_soil_moisture',
    tempId: 'sensor.0xa4c1387ce7871bf9_temperature',
    icon: 'mdi-flower',
  },
  {
    name: 'Basilico',
    moistureId: 'sensor.0xa4c1381f439ee5f2_soil_moisture',
    tempId: 'sensor.0xa4c1381f439ee5f2_temperature',
    icon: 'mdi-sprout',
  },
];

/**
 * Dashboard views
 */
export const views: DashView[] = [
  {
    id: 'main',
    name: 'Casa',
    icon: 'mdi-home',
    scenes: [
      'scene.buongiorno',
      'scene.buonanotte',
      'scene.cinema',
      'scene.riposo',
      'script.condizionatore_notte',
      'input_boolean.vacation_mode',
    ],
    sections: [
      {
        title: 'Soggiorno',
        icon: 'mdi-sofa',
        color: '#f59e0b',
        entities: [
          { entity_id: 'sensor.temperatura_salotto', name: 'Temp', icon: 'mdi-thermometer' },
          { entity_id: 'sensor.umidita_salotto', name: 'Umidità', icon: 'mdi-water-percent' },
          { entity_id: 'light.luce_soggiorno', name: 'Muro salotto', icon: 'mdi-wall-sconce-flat' },
          { entity_id: 'light.salotto_luce_tavolo', name: 'Luce tavolo', icon: 'mdi-table-furniture' },
          { entity_id: 'light.lampada_ciambella', name: 'Lampada ciambella', icon: 'mdi-circle-outline' },
          { entity_id: 'light.lampada_sala', name: 'Lampada sala', icon: 'mdi-desk-lamp' },
        ],
      },
      {
        title: 'Cucina',
        icon: 'mdi-countertop',
        color: '#f59e0b',
        entities: [
          { entity_id: 'light.luce_cucina', name: 'Cucina', icon: 'mdi-spotlight-beam' },
          { entity_id: 'light.luce_lavandino', name: 'Lavandino', icon: 'mdi-led-strip-variant' },
        ],
      },
      {
        title: 'Camera da letto',
        icon: 'mdi-bed-king',
        color: '#f59e0b',
        entities: [
          { entity_id: 'sensor.temperatura_media_camera', name: 'Temp', icon: 'mdi-thermometer' },
          { entity_id: 'sensor.umidita_camera', name: 'Umidità', icon: 'mdi-water-percent' },
          { entity_id: 'light.luce_camera', name: 'Luce camera', icon: 'mdi-ceiling-light' },
          {
            entity_id: 'light.luce_letto_ayman', name: 'Luci letto', icon: 'mdi-lamp', size: '2x1',
            split: {
              left: { entity_id: 'light.luce_letto_ayman', label: 'Ayman' },
              right: { entity_id: 'light.luce_letto_martina', label: 'Martina' },
            },
          },
        ],
      },
      {
        title: 'Cameretta',
        icon: 'mdi-baby-face-outline',
        color: '#f59e0b',
        entities: [
          { entity_id: 'light.luce_cameretta', name: 'Luce cameretta', icon: 'mdi-ceiling-light' },
        ],
      },
      {
        title: 'Corridoio & Ingresso',
        icon: 'mdi-foot-print',
        color: '#f59e0b',
        entities: [
          { entity_id: 'light.luce_corridoio', name: 'Corridoio', icon: 'mdi-spotlight-beam' },
          { entity_id: 'light.luce_ingresso', name: 'Ingresso', icon: 'mdi-spotlight-beam' },
        ],
      },
      {
        title: 'Bagno',
        icon: 'mdi-shower',
        color: '#f59e0b',
        entities: [
          { entity_id: 'sensor.0xa4c138304177ffff_temperature', name: 'Temp', icon: 'mdi-thermometer' },
          { entity_id: 'sensor.0xa4c138304177ffff_humidity', name: 'Umidità', icon: 'mdi-water-percent' },
          { entity_id: 'light.luce_bagno', name: 'Bagno', icon: 'mdi-spotlight-beam' },
        ],
      },
      {
        title: 'Tapparelle',
        icon: 'mdi-blinds',
        color: '#166534',
        entities: [
          { entity_id: 'cover.tapparella_tavolo', name: 'Tapparella Tavolo' },
          { entity_id: 'cover.0xc02cedfffe163a38', name: 'Tapparella Salotto TV' },
          { entity_id: 'cover.tapparella_camera', name: 'Tapparella Camera' },
        ],
      },
      {
        title: 'Clima',
        icon: 'mdi-thermostat',
        color: '#06b6d4',
        entities: [
          { entity_id: 'climate.condizionatore_soggiorno_2', name: 'Soggiorno' },
          { entity_id: 'climate.condizionatore_camera_da_letto', name: 'Camera' },
        ],
      },
    ],
  },
  {
    id: 'musica',
    name: 'Musica',
    icon: 'mdi-music',
    kind: 'musica' as DashView['kind'],
    sections: [],
  },
  {
    id: 'climate',
    name: 'Clima',
    icon: 'mdi-snowflake-thermometer',
    kind: 'climate',
    sections: [],
  },
  {
    id: 'robot-v2',
    name: 'Robot',
    icon: 'mdi-robot-vacuum',
    kind: 'robot-v2' as DashView['kind'],
    sections: [],
  },
  {
    id: 'calendar',
    name: 'Calendario',
    icon: 'mdi-calendar-month',
    kind: 'calendar' as DashView['kind'],
    sections: [],
  },
  {
    id: 'automations',
    name: 'Automazioni',
    icon: 'mdi-text-box-search-outline',
    kind: 'automations' as DashView['kind'],
    sections: [],
  },
];
