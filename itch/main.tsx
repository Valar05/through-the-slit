import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import BrowserShell from "../app/browser-shell";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Through the Slit could not find its browser mount.");
}

createRoot(root).render(
  <StrictMode>
    <BrowserShell />
  </StrictMode>,
);
