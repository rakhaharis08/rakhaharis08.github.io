import * as THREE from 'https://unpkg.com/three@0.160.1/build/three.module.js';
import { MTLLoader } from 'https://unpkg.com/three@0.160.1/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'https://unpkg.com/three@0.160.1/examples/jsm/loaders/OBJLoader.js';

const canvas = document.querySelector('#space-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02060d, 0.026);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(0, 0, 1.2);
const cockpit = new THREE.Group();
const deepSpace = new THREE.Group();
const effects = new THREE.Group();
scene.add(deepSpace, cockpit, effects);

const cyan = new THREE.Color(0x67f3ee);
const cyanDim = new THREE.Color(0x225f6d);
const hotPink = new THREE.Color(0xff84c0);
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x111c31, roughness: 0.33, metalness: 0.92 });
const gunMetal = new THREE.MeshStandardMaterial({ color: 0x20355a, roughness: 0.23, metalness: 0.87 });
const wallMetal = new THREE.MeshStandardMaterial({ color: 0x07101f, roughness: 0.44, metalness: 0.79 });
const cyanGlow = new THREE.MeshBasicMaterial({ color: cyan });
const pinkGlow = new THREE.MeshBasicMaterial({ color: hotPink });
const dynamicEffects = [];
const asteroids = [];
const asteroidAssetPath = './3D%20ASTEROID/asteroid_assets_obj/';
const asteroidAssets = [
  { id: '01', obj: 'asteroid_01_pitted.obj', mtl: 'asteroid_01_pitted.mtl' },
  { id: '02', obj: 'asteroid_02_elongated.obj', mtl: 'asteroid_02_elongated.mtl' },
  { id: '03', obj: 'asteroid_03_jagged.obj', mtl: 'asteroid_03_jagged.mtl' },
  { id: '04', obj: 'asteroid_04_major_crater.obj', mtl: 'asteroid_04_major_crater.mtl' },
  { id: '05', obj: 'asteroid_05_rubble.obj', mtl: 'asteroid_05_rubble.mtl' }
];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cursor = new THREE.Vector2();
const clock = new THREE.Clock();
let hoveredAsteroid = null;
let hitCount = 0;

function addMesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = new THREE.Mesh(geometry, material);
  node.position.set(...position);
  node.rotation.set(...rotation);
  parent.add(node);
  return node;
}

function box(parent, size, material, position, rotation) {
  return addMesh(parent, new THREE.BoxGeometry(...size), material, position, rotation);
}

