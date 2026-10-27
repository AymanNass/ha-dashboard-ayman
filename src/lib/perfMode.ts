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

  // Lite mode is now the DEFAULT experience for every device (the optimized
  // look + instant response is what we want everywhere). The only way out is an
  // explicit opt-in to the full-effects version via ?full (or ?lite=0), e.g.
  // on a powerful desktop that wants blur/animations back.
  const forcedOff =
    params?.has('full') || params?.get('lite') === '0' || params?.get('lite') === 'false';

  // Mobile layout (phone): opt-in ONLY via ?mobile. Fully isolated — nothing
  // changes for anyone who doesn't pass it. Mobile implies lite (no heavy
  // effects on a phone). The CSS keys off html[data-mobile].
  const mobile = params?.has('mobile') && params.get('mobile') !== '0' && params.get('mobile') !== 'false';

  const lite = !forcedOff || mobile;

  if (lite) document.documentElement.setAttribute('data-perf', 'lite');
  else document.documentElement.removeAttribute('data-perf');

  if (mobile) document.documentElement.setAttribute('data-mobile', 'on');
  else document.documentElement.removeAttribute('data-mobile');
}

/** Whether the phone (mobile) layout is active. */
export function isMobileLayout(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-mobile') === 'on'
  );
}
