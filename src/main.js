console.log('🚀 main.js module loading...');

// ==================== DEBUG LOGGING FUNCTION ====================
const originalLog = console.log;

window.debugLog = function(message) {
    // Use original console.log, NOT the intercepted one
    originalLog.apply(console, [message]);
    const debugPanel = document.getElementById('debugLog');
    if (debugPanel) {
        const line = document.createElement('div');
        line.textContent = message;
        debugPanel.appendChild(line);
        // Keep only last 20 lines
        while (debugPanel.children.length > 20) {
            debugPanel.removeChild(debugPanel.firstChild);
        }
        // Auto-scroll to bottom
        debugPanel.parentElement.scrollTop = debugPanel.parentElement.scrollHeight;
    }
};

// Intercept console.log to also show in debug panel
console.log = function(...args) {
    originalLog.apply(console, args);
    window.debugLog(args.join(' '));
};

// Log that debug listener is active
window.debugLog('📍 Debug panel initialized');

// ==================== GAME STATE ====================
const gameState = {
    battery: 100,
    isInSunlight: true,
    systems: {
        comms: false,
        payload: false,
        camera: false
    },
    faults: {
        current: null,
        count: 0,
        timer: null, // Time until system fails automatically
        maxTime: 30000 // 30 seconds to fix a fault before failure
    },
    debris: {
        count: 0,
        hits: 0,        // Collisions this frame
        totalHits: 0    // Cumulative collision count for game-over
    },
    gameOver: false,
    startTime: Date.now(),
    survivalTime: 0
};

// ==================== DEBUG INFO ====================
console.log('=== SATELLITE GAME DEBUGGING ===');
console.log('THREE.js version:', typeof THREE !== 'undefined' ? 'LOADED' : 'NOT FOUND');
console.log('Initial game state:', gameState);

// ==================== IMPORTS ====================
import { initScene, getScene, getCamera, getRenderer, animateScene, getSatellitePosition, resetSatelliteOffset } from './scene.js';
import { updateUI, setupUIListeners } from './ui.js';
import { updateBattery, checkEclipse, calculateDrain } from './systems.js';
import { updateFaults, generateRandomFault } from './faults.js';
import { initDebris, updateDebris, getDebrisCount, clearAllDebris } from './debris.js';
import { initParticles, createExplosion, createSpark, updateParticles } from './particles.js';
import { initAudio, playAlarm, playSuccess, playCollision, playWarning } from './sound.js';
import { initScoreboard, addScore, getScoreboardHTML } from './scoreboard.js';

// ==================== INITIALIZATION ====================
function init() {
    console.log('🛰️ Initializing Keep the Satellite Alive...');
    console.log('📍 DOMContentLoaded fired, starting initialization...');

    // Initialize Three.js scene
    console.log('📍 Calling initScene()...');
    initScene();
    const scene = getScene();
    console.log('📍 Scene retrieved:', scene ? '✅ EXISTS' : '❌ NULL');

    // Initialize all game systems
    console.log('📍 Initializing debris system...');
    initDebris(scene);
    console.log('📍 Initializing particles...');
    initParticles(scene);
    console.log('📍 Initializing audio...');
    initAudio();
    console.log('📍 Initializing scoreboard...');
    initScoreboard();

    // Setup UI event listeners
    console.log('📍 Setting up UI listeners...');
    setupUIListeners(gameState);

    // Update initial UI
    console.log('📍 Updating initial UI...');
    updateUI(gameState);

    console.log('✅ INITIALIZATION COMPLETE - GameLoop starting');
    console.log('Current game state:', gameState);

    // Start game loop
    gameLoop();
}

