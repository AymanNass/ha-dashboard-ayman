import type { HassEntities } from 'home-assistant-js-websocket';

interface Props {
  entities: HassEntities;
}

const MOISTURE_ID = 'sensor.0xa4c1387ce7871bf9_soil_moisture';
const TEMP_ID = 'sensor.0xa4c1387ce7871bf9_temperature';

/**
 * Compact plant health widget showing the Strelitzia's moisture level
 * with color-coded status and the plant photo.
 */
export function PlantWidget({ entities }: Props) {
  const moistureState = entities[MOISTURE_ID]?.state;
  const moisture = moistureState ? parseInt(moistureState) : null;
  const temp = entities[TEMP_ID]?.state ? Math.round(parseFloat(entities[TEMP_ID].state)) : null;

  let status: 'happy' | 'thirsty' | 'critical' = 'happy';
  let statusText = 'Sta bene 🌿';
  let statusColor = '#10b981';

  if (moisture != null) {
    if (moisture < 10) {
      status = 'critical';
      statusText = 'Annaffia subito! 🚨';
      statusColor = '#ef4444';
    } else if (moisture < 20) {
      status = 'critical';
      statusText = 'Ha sete! 💧';
      statusColor = '#ef4444';
    } else if (moisture < 30) {
      status = 'thirsty';
      statusText = 'Annaffia presto';
      statusColor = '#f59e0b';
    }
  }

  return (
    <div className={`plant-widget plant-${status}`}>
      <div className="plant-img">
        <img src="/strelitzia.png" alt="Strelitzia" />
      </div>
      <div className="plant-info">
        <div className="plant-name">Strelitzia</div>
        <div className="plant-status" style={{ color: statusColor }}>{statusText}</div>
        <div className="plant-stats">
          <span className="plant-moisture">
            <span className="mdi mdi-water" /> {moisture ?? '—'}%
          </span>
          {temp != null && (
            <span className="plant-temp">
              <span className="mdi mdi-thermometer" /> {temp}°C
            </span>
          )}
        </div>
      </div>
      <div className="plant-bar-wrap">
        <div
          className="plant-bar-fill"
          style={{ height: `${Math.min(100, moisture ?? 0)}%`, background: statusColor }}
        />
      </div>
    </div>
  );
}
