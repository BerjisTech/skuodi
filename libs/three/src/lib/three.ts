import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vec2 } from '@kouru/geometry';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
}

export function createScene(canvas: HTMLCanvasElement, opts?: { background?: number }): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts?.background ?? 0x0f172a);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(6, 6, 6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;

  addDefaultLighting(scene);

  return { scene, camera, renderer, controls };
}

export function addDefaultLighting(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 3);
  scene.add(ambient, dir);
}

export function addGrid(scene: THREE.Scene, size = 20, divisions = 40) {
  const grid = new THREE.GridHelper(size, divisions, 0x374151, 0x1f2937);
  scene.add(grid);
  return grid;
}

export function extrudePolygon(polygon: Vec2[], height: number, material?: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  polygon.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height / 2, 0);

  const mesh = new THREE.Mesh(
    geometry,
    material ?? new THREE.MeshStandardMaterial({ color: 0x4f46e5, metalness: 0.1, roughness: 0.8 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function animate(bundle: SceneBundle, tick?: () => void) {
  const { renderer, scene, camera, controls } = bundle;
  const loop = () => {
    requestAnimationFrame(loop);
    controls.update();
    tick?.();
    renderer.render(scene, camera);
  };
  loop();
}

export function resizeRenderer(bundle: SceneBundle) {
  const { renderer, camera } = bundle;
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}
