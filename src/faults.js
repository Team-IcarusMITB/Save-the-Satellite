// ==================== FAULTS MODULE ====================

const FAULT_TYPES = [
    'Communications Failure',
    'Payload Error',
    'Power Glitch',
    'Sensor Malfunction',
    'Thermal Warning'
];

// Probability of fault per frame (at 60fps, this is ~1% chance per frame = avg 100 frames = ~1.67 seconds)
// Adjust this value to change fault frequency
const FAULT_PROBABILITY = 0.006; // ~0.6% chance per frame = average fault every 2-3 seconds

// ==================== GENERATE RANDOM FAULT ====================
export function generateRandomFault(gameState) {
    const randomFault = FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];
    gameState.faults.current = randomFault;
    gameState.faults.count += 1;
    console.log(`⚡ FAULT TRIGGERED: ${randomFault} (Count: ${gameState.faults.count})`);
    return randomFault;
}

// ==================== UPDATE FAULTS ====================
export function updateFaults(gameState) {
    const difficultyFaultMultiplier = gameState?.difficulty?.faultChanceMultiplier || 1;
    const dynamicFaultProbability = Math.min(0.02, FAULT_PROBABILITY * difficultyFaultMultiplier);

    // If no fault is active, randomly generate one based on probability
    if (!gameState.faults.current) {
        if (Math.random() < dynamicFaultProbability) {
            generateRandomFault(gameState);
        }
    }

    // If there's an active fault, it will persist until user clicks "Restart System"
}
