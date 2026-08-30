import type { HassEntities } from 'home-assistant-js-websocket';
import { useEffect, useState } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { resolvePersons } from '../lib/persons';
import { resolveWeatherId, getWeatherIcon, getWeatherColor } from '../lib/weather';
import { dedupeMediaPlayers } from '../lib/mediaDevices';
import { useHaTempUnit } from '../hooks/useHomeAssistant';
import { useTranslation } from 'react-i18next';
import { tempColor } from '../lib/comfort';

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
  /** HA service call function for actionable chips. */
  callHA?: (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;
  /** Current view name shown inline. */
  viewName?: string;
  /** Whether edit mode is active. */
  editing?: boolean;
  /** Toggle edit mode. */
  onToggleEdit?: () => void;
  /** Saving status for edit toolbar. */
  saving?: boolean;
  /** Reset layout callback. */
  onResetLayout?: () => void;
  /** Open sensors modal callback. */
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
  const state = weather?.state || '';
  const humidity = weather?.attributes?.humidity as number | undefined;
  const feelsLike = weather?.attributes?.apparent_temperature as number | undefined;

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

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

  if (hideGreeting && hideWeather && hidePeople) return null;

  // ── Status data ──
  const lightsOn = Object.values(entities).filter(e => e.entity_id.startsWith('light.') && e.state === 'on').length;
  const lockEntity = entities['lock.pl_2_casa'];
  const lockState = lockEntity?.state;
  const alarmEntity = entities['alarm_control_panel.casa'];
  const alarmState = alarmEntity?.state;
  const alarmArmed = alarmState?.startsWith('armed');
  const alarmLabel = alarmState === 'disarmed' ? 'Disarmato' : alarmArmed ? 'Armato' : alarmState ?? '—';
  const coversOpen = Object.values(entities).filter(e => e.entity_id.startsWith('cover.') && e.state === 'open').length;
  const vacuumState = entities['vacuum.roborock_qv_35a']?.state;
  const vacuumLabel = vacuumState === 'docked' ? 'In carica' : vacuumState === 'cleaning' ? 'Pulisce' : vacuumState ?? '—';
  const tempSalotto = entities['sensor.temperatura_salotto']?.state;
  const mediaPlaying = dedupeMediaPlayers(
    Object.values(entities).filter(e => e.entity_id.startsWith('media_player.') && e.state === 'playing'),
  );

  // ── Actionable chip handlers (with confirmation) ──
  const handleAlarm = () => {
    if (!callHA) return;
    if (alarmArmed) {
      if (confirm('Vuoi disarmare l\'allarme?')) {
        callHA('alarm_control_panel', 'alarm_disarm', undefined, { entity_id: 'alarm_control_panel.casa' });
      }
    } else {
      if (confirm('Vuoi armare l\'allarme?')) {
        callHA('alarm_control_panel', 'alarm_arm_away', undefined, { entity_id: 'alarm_control_panel.casa' });
      }
    }
  };

  const handleLock = () => {
    if (!callHA) return;
    if (lockState === 'locked') {
      if (confirm('Vuoi sbloccare la porta?')) {
        callHA('lock', 'unlock', undefined, { entity_id: 'lock.pl_2_casa' });
      }
    } else {
      if (confirm('Vuoi bloccare la porta?')) {
        callHA('lock', 'lock', undefined, { entity_id: 'lock.pl_2_casa' });
      }
    }
  };

  return (
    <header className="hdr">
      {/* ── Row 1: clock + greeting | weather + people ── */}
      <div className="hdr-row1">
        {!hideGreeting && (
          <div className="hdr-left">
            <span className="hdr-time">{time}</span>
            <div className="hdr-greet">
              <span className="hdr-hello">
                {greeting}{greetingName ? `, ${greetingName}!` : ''}
              </span>
              <span className="hdr-date">{date}</span>
            </div>
          </div>
        )}

        <div className="hdr-right">
          {!hideWeather && weather && (
            <div className="hdr-weather" onClick={() => onOpenDetail?.(weatherId!)}>
              <span className={`mdi ${getWeatherIcon(state)}`} style={{ fontSize: 22, color: getWeatherColor(state) }} />
              <span className="hdr-temp"><AnimatedNumber value={Math.round(temp ?? 0)} /><sup>{tempUnit}</sup></span>
              <div className="hdr-weather-detail">
                <span className="hdr-condition">{state.replace(/-/g, ' ')} · {humidity}%</span>
                {feelsLike != null && (
                  <span className="hdr-feels">{t('weather_feels_like')} {Math.round(feelsLike)}°</span>
                )}
              </div>
            </div>
          )}
          {!hideWeather && forecast.length > 0 && (
            <div className="hdr-forecast">
              {forecast.map((d, i) => (
                <div className="hdr-fc-day" key={d.datetime ?? i}>
                  <span className="hdr-fc-dow">
                    {i === 0
                      ? t('greeting_today')
                      : new Date(d.datetime).toLocaleDateString(i18n.language, { weekday: 'short' }).toUpperCase()}
                  </span>
                  <span className={`mdi ${getWeatherIcon(d.condition)}`} style={{ fontSize: 14, color: getWeatherColor(d.condition) }} />
                  <span className="hdr-fc-temp">
                    {Math.round(d.temperature)}°
                    {d.templow !== undefined && <span className="hdr-fc-low">{Math.round(d.templow)}°</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!hidePeople && (
            <div className="hdr-persons">
              {resolvePersons(entities)
                .filter((p) => ['person.ayman', 'person.martina'].includes(p.entity_id))
                .map((p) => {
                  const ent = entities[p.entity_id];
                  const home = ent?.state === 'home';
                  return (
                    <span key={p.entity_id} className={`hdr-person ${home ? 'home' : 'away'}`} title={home ? `${p.name} è a casa` : `${p.name} è fuori`}>
                      <span className={`mdi ${home ? 'mdi-home-account' : 'mdi-map-marker-distance'}`} />
                      {p.name}
                    </span>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: view title + actionable status chips + edit btn ── */}
      <div className="hdr-status">
        {viewName && <span className="hdr-view-name">{viewName}</span>}

        <button
          className={`hdr-chip hdr-chip-action ${alarmArmed ? 'chip-ok' : 'chip-warn'}`}
          onClick={handleAlarm}
          title={alarmArmed ? 'Tap per disarmare' : 'Tap per armare'}
        >
          <span className={`mdi ${alarmArmed ? 'mdi-shield-check' : 'mdi-shield-off-outline'}`} />
          Allarme {alarmArmed ? 'armato' : 'disarmato'}
        </button>
        <button
          className={`hdr-chip hdr-chip-action ${lockState === 'locked' ? 'chip-ok' : 'chip-warn'}`}
          onClick={handleLock}
          title={lockState === 'locked' ? 'Tap per sbloccare' : 'Tap per bloccare'}
        >
          <span className={`mdi ${lockState === 'locked' ? 'mdi-lock' : 'mdi-lock-open-variant'}`} />
          Porta {lockState === 'locked' ? 'chiusa' : 'aperta'}
        </button>
        <button className="hdr-chip" onClick={() => onOpenDetail?.('light.lampada_ciambella')}>
          <span className="mdi mdi-lightbulb-on" />
          {lightsOn} {lightsOn === 1 ? 'luce accesa' : 'luci accese'}
        </button>
        <button className="hdr-chip" onClick={() => onOpenDetail?.('cover.tapparella_tavolo')}>
          <span className="mdi mdi-blinds" />
          {coversOpen} {coversOpen === 1 ? 'tapparella aperta' : 'tapparelle aperte'}
        </button>
        {tempSalotto && (
          <button
            className="hdr-chip"
            style={{ color: tempColor(parseFloat(tempSalotto)) }}
            onClick={() => onOpenSensors?.()}
            title="Apri sensori"
          >
            <span className="mdi mdi-thermometer" />
            {parseFloat(tempSalotto).toFixed(1)}°
            <span className="mdi mdi-chart-line" style={{ fontSize: 12, opacity: 0.5, marginLeft: 2 }} />
          </button>
        )}
        <button className="hdr-chip" onClick={() => onOpenDetail?.('vacuum.roborock_qv_35a')}>
          <span className={`mdi mdi-robot-vacuum ${vacuumState === 'cleaning' ? 'spin' : ''}`} />
          {vacuumLabel}
        </button>
        {mediaPlaying.length > 0 && (
          <button className="hdr-chip chip-accent" onClick={() => onOpenDetail?.(mediaPlaying[0].entity_id)}>
            <span className="mdi mdi-music" />
            {mediaPlaying.length} in riproduzione
          </button>
        )}

        {/* Edit toggle — pushed to the right */}
        <div className="hdr-edit-spacer" />
        {editing ? (
          <div className="hdr-edit-bar">
            <span className="hdr-edit-status">
              {saving ? (
                <><span className="mdi mdi-loading mdi-spin" /> {t('app_saving')}</>
              ) : (
                <><span className="mdi mdi-check-circle-outline" /> {t('app_saved')}</>
              )}
            </span>
            <button className="toolbar-btn" onClick={() => { if (confirm(t('app_reset_confirm'))) onResetLayout?.(); }}>
              <span className="mdi mdi-restore" /> {t('app_reset')}
            </button>
            <button className="toolbar-btn primary" onClick={onToggleEdit}>
              <span className="mdi mdi-check" /> {t('app_done')}
            </button>
          </div>
        ) : (
          <button className="toolbar-btn hdr-edit-btn" onClick={onToggleEdit}>
            <span className="mdi mdi-pencil" /> {t('app_edit')}
          </button>
        )}
      </div>
    </header>
  );
}
