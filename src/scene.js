import { getFresnelMat } from './getFresnelMat.js';
import getStarfield from './getStarfield.js';

let scene, camera, renderer, earthGroup, satellite, sunLight, loader, orbitControls;

const EARTH_RADIUS = 1;
export const ORBIT_SPEED = 0.0035; 

export let currentOrbitRadius = 3.5;
let currentOrbitAngle = 0;
let earthMesh, lightsMesh, cloudsMesh, moonMesh;

let satelliteOffset = new THREE.Vector3(0, 0, 0);
let satelliteVelocity = new THREE.Vector3(0, 0, 0);
const SATELLITE_ACCEL = 0.00015;
const SATELLITE_DAMPING = 0.93;

let moonGroup;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let cameraTheta = Math.PI / 2; 
let cameraPhi = Math.PI / 3;
let cameraRadius = 9;
const CAMERA_MIN_RADIUS = 4;
const CAMERA_MAX_RADIUS = 22;

const activeKeys = { w: false, a: false, s: false, d: false, q: false, e: false };
let thrusterFlames = {};
export let orbitPathLine;

let panelGlowTime = 0;
let solarPanelMeshes = [];

export function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvas.width = width;
    canvas.height = height;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    loader = new THREE.TextureLoader();

    createEarth();
    createSatellite();
    createLighting();
    createMoon();
    createStarfield();
    createOrbitPath();

    if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
        orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.07;
        orbitControls.enableZoom = true;
        orbitControls.zoomSpeed = 0.8;
        orbitControls.enableRotate = true;
        orbitControls.autoRotate = false;
        orbitControls.target.set(0, 0, 0);
        orbitControls.minDistance = CAMERA_MIN_RADIUS;
        orbitControls.maxDistance = CAMERA_MAX_RADIUS;
        orbitControls.update();
    } else {
        setupManualCameraControl();
    }

    window.addEventListener('resize', onWindowResize);
    setupManeuverControls();
}

function createEarth() {
    earthGroup = new THREE.Group();
    earthGroup.rotation.z = -23.4 * Math.PI / 180;
    scene.add(earthGroup);

    const detail = 12;
    const geometry = new THREE.IcosahedronGeometry(EARTH_RADIUS, detail);

    const mapTexture = loader.load("./public/textures/00_earthmap1k.jpg");
    const specTexture = loader.load("./public/textures/02_earthspec1k.jpg");
    const bumpTexture = loader.load("./public/textures/01_earthbump1k.jpg");

    const material = new THREE.MeshPhongMaterial({
        map: mapTexture,
        specularMap: specTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.04,
    });
    earthMesh = new THREE.Mesh(geometry, material);
    earthMesh.castShadow = true;
    earthMesh.receiveShadow = true;
    earthGroup.add(earthMesh);

    const lightsTexture = loader.load("./public/textures/03_earthlights1k.jpg");
    const lightsMat = new THREE.MeshBasicMaterial({
        map: lightsTexture,
        blending: THREE.AdditiveBlending,
    });
    lightsMesh = new THREE.Mesh(geometry, lightsMat);
    earthGroup.add(lightsMesh);

    const cloudsTexture = loader.load("./public/textures/04_earthcloudmap.jpg");
    const cloudsAlphaTexture = loader.load("./public/textures/05_earthcloudmaptrans.jpg");
    const cloudsMat = new THREE.MeshStandardMaterial({
        map: cloudsTexture,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        alphaMap: cloudsAlphaTexture,
    });
    cloudsMesh = new THREE.Mesh(geometry, cloudsMat);
    cloudsMesh.scale.setScalar(1.003);
    earthGroup.add(cloudsMesh);

    const fresnelMat = getFresnelMat();
    const glowMesh = new THREE.Mesh(geometry, fresnelMat);
    glowMesh.scale.setScalar(1.012);
    earthGroup.add(glowMesh);
}

