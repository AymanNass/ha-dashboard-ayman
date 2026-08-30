import { useEffect, useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { Sparkline } from './Sparkline';
import { useHaTempUnit } from '../hooks/useHomeAssistant';
import { classifyTemp, classifyHumidity } from '../lib/comfort';

/** Room definition with climate + sensor entities. */
interface RoomClimate {
  name: string;
  icon: string;
  climate?: string;        // climate.* entity_id
  tempSensor?: string;     // sensor.* for temperature
  humiditySensor?: string; // sensor.* for humidity
}

const ROOMS: RoomClimate[] = [
  {
    name: 'Soggiorno',
    icon: 'mdi-sofa',
    climate: 'climate.condizionatore_soggiorno_2',
    tempSensor: 'sensor.temperatura_salotto',
    humiditySensor: 'sensor.umidita_salotto',
  },
  {
    name: 'Camera',
    icon: 'mdi-bed-king',
    climate: 'climate.condizionatore_camera_da_letto',
    tempSensor: 'sensor.temperatura_media_camera',
    humiditySensor: 'sensor.umidita_camera',
  },
  {
    name: 'Bagno',
    icon: 'mdi-shower',
    tempSensor: 'sensor.0xa4c138304177ffff_temperature',
    humiditySensor: 'sensor.0xa4c138304177ffff_humidity',
  },
];

const MODE_ICONS: Record<string, string> = {
  cool: 'mdi-snowflake',
  heat: 'mdi-fire',
  heat_cool: 'mdi-autorenew',
  auto: 'mdi-autorenew',
  dry: 'mdi-water-percent',
  fan_only: 'mdi-fan',
  off: 'mdi-power',
};

const MODE_COLORS: Record<string, string> = {
  cool: '#06b6d4',
  heat: '#ef4444',
  heat_cool: '#f59e0b',
  auto: '#f59e0b',
  dry: '#a855f7',
  fan_only: '#3b82f6',
  off: 'var(--text-muted)',
};

/** No longer needed — using comfort module */

interface Props {
  entities: HassEntities;
  callHA: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
  getHistory: (entityId: string, hours: number) => Promise<number[]>;
  onOpenDetail: (entityId: string) => void;
}

export function ClimateView({ entities, callHA, getHistory, onOpenDetail }: Props) {
  const haTempUnit = useHaTempUnit();

  // Fetch 24h history for all sensors
  const [histories, setHistories] = useState<Record<string, number[]>>({});
  useEffect(() => {
    let cancelled = false;
    const ids = ROOMS.flatMap((r) => [r.tempSensor, r.humiditySensor].filter(Boolean) as string[]);
    Promise.all(ids.map(async (id) => [id, await getHistory(id, 24)] as const)).then((results) => {
      if (cancelled) return;
      const map: Record<string, number[]> = {};
      for (const [id, data] of results) map[id] = data;
      setHistories(map);
    });
    return () => { cancelled = true; };
  }, [getHistory]);

  return (
    <div className="climate-view">
      <div className="climate-grid">
        {ROOMS.map((room) => {
          const climateEntity = room.climate ? entities[room.climate] : undefined;
          const tempEntity = room.tempSensor ? entities[room.tempSensor] : undefined;
          const humEntity = room.humiditySensor ? entities[room.humiditySensor] : undefined;

          const currentTemp = tempEntity ? parseFloat(tempEntity.state) : (climateEntity?.attributes.current_temperature as number | undefined);
          const humidity = humEntity ? parseFloat(humEntity.state) : undefined;
          const tempUnitStr = (climateEntity?.attributes.temperature_unit as string | undefined) ?? haTempUnit;

          const mode = climateEntity?.state ?? 'off';
          const modes = (climateEntity?.attributes.hvac_modes as string[]) || [];
          const targetTemp = climateEntity?.attributes.temperature as number | undefined;
          const fanModes = (climateEntity?.attributes.fan_modes as string[]) || [];
          const fanMode = climateEntity?.attributes.fan_mode as string | undefined;
          const minTemp = (climateEntity?.attributes.min_temp as number) || 16;
          const maxTemp = (climateEntity?.attributes.max_temp as number) || 30;

          const tClass = currentTemp != null && !isNaN(currentTemp) ? classifyTemp(currentTemp) : null;
          const hClass = humidity != null && !isNaN(humidity) ? classifyHumidity(humidity) : null;

          const tempHistory = room.tempSensor ? (histories[room.tempSensor] ?? []) : [];
          const humHistory = room.humiditySensor ? (histories[room.humiditySensor] ?? []) : [];

          const modeColor = MODE_COLORS[mode] ?? 'var(--text-muted)';

          return (
            <div className="climate-card" key={room.name}>
              {/* Header: room name + current readings */}
              <div className="climate-card-head">
                <span className={`mdi ${room.icon} climate-room-icon`} />
                <span className="climate-room-name">{room.name}</span>
                <div className="climate-readings">
                  {currentTemp != null && !isNaN(currentTemp) && tClass && (
                    <span className="climate-reading" style={{ color: tClass.color }} title={tClass.label}>
                      <span className="mdi mdi-thermometer" />
                      {currentTemp.toFixed(1)}{tempUnitStr}
                      <span className="climate-reading-label">{tClass.label}</span>
                    </span>
                  )}
                  {humidity != null && !isNaN(humidity) && hClass && (
                    <span className="climate-reading" style={{ color: hClass.color }} title={hClass.advice || hClass.label}>
                      {hClass.advice && <span className="mdi mdi-alert-circle sensor-alert-icon" />}
                      <span className="mdi mdi-water-percent" />
                      {humidity.toFixed(0)}%
                      <span className="climate-reading-label">{hClass.label}</span>
                      {hClass.advice && <span className="climate-reading-advice">{hClass.advice}</span>}
                    </span>
                  )}
                </div>
              </div>

              {/* Charts */}
              <div className="climate-charts">
                {tempHistory.length > 1 && (
                  <div className="climate-chart">
                    <span className="climate-chart-label">Temperatura 24h</span>
                    <div className="climate-chart-area" style={{ '--spark-color': '#f59e0b' } as React.CSSProperties}>
                      <Sparkline data={tempHistory} width={300} height={50} />
                    </div>
                    <div className="climate-chart-range">
                      <span>Min {Math.min(...tempHistory).toFixed(1)}°</span>
                      <span>Max {Math.max(...tempHistory).toFixed(1)}°</span>
                    </div>
                  </div>
                )}
                {humHistory.length > 1 && (
                  <div className="climate-chart">
                    <span className="climate-chart-label">Umidità 24h</span>
                    <div className="climate-chart-area" style={{ '--spark-color': '#3b82f6' } as React.CSSProperties}>
                      <Sparkline data={humHistory} width={300} height={50} />
                    </div>
                    <div className="climate-chart-range">
                      <span>Min {Math.min(...humHistory).toFixed(0)}%</span>
                      <span>Max {Math.max(...humHistory).toFixed(0)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* AC controls (only if this room has a climate entity) */}
              {climateEntity && room.climate && (
                <div className="climate-controls">
                  <div className="climate-mode-row">
                    {modes.map((m) => (
                      <button
                        key={m}
                        className={`climate-mode-btn ${mode === m ? 'active' : ''}`}
                        style={mode === m ? { color: MODE_COLORS[m], borderColor: MODE_COLORS[m] } : undefined}
                        onClick={() => callHA('climate', 'set_hvac_mode', { hvac_mode: m }, { entity_id: room.climate! })}
                        title={m}
                      >
                        <span className={`mdi ${MODE_ICONS[m] || 'mdi-thermostat'}`} />
                        <span className="climate-mode-label">{m === 'heat_cool' ? 'Auto' : m === 'fan_only' ? 'Fan' : m.charAt(0).toUpperCase() + m.slice(1)}</span>
                      </button>
                    ))}
                  </div>

                  {mode !== 'off' && targetTemp != null && (
                    <div className="climate-temp-control">
                      <button
                        className="climate-temp-btn"
                        onClick={() => callHA('climate', 'set_temperature', { temperature: targetTemp - 0.5 }, { entity_id: room.climate! })}
                      >
                        <span className="mdi mdi-minus" />
                      </button>
                      <div className="climate-target">
                        <span className="climate-target-val" style={{ color: modeColor }}>{targetTemp}°</span>
                        <span className="climate-target-label">Target</span>
                      </div>
                      <button
                        className="climate-temp-btn"
                        onClick={() => callHA('climate', 'set_temperature', { temperature: targetTemp + 0.5 }, { entity_id: room.climate! })}
                      >
                        <span className="mdi mdi-plus" />
                      </button>
                    </div>
                  )}

                  {mode !== 'off' && fanModes.length > 0 && (
                    <div className="climate-fan-row">
                      <span className="mdi mdi-fan climate-fan-icon" />
                      <select
                        className="climate-fan-select"
                        value={fanMode}
                        onChange={(e) => callHA('climate', 'set_fan_mode', { fan_mode: e.target.value }, { entity_id: room.climate! })}
                      >
                        {fanModes.map((f) => (
                          <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button className="climate-detail-btn" onClick={() => onOpenDetail(room.climate!)}>
                    <span className="mdi mdi-tune" /> Dettagli completi
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
