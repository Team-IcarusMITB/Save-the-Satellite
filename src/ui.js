import { startRandomMinigame } from './minigames.js';
import { createExplosion } from './particles.js';
import { getSatellitePosition } from './scene.js';

export function updateUI(gameState) {
    updateBatteryDisplay(gameState.battery);
    updateStatusIndicator(gameState.isInSunlight);
    updateSurvivalTime(gameState.survivalTime);
    updateSystemButtons(gameState.systems);
    updateFaultDisplay(gameState.faults);
    updateDebrisCounter(gameState.debris.count);
}

function updateBatteryDisplay(battery) {
    const batteryPercent = document.getElementById('batteryPercent');
    const batteryBar = document.getElementById('batteryBar');
    batteryPercent.textContent = Math.round(battery) + '%';
    batteryBar.style.width = battery + '%';
    if (battery > 50) {
        batteryBar.classList.remove('warning', 'critical');
    } else if (battery > 20) {
        batteryBar.classList.remove('critical');
        batteryBar.classList.add('warning');
    } else {
        batteryBar.classList.add('critical');
    }
}

function updateStatusIndicator(isInSunlight) {
    const statusIndicator = document.getElementById('statusIndicator');
    if (isInSunlight) {
        statusIndicator.textContent = 'Sunlit (solar exposure)';
        statusIndicator.classList.remove('eclipse');
        statusIndicator.classList.add('sunlight');
    } else {
        statusIndicator.textContent = 'Earth Shadow (solar blocked)';
        statusIndicator.classList.remove('sunlight');
        statusIndicator.classList.add('eclipse');
    }
}

function updateSurvivalTime(survivalTime) {
    const survivalTimeElement = document.getElementById('survivalTime');
    survivalTimeElement.textContent = survivalTime + 's';
}

function updateSystemButtons(systems) {
    const commToggle = document.getElementById('commToggle');
    const payloadToggle = document.getElementById('payloadToggle');
    const cameraToggle = document.getElementById('cameraToggle');

    if (systems.comms) {
        commToggle.classList.add('active');
    } else {
        commToggle.classList.remove('active');
    }

    if (systems.payload) {
        payloadToggle.classList.add('active');
    } else {
        payloadToggle.classList.remove('active');
    }

    if (systems.camera) {
        cameraToggle.classList.add('active');
    } else {
        cameraToggle.classList.remove('active');
    }
}

function updateFaultDisplay(faults) {
    const faultAlert = document.getElementById('faultAlert');
    const faultText = document.getElementById('faultText');
    const restartButton = document.getElementById('restartButton');

    if (faults.current) {
        faultAlert.classList.remove('hidden');
        faultAlert.classList.add('active');
        
        let timeRemaining = 'N/A';
        if (faults.timer) {
            const elapsed = Date.now() - faults.timer;
            const remaining = Math.max(0, faults.maxTime - elapsed);
            timeRemaining = (remaining / 1000).toFixed(1);
        }
        
        faultText.textContent = `FAULT: ${faults.current} | Fix in: ${timeRemaining}s`;
        restartButton.classList.remove('hidden');
    } else {
        faultAlert.classList.add('hidden');
        faultAlert.classList.remove('active');
        faultText.textContent = 'All Systems Nominal';
        restartButton.classList.add('hidden');
    }
}

function updateDebrisCounter(count) {
    let debrisDisplay = document.getElementById('debrisCounter');
    if (!debrisDisplay) {
        debrisDisplay = document.createElement('div');
        debrisDisplay.id = 'debrisCounter';
        debrisDisplay.style.cssText = `
            margin-top: 20px;
            padding: 12px;
            background-color: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            border-radius: 8px;
            font-size: 14px;
            text-align: center;
        `;
        const faultsSection = document.querySelector('.faults-section');
        if (faultsSection) {
            faultsSection.appendChild(debrisDisplay);
        }
    }
    
    if (count > 0) {
        debrisDisplay.innerHTML = `<strong>${count} Debris Pieces</strong><br><span style="font-size: 12px; color: #ffaa00;">Avoid collision!</span>`;
        debrisDisplay.style.borderColor = 'rgba(255, 170, 0, 0.6)';
    } else {
        debrisDisplay.innerHTML = '<span style="color: #888;">No debris detected</span>';
        debrisDisplay.style.borderColor = 'rgba(255, 107, 107, 0.3)';
    }
}

export function setupUIListeners(gameState) {
    document.getElementById('commToggle').addEventListener('click', () => {
        gameState.systems.comms = !gameState.systems.comms;
    });

    document.getElementById('payloadToggle').addEventListener('click', () => {
        gameState.systems.payload = !gameState.systems.payload;
    });

    document.getElementById('cameraToggle').addEventListener('click', () => {
        gameState.systems.camera = !gameState.systems.camera;
    });

    document.getElementById('restartButton').addEventListener('click', () => {
        startRandomMinigame(
            () => {
                gameState.faults.current = null;
                gameState.faults.timer = null;
                document.getElementById('faultAlert').classList.add('hidden');
            },
            () => {
                gameState.battery = 0; 
                const pos = getSatellitePosition();
                if (pos) {
                    createExplosion(pos, 0xff0000, 100);
                }
            }
        );
    });
}