console.log('📍 ui.js module loading...');

// ==================== UI MODULE ====================

// ==================== UPDATE UI ====================
export function updateUI(gameState) {
    // Update battery bar
    updateBatteryDisplay(gameState.battery);

    // Update status indicator (sunlight/eclipse)
    updateStatusIndicator(gameState.isInSunlight);

    // Update survival time
    updateSurvivalTime(gameState.survivalTime);

    // Update system button states
    updateSystemButtons(gameState.systems);

    // Update fault display
    updateFaultDisplay(gameState.faults, gameState.debris);

    // Update debris counter
    updateDebrisCounter(gameState.debris.count);
}

// ==================== UPDATE BATTERY DISPLAY ====================
function updateBatteryDisplay(battery) {
    const batteryPercent = document.getElementById('batteryPercent');
    const batteryBar = document.getElementById('batteryBar');

    // Update percentage text
    batteryPercent.textContent = Math.round(battery) + '%';

    // Update bar width
    batteryBar.style.width = battery + '%';

    // Update bar color based on battery level
    if (battery > 50) {
        batteryBar.classList.remove('warning', 'critical');
    } else if (battery > 20) {
        batteryBar.classList.remove('critical');
        batteryBar.classList.add('warning');
    } else {
        batteryBar.classList.add('critical');
    }
}

// ==================== UPDATE STATUS INDICATOR ====================
function updateStatusIndicator(isInSunlight) {
    const statusIndicator = document.getElementById('statusIndicator');

    if (isInSunlight) {
        statusIndicator.textContent = '☀️ Sunlit (solar exposure)';
        statusIndicator.classList.remove('eclipse');
        statusIndicator.classList.add('sunlight');
    } else {
        statusIndicator.textContent = '🌘 Earth Shadow (solar blocked)';
        statusIndicator.classList.remove('sunlight');
        statusIndicator.classList.add('eclipse');
    }
}

// ==================== UPDATE SURVIVAL TIME ====================
function updateSurvivalTime(survivalTime) {
    const survivalTimeElement = document.getElementById('survivalTime');
    survivalTimeElement.textContent = survivalTime + 's';
}

// ==================== UPDATE SYSTEM BUTTONS ====================
function updateSystemButtons(systems) {
    const commToggle = document.getElementById('commToggle');
    const payloadToggle = document.getElementById('payloadToggle');
    const cameraToggle = document.getElementById('cameraToggle');

    // Update communications button
    if (systems.comms) {
        commToggle.classList.add('active');
    } else {
        commToggle.classList.remove('active');
    }

    // Update payload button
    if (systems.payload) {
        payloadToggle.classList.add('active');
    } else {
        payloadToggle.classList.remove('active');
    }

    // Update camera button
    if (systems.camera) {
        cameraToggle.classList.add('active');
    } else {
        cameraToggle.classList.remove('active');
    }
}

// ==================== UPDATE FAULT DISPLAY ====================
function updateFaultDisplay(faults, debris) {
    const faultAlert = document.getElementById('faultAlert');
    const faultText = document.getElementById('faultText');
    const restartButton = document.getElementById('restartButton');

    if (!faultAlert || !faultText || !restartButton) return;

    faultAlert.classList.remove('active', 'incoming');

    if (faults.current) {
        // Show fault
        faultAlert.classList.remove('hidden');
        faultAlert.classList.add('active');
        
        // Calculate time remaining
        let timeRemaining = 'N/A';
        if (faults.timer) {
            const elapsed = Date.now() - faults.timer;
            const remaining = Math.max(0, faults.maxTime - elapsed);
            timeRemaining = (remaining / 1000).toFixed(1);
        }
        
        faultText.textContent = `⚠️ ${faults.current} - Fix in: ${timeRemaining}s`;
        restartButton.classList.remove('hidden');
    } else if (debris && debris.warningDirection) {
        // Only show debris direction warning when no critical fault is active.
        faultAlert.classList.remove('hidden');
        faultAlert.classList.add('incoming');
        faultText.textContent = `🪨 Incoming asteroid from ${debris.warningDirection}`;
        restartButton.classList.add('hidden');
    } else {
        // No active fault
        faultAlert.classList.add('hidden');
        faultText.textContent = '✅ All Systems Nominal';
        restartButton.classList.add('hidden');
    }
}

// ==================== UPDATE DEBRIS COUNTER ====================
function updateDebrisCounter(count) {
    // Create element if it doesn't exist
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
        debrisDisplay.innerHTML = `<strong>⚠️ ${count} Debris Pieces</strong><br><span style="font-size: 12px; color: #ffaa00;">Avoid collision!</span>`;
        debrisDisplay.style.borderColor = 'rgba(255, 170, 0, 0.6)';
    } else {
        debrisDisplay.innerHTML = '<span style="color: #888;">No debris detected</span>';
        debrisDisplay.style.borderColor = 'rgba(255, 107, 107, 0.3)';
    }
}

// ==================== SETUP UI LISTENERS ====================
export function setupUIListeners(gameState) {
    // Communications toggle
   document.getElementById('commToggle').addEventListener('click', () => {
    gameState.systems.comms = !gameState.systems.comms;

    // 🔥 ADD THIS
    if (window.tutorialState) {
        window.tutorialState.commsUsed = true;
    }
});

    // Payload toggle
    document.getElementById('payloadToggle').addEventListener('click', () => {
        gameState.systems.payload = !gameState.systems.payload;
        console.log(`Payload: ${gameState.systems.payload ? 'ON' : 'OFF'}`);
    });

    // Camera toggle
    document.getElementById('cameraToggle').addEventListener('click', () => {
        gameState.systems.camera = !gameState.systems.camera;
        console.log(`Camera: ${gameState.systems.camera ? 'ON' : 'OFF'}`);
    });

    // Restart system button
    document.getElementById('restartButton').addEventListener('click', () => {
        gameState.faults.current = null;
        console.log('System restarted');
    });

    console.log('✅ UI listeners setup complete');
}
