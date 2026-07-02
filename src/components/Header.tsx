import type { HassEntities } from 'home-assistant-js-websocket';
import { useEffect, useState } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { PersonTracker } from './PersonTracker';
import { resolvePersons } from '../lib/persons';
import { resolveWeatherId, getWeatherIcon, getWeatherColor } from '../lib/weather';
import { dedupeMediaPlayers } from '../lib/mediaDevices';
import { useHaTempUnit } from '../hooks/useHomeAssistant';
import { useTranslation } from 'react-i18next';

interface ForecastDay {
  datetime: string;
  condition: string;
  temperature: number;
  templow?: number;
}

interface Props {
  entities: HassEntities;
  getForecast?: (entityId: string, type?: 'daily' | 'hourly') => Promise<unknown[]>;
  /** Per-board visibility — lets a board strip widgets it doesn't need. */
  hideGreeting?: boolean;
  hideWeather?: boolean;
  hidePeople?: boolean;
  onOpenDetail?: (entityId: string) => void;
}

/** Join names naturally: "Jeff", "Jeff & Carissa", "Jeff, Carissa & Sam". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** Names of the people currently home, auto-discovered from `person.*`. */
function getHomeNames(entities: HassEntities): string[] {
  return resolvePersons(entities)
    .filter((p) => entities[p.entity_id]?.state === 'home')
    .map((p) => p.name);
}

export function Header({ entities, getForecast, hideGreeting, hideWeather, hidePeople, onOpenDetail }: Props) {
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
  const state = weather?.state || '';
  const humidity = weather?.attributes?.humidity as number | undefined;

  const [forecast, setForecast] = useState<ForecastDay[]>([]);

  useEffect(() => {
    if (!getForecast || !weather || !weatherId) return;
    let active = true;
    // Prefer attribute forecast (older HA), else fetch via service.
    const attrForecast = weather.attributes?.forecast as ForecastDay[] | undefined;
    if (attrForecast && attrForecast.length) {
      setForecast(attrForecast.slice(0, 4));
      return;
    }
    getForecast(weatherId, 'daily').then((data) => {
      if (active) setForecast((data as ForecastDay[]).slice(0, 4));
    });
    return () => {
      active = false;
    };
  }, [getForecast, weather, weatherId]);

  const mediaPlaying = dedupeMediaPlayers(
    Object.values(entities).filter(
      (e) => e.entity_id.startsWith('media_player.') && e.state === 'playing',
    ),
  );

  const homeNames = getHomeNames(entities);
  const greetingName = joinNames(homeNames);

  // Live clock that updates every minute
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  if (hideGreeting && hideWeather && hidePeople) return null;

  // Glance summary
  const lightsOn = Object.values(entities).filter(e => e.entity_id.startsWith('light.') && e.state === 'on').length;
  const lockState = entities['lock.pl_2_casa']?.state;
  const alarmState = entities['alarm_control_panel.casa']?.state;
  const alarmLabel = alarmState === 'disarmed' ? 'Non inserito' : alarmState?.startsWith('armed') ? 'Inserito' : alarmState;
  const coversOpen = Object.values(entities).filter(e => e.entity_id.startsWith('cover.') && e.state === 'open').length;
  const vacuumState = entities['vacuum.roborock_qv_35a']?.state;
  const vacuumLabel = vacuumState === 'docked' ? 'In carica' : vacuumState === 'cleaning' ? 'Pulisce' : vacuumState;
  const tempSalotto = entities['sensor.temperatura_salotto']?.state;

  return (
    <>
    <header className="header">
      {!hideGreeting ? (
        <div className="greeting">
          <div className="header-clock">
            <span className="clock-time">{time}</span>
            <span className="clock-date">{date}</span>
          </div>
          <h1>
            {greeting}
            {greetingName ? `, ${greetingName}!` : ''}
          </h1>
        </div>
      ) : (
        <div className="greeting" />
      )}
      <div className="header-right">
        {!hideWeather && weather && (
          <div className="weather-widget">
          <div className="weather-now">
            <span className={`mdi ${getWeatherIcon(state)}`} style={{ fontSize: 32, color: getWeatherColor(state) }} />
            <div>
              <div className="weather-temp">
                <AnimatedNumber value={Math.round(temp ?? 0)} /><sup>{tempUnit}</sup>
              </div>
              <div className="weather-details">
                {state.replace(/-/g, ' ')} · {humidity}% {t('weather_humidity')}
              </div>
            </div>
          </div>
          {forecast.length > 0 && (
            <div className="weather-forecast">
              {forecast.map((d, i) => (
                <div className="forecast-day" key={d.datetime ?? i}>
                  <div className="dow">
                    {i === 0
                      ? t('greeting_today')
                      : new Date(d.datetime).toLocaleDateString(i18n.language, { weekday: 'short' }).toUpperCase()}
                  </div>
                  <span className={`mdi ${getWeatherIcon(d.condition)}`} style={{ fontSize: 18, color: getWeatherColor(d.condition) }} />
                  <div className="temp">
                    {Math.round(d.temperature)}°
                    {d.templow !== undefined && (
                      <span className="low"> {Math.round(d.templow)}°</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        )}
        {!hidePeople && <PersonTracker entities={entities} variant="compact" />}
      </div>
    </header>
    <div className="glance-bar">
      <button className="glance-chip" onClick={() => onOpenDetail?.('light.lampada_ciambella')}><span className="mdi mdi-lightbulb-on" /> {lightsOn} luci</button>
      <button className="glance-chip" onClick={() => onOpenDetail?.('lock.pl_2_casa')}><span className={`mdi ${lockState === 'locked' ? 'mdi-lock' : 'mdi-lock-open-variant'}`} /> {lockState === 'locked' ? 'Chiusa' : 'Aperta'}</button>
      <button className="glance-chip" onClick={() => onOpenDetail?.('alarm_control_panel.casa')}><span className="mdi mdi-shield-home" /> {alarmLabel}</button>
      {tempSalotto && <button className="glance-chip" onClick={() => onOpenDetail?.('sensor.temperatura_salotto')}><span className="mdi mdi-thermometer" /> {parseFloat(tempSalotto).toFixed(1)}°</button>}
      <button className="glance-chip" onClick={() => onOpenDetail?.('cover.tapparella_tavolo')}><span className="mdi mdi-blinds" /> {coversOpen} aperte</button>
      <button className="glance-chip" onClick={() => onOpenDetail?.('vacuum.roborock_qv_35a')}><span className="mdi mdi-robot-vacuum" /> {vacuumLabel}</button>
    </div>
    </>
  );
}
