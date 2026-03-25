import { getSatellitePosition, ORBIT_SPEED, currentOrbitRadius } from './scene.js';

const DEBRIS_SIZE = 0.15;
const DEBRIS_SPAWN_DISTANCE = 25;
const COLLISION_DISTANCE = 0.8;

let debrisArray = [];
let scene;
let debrisMeshes = [];
let lastSpawnTime = 0;

export function initDebris(sceneRef) {
    scene = sceneRef;
}

function generateDebris(type) {
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI * 2;
    const x = DEBRIS_SPAWN_DISTANCE * Math.cos(angle1) * Math.sin(angle2);
    const y = DEBRIS_SPAWN_DISTANCE * Math.sin(angle1) * Math.sin(angle2);
    const z = DEBRIS_SPAWN_DISTANCE * Math.cos(angle2);
    const startPos = new THREE.Vector3(x, y, z);

    const debrisGeometry = new THREE.IcosahedronGeometry(DEBRIS_SIZE, 0);
    const pos = debrisGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
            i,
            pos.getX(i) * (0.85 + Math.random() * 0.3),
            pos.getY(i) * (0.85 + Math.random() * 0.3),
            pos.getZ(i) * (0.85 + Math.random() * 0.3)
        );
    }
    pos.needsUpdate = true;
    debrisGeometry.computeVertexNormals();

    const debrisMaterial = new THREE.MeshPhongMaterial({
        color: 0xcc3300,
        emissive: 0x441100,
        flatShading: true
    });
    const debrisMesh = new THREE.Mesh(debrisGeometry, debrisMaterial);
    debrisMesh.position.set(x, y, z);
    scene.add(debrisMesh);

    const lineMat = new THREE.LineBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.4
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)
    ]);
    const trajectoryLine = new THREE.Line(lineGeo, lineMat);
    scene.add(trajectoryLine);

    let dir;
    const speed = 0.045 + Math.random() * 0.035;
    const satPos = getSatellitePosition() || new THREE.Vector3(0, 0, 0);

    if (type === 1) {
        const offset = new THREE.Vector3((Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4);
        dir = satPos.clone().add(offset).sub(startPos).normalize();
    } else if (type === 2) {
        dir = satPos.clone().sub(startPos).normalize();
    } else if (type === 3) {
        const dist = startPos.distanceTo(satPos);
        const framesToReach = dist / speed;
        const currentAngle = Math.atan2(satPos.z, satPos.x);
        const predictedAngle = currentAngle + (ORBIT_SPEED * framesToReach);
        const futureX = currentOrbitRadius * Math.cos(predictedAngle);
        const futureZ = currentOrbitRadius * Math.sin(predictedAngle);
        const futurePos = new THREE.Vector3(futureX, satPos.y, futureZ);
        dir = futurePos.sub(startPos).normalize();
    }

    const debris = {
        mesh: debrisMesh,
        line: trajectoryLine,
        position: startPos,
        velocity: dir.multiplyScalar(speed),
        rotationVelocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.04,
            (Math.random() - 0.5) * 0.04,
            (Math.random() - 0.5) * 0.04
        ),
        age: 0,
        maxAge: 60000,
        type: type,
        homingTimer: type === 2 ? 300 : 0
    };

    debrisArray.push(debris);
    debrisMeshes.push(debrisMesh);
    return debris;
}

export function setDebrisLinesVisibility(isVisible) {
    debrisArray.forEach(d => {
        if (d.line) d.line.visible = isVisible;
    });
}

export function updateDebris(gameState) {
    const now = Date.now();
    const spawnInterval = Math.max(10000, 40000 - (gameState.survivalTime * 500));
    
    if (now - lastSpawnTime > spawnInterval && !gameState.gameOver) {
        const count = 2 + Math.floor(gameState.survivalTime / 60);
        for(let i=0; i<count; i++) {
            const rand = Math.random();
            let type = 1;
            if(rand > 0.4 && rand <= 0.7) type = 2;
            else if(rand > 0.7) type = 3;
            generateDebris(type);
        }
        lastSpawnTime = now;
    }

    const satPos = getSatellitePosition();
    if (!satPos) return;

    for (let i = debrisArray.length - 1; i >= 0; i--) {
        const debris = debrisArray[i];

        if (debris.type === 2 && debris.homingTimer > 0) {
            debris.homingTimer--;
            const targetPos = getSatellitePosition();
            if (targetPos) {
                const currentSpeed = debris.velocity.length();
                const desired = targetPos.clone().sub(debris.position).normalize().multiplyScalar(currentSpeed);
                debris.velocity.lerp(desired, 0.03);
            }
        }

        debris.position.add(debris.velocity);
        debris.mesh.position.copy(debris.position);

        debris.mesh.rotation.x += debris.rotationVelocity.x;
        debris.mesh.rotation.y += debris.rotationVelocity.y;
        debris.mesh.rotation.z += debris.rotationVelocity.z;

        const dirNormal = debris.velocity.clone().normalize();
        const futurePos = debris.position.clone().add(dirNormal.clone().multiplyScalar(100));
        const pastPos = debris.position.clone().sub(dirNormal.clone().multiplyScalar(100));
        debris.line.geometry.setFromPoints([pastPos, futurePos]);

        debris.age += 16.67;

        if (debris.position.length() < 1.1) {
            gameState.debris.avoided++;
            removeDebris(i);
            continue;
        }

        const distance = debris.position.distanceTo(satPos);
        if (distance < COLLISION_DISTANCE) {
            gameState.debris.hits = (gameState.debris.hits || 0) + 1;
            removeDebris(i);
            continue;
        }

        if (debris.position.length() > 30 || debris.age > debris.maxAge) {
            gameState.debris.avoided++;
            removeDebris(i);
        }
    }

    return debrisArray;
}

function removeDebris(index) {
    const debris = debrisArray[index];
    if (debris) {
        if (debris.mesh) scene.remove(debris.mesh);
        if (debris.line) {
            debris.line.geometry.dispose();
            debris.line.material.dispose();
            scene.remove(debris.line);
        }
    }
    debrisArray.splice(index, 1);
    debrisMeshes.splice(index, 1);
}

export function getDebrisCount() { return debrisArray.length; }

export function clearAllDebris() {
    debrisArray.forEach(d => {
        if (d.mesh) scene.remove(d.mesh);
        if (d.line) { d.line.geometry.dispose(); d.line.material.dispose(); scene.remove(d.line); }
    });
    debrisArray = [];
    debrisMeshes = [];
}

export function getDebrisArray() { return debrisArray; }