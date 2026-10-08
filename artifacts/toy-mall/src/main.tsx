import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Retire caches created by older service workers. Keep the static app shell
// and the explicit offline billing queue; only remove unscoped API responses.
if ("caches" in window) {
  void caches.delete("api-cache").catch((error) => {
    console.warn("Could not remove the legacy API cache", error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
