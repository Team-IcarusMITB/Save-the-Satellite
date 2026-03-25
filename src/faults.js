const FAULT_TYPES = [
    { name: 'COMM LINK DROPOUT',     severity: 'warning',  locks: ['comms'] },
    { name: 'PAYLOAD ANOMALY',       severity: 'warning',  locks: ['payload'] },
    { name: 'SENSOR MALFUNCTION',    severity: 'warning',  locks: ['camera'] },
    { name: 'THRUSTER GIMBAL LOCK',  severity: 'critical', locks: ['movement'] },
    { name: 'POWER BUS GLITCH',      severity: 'critical', locks: ['comms', 'payload', 'camera', 'movement'] },
    { name: 'THERMAL OVERRUN',       severity: 'warning',  locks: ['payload', 'camera'] },
    { name: 'ATTITUDE DEVIATION',    severity: 'warning',  locks: ['movement', 'camera'] },
    { name: 'MEMORY CHECKSUM ERR',   severity: 'warning',  locks: ['payload'] },
    { name: 'SOLAR ARRAY ALIGN ERR', severity: 'critical', locks: ['payload'], effect: 'noCharge' },
    { name: 'BATTERY CELL SHORT',    severity: 'critical', locks: ['camera', 'comms'], effect: 'drainBattery' }
];

export function generateRandomFault(gameState) {
    if (gameState.faults.current) return null;

    const fault = FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];
    gameState.faults.current = fault.name;
    gameState.faults.severity = fault.severity;
    gameState.faults.count += 1;
    gameState.faults.lockedSystems = fault.locks || [];
    
    // Save snapshot of what was currently turned on
    gameState.faults.savedSystems = { ...gameState.systems };
    
    // Automatically turn them off when locked
    gameState.faults.lockedSystems.forEach(sys => {
        if (sys !== 'movement') {
            gameState.systems[sys] = false;
        }
    });

    // Handle immediate brutal effects
    if (fault.effect === 'noCharge') {
        gameState.faults.noCharge = true;
    }
    if (fault.effect === 'drainBattery') {
        gameState.battery *= 0.5; // Instantly rip away half their remaining battery
    }

    return fault;
}

export function updateFaults(gameState) {
    const dynamicProb = 0.002 + (gameState.survivalTime * 0.00005);
    if (!gameState.faults.current) {
        if (Math.random() < dynamicProb) {
            generateRandomFault(gameState);
        }
    }
}