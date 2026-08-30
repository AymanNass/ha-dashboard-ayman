import type { HassEntities } from 'home-assistant-js-websocket';
import { useEffect, useState } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { resolvePersons } from '../lib/persons';
import { resolveWeatherId, getWeatherIcon, getWeatherColor } from '../lib/weather';
import { dedupeMediaPlayers } from '../lib/mediaDevices';
import { useHaTempUnit } from '../hooks/useHomeAssistant';
import { useTranslation } from 'react-i18next';
import { tempColor, humidityColor } from '../lib/comfort';

interface ForecastDay {
  datetime: string;
  condition: string;
  temperature: number;
  templow?: number;
}

interface Props {
  entities: HassEntities;
  getForecast?: (entityId: string, type?: 'daily' | 'hourly') => Promise<unknown[]>;
  hideGreeting?: boolean;
  hideWeather?: boolean;
  hidePeople?: boolean;
  onOpenDetail?: (entityId: string) => void;
  callHA?: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
  viewName?: string;
  editing?: boolean;
  onToggleEdit?: () => void;
  saving?: boolean;
  onResetLayout?: () => void;
  onOpenSensors?: () => void;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function getHomeNames(entities: HassEntities): string[] {
  return resolvePersons(entities)
    .filter((p) => entities[p.entity_id]?.state === 'home')
    .map((p) => p.name);
}

export function Header({
  entities, getForecast, hideGreeting, hideWeather, hidePeople,
  onOpenDetail, callHA, viewName, editing, onToggleEdit, saving, onResetLayout, onOpenSensors,
}: Props) {
  const { t, i18n } = useTranslation();
  const haTempUnit = useHaTempUnit();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return t('greeting_night');
    if (h < 12) return t('greeting_morning');
    if (h < 17) return t('greeting_afternoon');
    if (h < 21) return t('greeting_evening');
    return t('greeting_night');
  })();

  const weatherId = resolveWeatherId(entities);
  const weather = weatherId ? entities[weatherId] : undefined;
  const temp = weather?.attributes?.temperature as number | undefined;
  const tempUnit = (weather?.attributes?.temperature_unit as string | undefined) ?? haTempUnit;
  const weatherState = weather?.state || '';
  const humidity = weather?.attributes?.humidity as number | undefined;

  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  useEffect(() => {
    if (!getForecast || !weather || !weatherId) return;
    let active = true;
    const attrForecast = weather.attributes?.forecast as ForecastDay[] | undefined;
    if (attrForecast && attrForecast.length) {
      setForecast(attrForecast.slice(0, 4));
      return;
    }
    getForecast(weatherId, 'daily').then((data) => {
      if (active) setForecast((data as ForecastDay[]).slice(0, 4));
    });
    return () => { active = false; };
  }, [getForecast, weather, weatherId]);

  const homeNames = getHomeNames(entities);
  const greetingName = joinNames(homeNames);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  if (hideGreeting && hideWeather && hidePeople) return null;

  // ── Status data ──
  const lightsOn = Object.values(entities).filter(e => e.entity_id.startsWith('light.') && e.state === 'on').length;
  const lockEntity = entities['lock.pl_2_casa'];
  const lockState = lockEntity?.state;
  const alarmEntity = entities['alarm_control_panel.casa'];
  const alarmState = alarmEntity?.state;
  const alarmArmed = alarmState?.startsWith('armed');
  const coversOpen = Object.values(entities).filter(e => e.entity_id.startsWith('cover.') && e.state === 'open').length;
  const coversTotal = Object.values(entities).filter(e => e.entity_id.startsWith('cover.')).length;
  const tempSalotto = entities['sensor.temperatura_salotto']?.state;
  const humSalotto = entities['sensor.umidita_salotto']?.state;

  // Security: both alarm + lock combined
  const secureCount = (alarmArmed ? 1 : 0) + (lockState === 'locked' ? 1 : 0);
  const secureLabel = secureCount === 2 ? 'Sicura' : secureCount === 1 ? 'Parziale' : 'Aperta';
  const secureColor = secureCount === 2 ? '#10b981' : secureCount === 1 ? '#f59e0b' : '#ef4444';

  // ── Actionable handlers ──
  const handleAlarm = () => {
    if (!callHA) return;
    if (alarmArmed) {
      if (confirm('Vuoi disarmare l\'allarme?'))
        callHA('alarm_control_panel', 'alarm_disarm', undefined, { entity_id: 'alarm_control_panel.casa' });
    } else {
      if (confirm('Vuoi armare l\'allarme?'))
        callHA('alarm_control_panel', 'alarm_arm_away', undefined, { entity_id: 'alarm_control_panel.casa' });
    }
  };

  const handleLock = () => {
    if (!callHA) return;
    if (lockState === 'locked') {
      if (confirm('Vuoi sbloccare la porta?'))
        callHA('lock', 'unlock', undefined, { entity_id: 'lock.pl_2_casa' });
    } else {
      if (confirm('Vuoi bloccare la porta?'))
        callHA('lock', 'lock', undefined, { entity_id: 'lock.pl_2_casa' });
    }
  };

  return (
    <header className="hdr">
      {/* ── Row 1: greeting left | weather + edit right ── */}
      <div className="hdr-top">
        {!hideGreeting && (
          <div className="hdr-greeting">
            <span className="hdr-hello">
              {greeting},{' '}
              {greetingName || ''} <span className="hdr-emoji">&#127769;</span>
            </span>
            <span className="hdr-time">{time}</span>
          </div>
        )}
        <div className="hdr-top-right">
          {!hideWeather && weather && (
            <div className="hdr-weather-compact" onClick={() => onOpenDetail?.(weatherId!)}>
              <span className={`mdi ${getWeatherIcon(weatherState)}`} style={{ fontSize: 18, color: getWeatherColor(weatherState) }} />
              <span className="hdr-wt">{Math.round(temp ?? 0)}°</span>
              <span className="hdr-wc">{weatherState.replace(/-/g, ' ')}</span>
              {humidity != null && <span className="hdr-wh">{humidity}%</span>}
            </div>
          )}
          {!hideWeather && forecast.length > 0 && (
            <div className="hdr-fc-row">
              {forecast.slice(0, 4).map((d, i) => (
                <div className="hdr-fc-item" key={d.datetime ?? i}>
                  <span className="hdr-fc-d">
                    {i === 0 ? 'Oggi' : new Date(d.datetime).toLocaleDateString(i18n.language, { weekday: 'short' })}
                  </span>
                  <span className={`mdi ${getWeatherIcon(d.condition)}`} style={{ fontSize: 12, color: getWeatherColor(d.condition) }} />
                  <span className="hdr-fc-t">{Math.round(d.temperature)}°</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: status cards left + presence right ── */}
      <div className="hdr-cards-row">
        <div className="hdr-cards">
          <div className="sc" onClick={handleAlarm} style={{ cursor: 'pointer' }}>
            <span className="sc-icon" style={{ color: alarmArmed ? '#10b981' : '#ef4444' }}>
              <span className={`mdi ${alarmArmed ? 'mdi-shield-check' : 'mdi-shield-off-outline'}`} />
            </span>
            <div className="sc-text">
              <span className="sc-label">Allarme</span>
              <span className="sc-value" style={{ color: alarmArmed ? '#10b981' : '#ef4444' }}>{alarmArmed ? 'Armato' : 'Disarmato'}</span>
            </div>
          </div>
          <div className="sc" onClick={() => onOpenDetail?.('light.lampada_ciambella')}>
            <span className="sc-icon" style={{ color: lightsOn > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
              <span className={`mdi ${lightsOn > 0 ? 'mdi-lightbulb-on' : 'mdi-lightbulb-off-outline'}`} />
            </span>
            <div className="sc-text">
              <span className="sc-label">Luci accese</span>
              <span className="sc-value">{lightsOn}</span>
            </div>
          </div>
          <div className="sc" onClick={() => onOpenDetail?.('cover.tapparella_tavolo')}>
            <span className="sc-icon" style={{ color: coversOpen > 0 ? '#10b981' : 'var(--text-muted)' }}>
              <span className={`mdi ${coversOpen > 0 ? 'mdi-blinds-open' : 'mdi-blinds'}`} />
            </span>
            <div className="sc-text">
              <span className="sc-label">Tapparelle</span>
              <span className="sc-value">{coversOpen > 0 ? `${coversOpen} aperte` : 'Chiuse'}</span>
            </div>
          </div>
          {tempSalotto && (
            <div className="sc" onClick={() => onOpenSensors?.()}>
              <span className="sc-icon" style={{ color: tempColor(parseFloat(tempSalotto)) }}>
                <span className="mdi mdi-thermometer" />
              </span>
              <div className="sc-text">
                <span className="sc-label">Temperatura</span>
                <span className="sc-value">{parseFloat(tempSalotto).toFixed(1)}°</span>
              </div>
            </div>
          )}
          <div className="sc" onClick={handleLock} style={{ cursor: 'pointer' }}>
            <span className="sc-icon" style={{ color: lockState === 'locked' ? '#10b981' : '#ef4444' }}>
              <span className={`mdi ${lockState === 'locked' ? 'mdi-door-closed-lock' : 'mdi-door-open'}`} />
            </span>
            <div className="sc-text">
              <span className="sc-label">Porta</span>
              <span className="sc-value">{lockState === 'locked' ? 'Chiusa' : 'Aperta'}</span>
            </div>
          </div>
          {humSalotto && (
            <div className="sc" onClick={() => onOpenSensors?.()}>
              <span className="sc-icon" style={{ color: humidityColor(parseFloat(humSalotto)) }}>
                <span className="mdi mdi-water-percent" />
              </span>
              <div className="sc-text">
                <span className="sc-label">Umidità</span>
                <span className="sc-value">{parseFloat(humSalotto).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Presence box — right aligned */}
        {!hidePeople && (
          <div className="hdr-presence">
            {resolvePersons(entities)
              .filter((p) => ['person.ayman', 'person.martina'].includes(p.entity_id))
              .map((p) => {
                const ent = entities[p.entity_id];
                const home = ent?.state === 'home';
                return (
                  <div className="presence-item" key={p.entity_id}>
                    <span className={`presence-avatar ${home ? 'home' : 'away'}`}>{p.name.charAt(0)}</span>
                    <div className="presence-info">
                      <span className="presence-name">{p.name}</span>
                      <span className={`presence-status ${home ? 'home' : 'away'}`}>
                        <span className="presence-dot" />
                        {home ? 'A casa' : 'Fuori'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </header>
  );
}
