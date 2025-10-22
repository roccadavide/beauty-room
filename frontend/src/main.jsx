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

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Provider store={store}>
      <PersistGate loading={<Loading message="Caricamento dati utente..." />} persistor={persistor}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </ErrorBoundary>
);
