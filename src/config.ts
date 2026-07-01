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
      { entity_id: 'climate.condizionatore_soggiorno_2', name: 'Condizionatore' },
      { entity_id: 'media_player.lg_webos_tv_oled65g26la', name: 'TV LG' },
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

export const cameras = [
  { entity_id: 'camera.corridoio', name: 'Corridoio' },
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
  { entity_id: 'sensor.0xa4c1387ce7871bf9_soil_moisture', name: 'Umidità Pianta', icon: 'mdi-flower', unit: '%' },
  { entity_id: 'sensor.roborock_qv_35a_batteria', name: 'Roborock Batteria', icon: 'mdi-robot-vacuum', unit: '%' },
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
    ],
    sections: [
      {
        title: 'Sicurezza',
        icon: 'mdi-shield-home',
        entities: [
          { entity_id: 'alarm_control_panel.casa', name: 'Allarme' },
          { entity_id: 'lock.pl_2_casa', name: 'Porta casa' },
          { entity_id: 'camera.corridoio', name: 'Camera corridoio' },
        ],
      },
      {
        title: 'Soggiorno',
        icon: 'mdi-sofa',
        entities: [
          { entity_id: 'light.luce_soggiorno', name: 'Muro salotto' },
          { entity_id: 'light.lampada_ciambella', name: 'Lampada ciambella' },
          { entity_id: 'light.lampada_sala', name: 'Lampada sala' },
          { entity_id: 'media_player.lg_webos_tv_oled65g26la', name: 'TV' },
        ],
      },
      {
        title: 'Cucina',
        icon: 'mdi-countertop',
        entities: [
          { entity_id: 'light.luce_cucina', name: 'Cucina' },
          { entity_id: 'light.luce_lavandino', name: 'Lavandino' },
        ],
      },
      {
        title: 'Camera da letto',
        icon: 'mdi-bed-king',
        entities: [
          { entity_id: 'light.luce_camera', name: 'Luce camera' },
          { entity_id: 'light.luce_letto_ayman', name: 'Letto Ayman' },
          { entity_id: 'light.luce_letto_martina', name: 'Letto Martina' },
        ],
      },
      {
        title: 'Corridoio & Ingresso',
        icon: 'mdi-foot-print',
        entities: [
          { entity_id: 'light.luce_corridoio', name: 'Corridoio' },
          { entity_id: 'light.luce_ingresso', name: 'Ingresso' },
          { entity_id: 'light.luce_bagno', name: 'Bagno' },
        ],
      },
      {
        title: 'Clima',
        icon: 'mdi-thermostat',
        entities: [
          { entity_id: 'climate.condizionatore_soggiorno_2', name: 'Soggiorno' },
          { entity_id: 'climate.condizionatore_camera_da_letto', name: 'Camera' },
        ],
      },
      {
        title: 'Tapparelle',
        icon: 'mdi-blinds',
        entities: [
          { entity_id: 'cover.tapparella_tavolo', name: 'Tapparella Tavolo' },
          { entity_id: 'cover.tapparella_camera', name: 'Tapparella Camera' },
        ],
      },
      {
        title: 'Azioni rapide',
        icon: 'mdi-lightning-bolt',
        entities: [
          { entity_id: 'input_boolean.vacation_mode', name: 'Vacation Mode' },
          { entity_id: 'scene.buonanotte', name: 'Buonanotte' },
          { entity_id: 'scene.buongiorno', name: 'Buongiorno' },
        ],
      },
    ],
  },
  {
    id: 'camera',
    name: 'Camera',
    icon: 'mdi-bed-king',
    scenes: [
      'scene.buonanotte',
      'scene.riposo',
    ],
    sections: [
      {
        title: 'Luci Camera',
        entities: [
          { entity_id: 'light.luce_camera', name: 'Luce camera' },
          { entity_id: 'light.luce_letto_ayman', name: 'Letto Ayman' },
          { entity_id: 'light.luce_letto_martina', name: 'Letto Martina' },
        ],
      },
      {
        title: 'Clima & Tapparelle',
        entities: [
          { entity_id: 'climate.condizionatore_camera_da_letto', name: 'Condizionatore' },
          { entity_id: 'cover.tapparella_camera', name: 'Tapparella' },
        ],
      },
    ],
  },
  {
    id: 'soggiorno',
    name: 'Soggiorno',
    icon: 'mdi-sofa',
    scenes: [
      'scene.cinema',
      'scene.buongiorno',
    ],
    sections: [
      {
        title: 'Luci',
        entities: [
          { entity_id: 'light.luce_soggiorno', name: 'Muro salotto' },
          { entity_id: 'light.lampada_ciambella', name: 'Lampada ciambella' },
          { entity_id: 'light.lampada_sala', name: 'Lampada sala' },
        ],
      },
      {
        title: 'Media & Clima',
        entities: [
          { entity_id: 'media_player.lg_webos_tv_oled65g26la', name: 'TV LG' },
          { entity_id: 'climate.condizionatore_soggiorno_2', name: 'Condizionatore' },
          { entity_id: 'cover.tapparella_tavolo', name: 'Tapparella Tavolo' },
        ],
      },
    ],
  },
  {
    id: 'media',
    name: 'Media',
    icon: 'mdi-television',
    kind: 'media',
    scenes: [
      'scene.cinema',
    ],
    sections: [
      {
        title: 'Media Players',
        entities: [
          { entity_id: 'media_player.lg_webos_tv_oled65g26la', name: 'TV LG' },
          { entity_id: 'media_player.lg_tv', name: 'LG TV' },
          { entity_id: 'media_player.spotify_martina', name: 'Spotify Martina' },
          { entity_id: 'media_player.2o_echo_dot_di_martina', name: 'Echo Dot Camera' },
          { entity_id: 'media_player.3o_echo_dot_di_martina', name: 'Echo Dot Salotto' },
          { entity_id: 'media_player.ovunque_2', name: 'Ovunque' },
        ],
      },
    ],
  },
  {
    id: 'vacuum',
    name: 'Roborock',
    icon: 'mdi-robot-vacuum',
    sections: [
      {
        title: 'Robot',
        entities: [
          { entity_id: 'vacuum.roborock_qv_35a', name: 'Roborock QV 35A' },
        ],
      },
    ],
  },
  {
    id: 'cameras',
    name: 'Camere',
    icon: 'mdi-cctv',
    kind: 'cameras',
    sections: [],
  },
];
