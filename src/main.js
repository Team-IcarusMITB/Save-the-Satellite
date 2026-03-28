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
    // Movement states (from WASD or gamepad)
    movement: {
        player1: {
            active: false,
            direction: null // 'forward', 'backward', 'left', 'right'
        },
        player2: {
            active: false,
            direction: null
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
    gameOverReason: null,
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
import { initScene, getScene, getCamera, getRenderer, animateScene, getSatellitePosition, getSatellitePositions, resetSatelliteOffset, checkEclipse, updateSolarBurst, resetSolarBurst, adjustPlayer1OrbitAngle, resetPlayer1OrbitOffset, getPlayer1BoostAnimationOffset, updatePlayer1OrbitRadius, resetPlayer1OrbitRadius, adjustPlayer2OrbitAngle, resetPlayer2OrbitOffset, getPlayer2BoostAnimationOffset, updatePlayer2OrbitRadius, resetPlayer2OrbitRadius, getMoonPosition } from './scene.js';
import { updateUI, setupUIListeners } from './ui.js';
import { updateBattery, calculateDrain } from './systems.js';
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
    setupMovementHandler();
    setupGamepadHandler();
    updateUI(gameState);
    
    console.log('✅ Game initialized');

    // Start game loop
    gameLoop();
}

// ==================== COLLISION DETECTION ====================
function checkCollisions(gameState) {
    // Don't check if game is already over
    if (gameState.gameOver) return;
    
    const EARTH_RADIUS = 1;
    const MOON_RADIUS = 0.27;
    const SATELLITE_COLLISION_RADIUS = 0.15;
    
    const satPositions = getSatellitePositions();
    const moonPos = getMoonPosition();
    
    // Check Player 1 satellite collisions
    if (satPositions.sat1) {
        // Check collision with Earth (at origin)
        const distToEarth = satPositions.sat1.length();
        if (distToEarth < EARTH_RADIUS + SATELLITE_COLLISION_RADIUS) {
            console.log('💥 Player 1 satellite crashed into EARTH!');
            playCollision();
            gameState.gameWinner = 'player2';
            gameState.gameOverReason = 'crash_earth_p1';
            gameState.gameOver = true; // Set gameOver immediately
            endGame();
            return;
        }
        
        // Check collision with Moon
        if (moonPos) {
            const distToMoon = satPositions.sat1.distanceTo(moonPos);
            if (distToMoon < MOON_RADIUS + SATELLITE_COLLISION_RADIUS) {
                console.log('💥 Player 1 satellite crashed into MOON!');
                playCollision();
                gameState.gameWinner = 'player2';
                gameState.gameOverReason = 'crash_moon_p1';
                gameState.gameOver = true; // Set gameOver immediately
                endGame();
                return;
            }
        }
    }
    
    // Check Player 2 satellite collisions
    if (satPositions.sat2) {
        // Check collision with Earth
        const distToEarth = satPositions.sat2.length();
        if (distToEarth < EARTH_RADIUS + SATELLITE_COLLISION_RADIUS) {
            console.log('💥 Player 2 satellite crashed into EARTH!');
            console.log(`Distance: ${distToEarth}, Threshold: ${EARTH_RADIUS + SATELLITE_COLLISION_RADIUS}`);
            playCollision();
            gameState.gameWinner = 'player1';
            gameState.gameOverReason = 'crash_earth_p2';
            gameState.gameOver = true; // Set gameOver immediately
            endGame();
            return;
        }
        
        // Check collision with Moon
        if (moonPos) {
            const distToMoon = satPositions.sat2.distanceTo(moonPos);
            if (distToMoon < MOON_RADIUS + SATELLITE_COLLISION_RADIUS) {
                console.log('💥 Player 2 satellite crashed into MOON!');
                playCollision();
                gameState.gameWinner = 'player1';
                gameState.gameOverReason = 'crash_moon_p2';
                gameState.gameOver = true; // Set gameOver immediately
                endGame();
                return;
            }
        }
    }
}

// ==================== GAME LOOP ====================
let gameLoopCount = 0;
function gameLoop() {
    requestAnimationFrame(gameLoop);
    gameLoopCount++;

    // Poll gamepad input for Player 2
    pollGamepad();

    // Apply Player 1 movement (orbit adjustment)
    if (gameState.movement.player1.active) {
        // W and A move counterclockwise, S and D move clockwise
        if (movementState.w || movementState.a) {
            adjustPlayer1OrbitAngle('counterclockwise');
        } else if (movementState.s || movementState.d) {
            adjustPlayer1OrbitAngle('clockwise');
        }
        
        // Create boost animation every 10 frames when movement is active
        if (gameLoopCount % 10 === 0) {
            const satPositions = getSatellitePositions();
            if (satPositions.sat1) {
                const boostOffset = getPlayer1BoostAnimationOffset(gameState.movement.player1.direction);
                createSpark(satPositions.sat1.clone().add(boostOffset), 0x00ffff, 2);
            }
        }
    }

    // Apply Player 2 movement (orbit adjustment)
    if (gameState.movement.player2.active) {
        // Up/Left move counterclockwise, Down/Right move clockwise
        if (gameState.movement.player2.direction === 'up' || gameState.movement.player2.direction === 'left') {
            adjustPlayer2OrbitAngle('counterclockwise');
        } else if (gameState.movement.player2.direction === 'down' || gameState.movement.player2.direction === 'right') {
            adjustPlayer2OrbitAngle('clockwise');
        }
        
        // Create boost animation every 10 frames when movement is active
        if (gameLoopCount % 10 === 0) {
            const satPositions = getSatellitePositions();
            if (satPositions.sat2) {
                const boostOffset = getPlayer2BoostAnimationOffset(gameState.movement.player2.direction);
                createSpark(satPositions.sat2.clone().add(boostOffset), 0xff7f0f, 2);
            }
        }
    }

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

        // Check collision detection
        checkCollisions(gameState);

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

        // Check game over condition: battery depleted for either player
        if (gameState.battery.player1 <= 0) {
            if (!gameState.gameOver) {
                playAlarm();
                gameState.gameWinner = 'player2';
                gameState.gameOverReason = 'battery_p1';
                endGame();
            }
        }
        if (gameState.battery.player2 <= 0) {
            if (!gameState.gameOver) {
                playAlarm();
                gameState.gameWinner = 'player1';
                gameState.gameOverReason = 'battery_p2';
                endGame();
            }
        }

        // Check game over condition: 120 second timeout
        if (gameState.survivalTime >= gameState.survivalTimeMax && !gameState.gameOver) {
            if (gameState.battery.player1 > gameState.battery.player2) {
                gameState.gameWinner = 'player1';
                console.log(`🏆 Player 1 wins by battery! P1: ${gameState.battery.player1.toFixed(1)}% vs P2: ${gameState.battery.player2.toFixed(1)}%`);
            } else if (gameState.battery.player2 > gameState.battery.player1) {
                gameState.gameWinner = 'player2';
                console.log(`🏆 Player 2 wins by battery! P2: ${gameState.battery.player2.toFixed(1)}% vs P1: ${gameState.battery.player1.toFixed(1)}%`);
            } else {
                gameState.gameWinner = 'draw';
                console.log('🤝 Draw! Both players have equal battery');
            }
            gameState.gameOverReason = 'timeout';
            playSuccess(0.8);
            endGame();
        }
    }

    // Animate Three.js scene
    animateScene();
}

