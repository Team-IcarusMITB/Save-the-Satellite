let timerInterval;
let currentAnimFrame = null;
let lastPlayedGame = null; // Tracks the last played game

export function startRandomMinigame(onSuccess, onFailure) {
    const modal = document.getElementById('minigameModal');
    const area = document.getElementById('minigameArea');
    const timeSpan = document.getElementById('mgTime');
    
    area.style.cssText = '';
    area.innerHTML = '';
    if (currentAnimFrame) cancelAnimationFrame(currentAnimFrame);
    
    modal.classList.remove('hidden');
    
    const games = [
        playKeypad, playSlider, playWires, playMemory, playTargets,
        playDownload, playSwitches, playScrub, playFuses, playMatch, playMath
    ];
    
    // Filter out the last played game so we never get the same one twice in a row
    const availableGames = games.filter(game => game !== lastPlayedGame);
    const selectedGame = availableGames[Math.floor(Math.random() * availableGames.length)];
    lastPlayedGame = selectedGame;
    
    let timeLeft = 15;
    timeSpan.textContent = timeLeft;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timeSpan.textContent = timeLeft;
        if (timeLeft <= 0) {
            endMinigame(false, onFailure);
        }
    }, 1000);

    selectedGame(
        () => endMinigame(true, onSuccess),
        () => endMinigame(false, onFailure)
    );
}

function endMinigame(isSuccess, callback) {
    clearInterval(timerInterval);
    if (currentAnimFrame) cancelAnimationFrame(currentAnimFrame);
    document.getElementById('minigameModal').classList.add('hidden');
    callback();
}

function playKeypad(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "AUTHORIZE: SEQUENCE 1-9";
    const area = document.getElementById('minigameArea');
    
    const grid = document.createElement('div');
    grid.className = 'keypad-grid';
    
    let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    let currentTarget = 1;
    
    numbers.forEach(num => {
        const btn = document.createElement('button');
        btn.className = 'keypad-btn';
        btn.textContent = num;
        btn.onclick = () => {
            if (num === currentTarget) {
                btn.classList.add('correct');
                currentTarget++;
                if (currentTarget > 9) winCallback();
            } else {
                loseCallback();
            }
        };
        grid.appendChild(btn);
    });
    
    area.appendChild(grid);
}

function playSlider(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "CALIBRATE TIMING";
    const area = document.getElementById('minigameArea');
    area.style.flexDirection = 'column';
    
    const container = document.createElement('div');
    container.className = 'slider-container';
    
    const target = document.createElement('div');
    target.className = 'slider-target';
    
    const block = document.createElement('div');
    block.className = 'slider-block';
    
    container.appendChild(target);
    container.appendChild(block);
    
    const btn = document.createElement('button');
    btn.className = 'slider-btn';
    btn.textContent = "LOCK CALIBRATION";
    
    area.appendChild(container);
    area.appendChild(btn);
    
    let pos = 0;
    let direction = 1;
    let speed = 2.5;
    
    const animate = () => {
        pos += direction * speed;
        if (pos <= 0 || pos >= 95) direction *= -1;
        block.style.left = pos + '%';
        currentAnimFrame = requestAnimationFrame(animate);
    };
    currentAnimFrame = requestAnimationFrame(animate);
    
    btn.onclick = () => {
        cancelAnimationFrame(currentAnimFrame);
        let center = pos + 2.5;
        if (center >= 40 && center <= 60) {
            winCallback();
        } else {
            loseCallback();
        }
    };
}

function playWires(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "RECONNECT WIRES";
    const area = document.getElementById('minigameArea');
    
    const container = document.createElement('div');
    container.className = 'wires-container';
    
    const leftCol = document.createElement('div');
    leftCol.className = 'wire-col';
    const rightCol = document.createElement('div');
    rightCol.className = 'wire-col';
    
    const colors = ['#ff4444', '#00d4ff', '#00ff88', '#ffd700'];
    let leftColors = [...colors].sort(() => Math.random() - 0.5);
    let rightColors = [...colors].sort(() => Math.random() - 0.5);
    
    let selectedColor = null;
    let selectedNode = null;
    let connectedCount = 0;
    
    leftColors.forEach(color => {
        const node = document.createElement('div');
        node.className = 'wire-node';
        node.style.backgroundColor = color;
        node.onclick = () => {
            if (node.classList.contains('connected')) return;
            if (selectedNode) selectedNode.classList.remove('selected');
            selectedColor = color;
            selectedNode = node;
            node.classList.add('selected');
        };
        leftCol.appendChild(node);
    });
    
    rightColors.forEach(color => {
        const node = document.createElement('div');
        node.className = 'wire-node';
        node.style.backgroundColor = color;
        node.onclick = () => {
            if (!selectedColor || node.classList.contains('connected')) return;
            
            if (color === selectedColor) {
                node.classList.add('connected');
                selectedNode.classList.add('connected');
                selectedNode.classList.remove('selected');
                selectedColor = null;
                selectedNode = null;
                connectedCount++;
                if (connectedCount === colors.length) winCallback();
            } else {
                // FIXED: Do not instantly fail on a wrong connection. Just flash red and reset selection.
                const oldSelected = selectedNode;
                oldSelected.classList.remove('selected');
                selectedColor = null;
                selectedNode = null;
                
                node.style.borderColor = '#ff0000';
                setTimeout(() => {
                    node.style.borderColor = '#333';
                }, 300);
            }
        };
        rightCol.appendChild(node);
    });
    
    container.appendChild(leftCol);
    container.appendChild(rightCol);
    area.appendChild(container);
}

