console.log('📍 scene.js module loading...');

// ==================== IMPORTS ====================
import { getFresnelMat } from './getFresnelMat.js';
import getStarfield from './getStarfield.js';

// ==================== THREE.JS SCENE SETUP ====================
let scene, camera, renderer, earthGroup, satellite, sunLight, loader, orbitControls;

// Orbit parameters
const ORBIT_RADIUS = 2.1; // smaller primary orbit radius
const ORBIT_RADIUS_2 = 1.6; // smaller secondary orbit radius
const EARTH_RADIUS = 1;
const SATELLITE_SIZE = 0.3;
const ORBIT_SPEED = 0.000575; // primary orbit speed (radians per ms)
const ORBIT_SPEED_2 = 0.00069; // secondary orbit speed a bit faster

// Sun parameters (faster than satellite)
const SUN_ORBIT_RADIUS = 15;
const SUN_SPEED = 0.00138; // ~15% faster

let currentOrbitAngle1 = 0;
let currentOrbitAngle2 = Math.PI;
let orbitStartTime = Date.now();
let sunAngle = 0;
let sunMesh;
let earthMesh, lightsMesh, cloudsMesh, moonMesh;
let satelliteOffset = new THREE.Vector3(0, 0, 0);
const SATELLITE_MANEUVER_SPEED = 0.02;
let moonGroup;

// Player 1 orbit angle adjustment (for WASD movement)
let player1OrbitAngleOffset = 0;
const PLAYER1_ORBIT_ADJUSTMENT_SPEED = 0.005; // radians per ms (increased for faster movement)
const PLAYER1_RADIUS_ADJUSTMENT_SPEED = 0.003; // per frame

// Player 2 orbit angle adjustment (for gamepad movement)
let player2OrbitAngleOffset = 0;
let currentOrbitRadiusP2 = ORBIT_RADIUS_2; // Track Player 2's current orbit radius
const PLAYER2_ORBIT_ADJUSTMENT_SPEED = 0.005; // radians per ms
const PLAYER2_RADIUS_ADJUSTMENT_SPEED = 0.003; // per frame

let satellitePrimary = null;
let satelliteSecondary = null;


// ==================== SCENE INITIALIZATION ====================
export function initScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    console.log('✅ Scene created');

    // Setup camera
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('❌ Canvas not found! Check index.html');
        return;
    }
    
    console.log('📍 Canvas element found:', canvas.id);
    
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    console.log(`📍 Canvas size BEFORE: ${width}x${height}px (display) | ${canvas.width}x${canvas.height}px (actual)`);
    
    if (width === 0 || height === 0) {
        console.error('❌ CRITICAL: Canvas has zero width or height! CSS display issue?');
    }
    
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, 0);
    console.log('✅ Camera created at position', camera.position);

    // Setup renderer with tone mapping for realistic lighting
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Allow canvas to be clicked to focus
    canvas.addEventListener('click', () => canvas.focus());
    
    // Don't force focus on load - let window handle keyboard input
    // canvas.focus() forces focus but may prevent keyboard input on some browsers
    
    canvas.width = width;
    canvas.height = height;
    console.log(`📍 Canvas size AFTER: ${canvas.clientWidth}x${canvas.clientHeight}px (display) | ${canvas.width}x${canvas.height}px (actual)`);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    console.log('✅ WebGL Renderer created with tone mapping');

    // Create texture loader with debugging
    loader = new THREE.TextureLoader();
    console.log('✅ TextureLoader created');

    // Create Earth with multiple layers
    createEarth();

    // Create Satellite
    createSatellite();

    // Create Lighting
    createLighting();

    // Create Moon
    createMoon();

    // Add stars background
    createStarfield();

    // Setup OrbitControls for dragging and viewing
    if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
        orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.05;
        orbitControls.enableZoom = true;
        orbitControls.zoomSpeed = 1.0;
        orbitControls.enableRotate = true;
        orbitControls.autoRotate = false;
        orbitControls.target.set(0, 0, 0);
        orbitControls.minDistance = 3;    // can't zoom inside Earth
        orbitControls.maxDistance = 22;   // can't zoom to infinity
        orbitControls.update();

        orbitControls.enableKeys = false; // stops OrbitControls eating arrow keys
        
        console.log('✅ OrbitControls enabled - drag to rotate, scroll to zoom');
    } else {
        console.warn('⚠️ OrbitControls not available');
    }

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Setup manual satellite maneuver controls
    setupManeuverControls();
    // NOTE: setupManualCameraControl() is intentionally removed

    console.log('✅ Three.js scene fully initialized');
    console.log('Scene children count:', scene.children.length);
}