// ==================== GAME END ====================
function endGame() {
    gameState.gameOver = true;
    console.log(`Game Over! Winner: ${gameState.gameWinner}, Reason: ${gameState.gameOverReason}`);
    console.log(`Final - P1: ${gameState.battery.player1.toFixed(1)}%, P2: ${gameState.battery.player2.toFixed(1)}%`);
    
    // Display game over modal
    const modal = document.getElementById('gameOverModal');
    const finalScore = document.getElementById('finalScore');
    
    let resultMessage = '';
    if (gameState.gameWinner === 'player1') {
        resultMessage = `🏆 PLAYER 1 (BLUE) WINS! 🏆`;
    } else if (gameState.gameWinner === 'player2') {
        resultMessage = `🏆 PLAYER 2 (ORANGE) WINS! 🏆`;
    } else {
        resultMessage = `🤝 DRAW! Both players tied!`;
    }
    
    if (gameState.gameOverReason === 'timeout') {
        resultMessage += ` (Survival Timeout - Higher Battery Wins)`;
    } else if (gameState.gameOverReason && gameState.gameOverReason.includes('battery')) {
        resultMessage += ` (Opponent Out of Battery)`;
    } else if (gameState.gameOverReason && gameState.gameOverReason.includes('crash')) {
        resultMessage += ` (Opponent Crashed)`;
    }
    
    if (finalScore) {
        finalScore.innerHTML = `
            <div style="text-align: center; font-size: 24px; margin: 20px 0;">
                ${resultMessage}
            </div>
            <div style="text-align: center; margin: 20px 0;">
                <p><span style="color: #00ffff;">Player 1 (Blue): ${gameState.battery.player1.toFixed(1)}%</span></p>
                <p><span style="color: #ff7f0f;">Player 2 (Orange): ${gameState.battery.player2.toFixed(1)}%</span></p>
                <p style="color: #aaa;">Survival Time: ${gameState.survivalTime}s / ${gameState.survivalTimeMax}s</p>
            </div>
        `;
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
    gameState.movement.player1.active = false;
    gameState.movement.player1.direction = null;
    gameState.movement.player2.active = false;
    gameState.movement.player2.direction = null;
    gameState.player1.isInSunlight = true;
    gameState.player1.litByLight = false;
    gameState.player2.isInSunlight = true;
    gameState.player2.litByLight = false;
    gameState.systems.payload = false;
    gameState.debris.count = 0;
    gameState.debris.hits = 0;
    gameState.debris.totalHits = 0;
    gameState.solarBurst.active = false;
    gameState.solarBurst.timeRemaining = 0;
    gameState.solarBurst.nextBurstIn = 0;
    gameState.gameOver = false;
    gameState.gameWinner = null;
    gameState.gameOverReason = null;
    gameState.startTime = Date.now();
    gameState.survivalTime = 0;

    // Clear visual effects
    clearAllDebris();
    resetSatelliteOffset();
    resetPlayer1OrbitOffset();
    resetPlayer1OrbitRadius();
    resetPlayer2OrbitOffset();
    resetPlayer2OrbitRadius();
    resetSolarBurst();

    // Reset movement state
    movementState.w = false;
    movementState.a = false;
    movementState.s = false;
    movementState.d = false;

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

// ==================== MOVEMENT HANDLER (WASD for Player 1) ====================
const movementState = {
    w: false,
    a: false,
    s: false,
    d: false,
    lastPressedKey: null
};

function setupMovementHandler() {
    // Track key states in a map for smooth movement
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        let shouldLogPress = false;
        let direction = null;
        
        if (key === 'w' && !movementState.w) {
            movementState.w = true;
            shouldLogPress = true;
            direction = 'forward';
        } else if (key === 'a' && !movementState.a) {
            movementState.a = true;
            shouldLogPress = true;
            direction = 'left';
        } else if (key === 's' && !movementState.s) {
            movementState.s = true;
            shouldLogPress = true;
            direction = 'backward';
        } else if (key === 'd' && !movementState.d) {
            movementState.d = true;
            shouldLogPress = true;
            direction = 'right';
        }
        
        if (shouldLogPress) {
            movementState.lastPressedKey = key;
            gameState.movement.player1.active = true;
            gameState.movement.player1.direction = direction;
            
            // Update orbit radius based on direction
            if (key === 'w' || key === 'a') {
                updatePlayer1OrbitRadius('counterclockwise');
                console.log(`🔑 P1: ${key.toUpperCase()} pressed - Moving counterclockwise (inner orbit)`);
            } else if (key === 's' || key === 'd') {
                updatePlayer1OrbitRadius('clockwise');
                console.log(`🔑 P1: ${key.toUpperCase()} pressed - Moving clockwise (outer orbit)`);
            }
        }
    });

    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        let wasPressed = false;
        
        if (key === 'w') {
            movementState.w = false;
            wasPressed = true;
        } else if (key === 'a') {
            movementState.a = false;
            wasPressed = true;
        } else if (key === 's') {
            movementState.s = false;
            wasPressed = true;
        } else if (key === 'd') {
            movementState.d = false;
            wasPressed = true;
        }

        if (wasPressed) {
            // Check if any movement key is still pressed
            const anyMovementActive = movementState.w || movementState.a || movementState.s || movementState.d;
            if (!anyMovementActive) {
                gameState.movement.player1.active = false;
                gameState.movement.player1.direction = null;
                resetPlayer1OrbitRadius();
                console.log('🔑 P1: Movement stopped - orbit reset');
            } else {
                // Determine current direction from remaining pressed keys
                if (movementState.w || movementState.a) {
                    gameState.movement.player1.direction = movementState.w ? 'forward' : 'left';
                    updatePlayer1OrbitRadius('counterclockwise');
                } else if (movementState.s || movementState.d) {
                    gameState.movement.player1.direction = movementState.s ? 'backward' : 'right';
                    updatePlayer1OrbitRadius('clockwise');
                }
            }
        }
    });

    console.log('✅ WASD Movement controls ready (P1 only)');
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
            
            // Create boost animation at satellite location when boost activated
            if (gameState.movement.player2.active) {
                const satPositions = getSatellitePositions();
                if (satPositions.sat2) {
                    const boostOffset = getPlayer2BoostAnimationOffset(gameState.movement.player2.direction);
                    createSpark(satPositions.sat2.clone().add(boostOffset), 0xff7f0f, 8);
                }
            }
        } else if (!buttonPressed && gamepadButtonPressed) {
            // Button just released
            gamepadButtonPressed = false;
            gameState.boost.player2.active = false;
            gameState.boost.player2.holdTime = 0;
            console.log('🎮 P2: B button released - BOOST OFF');
        }
        
        // Read left stick axes for movement (Axes 0 = X, 1 = Y)
        const stickX = gamepad.axes[0] || 0;
        const stickY = gamepad.axes[1] || 0;
        const STICK_DEADZONE = 0.3;
        
        // Determine movement direction from stick
        let currentMovementDirection = null;
        let hasMovement = false;
        
        if (Math.abs(stickX) > STICK_DEADZONE || Math.abs(stickY) > STICK_DEADZONE) {
            hasMovement = true;
            
            // Determine primary direction (prioritize vertical)
            if (stickY < -STICK_DEADZONE) {
                // Up: counterclockwise (inner orbit)
                currentMovementDirection = 'up';
                if (!gameState.movement.player2.active || gameState.movement.player2.direction !== 'up') {
                    gameState.movement.player2.active = true;
                    gameState.movement.player2.direction = 'up';
                    updatePlayer2OrbitRadius('counterclockwise');
                    if (pollLogCounter % 150 === 0) console.log('🎮 P2: Left stick UP - Moving counterclockwise (inner orbit)');
                }
            } else if (stickY > STICK_DEADZONE) {
                // Down: clockwise (outer orbit)
                currentMovementDirection = 'down';
                if (!gameState.movement.player2.active || gameState.movement.player2.direction !== 'down') {
                    gameState.movement.player2.active = true;
                    gameState.movement.player2.direction = 'down';
                    updatePlayer2OrbitRadius('clockwise');
                    if (pollLogCounter % 150 === 0) console.log('🎮 P2: Left stick DOWN - Moving clockwise (outer orbit)');
                }
            } else if (stickX < -STICK_DEADZONE) {
                // Left: counterclockwise (inner orbit)
                currentMovementDirection = 'left';
                if (!gameState.movement.player2.active || gameState.movement.player2.direction !== 'left') {
                    gameState.movement.player2.active = true;
                    gameState.movement.player2.direction = 'left';
                    updatePlayer2OrbitRadius('counterclockwise');
                    if (pollLogCounter % 150 === 0) console.log('🎮 P2: Left stick LEFT - Moving counterclockwise (inner orbit)');
                }
            } else if (stickX > STICK_DEADZONE) {
                // Right: clockwise (outer orbit)
                currentMovementDirection = 'right';
                if (!gameState.movement.player2.active || gameState.movement.player2.direction !== 'right') {
                    gameState.movement.player2.active = true;
                    gameState.movement.player2.direction = 'right';
                    updatePlayer2OrbitRadius('clockwise');
                    if (pollLogCounter % 150 === 0) console.log('🎮 P2: Left stick RIGHT - Moving clockwise (outer orbit)');
                }
            }
        } else if (hasMovement === false && gameState.movement.player2.active) {
            // No movement input detected, reset
            gameState.movement.player2.active = false;
            gameState.movement.player2.direction = null;
            resetPlayer2OrbitRadius();
            if (pollLogCounter % 150 === 0) console.log('🎮 P2: Movement stopped - orbit reset');
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
