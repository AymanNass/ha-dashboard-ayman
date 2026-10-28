import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  subscribeConfig,
  callService,
  type HassEntities,
  type Connection,
} from 'home-assistant-js-websocket';
import { HA_URL, HA_TOKEN } from '../config';

// Module-level mirror of the WebSocket connection state, so leaf hooks (e.g.
// useCameraFeed) can gate work on connectivity without prop-drilling. Changes
// are broadcast as `ha:connection` CustomEvent<boolean> on window, matching
// the app's existing cross-cutting event idiom.
let haConnected = false;
export function isHaConnected(): boolean {
  return haConnected;
}
function broadcastConnected(value: boolean) {
  if (haConnected === value) return;
  haConnected = value;
  window.dispatchEvent(new CustomEvent('ha:connection', { detail: value }));
}

// Module-level mirror of the server's temperature unit (°C/°F), same idiom as
// haConnected above. Climate entities don't publish `temperature_unit` as a
// state attribute — their values arrive converted to the server's configured
// unit — so displays must read the unit from the HA config.
let haTempUnit = '';
function broadcastTempUnit(value: string) {
  if (haTempUnit === value) return;
  haTempUnit = value;
  window.dispatchEvent(new CustomEvent('ha:temp-unit', { detail: value }));
}

/** The HA server's configured temperature unit; '°C' until the config arrives. */
export function useHaTempUnit(): string {
  const [unit, setUnit] = useState(haTempUnit);
  useEffect(() => {
    const onUnit = (e: Event) => setUnit((e as CustomEvent<string>).detail);
    window.addEventListener('ha:temp-unit', onUnit);
    return () => window.removeEventListener('ha:temp-unit', onUnit);
  }, []);
  return unit || '°C';
}

/**
 * Build a human-readable, debug-friendly error message for connection failures.
 * Includes the attempted URL, the raw error, and a hint about what might be wrong.
 */
/**
 * Error codes thrown by home-assistant-js-websocket (numeric, not Error objects).
 * See: node_modules/home-assistant-js-websocket/dist/errors.d.ts
 */
const HA_WS_ERRORS: Record<number, string> = {
  1: 'Impossibile connettersi a Home Assistant',
  2: 'Token non valido o scaduto',
  3: 'Connessione persa',
  4: 'Host Home Assistant non configurato',
  5: 'Non puoi usare HTTPS verso un HA in HTTP',
  6: 'Callback di autenticazione non valido',
};

function buildConnectionError(err: unknown, url: string): string {
  // The HA WS library throws raw numbers (not Error instances) for known failures
  if (typeof err === 'number') {
    const label = HA_WS_ERRORS[err] || `Errore sconosciuto (codice ${err})`;
    let hint = '';
    switch (err) {
      case 1:
        hint = `Verifica che HA sia acceso e raggiungibile su ${url}. Se sei in cloud, HA deve essere esposto a internet (Cloudflare Tunnel / Nabu Casa).`;
        break;
      case 2:
        hint = 'Vai in HA → Profilo → Token di accesso a lunga durata, creane uno nuovo e incollalo nelle impostazioni della dashboard.';
        break;
      case 3:
        hint = 'La connessione WebSocket si è interrotta. Controlla la rete o ricarica la pagina.';
        break;
      case 5:
        hint = `La dashboard è servita in HTTPS ma ${url} è HTTP. Usa HTTPS anche per HA oppure configura un reverse proxy.`;
        break;
    }
    const parts = [`[${url}]`, label];
    if (hint) parts.push(`💡 ${hint}`);
    return parts.join(' — ');
  }

  // Standard Error objects or unknown throws
  const raw = err instanceof Error ? err.message : String(err);
  let hint = '';
  const lower = raw.toLowerCase();

  if (lower.includes('invalid access token') || lower.includes('401') || lower.includes('auth_invalid')) {
    hint = 'Token non valido o scaduto. Ricrea un Long-Lived Access Token in HA.';
  } else if (lower.includes('err_connection_refused') || lower.includes('econnrefused')) {
    hint = `HA non è raggiungibile su ${url}. Verifica che sia acceso e che la porta sia corretta.`;
  } else if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('net::')) {
    hint = `Impossibile raggiungere ${url}. Sei sulla stessa rete? Se il deploy è in cloud, HA deve essere esposto a internet (Cloudflare Tunnel / Nabu Casa).`;
  } else if (lower.includes('timeout') || lower.includes('timed out')) {
    hint = `Timeout collegandosi a ${url}. Il server potrebbe essere sovraccarico o non raggiungibile.`;
  } else if (lower.includes('cors') || lower.includes('cross-origin')) {
    hint = `Errore CORS: il browser blocca la richiesta verso ${url}. Aggiungi l'origine della dashboard nelle impostazioni CORS di HA (http.cors_allowed_origins in configuration.yaml).`;
  } else if (lower.includes('websocket') || lower.includes('ws')) {
    hint = `WebSocket non riesce a connettersi a ${url}. Verifica che HA sia raggiungibile e che nessun proxy blocchi i WebSocket.`;
  }

  const parts: string[] = [`[${url}]`, raw];
  if (hint) parts.push(`💡 ${hint}`);
  return parts.join(' — ');
}