function createLighting() {
    sunLight = new THREE.DirectionalLight(0xfff5e0, 2.2);
    sunLight.position.set(-2, 0.5, 1.5);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x1a1a3a, 0.8);
    scene.add(ambientLight);

    const earthFill = new THREE.PointLight(0x224466, 0.4, 8);
    earthFill.position.set(0, 0, 0);
    scene.add(earthFill);
}

function createStarfield() {
    const stars = getStarfield({ numStars: 3000 });
    scene.add(stars);
}

function updateCameraFromSpherical() {
    const x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    const y = cameraRadius * Math.cos(cameraPhi);
    const z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
}

function setupManualCameraControl() {
    const canvas = renderer.domElement;
    canvas.style.cursor = 'grab';

    canvas.addEventListener('mousedown', (event) => {
        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        const deltaX = event.clientX - dragStartX;
        const deltaY = event.clientY - dragStartY;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        cameraTheta -= deltaX * 0.005;
        cameraPhi = Math.min(Math.max(0.1, cameraPhi - deltaY * 0.005), Math.PI - 0.1);
        updateCameraFromSpherical();
    });

    const stopDrag = () => { isDragging = false; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('mouseup', stopDrag);
    canvas.addEventListener('mouseleave', stopDrag);

    canvas.addEventListener('wheel', (event) => {
        cameraRadius = Math.min(Math.max(CAMERA_MIN_RADIUS, cameraRadius + event.deltaY * 0.01), CAMERA_MAX_RADIUS);
        updateCameraFromSpherical();
    }, { passive: true });

    updateCameraFromSpherical();
}

function createMoon() {
    moonGroup = new THREE.Group();
    scene.add(moonGroup);

    const moonGeometry = new THREE.IcosahedronGeometry(1, 10);
    const moonMaterial = new THREE.MeshStandardMaterial({
        color: 0xbbbbbb,
        roughness: 0.9,
        metalness: 0.0
    });
    moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.position.set(5, 1, 0);
    moonMesh.scale.setScalar(0.27);
    moonGroup.add(moonMesh);

    loader.load("./public/textures/06_moonmap4k.jpg", (texture) => {
        moonMaterial.map = texture;
        moonMaterial.needsUpdate = true;
    });
    loader.load("./public/textures/07_moonbump4k.jpg", (texture) => {
        moonMaterial.bumpMap = texture;
        moonMaterial.bumpScale = 2;
        moonMaterial.needsUpdate = true;
    });
}

function createSatellite() {
    const satGroup = new THREE.Group();
    solarPanelMeshes = [];

    const busGeo = new THREE.BoxGeometry(0.38, 0.42, 0.62);
    const busMat = new THREE.MeshStandardMaterial({
        color: 0xc8a020,
        metalness: 0.55,
        roughness: 0.45,
    });
    const bus = new THREE.Mesh(busGeo, busMat);
    satGroup.add(bus);

    const facePanelGeo = new THREE.BoxGeometry(0.36, 0.40, 0.01);
    const facePanelMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.7,
        roughness: 0.3
    });
    const facePanel = new THREE.Mesh(facePanelGeo, facePanelMat);
    facePanel.position.z = 0.315;
    satGroup.add(facePanel);

    const nadirMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.4, roughness: 0.7 });
    const nadirPanel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.40, 0.01), nadirMat);
    nadirPanel.position.z = -0.315;
    satGroup.add(nadirPanel);

    const zenithMat = new THREE.MeshStandardMaterial({ color: 0x555544, metalness: 0.3, roughness: 0.6 });
    const zenithPanel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.01, 0.60), zenithMat);
    zenithPanel.position.y = 0.215;
    satGroup.add(zenithPanel);

    const armMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.85, roughness: 0.2 });
    const armGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8);

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.rotation.z = Math.PI / 2;
    leftArm.position.x = -0.63;
    satGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.rotation.z = Math.PI / 2;
    rightArm.position.x = 0.63;
    satGroup.add(rightArm);

    function createSolarArray(xOffset) {
        const arrayGroup = new THREE.Group();

        const panelGeo = new THREE.BoxGeometry(1.1, 0.52, 0.025);
        const panelMat = new THREE.MeshPhongMaterial({
            color: 0x0d1a4a,
            emissive: 0x000510,
            shininess: 140,
            specular: 0x3355aa,
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        arrayGroup.add(panel);
        solarPanelMeshes.push(panel);

        const lineMat = new THREE.LineBasicMaterial({ color: 0x2244cc, transparent: true, opacity: 0.55 });
        const cols = 7, rows = 4;
        const pw = 1.1, ph = 0.52;

        for (let c = 0; c <= cols; c++) {
            const x = -pw / 2 + c * (pw / cols);
            const pts = [new THREE.Vector3(x, -ph / 2, 0.014), new THREE.Vector3(x, ph / 2, 0.014)];
            arrayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
        }
        for (let r = 0; r <= rows; r++) {
            const y = -ph / 2 + r * (ph / rows);
            const pts = [new THREE.Vector3(-pw / 2, y, 0.014), new THREE.Vector3(pw / 2, y, 0.014)];
            arrayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
        }

        const edgeGeo = new THREE.BoxGeometry(1.12, 0.54, 0.022);
        const edgeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.z = -0.002;
        arrayGroup.add(edge);

        arrayGroup.position.x = xOffset;
        return arrayGroup;
    }

    satGroup.add(createSolarArray(-1.25));
    satGroup.add(createSolarArray(1.25));

    const dishProfile = [];
    for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const r = t * 0.26;
        const h = t * t * 0.13;
        dishProfile.push(new THREE.Vector2(r, h));
    }
    const dishGeo = new THREE.LatheGeometry(dishProfile, 28);
    const dishMat = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        metalness: 0.75,
        roughness: 0.2,
        side: THREE.DoubleSide
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0.08, -0.25, -0.28);
    dish.rotation.x = -Math.PI * 0.6;
    dish.rotation.z = 0.2;
    satGroup.add(dish);

    const mountGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8);
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8 });
    const dishMount = new THREE.Mesh(mountGeo, mountMat);
    dishMount.position.set(0.08, -0.13, -0.28);
    dishMount.rotation.x = Math.PI * 0.1;
    satGroup.add(dishMount);

    const hornGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.09, 8);
    const horn = new THREE.Mesh(hornGeo, mountMat);
    horn.position.set(0.08, -0.12, -0.28);
    horn.rotation.x = Math.PI * 0.6;
    satGroup.add(horn);

    const omniGeo = new THREE.CylinderGeometry(0.007, 0.003, 0.55, 6);
    const omniMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.9 });
    const omniAntenna = new THREE.Mesh(omniGeo, omniMat);
    omniAntenna.position.set(-0.06, 0.48, 0.05);
    satGroup.add(omniAntenna);

    const tipGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const tip = new THREE.Mesh(tipGeo, omniMat);
    tip.position.set(-0.06, 0.755, 0.05);
    satGroup.add(tip);

    const trackerGeo = new THREE.BoxGeometry(0.065, 0.065, 0.09);
    const trackerMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.5 });
    [-0.13, 0.13].forEach(xOff => {
        const tracker = new THREE.Mesh(trackerGeo, trackerMat);
        tracker.position.set(xOff, 0.245, 0.15);
        tracker.rotation.x = -0.3;
        satGroup.add(tracker);
        
        const lensGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.01, 12);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x001133, metalness: 0.2, roughness: 0.0, transparent: true, opacity: 0.85 });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(xOff, 0.245, 0.2);
        lens.rotation.x = Math.PI / 2;
        satGroup.add(lens);
    });

    const gpsPatchGeo = new THREE.BoxGeometry(0.07, 0.007, 0.07);
    const gpsMat = new THREE.MeshStandardMaterial({ color: 0x226622, metalness: 0.3, roughness: 0.5 });
    [[-0.1, 0.1], [0.1, 0.1], [-0.1, -0.1], [0.1, -0.1]].forEach(([x, z]) => {
        const patch = new THREE.Mesh(gpsPatchGeo, gpsMat);
        patch.position.set(x, 0.225, z);
        satGroup.add(patch);
    });

    thrusterFlames.zPlus = createThrusterFlame(satGroup, new THREE.Vector3(0, 0, 0.45), new THREE.Euler(Math.PI / 2, 0, 0));
    thrusterFlames.zMinus = createThrusterFlame(satGroup, new THREE.Vector3(0, 0, -0.45), new THREE.Euler(-Math.PI / 2, 0, 0));
    thrusterFlames.xPlus = createThrusterFlame(satGroup, new THREE.Vector3(0.35, 0, 0), new THREE.Euler(0, 0, -Math.PI / 2));
    thrusterFlames.xMinus = createThrusterFlame(satGroup, new THREE.Vector3(-0.35, 0, 0), new THREE.Euler(0, 0, Math.PI / 2));
    thrusterFlames.yPlus = createThrusterFlame(satGroup, new THREE.Vector3(0, 0.35, 0), new THREE.Euler(0, 0, 0));
    thrusterFlames.yMinus = createThrusterFlame(satGroup, new THREE.Vector3(0, -0.35, 0), new THREE.Euler(Math.PI, 0, 0));

    satGroup.scale.setScalar(0.55);

    satellite = satGroup;
    scene.add(satellite);
}

