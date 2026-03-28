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

// ==================== GAME STATE ====================
const gameState = {
    // Battery states for each satellite
    battery: {
        player1: 100,
        player2: 100
    },
    // Heat states for each satellite
    heat: {
        player1: 0,
        player2: 0,
        maxHeat: 100
    },
    // Boost states
    boost: {
        player1: {
            active: false,
            holdTime: 0
        },
        player2: {
            active: false,
            holdTime: 0
        }
    },
    // Player light states
    player1: {
        isInSunlight: true,
        litByLight: false
    },
    player2: {
        isInSunlight: true,
        litByLight: false
    },
    systems: {
        payload: false
    },
    faults: {
        current: null,
        count: 0,
        timer: null,
        maxTime: 30000
    },
    debris: {
        count: 0,
        hits: 0,
        totalHits: 0
    },
    solarBurst: {
        active: false,
        timeRemaining: 0,
        nextBurstIn: 0
    },
    gameOver: false,
    startTime: Date.now(),
    survivalTime: 0
};

// ==================== INITIALIZATION LOGGING ====================
console.log('✅ Game starting...');

// ==================== IMPORTS ====================
import { initScene, getScene, getCamera, getRenderer, animateScene, getSatellitePosition, resetSatelliteOffset, checkEclipse, updateSolarBurst, resetSolarBurst } from './scene.js';
import { updateUI, setupUIListeners } from './ui.js';
import { updateBattery, calculateDrain } from './systems.js';
import { updateFaults, generateRandomFault } from './faults.js';
import { initDebris, updateDebris, getDebrisCount, clearAllDebris } from './debris.js';
import { initParticles, createExplosion, createSpark, updateParticles } from './particles.js';
import { initAudio, playAlarm, playSuccess, playCollision, playWarning } from './sound.js';
import { initScoreboard, addScore, getScoreboardHTML } from './scoreboard.js';

// ==================== INITIALIZATION ====================
function init() {
    console.log('🛰️ Initializing game...');
    
    initScene();
    const scene = getScene();
    initDebris(scene);
    initParticles(scene);
    initAudio();
    initScoreboard();
    setupUIListeners(gameState);
    setupBoostHandler();
    setupGamepadHandler();
    updateUI(gameState);
    
    console.log('✅ Game initialized');

    // Start game loop
    gameLoop();
}

// ==================== GAME LOOP ====================
let gameLoopCount = 0;
function gameLoop() {
    requestAnimationFrame(gameLoop);
    gameLoopCount++;

    // Poll gamepad input for Player 2
    pollGamepad();

    // Log every 300 frames (~5 seconds at 60fps)
    if (gameLoopCount % 300 === 0) {
        console.log(`⏱️ P1: ${gameState.battery.player1.toFixed(1)}% | P2: ${gameState.battery.player2.toFixed(1)}%`);
    }

    if (!gameState.gameOver) {
        // Update satellite position and check eclipse
        const eclipseInfo = checkEclipse();
        const wasLitByLight = gameState.player1.litByLight;
        gameState.player1.litByLight = eclipseInfo.litByLight;
        gameState.player2.litByLight = eclipseInfo.litByLight;

        const burstInfo = updateSolarBurst(eclipseInfo.satPos, { x: 1, y: 0, z: 0 });
        gameState.solarBurst.active = burstInfo.active;
        gameState.solarBurst.timeRemaining = burstInfo.timeRemaining;
        gameState.solarBurst.nextBurstIn = burstInfo.nextIn;

        if (burstInfo.justTriggered) {
            console.warn('🌩️ Solar burst impact! Satellite systems overloaded.');
            gameState.battery.player1 -= burstInfo.damage;
            if (gameState.battery.player1 < 0) gameState.battery.player1 = 0;
            playAlarm();
        }
        
        // Log eclipse changes
        if (wasLitByLight !== gameState.player1.litByLight && gameLoopCount % 60 === 0) {
            console.log(`🌍 Sun exposure changed: ${gameState.player1.litByLight ? '☀️ SUNLIT' : '🌘 ECLIPSE'}`);
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
                gameState.battery.player1 -= 30;
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
        if (gameState.battery.player1 <= 0) {
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
    gameState.battery.player1 = 100;
    gameState.battery.player2 = 100;
    gameState.heat.player1 = 0;
    gameState.heat.player2 = 0;
    gameState.boost.player1.active = false;
    gameState.boost.player1.holdTime = 0;
    gameState.boost.player2.active = false;
    gameState.boost.player2.holdTime = 0;
    gameState.player1.isInSunlight = true;
    gameState.player1.litByLight = false;
    gameState.player2.isInSunlight = true;
    gameState.player2.litByLight = false;
    gameState.systems.payload = false;
    gameState.faults.timer = null;
    gameState.debris.count = 0;
    gameState.debris.hits = 0;
    gameState.debris.totalHits = 0;
    gameState.solarBurst.active = false;
    gameState.solarBurst.timeRemaining = 0;
    gameState.solarBurst.nextBurstIn = 0;
    gameState.gameOver = false;
    gameState.startTime = Date.now();
    gameState.survivalTime = 0;

    // Clear visual effects
    clearAllDebris();
    resetSatelliteOffset();
    resetSolarBurst();

    // Hide game over modal
    const modal = document.getElementById('gameOverModal');
    modal.classList.add('hidden');

    // Reset system buttons
    document.getElementById('payloadToggle').classList.remove('active');

    // Update UI
    updateUI(gameState);

    // Continue game loop
}

// ==================== BOOST SYSTEM ====================
function setupBoostHandler() {
    let spacePressed = false;

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            event.preventDefault();
            if (!spacePressed) {
                spacePressed = true;
                gameState.boost.player1.active = true;
                console.log('🔑 P1: SPACE pressed - BOOST ON');
            }
        }
    });

    window.addEventListener('keyup', (event) => {
        if (event.code === 'Space') {
            event.preventDefault();
            spacePressed = false;
            gameState.boost.player1.active = false;
            gameState.boost.player1.holdTime = 0;
            console.log('🔑 P1: SPACE released - BOOST OFF');
        }
    });

    console.log('✅ Controls: P1=SPACE (keyboard only), P2=Gamepad B button only');
}