// ==================== CREATE EARTH ====================
function createEarth() {
    // Create a group for the Earth (allows rotation, tilt, positioning)
    earthGroup = new THREE.Group();
    earthGroup.rotation.z = -23.4 * Math.PI / 180; // Earth's axial tilt
    scene.add(earthGroup);

    // Create base geometry for all Earth components
    const detail = 12;
    const geometry = new THREE.IcosahedronGeometry(EARTH_RADIUS, detail);

    console.log('Loading Earth textures from ./public/textures/');

    // ===== Main Earth Mesh =====
    const mapTexture = loader.load(
        "./public/textures/00_earthmap1k.jpg",
        () => console.log('✅ Earth map loaded'),
        undefined,
        () => console.error('❌ Error loading earth map')
    );
    const specTexture = loader.load(
        "./public/textures/02_earthspec1k.jpg",
        () => console.log('✅ Specular map loaded'),
        undefined,
        () => console.error('❌ Error loading specular map')
    );
    const bumpTexture = loader.load(
        "./public/textures/01_earthbump1k.jpg",
        () => console.log('✅ Bump map loaded'),
        undefined,
        () => console.error('❌ Error loading bump map')
    );

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
    console.log('✅ Earth mesh added');

    // ===== Lights Mesh (city lights at night) =====
    const lightsTexture = loader.load(
        "./public/textures/03_earthlights1k.jpg",
        () => console.log('✅ Lights map loaded'),
        undefined,
        () => console.error('❌ Error loading lights map')
    );
    const lightsMat = new THREE.MeshBasicMaterial({
        map: lightsTexture,
        blending: THREE.AdditiveBlending,
    });
    lightsMesh = new THREE.Mesh(geometry, lightsMat);
    earthGroup.add(lightsMesh);
    console.log('✅ Lights mesh added');

    // ===== Clouds Mesh =====
    const cloudsTexture = loader.load(
        "./public/textures/04_earthcloudmap.jpg",
        () => console.log('✅ Clouds map loaded'),
        undefined,
        () => console.error('❌ Error loading clouds map')
    );
    const cloudsAlphaTexture = loader.load(
        "./public/textures/05_earthcloudmaptrans.jpg",
        () => console.log('✅ Clouds alpha loaded'),
        undefined,
        () => console.error('❌ Error loading clouds alpha')
    );
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
    console.log('✅ Clouds mesh added');

    // ===== Glow/Atmosphere Mesh =====
    const fresnelMat = getFresnelMat();
    const glowMesh = new THREE.Mesh(geometry, fresnelMat);
    glowMesh.scale.setScalar(1.01);
    earthGroup.add(glowMesh);

    // Add orbit paths around Earth for satellites
    createOrbitPaths();

    console.log('✅ Earth created with premium multi-layer textures');
}

// ==================== CREATE ORBIT PATHS ====================
let orbitPath1, orbitPath2;
let currentOrbitRadiusP1 = ORBIT_RADIUS; // Track Player 1's current orbit radius

function createOrbitPaths() {
    // Primary orbit: dotted line
    updateOrbitPath1Display(ORBIT_RADIUS);

    // Secondary orbit: dotted line
    updateOrbitPath2Display(ORBIT_RADIUS_2);
}