function seededRandom(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// Procedural asset: the complete close-range cockpit structure and instrument deck.
function createCockpit() {
  const frame = new THREE.Group();
  cockpit.add(frame);

  // Window frame - deliberately close to the camera to give an interior, first-person scale.
  box(frame, [15.6, .38, .52], darkMetal, [0, 4.4, -7.4]);
  box(frame, [15.6, .43, .52], darkMetal, [0, -4.2, -7.4]);
  [-6.45, 6.45].forEach(x => {
    const strut = box(frame, [.42, 9.5, .5], darkMetal, [x, .05, -7.45]);
    strut.rotation.z = x < 0 ? -.11 : .11;
  });
  [-7.12, 7.12].forEach(x => {
    box(frame, [.62, 11, 5.7], wallMetal, [x, 0, -4.6], [0, 0, x < 0 ? -.08 : .08]);
    box(frame, [.12, 9.3, .1], gunMetal, [x * .92, .1, -5.65], [0, 0, x < 0 ? -.12 : .12]);
  });
  box(frame, [15.2, .5, 5.2], wallMetal, [0, 5.2, -3.8]);
  box(frame, [15.4, .45, 6.5], wallMetal, [0, -5.05, -3.25], [-.12, 0, 0]);

  // Repeating cyan window indicators.
  for (let i = 0; i < 17; i++) {
    const x = -5.6 + i * .7;
    const color = i % 6 === 0 ? pinkGlow : cyanGlow;
    addMesh(frame, new THREE.BoxGeometry(.16, .04, .05), color, [x, 3.95, -7.06]);
    addMesh(frame, new THREE.BoxGeometry(.16, .04, .05), color, [x, -3.8, -7.06]);
  }

  const dashboard = new THREE.Group();
  dashboard.position.set(0, -4.4, -1.35);
  dashboard.rotation.x = -.38;
  cockpit.add(dashboard);
  box(dashboard, [12.4, .5, 4.7], wallMetal, [0, 0, 0]);
  box(dashboard, [11.6, .12, 3.9], gunMetal, [0, .29, -.1]);
  [-4, 0, 4].forEach((x, screenIndex) => {
    const display = addMesh(dashboard, new THREE.BoxGeometry(3.1, .05, 1.45), new THREE.MeshBasicMaterial({ color: screenIndex === 1 ? 0x16485a : 0x102654 }), [x, .4, -.15]);
    for (let line = 0; line < 4; line++) {
      addMesh(dashboard, new THREE.BoxGeometry(1.95 - line * .25, .06, .03), new THREE.MeshBasicMaterial({ color: line === 0 ? 0x67f3ee : 0x386b9d }), [x - .25, .43, -.6 + line * .25]);
    }
    addMesh(dashboard, new THREE.BoxGeometry(.9, .06, .03), pinkGlow, [x + .62, .43, .55]);
  });
  for (let i = 0; i < 18; i++) {
    const x = -5.2 + (i % 9) * 1.3;
    const z = 1.42 + Math.floor(i / 9) * .43;
    addMesh(dashboard, new THREE.CylinderGeometry(.07, .07, .08, 12), i % 5 === 0 ? pinkGlow : cyanGlow, [x, .38, z]);
  }

  // Two weapon controls sit in the foreground; their laser starts from the same points.
  [-1, 1].forEach(direction => {
    const mount = new THREE.Group();
    mount.position.set(direction * 4.65, -3.7, -.4);
    mount.rotation.set(-.25, direction * -.18, direction * .08);
    cockpit.add(mount);
    addMesh(mount, new THREE.CylinderGeometry(.26, .36, 1.55, 12), gunMetal, [0, 0, 0], [Math.PI / 2, 0, 0]);
    addMesh(mount, new THREE.CylinderGeometry(.14, .17, 1.48, 12), darkMetal, [0, 0, -.5], [Math.PI / 2, 0, 0]);
    addMesh(mount, new THREE.SphereGeometry(.13, 16, 16), cyanGlow, [0, 0, -.95]);
  });
  return { frame, dashboard };
}

function createStars() {
  const random = seededRandom(822);
  const amount = 1950;
  const positions = new Float32Array(amount * 3);
  const colors = new Float32Array(amount * 3);
  for (let i = 0; i < amount; i++) {
    positions[i * 3] = (random() - .5) * 100;
    positions[i * 3 + 1] = (random() - .5) * 62;
    positions[i * 3 + 2] = -8 - random() * 115;
    const tone = random();
    colors.set(tone > .9 ? [1, .53, .75] : tone > .6 ? [.34, .95, 1] : [.62, .73, 1], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const starfield = new THREE.Points(geo, new THREE.PointsMaterial({ size: .09, transparent: true, opacity: .93, sizeAttenuation: true, vertexColors: true }));
  deepSpace.add(starfield);
  return starfield;
}

function createPlanet() {
  const planet = new THREE.Group();
  const core = addMesh(planet, new THREE.SphereGeometry(7.4, 52, 52), new THREE.MeshStandardMaterial({ color: 0x24345f, roughness: .9, metalness: .06 }));
  core.scale.set(1, .93, 1);
  const atmosphere = addMesh(planet, new THREE.SphereGeometry(7.66, 48, 48), new THREE.MeshBasicMaterial({ color: 0x5f84ff, transparent: true, opacity: .18, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
  atmosphere.scale.set(1, .93, 1);
  const ring = addMesh(planet, new THREE.TorusGeometry(10.3, .075, 8, 110), new THREE.MeshBasicMaterial({ color: 0x879cff, transparent: true, opacity: .48 }));
  ring.rotation.set(1.24, -.28, -.18);
  planet.position.set(8.1, 3.6, -35);
  deepSpace.add(planet);
  return planet;
}

function createSatellite() {
  const satellite = new THREE.Group();
  addMesh(satellite, new THREE.BoxGeometry(.66, .45, .72), gunMetal);
  addMesh(satellite, new THREE.CylinderGeometry(.17, .17, .8, 12), darkMetal, [0, .48, 0], [0, 0, Math.PI / 2]);
  [-1, 1].forEach(side => {
    addMesh(satellite, new THREE.BoxGeometry(.72, .08, .07), darkMetal, [side * .72, 0, 0]);
    addMesh(satellite, new THREE.BoxGeometry(.9, .05, .52), new THREE.MeshStandardMaterial({ color: 0x123c77, roughness: .25, metalness: .72, emissive: 0x071a44 }), [side * 1.53, 0, 0]);
  });
  addMesh(satellite, new THREE.SphereGeometry(.1, 12, 12), cyanGlow, [0, 0, .46]);
  satellite.position.set(-4.65, 2.9, -13.7);
  satellite.rotation.set(.3, -.8, .1);
  deepSpace.add(satellite);
  return satellite;
}

function setAsteroidScale(asteroid, factor) {
  asteroid.scale.copy(asteroid.userData.modelScale).multiplyScalar(factor);
}

function resetAsteroid(asteroid, immediate = false) {
  const random = Math.random;
  asteroid.position.set((random() - .5) * 11, (random() - .45) * 6.4, -10 - random() * 13);
  asteroid.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
  asteroid.userData.velocity.set((random() - .5) * .035, (random() - .5) * .025, .035 + random() * .07);
  asteroid.userData.spin.set((random() - .5) * .011, (random() - .5) * .013, (random() - .5) * .009);
  asteroid.userData.baseScale = .42 + random() * .72;
  setAsteroidScale(asteroid, immediate ? asteroid.userData.baseScale : .02);
  asteroid.visible = true;
  asteroid.userData.alive = true;
  asteroid.userData.spawning = immediate ? 1 : 0;
}

function loadMtl(filename) {
  return new Promise((resolve, reject) => {
    new MTLLoader().setPath(asteroidAssetPath).load(filename, resolve, undefined, reject);
  });
}

function loadObj(filename, materials) {
  return new Promise((resolve, reject) => {
    new OBJLoader().setPath(asteroidAssetPath).setMaterials(materials).load(filename, resolve, undefined, reject);
  });
}

async function createAsteroid(asset) {
  const materials = await loadMtl(asset.mtl);
  materials.preload();
  const asteroid = await loadObj(asset.obj, materials);
  const bounds = new THREE.Box3().setFromObject(asteroid);
  const modelSize = bounds.getSize(new THREE.Vector3());
  const normalizeScale = 2 / Math.max(modelSize.x, modelSize.y, modelSize.z);

  asteroid.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.asteroidRoot = asteroid;
  });
  asteroid.userData = {
    asteroid: true,
    id: asset.id,
    alive: true,
    spawning: 1,
    baseScale: .6,
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    modelScale: new THREE.Vector3(normalizeScale, normalizeScale, normalizeScale)
  };
  resetAsteroid(asteroid, true);
  deepSpace.add(asteroid);
  asteroids.push(asteroid);
}

// Five supplied OBJ models retain their distinct cratered and rocky silhouettes.
async function createAsteroidField() {
  const results = await Promise.allSettled(asteroidAssets.map(createAsteroid));
  const failed = results.filter(result => result.status === 'rejected').length;
  if (failed) console.error(`Unable to load ${failed} asteroid model(s).`);
  announce(failed ? 'ASTEROID SCAN // PARTIAL MODEL LOAD' : 'TARGETING SYSTEM ONLINE // 5 ASTEROIDS IN RANGE');
}

const cockpitParts = createCockpit();
const stars = createStars();
const planet = createPlanet();
const satellite = createSatellite();
void createAsteroidField();

scene.add(new THREE.HemisphereLight(0xc7e4ff, 0x01040a, 1.55));
const asteroidLight = new THREE.DirectionalLight(0xffffff, 2.65); asteroidLight.position.set(-4, 7, 6); scene.add(asteroidLight);
const cabinLight = new THREE.PointLight(0x61efe8, 20, 22, 2); cabinLight.position.set(-3, 2.5, 2); scene.add(cabinLight);
const purpleLight = new THREE.PointLight(0x8e6bff, 18, 26, 2); purpleLight.position.set(6, -1, 0); scene.add(purpleLight);
const warningLight = new THREE.PointLight(0xff78af, 9, 16, 2); warningLight.position.set(-5, -2, -3); scene.add(warningLight);

const toast = document.querySelector('#target-toast');
const targetName = document.querySelector('#target-name');
const targetDistance = document.querySelector('#target-distance');
const hitCounter = document.querySelector('#hit-count');
const crosshair = document.querySelector('#crosshair');
let toastTimeout;
function announce(message) {
  toast.textContent = message;
  toast.classList.add('active');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('active'), 1700);
}

function pointFromScreen(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function findAsteroid(clientX, clientY) {
  pointFromScreen(clientX, clientY);
  const targets = asteroids.filter(asteroid => asteroid.userData.alive);
  const directHit = raycaster.intersectObjects(targets, true)[0];
  if (directHit) return { ...directHit, object: directHit.object.userData.asteroidRoot };

  // Add a small targeting-assist radius so a visible low-poly rock remains
  // easy to hit even when its jagged silhouette leaves narrow gaps.
  camera.updateMatrixWorld();
  let assistedTarget = null;
  let nearestDistance = .2;
  const projected = new THREE.Vector3();
  targets.forEach(asteroid => {
    asteroid.getWorldPosition(projected).project(camera);
    const distance = Math.hypot(projected.x - pointer.x, projected.y - pointer.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      assistedTarget = asteroid;
    }
  });
  return assistedTarget ? { object: assistedTarget } : undefined;
}

function createLaser(target) {
  const origin = new THREE.Vector3(0, -2.8, -.7);
  const end = target.getWorldPosition(new THREE.Vector3());
  const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const beam = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x96ffff, transparent: true, opacity: 1 }));
  effects.add(beam);
  dynamicEffects.push({ type: 'beam', node: beam, life: .15, maxLife: .15 });
}

function createExplosion(asteroid) {
  const point = asteroid.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 12; i++) {
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(.11 + Math.random() * .12), new THREE.MeshBasicMaterial({ color: i % 3 ? cyan : hotPink, transparent: true }));
    shard.position.copy(point);
    shard.userData.velocity = new THREE.Vector3((Math.random() - .5) * .22, (Math.random() - .5) * .22, (Math.random() - .5) * .18);
    effects.add(shard);
    dynamicEffects.push({ type: 'shard', node: shard, life: .65 + Math.random() * .25, maxLife: .85 });
  }
}

