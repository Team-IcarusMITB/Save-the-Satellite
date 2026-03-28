// UI module

// ==================== UI MODULE ====================

// ==================== UPDATE UI ====================
export function updateUI(gameState) {
    // Update Player 1
    updateBatteryDisplay(gameState.battery.player1, 'P1');
    updateHeatDisplay(gameState.heat.player1, gameState.heat.maxHeat, 'P1');
    updateStatusIndicator(gameState.player1.litByLight, 'P1');

    // Update Player 2
    updateBatteryDisplay(gameState.battery.player2, 'P2');
    updateHeatDisplay(gameState.heat.player2, gameState.heat.maxHeat, 'P2');
    updateStatusIndicator(gameState.player2.litByLight, 'P2');

    // Update solar burst status
    updateSolarBurstIndicator(gameState.solarBurst);

    // Update survival time
    updateSurvivalTime(gameState.survivalTime, gameState.survivalTimeMax);

    // Update debris counter
    updateDebrisCounter(gameState.debris.count);
}

// ==================== UPDATE BATTERY DISPLAY ====================
function updateBatteryDisplay(battery, player) {
    const batteryPercent = document.getElementById(`batteryPercent${player}`);
    const batteryBar = document.getElementById(`batteryBar${player}`);

    if (!batteryPercent || !batteryBar) return;

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

// ==================== UPDATE HEAT DISPLAY ====================
function updateHeatDisplay(heat, maxHeat, player) {
    const heatBar = document.getElementById(`heatBar${player}`);

    if (!heatBar) {
        return;
    }

    const heatPercent = (heat / maxHeat) * 100;
    heatBar.style.width = heatPercent + '%';

    // Update heat bar color - critical at 70% threshold
    if (heatPercent > 70) {
        heatBar.classList.add('critical');
    } else {
        heatBar.classList.remove('critical');
    }
}

// ==================== UPDATE STATUS INDICATOR ====================
function updateStatusIndicator(litByLight, player) {
    const statusIndicator = document.getElementById(`statusIndicator${player}`);

    if (!statusIndicator) {
        return;
    }

    if (litByLight) {
        statusIndicator.textContent = '☀️ SUNLIT';
        statusIndicator.classList.remove('eclipse');
        statusIndicator.classList.add('sunlit');
    } else {
        statusIndicator.textContent = '🌘 ECLIPSE';
        statusIndicator.classList.remove('sunlit');
        statusIndicator.classList.add('eclipse');
    }
}

// ==================== UPDATE SOLAR BURST STATUS ====================
function updateSolarBurstIndicator(solarBurst) {
    const solarIndicator = document.getElementById('solarBurstIndicator');

    if (!solarIndicator) return;

    if (solarBurst.active) {
        solarIndicator.textContent = `🌩️ Solar Flare Active! (${solarBurst.timeRemaining.toFixed(1)}ms)`;
        solarIndicator.classList.add('solar-active');
        solarIndicator.classList.remove('solar-ready');
    } else {
        solarIndicator.textContent = `☀️ Next flare: ${(solarBurst.nextBurstIn / 1000).toFixed(1)}s`;
        solarIndicator.classList.remove('solar-active');
        solarIndicator.classList.add('solar-ready');
    }
}

// ==================== UPDATE SURVIVAL TIME ====================
function updateSurvivalTime(survivalTime, maxTime) {
    const survivalTimeElement = document.getElementById('survivalTime');
    if (survivalTimeElement) {
        const timeRemaining = Math.max(0, maxTime - survivalTime);
        survivalTimeElement.textContent = `${survivalTime}s / ${maxTime}s`;
    }
}

// ==================== UPDATE SYSTEM BUTTONS ====================
function updateSystemButtons(systems) {
    const payloadToggle = document.getElementById('payloadToggle');

    if (!payloadToggle) return;

    // Update payload button
    if (systems.payload) {
        payloadToggle.classList.add('active');
        payloadToggle.textContent = '📦 ACTIVE';
        payloadToggle.classList.remove('inactive');
    } else {
        payloadToggle.classList.remove('active');
        payloadToggle.textContent = '📦 INACTIVE';
        payloadToggle.classList.add('inactive');
    }
}

// ==================== UPDATE DEBRIS COUNTER ====================
function updateDebrisCounter(count) {
    // Debris counter is optional - can be displayed in a separate UI element if needed
    // For now, it's handled in the game state
}

// ==================== SETUP UI LISTENERS ====================
export function setupUIListeners(gameState) {
    console.log('✅ HUD listeners setup complete');
}
