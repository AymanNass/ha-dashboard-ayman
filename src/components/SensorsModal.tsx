import { useEffect, useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { Sparkline } from './Sparkline';
import { classifyTemp, classifyHumidity } from '../lib/comfort';

interface SensorDef {
  entity_id: string;
  name: string;
  icon: string;
  color: string;
}

const SENSORS: SensorDef[] = [
  { entity_id: 'sensor.temperatura_salotto', name: 'Temp. Salotto', icon: 'mdi-thermometer', color: '#f59e0b' },
  { entity_id: 'sensor.umidita_salotto', name: 'Umidità Salotto', icon: 'mdi-water-percent', color: '#3b82f6' },
  { entity_id: 'sensor.temperatura_camera', name: 'Temp. Camera', icon: 'mdi-thermometer', color: '#ef4444' },
  { entity_id: 'sensor.umidita_camera', name: 'Umidità Camera', icon: 'mdi-water-percent', color: '#06b6d4' },
  { entity_id: 'sensor.0xa4c138304177ffff_temperature', name: 'Temp. Bagno', icon: 'mdi-thermometer', color: '#a855f7' },
  { entity_id: 'sensor.0xa4c138304177ffff_humidity', name: 'Umidità Bagno', icon: 'mdi-water-percent', color: '#10b981' },
];

interface Props {
  entities: HassEntities;
  getHistory: (entityId: string, hours: number) => Promise<number[]>;
  onClose: () => void;
}

export function SensorsModal({ entities, getHistory, onClose }: Props) {
  const [histories, setHistories] = useState<Record<string, number[]>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SENSORS.map(async (s) => {
        const data = await getHistory(s.entity_id, 24);
        return [s.entity_id, data] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, number[]> = {};
      for (const [id, data] of results) map[id] = data;
      setHistories(map);
    });
    return () => { cancelled = true; };
  }, [getHistory]);

  return (
    <div className="ts-overlay" onClick={onClose}>
      <div className="ts-modal sensors-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ts-head">
          <h3><span className="mdi mdi-chart-line" /> Sensori — 24h</h3>
          <button className="edit-icon-btn" onClick={onClose}>
            <span className="mdi mdi-close" />
          </button>
        </div>
        <div className="ts-body">
          <div className="sensors-grid">
            {SENSORS.map((s) => {
              const entity = entities[s.entity_id];
              if (!entity) return null;
              const val = parseFloat(entity.state);
              const unit = (entity.attributes.unit_of_measurement as string) || '';
              const data = histories[s.entity_id] ?? [];
              const min = data.length > 1 ? Math.min(...data).toFixed(1) : '—';
              const max = data.length > 1 ? Math.max(...data).toFixed(1) : '—';
              const isTemp = s.entity_id.includes('temperatura') || s.entity_id.includes('temperature');
              const comfort = !isNaN(val) ? (isTemp ? classifyTemp(val) : classifyHumidity(val)) : null;
              const liveColor = comfort?.color ?? s.color;
              return (
                <div className="sensor-card" key={s.entity_id}>
                  <div className="sensor-head">
                    <span className={`mdi ${s.icon}`} style={{ color: liveColor }} />
                    <span className="sensor-name">{s.name}</span>
                    <span className="sensor-value" style={{ color: liveColor }}>
                      {isNaN(val) ? entity.state : val.toFixed(1)}{unit}
                    </span>
                  </div>
                  {comfort && (
                    <div className="sensor-comfort" style={{ color: liveColor }}>
                      <span className="sensor-comfort-label">{comfort.label}</span>
                      {'advice' in comfort && comfort.advice && (
                        <span className="sensor-comfort-advice">
                          <span className="mdi mdi-alert-circle" /> {comfort.advice}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="sensor-chart" style={{ '--spark-color': liveColor } as React.CSSProperties}>
                    {data.length > 1 ? (
                      <Sparkline data={data} width={280} height={60} />
                    ) : (
                      <span className="sensor-loading">Caricamento...</span>
                    )}
                  </div>
                  <div className="sensor-minmax">
                    <span>Min {min}{unit}</span>
                    <span>Max {max}{unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
