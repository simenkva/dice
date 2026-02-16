import { CANNON, OrbitControls, THREE } from "./deps.js";
import { DIE_ORDER, pickRandomColor } from "./dice-data.js";
import { createDie, disposeDie } from "./dice-factory.js";

const WORLD_UP = new CANNON.Vec3(0, 1, 0);

function createTableTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0d130e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(127, 189, 115, 0.12)";
  ctx.lineWidth = 2;

  const spacing = 64;
  for (let x = 0; x <= canvas.width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(248, 179, 95, 0.22)";
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1.4);
  texture.needsUpdate = true;
  return texture;
}

export class DiceSimulation {
  constructor({ host, hud }) {
    this.host = host;
    this.hud = hud;
    this.clock = new THREE.Clock();
    this.fixedTimeStep = 1 / 60;
    this.dice = [];
    this.settleClock = 0;
    this.rollInProgress = false;
    this.table = {
      width: 14,
      depth: 10,
    };
    this.playArea = {
      width: 7.8,
      depth: 7.8,
      cubeHeight: 8.4,
      wallThickness: 0.32,
      containmentInset: 0.85,
    };
    this.defaultTarget = new THREE.Vector3(0, 0.3, 0);
    this.defaultCameraPosition = new THREE.Vector3(0, 8.2, 10.9);
    this.defaultViewDirection = this.defaultCameraPosition.clone().sub(this.defaultTarget).normalize();
    this.zoomRange = {
      near: 6.4,
      far: 24,
    };
    this.zoomNormalized = 0.64;
    this.containmentBodyRadius = 0.82;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080d08);
    this.scene.fog = new THREE.Fog(0x090d09, 10, 28);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
    this.camera.position.copy(this.defaultCameraPosition);
    this.camera.lookAt(this.defaultTarget);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.host.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.target.copy(this.defaultTarget);
    this.controls.minDistance = this.zoomRange.near;
    this.controls.maxDistance = this.zoomRange.far;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.update();

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -22, 0),
      allowSleep: true,
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 20;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;

    this.surfaceMaterial = new CANNON.Material("surface");
    this.diceMaterial = new CANNON.Material("dice");
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.surfaceMaterial, this.diceMaterial, {
        friction: 0.36,
        restitution: 0.26,
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMaterial, this.diceMaterial, {
        friction: 0.25,
        restitution: 0.34,
      })
    );

    this.#setupWorldGeometry();
    this.#setupVisualScene();

    window.addEventListener("resize", () => this.#handleResize());
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyF") {
        this.resetView();
      }
    });
    this.renderer.domElement.addEventListener("dblclick", () => this.resetView());
    this.setZoomNormalized(this.zoomNormalized);
    this.#handleResize();
    this.#animate();
  }

  #setupVisualScene() {
    const hemiLight = new THREE.HemisphereLight(0x9ee57c, 0x1d271f, 0.45);
    this.scene.add(hemiLight);

    const key = new THREE.DirectionalLight(0xcceebb, 1.1);
    key.position.set(4.8, 9.6, 5.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x7bc4ff, 0.22);
    fill.position.set(-5.4, 4.2, -3.5);
    this.scene.add(fill);

    const tableTexture = createTableTexture();
    const tableTop = new THREE.Mesh(
      new THREE.PlaneGeometry(this.table.width, this.table.depth),
      new THREE.MeshStandardMaterial({
        map: tableTexture,
        color: 0x293a28,
        metalness: 0.16,
        roughness: 0.9,
      })
    );
    tableTop.rotation.x = -Math.PI / 2;
    tableTop.receiveShadow = true;
    this.scene.add(tableTop);

    const tableBody = new THREE.Mesh(
      new THREE.BoxGeometry(this.table.width + 0.9, 0.8, this.table.depth + 0.9),
      new THREE.MeshStandardMaterial({
        color: 0x141a13,
        metalness: 0.1,
        roughness: 0.92,
      })
    );
    tableBody.position.y = -0.42;
    tableBody.receiveShadow = true;
    this.scene.add(tableBody);

    const playAreaGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(this.playArea.width, this.playArea.depth),
      new THREE.MeshStandardMaterial({
        color: 0x4a6a40,
        emissive: 0x274226,
        emissiveIntensity: 0.52,
        metalness: 0.02,
        roughness: 0.86,
        transparent: true,
        opacity: 0.4,
      })
    );
    playAreaGlow.rotation.x = -Math.PI / 2;
    playAreaGlow.position.y = 0.014;
    this.scene.add(playAreaGlow);

    const containmentHalfW = this.playArea.width * 0.5 - this.playArea.containmentInset;
    const containmentHalfD = this.playArea.depth * 0.5 - this.playArea.containmentInset;
    const wallY = this.playArea.cubeHeight * 0.5;
    const wallZ = containmentHalfD + this.playArea.wallThickness;
    const wallX = containmentHalfW + this.playArea.wallThickness;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x6ea069,
      emissive: 0x1d3520,
      emissiveIntensity: 0.24,
      metalness: 0.06,
      roughness: 0.86,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const northSouthVisual = new THREE.Mesh(
      new THREE.PlaneGeometry((containmentHalfW + this.playArea.wallThickness) * 2, this.playArea.cubeHeight),
      wallMaterial
    );
    northSouthVisual.position.set(0, wallY, wallZ);
    this.scene.add(northSouthVisual);

    const southVisual = northSouthVisual.clone();
    southVisual.position.z = -wallZ;
    southVisual.rotation.y = Math.PI;
    this.scene.add(southVisual);

    const eastWestVisual = new THREE.Mesh(
      new THREE.PlaneGeometry((containmentHalfD + this.playArea.wallThickness) * 2, this.playArea.cubeHeight),
      wallMaterial
    );
    eastWestVisual.position.set(wallX, wallY, 0);
    eastWestVisual.rotation.y = -Math.PI * 0.5;
    this.scene.add(eastWestVisual);

    const westVisual = eastWestVisual.clone();
    westVisual.position.x = -wallX;
    westVisual.rotation.y = Math.PI * 0.5;
    this.scene.add(westVisual);

    const topVisual = new THREE.Mesh(
      new THREE.PlaneGeometry((containmentHalfW + this.playArea.wallThickness) * 2, (containmentHalfD + this.playArea.wallThickness) * 2),
      new THREE.MeshStandardMaterial({
        color: 0x7cae72,
        emissive: 0x233b24,
        emissiveIntensity: 0.18,
        metalness: 0.04,
        roughness: 0.9,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    topVisual.rotation.x = Math.PI * 0.5;
    topVisual.position.y = this.playArea.cubeHeight + this.playArea.wallThickness;
    this.scene.add(topVisual);

  }

  #setupWorldGeometry() {
    const halfW = this.table.width * 0.5;
    const halfD = this.table.depth * 0.5;
    const wallHeight = 2.4;
    const wallThickness = 0.26;
    const halfPlayW = this.playArea.width * 0.5 - this.playArea.containmentInset;
    const halfPlayD = this.playArea.depth * 0.5 - this.playArea.containmentInset;

    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.surfaceMaterial,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    const wallBodies = [
      {
        halfExtents: new CANNON.Vec3(halfW + wallThickness, wallHeight * 0.5, wallThickness),
        position: new CANNON.Vec3(0, wallHeight * 0.5, halfD + wallThickness),
      },
      {
        halfExtents: new CANNON.Vec3(halfW + wallThickness, wallHeight * 0.5, wallThickness),
        position: new CANNON.Vec3(0, wallHeight * 0.5, -halfD - wallThickness),
      },
      {
        halfExtents: new CANNON.Vec3(wallThickness, wallHeight * 0.5, halfD + wallThickness),
        position: new CANNON.Vec3(halfW + wallThickness, wallHeight * 0.5, 0),
      },
      {
        halfExtents: new CANNON.Vec3(wallThickness, wallHeight * 0.5, halfD + wallThickness),
        position: new CANNON.Vec3(-halfW - wallThickness, wallHeight * 0.5, 0),
      },
    ];

    for (const wallData of wallBodies) {
      const wall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(wallData.halfExtents),
        material: this.surfaceMaterial,
      });
      wall.position.copy(wallData.position);
      this.world.addBody(wall);
    }

    const cubeHalfHeight = this.playArea.cubeHeight * 0.5;
    const innerWalls = [
      {
        halfExtents: new CANNON.Vec3(halfPlayW + this.playArea.wallThickness, cubeHalfHeight, this.playArea.wallThickness),
        position: new CANNON.Vec3(0, cubeHalfHeight, halfPlayD + this.playArea.wallThickness),
      },
      {
        halfExtents: new CANNON.Vec3(halfPlayW + this.playArea.wallThickness, cubeHalfHeight, this.playArea.wallThickness),
        position: new CANNON.Vec3(0, cubeHalfHeight, -halfPlayD - this.playArea.wallThickness),
      },
      {
        halfExtents: new CANNON.Vec3(this.playArea.wallThickness, cubeHalfHeight, halfPlayD + this.playArea.wallThickness),
        position: new CANNON.Vec3(halfPlayW + this.playArea.wallThickness, cubeHalfHeight, 0),
      },
      {
        halfExtents: new CANNON.Vec3(this.playArea.wallThickness, cubeHalfHeight, halfPlayD + this.playArea.wallThickness),
        position: new CANNON.Vec3(-halfPlayW - this.playArea.wallThickness, cubeHalfHeight, 0),
      },
      {
        halfExtents: new CANNON.Vec3(halfPlayW + this.playArea.wallThickness, this.playArea.wallThickness, halfPlayD + this.playArea.wallThickness),
        position: new CANNON.Vec3(0, this.playArea.cubeHeight + this.playArea.wallThickness, 0),
      },
    ];

    for (const wallData of innerWalls) {
      const wall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(wallData.halfExtents),
        material: this.surfaceMaterial,
      });
      wall.position.copy(wallData.position);
      this.world.addBody(wall);
    }
  }

  #handleResize() {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  #animate() {
    requestAnimationFrame(() => this.#animate());
    const delta = Math.min(this.clock.getDelta(), 0.033);

    this.world.step(this.fixedTimeStep, delta, 8);

    for (const die of this.dice) {
      this.#enforceContainment(die);
      die.group.position.copy(die.body.position);
      die.group.quaternion.copy(die.body.quaternion);
    }

    if (this.rollInProgress && this.dice.length > 0) {
      this.#checkForSettledDice(delta);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  #checkForSettledDice(delta) {
    const allSettled = this.dice.every((die) => {
      if (die.body.sleepState === CANNON.Body.SLEEPING) {
        return true;
      }
      return die.body.velocity.lengthSquared() < 0.012 && die.body.angularVelocity.lengthSquared() < 0.02;
    });

    if (!allSettled) {
      this.settleClock = 0;
      return;
    }

    this.settleClock += delta;
    if (this.settleClock < 0.5) {
      return;
    }

    this.rollInProgress = false;
    this.settleClock = 0;
    const results = this.#computeResults();
    const detail = DIE_ORDER.filter((type) => results.byType.has(type))
      .map((type) => `${type}: [${results.byType.get(type).join(", ")}]`)
      .join("  |  ");

    this.hud.textContent = `Roll complete. Total: ${results.total}   ${detail}`;
  }

  #computeResults() {
    const byType = new Map();
    let total = 0;

    for (const die of this.dice) {
      const value = this.#topFaceValue(die);
      total += value;
      if (!byType.has(die.type)) {
        byType.set(die.type, []);
      }
      byType.get(die.type).push(value);
    }

    return { total, byType };
  }

  #topFaceValue(die) {
    if (die.type === "d4" && Array.isArray(die.vertexValues) && Array.isArray(die.localVertices)) {
      return this.#topD4VertexValue(die);
    }

    let bestValue = 1;
    let highestDot = -Infinity;
    const transformed = new CANNON.Vec3();

    for (const face of die.faceData) {
      const localNormal = new CANNON.Vec3(face.normal.x, face.normal.y, face.normal.z);
      die.body.quaternion.vmult(localNormal, transformed);
      const dot = transformed.dot(WORLD_UP);

      if (dot > highestDot) {
        highestDot = dot;
        bestValue = face.value;
      }
    }

    return bestValue;
  }

  #topD4VertexValue(die) {
    let bestVertexIndex = 0;
    let highestDot = -Infinity;
    const transformed = new CANNON.Vec3();

    for (let i = 0; i < die.localVertices.length; i += 1) {
      die.body.quaternion.vmult(die.localVertices[i], transformed);
      const dot = transformed.dot(WORLD_UP);

      if (dot > highestDot) {
        highestDot = dot;
        bestVertexIndex = i;
      }
    }

    return die.vertexValues[bestVertexIndex] ?? bestVertexIndex + 1;
  }

  #enforceContainment(die) {
    const limitX = this.playArea.width * 0.5 - this.playArea.containmentInset - this.containmentBodyRadius;
    const limitZ = this.playArea.depth * 0.5 - this.playArea.containmentInset - this.containmentBodyRadius;
    const ceilingY = this.playArea.cubeHeight - this.containmentBodyRadius;

    if (die.body.position.x > limitX) {
      die.body.position.x = limitX;
      if (die.body.velocity.x > 0) {
        die.body.velocity.x *= -0.45;
      }
      die.body.wakeUp();
    } else if (die.body.position.x < -limitX) {
      die.body.position.x = -limitX;
      if (die.body.velocity.x < 0) {
        die.body.velocity.x *= -0.45;
      }
      die.body.wakeUp();
    }

    if (die.body.position.z > limitZ) {
      die.body.position.z = limitZ;
      if (die.body.velocity.z > 0) {
        die.body.velocity.z *= -0.45;
      }
      die.body.wakeUp();
    } else if (die.body.position.z < -limitZ) {
      die.body.position.z = -limitZ;
      if (die.body.velocity.z < 0) {
        die.body.velocity.z *= -0.45;
      }
      die.body.wakeUp();
    }

    if (die.body.position.y > ceilingY) {
      die.body.position.y = ceilingY;
      if (die.body.velocity.y > 0) {
        die.body.velocity.y *= -0.5;
      }
      die.body.wakeUp();
    }
  }

  #cameraDistanceForZoom(normalized) {
    const t = THREE.MathUtils.clamp(normalized, 0, 1);
    return THREE.MathUtils.lerp(this.zoomRange.far, this.zoomRange.near, t);
  }

  setZoomNormalized(normalized) {
    this.zoomNormalized = THREE.MathUtils.clamp(normalized, 0, 1);
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() < 1e-4) {
      offset.copy(this.defaultViewDirection);
    } else {
      offset.normalize();
    }

    const distance = this.#cameraDistanceForZoom(this.zoomNormalized);
    this.camera.position.copy(this.controls.target.clone().add(offset.multiplyScalar(distance)));
    this.controls.update();
  }

  resetView() {
    this.controls.target.copy(this.defaultTarget);
    const distance = this.#cameraDistanceForZoom(this.zoomNormalized);
    this.camera.position.copy(this.defaultTarget.clone().add(this.defaultViewDirection.clone().multiplyScalar(distance)));
    this.controls.update();
    this.hud.textContent = "View reset. Press Roll to launch a new throw.";
  }

  roll(countsByType) {
    this.clearDice();
    const queue = [];

    for (const type of DIE_ORDER) {
      const count = Number(countsByType[type] || 0);
      for (let i = 0; i < count; i += 1) {
        queue.push(type);
      }
    }

    if (queue.length === 0) {
      this.hud.textContent = "No dice selected. Set one or more sliders and press Roll.";
      return;
    }

    const containmentHalfW = this.playArea.width * 0.5 - this.playArea.containmentInset;
    const containmentHalfD = this.playArea.depth * 0.5 - this.playArea.containmentInset;
    const xSpread = Math.max(0.25, containmentHalfW - this.containmentBodyRadius - 0.1);
    const zSpread = Math.max(0.25, containmentHalfD - this.containmentBodyRadius - 0.1);

    queue.forEach((type, index) => {
      const die = createDie({
        type,
        color: pickRandomColor(),
        physicsMaterial: this.diceMaterial,
      });

      const x = (Math.random() * 2 - 1) * xSpread;
      const z = (Math.random() * 2 - 1) * zSpread;
      const y = 3.7 + index * 0.2 + Math.random() * 0.3;
      die.body.position.set(x, y, z);

      const q = new CANNON.Quaternion();
      q.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      die.body.quaternion.copy(q);

      die.body.velocity.set((Math.random() * 2 - 1) * 4.5, 5.6 + Math.random() * 1.6, (Math.random() * 2 - 1) * 4.5);
      die.body.angularVelocity.set(
        (Math.random() * 2 - 1) * 12,
        (Math.random() * 2 - 1) * 12,
        (Math.random() * 2 - 1) * 12
      );

      this.world.addBody(die.body);
      this.scene.add(die.group);
      this.dice.push(die);
    });

    this.rollInProgress = true;
    this.settleClock = 0;
    this.hud.textContent = `Rolling ${queue.length} dice...`;
  }

  clearDice() {
    for (const die of this.dice) {
      this.scene.remove(die.group);
      this.world.removeBody(die.body);
      disposeDie(die);
    }
    this.dice.length = 0;
  }
}
