import { initScene, getScene, getCamera, getRenderer, animateScene, getSatellitePosition, getOrbitAngle, currentOrbitRadius, setOrbitPathVisibility } from './scene.js';
import { updateUI, setupUIListeners } from './ui.js';
import { updateBattery, checkEclipse, getPowerFlowRate } from './systems.js';
import { updateFaults } from './faults.js';
import { initDebris, updateDebris, getDebrisCount, clearAllDebris, getDebrisArray, setDebrisLinesVisibility } from './debris.js';
import { initParticles, createExplosion, createSpark, updateParticles } from './particles.js';
import { initAudio, playAlarm, playSuccess, playCollision, playWarning } from './sound.js';
import { initScoreboard, addScore, getScoreboardHTML } from './scoreboard.js';
import { openMinigame, closeMinigame, updateMinigameTimer } from './minigames.js';

const originalLog = console.log;
window.debugLog = function(message) {
    originalLog.apply(console, [message]);
    const panel = document.getElementById('debugLog');
    if (panel) {
        const line = document.createElement('div');
        line.textContent = message;
        panel.appendChild(line);
        while (panel.children.length > 30) panel.removeChild(panel.firstChild);
        panel.parentElement.scrollTop = panel.parentElement.scrollHeight;
    }
};
console.log = function(...args) {
    originalLog.apply(console, args);
    window.debugLog(args.join(' '));
};

const gameState = {
    battery: 100,
    isInSunlight: true,
    systems: { comms: true, payload: true, camera: true },
    faults: { current: null, severity: 'warning', count: 0, fixedCount: 0, timer: null, maxTime: 20000, lockedSystems: [], savedSystems: {}, noCharge: false },
    debris: { count: 0, hits: 0, avoided: 0, items: [] },
    score: 0,
    money: 0,
    scoreMultiplier: 1,
    gameOver: false,
    startTime: Date.now(),
    survivalTime: 0,
    minigameActive: false,
    orbitRadius: 3.5,
    isThrusting: false
};

window.gameState = gameState;

function init() {
    initScene();
    const scene = getScene();
    initDebris(scene);
    initParticles(scene);
    initAudio();
    initScoreboard();
    setupUIListeners(gameState);
    updateUI(gameState);

    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) debugPanel.style.display = 'none';

    document.getElementById('fixFaultButton').addEventListener('click', () => {
        if (!gameState.minigameActive && gameState.faults.current) {
            gameState.minigameActive = true;
            openMinigame(
                () => {
                    // Restore systems that were active before the fault
                    if (gameState.faults.savedSystems) {
                        gameState.faults.lockedSystems.forEach(sys => {
                            if (sys !== 'movement' && gameState.faults.savedSystems[sys]) {
                                gameState.systems[sys] = true;
                            }
                        });
                    }

                    gameState.faults.current = null;
                    gameState.faults.timer = null;
                    gameState.faults.severity = 'warning';
                    gameState.faults.lockedSystems = [];
                    gameState.faults.noCharge = false;
                    gameState.faults.fixedCount++;
                    gameState.minigameActive = false;
                    closeMinigame();
                    playSuccess();
                },
                () => {
                    gameState.minigameActive = false;
                    closeMinigame();
                    endGame('SYSTEM OVERLOAD FAILED REPAIR');
                }
            );
        }
    });

    gameLoop();
}

function updateScore() {
    const activeSystems = Object.values(gameState.systems).filter(Boolean).length;
    gameState.scoreMultiplier = 1.0 + activeSystems * 0.5;
    if (!gameState.isInSunlight) gameState.scoreMultiplier += 0.5;
    
    if (gameState.systems.payload) {
        gameState.money += (10 * gameState.scoreMultiplier) / 60;
    }
    
    gameState.score = gameState.money + (gameState.debris.avoided * 100) + (gameState.faults.fixedCount * 250) + (gameState.survivalTime * 5);
}