// Update orbit path 1 (Player 1) based on movement direction
function updateOrbitPath1Display(radius) {
    // Remove old path if exists
    if (orbitPath1) {
        scene.remove(orbitPath1);
    }

    currentOrbitRadiusP1 = radius;
    const points1 = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        points1.push(new THREE.Vector3(x, 0, z));
    }
    const geom1 = new THREE.BufferGeometry().setFromPoints(points1);
    const mat1 = new THREE.LineDashedMaterial({
        color: 0xcccc00,
        dashSize: 0.2,
        gapSize: 0.1,
        linewidth: 2,
        transparent: true,
        opacity: 0.85
    });
    orbitPath1 = new THREE.Line(geom1, mat1);
    orbitPath1.computeLineDistances();
    scene.add(orbitPath1);
}

// Update orbit path 2 (Player 2) based on movement direction
function updateOrbitPath2Display(radius) {
    // Remove old path if exists
    if (orbitPath2) {
        scene.remove(orbitPath2);
    }

    currentOrbitRadiusP2 = radius;
    const points2 = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        points2.push(new THREE.Vector3(x, 0, z));
    }
    const geom2 = new THREE.BufferGeometry().setFromPoints(points2);
    const mat2 = new THREE.LineDashedMaterial({
        color: 0xff7f0f,
        dashSize: 0.2,
        gapSize: 0.1,
        linewidth: 2,
        transparent: true,
        opacity: 0.85
    });
    orbitPath2 = new THREE.Line(geom2, mat2);
    orbitPath2.computeLineDistances();
    scene.add(orbitPath2);
}

// ==================== CREATE LIGHTING ====================
function createLighting() {
    createSun();

    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x333366, 0.45);
    scene.add(ambientLight);

    console.log('✅ Lighting created');
}

// ==================== CREATE SUN ====================
function createSun() {
    sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(SUN_ORBIT_RADIUS, 0, 0);
    sunLight.castShadow = true;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    // Visible sun object (for camera POV)
    const sunGeometry = new THREE.SphereGeometry(0.8, 24, 24);
    const sunMaterial = new THREE.MeshStandardMaterial({
        color: 0xffe68a,
        emissive: 0xffa500,
        emissiveIntensity: 2,
        map: loader ? loader.load('./public/textures/03_earthlights1k.jpg') : null,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });
    sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.position.copy(sunLight.position);
    scene.add(sunMesh);

    console.log('☀️ Sun created with orbit radius', SUN_ORBIT_RADIUS);
}

// ==================== CREATE STARFIELD ====================
function createStarfield() {
    const stars = getStarfield({ numStars: 2000 });
    scene.add(stars);
    console.log('✅ Starfield created');
}

// ==================== CREATE MOON ====================
function createMoon() {
    moonGroup = new THREE.Group();
    scene.add(moonGroup);

    const moonGeometry = new THREE.IcosahedronGeometry(1, 10);
    const moonMaterial = new THREE.MeshStandardMaterial({
        color: 0xd3d3d3,
        roughness: 0.8,
        metalness: 0.0
    });
    moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.position.set(4, 1, 0); // Positioned near Earth
    moonMesh.scale.setScalar(0.27); // 27% of Earth size
    moonMesh.castShadow = true;
    moonMesh.receiveShadow = true;
    moonGroup.add(moonMesh);

    // Try to load moon textures if available
    loader.load(
        "./public/textures/06_moonmap4k.jpg",
        (texture) => {
            moonMaterial.map = texture;
            moonMaterial.needsUpdate = true;
            console.log('✅ Moon map loaded');
        },
        undefined,
        () => console.log('📝 Moon map not found (using default gray)')
    );

    loader.load(
        "./public/textures/07_moonbump4k.jpg",
        (texture) => {
            moonMaterial.bumpMap = texture;
            moonMaterial.bumpScale = 2;
            moonMaterial.needsUpdate = true;
            console.log('✅ Moon bump map loaded');
        },
        undefined,
        () => console.log('📝 Moon bump map not found')
    );

    console.log('✅ Moon created');
}

