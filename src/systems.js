// ==================== SYSTEMS MODULE ====================
import { checkEclipse } from './scene.js';

// Battery parameters
const CHARGE_RATE = 5; // % per frame in sunlight (at 60fps = 0.9% per second)
const DRAIN_RATE_ECLIPSE = 2.0; // % per frame in eclipse

// Movement and Boost parameters
const MOVEMENT_DRAIN_RATE = 5.0; // % battery per second when moving (reduced from 8%)
const BOOST_DRAIN_RATE = 12.0; // % battery per second when boosting (reduced from 20%)

// Heat generation and dissipation
const MOVEMENT_HEAT_GENERATION = 8.0; // % heat per second from WASD/gamepad movement
const BOOST_HEAT_GENERATION = 20.0; // % heat per second when boosting
const HEAT_DISSIPATION_RATE = 3.0; // % heat per second dissipation (when idle)

let lastUpdateTime = Date.now();

// ==================== UPDATE BATTERY & HEAT ====================
let batteryLogCounter = 0;
export function updateBattery(gameState) {
    batteryLogCounter++;
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;

    const { litByLight } = checkEclipse();

    // Calculate base battery change (same for both players)
    let baseBatteryChange = 0;

    if (litByLight) {
        // Charging in sunlight
        baseBatteryChange = CHARGE_RATE;
    } else {
        // Draining in eclipse
        baseBatteryChange = -DRAIN_RATE_ECLIPSE;
    }

    // Update Player 1 battery
    let p1BatteryChange = baseBatteryChange;
    if (gameState.boost.player1.active && gameState.battery.player1 > 0) {
        p1BatteryChange -= BOOST_DRAIN_RATE;
    }
    if (gameState.movement.player1.active && gameState.battery.player1 > 0) {
        p1BatteryChange -= MOVEMENT_DRAIN_RATE;
    }
    gameState.battery.player1 += p1BatteryChange * deltaTime;
    gameState.battery.player1 = Math.max(0, Math.min(100, gameState.battery.player1));

    // Update Player 2 battery (NOW PROPERLY TRACKED)
    let p2BatteryChange = baseBatteryChange;
    if (gameState.boost.player2.active && gameState.battery.player2 > 0) {
        p2BatteryChange -= BOOST_DRAIN_RATE;
    }
    if (gameState.movement.player2.active && gameState.battery.player2 > 0) {
        p2BatteryChange -= MOVEMENT_DRAIN_RATE;
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
    const isMovementActive = player === 'player1' ? gameState.movement.player1.active : gameState.movement.player2.active;
    const battery = player === 'player1' ? gameState.battery.player1 : gameState.battery.player2;
    
    let heatChange = 0;
    
    if (battery > 0) {
        // Generate heat from boost
        if (isBoostActive) {
            heatChange += BOOST_HEAT_GENERATION * deltaTime;
        }
        
        // Generate heat from movement
        if (isMovementActive) {
            heatChange += MOVEMENT_HEAT_GENERATION * deltaTime;
        }
    }
    
    // Dissipate heat when no activities
    if (!isBoostActive && !isMovementActive) {
        heatChange -= HEAT_DISSIPATION_RATE * deltaTime;
    } else if (heatChange < 0) {
        // Slower dissipation when active with no boost (just movement or idle state)
        heatChange *= 0.5;
    }
    
    gameState.heat[player] += heatChange;

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