function playMemory(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "MATCH PATTERN";
    const area = document.getElementById('minigameArea');
    
    const grid = document.createElement('div');
    grid.className = 'memory-grid';
    
    const colors = ['#ff4444', '#00d4ff', '#00ff88', '#ffd700'];
    const buttons = [];
    
    colors.forEach(color => {
        const btn = document.createElement('div');
        btn.className = 'memory-btn';
        btn.style.color = color;
        btn.style.backgroundColor = color;
        grid.appendChild(btn);
        buttons.push(btn);
    });
    
    area.appendChild(grid);
    
    let pattern = [];
    for(let i=0; i<4; i++) {
        pattern.push(Math.floor(Math.random() * 4));
    }
    
    let showingPattern = true;
    let currentIndex = 0;
    
    const showPattern = (index) => {
        if (index >= pattern.length) {
            showingPattern = false;
            return;
        }
        const btn = buttons[pattern[index]];
        btn.classList.add('active');
        setTimeout(() => {
            btn.classList.remove('active');
            setTimeout(() => showPattern(index + 1), 200);
        }, 500);
    };
    
    setTimeout(() => showPattern(0), 500);
    
    buttons.forEach((btn, index) => {
        btn.onclick = () => {
            if (showingPattern) return;
            if (index === pattern[currentIndex]) {
                currentIndex++;
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 200);
                if (currentIndex >= pattern.length) winCallback();
            } else {
                loseCallback();
            }
        };
    });
}

function playTargets(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "DESTROY ASTEROIDS";
    const area = document.getElementById('minigameArea');
    
    const container = document.createElement('div');
    container.className = 'target-area';
    
    let targetsHit = 0;
    const totalTargets = 5;
    
    const spawnTarget = () => {
        const dot = document.createElement('div');
        dot.className = 'target-dot';
        dot.style.left = Math.random() * 80 + '%';
        dot.style.top = Math.random() * 80 + '%';
        
        dot.onclick = () => {
            dot.remove();
            targetsHit++;
            if (targetsHit >= totalTargets) {
                winCallback();
            } else {
                spawnTarget();
            }
        };
        
        container.appendChild(dot);
    };
    
    area.appendChild(container);
    spawnTarget();
}

function playDownload(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "DOWNLOAD DATA";
    const area = document.getElementById('minigameArea');
    area.style.flexDirection = 'column';
    
    const container = document.createElement('div');
    container.className = 'download-container';
    
    const bar = document.createElement('div');
    bar.className = 'download-bar';
    container.appendChild(bar);
    
    const btn = document.createElement('button');
    btn.className = 'download-btn';
    btn.textContent = "HOLD TO DOWNLOAD";
    
    area.appendChild(container);
    area.appendChild(btn);
    
    let progress = 0;
    let isHolding = false;
    
    const update = () => {
        if (isHolding) {
            progress += 1;
            if (progress >= 100) {
                winCallback();
                return;
            }
        } else if (progress > 0) {
            progress = 0;
        }
        bar.style.width = progress + '%';
        currentAnimFrame = requestAnimationFrame(update);
    };
    
    btn.onmousedown = () => isHolding = true;
    btn.onmouseup = () => isHolding = false;
    btn.onmouseleave = () => isHolding = false;
    btn.ontouchstart = () => isHolding = true;
    btn.ontouchend = () => isHolding = false;
    
    currentAnimFrame = requestAnimationFrame(update);
}

function playSwitches(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "ROUTE POWER";
    const area = document.getElementById('minigameArea');
    area.style.flexDirection = 'column';
    
    const container = document.createElement('div');
    container.className = 'switches-container';
    
    let values = [];
    for(let i=0; i<4; i++) values.push(Math.floor(Math.random() * 5) + 1);
    
    let targetSum = 0;
    values.forEach(v => {
        if (Math.random() > 0.5) targetSum += v;
    });
    if (targetSum === 0) targetSum = values[0];
    
    const title = document.createElement('div');
    title.style.color = '#fff';
    title.style.marginBottom = '20px';
    title.textContent = "REQUIRED POWER: " + targetSum;
    area.appendChild(title);
    
    let currentSum = 0;
    
    values.forEach(val => {
        const wrapper = document.createElement('div');
        wrapper.className = 'switch-item';
        
        const label = document.createElement('div');
        label.style.color = '#fff';
        label.textContent = val;
        
        const btn = document.createElement('div');
        btn.className = 'switch-btn';
        
        let isOn = false;
        
        btn.onclick = () => {
            isOn = !isOn;
            btn.classList.toggle('on');
            currentSum += isOn ? val : -val;
            
            if (currentSum === targetSum) {
                setTimeout(winCallback, 200);
            }
        };
        
        wrapper.appendChild(label);
        wrapper.appendChild(btn);
        container.appendChild(wrapper);
    });
    
    area.appendChild(container);
}