// ==================== GAME LOOP ====================
let gameLoopCount = 0;
function gameLoop() {
    requestAnimationFrame(gameLoop);
    gameLoopCount++;

    // Log every 60 frames (~1 second at 60fps)
    if (gameLoopCount % 60 === 0) {
        console.log(`🔄 GameLoop frame ${gameLoopCount}, gameOver: ${gameState.gameOver}, battery: ${gameState.battery.toFixed(1)}%`);
    }

    if (!gameState.gameOver) {
        // Update satellite position and check eclipse
        const eclipseInfo = checkEclipse();
        const wasInSunlight = gameState.isInSunlight;
        gameState.isInSunlight = eclipseInfo.isInSunlight;
        
        // Log eclipse changes
        if (wasInSunlight !== gameState.isInSunlight && gameLoopCount % 60 === 0) {
            console.log(`🌍 Eclipse changed: ${gameState.isInSunlight ? '☀️ SUNLIGHT' : '🌑 ECLIPSE'}`);
        }

        // Update battery
        updateBattery(gameState);

        // Check for random faults
        updateFaults(gameState);

        // Update fault timer
        if (gameState.faults.current && gameState.faults.timer === null) {
            gameState.faults.timer = Date.now();
            playWarning();
        }

        if (gameState.faults.timer !== null) {
            const faultDuration = Date.now() - gameState.faults.timer;
            if (faultDuration > gameState.faults.maxTime) {
                // Fault was not fixed in time - critical damage
                playAlarm();
                gameState.battery -= 30; // Drain 30% for unrepaired fault
                console.log('🆘 SYSTEM FAILURE - Fault not repaired in time!');
                gameState.faults.current = null;
                gameState.faults.timer = null;
            }
        }

        // Update debris system
        updateDebris(gameState);
        gameState.debris.count = getDebrisCount();

        // Handle debris collisions with visual/audio feedback
        if (gameState.debris.hits > 0) {
            // Accumulate total hits
            gameState.debris.totalHits += gameState.debris.hits;
            console.log(`💥 Debris collision! Total hits: ${gameState.debris.totalHits}`);
            
            // Create explosion effect at satellite position
            const satPos = getSatellitePosition();
            if (satPos) {
                createExplosion(satPos, 0xff4444, 15);
                createSpark(satPos, 0xffaa00, 8);
                playCollision();
            }
            gameState.debris.hits = 0;
        }

        // Update particle effects
        updateParticles();

        // Update UI
        updateUI(gameState);

        // Calculate survival time
        gameState.survivalTime = Math.floor((Date.now() - gameState.startTime) / 1000);
        
        // Log survival time every 10 seconds
        if (gameState.survivalTime % 10 === 0 && gameLoopCount % 600 === 0) {
            console.log(`⏱️ Survival Time: ${gameState.survivalTime}s`);
        }

        // Check game over condition: battery depleted
        if (gameState.battery <= 0) {
            playAlarm();
            endGame();
        }

        // Check game over condition: too many debris hits
        if (gameState.debris.totalHits >= 3) {
            playAlarm();
            endGame();
        }
    }

    // Animate Three.js scene
    animateScene();
}

// ==================== GAME END ====================
function endGame() {
    gameState.gameOver = true;
    console.log(`Game Over! Survival Time: ${gameState.survivalTime}s, Debris Hits: ${gameState.debris.totalHits}`);
    
    // Save score
    const scoreResult = addScore(gameState.survivalTime, gameState.debris.totalHits);
    console.log(`Score rank: #${scoreResult.rank}`);
    if (scoreResult.isNewHighScore) {
        console.log('🏆 NEW HIGH SCORE!');
        playSuccess(0.8);
    }
    
    // Display game over modal
    const modal = document.getElementById('gameOverModal');
    const finalScore = document.getElementById('finalScore');
    const finalDebrisHits = document.getElementById('finalDebrisHits');
    const scoreboardDisplay = document.getElementById('scoreboardDisplay');
    
    finalScore.textContent = gameState.survivalTime;
    if (finalDebrisHits) finalDebrisHits.textContent = gameState.debris.totalHits;
    
    // Populate scoreboard
    if (scoreboardDisplay) {
        scoreboardDisplay.innerHTML = getScoreboardHTML();
    }
    
    modal.classList.remove('hidden');
}

// ==================== RESTART ====================
function restartGame() {
    console.log('🔄 Restarting game...');
    gameState.battery = 100;
    gameState.isInSunlight = true;
    gameState.systems.comms = false;
    gameState.systems.payload = false;
    gameState.systems.camera = false;
    gameState.faults.current = null;
    gameState.faults.count = 0;
    gameState.faults.timer = null;
    gameState.debris.count = 0;
    gameState.debris.hits = 0;
    gameState.debris.totalHits = 0;
    gameState.gameOver = false;
    gameState.startTime = Date.now();
    gameState.survivalTime = 0;

    // Clear visual effects
    clearAllDebris();
    resetSatelliteOffset();

    // Hide game over modal
    const modal = document.getElementById('gameOverModal');
    modal.classList.add('hidden');

    // Clear UI fault alert
    const faultAlert = document.getElementById('faultAlert');
    faultAlert.classList.add('hidden');
    faultAlert.classList.remove('active');
    const restartButton = document.getElementById('restartButton');
    restartButton.classList.add('hidden');

    // Reset system buttons
    document.getElementById('commToggle').classList.remove('active');
    document.getElementById('payloadToggle').classList.remove('active');
    document.getElementById('cameraToggle').classList.remove('active');

    // Update UI
    updateUI(gameState);

    // Continue game loop
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', init);

// Toggle debug panel with L key
window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'l') {
        event.preventDefault();
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
            console.log(`📝 Debug panel ${debugPanel.style.display === 'none' ? 'hidden' : 'shown'}`);
        }
    }
});

document.getElementById('restartGameButton').addEventListener('click', restartGame);

// Export for use in other modules
export { gameState, restartGame };