function destroyAsteroid(asteroid) {
  if (!asteroid?.userData.alive) return;
  asteroid.userData.alive = false;
  asteroid.visible = false;
  createLaser(asteroid);
  createExplosion(asteroid);
  document.querySelector('#impact-flash').classList.remove('fire');
  requestAnimationFrame(() => document.querySelector('#impact-flash').classList.add('fire'));
  hitCount += 1;
  hitCounter.textContent = String(hitCount).padStart(3, '0');
  targetName.textContent = `ASTEROID-${asteroid.userData.id} // DESTROYED`;
  targetDistance.textContent = 'FIELD WILL REFORM IN 3 SECONDS';
  announce(`DIRECT HIT // ASTEROID-${asteroid.userData.id} VAPORIZED`);
  setTimeout(() => {
    resetAsteroid(asteroid);
    announce(`INCOMING // ASTEROID-${asteroid.userData.id} RE-ENTERED FIELD`);
  }, 2500 + Math.random() * 1700);
}

function shootAt(clientX, clientY, central = false) {
  const impact = hoveredAsteroid?.userData.alive ? { object: hoveredAsteroid } : findAsteroid(clientX, clientY);
  if (impact?.object) {
    destroyAsteroid(impact.object);
  } else if (central) {
    const nearest = asteroids.filter(asteroid => asteroid.userData.alive).sort((a, b) => a.position.z - b.position.z)[0];
    if (nearest) destroyAsteroid(nearest);
  } else {
    announce('NO LOCK // MOVE RETICLE OVER AN ASTEROID');
  }
}