// ==================== CREATE SATELLITE ====================
function createSatelliteModel(colorBody = 0x333333, colorPanel = 0x1a1a4d) {
    const satGroup = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.4);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: colorBody,
        metalness: 0.8,
        roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    satGroup.add(body);

    const panelGeometry = new THREE.BoxGeometry(0.15, 0.35, 0.05);
    const panelMaterial = new THREE.MeshPhongMaterial({
        color: colorPanel,
        emissive: 0x0a0a3d,
        shininess: 100
    });
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -0.25;
    leftPanel.castShadow = true;
    leftPanel.receiveShadow = true;
    satGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.x = 0.25;
    rightPanel.castShadow = true;
    rightPanel.receiveShadow = true;
    satGroup.add(rightPanel);

    const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({
        color: 0xffaa00,
        shininess: 100
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.y = 0.25;
    antenna.castShadow = true;
    antenna.receiveShadow = true;
    satGroup.add(antenna);

    return satGroup;
}

function createSatellite() {
    satellitePrimary = createSatelliteModel(0x0066cc, 0x0088ff); // blue satellite (Player 1)
    satelliteSecondary = createSatelliteModel(0xff6a13, 0xffa040); // orange satellite (Player 2)

    scene.add(satellitePrimary);
    scene.add(satelliteSecondary);

    updateSatellitePosition();

    console.log('✅ Two satellites created in orbit');
}

// ==================== UPDATE SATELLITE POSITION ====================
function updateSatellitePosition() {
    const elapsedTime = Date.now() - orbitStartTime;

    currentOrbitAngle1 = (elapsedTime * ORBIT_SPEED + player1OrbitAngleOffset) % (Math.PI * 2);
    currentOrbitAngle2 = (elapsedTime * ORBIT_SPEED_2 + player2OrbitAngleOffset + Math.PI * 0.5) % (Math.PI * 2);

    // Primary satellite (Player 1 - blue) - uses dynamic radius
    const x1 = currentOrbitRadiusP1 * Math.cos(currentOrbitAngle1);
    const z1 = currentOrbitRadiusP1 * Math.sin(currentOrbitAngle1);
    const y1 = currentOrbitRadiusP1 * 0.15 * Math.sin(currentOrbitAngle1 * 0.8);
    const pos1 = new THREE.Vector3(x1, y1, z1).add(satelliteOffset);
    if (satellitePrimary) {
        satellitePrimary.position.copy(pos1);
        const nextAngle1 = (currentOrbitAngle1 + 0.02) % (Math.PI * 2);
        const nextX1 = currentOrbitRadiusP1 * Math.cos(nextAngle1) + satelliteOffset.x;
        const nextZ1 = currentOrbitRadiusP1 * Math.sin(nextAngle1) + satelliteOffset.z;
        satellitePrimary.lookAt(nextX1, y1 + satelliteOffset.y, nextZ1);
    }

    // Secondary satellite (Player 2 - orange) - uses dynamic radius
    const x2 = currentOrbitRadiusP2 * Math.cos(currentOrbitAngle2);
    const z2 = currentOrbitRadiusP2 * Math.sin(currentOrbitAngle2);
    const y2 = currentOrbitRadiusP2 * 0.18 * Math.sin(currentOrbitAngle2 * 1.1);
    const pos2 = new THREE.Vector3(x2, y2, z2);
    if (satelliteSecondary) {
        satelliteSecondary.position.copy(pos2);
        const nextAngle2 = (currentOrbitAngle2 + 0.02) % (Math.PI * 2);
        const nextX2 = currentOrbitRadiusP2 * Math.cos(nextAngle2);
        const nextZ2 = currentOrbitRadiusP2 * Math.sin(nextAngle2);
        satelliteSecondary.lookAt(nextX2, y2, nextZ2);
    }

    // Intentionally no satellite-satellite collision reaction, they pass through each other
}


// ==================== SOLAR BURST / ECLIPSE DETECTION ====================
const SOLAR_BURST_MIN_DELAY = 15000; // ms
const SOLAR_BURST_MAX_DELAY = 30000; // ms
const SOLAR_BURST_DURATION = 2200; // ms
const SOLAR_BURST_DAMAGE = 12; // battery percent immediate hit
const SOLAR_BURST_ALIGNMENT_THRESHOLD = 0.70; // range of alignment dot-product for satellite to be hit

let solarBurstActive = false;
let solarBurstStartTime = 0;
let nextSolarBurstTime = Date.now() + (SOLAR_BURST_MIN_DELAY + Math.random() * (SOLAR_BURST_MAX_DELAY - SOLAR_BURST_MIN_DELAY));

function scheduleNextSolarBurst() {
    nextSolarBurstTime = Date.now() + SOLAR_BURST_MIN_DELAY + Math.random() * (SOLAR_BURST_MAX_DELAY - SOLAR_BURST_MIN_DELAY);
    solarBurstActive = false;
    solarBurstStartTime = 0;
}

export function resetSolarBurst() {
    solarBurstActive = false;
    solarBurstStartTime = 0;
    scheduleNextSolarBurst();
    console.log('🌩️ Solar burst sequence reset');
}

function updateSolarBurst(satPos, sunDirection) {
    const now = Date.now();
    let justTriggered = false;

    if (solarBurstActive) {
        if (now - solarBurstStartTime >= SOLAR_BURST_DURATION) {
            scheduleNextSolarBurst();
        }
    } else if (now >= nextSolarBurstTime && satPos && sunDirection) {
        // Check if satellite is roughly in direction of the sun (vulnerable)
        const satDir = satPos.clone().normalize();
        const alignment = satDir.dot(sunDirection);
        if (alignment >= SOLAR_BURST_ALIGNMENT_THRESHOLD) {
            solarBurstActive = true;
            solarBurstStartTime = now;
            justTriggered = true;
        } else {
            // if not aligned, wait a short time to recheck
            nextSolarBurstTime = now + 3000;
        }
    }

    const timeRemaining = solarBurstActive ? Math.max(0, SOLAR_BURST_DURATION - (now - solarBurstStartTime)) : 0;
    const nextIn = solarBurstActive ? 0 : Math.max(0, nextSolarBurstTime - now);

    return {
        active: solarBurstActive,
        justTriggered,
        timeRemaining,
        nextIn,
        damage: justTriggered ? SOLAR_BURST_DAMAGE : 0
    };
}

let eclipseLogCounter = 0;
export function checkEclipse() {
    eclipseLogCounter++;
    
    // Get satellite position
    if (!satellitePrimary) {
        console.warn('⚠️ checkEclipse: satellitePrimary is NULL!');
        return { litByLight: true, satPos: null };
    }
    
    const satPos = satellitePrimary.position.clone();

    // Use DirectionalLight position to determine if satellite is lit
    // The light comes FROM the light position
    const lightDir = sunLight ? sunLight.position.clone().normalize() : new THREE.Vector3(1, 1, 0).normalize();
    
    // Vector from Earth center to satellite (normalized)
    const earthToSat = satPos.clone().normalize();

    // Calculate dot product: if positive, satellite faces the light (sunlit)
    // if negative, satellite faces away from light (in eclipse)
    const dotProduct = earthToSat.dot(lightDir);
    
    // Satellite is lit if facing the light direction
    const litByLight = dotProduct >= 0;
    
    // Log every 300 calls (~5 seconds at 60fps)
    if (eclipseLogCounter % 300 === 0) {
        console.log(`🌍 checkEclipse: dot=${dotProduct.toFixed(2)} → ${litByLight ? '☀️ SUNLIT' : '🌘 ECLIPSE'}`);
    }

    return { litByLight, satPos };
}

function setupManeuverControls() {
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        // prevents browser scroll on WASD/arrows
        const controlledKeys = ['w', 's', 'a', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
        
        if (controlledKeys.includes(key)) {
            event.preventDefault();
        }
        if (key === 'w' || key === 'arrowup') {
            satelliteOffset.z -= SATELLITE_MANEUVER_SPEED;
        }
        if (key === 's' || key === 'arrowdown') {
            satelliteOffset.z += SATELLITE_MANEUVER_SPEED;
        }
        if (key === 'a' || key === 'arrowleft') {
            satelliteOffset.x -= SATELLITE_MANEUVER_SPEED;
        }
        if (key === 'd' || key === 'arrowright') {
            satelliteOffset.x += SATELLITE_MANEUVER_SPEED;
        }
        if (key === 'q') {
            satelliteOffset.y += SATELLITE_MANEUVER_SPEED;
        }
        if (key === 'e') {
            satelliteOffset.y -= SATELLITE_MANEUVER_SPEED;
        }

        // Keep offset bounded
        satelliteOffset.clamp(
            new THREE.Vector3(-3, -2, -3),
            new THREE.Vector3(3, 2, 3)
        );
    });

    console.log('✅ Maneuver controls active: WASD/Arrow keys + Q/E to adjust satellite position');
}

