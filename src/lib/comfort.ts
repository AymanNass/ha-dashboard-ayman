/** Comfort classification for indoor temperature and humidity.
 *  Adapts ranges based on season (summer vs winter) following Italian
 *  building regulations and health guidelines. */

export type ComfortLevel = 'cold' | 'cool' | 'ok' | 'warm' | 'hot';
export type HumidityLevel = 'very-dry' | 'dry' | 'ok' | 'humid' | 'very-humid';
export type Season = 'summer' | 'winter';

interface ComfortResult {
  level: ComfortLevel;
  color: string;
  label: string;
  advice?: string;
}

interface HumidityResult {
  level: HumidityLevel;
  color: string;
  label: string;
  advice?: string;
}

/** Determine current season from the month. Apr-Sep = summer, Oct-Mar = winter. */
export function currentSeason(): Season {
  const m = new Date().getMonth(); // 0-11
  return m >= 3 && m <= 8 ? 'summer' : 'winter';
}

/**
 * Classify indoor temperature.
 *
 * Winter: 19-21°C optimal (Italian law: 20°C ± 2°C tolerance)
 * Summer: 24-26°C optimal (max 6-7°C below outdoor)
 */
export function classifyTemp(temp: number, season: Season = currentSeason()): ComfortResult {
  if (season === 'winter') {
    if (temp < 15) return { level: 'cold', color: '#3b82f6', label: 'Molto freddo', advice: 'Accendi il riscaldamento' };
    if (temp < 18) return { level: 'cool', color: '#06b6d4', label: 'Fresco', advice: 'Un po\' sotto il comfort' };
    if (temp <= 22) return { level: 'ok', color: '#10b981', label: 'Ottimale' };
    if (temp <= 24) return { level: 'warm', color: '#f59e0b', label: 'Caldo per inverno', advice: 'Abbassa il termostato — ogni grado in più = +7% consumi' };
    return { level: 'hot', color: '#ef4444', label: 'Troppo caldo', advice: 'Riduci il riscaldamento, sprechi energia' };
  }
  // Summer
  if (temp < 20) return { level: 'cold', color: '#3b82f6', label: 'Troppo freddo', advice: 'Alza la temperatura del condizionatore' };
  if (temp < 23) return { level: 'cool', color: '#06b6d4', label: 'Fresco' };
  if (temp <= 27) return { level: 'ok', color: '#10b981', label: 'Ottimale' };
  if (temp <= 30) return { level: 'warm', color: '#f59e0b', label: 'Caldo', advice: 'Accendi condizionatore o deumidificatore' };
  return { level: 'hot', color: '#ef4444', label: 'Molto caldo', advice: 'Accendi il condizionatore' };
}

/**
 * Classify indoor humidity.
 *
 * Winter: 40-50% optimal (max 55%; >60% = rischio muffa)
 * Summer: 50-60% optimal (deumidificare è fondamentale)
 */
export function classifyHumidity(hum: number, season: Season = currentSeason()): HumidityResult {
  if (season === 'winter') {
    if (hum < 30) return { level: 'very-dry', color: '#f59e0b', label: 'Troppo secco', advice: 'Usa un umidificatore — aria secca irrita le mucose' };
    if (hum < 40) return { level: 'dry', color: '#06b6d4', label: 'Un po\' secco' };
    if (hum <= 50) return { level: 'ok', color: '#10b981', label: 'Ottimale' };
    if (hum <= 55) return { level: 'ok', color: '#10b981', label: 'Accettabile' };
    if (hum <= 65) return { level: 'humid', color: '#f59e0b', label: 'Umido', advice: 'Arieggia la stanza — sopra 60% rischio muffa' };
    return { level: 'very-humid', color: '#ef4444', label: 'Troppo umido', advice: 'Rischio muffa! Arieggia o accendi deumidificatore' };
  }
  // Summer
  if (hum < 35) return { level: 'very-dry', color: '#f59e0b', label: 'Troppo secco', advice: 'Usa un umidificatore' };
  if (hum < 45) return { level: 'dry', color: '#06b6d4', label: 'Un po\' secco' };
  if (hum <= 60) return { level: 'ok', color: '#10b981', label: 'Ottimale' };
  if (hum <= 70) return { level: 'humid', color: '#f59e0b', label: 'Umido', advice: 'Accendi deumidificatore — ridurre l\'umidità fa percepire meno il caldo' };
  return { level: 'very-humid', color: '#ef4444', label: 'Troppo umido', advice: 'Deumidifica subito! Con quest\'umidità il caldo è insopportabile' };
}

/** Get a color for a temperature value (for inline use). */
export function tempColor(temp: number): string {
  return classifyTemp(temp).color;
}

/** Get a color for a humidity value (for inline use). */
export function humidityColor(hum: number): string {
  return classifyHumidity(hum).color;
}
