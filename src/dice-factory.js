import { CANNON, THREE } from "./deps.js";
import { DIE_CONFIGS, getMassForDie } from "./dice-data.js";

const PLANE_FORWARD = new THREE.Vector3(0, 0, 1);

function orientedFace(face, vertices) {
  const ordered = [...face];
  const a = new THREE.Vector3(...vertices[ordered[0]]);
  const b = new THREE.Vector3(...vertices[ordered[1]]);
  const c = new THREE.Vector3(...vertices[ordered[2]]);
  const center = new THREE.Vector3();

  for (const index of ordered) {
    center.add(new THREE.Vector3(...vertices[index]));
  }
  center.multiplyScalar(1 / ordered.length);

  const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();

  if (normal.dot(center) < 0) {
    ordered.reverse();
  }

  return ordered;
}

function buildFaceData(vertices, faces) {
  return faces.map((face, faceIndex) => {
    const a = new THREE.Vector3(...vertices[face[0]]);
    const b = new THREE.Vector3(...vertices[face[1]]);
    const c = new THREE.Vector3(...vertices[face[2]]);
    const center = new THREE.Vector3();

    for (const index of face) {
      center.add(new THREE.Vector3(...vertices[index]));
    }
    center.multiplyScalar(1 / face.length);

    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (normal.dot(center) < 0) {
      normal.multiplyScalar(-1);
    }

    return {
      value: faceIndex + 1,
      indices: face,
      center,
      normal,
    };
  });
}

function makePolyhedronGeometry(vertices, faces) {
  const positions = [];

  for (const face of faces) {
    for (let i = 1; i < face.length - 1; i += 1) {
      const indexA = face[0];
      const indexB = face[i];
      const indexC = face[i + 1];

      positions.push(
        vertices[indexA][0],
        vertices[indexA][1],
        vertices[indexA][2],
        vertices[indexB][0],
        vertices[indexB][1],
        vertices[indexB][2],
        vertices[indexC][0],
        vertices[indexC][1],
        vertices[indexC][2]
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}

function makeLabelTexture(value) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const rawLabel = String(value);
  const label = rawLabel === "6" || rawLabel === "9" ? `${rawLabel}.` : rawLabel;
  const fontSize = rawLabel.length > 1 ? 132 : 164;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = `bold ${fontSize}px "VT323", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return texture;
}

function makeSingleFaceLabels({ faceData, textScale }) {
  const labels = [];

  for (const face of faceData) {
    const texture = makeLabelTexture(face.value);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(textScale, textScale);
    const mesh = new THREE.Mesh(geometry, material);
    const normal = face.normal.clone();

    mesh.position.copy(face.center.clone().addScaledVector(normal, 0.04));
    mesh.quaternion.setFromUnitVectors(PLANE_FORWARD, normal);
    labels.push(mesh);
  }

  return labels;
}

function makeD4FaceLabels({ faceData, textScale, vertices, vertexValues }) {
  const labels = [];
  const digitSize = textScale * 0.34;
  const localUp = new THREE.Vector3(0, 1, 0);

  for (const face of faceData) {
    const normal = face.normal.clone();
    const baseOrientation = new THREE.Quaternion().setFromUnitVectors(PLANE_FORWARD, normal);

    for (const vertexIndex of face.indices) {
      const value = vertexValues[vertexIndex];
      const texture = makeLabelTexture(value);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const geometry = new THREE.PlaneGeometry(digitSize, digitSize);
      const mesh = new THREE.Mesh(geometry, material);
      const vertexPosition = new THREE.Vector3(...vertices[vertexIndex]);
      const labelPosition = vertexPosition.clone().multiplyScalar(0.74).add(face.center.clone().multiplyScalar(0.26));

      mesh.position.copy(labelPosition).addScaledVector(normal, 0.038);
      mesh.quaternion.copy(baseOrientation);

      // Rotate in the face plane so the top of the numeral points to its owning vertex.
      const toVertex = vertexPosition.clone().sub(labelPosition);
      const desiredUp = toVertex.clone().addScaledVector(normal, -toVertex.dot(normal));
      const currentUp = localUp.clone().applyQuaternion(mesh.quaternion).normalize();

      if (desiredUp.lengthSq() > 1e-6) {
        desiredUp.normalize();
        const cross = new THREE.Vector3().crossVectors(currentUp, desiredUp);
        const signedAngle = Math.atan2(cross.dot(normal), currentUp.dot(desiredUp));
        mesh.rotateOnWorldAxis(normal, signedAngle);
      }

      labels.push(mesh);
    }
  }

  return labels;
}

function makeFaceLabels({ type, faceData, textScale, vertices, vertexValues }) {
  if (type === "d4" && Array.isArray(vertexValues)) {
    return makeD4FaceLabels({
      faceData,
      textScale,
      vertices,
      vertexValues,
    });
  }

  return makeSingleFaceLabels({ faceData, textScale });
}

export function createDie({ type, color, physicsMaterial }) {
  const config = DIE_CONFIGS[type];
  const orientedFaces = config.faces.map((face) => orientedFace(face, config.vertices));
  const faceData = buildFaceData(config.vertices, orientedFaces);
  const geometry = makePolyhedronGeometry(config.vertices, orientedFaces);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.15,
    roughness: 0.28,
    flatShading: true,
  });

  const bodyMesh = new THREE.Mesh(geometry, bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;

  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0x0b0f0c,
      transparent: true,
      opacity: 0.65,
    })
  );

  const dieGroup = new THREE.Group();
  dieGroup.add(bodyMesh);
  dieGroup.add(edgeLines);

  const labels = makeFaceLabels({
    type,
    faceData,
    textScale: config.textScale,
    vertices: config.vertices,
    vertexValues: config.vertexValues,
  });
  for (const label of labels) {
    dieGroup.add(label);
  }

  const cannonVertices = config.vertices.map(([x, y, z]) => new CANNON.Vec3(x, y, z));
  const cannonShape = new CANNON.ConvexPolyhedron({
    vertices: cannonVertices,
    faces: orientedFaces,
  });

  const body = new CANNON.Body({
    mass: getMassForDie(type),
    material: physicsMaterial,
    shape: cannonShape,
    allowSleep: true,
    sleepSpeedLimit: 0.08,
    sleepTimeLimit: 0.55,
    linearDamping: 0.2,
    angularDamping: 0.15,
  });

  return {
    type,
    group: dieGroup,
    body,
    faceData,
    localVertices: cannonVertices,
    vertexValues: config.vertexValues ?? null,
    labels,
    bodyMaterial,
    edgeGeometry: edgeLines.geometry,
    edgeMaterial: edgeLines.material,
    geometry,
  };
}

export function disposeDie(die) {
  die.geometry.dispose();
  die.bodyMaterial.dispose();
  die.edgeGeometry.dispose();
  die.edgeMaterial.dispose();

  for (const child of die.labels) {
    if (child.material?.map) {
      child.material.map.dispose();
    }
    child.geometry.dispose();
    child.material.dispose();
  }
}
