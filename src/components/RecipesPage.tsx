/**
 * Ricette — pagina di prova.
 *
 * Per ora mostra UN video YouTube fisso, solo per verificare che il player
 * embedded giri bene sul tablet in kiosk (Fully Kiosk, Helio G80). Il player
 * `youtube-nocookie.com/embed/<id>` è caricato on-demand (niente autoplay) per
 * non appesantire la pagina su hardware debole.
 *
 * Prossimo passo (quando confermi che va): barra di ricerca YouTube vera via
 * Data API, con la chiave tenuta lato server dell'add-on.
 */

// Video di prova (YouTube Short). Gli Shorts usano lo stesso embed dei video
// normali: youtube-nocookie.com/embed/<id>.
const DEMO_VIDEO_ID = 'pb5Dppppe9Y';
const DEMO_TITLE = 'Ricetta del giorno';

export function RecipesPage() {
  return (
    <div className="recipes-page">
      <div className="recipes-hero">
        <div className="recipes-hero-icon"><span className="mdi mdi-chef-hat" /></div>
        <div>
          <h2 className="recipes-hero-title">Ricette</h2>
          <p className="recipes-hero-sub">Video di prova — la ricerca arriva dopo</p>
        </div>
      </div>

      <div className="recipes-card">
        <div className="recipes-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0&modestbranding=1`}
            title={DEMO_TITLE}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="recipes-meta">
          <span className="mdi mdi-silverware-fork-knife" />
          <span className="recipes-meta-title">{DEMO_TITLE}</span>
        </div>
      </div>
    </div>
  );
}
