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
import { getToken, hasValidToken } from "./utils/token.js";
import { fetchCurrentUser } from "./api/modules/users.api.js";
import { loginSuccess, logout } from "./features/auth/slices/auth.slice.js";
import { HelmetProvider } from "react-helmet-async";

const initApp = async () => {
  const token = getToken();

  if (hasValidToken()) {
    try {
      const user = await fetchCurrentUser(token);
      store.dispatch(loginSuccess({ user, token }));
    } catch (err) {
      console.warn("Token scaduto o utente non valido:", err);
      store.dispatch(logout());
    }
  } else {
    store.dispatch(logout());
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
