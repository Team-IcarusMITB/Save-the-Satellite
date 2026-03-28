// ==================== SYSTEMS MODULE ====================
import { checkEclipse } from './scene.js';

// Battery parameters
const CHARGE_RATE = 1.5; // % per frame in sunlight (at 60fps = 0.9% per second)
const DRAIN_RATE_ECLIPSE = 2.0; // % per frame in eclipse
const SYSTEM_DRAIN_RATE = 0.8; // % per frame per active system

// Boost parameters
const BOOST_DRAIN_RATE = 8.0; // % battery per second when boosting
const HEAT_GENERATION_RATE = 15.0; // % heat per second when boosting
const HEAT_DISSIPATION_RATE = 5.0; // % heat per second dissipation

let lastUpdateTime = Date.now();

// ==================== UPDATE BATTERY & HEAT ====================
let batteryLogCounter = 0;
export function updateBattery(gameState) {
    batteryLogCounter++;
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;

    const { litByLight } = checkEclipse();

    // Calculate drain from active systems
    let systemDrain = 0;
    if (gameState.systems.payload) systemDrain += SYSTEM_DRAIN_RATE;

    // Calculate base battery change (same for both players)
    let baseBatteryChange = 0;

    if (litByLight) {
        // Charging in sunlight
        baseBatteryChange = CHARGE_RATE - systemDrain * 0.5;
    } else {
        // Draining in eclipse
        baseBatteryChange = -(DRAIN_RATE_ECLIPSE + systemDrain);
    }

    // Update Player 1 battery
    let p1BatteryChange = baseBatteryChange;
    if (gameState.boost.player1.active && gameState.battery.player1 > 0) {
        p1BatteryChange -= BOOST_DRAIN_RATE;
    }
    gameState.battery.player1 += p1BatteryChange * deltaTime;
    gameState.battery.player1 = Math.max(0, Math.min(100, gameState.battery.player1));

    // Update Player 2 battery
    let p2BatteryChange = baseBatteryChange;
    if (gameState.boost.player2.active && gameState.battery.player2 > 0) {
        p2BatteryChange -= BOOST_DRAIN_RATE;
    }
    gameState.battery.player2 += p2BatteryChange * deltaTime;
    gameState.battery.player2 = Math.max(0, Math.min(100, gameState.battery.player2));

    // ==================== HEAT MANAGEMENT ====================
    // Update heat for both players
    updateHeat(gameState, 'player1', deltaTime);
    updateHeat(gameState, 'player2', deltaTime);
    
    // Log battery + boost state every 300 calls
    if (batteryLogCounter % 300 === 0) {
        console.log(`P1: ${gameState.battery.player1.toFixed(1)}% (boost: ${gameState.boost.player1.active}) | P2: ${gameState.battery.player2.toFixed(1)}% (boost: ${gameState.boost.player2.active})`);
    }
}

// ==================== UPDATE HEAT ====================
function updateHeat(gameState, player, deltaTime) {
    const isBoostActive = player === 'player1' ? gameState.boost.player1.active : gameState.boost.player2.active;
    const battery = player === 'player1' ? gameState.battery.player1 : gameState.battery.player2;
    
    if (isBoostActive && battery > 0) {
        // Generate heat when boosting
        gameState.heat[player] += HEAT_GENERATION_RATE * deltaTime;
    } else {
        // Dissipate heat when not boosting
        gameState.heat[player] -= HEAT_DISSIPATION_RATE * deltaTime;
    }

    // Clamp heat between 0 and max
    gameState.heat[player] = Math.max(0, Math.min(gameState.heat.maxHeat, gameState.heat[player]));
}

// ==================== CALCULATE DRAIN ====================
export function calculateDrain(gameState) {
    let totalDrain = 0;
    if (gameState.systems.comms) totalDrain += SYSTEM_DRAIN_RATE;
    if (gameState.systems.payload) totalDrain += SYSTEM_DRAIN_RATE;
    if (gameState.systems.camera) totalDrain += SYSTEM_DRAIN_RATE;
    return totalDrain;
}

// ==================== CHECK ECLIPSE (re-exported from scene) ====================
export { checkEclipse };
