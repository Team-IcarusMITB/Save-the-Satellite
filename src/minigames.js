let currentMinigameLoop = null;
let lastMinigame = null;

export function openMinigame(onSuccess, onFail) {
    const modal = document.getElementById('minigameModal');
    const zone = document.getElementById('minigameZone');
    modal.classList.remove('hidden');
    zone.innerHTML = '';

    const games = [initKeypadGame, initSliderGame, initMashGame, initSequenceGame];
    const availableGames = games.filter(g => g !== lastMinigame);
    const selectedGame = availableGames.length > 0 ? availableGames[Math.floor(Math.random() * availableGames.length)] : games[0];
    lastMinigame = selectedGame;

    selectedGame(zone, onSuccess, onFail);
}

export function closeMinigame() {
    const modal = document.getElementById('minigameModal');
    modal.classList.add('hidden');
    if (currentMinigameLoop) {
        cancelAnimationFrame(currentMinigameLoop);
        currentMinigameLoop = null;
    }
}

export function updateMinigameTimer(remaining, total) {
    const bar = document.getElementById('mgTimerBar');
    if (!bar) return;
    const pct = Math.max(0, (remaining / total) * 100);
    bar.style.width = pct + '%';
    if (pct < 25) {
        bar.classList.add('urgent');
    } else {
        bar.classList.remove('urgent');
    }
}

function initKeypadGame(zone, onSuccess, onFail) {
    let currentExpected = 1;
    const maxNumber = 9;
    const grid = document.createElement('div');
    grid.className = 'mg-keypad';
    let numbers = [];
    for (let i = 1; i <= maxNumber; i++) numbers.push(i);
    numbers.sort(() => Math.random() - 0.5);

    numbers.forEach(num => {
        const btn = document.createElement('button');
        btn.className = 'mg-btn';
        btn.textContent = num;
        btn.onclick = () => {
            if (num === currentExpected) {
                btn.classList.add('active');
                currentExpected++;
                if (currentExpected > maxNumber) setTimeout(onSuccess, 300);
            } else {
                btn.classList.add('error');
                setTimeout(onFail, 300);
            }
        };
        grid.appendChild(btn);
    });
    zone.appendChild(grid);
}

function initSliderGame(zone, onSuccess, onFail) {
    const container = document.createElement('div');
    container.className = 'mg-slider-container';
    const target = document.createElement('div');
    target.className = 'mg-slider-target';
    const bar = document.createElement('div');
    bar.className = 'mg-slider-bar';
    container.appendChild(target);
    container.appendChild(bar);

    const btn = document.createElement('button');
    btn.className = 'mg-lock-btn';
    btn.textContent = 'LOCK ALIGNMENT';

    zone.appendChild(container);
    zone.appendChild(btn);

    let position = 0;
    let direction = 1;
    let speed = 2.5 + Math.random() * 2.5;

    function animate() {
        position += direction * speed;
        if (position > 100) { position = 100; direction = -1; } 
        else if (position < 0) { position = 0; direction = 1; }
        bar.style.left = position + '%';
        currentMinigameLoop = requestAnimationFrame(animate);
    }
    
    currentMinigameLoop = requestAnimationFrame(animate);

    btn.onclick = () => {
        cancelAnimationFrame(currentMinigameLoop);
        currentMinigameLoop = null;
        if (position >= 40 && position <= 60) {
            bar.style.backgroundColor = '#00e87a';
            setTimeout(onSuccess, 400);
        } else {
            bar.style.backgroundColor = '#ff3c3c';
            setTimeout(onFail, 400);
        }
    };
}

function initMashGame(zone, onSuccess, onFail) {
    let clicks = 0;
    const required = 15;
    const btn = document.createElement('button');
    btn.className = 'mg-lock-btn';
    btn.style.height = '80px';
    btn.textContent = 'PRESS RAPIDLY: 0 / ' + required;
    
    btn.onclick = () => {
        clicks++;
        btn.textContent = 'PRESS RAPIDLY: ' + clicks + ' / ' + required;
        const color = `rgba(0, ${Math.min(255, clicks*17)}, 232, 0.3)`;
        btn.style.backgroundColor = color;
        if (clicks >= required) {
            btn.style.backgroundColor = '#00e87a';
            btn.style.color = '#000';
            setTimeout(onSuccess, 300);
        }
    };
    zone.appendChild(btn);
}

function initSequenceGame(zone, onSuccess, onFail) {
    const reqColors = ['#00c8e8', '#ffe040', '#ff3c3c', '#00e87a'];
    reqColors.sort(() => Math.random() - 0.5);
    
    const container = document.createElement('div');
    container.className = 'mg-seq-container';
    
    const boxes = [];
    for(let i=0; i<4; i++) {
        const box = document.createElement('div');
        box.className = 'mg-seq-box';
        box.style.borderColor = reqColors[i];
        container.appendChild(box);
        boxes.push(box);
    }
    zone.appendChild(container);

    const btnWrap = document.createElement('div');
    btnWrap.style.display = 'flex';
    btnWrap.style.gap = '10px';
    
    let currentIndex = 0;
    const buttons = [...reqColors].sort(() => Math.random() - 0.5);

    buttons.forEach(color => {
        const btn = document.createElement('div');
        btn.style.width = '50px';
        btn.style.height = '50px';
        btn.style.backgroundColor = color;
        btn.style.cursor = 'pointer';
        btn.style.border = '2px solid #fff';
        btn.onclick = () => {
            if (color === reqColors[currentIndex]) {
                boxes[currentIndex].style.backgroundColor = color;
                currentIndex++;
                if (currentIndex >= 4) setTimeout(onSuccess, 300);
            } else {
                setTimeout(onFail, 300);
            }
        };
        btnWrap.appendChild(btn);
    });
    zone.appendChild(btnWrap);
}