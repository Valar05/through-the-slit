import * as THREE from "./three.module.min.js";

window.__THREE_MODULE__ = THREE;
window.dispatchEvent(new Event("three-engine-ready"));