// ==================== ANIMATE SCENE ====================
export function animateScene() {
    // Update satellite position
    updateSatellitePosition();

    // Update OrbitControls
    if (orbitControls) {
        orbitControls.update();
    }

    // Rotate Earth layers
    if (earthMesh) earthMesh.rotation.y += 0.002;
    if (lightsMesh) lightsMesh.rotation.y += 0.002;
    if (cloudsMesh) cloudsMesh.rotation.y += 0.0023;

    // Sun orbit (faster than satellite)
    sunAngle = (sunAngle + SUN_SPEED) % (Math.PI * 2);
    if (sunLight) {
        const sunX = SUN_ORBIT_RADIUS * Math.cos(sunAngle);
        const sunZ = SUN_ORBIT_RADIUS * Math.sin(sunAngle);
        sunLight.position.set(sunX, 0, sunZ);
        sunLight.target.position.set(0, 0, 0);
        sunLight.target.updateMatrixWorld();
    }
    if (sunMesh) {
        sunMesh.position.copy(sunLight.position);
    }

    // Rotate Moon
    if (moonGroup) moonGroup.rotation.y += 0.01;

    // Render scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.warn('⚠️ animateScene: Missing renderer, scene, or camera!', {
            renderer: !!renderer,
            scene: !!scene,
            camera: !!camera
        });
    }
}

