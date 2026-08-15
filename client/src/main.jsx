import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { UIProvider } from "./components/ui.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { init, setUser } from "./offline/engine.js";
import { getPersistedUser } from "./auth/secureStore.js";
import { isDesktopApp } from "./utils/platform.js";
import "./offline/idb.js"; // Force include idb module
import "./index.css";

const Router = isDesktopApp() ? HashRouter : BrowserRouter;

async function bootstrap() {
  const persistedUser = await getPersistedUser();
  if (persistedUser) {
    setUser(persistedUser);
  }
  init();
}

bootstrap();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router future={{ v7_startTransition: true, v7_relative_splat_path: true }}>
      <ThemeProvider>
        <UIProvider>
          <AuthProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AuthProvider>
        </UIProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>
);