/** Human-readable connection phase, surfaced in the status bar for visibility
 *  and debugging of the intermittent "connecting" issue. */
export type ConnPhase =
  | 'idle'
  | 'connecting'   // first attempt in progress
  | 'connected'
  | 'reconnecting' // dropped, trying again (e.g. after returning to foreground)
  | 'waiting-network'
  | 'error';

export function useHomeAssistant() {
  const [entities, setEntities] = useState<HassEntities>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ConnPhase>('idle');
  const [attempts, setAttempts] = useState(0);
  const connRef = useRef<Connection | null>(null);

  // ── Batched entity updates ──
  // home-assistant-js-websocket calls our subscriber on EVERY state_changed
  // event, handing a fresh entities object each time. In a busy home that's
  // many times per second, and since the object reference changes, it re-renders
  // the whole dashboard each time — the dominant cost on a weak tablet. Instead
  // of setting state per event, we stash the latest snapshot in a ref and flush
  // to React once per animation frame (or every 500 ms in lite mode), collapsing
  // a burst of events into a single render.
  const pendingEntities = useRef<HassEntities | null>(null);
  const flushHandle = useRef<number | null>(null);

  useEffect(() => {
    if (!HA_TOKEN) {
      console.error('[Glance] No token! HA_URL:', HA_URL, 'HA_TOKEN:', HA_TOKEN ? '(present)' : '(empty)');
      setError('No HA token configured. Set VITE_HA_TOKEN in .env');
      return;
    }

    // ── Connection manager (rewritten from scratch) ───────────────────────
    //
    // Design in one sentence: keep trying to open ONE socket; if we still
    // aren't connected after a short grace period, do automatically what the
    // user already does by hand — reload the page once — because a reload
    // always connects. No warm-up, no watchdog, no competing sockets.
    //
    // History that led here: a plain createConnection() can hang forever on a
    // cold mobile socket; past fixes (warm-up probe, 7 s watchdog, short
    // timeouts) each opened extra sockets that raced and made it worse. This
    // version runs a single attempt at a time and leans on the one thing proven
    // to work on this device — a fresh page load.
    let cancelled = false;
    // One attempt at a time. A plain local (not a useRef) so React StrictMode's
    // mount→unmount→mount in dev starts each mount with a clean guard; a ref
    // would survive the first (cancelled) mount still set to true and block the
    // second mount's connect() forever — "stuck on Connecting".
    let connecting = false;
    let retryTimer: number | null = null;
    let reloadTimer: number | null = null;
    let retryDelay = 800; // backoff between in-page retries, reset on success

    // Per-attempt timeout. Generous (15 s) so a slow-but-valid first auth on a
    // weak phone completes instead of being cut; a genuinely dead socket still
    // rejects here instead of hanging forever.
    const CONNECT_TIMEOUT_MS = 15000;
    // If we're not connected within this window after (re)load, reload once.
    const RELOAD_AFTER_MS = 8000;
    // sessionStorage key: marks that THIS page instance already auto-reloaded,
    // so we reload at most once per cold start and never loop. Cleared as soon
    // as we connect successfully, so a future cold start can use it again.
    const RELOADED_KEY = 'glance:auto-reloaded';

    function connectWithTimeout(auth: ReturnType<typeof createLongLivedTokenAuth>): Promise<Connection> {
      return Promise.race([
        createConnection({ auth }),
        new Promise<Connection>((_, reject) =>
          setTimeout(() => reject(new Error('timeout: connessione appesa')), CONNECT_TIMEOUT_MS),
        ),
      ]);
    }

    // The automatic "refresh that always works". Reload exactly once per cold
    // start: if marking in sessionStorage fails we simply don't reload (safer
    // than risking a loop). Never reloads for a bad token (pointless).
    // Disabled in dev: Vite's HMR + StrictMode double-mount would make an
    // auto-reload confusing while developing; it only matters in production.
    const autoReloadOnce = () => {
      if (cancelled || connRef.current || !import.meta.env.PROD) return;
      let already = false;
      try { already = sessionStorage.getItem(RELOADED_KEY) === '1'; } catch { already = true; }
      if (already) return;
      try { sessionStorage.setItem(RELOADED_KEY, '1'); } catch { return; }
      console.warn('[Glance] Still not connected — auto-reloading once.');
      window.location.reload();
    };

    async function connect() {
      if (connecting || connRef.current) return; // one at a time
      connecting = true;
      console.log('[Glance] Connecting to', HA_URL, '...');
      setPhase((p) => (p === 'idle' ? 'connecting' : p));
      setAttempts((n) => n + 1);
      try {
        const auth = createLongLivedTokenAuth(HA_URL, HA_TOKEN);
        const conn = await connectWithTimeout(auth);

        if (cancelled) { conn.close(); connecting = false; return; }

        // Connected. Clear timers + the one-shot reload guard.
        connecting = false;
        retryDelay = 800;
        if (reloadTimer != null) { clearTimeout(reloadTimer); reloadTimer = null; }
        try { sessionStorage.removeItem(RELOADED_KEY); } catch { /* ignore */ }

        connRef.current = conn;
        setConnected(true);
        setPhase('connected');
        broadcastConnected(true);
        setError(null);

        conn.addEventListener('disconnected', () => {
          setConnected(false);
          setPhase('reconnecting');
          broadcastConnected(false);
        });
        conn.addEventListener('ready', () => {
          setConnected(true);
          setPhase('connected');
          broadcastConnected(true);
        });

        subscribeEntities(conn, (ents) => {
          if (cancelled) return;
          // Coalesce a burst of state_changed events into one render per frame.
          pendingEntities.current = ents;
          if (flushHandle.current != null) return;
          const flush = () => {
            flushHandle.current = null;
            const next = pendingEntities.current;
            pendingEntities.current = null;
            if (next && !cancelled) setEntities(next);
          };
          flushHandle.current = window.requestAnimationFrame(flush);
        });

        subscribeConfig(conn, (config) => {
          if (!cancelled) broadcastTempUnit(config.unit_system?.temperature ?? '');
        });
      } catch (err) {
        console.error('[Glance] Connection failed:', err);
        connecting = false;
        if (cancelled) return;

        const detail = buildConnectionError(err, HA_URL);
        setConnected(false);
        broadcastConnected(false);

        // Bad/expired token (HA WS error code 2) never succeeds on retry and a
        // reload wouldn't help — show it and stop.
        if (err === 2) {
          setError(detail);
          setPhase('error');
          if (reloadTimer != null) { clearTimeout(reloadTimer); reloadTimer = null; }
          return;
        }

        // Transient: keep the UI calm ("Riconnessione…") and retry in-page with
        // a growing backoff. The RELOAD_AFTER_MS timer (armed below) is the
        // backstop if these in-page retries don't land in time.
        setPhase('reconnecting');
        setError(null);
        if (retryTimer != null) clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (!cancelled) connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 5000);
      }
    }

    // Arm the one-shot auto-reload backstop for this page load. If we haven't
    // connected within the grace window, reload once — the move that reliably
    // works on the problem phone.
    reloadTimer = window.setTimeout(autoReloadOnce, RELOAD_AFTER_MS);

    connect();

    // Nudge a reconnect when the page returns to the foreground (iOS suspends
    // the socket while backgrounded/locked). Only when idle — never disturb an
    // attempt in flight.
    const kick = () => {
      if (cancelled || document.hidden || connecting) return;
      const conn = connRef.current;
      if (conn) {
        setPhase((p) => (p === 'connected' ? p : 'reconnecting'));
        setAttempts((n) => n + 1);
        try { conn.reconnect(); } catch { /* ignore */ }
      } else {
        if (retryTimer != null) { clearTimeout(retryTimer); retryTimer = null; }
        retryDelay = 800;
        connect();
      }
    };
    const onNetDown = () => { if (!cancelled) setPhase('waiting-network'); };
    window.addEventListener('offline', onNetDown);

    // Close the socket cleanly before the page goes away so HA frees the old
    // session immediately and the next load connects right away.
    const onPageHide = () => {
      try { connRef.current?.close(); } catch { /* ignore */ }
      connRef.current = null;
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    const onVisible = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', kick);
    window.addEventListener('online', kick);

    return () => {
      cancelled = true;
      if (retryTimer != null) { clearTimeout(retryTimer); retryTimer = null; }
      if (reloadTimer != null) { clearTimeout(reloadTimer); reloadTimer = null; }
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', kick);
      window.removeEventListener('online', kick);
      window.removeEventListener('offline', onNetDown);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      if (flushHandle.current != null) {
        cancelAnimationFrame(flushHandle.current);
        clearTimeout(flushHandle.current);
        flushHandle.current = null;
      }
      connRef.current?.close();
    };
  }, []);

  const callHA = useCallback(
    async (domain: string, service: string, data?: Record<string, unknown>, target?: { entity_id: string | string[] }) => {
      if (!connRef.current) return;
      await callService(connRef.current, domain, service, data, target);
    },
    [],
  );

  const getState = useCallback(
    (entityId: string) => entities[entityId] ?? null,
    [entities],
  );

  const getHistory = useCallback(
    async (entityId: string, hours = 24, attribute?: string): Promise<number[]> => {
      if (!connRef.current) return [];
      try {
        const end = new Date();
        const start = new Date(end.getTime() - hours * 3600 * 1000);
        // For an attribute series (e.g. a climate's `current_temperature`) we
        // must keep attributes in the response; the default state-only path stays
        // lean with minimal_response + no_attributes.
        const res = (await connRef.current.sendMessagePromise({
          type: 'history/history_during_period',
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          entity_ids: [entityId],
          minimal_response: !attribute,
          no_attributes: !attribute,
        })) as Record<string, Array<{ s?: string; a?: Record<string, unknown> }>>;
        const points = res?.[entityId] ?? [];
        return points
          .map((p) => {
            const raw = attribute ? p.a?.[attribute] : p.s;
            return typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
          })
          .filter((n) => Number.isFinite(n));
      } catch {
        return [];
      }
    },
    [],
  );

  const getForecast = useCallback(
    async (entityId: string, type: 'daily' | 'hourly' = 'daily') => {
      if (!connRef.current) return [];
      try {
        const res = (await callService(
          connRef.current,
          'weather',
          'get_forecasts',
          { type },
          { entity_id: entityId },
          true,
        )) as { response?: Record<string, { forecast?: unknown[] }> };
        return res?.response?.[entityId]?.forecast ?? [];
      } catch {
        return [];
      }
    },
    [],
  );

  /** Fetch events for the given calendars over the next `days` days via the
   *  response-returning `calendar.get_events` service (same pattern as
   *  `weather.get_forecasts`). The window starts at local midnight so ongoing
   *  and all-day events are included. Returns the raw per-calendar response. */
  const getCalendarEvents = useCallback(
    async (entityIds: string[], days = 7): Promise<Record<string, { events?: unknown[] }>> => {
      if (!connRef.current || !entityIds.length) return {};
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + days * 86_400_000);
      try {
        const res = (await callService(
          connRef.current,
          'calendar',
          'get_events',
          { start_date_time: start.toISOString(), end_date_time: end.toISOString() },
          { entity_id: entityIds },
          true,
        )) as { response?: Record<string, { events?: unknown[] }> };
        return res?.response ?? {};
      } catch {
        return {};
      }
    },
    [],
  );

  // ── Music Assistant ──
  // The `music_assistant.search` service needs the integration's config entry id.
  // Resolve it lazily and cache it (undefined = not yet looked up, null = none).
  const maEntryId = useRef<string | null | undefined>(undefined);

  const getMaEntryId = useCallback(async (): Promise<string | null> => {
    if (maEntryId.current !== undefined) return maEntryId.current;
    if (!connRef.current) return null;
    try {
      const entries = (await connRef.current.sendMessagePromise({
        type: 'config_entries/get',
      })) as Array<{ entry_id: string; domain: string }>;
      maEntryId.current = entries.find((e) => e.domain === 'music_assistant')?.entry_id ?? null;
    } catch {
      maEntryId.current = null;
    }
    return maEntryId.current;
  }, []);

  /** Search Music Assistant; returns the raw grouped response (artists/albums/…). */
  const searchMusic = useCallback(
    async (opts: {
      term: string;
      mediaType?: string;
      limit?: number;
      libraryOnly?: boolean;
    }): Promise<Record<string, unknown>> => {
      if (!connRef.current) throw new Error('Not connected to Home Assistant.');
      const entryId = await getMaEntryId();
      if (!entryId) throw new Error('Music Assistant integration not found.');
      const data: Record<string, unknown> = {
        config_entry_id: entryId,
        name: opts.term,
        limit: opts.limit && opts.limit > 0 ? opts.limit : 5,
        library_only: !!opts.libraryOnly,
      };
      if (opts.mediaType) data.media_type = [opts.mediaType];
      const res = (await callService(
        connRef.current,
        'music_assistant',
        'search',
        data,
        undefined,
        true,
      )) as { response?: Record<string, unknown> };
      return res?.response ?? {};
    },
    [getMaEntryId],
  );

  /** Play a Music Assistant media uri on a media_player. */
  const playMusic = useCallback(
    async (playerEntityId: string, mediaId: string, mediaType?: string) => {
      const data: Record<string, unknown> = { media_id: mediaId };
      if (mediaType) data.media_type = mediaType;
      await callHA('music_assistant', 'play_media', data, { entity_id: playerEntityId });
    },
    [callHA],
  );

  // The media players you can play to are the ones provided by the Music
  // Assistant integration. Resolve them from the entity registry
  // (platform === 'music_assistant') and cache the result. Throws if the
  // registry can't be read so callers can decide on a fallback.
  const maPlayerIds = useRef<string[] | undefined>(undefined);
  const getMaPlayers = useCallback(async (): Promise<string[]> => {
    if (maPlayerIds.current !== undefined) return maPlayerIds.current;
    if (!connRef.current) throw new Error('Not connected to Home Assistant.');
    const reg = (await connRef.current.sendMessagePromise({
      type: 'config/entity_registry/list',
    })) as Array<{ entity_id: string; platform: string }>;
    maPlayerIds.current = reg
      .filter((r) => r.platform === 'music_assistant' && r.entity_id.startsWith('media_player.'))
      .map((r) => r.entity_id);
    return maPlayerIds.current;
  }, []);

  return { entities, connected, error, phase, attempts, callHA, getState, getForecast, getHistory, getCalendarEvents, searchMusic, playMusic, getMaPlayers };
}
