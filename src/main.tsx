import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/notifications";

// Environment detection
const hostname = window.location.hostname;
const isRestricted = 
  hostname.includes("id-preview--") || 
  hostname.includes("lovableproject.com") || 
  hostname.includes("lovable.dev") ||
  window.self !== window.top;

if (!isRestricted) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);