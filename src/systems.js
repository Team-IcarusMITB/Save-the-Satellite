// ==================== SYSTEMS MODULE ====================
import { checkEclipse, getManeuverPowerDraw } from './scene.js';

// Battery parameters
const CHARGE_RATE = 1.5; // % per frame in sunlight (at 60fps = 0.9% per second)
const DRAIN_RATE_ECLIPSE = 2.0; // % per frame in eclipse
const SYSTEM_DRAIN_RATE = 0.8; // % per frame per active system

let lastUpdateTime = Date.now();

// ==================== UPDATE BATTERY ====================
let batteryLogCounter = 0;
export function updateBattery(gameState) {
    batteryLogCounter++;
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000; // Convert to seconds
    lastUpdateTime = now;

    const { isInSunlight } = checkEclipse();

    // Calculate drain from active systems
    let systemDrain = 0;
    if (gameState.systems.comms) systemDrain += SYSTEM_DRAIN_RATE;
    if (gameState.systems.payload) systemDrain += SYSTEM_DRAIN_RATE;
    if (gameState.systems.camera) systemDrain += SYSTEM_DRAIN_RATE;

    // Manual maneuvering consumes extra power.
    const maneuverDrain = getManeuverPowerDraw();

    // Calculate battery change per frame (approximate for 60fps)
    let batteryChange = 0;

    if (isInSunlight) {
        // Charging in sunlight
        batteryChange = CHARGE_RATE - (systemDrain * 0.5 + maneuverDrain * 0.6); // Controls cost less in sunlight but still consume power
    } else {
        // Draining in eclipse
        batteryChange = -(DRAIN_RATE_ECLIPSE + systemDrain + maneuverDrain);
    }

    // Apply battery change
    gameState.battery += batteryChange * deltaTime;

    // Clamp battery between 0 and 100
    gameState.battery = Math.max(0, Math.min(100, gameState.battery));
    
    // Log battery updates every 60 calls (~1 second)
    if (batteryLogCounter % 60 === 0) {
        console.log(`🔋 Battery: ${gameState.battery.toFixed(1)}% | ${isInSunlight ? '☀️ SUNLIGHT' : '🌑 ECLIPSE'} | Systems: ${Object.values(gameState.systems).filter(v => v).length} active | Maneuver load: ${maneuverDrain.toFixed(2)}`);
    }
}

// ==================== CALCULATE DRAIN ====================
export function calculateDrain(gameState) {
    let totalDrain = 0;
    if (gameState.systems.comms) totalDrain += SYSTEM_DRAIN_RATE;
    if (gameState.systems.payload) totalDrain += SYSTEM_DRAIN_RATE;
    if (gameState.systems.camera) totalDrain += SYSTEM_DRAIN_RATE;
    totalDrain += getManeuverPowerDraw();
    return totalDrain;
}

// ==================== CHECK ECLIPSE (re-exported from scene) ====================
export { checkEclipse };
