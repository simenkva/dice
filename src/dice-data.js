const PHI = (1 + Math.sqrt(5)) / 2;

export const DIE_ORDER = ["d4", "d6", "d8", "d10", "d20"];

export const DIE_PALETTE = [
  "#ffb066",
  "#8ef5ab",
  "#73d2ff",
  "#e3ccff",
  "#ffd86b",
  "#ff8b7d",
];

function normalizeVertices(vertices, radius) {
  let maxLength = 0;

  for (const [x, y, z] of vertices) {
    maxLength = Math.max(maxLength, Math.hypot(x, y, z));
  }

  return vertices.map(([x, y, z]) => [
    (x / maxLength) * radius,
    (y / maxLength) * radius,
    (z / maxLength) * radius,
  ]);
}

function buildD10Vertices() {
  const top = [0, 1.18, 0];
  const bottom = [0, -1.18, 0];
  const ring = [];
  const radius = 0.96;
  // Chosen to keep each 4-vertex kite face planar (standard RPG d10 silhouette).
  const ringYOffset = 0.1246;

  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10 + Math.PI / 10;
    const y = i % 2 === 0 ? ringYOffset : -ringYOffset;
    ring.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
  }

  return [top, bottom, ...ring];
}

function buildD10Faces() {
  const faces = [];

  // Pentagonal trapezohedron: 10 kite faces alternating around top/bottom poles.
  for (let i = 0; i < 10; i += 1) {
    const pole = i % 2 === 0 ? 0 : 1;
    const a = 2 + i;
    const b = 2 + ((i + 1) % 10);
    const c = 2 + ((i + 2) % 10);
    faces.push([pole, a, b, c]);
  }

  return faces;
}

function buildIcosahedronData() {
  const vertices = [
    [-1, PHI, 0],
    [1, PHI, 0],
    [-1, -PHI, 0],
    [1, -PHI, 0],
    [0, -1, PHI],
    [0, 1, PHI],
    [0, -1, -PHI],
    [0, 1, -PHI],
    [PHI, 0, -1],
    [PHI, 0, 1],
    [-PHI, 0, -1],
    [-PHI, 0, 1],
  ];

  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  return { vertices, faces };
}

const d10Data = buildD10Faces();
const d20Data = buildIcosahedronData();

export const DIE_CONFIGS = {
  d4: {
    label: "d4",
    sides: 4,
    textScale: 0.88,
    vertexValues: [1, 2, 3, 4],
    vertices: normalizeVertices(
      [
        [1, 1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, -1, -1],
      ],
      0.55
    ),
    faces: [
      [0, 1, 2],
      [0, 3, 1],
      [0, 2, 3],
      [1, 3, 2],
    ],
  },
  d6: {
    label: "d6",
    sides: 6,
    textScale: 0.72,
    vertices: normalizeVertices(
      [
        [-1, -1, -1],
        [1, -1, -1],
        [-1, 1, -1],
        [1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [-1, 1, 1],
        [1, 1, 1],
      ],
      0.66
    ),
    faces: [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ],
  },
  d8: {
    label: "d8",
    sides: 8,
    textScale: 0.68,
    vertices: normalizeVertices(
      [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ],
      0.64
    ),
    faces: [
      [0, 2, 4],
      [2, 1, 4],
      [1, 3, 4],
      [3, 0, 4],
      [2, 0, 5],
      [1, 2, 5],
      [3, 1, 5],
      [0, 3, 5],
    ],
  },
  d10: {
    label: "d10",
    sides: 10,
    textScale: 0.6,
    vertices: normalizeVertices(buildD10Vertices(), 0.72),
    faces: d10Data,
  },
  d20: {
    label: "d20",
    sides: 20,
    textScale: 0.48,
    vertices: normalizeVertices(d20Data.vertices, 0.74),
    faces: d20Data.faces,
  },
};

export function pickRandomColor(randomFn = Math.random) {
  const index = Math.floor(randomFn() * DIE_PALETTE.length);
  return DIE_PALETTE[index];
}

export function getMassForDie(type) {
  const sideCount = DIE_CONFIGS[type].sides;
  return 0.48 + sideCount * 0.03;
}

export function clampSliderValue(value) {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return 0;
  }

  return Math.max(0, Math.min(6, Math.round(num)));
}
