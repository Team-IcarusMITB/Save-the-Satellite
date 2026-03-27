// ==================== DEBRIS SYSTEM ====================
import { getSatellitePosition } from './scene.js';

const DEBRIS_SIZE = 0.15;
const DEBRIS_SPEED = 0.08;
const DEBRIS_SPAWN_DISTANCE = 15;
const COLLISION_DISTANCE = 0.8;
const WARNING_DISTANCE = 9;
const MIN_APPROACH_SPEED = 0.015;
const DEBRIS_PROBABILITY = 0.0008; // ~0.08% chance per frame = debris every ~2 seconds

let debrisArray = [];
let scene;
let debrisMeshes = [];

// ==================== INITIALIZE DEBRIS SYSTEM ====================
export function initDebris(sceneRef) {
    scene = sceneRef;
    console.log('✅ Debris system initialized');
}

// ==================== GENERATE DEBRIS ====================
function generateDebris() {
    // Random position on a sphere around Earth
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI * 2;
    
    const x = DEBRIS_SPAWN_DISTANCE * Math.cos(angle1) * Math.sin(angle2);
    const y = DEBRIS_SPAWN_DISTANCE * Math.sin(angle1) * Math.sin(angle2);
    const z = DEBRIS_SPAWN_DISTANCE * Math.cos(angle2);

    // Create debris mesh
    const debrisGeometry = new THREE.IcosahedronGeometry(DEBRIS_SIZE, 2);
    const debrisMaterial = new THREE.MeshPhongMaterial({
        color: 0x888888,
        emissive: 0x444444,
        shininess: 50
    });
    const debrisMesh = new THREE.Mesh(debrisGeometry, debrisMaterial);
    debrisMesh.position.set(x, y, z);
    debrisMesh.castShadow = true;
    debrisMesh.receiveShadow = true;

    scene.add(debrisMesh);

    const spawnPos = new THREE.Vector3(x, y, z);
    const satellitePosition = getSatellitePosition() || new THREE.Vector3(0, 0, 0);

    // Build a mostly straight pass trajectory near the satellite so the player can dodge.
    const toSatellite = satellitePosition.clone().sub(spawnPos).normalize();
    const randomAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    let lateral = toSatellite.clone().cross(randomAxis);
    if (lateral.lengthSq() < 0.001) {
        lateral = toSatellite.clone().cross(new THREE.Vector3(0, 1, 0));
    }
    lateral.normalize();

    // Most asteroids miss by a decent margin; a few are tighter to stay challenging.
    const isTightPass = Math.random() < 0.22;
    const missDistance = isTightPass
        ? 0.2 + Math.random() * 0.45
        : 0.9 + Math.random() * 1.9;

    const targetPoint = satellitePosition
        .clone()
        .add(lateral.multiplyScalar((Math.random() < 0.5 ? -1 : 1) * missDistance));

    const direction = targetPoint.sub(spawnPos).normalize();
    const speed = DEBRIS_SPEED * (0.85 + Math.random() * 0.35);

    const debris = {
        mesh: debrisMesh,
        position: spawnPos,
        velocity: direction.multiplyScalar(speed),
        baseSpeed: speed,
        rotationVelocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        ),
        age: 0,
        maxAge: 30000 // 30 seconds
    };

    debrisArray.push(debris);
    debrisMeshes.push(debrisMesh);
    console.log(`⚠️ Debris spawned! Total: ${debrisArray.length}`);
    return debris;
}

// ==================== UPDATE DEBRIS ====================
export function updateDebris(gameState) {
    const debrisDifficulty = gameState.difficulty || null;
    const spawnMultiplier = debrisDifficulty ? debrisDifficulty.debrisSpawnMultiplier || 1 : 1;
    const speedMultiplier = debrisDifficulty ? debrisDifficulty.debrisSpeedMultiplier || 1 : 1;

    // Randomly spawn new debris
    if (Math.random() < DEBRIS_PROBABILITY * spawnMultiplier && !gameState.gameOver) {
        generateDebris();
    }

    // Update existing debris
    const satPos = getSatellitePosition();
    if (!satPos) return;

    let strongestIncomingWarning = null;
    let bestThreatScore = Number.POSITIVE_INFINITY;

    for (let i = debrisArray.length - 1; i >= 0; i--) {
        const debris = debrisArray[i];

        // Scale speed gradually with survival difficulty.
        if (Math.abs(speedMultiplier - 1) > 0.001 && debris.velocity.lengthSq() > 0.00001) {
            const targetSpeed = debris.baseSpeed * speedMultiplier;
            debris.velocity.setLength(targetSpeed);
        }

        // Update position
        debris.position.add(debris.velocity);
        debris.mesh.position.copy(debris.position);

        // Rotate debris
        debris.mesh.rotation.x += debris.rotationVelocity.x;
        debris.mesh.rotation.y += debris.rotationVelocity.y;
        debris.mesh.rotation.z += debris.rotationVelocity.z;

        // Age debris
        debris.age += 16.67; // ~60fps

        // Determine if this debris is a meaningful incoming threat for warning UI.
        const toSatellite = satPos.clone().sub(debris.position);
        const distance = toSatellite.length();
        if (distance > 0.001) {
            const approachSpeed = debris.velocity.dot(toSatellite.clone().normalize());
            if (distance <= WARNING_DISTANCE && approachSpeed > MIN_APPROACH_SPEED) {
                const threatScore = distance - approachSpeed * 8;
                if (threatScore < bestThreatScore) {
                    bestThreatScore = threatScore;
                    strongestIncomingWarning = resolveIncomingDirection(debris.position, satPos);
                }
            }
        }

        // Check collision with satellite
        if (distance < COLLISION_DISTANCE) {
            // Collision detected!
            gameState.debris.hits = (gameState.debris.hits || 0) + 1;
            console.log(`💥 COLLISION! Total hits: ${gameState.debris.hits}`);
            removeDebris(i);
            continue;
        }

        // Remove if too far or too old
        if (debris.position.length() > 20 || debris.age > debris.maxAge) {
            removeDebris(i);
        }
    }

    gameState.debris.warningDirection = strongestIncomingWarning;

    return debrisArray;
}

function resolveIncomingDirection(debrisPosition, satellitePosition) {
    const relative = debrisPosition.clone().sub(satellitePosition);
    const absX = Math.abs(relative.x);
    const absY = Math.abs(relative.y);
    const absZ = Math.abs(relative.z);

    if (absY > absX && absY > absZ) {
        return relative.y > 0 ? 'ABOVE' : 'BELOW';
    }

    if (absX >= absZ) {
        return relative.x > 0 ? 'RIGHT' : 'LEFT';
    }

    return relative.z > 0 ? 'FRONT' : 'BEHIND';
}

// ==================== REMOVE DEBRIS ====================
function removeDebris(index) {
    const debris = debrisArray[index];
    if (debris && debris.mesh) {
        scene.remove(debris.mesh);
    }
    debrisArray.splice(index, 1);
    debrisMeshes.splice(index, 1);
}

// ==================== GET DEBRIS COUNT ====================
export function getDebrisCount() {
    return debrisArray.length;
}

// ==================== CLEAR ALL DEBRIS ====================
export function clearAllDebris() {
    debrisArray.forEach(debris => {
        if (debris.mesh) scene.remove(debris.mesh);
    });
    debrisArray = [];
    debrisMeshes = [];
}

// ==================== GET DEBRIS ARRAY ====================
export function getDebrisArray() {
    return debrisArray;
}
