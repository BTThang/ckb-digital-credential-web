import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import { AuthProvider } from "@/context/AuthProvider";
import { ConnectorProvider } from "@/context/ConnectorProvider";
import { HealthProvider } from "@/context/HealthProvider";
import { WalletProvider } from "@/context/WalletProvider";
import "@/styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ConnectorProvider>
        <HealthProvider>
          <WalletProvider>
            {/* Inside WalletProvider: sign-in needs the connected signer. */}
            <AuthProvider>
              <App />
            </AuthProvider>
          </WalletProvider>
        </HealthProvider>
      </ConnectorProvider>
    </BrowserRouter>
  </StrictMode>,
);
