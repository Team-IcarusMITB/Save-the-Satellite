const SUN_DIR = { x: -0.784, z: 0.588 };
const ECLIPSE_THRESHOLD = -0.3;

export function updateUI(gameState) {
    updateBatteryDisplay(gameState.battery);
    updateStatusIndicator(gameState.isInSunlight);
    updateSurvivalTime(gameState.survivalTime);
    updateSystemButtons(gameState);
    updateFaultDisplay(gameState.faults);
    updatePowerFlow(gameState);
    updateOrbitMap(gameState);
    updateScore(gameState);
    applyVisualPenalties(gameState);
}

function applyVisualPenalties(gameState) {
    const canvasContainer = document.querySelector('.canvas-container');
    if (gameState.systems.camera) {
        canvasContainer.style.filter = 'none';
    } else {
        canvasContainer.style.filter = 'blur(6px)';
    }

    const orbitMap = document.getElementById('orbitMap');
    if (gameState.systems.comms) {
        orbitMap.classList.remove('glitch-effect');
        orbitMap.style.filter = 'none';
    } else {
        orbitMap.classList.add('glitch-effect');
        orbitMap.style.filter = 'blur(4px) contrast(1.5)';
    }
}

function updateBatteryDisplay(battery) {
    const batteryPercent = document.getElementById('batteryPercent');
    const batteryBar = document.getElementById('batteryBar');
    const batteryGlow = document.getElementById('batteryGlow');

    if (batteryPercent) batteryPercent.textContent = Math.round(battery) + '%';
    if (!batteryBar) return;

    batteryBar.style.width = battery + '%';
    batteryBar.classList.remove('warning', 'critical');

    if (battery <= 15) {
        batteryBar.classList.add('critical');
        if (batteryGlow) batteryGlow.style.opacity = '1';
    } else if (battery <= 35) {
        batteryBar.classList.add('warning');
        if (batteryGlow) batteryGlow.style.opacity = '0.5';
    } else {
        if (batteryGlow) batteryGlow.style.opacity = '0';
    }
}

function updateStatusIndicator(isInSunlight) {
    const el = document.getElementById('statusIndicator');
    if (!el) return;
    if (isInSunlight) {
        el.textContent = 'SUNLIT';
        el.className = 'status-badge sunlight';
    } else {
        el.textContent = 'ECLIPSE';
        el.className = 'status-badge eclipse';
    }
}

function updateSurvivalTime(survivalTime) {
    const el = document.getElementById('survivalTime');
    if (!el) return;
    const m = Math.floor(survivalTime / 60);
    const s = survivalTime % 60;
    el.textContent = m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function updateSystemButtons(gameState) {
    const map = { comms: 'commToggle', payload: 'payloadToggle', camera: 'cameraToggle' };
    Object.entries(map).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        
        if (gameState.systems[key]) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        if (gameState.faults.lockedSystems?.includes(key)) {
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
            btn.style.borderColor = 'var(--red)';
            btn.style.color = 'var(--red)';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    });
}

function updatePowerFlow(gameState) {
    const el = document.getElementById('powerFlow');
    if (!el) return;

    const rate = gameState.powerFlowRate ?? 0;
    const sign = rate >= 0 ? '+' : '';
    const arrow = rate >= 0 ? '▲' : '▼';
    const cssClass = rate >= 0 ? 'charging' : 'draining';

    el.className = 'power-flow ' + cssClass;
    el.innerHTML = `${arrow} ${sign}${rate.toFixed(2)}%<span class="per-sec">/s</span>`;
}

function updateFaultDisplay(faults) {
    const faultAlert = document.getElementById('faultAlert');
    const faultText = document.getElementById('faultText');
    const faultTimer = document.getElementById('faultTimer');
    const fixFaultButton = document.getElementById('fixFaultButton');

    if (!faultAlert) return;

    if (faults.current) {
        faultAlert.classList.remove('hidden');
        faultAlert.classList.add('active');
        faultAlert.classList.toggle('fault-critical', faults.severity === 'critical');

        if (faultText) faultText.textContent = faults.current;
        if (fixFaultButton) fixFaultButton.classList.remove('hidden');

        if (faultTimer && faults.timer !== null) {
            const elapsed = Date.now() - faults.timer;
            const remaining = Math.max(0, (faults.maxTime - elapsed) / 1000);
            faultTimer.textContent = remaining.toFixed(1) + 's';
            faultTimer.className = remaining < 10 ? 'fault-timer urgent' : 'fault-timer';
        }
    } else {
        faultAlert.classList.add('hidden');
        faultAlert.classList.remove('active', 'fault-critical');
        if (faultText) faultText.textContent = '';
        if (fixFaultButton) fixFaultButton.classList.add('hidden');
    }
}

