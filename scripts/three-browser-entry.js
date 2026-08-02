// Export only the renderer surface the game actually uses. Keeping this at a
// stable URL lets phones cache the expensive engine independently from the
// frequently changing game logic, while Vite still removes unused Three.js.
export {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  Fog,
  HemisphereLight,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoColorSpace,
  PerspectiveCamera,
  RepeatWrapping,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";
