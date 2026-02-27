import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/main.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import store, { persistor } from "./app/store.js";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import Loading from "./components/common/Loading.jsx";
import { setAccessToken, clearAccessToken } from "./utils/token.js";
import { fetchCurrentUser } from "./api/modules/users.api.js";
import { authInitialized, loginSuccess, logout } from "./features/auth/slices/auth.slice.js";
import { HelmetProvider } from "react-helmet-async";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const initApp = async () => {
  let initialized = false;
  try {
    const res = await axios.post(`${API_BASE}/auth/refresh`, null, {
      withCredentials: true,
      timeout: 10000,
    });
    const newToken = res.data?.accessToken;
    if (newToken) {
      setAccessToken(newToken);
      const user = await fetchCurrentUser();
      store.dispatch(loginSuccess({ user, accessToken: newToken }));
      initialized = true;
      return;
    }
  } catch {
    // ignore, user stays logged out
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
            <App />
          </HelmetProvider>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </ErrorBoundary>
);
