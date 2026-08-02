import * as THREE from "./engine-v10.js";

window.__THREE_MODULE__ = THREE;
window.dispatchEvent(new Event("three-engine-ready"));
