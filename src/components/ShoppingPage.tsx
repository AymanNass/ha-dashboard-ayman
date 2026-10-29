import { useEffect, useRef, useState } from 'react';
import {
  loadShopping,
  saveShopping,
  toggleItem,
  addItem,
  removeItem,
  resetHave,
  type ShoppingList,
} from '../lib/shopping';

/**
 * Lista della spesa / dispensa.
 *
 * Mostra i prodotti "fissi" (dispensa) che si spuntano quando li hai e si
 * deselezionano quando mancano, più gli articoli aggiunti al volo per la spesa.
 * La lista è condivisa fra tablet e telefoni tramite il server dell'add-on, con
 * un polling leggero così le modifiche fatte su un dispositivo compaiono
 * sull'altro entro pochi secondi.
 */
export function ShoppingPage() {
  const [list, setList] = useState<ShoppingList>({ items: [] });
  const [input, setInput] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Suppress a poll overwriting a change we just made locally for a moment.
  const lastLocalWrite = useRef(0);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    loadShopping().then((l) => {
      if (!cancelled) { setList(l); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  // Light polling so another device's changes show up. Skipped briefly after a
  // local write so we don't clobber an optimistic update mid-flight.
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (Date.now() - lastLocalWrite.current < 3000) return;
      const fresh = await loadShopping();
      setList((prev) =>
        JSON.stringify(prev.items) === JSON.stringify(fresh.items) ? prev : fresh,
      );
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Apply a pure list operation: update UI immediately + persist.
  const apply = (next: ShoppingList) => {
    lastLocalWrite.current = Date.now();
    setList(next);
    void saveShopping(next);
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    apply(addItem(list, input, false));
    setInput('');
  };

  const fixed = list.items.filter((it) => it.fixed);
  const adhoc = list.items.filter((it) => !it.fixed).sort((a, b) => a.ts - b.ts);
  const visible = (arr: typeof list.items) =>
    onlyMissing ? arr.filter((it) => !it.have) : arr;

  const missingCount = list.items.filter((it) => !it.have).length;

  const totalCount = list.items.length;

  const card = (it: ShoppingList['items'][number]) => (
    <div key={it.id} className={`shop-card ${it.have ? 'have' : 'missing'}`}>
      <button
        className="shop-card-main"
        onClick={() => apply(toggleItem(list, it.id))}
        aria-pressed={it.have}
        aria-label={it.have ? `${it.text}: ce l'ho` : `${it.text}: manca`}
      >
        <span className="shop-tick">
          <span className={`mdi ${it.have ? 'mdi-check-circle' : 'mdi-circle-outline'}`} />
        </span>
        <span className="shop-text">{it.text}</span>
      </button>
      {!it.fixed && (
        <button
          className="shop-remove"
          onClick={() => apply(removeItem(list, it.id))}
          aria-label={`Rimuovi ${it.text}`}
        >
          <span className="mdi mdi-close" />
        </button>
      )}
    </div>
  );

  return (
    <div className="shop-page">
      {/* Hero header with the big "to buy" count */}
      <div className="shop-hero">
        <div className="shop-hero-icon"><span className="mdi mdi-cart-variant" /></div>
        <div className="shop-hero-text">
          <span className="shop-hero-count">{missingCount}</span>
          <span className="shop-hero-label">
            {missingCount === 1 ? 'cosa da comprare' : 'cose da comprare'}
          </span>
        </div>
        {totalCount > 0 && (
          <div className="shop-hero-ring" aria-hidden>
            <span>{totalCount - missingCount}/{totalCount}</span>
          </div>
        )}
      </div>

      <form className="shop-add" onSubmit={onAdd}>
        <span className="mdi mdi-magnify shop-add-ic" />
        <input
          className="shop-add-input"
          type="text"
          inputMode="text"
          placeholder="Aggiungi alla spesa…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          enterKeyHint="done"
        />
        <button className="shop-add-btn" type="submit" aria-label="Aggiungi" disabled={!input.trim()}>
          <span className="mdi mdi-plus" />
        </button>
      </form>

      <div className="shop-toolbar">
        <button
          className={`shop-filter ${onlyMissing ? 'active' : ''}`}
          onClick={() => setOnlyMissing((v) => !v)}
        >
          <span className={`mdi ${onlyMissing ? 'mdi-filter' : 'mdi-filter-outline'}`} />
          {onlyMissing ? 'Solo da comprare' : 'Mostra tutto'}
        </button>
        <button
          className="shop-reset"
          onClick={() => { if (confirm('Segnare tutto come "manca"?')) apply(resetHave(list)); }}
        >
          <span className="mdi mdi-refresh" /> Nuova spesa
        </button>
      </div>

      {!loaded ? (
        <div className="shop-empty">Caricamento…</div>
      ) : (
        <>
          {visible(adhoc).length > 0 && (
            <section className="shop-section">
              <h3 className="shop-section-title">
                <span className="mdi mdi-cart-plus" /> Extra
              </h3>
              <div className="shop-grid">{visible(adhoc).map(card)}</div>
            </section>
          )}

          <section className="shop-section">
            <h3 className="shop-section-title">
              <span className="mdi mdi-fridge-outline" /> Dispensa
            </h3>
            {visible(fixed).length > 0 ? (
              <div className="shop-grid">{visible(fixed).map(card)}</div>
            ) : (
              <div className="shop-empty">
                {onlyMissing ? 'Niente da comprare in dispensa 🎉' : 'Nessun prodotto fisso.'}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
