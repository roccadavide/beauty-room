import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/main.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import store, { persistor } from "./app/store.js";
import ErrorBoundary, { RouteErrorBoundary } from "./components/common/ErrorBoundary.jsx";
import Loading from "./components/common/Loading.jsx";
import { clearAccessToken } from "./utils/token.js";
import { fetchCurrentUser } from "./api/modules/users.api.js";
import { authInitialized, loginSuccess, logout } from "./features/auth/slices/auth.slice.js";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { refreshAccessToken } from "./api/httpClient.js";

const initApp = async () => {
  let initialized = false;
  try {
    // Single-flight refresh shared with the axios interceptor: prevents a boot refresh
    // and a 401-triggered refresh from firing two parallel /auth/refresh calls against
    // the same rotating cookie (which would otherwise look like a reuse attack).
    const newToken = await refreshAccessToken();
    const user = await fetchCurrentUser();
    store.dispatch(loginSuccess({ user, accessToken: newToken }));
    initialized = true;
    return;
  } catch {
    // Refresh failed (auth or network) — fall through to logged-out boot.
    // On a transient/network failure the next user action will retry via the interceptor.
  }

  clearAccessToken();
  store.dispatch(logout());
  if (!initialized) {
    store.dispatch(authInitialized());
  }
};

initApp();

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Provider store={store}>
      <PersistGate loading={<Loading message="Caricamento dati utente..." />} persistor={persistor}>
        <BrowserRouter>
          <HelmetProvider>
            <RouteErrorBoundary>
              <App />
            </RouteErrorBoundary>
            <Analytics />
            <SpeedInsights />
          </HelmetProvider>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </ErrorBoundary>,
);