function playScrub(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "CLEAN LENS";
    const area = document.getElementById('minigameArea');
    
    const box = document.createElement('div');
    box.className = 'scrub-area';
    
    let dirtLevel = 100;
    box.style.opacity = dirtLevel / 100;
    
    const scrub = () => {
        dirtLevel -= 2;
        box.style.opacity = dirtLevel / 100;
        if (dirtLevel <= 0) {
            winCallback();
        }
    };
    
    box.onmousemove = scrub;
    box.ontouchmove = scrub;
    
    area.appendChild(box);
}

function playFuses(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "REPLACE BLOWN FUSE";
    const area = document.getElementById('minigameArea');
    
    const grid = document.createElement('div');
    grid.className = 'fuses-grid';
    
    let targetIndex = Math.floor(Math.random() * 9);
    
    for(let i=0; i<9; i++) {
        const fuse = document.createElement('div');
        fuse.className = 'fuse-item';
        if (i === targetIndex) {
            fuse.classList.add('blown');
            fuse.onclick = winCallback;
        } else {
            fuse.onclick = loseCallback;
        }
        grid.appendChild(fuse);
    }
    
    area.appendChild(grid);
}

function playMatch(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "MATCH DATA BLOCKS";
    const area = document.getElementById('minigameArea');
    
    const grid = document.createElement('div');
    grid.className = 'match-grid';
    
    let symbols = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'];
    symbols.sort(() => Math.random() - 0.5);
    
    let firstCard = null;
    let matches = 0;
    let canClick = true;
    
    symbols.forEach((symbol) => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.textContent = symbol;
        
        card.onclick = () => {
            if (!canClick || card.classList.contains('flipped') || card.classList.contains('matched')) return;
            
            card.classList.add('flipped');
            
            if (!firstCard) {
                firstCard = card;
            } else {
                canClick = false;
                if (firstCard.textContent === card.textContent) {
                    firstCard.classList.add('matched');
                    card.classList.add('matched');
                    firstCard = null;
                    matches++;
                    canClick = true;
                    if (matches === 4) setTimeout(winCallback, 200);
                } else {
                    setTimeout(() => {
                        firstCard.classList.remove('flipped');
                        card.classList.remove('flipped');
                        firstCard = null;
                        canClick = true;
                    }, 500);
                }
            }
        };
        grid.appendChild(card);
    });
    
    area.appendChild(grid);
}

// NEW MATH MINIGAME
function playMath(winCallback, loseCallback) {
    document.getElementById('minigameTitle').textContent = "CALCULATE TRAJECTORY";
    const area = document.getElementById('minigameArea');
    area.style.flexDirection = 'column';
    
    const a = Math.floor(Math.random() * 50) + 10;
    const b = Math.floor(Math.random() * 50) + 10;
    const isAddition = Math.random() > 0.5;
    
    let answer;
    let operator;
    if (isAddition) {
        answer = a + b;
        operator = '+';
    } else {
        answer = a - b;
        operator = '-';
    }

    const equation = document.createElement('div');
    equation.style.fontSize = '36px';
    equation.style.color = '#00d4ff';
    equation.style.marginBottom = '20px';
    equation.style.fontWeight = 'bold';
    equation.textContent = `${a} ${operator} ${b} = ?`;
    
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '15px';
    grid.style.width = '100%';

    let choices = [answer];
    while (choices.length < 4) {
        let offset = Math.floor(Math.random() * 20) - 10;
        if (offset === 0) offset = 1;
        let wrongAnswer = answer + offset;
        if (!choices.includes(wrongAnswer)) {
            choices.push(wrongAnswer);
        }
    }
    choices.sort(() => Math.random() - 0.5);

    choices.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'keypad-btn';
        btn.textContent = val;
        btn.onclick = () => {
            if (val === answer) {
                btn.classList.add('correct');
                setTimeout(winCallback, 300);
            } else {
                btn.style.borderColor = '#ff0000';
                btn.style.background = '#aa0000';
                setTimeout(loseCallback, 300); // Fail immediately if wrong answer
            }
        };
        grid.appendChild(btn);
    });

    area.appendChild(equation);
    area.appendChild(grid);
}