
console.log('🚀 main.js module loading...');

// ==================== DEBUG LOGGING FUNCTION ====================
const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

const debugEntries = [];
let debugVisible = false;
let debugFPS = 0;
let debugFrameCounter = 0;
let debugFPSTimer = performance.now();

function appendDebugLog(message) {
    debugEntries.push({
        time: new Date(),
        message: String(message)
    });

    while (debugEntries.length > 35) {
        debugEntries.shift();
    }

    if (debugVisible) {
        renderDebugLog();
    }
}

window.debugLog = function(message) {
    appendDebugLog(message);
};

console.log = function(...args) {
    originalLog(...args);
    appendDebugLog(args.join(' '));
};

console.warn = function(...args) {
    originalWarn(...args);
    appendDebugLog(`⚠️ ${args.join(' ')}`);
};

console.error = function(...args) {
    originalError(...args);
    appendDebugLog(`❌ ${args.join(' ')}`);
};

window.debugLog('📍 Debug telemetry ready (toggle with L)');

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
        totalHits: 0,   // Cumulative collision count for game-over
        warningDirection: null
    },
    difficulty: {
        level: 1,
        intensity: 1,
        debrisSpawnMultiplier: 1,
        debrisSpeedMultiplier: 1,
        faultChanceMultiplier: 1
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
import { initScene, getScene, getCamera, getRenderer, animateScene, getSatellitePosition, getOrbitAngle, getManeuverPowerDraw } from './scene.js';
import { updateUI, setupUIListeners } from './ui.js';
import { updateBattery, checkEclipse, calculateDrain } from './systems.js';
import { updateFaults, generateRandomFault } from './faults.js';
import { initDebris, updateDebris, getDebrisCount, clearAllDebris } from './debris.js';
import { initParticles, createExplosion, createSpark, updateParticles } from './particles.js';
import { initAudio, playAlarm, playSuccess, playCollision, playWarning } from './sound.js';
import { initScoreboard, addScore, getScoreboardHTML } from './scoreboard.js';
import { startTutorial, isTutorialActive, updateTutorial , forceNextStep } from './tutorial.js';
// ==================== INITIALIZATION ====================
function renderDebugLog() {
    const logContainer = document.getElementById('debugLog');
    if (!logContainer) return;

    logContainer.innerHTML = '';
    debugEntries.forEach((entry) => {
        const line = document.createElement('div');
        line.className = 'debug-log-entry';

        const timeEl = document.createElement('span');
        timeEl.className = 'debug-log-time';
        timeEl.textContent = entry.time.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });

        const msgEl = document.createElement('span');
        msgEl.className = 'debug-log-message';
        msgEl.textContent = entry.message;

        line.appendChild(timeEl);
        line.appendChild(msgEl);
        logContainer.appendChild(line);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
}

function setDebugValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateDebugHUD() {
    setDebugValue('dbgFps', `${debugFPS.toFixed(0)} fps`);
    setDebugValue('dbgBattery', `${gameState.battery.toFixed(1)}%`);
    setDebugValue('dbgSun', gameState.isInSunlight ? 'SUNLIGHT' : 'ECLIPSE');
    setDebugValue('dbgDrain', `${calculateDrain(gameState).toFixed(2)} u/s`);
    setDebugValue('dbgManeuver', `${getManeuverPowerDraw().toFixed(2)} u/s`);
    setDebugValue('dbgDifficulty', `Lv ${gameState.difficulty.level} (${gameState.difficulty.intensity.toFixed(2)}x)`);
    setDebugValue('dbgFault', gameState.faults.current ? `⚠ ${gameState.faults.current}` : 'Nominal');
    setDebugValue('dbgDebris', `${gameState.debris.count} active / ${gameState.debris.totalHits} hits`);
    setDebugValue('dbgWarning', gameState.debris.warningDirection || 'None');
    setDebugValue('dbgOrbit', `${(getOrbitAngle() * (180 / Math.PI)).toFixed(1)}°`);
}

function init() {
    console.log('🛰️ Initializing Keep the Satellite Alive...');
    console.log('📍 DOMContentLoaded fired, starting initialization...');

    const sceneInitialized = initScene();
    if (!sceneInitialized) {
        console.error('❌ Scene initialization failed. Game startup aborted.');
        return;
    }

    const scene = getScene();

    initDebris(scene);
    initParticles(scene);
    initAudio();
    initScoreboard();

    setupUIListeners(gameState);
    updateUI(gameState);

    const clearBtn = document.getElementById('debugClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            debugEntries.length = 0;
            renderDebugLog();
        });
    }

    console.log('✅ INITIALIZATION COMPLETE - GameLoop starting');
    console.log('Current game state:', gameState);

    startTutorial();
    document.getElementById('tutorialNext').addEventListener('click', forceNextStep);

    gameLoop();
}

// ==================== GAME LOOP ====================

let gameLoopCount = 0;

function updateDifficultyScaling() {
    const elapsedSeconds = Math.floor((Date.now() - gameState.startTime) / 1000);
    const level = Math.floor(elapsedSeconds / 30) + 1;
    const intensity = Math.min(2.6, 1 + elapsedSeconds / 95);

    gameState.difficulty.level = level;
    gameState.difficulty.intensity = intensity;
    gameState.difficulty.debrisSpawnMultiplier = Math.min(3.2, 1 + elapsedSeconds / 60);
    gameState.difficulty.debrisSpeedMultiplier = Math.min(2.3, 1 + elapsedSeconds / 120);
    gameState.difficulty.faultChanceMultiplier = Math.min(2.7, 1 + elapsedSeconds / 90);

    // Less time to repair faults as mission gets harder.
    gameState.faults.maxTime = Math.max(12000, 30000 - elapsedSeconds * 240);
}

function gameLoop() {
    requestAnimationFrame(gameLoop);
    updateTutorial();
    gameLoopCount++;

    debugFrameCounter++;
    const now = performance.now();
    if (now - debugFPSTimer >= 1000) {
        debugFPS = (debugFrameCounter * 1000) / (now - debugFPSTimer);
        debugFrameCounter = 0;
        debugFPSTimer = now;
    }

    // Log every 60 frames (~1 second at 60fps)
    if (gameLoopCount % 60 === 0) {
        console.log(`🔄 GameLoop frame ${gameLoopCount}, gameOver: ${gameState.gameOver}, battery: ${gameState.battery.toFixed(1)}%`);
    }

    if (!gameState.gameOver && !isTutorialActive()) {
        updateDifficultyScaling();

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

    if (debugVisible && gameLoopCount % 6 === 0) {
        updateDebugHUD();
    }
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
    gameState.debris.warningDirection = null;
    gameState.difficulty.level = 1;
    gameState.difficulty.intensity = 1;
    gameState.difficulty.debrisSpawnMultiplier = 1;
    gameState.difficulty.debrisSpeedMultiplier = 1;
    gameState.difficulty.faultChanceMultiplier = 1;
    gameState.gameOver = false;
    gameState.startTime = Date.now();
    gameState.survivalTime = 0;
    gameState.faults.maxTime = 30000;

    // Clear visual effects
    clearAllDebris();

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
        debugVisible = !debugVisible;

        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanel.classList.toggle('visible', debugVisible);
        }

        if (debugVisible) {
            updateDebugHUD();
            renderDebugLog();
        }

        console.log(`📝 Debug panel ${debugVisible ? 'shown' : 'hidden'}`);
    }
});

document.getElementById('restartGameButton').addEventListener('click', restartGame);

// Export for use in other modules
export { gameState, restartGame };