function createThrusterFlame(parent, position, rotation) {
    const flameGeo = new THREE.ConeGeometry(0.05, 0.28, 8);
    const flameMat = new THREE.MeshBasicMaterial({
        color: 0x66ddff,
        transparent: true,
        opacity: 0.0
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.copy(position);
    flame.rotation.copy(rotation);
    flame.visible = false;
    parent.add(flame);
    return flame;
}

function createOrbitPath() {
    const curve = new THREE.EllipseCurve(0, 0, 3.5, 3.5, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(120);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
        color: 0x336688,
        dashSize: 0.15,
        gapSize: 0.15,
        transparent: true,
        opacity: 0.5
    });
    orbitPathLine = new THREE.Line(geometry, material);
    orbitPathLine.rotation.x = Math.PI / 2;
    orbitPathLine.computeLineDistances();
    scene.add(orbitPathLine);
}

export function setOrbitPathVisibility(isVisible) {
    if (orbitPathLine) orbitPathLine.visible = isVisible;
}

export function checkEclipse() {
    if (!satellite) {
        return { isInSunlight: true, satPos: null };
    }
    const satPos = satellite.position.clone();
    const sunDirection = new THREE.Vector3(-2, 0.5, 1.5).normalize();
    const earthToSat = satPos.clone().normalize();
    const dotProduct = earthToSat.dot(sunDirection);
    const isInSunlight = dotProduct > -0.3;
    return { isInSunlight, satPos };
}

function setupManeuverControls() {
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (key === 'w' || key === 'arrowup') activeKeys.w = true;
        if (key === 's' || key === 'arrowdown') activeKeys.s = true;
        if (key === 'a' || key === 'arrowleft') activeKeys.a = true;
        if (key === 'd' || key === 'arrowright') activeKeys.d = true;
        if (key === 'q') activeKeys.q = true;
        if (key === 'e') activeKeys.e = true;
    });

    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (key === 'w' || key === 'arrowup') activeKeys.w = false;
        if (key === 's' || key === 'arrowdown') activeKeys.s = false;
        if (key === 'a' || key === 'arrowleft') activeKeys.a = false;
        if (key === 'd' || key === 'arrowright') activeKeys.d = false;
        if (key === 'q') activeKeys.q = false;
        if (key === 'e') activeKeys.e = false;
    });
}

