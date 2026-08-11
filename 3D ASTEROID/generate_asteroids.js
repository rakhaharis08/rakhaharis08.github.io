import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'asteroid_assets_obj');
fs.mkdirSync(outputDir, { recursive: true });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = value => value - Math.floor(value);
const hash3 = (x, y, z, seed) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453123);
const lerp = (a, b, t) => a + (b - a) * t;

function valueNoise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const sample = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, seed) * 2 - 1;
  const x00 = lerp(sample(0, 0, 0), sample(1, 0, 0), ux);
  const x10 = lerp(sample(0, 1, 0), sample(1, 1, 0), ux);
  const x01 = lerp(sample(0, 0, 1), sample(1, 0, 1), ux);
  const x11 = lerp(sample(0, 1, 1), sample(1, 1, 1), ux);
  return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
}

function fbm(x, y, z, seed, octaves) {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += amplitude * valueNoise3(x * frequency, y * frequency, z * frequency, seed + octave * 13);
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return total / weight;
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCraters(settings) {
  const random = seededRandom(settings.seed * 401);
  const craters = [...(settings.featureCraters || [])];
  for (let index = 0; index < settings.craterCount; index += 1) {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - z * z);
    const size = settings.minCrater + (settings.maxCrater - settings.minCrater) * Math.pow(random(), 1.7);
    craters.push({
      direction: [radius * Math.cos(angle), z, radius * Math.sin(angle)],
      size,
      depth: size * (0.30 + random() * 0.22),
      rim: size * (0.065 + random() * 0.055),
      eccentricity: 0.78 + random() * 0.30,
      rotation: random() * Math.PI * 2,
    });
  }
  return craters;
}

function craterDisplacement(direction, crater, seed) {
  const dot = clamp(direction[0] * crater.direction[0] + direction[1] * crater.direction[1] + direction[2] * crater.direction[2], -1, 1);
  const angularDistance = Math.acos(dot);
  const limit = crater.size * 1.48;
  if (angularDistance > limit) return 0;

  const tangent = normalize([
    direction[0] - dot * crater.direction[0],
    direction[1] - dot * crater.direction[1],
    direction[2] - dot * crater.direction[2],
  ]);
  const reference = Math.abs(crater.direction[1]) < 0.9 ? normalize([crater.direction[2], 0, -crater.direction[0]]) : [1, 0, 0];
  const bitangent = normalize([
    crater.direction[1] * reference[2] - crater.direction[2] * reference[1],
    crater.direction[2] * reference[0] - crater.direction[0] * reference[2],
    crater.direction[0] * reference[1] - crater.direction[1] * reference[0],
  ]);
  const localAngle = Math.atan2(tangent[0] * bitangent[0] + tangent[1] * bitangent[1] + tangent[2] * bitangent[2], tangent[0] * reference[0] + tangent[1] * reference[1] + tangent[2] * reference[2]);
  const ellipse = 1 + (crater.eccentricity - 1) * Math.cos(2 * (localAngle - crater.rotation));
  const normalizedDistance = angularDistance / (crater.size * ellipse);
  const edge = smoothstep(1.2, 0.94, normalizedDistance);
  const bowl = -crater.depth * Math.pow(clamp(1 - normalizedDistance * normalizedDistance, 0, 1), 1.55) * edge;
  const rim = crater.rim * Math.exp(-Math.pow((normalizedDistance - 1.03) / 0.17, 2));
  const brokenRim = 0.7 + 0.3 * fbm(direction[0] * 11, direction[1] * 11, direction[2] * 11, seed + 89, 2);
  return bowl + rim * brokenRim;
}

