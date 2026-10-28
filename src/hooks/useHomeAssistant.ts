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
  // Guard: only ONE connection attempt in flight at a time. Without this, the
  // initial connect() and the focus/visibility "kick" that fires on page load
  // raced each other — producing the regular "refresh works / refresh stuck"
  // alternation.
  const connectingRef = useRef(false);

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

    let cancelled = false;
    let retryTimer: number | null = null;
    // Grows on repeated failures so we don't hammer a down server, resets on
    // success. Starts short so a stuck cold-start attempt retries quickly.
    let retryDelay = 800;
    // Consecutive failed attempts. A cold-start timeout that the next retry
    // fixes is normal, not something to alarm the user about — so we keep the
    // red error banner hidden until several attempts in a row have failed,
    // which means a real, persistent problem.
    let failStreak = 0;
    const ERROR_AFTER_FAILS = 4;

    // A cold-start WebSocket on mobile can open a half-dead socket that never
    // resolves nor rejects — createConnection() then awaits forever. Race it
    // against a timeout so a *genuinely* stuck attempt turns into a real
    // rejection we can retry, instead of hanging on "connecting" forever.
    //
    // This timeout must be WELL ABOVE the real first-auth time. On a slow phone
    // the very first socket (cold DNS/TCP/TLS + HA auth handshake) legitimately
    // takes ~5-6 s; a 5 s timeout was cutting that valid-but-slow attempt and
    // firing a retry, which opened a SECOND socket while the first was still
    // authenticating — the two then stepped on each other (we saw 2 dead WS of
    // ~6 s before a 3rd connected). Being patient (and keeping connectingRef
    // held for the whole attempt) means one socket completes on the first try.
    const CONNECT_TIMEOUT_MS = 20000;
    function connectWithTimeout(auth: ReturnType<typeof createLongLivedTokenAuth>): Promise<Connection> {
      return Promise.race([
        createConnection({ auth }),
        new Promise<Connection>((_, reject) =>
          setTimeout(() => reject(new Error('timeout: connessione appesa')), CONNECT_TIMEOUT_MS),
        ),
      ]);
    }

    // NB: a separate 7 s "watchdog" used to live here and abort a stuck attempt.
    // It's been removed: it fired BEFORE the 20 s connect timeout and killed the
    // slow-but-valid first auth, opening a competing socket — the very cause of
    // the multiple dead WebSockets. connectWithTimeout + the catch/retry below
    // now handle a genuinely stuck socket as a single, coherent mechanism.

    async function connect() {
      // Only one attempt at a time — prevents the initial connect and the
      // focus/visibility kick from racing on page load.
      if (connectingRef.current || connRef.current) return;
      connectingRef.current = true;
      console.log('[Glance] Connecting to', HA_URL, '...');
      setPhase((p) => (p === 'idle' ? 'connecting' : p));
      setAttempts((n) => n + 1);
      try {
        const auth = createLongLivedTokenAuth(HA_URL, HA_TOKEN);
        const conn = await connectWithTimeout(auth);

        if (cancelled) {
          conn.close();
          connectingRef.current = false;
          return;
        }
        connectingRef.current = false;
        retryDelay = 800; // connected — reset backoff
        failStreak = 0;

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
          // Keep only the newest snapshot and flush once per animation frame.
          // This still collapses a burst of state_changed events into one render
          // (coalescing within the same frame) WITHOUT adding perceptible delay —
          // a rAF fires within ~16 ms, so a tapped light's new state shows up
          // right away. (A longer timer here was adding ~0.5 s of lag.)
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
        connectingRef.current = false;
        if (cancelled) return;

        const detail = buildConnectionError(err, HA_URL);
        setConnected(false);
        broadcastConnected(false);
        failStreak += 1;

        // An invalid/expired token (HA WS error code 2) will never succeed on
        // retry — surface it immediately and stop. Everything else (timeout,
        // network, a half-dead cold-start socket) is transient: schedule an
        // automatic retry with a short, growing backoff instead of sitting on
        // "error". This is what replaces the fragile open-and-close "warm-up":
        // a stuck first attempt now times out and retries on its own.
        if (err === 2) {
          setError(detail);
          setPhase('error');
          return;
        }

        // Don't alarm the user over a transient cold-start timeout the next
        // retry will fix. Show "Riconnessione…" and only reveal the red error
        // banner once several attempts in a row have failed (a real problem).
        setPhase('reconnecting');
        setError(failStreak >= ERROR_AFTER_FAILS ? detail : null);
        if (retryTimer != null) clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (!cancelled) connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10000);
      }
    }

    // Connect straight away. The previous "warm-up" (open a throwaway socket,
    // close it, then connect) tried to imitate the manual "Test connection",
    // but its own createConnection() had no timeout: at a cold start on mobile
    // it could hang forever and connect() would never run — the real cause of
    // the permanent "Connecting…". connect() now times out a stuck attempt
    // (connectWithTimeout) and retries on its own, so the warm-up is gone.
    connect();

    // ── Fast reconnect when the page comes back to the foreground ──
    // On mobile (especially iOS), the OS suspends the WebSocket while the tab is
    // backgrounded or the phone is locked. On return the page would otherwise
    // sit on "connecting" until the library's slow backoff retried. Here we
    // nudge an immediate reconnect the moment the page becomes visible / focused
    // again if we're not currently connected — this is what was leaving one
    // phone stuck on "connecting…" after reopening.
    const kick = () => {
      if (cancelled || document.hidden) return;
      // Never interfere with an attempt that's already running (this was the
      // race behind the "refresh works / refresh stuck" alternation).
      if (connectingRef.current) return;
      const conn = connRef.current;
      if (conn) {
        // Force the existing connection to retry now instead of waiting.
        setPhase((p) => (p === 'connected' ? p : 'reconnecting'));
        setAttempts((n) => n + 1);
        try { conn.reconnect(); } catch { /* ignore */ }
      } else {
        // No connection object yet (initial attempt failed, or a backoff retry
        // is pending). Cancel any scheduled retry and connect NOW — coming back
        // to the foreground is the best moment to try, and this avoids two
        // parallel retry paths racing.
        if (retryTimer != null) { clearTimeout(retryTimer); retryTimer = null; }
        retryDelay = 800;
        connect();
      }
    };
    const onNetDown = () => { if (!cancelled) setPhase('waiting-network'); };
    window.addEventListener('offline', onNetDown);

    // Close the WebSocket cleanly BEFORE the page goes away (refresh/navigation).
    // Otherwise Home Assistant still sees the old session for a few seconds and
    // makes the next connection wait — which is exactly why a quick second
    // refresh took a few seconds to reconnect. Closing on pagehide frees the
    // session immediately so the fresh load connects right away.
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
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', kick);
      window.removeEventListener('online', kick);
      window.removeEventListener('offline', onNetDown);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      if (flushHandle.current != null) {
        // The handle is either a rAF id or a timeout id depending on mode;
        // cancel both kinds to be safe.
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