// ==================== GAMEPAD HANDLER ====================
let gamepadConnected = false;
let gamepadButtonPressed = false;
let pollLogCounter = 0;

function setupGamepadHandler() {
    window.addEventListener('gamepadconnected', (event) => {
        gamepadConnected = true;
        console.log(`✅ GAMEPAD CONNECTED: ${event.gamepad.id}`);
        console.log(`📊 Buttons: ${event.gamepad.buttons.length}, Axes: ${event.gamepad.axes.length}`);
    });

    window.addEventListener('gamepaddisconnected', (event) => {
        gamepadConnected = false;
        gameState.boost.player2.active = false;
        console.log(`❌ Gamepad disconnected`);
    });

    console.log('✅ Gamepad API ready (listening for connection)');
}

function pollGamepad() {
    pollLogCounter++;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    
    if (!gamepads || gamepads.length === 0) {
        if (pollLogCounter % 300 === 0 && gamepadConnected) {
            console.log('⚠️ Gamepad was connected but getGamepads() returned empty');
        }
        return;
    }
    
    // Use first connected gamepad for Player 2
    let foundGamepad = false;
    for (let i = 0; i < gamepads.length; i++) {
        const gamepad = gamepads[i];
        if (!gamepad) continue;
        
        foundGamepad = true;
        
        // Debug logging every 300 frames
        if (pollLogCounter % 300 === 0) {
            console.log(`🎮 Gamepad found: ${gamepad.id}`);
            console.log(`   B button (index 1): ${gamepad.buttons[1]?.pressed ? 'PRESSED' : 'released'}`);
        }
        
        // B button (index 1) for boost (Player 2 ONLY - gamepad control)
        const buttonPressed = gamepad.buttons[1] && gamepad.buttons[1].pressed;
        
        if (buttonPressed && !gamepadButtonPressed) {
            // Button just pressed
            gamepadButtonPressed = true;
            gameState.boost.player2.active = true;
            console.log('🎮 P2: B button pressed - BOOST ON');
        } else if (!buttonPressed && gamepadButtonPressed) {
            // Button just released
            gamepadButtonPressed = false;
            gameState.boost.player2.active = false;
            gameState.boost.player2.holdTime = 0;
            console.log('🎮 P2: B button released - BOOST OFF');
        }
        
        break; // Only use first gamepad
    }
    
    if (!foundGamepad && pollLogCounter % 300 === 0 && gamepadConnected) {
        console.log('⚠️ No valid gamepad found in getGamepads() array');
    }
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
