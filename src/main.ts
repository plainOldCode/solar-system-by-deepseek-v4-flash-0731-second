/**
 * Entry point — pure assembly. Constructs the application on the scene root
 * element and hands control over; all real logic lives in modules under
 * src/core, src/data and src/ui.
 */
import "./styles.css";
import { App } from "./core/App";

const container = document.getElementById("scene-root");
if (!container) {
  throw new Error("Missing #scene-root mount element.");
}

void new App(container);