function makeRock(settings) {
  const lonSegments = 160;
  const latSegments = 112;
  const vertices = [];
  const craters = makeCraters(settings);
  const random = seededRandom(settings.seed * 91);
  const boulders = [];
  for (let i = 0; i < settings.boulderCount; i += 1) {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const q = Math.sqrt(1 - z * z);
    boulders.push({
      direction: [q * Math.cos(a), z, q * Math.sin(a)],
      width: settings.boulderWidth * (0.6 + random() * 1.1),
      height: settings.boulderHeight * (0.55 + random() * 1.15),
    });
  }

  for (let lat = 0; lat <= latSegments; lat += 1) {
    const v = lat / latSegments;
    const phi = v * Math.PI;
    for (let lon = 0; lon <= lonSegments; lon += 1) {
      const u = lon / lonSegments;
      const theta = u * Math.PI * 2;
      const direction = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
      const broad = fbm(direction[0] * 1.35, direction[1] * 1.35, direction[2] * 1.35, settings.seed, 3) * settings.broadNoise;
      const medium = fbm(direction[0] * 4.8, direction[1] * 4.8, direction[2] * 4.8, settings.seed + 17, 4) * settings.mediumNoise;
      const grain = fbm(direction[0] * 19, direction[1] * 19, direction[2] * 19, settings.seed + 43, 3) * settings.grainNoise;
      let displacement = broad + medium + grain;
      for (const crater of craters) displacement += craterDisplacement(direction, crater, settings.seed);
      for (const boulder of boulders) {
        const alignment = clamp(direction[0] * boulder.direction[0] + direction[1] * boulder.direction[1] + direction[2] * boulder.direction[2], -1, 1);
        const distance = Math.acos(alignment);
        if (distance < boulder.width * 2.1) {
          const profile = Math.exp(-Math.pow(distance / boulder.width, 2.25));
          displacement += boulder.height * profile * (0.80 + 0.20 * fbm(direction[0] * 18, direction[1] * 18, direction[2] * 18, settings.seed + 73, 2));
        }
      }
      const radius = Math.max(0.28, 1 + displacement);
      vertices.push([
        direction[0] * radius * settings.scale[0],
        direction[1] * radius * settings.scale[1],
        direction[2] * radius * settings.scale[2],
      ]);
    }
  }

  const normals = vertices.map(() => [0, 0, 0]);
  const faces = [];
  const width = lonSegments + 1;
  const addFace = (a, b, c) => {
    faces.push([a, b, c]);
    const p0 = vertices[a], p1 = vertices[b], p2 = vertices[c];
    const ab = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const ac = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const index of [a, b, c]) {
      normals[index][0] += n[0];
      normals[index][1] += n[1];
      normals[index][2] += n[2];
    }
  };
  for (let lat = 0; lat < latSegments; lat += 1) {
    for (let lon = 0; lon < lonSegments; lon += 1) {
      const a = lat * width + lon;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      addFace(a, c, b);
      addFace(b, c, d);
    }
  }

  const baseName = settings.fileName;
  const mtlName = `${baseName}.mtl`;
  const lines = [
    `# ${settings.displayName} — procedural high-detail asteroid`,
    `mtllib ${mtlName}`,
    `o ${settings.displayName.replace(/\s+/g, '_')}`,
    'usemtl AsteroidStone',
    's 1',
  ];
  for (const point of vertices) lines.push(`v ${point[0].toFixed(6)} ${point[1].toFixed(6)} ${point[2].toFixed(6)}`);
  for (const normal of normals) {
    const unit = normalize(normal);
    lines.push(`vn ${unit[0].toFixed(6)} ${unit[1].toFixed(6)} ${unit[2].toFixed(6)}`);
  }
  for (const face of faces) {
    const a = face[0] + 1, b = face[1] + 1, c = face[2] + 1;
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  fs.writeFileSync(path.join(outputDir, `${baseName}.obj`), `${lines.join('\n')}\n`);
  const mtl = [
    `# Material for ${settings.displayName}`,
    'newmtl AsteroidStone',
    `Kd ${settings.color.join(' ')}`,
    'Ka 0.035 0.035 0.035',
    'Ks 0.025 0.025 0.025',
    'Ns 12',
    'illum 2',
  ].join('\n');
  fs.writeFileSync(path.join(outputDir, mtlName), `${mtl}\n`);
  return { vertices: vertices.length, triangles: faces.length };
}

