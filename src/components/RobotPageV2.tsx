import { useState } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import { HA_URL, HA_TOKEN } from '../config';

type CallHA = (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => Promise<void>;

interface Props {
  entities: HassEntities;
  callHA: CallHA;
  onOpenDetail: (entityId: string) => void;
}

// ── Room segment IDs (from Roborock integration) ──
const ROOMS = [
  { id: 0, name: 'Tutte', icon: 'mdi-home' },
  { id: 16, name: 'Soggiorno', icon: 'mdi-sofa' },
  { id: 17, name: 'Cucina', icon: 'mdi-countertop' },
  { id: 18, name: 'Bagno', icon: 'mdi-shower' },
  { id: 19, name: 'Corridoio', icon: 'mdi-foot-print' },
  { id: 20, name: 'Camera', icon: 'mdi-bed-king' },
  { id: 21, name: 'Cameretta', icon: 'mdi-baby-face-outline' },
];

type CleanMode = 'vac' | 'vac_and_mop' | 'mop';
type FanSpeed = 'quiet' | 'balanced' | 'turbo' | 'max' | 'max_plus';
type MopIntensity = 'low' | 'medium' | 'high';

const MODE_LABELS: Record<CleanMode, string> = { vac: 'Aspira', vac_and_mop: 'Aspira + lava', mop: 'Solo lava' };
const FAN_LABELS: Record<FanSpeed, string> = { quiet: 'Quiet', balanced: 'Balanced', turbo: 'Turbo', max: 'Max', max_plus: 'Max+' };
const MOP_LABELS: Record<MopIntensity, string> = { low: 'Bassa', medium: 'Media', high: 'Alta' };

function humanState(state: string): string {
  switch (state) {
    case 'docked': return 'In base';
    case 'cleaning': return 'Sta pulendo';
    case 'returning': return 'Torna alla base';
    case 'paused': return 'In pausa';
    case 'idle': return 'Fermo';
    case 'error': return 'Errore';
    default: return state;
  }
}

function formatHours(h: number): string {
  if (h < 0) return 'Scaduto';
  if (h < 1) return `${Math.round(h * 60)}min`;
  return `${Math.round(h)}h`;
}

export function RobotPageV2({ entities, callHA, onOpenDetail }: Props) {
  const vac = entities['vacuum.roborock_qv_35a'];
  const vacState = vac?.state ?? 'unavailable';
  const isCleaning = vacState === 'cleaning';
  const isPaused = vacState === 'paused';

  // Sensors
  const battery = parseFloat(entities['sensor.roborock_qv_35a_batteria']?.state ?? '0');
  const charging = entities['binary_sensor.roborock_qv_35a_in_ricarica']?.state === 'on';
  const currentRoom = entities['sensor.roborock_qv_35a_current_room']?.state ?? '—';
  const cleanArea = parseFloat(entities['sensor.roborock_qv_35a_area_di_pulizia']?.state ?? '0');
  const cleanProgress = parseInt(entities['sensor.roborock_qv_35a_avanzamento_della_pulizia']?.state ?? '0');
  const lastStart = entities['sensor.roborock_qv_35a_inizio_dell_ultima_pulizia']?.state;
  const lastEnd = entities['sensor.roborock_qv_35a_fine_dell_ultima_pulizia']?.state;
  const totalCleans = parseInt(entities['sensor.roborock_qv_35a_total_cleaning_count']?.state ?? '0');
  const totalArea = parseFloat(entities['sensor.roborock_qv_35a_area_di_pulizia_totale']?.state ?? '0');
  const totalTime = parseFloat(entities['sensor.roborock_qv_35a_tempo_totale_di_pulizia']?.state ?? '0');
  const errorState = entities['sensor.roborock_qv_35a_errore_aspirapolvere']?.state;
  const dockError = entities['sensor.roborock_qv_35a_dock_errore_nella_base']?.state;

  // Dock status
  const waterConnected = entities['binary_sensor.roborock_qv_35a_contenitore_dell_acqua_collegato']?.state === 'on';
  const dirtyWaterFull = entities['binary_sensor.roborock_qv_35a_dock_dirty_water_box']?.state === 'on';
  const cleanWaterOk = entities['binary_sensor.roborock_qv_35a_dock_clean_water_box']?.state === 'off';
  const mopAttached = entities['binary_sensor.roborock_qv_35a_panno_attaccato']?.state === 'on';
  const drying = entities['binary_sensor.roborock_qv_35a_dock_asciugatura_del_panno']?.state === 'on';

  // Maintenance (hours remaining)
  const filterH = parseFloat(entities['sensor.roborock_qv_35a_tempo_di_filtraggio_rimanente']?.state ?? '0');
  const mainBrushH = parseFloat(entities['sensor.roborock_qv_35a_tempo_residuo_della_spazzola_principale']?.state ?? '0');
  const sideBrushH = parseFloat(entities['sensor.roborock_qv_35a_tempo_residuo_della_spazzola_laterale']?.state ?? '0');
  const sensorH = parseFloat(entities['sensor.roborock_qv_35a_tempo_residuo_del_sensore']?.state ?? '0');
  const strainerH = parseFloat(entities['sensor.roborock_qv_35a_dock_strainer_time_left']?.state ?? '0');

  // Current settings
  const curMode = (entities['select.cameretta_roborock_qv_35a_cleaning_mode']?.state ?? 'vac_and_mop') as CleanMode;
  const curFan = (vac?.attributes.fan_speed ?? 'quiet') as FanSpeed;
  const curMopRaw = entities['select.roborock_qv_35a_intensita_delle_spazzole']?.state ?? 'high';
  const curMop: MopIntensity = curMopRaw === 'low' ? 'low' : curMopRaw === 'medium' ? 'medium' : 'high';

  // Map image
  const mapEntity = entities['image.roborock_qv_35a_map_0'];
  const mapUrl = mapEntity?.attributes.entity_picture
    ? `${HA_URL}${mapEntity.attributes.entity_picture}`
    : undefined;

  // Last clean time
  const lastCleanStr = (() => {
    if (!lastStart || !lastEnd) return null;
    const s = new Date(lastStart);
    const e = new Date(lastEnd);
    const day = s.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const t1 = s.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const t2 = e.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const mins = Math.round((e.getTime() - s.getTime()) / 60000);
    return { day, t1, t2, mins };
  })();

  // ── Local UI state ──
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [mode, setMode] = useState<CleanMode>(curMode);
  const [fan, setFan] = useState<FanSpeed>(curFan);
  const [mop, setMop] = useState<MopIntensity>(curMop);
  const [showSettings, setShowSettings] = useState(false);
  const [mapFull, setMapFull] = useState(false);

  const toggleRoom = (id: number) => {
    if (id === 0) { setSelectedRooms([]); return; } // "Tutte" deselects specific rooms
    setSelectedRooms((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);
  };

  const startClean = () => {
    // Set mode
    callHA('select', 'select_option', { option: mode }, { entity_id: 'select.cameretta_roborock_qv_35a_cleaning_mode' });
    // Set fan speed
    callHA('vacuum', 'set_fan_speed', { fan_speed: fan }, { entity_id: 'vacuum.roborock_qv_35a' });

    if (selectedRooms.length === 0) {
      // Clean all
      callHA('vacuum', 'start', undefined, { entity_id: 'vacuum.roborock_qv_35a' });
    } else {
      // Clean specific rooms
      callHA('vacuum', 'send_command', { command: 'app_segment_clean', params: selectedRooms }, { entity_id: 'vacuum.roborock_qv_35a' });
    }
  };

  const applyPreset = (preset: 'standard' | 'fast' | 'deep') => {
    switch (preset) {
      case 'standard': setMode('vac_and_mop'); setFan('balanced'); setMop('medium'); break;
      case 'fast': setMode('vac'); setFan('turbo'); break;
      case 'deep': setMode('vac_and_mop'); setFan('max'); setMop('high'); break;
    }
  };

  // ── Alerts ──
  const alerts: { icon: string; text: string; sub: string; level: 'warn' | 'crit' }[] = [];
  if (dirtyWaterFull) alerts.push({ icon: 'mdi-water-alert', text: 'Serbatoio acqua sporca pieno', sub: 'Svuotalo prima della prossima pulizia', level: 'warn' });
  if (dockError && dockError !== 'none' && dockError !== 'ok') alerts.push({ icon: 'mdi-alert-circle', text: `Dock: ${dockError.replace(/_/g, ' ')}`, sub: 'Controlla la base', level: 'warn' });
  if (sensorH < 0) alerts.push({ icon: 'mdi-wrench-clock', text: 'Sensore: manutenzione scaduta', sub: `Scaduto da ${Math.abs(Math.round(sensorH))}h`, level: 'crit' });
  if (filterH < 10) alerts.push({ icon: 'mdi-air-filter', text: `Filtro: ${filterH < 0 ? 'scaduto' : formatHours(filterH) + ' rimanenti'}`, sub: 'Sostituisci presto', level: filterH < 0 ? 'crit' : 'warn' });
  if (errorState && errorState !== 'none') alerts.push({ icon: 'mdi-robot-vacuum-alert', text: `Errore: ${errorState}`, sub: 'Controlla il robot', level: 'crit' });

  // ── Maintenance items (sorted: expired first) ──
  const maint = [
    { label: 'Sensore', hours: sensorH, max: 30 },
    { label: 'Filtro', hours: filterH, max: 150 },
    { label: 'Spazzola principale', hours: mainBrushH, max: 300 },
    { label: 'Spazzola laterale', hours: sideBrushH, max: 200 },
    { label: 'Dock strainer', hours: strainerH, max: 100 },
  ].sort((a, b) => a.hours - b.hours);

  const showVac = mode !== 'mop';
  const showMop = mode !== 'vac';
  const roomCount = selectedRooms.length || 'tutte';

  return (
    <div className="rv2">
      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div className="rv2-alerts">
          <span className="rv2-alerts-title"><span className="mdi mdi-alert" /> Intervento richiesto</span>
          <div className="rv2-alerts-list">
            {alerts.map((a, i) => (
              <div key={i} className={`rv2-alert rv2-alert-${a.level}`}>
                <span className={`mdi ${a.icon}`} />
                <div>
                  <span className="rv2-alert-text">{a.text}</span>
                  <span className="rv2-alert-sub">{a.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Three columns ── */}
      <div className="rv2-cols">
        {/* ── LEFT: Status + Map ── */}
        <div className="rv2-left">
          <div className="rv2-section">
            <span className="rv2-stitle">STATO</span>
            <div className="rv2-status">
              <span className="mdi mdi-robot-vacuum rv2-robot-icon" />
              <div className="rv2-status-info">
                <div className="rv2-battery">
                  <span className={`mdi ${battery > 80 ? 'mdi-battery' : battery > 40 ? 'mdi-battery-50' : 'mdi-battery-20'}`} style={{ color: battery > 40 ? '#10b981' : battery > 20 ? '#f59e0b' : '#ef4444' }} />
                  <span className="rv2-batt-pct">{Math.round(battery)}%</span>
                  {charging && <span className="rv2-charging"><span className="mdi mdi-lightning-bolt" /> In carica</span>}
                </div>
                <span className="rv2-state-label">{humanState(vacState)}</span>
                <span className="rv2-room">Posizione: {currentRoom}</span>
              </div>
            </div>
            {lastCleanStr && (
              <div className="rv2-lastclean">
                <span className="rv2-lc-title">Ultima pulizia</span>
                <span className="rv2-lc-detail">{lastCleanStr.day} · {lastCleanStr.t1} → {lastCleanStr.t2}</span>
                <span className="rv2-lc-detail">{cleanArea} m² · {lastCleanStr.mins} min</span>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="rv2-section rv2-map-section">
            <div className="rv2-stitle-row">
              <span className="rv2-stitle">MAPPA</span>
              <button className="rv2-icon-btn" onClick={() => setMapFull(true)} title="Fullscreen">
                <span className="mdi mdi-fullscreen" />
              </button>
            </div>
            <div className="rv2-map">
              {mapUrl ? (
                <img src={mapUrl} alt="Mappa casa" className="rv2-map-img" />
              ) : (
                <span className="rv2-map-empty">Mappa non disponibile</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="rv2-stats">
            <div className="rv2-stat"><span className="rv2-stat-val">{totalCleans}</span><span className="rv2-stat-lbl">Pulizie</span></div>
            <div className="rv2-stat"><span className="rv2-stat-val">{Math.round(totalArea)} m²</span><span className="rv2-stat-lbl">Area totale</span></div>
            <div className="rv2-stat"><span className="rv2-stat-val">{Math.round(totalTime)}h</span><span className="rv2-stat-lbl">Tempo totale</span></div>
          </div>
        </div>

        {/* ── CENTER: Cleaning controls ── */}
        <div className="rv2-center">
          {!isCleaning && !isPaused ? (
            <>
              <div className="rv2-stitle-row">
                <span className="rv2-stitle">PULIZIA</span>
                <button className="rv2-icon-btn" onClick={() => setShowSettings((v) => !v)} title="Impostazioni">
                  <span className="mdi mdi-cog" />
                </button>
              </div>

              {/* Presets */}
              <div className="rv2-presets">
                <span className="rv2-label">PRESET</span>
                <div className="rv2-preset-row">
                  <button className="rv2-preset" onClick={() => applyPreset('standard')}><span className="mdi mdi-broom" /> Standard</button>
                  <button className="rv2-preset" onClick={() => applyPreset('fast')}><span className="mdi mdi-lightning-bolt" /> Veloce</button>
                  <button className="rv2-preset" onClick={() => applyPreset('deep')}><span className="mdi mdi-shimmer" /> Profonda</button>
                </div>
              </div>

              {/* Where */}
              <div className="rv2-where">
                <span className="rv2-label">DOVE PULIRE</span>
                <div className="rv2-rooms">
                  {ROOMS.map((r) => {
                    const selected = r.id === 0 ? selectedRooms.length === 0 : selectedRooms.includes(r.id);
                    return (
                      <button key={r.id} className={`rv2-room-btn ${selected ? 'selected' : ''}`} onClick={() => toggleRoom(r.id)}>
                        <span className={`mdi ${r.icon}`} />
                        <span>{r.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode */}
              <div className="rv2-ctrl">
                <span className="rv2-label">MODALITÀ</span>
                <div className="rv2-seg">
                  {(['vac', 'vac_and_mop', 'mop'] as CleanMode[]).map((m) => (
                    <button key={m} className={`rv2-seg-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>{MODE_LABELS[m]}</button>
                  ))}
                </div>
              </div>

              {/* Fan speed */}
              {showVac && (
                <div className="rv2-ctrl">
                  <span className="rv2-label">ASPIRAZIONE</span>
                  <div className="rv2-seg rv2-seg-sm">
                    {(['quiet', 'balanced', 'turbo', 'max', 'max_plus'] as FanSpeed[]).map((f) => (
                      <button key={f} className={`rv2-seg-btn ${fan === f ? 'active' : ''}`} onClick={() => setFan(f)}>{FAN_LABELS[f]}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mop intensity */}
              {showMop && (
                <div className="rv2-ctrl">
                  <span className="rv2-label">MOCIO</span>
                  <div className="rv2-seg rv2-seg-sm">
                    {(['low', 'medium', 'high'] as MopIntensity[]).map((m) => (
                      <button key={m} className={`rv2-seg-btn ${mop === m ? 'active' : ''}`} onClick={() => setMop(m)}>{MOP_LABELS[m]}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <button className="rv2-cta" onClick={startClean}>
                <span className="mdi mdi-play" /> Avvia pulizia · {roomCount} {typeof roomCount === 'number' ? (roomCount === 1 ? 'stanza' : 'stanze') : 'le stanze'}
              </button>
            </>
          ) : (
            /* ── Cleaning in progress ── */
            <>
              <span className="rv2-stitle">PULIZIA IN CORSO</span>
              <div className="rv2-cleaning">
                <span className="rv2-cleaning-room">{currentRoom}</span>
                <div className="rv2-cleaning-stats">
                  <span>{cleanArea} m²</span>
                  <span>{cleanProgress}%</span>
                </div>
                <div className="rv2-progress"><div className="rv2-progress-fill" style={{ width: `${cleanProgress}%` }} /></div>
              </div>
              <div className="rv2-cleaning-btns">
                {isCleaning ? (
                  <button className="rv2-ctrl-btn" onClick={() => callHA('vacuum', 'pause', undefined, { entity_id: 'vacuum.roborock_qv_35a' })}>
                    <span className="mdi mdi-pause" /> Pausa
                  </button>
                ) : (
                  <button className="rv2-ctrl-btn" onClick={() => callHA('vacuum', 'start', undefined, { entity_id: 'vacuum.roborock_qv_35a' })}>
                    <span className="mdi mdi-play" /> Riprendi
                  </button>
                )}
                <button className="rv2-ctrl-btn" onClick={() => callHA('vacuum', 'stop', undefined, { entity_id: 'vacuum.roborock_qv_35a' })}>
                  <span className="mdi mdi-stop" /> Stop
                </button>
                <button className="rv2-ctrl-btn" onClick={() => callHA('vacuum', 'return_to_base', undefined, { entity_id: 'vacuum.roborock_qv_35a' })}>
                  <span className="mdi mdi-home" /> Base
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Dock + Maintenance ── */}
        <div className="rv2-right">
          <div className="rv2-section">
            <span className="rv2-stitle">DOCK</span>
            <div className="rv2-dock-rows">
              <div className="rv2-dock-row"><span className="mdi mdi-water" /> Acqua pulita <span className={cleanWaterOk ? 'rv2-ok' : 'rv2-warn'}>{ cleanWaterOk ? '✓' : '⚠'}</span></div>
              <div className={`rv2-dock-row ${dirtyWaterFull ? 'rv2-dock-alert' : ''}`}><span className="mdi mdi-water-alert" /> Acqua sporca <span className={dirtyWaterFull ? 'rv2-warn' : 'rv2-ok'}>{dirtyWaterFull ? '⚠ Piena' : '✓'}</span></div>
              <div className="rv2-dock-row"><span className="mdi mdi-spray-bottle" /> Mocio <span className={mopAttached ? 'rv2-ok' : 'rv2-muted'}>{ mopAttached ? '✓ Montato' : '✗'}</span></div>
              <div className="rv2-dock-row"><span className="mdi mdi-weather-windy" /> Asciugatura <span className={drying ? 'rv2-accent' : 'rv2-muted'}>{drying ? 'In corso' : 'Off'}</span></div>
            </div>
          </div>

          <div className="rv2-section">
            <span className="rv2-stitle">MANUTENZIONE</span>
            <div className="rv2-maint-list">
              {maint.map((m) => {
                const expired = m.hours < 0;
                const pct = Math.max(0, Math.min(100, (m.hours / m.max) * 100));
                return (
                  <div key={m.label} className={`rv2-maint ${expired ? 'rv2-maint-expired' : ''}`}>
                    <div className="rv2-maint-head">
                      {expired && <span className="mdi mdi-alert-circle rv2-maint-alert" />}
                      <span className="rv2-maint-name">{m.label}</span>
                      <span className="rv2-maint-val">{expired ? `Scaduto · ${Math.abs(Math.round(m.hours))}h` : `${formatHours(m.hours)}`}</span>
                    </div>
                    {!expired && <div className="rv2-maint-bar"><div className="rv2-maint-fill" style={{ width: `${pct}%` }} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fullscreen map overlay ── */}
      {mapFull && (
        <div className="rv2-map-full" onClick={() => setMapFull(false)}>
          {mapUrl && <img src={mapUrl} alt="Mappa" />}
          <button className="rv2-map-close"><span className="mdi mdi-close" /></button>
        </div>
      )}

      {/* ── Settings popover ── */}
      {showSettings && (
        <div className="ts-overlay" onClick={() => setShowSettings(false)}>
          <div className="ts-modal rv2-settings" onClick={(e) => e.stopPropagation()}>
            <div className="ts-head"><h3><span className="mdi mdi-cog" /> Impostazioni Robot</h3><button className="edit-icon-btn" onClick={() => setShowSettings(false)}><span className="mdi mdi-close" /></button></div>
            <div className="ts-body">
              <div className="rv2-srow"><span>Volume</span><span>{entities['number.roborock_qv_35a_volume']?.state ?? '—'}%</span></div>
              <div className="rv2-srow"><span>Non disturbare</span><span>{entities['switch.roborock_qv_35a_non_disturbare']?.state === 'on' ? `${entities['time.roborock_qv_35a_inizia_non_disturbare']?.state} – ${entities['time.roborock_qv_35a_fine_non_disturbare']?.state}` : 'Off'}</span></div>
              <div className="rv2-srow"><span>Blocco bambini</span><span>{entities['switch.roborock_qv_35a_dock_blocco_bambini']?.state === 'on' ? 'On' : 'Off'}</span></div>
              <div className="rv2-srow"><span>Modalità spazzola</span><span>{entities['select.roborock_qv_35a_modalita_spazzola']?.state ?? '—'}</span></div>
              <div className="rv2-srow"><span>Mappa</span><span>{entities['select.roborock_qv_35a_mappa_selezionata']?.state ?? '—'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
