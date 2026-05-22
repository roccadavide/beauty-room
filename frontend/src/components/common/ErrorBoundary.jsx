import { Component } from "react";
import { useLocation } from "react-router-dom";

const isDev = import.meta.env.DEV;

// Errori di "chunk obsoleto": capitano quando Vercel pubblica una nuova
// build mentre l'utente ha ancora la pagina vecchia aperta — il vecchio
// hash del chunk dà 404 alla navigazione. Soluzione: ricaricare per
// scaricare gli asset aggiornati.
const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
];

function isChunkLoadError(error) {
  if (!error) return false;
  const msg = `${error.name || ""} ${error.message || ""}`;
  return CHUNK_ERROR_PATTERNS.some(p => msg.includes(p));
}

const RELOAD_FLAG = "br:chunkReloadAt";
const RELOAD_COOLDOWN = 12_000; // ms — evita loop di reload

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      recovering: false,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: `BR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidMount() {
    // Se l'app resta sana per qualche secondo, azzera il flag di throttle
    // così un futuro stale-chunk potrà di nuovo innescare un reload.
    this._healthTimer = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* sessionStorage non disponibile, ignora */
      }
    }, 8000);
  }

  componentDidUpdate(prevProps) {
    // Reset automatico al cambio rotta: una schermata d'errore "vecchia"
    // non deve mai restare incollata dopo che l'utente ha navigato altrove.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, errorId: null });
    }
  }

  componentWillUnmount() {
    clearTimeout(this._healthTimer);
  }

  componentDidCatch(error, info) {
    // Chunk obsoleto → un solo reload (con throttle) per asset freschi.
    if (isChunkLoadError(error)) {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_FLAG)) || 0;
      } catch {
        /* ignora */
      }
      if (Date.now() - last > RELOAD_COOLDOWN) {
        try {
          sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
        } catch {
          /* ignora */
        }
        this.setState({ recovering: true });
        window.location.reload();
        return;
      }
    }

    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info?.componentStack);

    // Hook per logging remoto futuro (Sentry, endpoint custom, ...)
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    const { hasError, error, errorId, recovering } = this.state;

    // Stato transitorio mentre window.location.reload() si avvia.
    if (recovering) return null;

    if (!hasError) return this.props.children;

    // Fallback custom opzionale via prop.
    if (typeof this.props.fallback === "function") {
      return this.props.fallback({ error, errorId, retry: this.handleRetry });
    }

    return (
      <main className="eb-screen" role="alert" aria-live="assertive">
        <div className="eb-card">
          <span className="eb-accent-line" aria-hidden="true" />

          <div className="eb-mark" aria-hidden="true">
            <span className="eb-mark-diamond">✦</span>
          </div>

          <p className="eb-eyebrow">Beauty Room</p>
          <h1 className="eb-title">Un piccolo imprevisto</h1>
          <p className="eb-subtitle">
            Qualcosa non si è caricato come doveva. Nessun dato è andato perso&nbsp;— di solito basta ricaricare la pagina per tornare esattamente dov'eri.
          </p>

          <div className="eb-actions">
            <button type="button" className="eb-btn eb-btn--primary" onClick={() => window.location.reload()}>
              Ricarica la pagina
            </button>
            <button type="button" className="eb-btn eb-btn--ghost" onClick={() => window.location.assign("/")}>
              Torna alla home
            </button>
          </div>

          <button type="button" className="eb-retry-link" onClick={this.handleRetry}>
            Riprova senza ricaricare
          </button>

          {errorId && (
            <p className="eb-ref">
              Codice di riferimento <span>{errorId}</span>
            </p>
          )}

          {isDev && error && (
            <details className="eb-debug">
              <summary>Dettagli tecnici (solo sviluppo)</summary>
              <pre>{error.stack || error.message}</pre>
            </details>
          )}
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;

// Wrapper route-aware: resetta la boundary automaticamente a ogni
// navigazione. Va renderizzato DENTRO <BrowserRouter>.
export function RouteErrorBoundary({ children, ...rest }) {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname} {...rest}>
      {children}
    </ErrorBoundary>
  );
}