const asteroidTypes = [
  {
    fileName: 'asteroid_01_pitted', displayName: 'Asteroid 01 Pitted', seed: 11, scale: [1.02, 0.84, 0.90],
    broadNoise: 0.13, mediumNoise: 0.105, grainNoise: 0.042, craterCount: 44, minCrater: 0.035, maxCrater: 0.18,
    boulderCount: 16, boulderWidth: 0.08, boulderHeight: 0.045, color: [0.30, 0.285, 0.255],
  },
  {
    fileName: 'asteroid_02_elongated', displayName: 'Asteroid 02 Elongated', seed: 23, scale: [1.42, 0.67, 0.76],
    broadNoise: 0.18, mediumNoise: 0.11, grainNoise: 0.040, craterCount: 29, minCrater: 0.040, maxCrater: 0.17,
    boulderCount: 18, boulderWidth: 0.105, boulderHeight: 0.058, color: [0.27, 0.255, 0.235],
    featureCraters: [{ direction: normalize([0.74, -0.05, 0.67]), size: 0.28, depth: 0.145, rim: 0.026, eccentricity: 1.20, rotation: 0.38 }],
  },
  {
    fileName: 'asteroid_03_jagged', displayName: 'Asteroid 03 Jagged', seed: 37, scale: [1.14, 0.79, 0.90],
    broadNoise: 0.24, mediumNoise: 0.16, grainNoise: 0.052, craterCount: 23, minCrater: 0.030, maxCrater: 0.14,
    boulderCount: 35, boulderWidth: 0.095, boulderHeight: 0.090, color: [0.25, 0.245, 0.228],
  },
  {
    fileName: 'asteroid_04_major_crater', displayName: 'Asteroid 04 Major Crater', seed: 49, scale: [0.95, 0.92, 1.00],
    broadNoise: 0.105, mediumNoise: 0.075, grainNoise: 0.035, craterCount: 20, minCrater: 0.025, maxCrater: 0.13,
    boulderCount: 12, boulderWidth: 0.075, boulderHeight: 0.035, color: [0.33, 0.315, 0.285],
    featureCraters: [{ direction: normalize([0.68, 0.08, 0.73]), size: 0.50, depth: 0.265, rim: 0.075, eccentricity: 0.90, rotation: 1.15 }],
  },
  {
    fileName: 'asteroid_05_rubble', displayName: 'Asteroid 05 Rubble', seed: 61, scale: [1.04, 0.80, 0.88],
    broadNoise: 0.19, mediumNoise: 0.18, grainNoise: 0.070, craterCount: 16, minCrater: 0.025, maxCrater: 0.12,
    boulderCount: 74, boulderWidth: 0.058, boulderHeight: 0.072, color: [0.235, 0.225, 0.205],
  },
];

const summary = asteroidTypes.map(makeRock);
const readme = [
  '# Realistic Asteroid Pack',
  '',
  'Five unique, procedural, high-detail asteroid meshes in Wavefront OBJ format.',
  '',
  '| Asset | Style | Mesh density |',
  '| --- | --- | --- |',
  ...asteroidTypes.map((asset, index) => `| \`${asset.fileName}.obj\` | ${asset.displayName.replace('Asteroid ', '')} | ${summary[index].vertices.toLocaleString()} vertices / ${summary[index].triangles.toLocaleString()} triangles |`),
  '',
  'Each OBJ includes smooth vertex normals and points to its matching MTL stone material. Models are centered at the world origin and use an approximately 2-unit bounding size.',
  '',
  'Import as OBJ into Blender, Unity, Unreal Engine, Godot, Maya, or 3ds Max. For games, create LODs and bake normal/AO maps as appropriate.',
].join('\n');
fs.writeFileSync(path.join(outputDir, 'README.md'), `${readme}\n`);
console.log(`Created ${asteroidTypes.length} asteroid assets in ${outputDir}`);
for (let index = 0; index < asteroidTypes.length; index += 1) {
  console.log(`${asteroidTypes[index].fileName}: ${summary[index].vertices} vertices, ${summary[index].triangles} triangles`);
}
