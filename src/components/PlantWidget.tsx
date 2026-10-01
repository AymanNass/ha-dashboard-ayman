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
const COLOR_STALE = '#94a3b8';

/**
 * Read a plant's moisture together with how old the reading is.
 *
 * `last_updated` only moves when the value CHANGES, so a long gap means either
 * a genuinely flat sensor or one that stopped reporting. Past
 * `plantMoisture.staleAfterHours` we stop trusting it rather than painting a
 * frozen value as healthy.
 */
export function readMoisture(entities: HassEntities, moistureId: string, now = Date.now()) {
  const entity = entities[moistureId];
  const raw = entity?.state;
  const value =
    raw != null && raw !== 'unknown' && raw !== 'unavailable' && raw !== ''
      ? Number.parseInt(raw, 10)
      : null;
  const moisture = value != null && Number.isFinite(value) ? value : null;

  let ageHours: number | null = null;
  if (entity?.last_updated) {
    const t = new Date(entity.last_updated).getTime();
    if (!Number.isNaN(t)) ageHours = (now - t) / 3_600_000;
  }
  const stale = moisture == null || (ageHours != null && ageHours > plantMoisture.staleAfterHours);

  return { moisture, ageHours, stale };
}

function plantStatus(
  moisture: number | null,
  stale: boolean,
  ageHours: number | null,
  thirsty: number,
  critical: number,
) {
  if (moisture == null) return { statusText: 'Nessun dato', color: COLOR_STALE };
  if (stale) {
    const h = ageHours != null ? Math.round(ageHours) : null;
    return { statusText: h != null ? `Dato fermo da ${h}h` : 'Dato fermo', color: COLOR_STALE };
  }
  if (moisture < critical) return { statusText: 'Ha sete', color: COLOR_CRITICAL };
  if (moisture < thirsty) return { statusText: 'Annaffia presto', color: COLOR_THIRSTY };
  return { statusText: 'Sta bene', color: COLOR_OK };
}

/**
 * Compact plants widget: one small row per plant (icon/photo + moisture + status),
 * grouped together so they take little horizontal space.
 */
export function PlantWidget({ entities, plants }: { entities: HassEntities; plants: PlantConfig[] }) {
  return (
    <div className="plants-cluster">
      {plants.map((plant) => {
        const thirsty = plant.thirstyBelow ?? plantMoisture.thirstyBelow;
        const critical = plant.criticalBelow ?? plantMoisture.criticalBelow;
        const { moisture, ageHours, stale } = readMoisture(entities, plant.moistureId);
        const { statusText, color } = plantStatus(moisture, stale, ageHours, thirsty, critical);

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