let orbitCanvas, orbitCtx;

function updateOrbitMap(gameState) {
    if (!orbitCanvas) {
        orbitCanvas = document.getElementById('orbitMap');
        if (!orbitCanvas) return;
        orbitCtx = orbitCanvas.getContext('2d');
    }

    const W = orbitCanvas.width;
    const H = orbitCanvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const orbitR = W * 0.37;
    const earthR = W * 0.13;
    const scale = orbitR / (gameState.orbitRadius || 3.5);

    orbitCtx.clearRect(0, 0, W, H);

    const STEPS = 360;
    orbitCtx.save();
    orbitCtx.beginPath();
    let firstEclipse = true;
    for (let i = 0; i <= STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2;
        const dot = SUN_DIR.x * Math.cos(a) + SUN_DIR.z * Math.sin(a);
        const inEclipse = dot < ECLIPSE_THRESHOLD;
        const sx = cx + Math.cos(a) * orbitR;
        const sy = cy - Math.sin(a) * orbitR;
        if (inEclipse) {
            if (firstEclipse) { orbitCtx.moveTo(cx, cy); orbitCtx.lineTo(sx, sy); firstEclipse = false; }
            else orbitCtx.lineTo(sx, sy);
        }
    }
    if (!firstEclipse) {
        orbitCtx.closePath();
        const grad = orbitCtx.createRadialGradient(cx, cy, 0, cx, cy, orbitR);
        grad.addColorStop(0, 'rgba(0,0,30,0.0)');
        grad.addColorStop(0.8, 'rgba(0,0,20,0.55)');
        grad.addColorStop(1, 'rgba(20,20,80,0.25)');
        orbitCtx.fillStyle = grad;
        orbitCtx.fill();
    }
    orbitCtx.restore();

    orbitCtx.save();
    orbitCtx.strokeStyle = 'rgba(30, 80, 160, 0.55)';
    orbitCtx.lineWidth = 1.5;
    orbitCtx.setLineDash([4, 4]);
    orbitCtx.beginPath();
    orbitCtx.arc(cx, cy, orbitR, 0, Math.PI * 2);
    orbitCtx.stroke();
    orbitCtx.restore();

    const earthGrad = orbitCtx.createRadialGradient(cx - earthR * 0.2, cy - earthR * 0.2, earthR * 0.1, cx, cy, earthR);
    earthGrad.addColorStop(0, '#1a6be0');
    earthGrad.addColorStop(0.5, '#0d4aaa');
    earthGrad.addColorStop(1, '#051530');
    orbitCtx.beginPath();
    orbitCtx.arc(cx, cy, earthR, 0, Math.PI * 2);
    orbitCtx.fillStyle = earthGrad;
    orbitCtx.fill();

    const glowGrad = orbitCtx.createRadialGradient(cx, cy, earthR, cx, cy, earthR * 1.4);
    glowGrad.addColorStop(0, 'rgba(30, 120, 255, 0.25)');
    glowGrad.addColorStop(1, 'rgba(30, 120, 255, 0)');
    orbitCtx.beginPath();
    orbitCtx.arc(cx, cy, earthR * 1.4, 0, Math.PI * 2);
    orbitCtx.fillStyle = glowGrad;
    orbitCtx.fill();

    const sunAngle = Math.atan2(SUN_DIR.z, SUN_DIR.x);
    const sunArrowLen = orbitR * 0.18;
    const sunTipX = cx + Math.cos(Math.PI + sunAngle) * (orbitR + sunArrowLen + 3);
    const sunTipY = cy - Math.sin(Math.PI + sunAngle) * (orbitR + sunArrowLen + 3);
    orbitCtx.save();
    orbitCtx.strokeStyle = 'rgba(255, 220, 80, 0.85)';
    orbitCtx.lineWidth = 2;
    orbitCtx.beginPath();
    orbitCtx.moveTo(cx + Math.cos(Math.PI + sunAngle) * (orbitR + 3), cy - Math.sin(Math.PI + sunAngle) * (orbitR + 3));
    orbitCtx.lineTo(sunTipX, sunTipY);
    orbitCtx.stroke();
    
    const ah = sunAngle + Math.PI;
    orbitCtx.beginPath();
    orbitCtx.moveTo(sunTipX, sunTipY);
    orbitCtx.lineTo(sunTipX + Math.cos(ah + 0.5) * 6, sunTipY - Math.sin(ah + 0.5) * 6);
    orbitCtx.lineTo(sunTipX + Math.cos(ah - 0.5) * 6, sunTipY - Math.sin(ah - 0.5) * 6);
    orbitCtx.closePath();
    orbitCtx.fillStyle = 'rgba(255, 220, 80, 0.85)';
    orbitCtx.fill();
    orbitCtx.restore();

    if (gameState.debris && gameState.debris.items && gameState.systems.comms) {
        gameState.debris.items.forEach(d => {
            const cxD = cx + d.position.x * scale;
            const cyD = cy - d.position.z * scale;
            
            orbitCtx.save();
            orbitCtx.strokeStyle = 'rgba(255, 60, 60, 0.4)';
            orbitCtx.lineWidth = 1;
            orbitCtx.beginPath();
            orbitCtx.moveTo(cxD - d.velocity.x * scale * 500, cyD - (-d.velocity.z) * scale * 500);
            orbitCtx.lineTo(cxD + d.velocity.x * scale * 500, cyD + (-d.velocity.z) * scale * 500);
            orbitCtx.stroke();
            orbitCtx.restore();

            orbitCtx.beginPath();
            orbitCtx.arc(cxD, cyD, 2.5, 0, Math.PI * 2);
            orbitCtx.fillStyle = '#ff3c3c';
            orbitCtx.fill();
        });
    }

    const orbitAngle = gameState.orbitAngle ?? 0;
    const satCanvasX = cx + Math.cos(orbitAngle) * orbitR;
    const satCanvasY = cy - Math.sin(orbitAngle) * orbitR;

    const satGlow = orbitCtx.createRadialGradient(satCanvasX, satCanvasY, 0, satCanvasX, satCanvasY, 10);
    const satColor = gameState.isInSunlight ? 'rgba(80, 220, 80, ' : 'rgba(255, 160, 0, ';
    satGlow.addColorStop(0, satColor + '0.9)');
    satGlow.addColorStop(1, satColor + '0)');
    orbitCtx.beginPath();
    orbitCtx.arc(satCanvasX, satCanvasY, 10, 0, Math.PI * 2);
    orbitCtx.fillStyle = satGlow;
    orbitCtx.fill();

    orbitCtx.beginPath();
    orbitCtx.arc(satCanvasX, satCanvasY, 3.5, 0, Math.PI * 2);
    orbitCtx.fillStyle = gameState.isInSunlight ? '#55ff88' : '#ffaa22';
    orbitCtx.fill();
}

