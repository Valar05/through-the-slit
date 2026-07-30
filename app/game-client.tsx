"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Mesh, MeshBasicMaterial, PlaneGeometry, Texture, Vector3 } from "three";

type TrackDirection = -1 | 0 | 1;

type RendererFailure = {
  heading: string;
  detail: string;
};

type GameState = {
  left: TrackDirection;
  right: TrackDirection;
  started: boolean;
  destroyed: number;
  hull: number;
  crossed: number;
};

const INITIAL_STATE: GameState = {
  left: 0,
  right: 0,
  started: false,
  destroyed: 0,
  hull: 100,
  crossed: 0,
};

function makeFallbackTexture(
  kind: "enemy" | "tree" | "wreck",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (kind === "enemy") {
    context.fillStyle = "#2b2c24";
    context.beginPath();
    context.arc(128, 74, 29, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#37382c";
    context.fillRect(89, 103, 78, 145);
    context.fillStyle = "#1b1b17";
    context.fillRect(72, 117, 24, 148);
    context.fillRect(160, 117, 24, 148);
    context.fillRect(91, 240, 29, 128);
    context.fillRect(137, 240, 29, 128);
    context.fillStyle = "#a34a2a";
    context.fillRect(120, 103, 16, 145);
  } else if (kind === "tree") {
    context.strokeStyle = "#30281f";
    context.lineCap = "round";
    context.lineWidth = 26;
    context.beginPath();
    context.moveTo(132, 374);
    context.lineTo(124, 120);
    context.stroke();
    context.lineWidth = 17;
    context.beginPath();
    context.moveTo(125, 188);
    context.lineTo(57, 89);
    context.moveTo(125, 154);
    context.lineTo(194, 61);
    context.stroke();
  } else {
    context.fillStyle = "#262824";
    context.fillRect(28, 236, 200, 92);
    context.fillStyle = "#343832";
    context.fillRect(70, 188, 113, 70);
    context.fillStyle = "#151613";
    for (let x = 46; x < 221; x += 44) {
      context.beginPath();
      context.arc(x, 332, 25, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = "#562d1d";
    context.lineWidth = 11;
    context.beginPath();
    context.moveTo(155, 193);
    context.lineTo(221, 132);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function GameClient() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState>({ ...INITIAL_STATE });
  const fireRef = useRef<() => void>(() => undefined);
  const [game, setGame] = useState(INITIAL_STATE);
  const [message, setMessage] = useState("ENGINE COLD");
  const [flash, setFlash] = useState<"fire" | "hit" | null>(null);
  const [rendererFailure, setRendererFailure] = useState<RendererFailure | null>(null);

  const patchGame = useCallback((patch: Partial<GameState>) => {
    Object.assign(gameRef.current, patch);
    setGame({ ...gameRef.current });
  }, []);

  const setTrack = useCallback((track: "left" | "right", value: TrackDirection) => {
    gameRef.current[track] = value;
    setGame({ ...gameRef.current });
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#90856d");
    scene.fog = new THREE.FogExp2("#817761", 0.018);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    camera.position.set(0, 2.2, 8);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The browser rejected the graphics context.";
      setRendererFailure({
        heading: "WEBGL BLOCKED",
        detail,
      });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Battlefield through the tank vision slit");
    mount.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);

    const groundMaterial = new THREE.MeshBasicMaterial({ color: "#504b3d" });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    world.add(ground);

    const craterMaterial = new THREE.MeshBasicMaterial({
      color: "#27261f",
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 48; i += 1) {
      const radius = 1.2 + ((i * 17) % 24) / 10;
      const crater = new THREE.Mesh(new THREE.CircleGeometry(radius, 16), craterMaterial);
      crater.rotation.x = -Math.PI / 2;
      crater.position.set(((i * 29) % 76) - 38, 0.012, 16 - i * 4.3);
      crater.scale.y = 0.58;
      world.add(crater);
    }

    const wireBelts = [-30, -68, -108, -148];
    const trenchLines = [-48, -88, -128, -174];

    const wireMaterial = new THREE.LineBasicMaterial({ color: "#191914" });
    const postMaterial = new THREE.MeshBasicMaterial({ color: "#292820" });
    wireBelts.forEach((z, beltIndex) => {
      for (let row = 0; row < 3; row += 1) {
        const rowZ = z - row * 2.2;
        const points: Vector3[] = [];
        for (let x = -48; x <= 48; x += 4) {
          const y = 0.7 + ((x + row * 3) % 8 === 0 ? 0.22 : 0);
          points.push(new THREE.Vector3(x, y, rowZ));
          if ((x + 48) % 12 === 0) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), postMaterial);
            post.position.set(x, 0.85, rowZ);
            post.rotation.z = (beltIndex % 2 ? -1 : 1) * 0.18;
            world.add(post);
          }
        }
        world.add(new THREE.Line(points, wireMaterial));
      }
    });

    const trenchMaterial = new THREE.MeshBasicMaterial({ color: "#171711" });
    const earthMaterial = new THREE.MeshBasicMaterial({ color: "#39362b" });
    trenchLines.forEach((z) => {
      const trench = new THREE.Mesh(new THREE.PlaneGeometry(110, 7), trenchMaterial);
      trench.rotation.x = -Math.PI / 2;
      trench.position.set(0, 0.02, z);
      world.add(trench);
      for (let x = -50; x <= 50; x += 5) {
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.8, 1.4), earthMaterial);
        parapet.position.set(x, 0.35, z - 3.7);
        parapet.rotation.y = ((x / 5) % 2) * 0.08;
        world.add(parapet);
      }
    });

    const textureLoader = new THREE.TextureLoader();
    const textures: Record<"enemy" | "tree" | "wreck", Texture> = {
      enemy: makeFallbackTexture("enemy"),
      tree: makeFallbackTexture("tree"),
      wreck: makeFallbackTexture("wreck"),
    };

    const tryTexture = (kind: keyof typeof textures, url: string) => {
      textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          textures[kind].dispose();
          textures[kind] = texture;
          world.children.forEach((object) => {
            if (object.userData.kind === kind) {
              (object as Mesh<PlaneGeometry, MeshBasicMaterial>).material.map =
                texture;
              (object as Mesh<PlaneGeometry, MeshBasicMaterial>).material.needsUpdate =
                true;
            }
          });
        },
        undefined,
        () => undefined,
      );
    };
    tryTexture("enemy", "/sprites/enemy.png");
    tryTexture("tree", "/sprites/tree.png");
    tryTexture("wreck", "/sprites/wreck.png");

    const billboards: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
    const enemies: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];

    const addBillboard = (
      kind: "enemy" | "tree" | "wreck",
      x: number,
      z: number,
      width: number,
      height: number,
    ) => {
      const material = new THREE.MeshBasicMaterial({
        map: textures[kind],
        transparent: true,
        alphaTest: 0.08,
        depthWrite: false,
        color: kind === "enemy" ? "#e4d6b8" : "#b5ab94",
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      mesh.position.set(x, height / 2, z);
      mesh.userData.kind = kind;
      mesh.userData.alive = true;
      world.add(mesh);
      billboards.push(mesh);
      if (kind === "enemy") enemies.push(mesh);
      return mesh;
    };

    for (let i = 0; i < 34; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      addBillboard(
        i % 5 === 0 ? "wreck" : "tree",
        side * (12 + ((i * 13) % 31)),
        2 - i * 6,
        i % 5 === 0 ? 7 : 5.2,
        i % 5 === 0 ? 4.3 : 10,
      );
    }

    trenchLines.forEach((z, line) => {
      for (let i = 0; i < 4; i += 1) {
        const enemy = addBillboard("enemy", -24 + i * 16 + (line % 2) * 5, z - 2.8, 2.2, 3.8);
        enemy.userData.line = line;
      }
    });

    let recoil = 0;
    let hitCooldown = 0;
    const raycaster = new THREE.Raycaster();

    fireRef.current = () => {
      if (!gameRef.current.started || gameRef.current.hull <= 0) return;
      recoil = 1;
      setFlash("fire");
      window.setTimeout(() => setFlash(null), 85);
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hits = raycaster.intersectObjects(enemies.filter((enemy) => enemy.userData.alive));
      const target = hits[0]?.object as Mesh | undefined;
      if (target) {
        target.userData.alive = false;
        target.visible = false;
        patchGame({ destroyed: gameRef.current.destroyed + 1 });
        setMessage("TARGET BROKEN");
      } else {
        setMessage("SHOT LOST");
      }
    };

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const keyState = new Set<string>();
    const updateKeys = () => {
      const left = keyState.has("KeyW") ? 1 : keyState.has("KeyS") ? -1 : 0;
      const right = keyState.has("ArrowUp") ? 1 : keyState.has("ArrowDown") ? -1 : 0;
      gameRef.current.left = left as TrackDirection;
      gameRef.current.right = right as TrackDirection;
    };
    const keyDown = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
      keyState.add(event.code);
      updateKeys();
      if (event.code === "Space") fireRef.current();
    };
    const keyUp = (event: KeyboardEvent) => {
      keyState.delete(event.code);
      updateKeys();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const clock = new THREE.Clock();
    let animationFrame = 0;
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const state = gameRef.current;
      let linear = ((state.left + state.right) / 2) * 7.2;
      const angular = (state.left - state.right) * 0.72;

      if (state.started && state.hull > 0) {
        const wireDrag = wireBelts.some((z) => Math.abs(camera.position.z - z) < 3.5);
        const trenchPitch = trenchLines.find((z) => Math.abs(camera.position.z - z) < 5);
        if (wireDrag) {
          linear *= 0.32;
          setMessage("WIRE UNDER TRACK");
        }
        camera.rotation.y += angular * delta;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(forward, linear * delta);
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -60, 60);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -195, 22);

        const crossed = trenchLines.filter((z) => camera.position.z < z).length;
        if (crossed !== state.crossed) {
          patchGame({ crossed });
          setMessage(crossed < 4 ? `LINE ${crossed} OVERRUN` : "DEFENSE BREACHED");
        }

        const activeDefenders = enemies.filter((enemy) => {
          if (!enemy.userData.alive) return false;
          const distance = enemy.position.distanceTo(camera.position);
          return distance < 38 && enemy.position.z < camera.position.z + 8;
        });
        if (activeDefenders.length > 0 && hitCooldown <= 0) {
          hitCooldown = Math.max(0.85, 2.5 - activeDefenders.length * 0.14);
          const hull = Math.max(0, state.hull - Math.min(14, 4 + activeDefenders.length));
          patchGame({ hull });
          setFlash("hit");
          setMessage(hull > 0 ? "DEFENSIVE FIRE" : "LANDSHIP SILENT");
          window.setTimeout(() => setFlash(null), 150);
        }

        camera.rotation.x = trenchPitch
          ? Math.sin((camera.position.z - trenchPitch) * 0.7) * 0.055
          : THREE.MathUtils.lerp(camera.rotation.x, 0, 0.12);
      }

      hitCooldown -= delta;
      recoil = Math.max(0, recoil - delta * 5.8);
      camera.position.y = 2.2 + Math.sin(clock.elapsedTime * 7) * Math.abs(linear) * 0.003;
      camera.rotation.z = Math.sin(clock.elapsedTime * 11) * Math.abs(linear) * 0.0007 + recoil * 0.012;

      for (const billboard of billboards) {
        billboard.rotation.y = Math.atan2(
          camera.position.x - billboard.position.x,
          camera.position.z - billboard.position.z,
        );
      }

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      renderer.dispose();
      world.traverse((object) => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
      Object.values(textures).forEach((texture) => texture.dispose());
      mount.removeChild(renderer.domElement);
    };
  }, [patchGame]);

  const begin = () => {
    patchGame({ started: true });
    setMessage("ROAD OPEN");
  };

  const reset = () => {
    window.location.reload();
  };

  const controlHandlers = (track: "left" | "right", value: TrackDirection) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setTrack(track, value);
    },
    onPointerUp: () => setTrack(track, 0),
    onPointerCancel: () => setTrack(track, 0),
    onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.buttons === 0) setTrack(track, 0);
    },
  });

  return (
    <main className={`game-shell ${flash ? `flash-${flash}` : ""}`}>
      <div ref={mountRef} className="battlefield" />

      <div className="armor armor-top" aria-hidden="true">
          <div className="serial">LANDSHIP // OBSERVATION PORT</div>
        <div className="bolt bolt-a" />
        <div className="bolt bolt-b" />
      </div>
      <div className="armor armor-bottom" aria-hidden="true">
        <div className="bolt bolt-c" />
        <div className="bolt bolt-d" />
      </div>
      <div className="slit-edge slit-edge-top" aria-hidden="true" />
      <div className="slit-edge slit-edge-bottom" aria-hidden="true" />

      <header className="hud" aria-live="polite">
        <div>
          <span className="hud-label">HULL</span>
          <strong>{game.hull}</strong>
        </div>
        <button className="sight" onClick={() => fireRef.current()} aria-label="Fire main gun">
          <span />
        </button>
        <div>
          <span className="hud-label">LINE</span>
          <strong>{Math.min(game.crossed + 1, 4)} / 4</strong>
        </div>
      </header>

      <p className="status-message">{message}</p>

      <section className="track-controls" aria-label="Independent tank track controls">
        <div className="track-stack">
          <span className="track-name">LEFT</span>
          <button
            className={`track-button ${game.left === 1 ? "active" : ""}`}
            {...controlHandlers("left", 1)}
            aria-label="Left track forward"
          >
            ▲
          </button>
          <button
            className={`track-button reverse ${game.left === -1 ? "active" : ""}`}
            {...controlHandlers("left", -1)}
            aria-label="Left track reverse"
          >
            ▼
          </button>
        </div>
        <button className="fire-button" onPointerDown={() => fireRef.current()} aria-label="Fire">
          FIRE
        </button>
        <div className="track-stack">
          <span className="track-name">RIGHT</span>
          <button
            className={`track-button ${game.right === 1 ? "active" : ""}`}
            {...controlHandlers("right", 1)}
            aria-label="Right track forward"
          >
            ▲
          </button>
          <button
            className={`track-button reverse ${game.right === -1 ? "active" : ""}`}
            {...controlHandlers("right", -1)}
            aria-label="Right track reverse"
          >
            ▼
          </button>
        </div>
      </section>

      {!game.started && (
        <section className="briefing" role="dialog" aria-modal="true" aria-labelledby="game-title">
          <p className="eyebrow">BEFORE IT HAD A NAME.</p>
          <h1 id="game-title">THROUGH<br />THE SLIT</h1>
          <p>Cross no man&apos;s land. Break the wire. Climb the trenches. Defeat the defense in depth.</p>
          <button onClick={begin}>ENTER THE ARMOR</button>
          <small>DESKTOP: W/S + ↑/↓ · SPACE FIRES</small>
        </section>
      )}

      {game.hull <= 0 && (
        <section className="briefing destroyed" role="dialog" aria-modal="true">
          <p className="eyebrow">FINAL REPORT</p>
          <h2>THE SLIT<br />WENT DARK</h2>
          <p>{game.crossed} defensive lines crossed before silence.</p>
          <button onClick={reset}>LIGHT THE ENGINE</button>
        </section>
      )}

      {game.hull > 0 && game.crossed >= 4 && (
        <section className="briefing victory" role="dialog" aria-modal="true">
          <p className="eyebrow">FINAL DEFENSIVE BELT OVERRUN</p>
          <h2>THE LINE<br />IS BEHIND YOU</h2>
          <p>No map called that crossing possible. The machine crossed it anyway.</p>
          <button onClick={reset}>CROSS AGAIN</button>
        </section>
      )}

      {rendererFailure && (
        <section className="briefing renderer-failed" role="alert">
          <p className="eyebrow">OBSERVATION PORT BLOCKED</p>
          <h2>{rendererFailure.heading}</h2>
          <p>{rendererFailure.detail}</p>
        </section>
      )}
    </main>
  );
}
