// Performance ("lite") mode.
//
// Heavy GPU effects — backdrop blur on glass surfaces, 3D pointer tilt, big
// soft shadows and weather particles — look great on a desktop but crawl on a
// low-end wall tablet (e.g. a Lenovo M10 Plus / MediaTek Helio G80). On those
// the blur often fails to render at all, which also makes "glass" tiles look
// borderless. Lite mode strips the expensive bits while keeping the layout and
// colors, so the dashboard stays good-looking but runs smoothly.
//
// It activates when ANY of these is true:
//   • the URL carries `?lite` (or `?lite=1`)                — explicit opt-in
//   • the URL carries `?lite=0` / `?full`                   — explicit opt-OUT (wins)
//   • the device looks weak (few CPU cores / little memory) — auto-detect
//
// The result is written as `data-perf="lite"` on <html>, which the stylesheet
// keys off. Detection runs once at startup, before React mounts.

/** Rough "is this a low-powered device?" heuristic, deliberately conservative. */
function isWeakDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Logical CPU cores. Budget Android tablets typically report <= 8 but pair it
  // with a weak GPU; desktops/laptops usually report plenty. Use cores as a
  // coarse signal only alongside memory below.
  const cores = navigator.hardwareConcurrency ?? 0;

  // Device memory in GiB (Chrome/Android only; undefined elsewhere). The M10
  // Plus ships with 3-4 GB. <= 4 GB is a strong "go lite" signal.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  // Touch-primary, no fine pointer → almost certainly a tablet/kiosk panel
  // rather than a desktop, so the perf trade-off is worth it.
  const coarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches === true &&
    window.matchMedia?.('(hover: none)').matches === true;

  if (typeof mem === 'number' && mem > 0 && mem <= 4) return true;
  if (coarsePointer && cores > 0 && cores <= 8) return true;

  return false;
}

/** Whether lite mode is currently active (reads the root attribute). */
export function isLiteMode(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-perf') === 'lite'
  );
}

/** Decide and apply the performance mode. Call once before the first render. */
export function applyPerfMode(): void {
  if (typeof document === 'undefined') return;

  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  // Explicit opt-out always wins so a weak device can still be forced to full.
  const forcedOff =
    params?.has('full') || params?.get('lite') === '0' || params?.get('lite') === 'false';

  const forcedOn =
    params != null &&
    params.has('lite') &&
    params.get('lite') !== '0' &&
    params.get('lite') !== 'false';

  const lite = !forcedOff && (forcedOn || isWeakDevice());

  if (lite) document.documentElement.setAttribute('data-perf', 'lite');
  else document.documentElement.removeAttribute('data-perf');
}