function updateScore(gameState) {
    const el = document.getElementById('scoreDisplay');
    if (el) el.textContent = Math.floor(gameState.score ?? 0).toLocaleString();

    const mEl = document.getElementById('moneyDisplay');
    if (mEl) mEl.textContent = '$' + Math.floor(gameState.money ?? 0).toLocaleString();

    const multEl = document.getElementById('multiplierDisplay');
    if (multEl) {
        const m = (gameState.scoreMultiplier ?? 1).toFixed(1);
        multEl.textContent = 'x' + m;
        multEl.className = 'multiplier ' + (parseFloat(m) > 1.0 ? 'active' : '');
    }
}

export function setupUIListeners(gameState) {
    document.getElementById('commToggle')?.addEventListener('click', () => {
        if (!gameState.faults.lockedSystems?.includes('comms')) {
            gameState.systems.comms = !gameState.systems.comms;
        }
    });
    document.getElementById('payloadToggle')?.addEventListener('click', () => {
        if (!gameState.faults.lockedSystems?.includes('payload')) {
            gameState.systems.payload = !gameState.systems.payload;
        }
    });
    document.getElementById('cameraToggle')?.addEventListener('click', () => {
        if (!gameState.faults.lockedSystems?.includes('camera')) {
            gameState.systems.camera = !gameState.systems.camera;
        }
    });
}