let frameCount = 0;
function gameLoop() {
    requestAnimationFrame(gameLoop);
    frameCount++;

    if (!gameState.gameOver) {
        const eclipseInfo = checkEclipse();
        gameState.isInSunlight = eclipseInfo.isInSunlight;

        updateBattery(gameState);

        if (!gameState.minigameActive) {
            updateFaults(gameState);
        }

        if (gameState.faults.current && gameState.faults.timer === null) {
            gameState.faults.timer = Date.now();
            playWarning();
        }

        if (gameState.faults.timer !== null) {
            const elapsed = Date.now() - gameState.faults.timer;
            const remaining = Math.max(0, gameState.faults.maxTime - elapsed);
            
            if (gameState.minigameActive) {
                updateMinigameTimer(remaining, gameState.faults.maxTime);
            }

            if (remaining <= 0) {
                gameState.faults.lockedSystems = [];
                endGame('CRITICAL SYSTEM FAILURE');
            }
        }

        updateDebris(gameState);
        gameState.debris.count = getDebrisCount();
        gameState.debris.items = getDebrisArray();
        gameState.orbitRadius = currentOrbitRadius;

        if (gameState.debris.hits > 0) {
            endGame('DEBRIS COLLISION');
        }

        updateParticles();
        updateScore();

        gameState.survivalTime = Math.floor((Date.now() - gameState.startTime) / 1000);
        updateUI(gameState);
        
        // Hide lines if comms are offline
        setOrbitPathVisibility(gameState.systems.comms);
        setDebrisLinesVisibility(gameState.systems.comms);
        
        gameState.powerFlowRate = getPowerFlowRate(gameState);
    }

    animateScene();
}

export function endGame(reason = 'MISSION ABORTED') {
    if (gameState.gameOver) return;
    gameState.gameOver = true;

    if (gameState.minigameActive) {
        closeMinigame();
        gameState.minigameActive = false;
    }

    const satPos = getSatellitePosition();
    if (satPos) {
        createExplosion(satPos, 0xff0000, 40);
        playCollision();
    }

    setTimeout(() => {
        const scoreResult = addScore(Math.floor(gameState.score), gameState.survivalTime, gameState.debris.hits);
        if (scoreResult.isNewHighScore) {
            playSuccess(0.8);
        } else {
            playAlarm();
        }

        const modal = document.getElementById('gameOverModal');
        const finalScore = document.getElementById('finalScore');
        const finalMoney = document.getElementById('finalMoney');
        const finalTime = document.getElementById('finalTime');
        const finalFaults = document.getElementById('finalFaults');
        const finalDebris = document.getElementById('finalDebris');
        const finalReason = document.getElementById('finalReason');
        const scoreboardDisplay = document.getElementById('scoreboardDisplay');
        const newHighScoreBadge = document.getElementById('newHighScoreBadge');

        if (finalScore) finalScore.textContent = Math.floor(gameState.score).toLocaleString();
        if (finalMoney) finalMoney.textContent = '$' + Math.floor(gameState.money).toLocaleString();
        if (finalTime) finalTime.textContent = gameState.survivalTime + 's';
        if (finalFaults) finalFaults.textContent = gameState.faults.fixedCount;
        if (finalDebris) finalDebris.textContent = gameState.debris.avoided;
        if (finalReason) finalReason.textContent = reason;
        if (newHighScoreBadge) newHighScoreBadge.style.display = scoreResult.isNewHighScore ? 'block' : 'none';
        if (scoreboardDisplay) scoreboardDisplay.innerHTML = getScoreboardHTML();

        modal.classList.remove('hidden');
    }, 2000);
}

function restartGame() {
    Object.assign(gameState, {
        battery: 100,
        isInSunlight: true,
        systems: { comms: true, payload: true, camera: true },
        faults: { current: null, severity: 'warning', count: 0, fixedCount: 0, timer: null, maxTime: 20000, lockedSystems: [], savedSystems: {}, noCharge: false },
        debris: { count: 0, hits: 0, avoided: 0, items: [] },
        score: 0,
        money: 0,
        scoreMultiplier: 1,
        gameOver: false,
        startTime: Date.now(),
        survivalTime: 0,
        minigameActive: false,
        orbitRadius: 3.5,
        isThrusting: false
    });

    clearAllDebris();

    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('faultAlert').classList.add('hidden');
    document.getElementById('faultAlert').classList.remove('active');
    document.getElementById('fixFaultButton').classList.add('hidden');
    
    closeMinigame();
    updateUI(gameState);
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'l') {
        const p = document.getElementById('debugPanel');
        if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    }
});

document.getElementById('restartGameButton').addEventListener('click', restartGame);

export { gameState, restartGame };