window.addEventListener('pointermove', event => {
  cursor.set(event.clientX / window.innerWidth - .5, event.clientY / window.innerHeight - .5);
  crosshair.style.left = `${event.clientX}px`;
  crosshair.style.top = `${event.clientY}px`;
  const hit = findAsteroid(event.clientX, event.clientY);
  hoveredAsteroid = hit?.object || null;
  crosshair.classList.toggle('locked', Boolean(hoveredAsteroid));
  if (hoveredAsteroid) {
    targetName.textContent = `LOCKED // ASTEROID-${hoveredAsteroid.userData.id}`;
    targetDistance.textContent = `RANGE: ${Math.round(Math.abs(hoveredAsteroid.position.z) * 93)} KM`;
  } else if (!document.querySelector('.target-toast.active')) {
    targetName.textContent = 'ASTEROID FIELD';
    targetDistance.textContent = 'SCANNING: CLICK A ROCK';
  }
});
window.addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.target.closest('a, button')) return;
  shootAt(event.clientX, event.clientY);
});
document.querySelector('#fire-button').addEventListener('click', () => shootAt(window.innerWidth / 2, window.innerHeight / 2, true));

const navigationLinks = document.querySelectorAll('a[href^="#"]');
let navigationFrame;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function easeInOutCubic(progress) {
  return progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

navigationLinks.forEach(link => link.addEventListener('click', event => {
  const target = document.querySelector(link.getAttribute('href'));
  if (!target) return;

  event.preventDefault();
  const headerHeight = document.querySelector('.command-bar').offsetHeight;
  const destination = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerHeight - 8);
  const origin = window.scrollY;
  const distance = destination - origin;
  if (Math.abs(distance) < 2) return;

  cancelAnimationFrame(navigationFrame);
  document.body.dataset.navDirection = distance > 0 ? 'down' : 'up';
  if (prefersReducedMotion.matches) {
    window.scrollTo(0, destination);
    delete document.body.dataset.navDirection;
    history.pushState(null, '', link.getAttribute('href'));
    return;
  }

  const duration = Math.min(960, Math.max(460, Math.abs(distance) * .34));
  let startedAt;
  const slide = timestamp => {
    startedAt ||= timestamp;
    const progress = Math.min(1, (timestamp - startedAt) / duration);
    window.scrollTo(0, origin + distance * easeInOutCubic(progress));
    if (progress < 1) {
      navigationFrame = requestAnimationFrame(slide);
      return;
    }
    delete document.body.dataset.navDirection;
    history.pushState(null, '', link.getAttribute('href'));
  };
  navigationFrame = requestAnimationFrame(slide);
}));

