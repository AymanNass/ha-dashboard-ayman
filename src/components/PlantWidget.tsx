import type { HassEntities } from 'home-assistant-js-websocket';

/** Configuration for a single plant shown in the widget. */
export interface PlantConfig {
  name: string;
  moistureId: string;
  tempId?: string;
  /** Image file under public/ (optional). Falls back to an icon. */
  image?: string;
  icon?: string;
  /** Moisture thresholds (%) — below these the plant needs water. */
  thirstyBelow?: number;
  criticalBelow?: number;
}

function plantStatus(moisture: number | null, thirsty: number, critical: number) {
  let statusText = 'Sta bene';
  let color = '#10b981';
  if (moisture != null) {
    if (moisture < critical) { statusText = 'Ha sete'; color = '#ef4444'; }
    else if (moisture < thirsty) { statusText = 'Annaffia presto'; color = '#f59e0b'; }
  }
  return { statusText, color };
}

/**
 * Compact plants widget: one small row per plant (icon/photo + moisture + status),
 * grouped together so they take little horizontal space.
 */
export function PlantWidget({ entities, plants }: { entities: HassEntities; plants: PlantConfig[] }) {
  return (
    <div className="plants-cluster">
      {plants.map((plant) => {
        const thirsty = plant.thirstyBelow ?? 30;
        const critical = plant.criticalBelow ?? 20;
        const raw = entities[plant.moistureId]?.state;
        const moisture = raw != null && raw !== 'unknown' && raw !== 'unavailable' ? parseInt(raw) : null;
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
