// ==================== SOUND EFFECTS SYSTEM ====================

let audioContext;
let isMuted = false;
const sounds = {};

// ==================== INITIALIZE AUDIO ====================
export function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ Audio system initialized');
        
        // Add visual indicator for muted state
        addAudioToggle();
    } catch (e) {
        console.warn('⚠️ Web Audio API not supported');
        isMuted = true;
    }
}

// ==================== PLAY ALARM ====================
export function playAlarm(duration = 0.3) {
    if (isMuted || !audioContext) return;

    try {
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Alarm sound - rapid beep
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.setValueAtTime(600, now + duration * 0.5);
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.setValueAtTime(0, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);

        console.log('🔔 Alarm sound played');
    } catch (e) {
        console.warn('Error playing alarm:', e);
    }
}

// ==================== PLAY SUCCESS CHIME ====================
export function playSuccess(duration = 0.5) {
    if (isMuted || !audioContext) return;

    try {
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Success chime - ascending tones
        oscillator.frequency.setValueAtTime(523, now); // C5
        oscillator.frequency.setValueAtTime(659, now + duration * 0.5); // E5
        
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.setValueAtTime(0, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);

        console.log('✨ Success chime played');
    } catch (e) {
        console.warn('Error playing success:', e);
    }
}

// ==================== PLAY COLLISION SOUND ====================
export function playCollision(duration = 0.2) {
    if (isMuted || !audioContext) return;

    try {
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Collision - low noise-like tone
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.setValueAtTime(150, now + duration);
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.setValueAtTime(0, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);

        console.log('💥 Collision sound played');
    } catch (e) {
        console.warn('Error playing collision:', e);
    }
}

// ==================== PLAY BACKGROUND AMBIENCE ====================
export function playAmbience() {
    if (isMuted || !audioContext) return;

    try {
        // Create continuous low-frequency ambient sound
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Very low frequency for ambience
        oscillator.frequency.setValueAtTime(20, now); // Subsonic
        gainNode.gain.setValueAtTime(0.05, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, now);

        oscillator.start(now);
        
        console.log('🎵 Background ambience started');

        // Return oscillator to stop later
        return { oscillator, gainNode };
    } catch (e) {
        console.warn('Error playing ambience:', e);
    }
}

// ==================== PLAY WARNING BEEP ====================
export function playWarning(duration = 0.15) {
    if (isMuted || !audioContext) return;

    try {
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Warning tone - steady
        oscillator.frequency.setValueAtTime(700, now);
        
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.setValueAtTime(0, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);

        console.log('⚠️ Warning beep played');
    } catch (e) {
        console.warn('Error playing warning:', e);
    }
}

// ==================== TOGGLE MUTE ====================
export function toggleMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('muteButton');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Sound On';
        muteBtn.classList.toggle('muted');
    }
    console.log(`Sound ${isMuted ? 'muted' : 'enabled'}`);
    return isMuted;
}

// ==================== ADD AUDIO TOGGLE TO UI ====================
function addAudioToggle() {
    const muteButton = document.createElement('button');
    muteButton.id = 'muteButton';
    muteButton.className = 'mute-button';
    muteButton.textContent = '🔊 Sound On';
    muteButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 15px;
        background-color: rgba(0, 212, 255, 0.2);
        border: 1px solid #00d4ff;
        color: #00d4ff;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        z-index: 100;
        transition: all 0.3s ease;
    `;
    
    muteButton.addEventListener('click', toggleMute);
    muteButton.addEventListener('mouseover', () => {
        muteButton.style.backgroundColor = 'rgba(0, 212, 255, 0.4)';
    });
    muteButton.addEventListener('mouseout', () => {
        muteButton.style.backgroundColor = isMuted ? 'rgba(255, 107, 107, 0.2)' : 'rgba(0, 212, 255, 0.2)';
    });

    document.body.appendChild(muteButton);
}

// ==================== GET MUTE STATE ====================
export function isSoundMuted() {
    return isMuted;
}