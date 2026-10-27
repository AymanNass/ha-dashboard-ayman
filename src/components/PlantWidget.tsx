import type { HassEntities } from 'home-assistant-js-websocket';
import { plantMoisture } from '../config';

/** Configuration for a single plant shown in the widget. */
export interface PlantConfig {
  name: string;
  moistureId: string;
  tempId?: string;
  /** Image file under public/ (optional). Falls back to an icon. */
  image?: string;
  icon?: string;
  /** Moisture thresholds (%) — default to the shared ones in config. */
  thirstyBelow?: number;
  criticalBelow?: number;
}

const COLOR_OK = '#10b981';
const COLOR_THIRSTY = '#f59e0b';
const COLOR_CRITICAL = '#ef4444';
const COLOR_UNKNOWN = '#94a3b8';

/**
 * Read a plant's soil moisture, or null when there is no usable reading.
 *
 * Non provare a dedurre "dato vecchio" dai timestamp: l'integrazione MQTT di HA
 * scrive un nuovo stato solo quando il valore CAMBIA, quindi su una sonda sana
 * ma stabile `last_updated` resta indietro di ore pur arrivando un messaggio
 * ogni pochi secondi. Quando il dispositivo è davvero offline è Zigbee2MQTT a
 * dirlo, e HA porta lo stato a `unavailable`, che qui diventa null.
 */
export function readMoisture(entities: HassEntities, moistureId: string) {
  const raw = entities[moistureId]?.state;
  const usable = raw != null && raw !== 'unknown' && raw !== 'unavailable' && raw !== '';
  const value = usable ? Number.parseInt(raw, 10) : null;
  return value != null && Number.isFinite(value) ? value : null;
}

function plantStatus(moisture: number | null, thirsty: number, critical: number) {
  if (moisture == null) return { statusText: 'Nessun dato', color: COLOR_UNKNOWN };
  if (moisture < critical) return { statusText: 'Ha sete', color: COLOR_CRITICAL };
  if (moisture < thirsty) return { statusText: 'Annaffia presto', color: COLOR_THIRSTY };
  return { statusText: 'Sta bene', color: COLOR_OK };
}

/**
 * Compact plants widget: one small row per plant (icon/photo + moisture + status),
 * grouped together so they take little horizontal space.
 */
/** Rank a plant's severity so the widget's overall accent reflects the worst
 *  plant: 0 = ok/unknown, 1 = thirsty (annaffia presto), 2 = critical (ha sete). */
function severity(moisture: number | null, thirsty: number, critical: number): number {
  if (moisture == null) return 0;
  if (moisture < critical) return 2;
  if (moisture < thirsty) return 1;
  return 0;
}

export function PlantWidget({ entities, plants }: { entities: HassEntities; plants: PlantConfig[] }) {
  // Overall accent = the worst plant's state. All ok → green; any "annaffia
  // presto" → yellow; any "ha sete" → red.
  const worst = plants.reduce((max, plant) => {
    const thirsty = plant.thirstyBelow ?? plantMoisture.thirstyBelow;
    const critical = plant.criticalBelow ?? plantMoisture.criticalBelow;
    const s = severity(readMoisture(entities, plant.moistureId), thirsty, critical);
    return Math.max(max, s);
  }, 0);
  const accent = worst === 2 ? COLOR_CRITICAL : worst === 1 ? COLOR_THIRSTY : COLOR_OK;

  return (
    <div
      className="plants-cluster"
      style={{ '--plants-accent': accent } as React.CSSProperties}
    >
      {plants.map((plant) => {
        const thirsty = plant.thirstyBelow ?? plantMoisture.thirstyBelow;
        const critical = plant.criticalBelow ?? plantMoisture.criticalBelow;
        const moisture = readMoisture(entities, plant.moistureId);
        const { statusText, color } = plantStatus(moisture, thirsty, critical);

        return (
          <div key={plant.name} className="plant-mini">
            <div className="plant-mini-icon">
              {plant.image ? (
                <img src={`${import.meta.env.BASE_URL}${plant.image}`} alt={plant.name} />
              ) : (
                <span className={`mdi ${plant.icon || 'mdi-sprout'}`} style={{ color }} />
              )}
            </div>
            <div className="plant-mini-info">
              <span className="plant-mini-name">{plant.name}</span>
              <span className="plant-mini-status" style={{ color }}>{statusText}</span>
            </div>
            <span className="plant-mini-pct" style={{ color }}>{moisture ?? '—'}%</span>
          </div>
        );
      })}
    </div>
  );
}