function processMovement() {
    Object.values(thrusterFlames).forEach(f => { if (f) f.visible = false; });
    
    // Prevent movement if battery is empty OR if movement is locked by a fault
    if (window.gameState && (window.gameState.battery <= 0 || window.gameState.faults?.lockedSystems?.includes('movement'))) {
        window.gameState.isThrusting = false;
        satelliteVelocity.multiplyScalar(SATELLITE_DAMPING);
        applyPhysics();
        return;
    }

    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    const camRight = new THREE.Vector3().crossVectors(camForward, camera.up).normalize();
    const camUp = new THREE.Vector3().crossVectors(camRight, camForward).normalize();

    let isMoving = false;

    const applyThrust = (keyFlag, vector, sign, flameName) => {
        if (keyFlag) {
            isMoving = true;
            satelliteVelocity.add(vector.clone().multiplyScalar(sign * SATELLITE_ACCEL));
            const flame = thrusterFlames[flameName];
            if (flame) {
                flame.visible = true;
                flame.material.opacity = 0.7 + Math.random() * 0.3;
                flame.scale.setScalar(0.8 + Math.random() * 0.5);
            }
        }
    };

    applyThrust(activeKeys.w, camForward, 1, 'zMinus');
    applyThrust(activeKeys.s, camForward, -1, 'zPlus');
    applyThrust(activeKeys.d, camRight, 1, 'xPlus');
    applyThrust(activeKeys.a, camRight, -1, 'xMinus');
    applyThrust(activeKeys.e, camUp, 1, 'yMinus');
    applyThrust(activeKeys.q, camUp, -1, 'yPlus');

    if (window.gameState) {
        window.gameState.isThrusting = isMoving;
    }

    satelliteVelocity.multiplyScalar(SATELLITE_DAMPING);
    applyPhysics();
}

