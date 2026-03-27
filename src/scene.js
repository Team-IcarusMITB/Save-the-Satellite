console.log('📍 scene.js module loading...');

// ==================== IMPORTS ====================
import { getFresnelMat } from './getFresnelMat.js';
import getStarfield from './getStarfield.js';

// ==================== THREE.JS SCENE SETUP ====================
let scene, camera, renderer, earthGroup, satellite, sunLight, loader, orbitControls;

// Orbit parameters
const ORBIT_RADIUS = 3.5; // Closer to Earth
const EARTH_RADIUS = 1;
const SATELLITE_SIZE = 0.3;
const ORBIT_SPEED = 0.0005; // radians per millisecond

let currentOrbitAngle = 0;
let orbitStartTime = Date.now();
let earthMesh, lightsMesh, cloudsMesh, moonMesh;
let satelliteOffset = new THREE.Vector3(0, 0, 0);
const SATELLITE_MANEUVER_SPEED = 0.02;
let moonGroup;

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
    
    // EXPLICITLY set canvas resolution to match display size
    canvas.addEventListener('click', () => canvas.focus());
    canvas.focus(); // grab focus on load
    
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

    console.log('✅ Earth created with premium multi-layer textures');
}

// ==================== CREATE LIGHTING ====================
function createLighting() {
    // Sun light (main directional light) - positioned from upper left
    sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(-2, 0.5, 1.5);
    scene.add(sunLight);

    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x333366, 0.6);
    scene.add(ambientLight);

    console.log('✅ Lighting created');
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
function createSatellite() {
    // Create a satellite group
    const satGroup = new THREE.Group();

    // Main body (central cube) - using MeshStandardMaterial for metalness/roughness support
    const bodyGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    satGroup.add(body);

    // Solar panels (left)
    const panelGeometry = new THREE.BoxGeometry(0.15, 0.35, 0.05);
    const panelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a4d,
        emissive: 0x0a0a3d,
        shininess: 100
    });
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -0.25;
    leftPanel.castShadow = true;
    leftPanel.receiveShadow = true;
    satGroup.add(leftPanel);

    // Solar panels (right)
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.x = 0.25;
    rightPanel.castShadow = true;
    rightPanel.receiveShadow = true;
    satGroup.add(rightPanel);

    // Antenna (small cylinder on top)
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

    satellite = satGroup;
    scene.add(satellite);

    // Set initial position
    updateSatellitePosition();

    console.log('✅ Satellite created with body, solar panels, and antenna');
}

// ==================== UPDATE SATELLITE POSITION ====================
function updateSatellitePosition() {
    // Calculate orbit angle based on elapsed time
    const elapsedTime = Date.now() - orbitStartTime;
    currentOrbitAngle = (elapsedTime * ORBIT_SPEED) % (Math.PI * 2);

    // Calculate satellite position using parametric circle equation
    const x = ORBIT_RADIUS * Math.cos(currentOrbitAngle);
    const z = ORBIT_RADIUS * Math.sin(currentOrbitAngle);
    const y = ORBIT_RADIUS * 0.2 * Math.sin(currentOrbitAngle * 0.5); // Slight vertical wobble for visual interest

    const position = new THREE.Vector3(x, y, z).add(satelliteOffset);
    satellite.position.copy(position);

    // Orient satellite to face direction of movement
    const nextAngle = (currentOrbitAngle + 0.01) % (Math.PI * 2);
    const nextX = ORBIT_RADIUS * Math.cos(nextAngle) + satelliteOffset.x;
    const nextZ = ORBIT_RADIUS * Math.sin(nextAngle) + satelliteOffset.z;
    satellite.lookAt(nextX, y + satelliteOffset.y, nextZ);

    // Debug: current satellite offset
    if (orbitControls && orbitControls.enabled && currentOrbitAngle % (Math.PI / 2) < 0.0001) {
        console.log('🛰️ Satellite offset:', satelliteOffset.x.toFixed(2), satelliteOffset.y.toFixed(2), satelliteOffset.z.toFixed(2));
    }
}

// ==================== ECLIPSE DETECTION ====================
let eclipseLogCounter = 0;
export function checkEclipse() {
    eclipseLogCounter++;
    // Simple eclipse logic: if satellite is behind Earth (relative to sun), it's in eclipse
    // Sun is positioned at (-2, 0.5, 1.5)
    
    // Get satellite position
    if (!satellite) {
        console.warn('⚠️ checkEclipse: satellite is NULL!');
        return { isInSunlight: true, satPos: null };
    }
    
    const satPos = satellite.position.clone();

    // Sun direction (normalized)
    const sunDirection = new THREE.Vector3(-2, 0.5, 1.5).normalize();
    
    // Vector from Earth center to satellite
    const earthToSat = satPos.clone().normalize();
    
    // Calculate dot product - if negative, satellite is on shadow side
    const dotProduct = earthToSat.dot(sunDirection);

    // If dot product is less than -0.3, satellite is likely in eclipse
    const isInSunlight = dotProduct > -0.3;
    
    // Log every 300 calls (~5 seconds at 60fps)
    if (eclipseLogCounter % 300 === 0) {
        console.log(`🌍 checkEclipse: dot=${dotProduct.toFixed(2)} → ${isInSunlight ? '☀️ SUNLIGHT' : '🌑 ECLIPSE'} | SatPos: (${satPos.x.toFixed(1)}, ${satPos.y.toFixed(1)}, ${satPos.z.toFixed(1)})`);
    }

    return { isInSunlight, satPos };
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
    return satellite ? satellite.position.clone() : null;
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