// ==================== WINDOW RESIZE HANDLER ====================
function onWindowResize() {
    const canvas = document.getElementById('gameCanvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ==================== GETTERS ====================
export function getScene() {
    return scene;
}

export function getCamera() {
    return camera;
}

export function getRenderer() {
    return renderer;
}

export function getSatellitePosition() {
    return satellitePrimary ? satellitePrimary.position.clone() : null;
}

export function getSatellitePositions() {
    const pos1 = satellitePrimary ? satellitePrimary.position.clone() : null;
    const pos2 = satelliteSecondary ? satelliteSecondary.position.clone() : null;
    return { sat1: pos1, sat2: pos2 };
}

export function getOrbitAngle() {
    return currentOrbitAngle;
}

export function getMoonPosition() {
    return moonMesh ? moonMesh.position.clone() : null;
}

export function resetSatelliteOffset() {
    satelliteOffset.set(0, 0, 0);
}

export function adjustPlayer1OrbitAngle(direction) {
    // direction: 'clockwise' (+) | 'counterclockwise' (-)
    const adjustment = direction === 'clockwise' ? PLAYER1_ORBIT_ADJUSTMENT_SPEED : -PLAYER1_ORBIT_ADJUSTMENT_SPEED;
    player1OrbitAngleOffset += adjustment;
}

export function resetPlayer1OrbitOffset() {
    player1OrbitAngleOffset = 0;
}

// Get satellite position with direction offset for boost animation
export function getPlayer1BoostAnimationOffset(direction) {
    // Returns offset direction for boost particle effect based on WASD key
    // direction: 'forward', 'left', 'backward', 'right'
    const satPos = satellitePrimary ? satellitePrimary.position.clone() : new THREE.Vector3(0, 0, 0);
    const normDir = satPos.clone().normalize();
    
    switch(direction) {
        case 'forward':
        case 'left':
            // Counterclockwise: boost on the direction perpendicular to radius (tangent)
            return new THREE.Vector3(-normDir.z, 0, normDir.x).multiplyScalar(0.3);
        case 'backward':
        case 'right':
            // Clockwise: boost opposite direction
            return new THREE.Vector3(normDir.z, 0, -normDir.x).multiplyScalar(0.3);
        default:
            return new THREE.Vector3(0, 0, 0);
    }
}

// Update orbit radius for Player 1 based on movement
export function updatePlayer1OrbitRadius(direction) {
    // W/A: Inner orbit (decrease radius), S/D: Outer orbit (increase radius)
    const minRadius = 1.2;
    const maxRadius = 2.8;
    
    if (direction === 'counterclockwise') {
        // W/A: Move to inner orbit
        const newRadius = Math.max(minRadius, currentOrbitRadiusP1 - PLAYER1_RADIUS_ADJUSTMENT_SPEED);
        updateOrbitPath1Display(newRadius);
    } else if (direction === 'clockwise') {
        // S/D: Move to outer orbit
        const newRadius = Math.min(maxRadius, currentOrbitRadiusP1 + PLAYER1_RADIUS_ADJUSTMENT_SPEED);
        updateOrbitPath1Display(newRadius);
    }
}

export function resetPlayer1OrbitRadius() {
    updateOrbitPath1Display(ORBIT_RADIUS);
}

export function adjustPlayer2OrbitAngle(direction) {
    // direction: 'clockwise' (+) | 'counterclockwise' (-)
    const adjustment = direction === 'clockwise' ? PLAYER2_ORBIT_ADJUSTMENT_SPEED : -PLAYER2_ORBIT_ADJUSTMENT_SPEED;
    player2OrbitAngleOffset += adjustment;
}

export function resetPlayer2OrbitOffset() {
    player2OrbitAngleOffset = 0;
}

// Get satellite position with direction offset for boost animation
export function getPlayer2BoostAnimationOffset(direction) {
    // Returns offset direction for boost particle effect based on gamepad input
    // direction: 'forward', 'left', 'backward', 'right', or 'up'/'down' from analog stick
    const satPos = satelliteSecondary ? satelliteSecondary.position.clone() : new THREE.Vector3(0, 0, 0);
    const normDir = satPos.clone().normalize();
    
    switch(direction) {
        case 'forward':
        case 'left':
        case 'up':
            // Counterclockwise: boost on the direction perpendicular to radius (tangent)
            return new THREE.Vector3(-normDir.z, 0, normDir.x).multiplyScalar(0.3);
        case 'backward':
        case 'right':
        case 'down':
            // Clockwise: boost opposite direction
            return new THREE.Vector3(normDir.z, 0, -normDir.x).multiplyScalar(0.3);
        default:
            return new THREE.Vector3(0, 0, 0);
    }
}

// Update orbit radius for Player 2 based on movement
export function updatePlayer2OrbitRadius(direction) {
    // Up/Left: Inner orbit (decrease radius), Down/Right: Outer orbit (increase radius)
    const minRadius = 0.8;
    const maxRadius = 2.4;
    
    if (direction === 'counterclockwise') {
        // Up/Left: Move to inner orbit
        const newRadius = Math.max(minRadius, currentOrbitRadiusP2 - PLAYER2_RADIUS_ADJUSTMENT_SPEED);
        updateOrbitPath2Display(newRadius);
    } else if (direction === 'clockwise') {
        // Down/Right: Move to outer orbit
        const newRadius = Math.min(maxRadius, currentOrbitRadiusP2 + PLAYER2_RADIUS_ADJUSTMENT_SPEED);
        updateOrbitPath2Display(newRadius);
    }
}

export function resetPlayer2OrbitRadius() {
    updateOrbitPath2Display(ORBIT_RADIUS_2);
}

// Export solar burst function for game logic (resetSolarBurst is already exported on declaration)
export { updateSolarBurst };
