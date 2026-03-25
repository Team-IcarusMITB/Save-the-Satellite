import { checkEclipse } from './scene.js';

const CHARGE_RATE = 10.0;
const DRAIN_RATE_ECLIPSE = 2.0;
const MOVEMENT_DRAIN_RATE = 5.0;
const SYSTEM_DRAIN = {
    comms: 1.0,
    payload: 2.0,
    camera: 1.5
};

let lastUpdateTime = Date.now();

export function updateBattery(gameState) {
    const now = Date.now();
    const deltaTime = Math.min((now - lastUpdateTime) / 1000, 0.1);
    lastUpdateTime = now;

    const { isInSunlight } = checkEclipse();
    gameState.isInSunlight = isInSunlight;

    let systemDrain = 0;
    if (gameState.systems.comms) systemDrain += SYSTEM_DRAIN.comms;
    if (gameState.systems.payload) systemDrain += SYSTEM_DRAIN.payload;
    if (gameState.systems.camera) systemDrain += SYSTEM_DRAIN.camera;
    if (gameState.isThrusting) systemDrain += MOVEMENT_DRAIN_RATE;

    const chargeRate = gameState.faults.noCharge ? 0 : CHARGE_RATE;

    let batteryChange;
    if (isInSunlight) {
        batteryChange = chargeRate - systemDrain;
    } else {
        batteryChange = -(DRAIN_RATE_ECLIPSE + systemDrain);
    }

    gameState.battery += batteryChange * deltaTime;
    gameState.battery = Math.max(0, Math.min(100, gameState.battery));
}

export function getPowerFlowRate(gameState) {
    const { isInSunlight } = checkEclipse();

    let systemDrain = 0;
    if (gameState.systems.comms) systemDrain += SYSTEM_DRAIN.comms;
    if (gameState.systems.payload) systemDrain += SYSTEM_DRAIN.payload;
    if (gameState.systems.camera) systemDrain += SYSTEM_DRAIN.camera;
    if (gameState.isThrusting) systemDrain += MOVEMENT_DRAIN_RATE;

    const chargeRate = gameState.faults.noCharge ? 0 : CHARGE_RATE;

    if (isInSunlight) {
        return chargeRate - systemDrain;
    } else {
        return -(DRAIN_RATE_ECLIPSE + systemDrain);
    }
}

export { checkEclipse };