document.querySelectorAll('.reveal').forEach(element => {
  new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }), { threshold: .13 }).observe(element);
});

let audioContext;
let hum;
let soundOn = false;
document.querySelector('#sound-toggle').addEventListener('click', () => {
  const button = document.querySelector('#sound-toggle');
  soundOn = !soundOn;
  button.classList.toggle('active', soundOn);
  button.setAttribute('aria-pressed', String(soundOn));
  button.lastChild.textContent = soundOn ? ' HUM: ON' : ' HUM: OFF';
  if (soundOn) {
    audioContext ||= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    if (!hum) {
      const oscillator = audioContext.createOscillator();
      const tremolo = audioContext.createOscillator();
      hum = audioContext.createGain();
      const tremoloGain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 48;
      tremolo.type = 'sine'; tremolo.frequency.value = .32;
      hum.gain.value = .014; tremoloGain.gain.value = .004;
      tremolo.connect(tremoloGain).connect(hum.gain);
      oscillator.connect(hum).connect(audioContext.destination);
      oscillator.start(); tremolo.start();
    }
    hum.gain.setTargetAtTime(.014, audioContext.currentTime, .2);
  } else if (hum) {
    hum.gain.setTargetAtTime(0, audioContext.currentTime, .15);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animateEffects(delta) {
  for (let i = dynamicEffects.length - 1; i >= 0; i--) {
    const effect = dynamicEffects[i];
    effect.life -= delta;
    if (effect.type === 'beam') {
      effect.node.material.opacity = Math.max(0, effect.life / effect.maxLife);
    } else {
      effect.node.position.addScaledVector(effect.node.userData.velocity, delta * 60);
      effect.node.scale.multiplyScalar(.98);
      effect.node.material.opacity = Math.max(0, effect.life / effect.maxLife);
    }
    if (effect.life <= 0) {
      effects.remove(effect.node);
      effect.node.geometry.dispose();
      effect.node.material.dispose();
      dynamicEffects.splice(i, 1);
    }
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), .045);
  const time = clock.getElapsedTime();
  const scrollProgress = window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1);
  camera.position.x += (cursor.x * .58 - camera.position.x) * .045;
  camera.position.y += (-cursor.y * .32 - camera.position.y) * .045;
  camera.rotation.y += (-cursor.x * .024 - camera.rotation.y) * .05;
  camera.rotation.x += (-cursor.y * .018 - camera.rotation.x) * .05;
  cockpit.rotation.y += (-cursor.x * .035 - cockpit.rotation.y) * .035;
  cockpit.position.y = Math.sin(time * .5) * .024 - scrollProgress * .08;
  cockpitParts.dashboard.position.y = -4.4 + Math.sin(time * 1.1) * .025;
  deepSpace.rotation.y += (-cursor.x * .03 - deepSpace.rotation.y) * .01;
  deepSpace.position.y = scrollProgress * .22;
  stars.rotation.z = time * .0012;
  planet.rotation.y = time * .018;
  planet.position.y = 3.6 + Math.sin(time * .17) * .42;
  satellite.rotation.y += delta * .35;
  satellite.rotation.z = .1 + Math.sin(time * .7) * .17;
  satellite.position.y = 2.9 + Math.sin(time * .55) * .3;

  asteroids.forEach(asteroid => {
    if (!asteroid.userData.alive) return;
    asteroid.position.addScaledVector(asteroid.userData.velocity, delta * 60);
    asteroid.rotation.x += asteroid.userData.spin.x;
    asteroid.rotation.y += asteroid.userData.spin.y;
    asteroid.rotation.z += asteroid.userData.spin.z;
    if (asteroid.userData.spawning < 1) {
      asteroid.userData.spawning += delta * 1.55;
      setAsteroidScale(asteroid, asteroid.userData.baseScale * Math.min(1, asteroid.userData.spawning));
    }
    if (asteroid.position.z > -6.3 || Math.abs(asteroid.position.x) > 8) resetAsteroid(asteroid, true);
  });
  animateEffects(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

announce('TARGETING SYSTEM ONLINE // ASTEROIDS IN RANGE');
animate();
