// ==================== PARTICLE EFFECTS SYSTEM ====================

let particlesArray = [];
let scene;

// ==================== INITIALIZE PARTICLES ====================
export function initParticles(sceneRef) {
    scene = sceneRef;
    console.log('✅ Particle system initialized');
}

// ==================== CREATE EXPLOSION ====================
export function createExplosion(position, color = 0xff6600, particleCount = 20) {
    for (let i = 0; i < particleCount; i++) {
        // Random velocity direction
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI * 2;
        const speed = 0.03 + Math.random() * 0.07;

        const velocity = new THREE.Vector3(
            Math.sin(angle2) * Math.cos(angle1) * speed,
            Math.sin(angle2) * Math.sin(angle1) * speed,
            Math.cos(angle2) * speed
        );

        createParticle(position.clone(), velocity, color);
    }
    console.log(`💥 Explosion created at ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
}

// ==================== CREATE SPARK ====================
export function createSpark(position, color = 0xffdd00, particleCount = 10) {
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.02 + Math.random() * 0.05;

        const velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            (Math.random() - 0.5) * speed * 0.5,
            Math.sin(angle) * speed
        );

        createParticle(position.clone(), velocity, color, 0.05);
    }
}

// ==================== CREATE SINGLE PARTICLE ====================
function createParticle(position, velocity, color, size = 0.1) {
    const particleGeometry = new THREE.SphereGeometry(size, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: color,
        emissive: color
    });
    const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
    particleMesh.position.copy(position);

    scene.add(particleMesh);

    const particle = {
        mesh: particleMesh,
        position: position,
        velocity: velocity,
        life: 1.0, // 0 to 1
        maxLife: 1.5, // seconds
        age: 0
    };

    particlesArray.push(particle);
}

// ==================== UPDATE PARTICLES ====================
export function updateParticles() {
    for (let i = particlesArray.length - 1; i >= 0; i--) {
        const particle = particlesArray[i];

        // Update age
        particle.age += 0.016; // ~60fps
        particle.life = 1.0 - (particle.age / particle.maxLife);

        if (particle.life <= 0) {
            // Remove dead particle
            scene.remove(particle.mesh);
            particlesArray.splice(i, 1);
            continue;
        }

        // Update position
        particle.position.add(particle.velocity);
        particle.mesh.position.copy(particle.position);

        // Fade out
        particle.mesh.material.opacity = particle.life;
        particle.mesh.material.transparent = true;

        // Apply gravity (optional, remove if you want them to float)
        particle.velocity.y -= 0.01; // Small downward pull
    }
}

// ==================== GET PARTICLE COUNT ====================
export function getParticleCount() {
    return particlesArray.length;
}

// ==================== CLEAR ALL PARTICLES ====================
export function clearAllParticles() {
    particlesArray.forEach(particle => {
        if (particle.mesh) scene.remove(particle.mesh);
    });
    particlesArray = [];
}