function applyPhysics() {
    const logicalPos = new THREE.Vector3(
        currentOrbitRadius * Math.cos(currentOrbitAngle),
        satelliteOffset.y,
        currentOrbitRadius * Math.sin(currentOrbitAngle)
    );

    logicalPos.add(satelliteVelocity);

    currentOrbitRadius = Math.sqrt(logicalPos.x * logicalPos.x + logicalPos.z * logicalPos.z);
    currentOrbitRadius = Math.max(1.3, Math.min(8.0, currentOrbitRadius));

    const newAngle = Math.atan2(logicalPos.z, logicalPos.x);
    let angleDiff = newAngle - currentOrbitAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    currentOrbitAngle += angleDiff;
    satelliteOffset.y = Math.max(-3, Math.min(3, logicalPos.y));

    if (orbitPathLine) {
        orbitPathLine.scale.set(currentOrbitRadius / 3.5, currentOrbitRadius / 3.5, 1);
        orbitPathLine.position.y = satelliteOffset.y;
    }
}

function updateSatellitePosition() {
    currentOrbitAngle += ORBIT_SPEED;
    currentOrbitAngle %= (Math.PI * 2);

    const x = currentOrbitRadius * Math.cos(currentOrbitAngle);
    const z = currentOrbitRadius * Math.sin(currentOrbitAngle);
    const y = satelliteOffset.y;

    satellite.position.set(x, y, z);

    const nextAngle = currentOrbitAngle + 0.01;
    const nextX = currentOrbitRadius * Math.cos(nextAngle);
    const nextZ = currentOrbitRadius * Math.sin(nextAngle);
    satellite.lookAt(nextX, y, nextZ);
}

export function animateScene() {
    processMovement();
    updateSatellitePosition();

    if (orbitControls) orbitControls.update();

    if (earthMesh) earthMesh.rotation.y += 0.0008;
    if (lightsMesh) lightsMesh.rotation.y += 0.0008;
    if (cloudsMesh) cloudsMesh.rotation.y += 0.0009;

    if (moonGroup) moonGroup.rotation.y += 0.0006;

    panelGlowTime += 0.02;
    const { isInSunlight } = checkEclipse();
    solarPanelMeshes.forEach(p => {
        if (isInSunlight) {
            const glow = 0.018 + 0.006 * Math.sin(panelGlowTime);
            p.material.emissive = new THREE.Color(glow * 0.2, glow * 0.5, glow * 1.2);
        } else {
            p.material.emissive = new THREE.Color(0, 0, 0);
        }
        p.material.needsUpdate = true;
    });

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    const canvas = document.getElementById('gameCanvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getSatellitePosition() { return satellite ? satellite.position.clone() : null; }
export function getOrbitAngle() { return currentOrbitAngle; }
export function getMoonPosition() { return moonMesh ? moonMesh.position.clone() : null; }