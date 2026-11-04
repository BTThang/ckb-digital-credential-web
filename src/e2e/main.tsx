import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";

import App from "@/App";
import { AuthProvider } from "@/context/AuthProvider";
import { HealthProvider } from "@/context/HealthProvider";
import "@/styles.css";

import { TestWalletProvider } from "./wallet-harness";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from e2e.html");

// Hash routing keeps the test entry usable as a static file under any dev
// server path; the app's own BrowserRouter is unchanged in production.
createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <HealthProvider>
        <TestWalletProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </TestWalletProvider>
      </HealthProvider>
    </HashRouter>
  </StrictMode>,
);
