import * as THREE from "three";

window.__THREE_MODULE__ = THREE;
window.dispatchEvent(new Event("three-engine-ready"));
