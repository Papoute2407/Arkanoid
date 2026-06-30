import { BALL_SIZE, BALL_SPEED, PADDLE_SPEED, BONUS_CHANCE, LEVELS } from "./constants.js";
import { playSound, ambiance } from "./sounds.js";
import { balls, createMainBall, resetBalls } from "./balls.js";
import { createBonus, updateBonuses, resetBonuses } from "./bonuses.js";

// ── Éléments DOM ──────────────────────────────────────────────────────────────
const paddle          = document.getElementById("paddle");
const board           = document.getElementById("board");
const bricksContainer = document.getElementById("bricks");
const over            = document.querySelector(".over");
const gameoverOverlay = document.getElementById("gameover-overlay");
const restartBtn      = document.getElementById("restart-btn");
const pauseRestartBtn = document.getElementById("pause-restart-btn");
const againBtn        = document.getElementById("again-btn");
const winOverlay      = document.getElementById("win-overlay");
const pauseBtn        = document.getElementById("pause-btn"); // bouton pause mobile (optionnel)

// ── État global ───────────────────────────────────────────────────────────────
let brickElements = [];
let paddleX       = 200;
let currentLevel  = 0;
let waitingForStart = true;
let paused = false;
let startTime = 0;
let elapsedTime = 0;
let timerRunning = false;
let fpsTimer = 0;
let frameCount = 0;
let lastHitBrick = null;

// Variables pour le lissage du temps (anti-frame-drop)
let lastTimestamp = 0;

// ⏱ Suivi de la durée max des bonus (en millisecondes)
const bonusTimers = {
    slow: { active: false, remaining: 0, duration: 6000 },
    paddle: { active: false, remaining: 0, duration: 7000 }
};

/** Objet partagé mis à jour pour intercepter les lancements de bonus */
const state = { 
    life: 3, 
    score: 0,
    activateSlow: () => déclencherChronoBonus("slow"),
    activatePaddle: () => déclencherChronoBonus("paddle")
};

function déclencherChronoBonus(type) {
    bonusTimers[type].active = true;
    bonusTimers[type].remaining = bonusTimers[type].duration;
    document.getElementById(`timer-${type}`).style.display = "flex";
}

function updateBonusTimers(deltaTimeMs) {
    if (waitingForStart || paused) return;

    for (const key in bonusTimers) {
        const bonus = bonusTimers[key];
        if (bonus.active) {
            bonus.remaining -= deltaTimeMs;

            if (bonus.remaining <= 0) {
                bonus.active = false;
                bonus.remaining = 0;
                document.getElementById(`timer-${key}`).style.display = "none";
            } else {
                const percent = (bonus.remaining / bonus.duration) * 100;
                document.getElementById(`bar-${key}`).style.width = percent + "%";
            }
        }
    }
}

// ── Gestion Échap (clavier) ───────────────────────────────────────────────────
window.addEventListener("keydown", e => {
    if (e.key === "Escape" && !waitingForStart) {
        paused ? resumeGame() : pauseGame();
    }
});

// ── Gestion pause tactile (bouton mobile) ─────────────────────────────────────
if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
        if (waitingForStart) return;
        paused ? resumeGame() : pauseGame();
    });
}

function pauseGame() {
    paused = true;
    timerRunning = false;
    elapsedTime = performance.now() - startTime;
    ambiance.pause(); 
    document.getElementById("pause-overlay").style.display = "flex";
}

function resumeGame() {
    paused = false;
    startTime = performance.now() - elapsedTime;
    timerRunning = true;
    lastTimestamp = performance.now(); // Reset pour éviter le saut temporel post-pause
    try { ambiance.play(); } catch(e) {}
    document.getElementById("pause-overlay").style.display = "none";
    requestAnimationFrame(gameLoop);
}

document.getElementById("resume-btn").addEventListener("click", resumeGame);

// ── Gestion du Timer ─────────────────────────────────────────────────────────────
function updateTimer() {
    if (!timerRunning) return;

    elapsedTime = performance.now() - startTime;

    const seconds = Math.floor(elapsedTime / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    document.getElementById("timer").textContent =
        `⏱ ${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

// ── Gestion Level Up ─────────────────────────────────────────────────────────────
function showLevelUp() {
    document.getElementById("levelup-title").textContent = "NIVEAU " + (currentLevel + 1);
    document.getElementById("levelup-overlay").style.display = "flex";
}

document.getElementById("levelup-btn").addEventListener("click", () => {
    document.getElementById("levelup-overlay").style.display = "none";
    try { ambiance.play(); } catch(e) {}
    initializeGame();
    resetBalls();
    createMainBall(board, paddleX, paddle.clientWidth);
    lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
});

// ── Clavier ───────────────────────────────────────────────────────────────────
const keys = { ArrowLeft: false, ArrowRight: false };
window.addEventListener("keydown", e => { if (e.key in keys) keys[e.key] = true;  });
window.addEventListener("keyup",   e => { if (e.key in keys) keys[e.key] = false; });

// ── Tactile (mobile) ──────────────────────────────────────────────────────────
let touchActive = false;

function getPaddleXFromTouch(touchX) {
    const boardRect = board.getBoundingClientRect();
    const relativeX = touchX - boardRect.left - (paddle.clientWidth / 2);
    return Math.max(0, Math.min(board.clientWidth - paddle.clientWidth, relativeX));
}

board.addEventListener("touchstart", e => {
    touchActive = true;
    if (waitingForStart) startGame();
    paddleX = getPaddleXFromTouch(e.touches[0].clientX);
    paddle.style.transform = `translate(${paddleX}px, 0px)`;
}, { passive: true });

board.addEventListener("touchmove", e => {
    if (!touchActive) return;
    paddleX = getPaddleXFromTouch(e.touches[0].clientX);
    paddle.style.transform = `translate(${paddleX}px, 0px)`;
}, { passive: true });

board.addEventListener("touchend", () => { touchActive = false; }, { passive: true });

// ── Collision générique ───────────────────────────────────────────────────────
function isCollision(a, b) {
    const r1 = a.getBoundingClientRect();
    const r2 = b.getBoundingClientRect();
    return !(r1.right < r2.left || r1.left > r2.right ||
             r1.bottom < r2.top || r1.top > r2.bottom);
}

// ── Initialisation du niveau ──────────────────────────────────────────────────
function initializeGame() {
    brickElements = [];
    bricksContainer.innerHTML = "";

    const level  = LEVELS[currentLevel];
    const brickW = 50;
    const brickH = 25;

    for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
            const cell = level.layout[row][col];
            if (cell === "0") continue;

            const brick = document.createElement("div");
            brick.classList.add("brick");
            brick.style.left = col * brickW + "px";
            brick.style.top  = row * brickH + "px";
            brick.life = parseInt(cell);
            brick.hit = false;

            updateBrickStyle(brick);
            bricksContainer.appendChild(brick);
            brickElements.push(brick);
        }
    }
}

function updateBrickStyle(brick) {
    const colors = { 1: "#2ecc71", 2: "#f1c40f", 3: "#e67e22", 4: "#e74c3c" };
    brick.style.backgroundColor = colors[brick.life] || "#ffffff";
    brick.style.border = "2px solid rgba(255,255,255,0.4)";
    brick.style.boxShadow = `0 0 ${brick.life * 5}px rgba(255,255,255,0.5)`;
}

function updateHUD() {
    document.getElementById("lives").textContent = "❤️ : " + state.life;
    document.getElementById("score").textContent = "⭐ : " + state.score;
    document.getElementById("level").textContent = "LEVEL : " + (currentLevel + 1);
    updateTimer();
}

// ── Gestion collision brique ──────────────────────────────────────────────────
function handleBrickCollision(b) {
    const boardRect  = board.getBoundingClientRect();
    const bricksRect = bricksContainer.getBoundingClientRect();
    const offsetX    = bricksRect.left - boardRect.left;
    const offsetY    = bricksRect.top  - boardRect.top;
    const brickW     = 50;
    const brickH     = 25;

    // Cherche la brique avec le plus petit overlap (la plus "proche" de la balle)
    let bestBrick    = null;
    let bestOverlap  = Infinity;
    let bestAxis     = null;
    let bestCorrectX = b.x;
    let bestCorrectY = b.y;
    let bestSpeedX   = b.speedX;
    let bestSpeedY   = b.speedY;

    for (const brick of brickElements) {
        if (brick.hit || brick === lastHitBrick) continue;

        const brickX = parseFloat(brick.style.left) + offsetX;
        const brickY = parseFloat(brick.style.top)  + offsetY;

        if (b.x + BALL_SIZE <= brickX || b.x >= brickX + brickW ||
            b.y + BALL_SIZE <= brickY || b.y >= brickY + brickH) continue;

        const overlapLeft   = (b.x + BALL_SIZE) - brickX;
        const overlapRight  = (brickX + brickW) - b.x;
        const overlapTop    = (b.y + BALL_SIZE) - brickY;
        const overlapBottom = (brickY + brickH) - b.y;

        const tolerance     = 1.5;
        const horizontalMin = Math.min(overlapLeft, overlapRight);
        const verticalMin   = Math.min(overlapTop, overlapBottom);
        const isCorner      = Math.abs(horizontalMin - verticalMin) < tolerance;

        let axis;
        if (isCorner) {
            axis = Math.abs(b.speedX) > Math.abs(b.speedY) ? "horizontal" : "vertical";
        } else {
            axis = horizontalMin < verticalMin ? "horizontal" : "vertical";
        }

        const overlap = Math.min(horizontalMin, verticalMin);
        if (overlap >= bestOverlap) continue;

        bestOverlap = overlap;
        bestBrick   = brick;
        bestAxis    = axis;

        if (axis === "horizontal") {
            if (overlapLeft < overlapRight) { bestCorrectX = b.x - overlapLeft;  bestSpeedX = -Math.abs(b.speedX); bestSpeedY = b.speedY; }
            else                            { bestCorrectX = b.x + overlapRight; bestSpeedX =  Math.abs(b.speedX); bestSpeedY = b.speedY; }
            bestCorrectY = b.y;
        } else {
            if (overlapTop < overlapBottom) { bestCorrectY = b.y - overlapTop;    bestSpeedY = -Math.abs(b.speedY); bestSpeedX = b.speedX; }
            else                            { bestCorrectY = b.y + overlapBottom; bestSpeedY =  Math.abs(b.speedY); bestSpeedX = b.speedX; }
            bestCorrectX = b.x;
        }
    }

    if (!bestBrick) return false;

    // Applique la correction
    b.x = bestCorrectX;
    b.y = bestCorrectY;
    b.speedX = bestSpeedX;
    b.speedY = bestSpeedY;
    b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;

    bestBrick.hit = true;
    lastHitBrick  = bestBrick;
    setTimeout(() => { lastHitBrick = null; }, 100);

    playSound("brick");
    bestBrick.life--;

    if (bestBrick.life <= 0) {
        const brickRect = bestBrick.getBoundingClientRect();
        if (Math.random() < BONUS_CHANCE) {
            createBonus(board, brickRect.left - boardRect.left, brickRect.top - boardRect.top);
        }
        bestBrick.remove();
        brickElements.splice(brickElements.indexOf(bestBrick), 1);
        state.score += 100;
    } else {
        updateBrickStyle(bestBrick);
        bestBrick.animate([{ transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 80 });
        setTimeout(() => { if (bestBrick.isConnected) bestBrick.hit = false; }, 60);
    }

    return true;
}

// ── Boucle principale ─────────────────────────────────────────────────────────
function gameLoop(timestamp) {
    
    if (waitingForStart || paused) return;

    if (!lastTimestamp) lastTimestamp = timestamp;
    let deltaTime = (timestamp - lastTimestamp) / 16.666; // Normalisé autour de 60 FPS (16.66ms = 1)
    lastTimestamp = timestamp;

    // Sécurité anti-ram : si l'onglet perd le focus, on bride le deltaTime pour éviter des téléportations
    if (deltaTime > 4) deltaTime = 4; 

    // ── CALCUL DES FPS ──
    frameCount++;
    fpsTimer += (deltaTime * 16.666);
    if (fpsTimer >= 500) {
        const fps = Math.round((frameCount * 1000) / fpsTimer);
        document.getElementById("fps-counter").textContent = `FPS: ${fps}`;
        fpsTimer = 0;
        frameCount = 0;
    }
    
    updateBonusTimers(deltaTime * 16.666);
    updateHUD();

    // Déplacement raquette fluide au clavier (indexé sur deltaTime)
    // Le tactile écrase directement paddleX via les listeners touchstart/touchmove
    if (keys.ArrowLeft)  paddleX -= PADDLE_SPEED * deltaTime;
    if (keys.ArrowRight) paddleX += PADDLE_SPEED * deltaTime;
    paddleX = Math.max(0, Math.min(board.clientWidth - paddle.clientWidth, paddleX));
    paddle.style.transform = `translate(${paddleX}px, 0px)`;

    // ── Balles ────────────────────────────────────────────────────────────────
    for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        
        // Calcul des pas basé sur la vitesse modifiée par le deltaTime
        const moveX = b.speedX * deltaTime;
        const moveY = b.speedY * deltaTime;
        const steps = Math.ceil(Math.max(Math.abs(moveX), Math.abs(moveY)) / 6);
        const dx = moveX / steps; 
        const dy = moveY / steps;
        let lostBall = false;

        for (let s = 0; s < steps; s++) {
            b.x += dx; 
            b.y += dy;
            b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;

            if (b.x <= 0) { b.x = 0; b.speedX = Math.abs(b.speedX); }
            if (b.x >= board.clientWidth - BALL_SIZE) { b.x = board.clientWidth - BALL_SIZE; b.speedX = -Math.abs(b.speedX); }
            if (b.y <= 0) { b.y = 0; b.speedY = Math.abs(b.speedY); }

            if (isCollision(b.el, paddle)) {
                playSound("paddle");
                const currentSpeed = Math.hypot(b.speedX, b.speedY);
                const hit   = (b.x + BALL_SIZE / 2) - (paddleX + paddle.clientWidth / 2);
                const ratio = hit / (paddle.clientWidth / 2);
                const angle = ratio * (Math.PI / 2.5);
                b.speedX = Math.sin(angle) * currentSpeed;
                b.speedY = -Math.cos(angle) * currentSpeed;
                b.y = board.clientHeight - 40;
                break;
            }

            if (handleBrickCollision(b)) break; 
            if (isCollision(b.el, over) || b.y > board.clientHeight) { lostBall = true; break; }
        }

        if (lostBall) {
            playSound("ball"); b.speedX = 0; b.speedY = 0; b.el.style.backgroundColor = "red";
            balls.splice(i, 1); i--;

            if (balls.length === 0) {
                state.life--;
                if (state.life <= 0) {
                    ambiance.pause(); ambiance.currentTime = 0; playSound("lose");
                    setTimeout(() => {
                        b.el.remove(); gameoverOverlay.style.display = "flex";
                        document.getElementById("final-score").textContent = "⭐ : " + state.score;
                    }, 1000);
                    return;
                } else {
                    setTimeout(() => {
                        b.el.remove(); resetBalls();
                        createMainBall(board, paddleX, paddle.clientWidth);
                        lastTimestamp = performance.now();
                        requestAnimationFrame(gameLoop);
                    }, 1500);
                    return;
                }
            } else { setTimeout(() => b.el.remove(), 1000); }
        }
    }

    // Bonus tombants
    updateBonuses(paddle, board, state);

    // Niveau terminé
    if (brickElements.length === 0) {
        ambiance.pause(); 
        ambiance.currentTime = 0; 
        currentLevel++;
        resetBonuses(); 
        bonusTimers.slow.active = false;
        bonusTimers.paddle.active = false;
        if (currentLevel >= LEVELS.length) {
            playSound("win"); lancerConfettisFeuDartifice();
            document.getElementById("win-overlay").style.display = "flex";
            return;
        }
        document.getElementById("timer-slow").style.display = "none";
        document.getElementById("timer-paddle").style.display = "none";
        playSound("level"); showLevelUp(); return;
    }

    requestAnimationFrame(gameLoop);
}

// ── Démarrage de partie (clavier Espace + tactile) ────────────────────────────
function startGame() {
    if (!waitingForStart) return;
    waitingForStart = false;
    try { ambiance.play(); } catch (error) {}
    startTime = performance.now();
    elapsedTime = 0;
    timerRunning = true;
    lastTimestamp = performance.now();
    document.getElementById("timer").textContent = "⏱ 00:00";
    const msg = document.getElementById("start-msg");
    if (msg) msg.style.display = "none";
    requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", e => {
    if (e.key === " " && waitingForStart) startGame();
});

// ── Restarts ───────────────────────────────────────────────────────────────────
const resetAllGameStates = () => {
    state.life  = 3; state.score = 0; currentLevel = 0;
    waitingForStart = true;
    bonusTimers.slow.active = false; bonusTimers.paddle.active = false;
    document.getElementById("timer-slow").style.display = "none";
    document.getElementById("timer-paddle").style.display = "none";
    const msg = document.getElementById("start-msg");
    if (msg) msg.style.display = "flex";
    resetBonuses();
    initializeGame();
    resetBalls();
    createMainBall(board, paddleX, paddle.clientWidth);
};

restartBtn.addEventListener("click", () => {
    gameoverOverlay.style.display = "none";
    resetAllGameStates();
});

pauseRestartBtn.addEventListener("click", () => {
    document.getElementById("pause-overlay").style.display = "none";
    resetAllGameStates();
    resumeGame();
});

againBtn.addEventListener("click", () => {
    winOverlay.style.display = "none";
    resetAllGameStates();
});

// ── Démarrage initial strict ──────────────────────────────────────────────────
initializeGame();
resetBalls();
createMainBall(board, paddleX, paddle.clientWidth);

// On attend l'interaction espace/tactile pour lancer la boucle au lieu de la lancer à vide
// Cela évite que le premier calcul de delta soit biaisé pendant le chargement de la page.


function lancerConfettisFeuDartifice() {
    const duration = 1000;
    const animationEnd = performance.now() + duration;
    const couleurs = ['#ff0a43', '#ffdd1b', '#00fff5', '#00ff41', '#ff00ff', '#22ffb0'];

    if (!document.getElementById('styles-confettis')) {
        const style = document.createElement('style');
        style.id = 'styles-confettis';
        style.innerHTML = `
            .confetti-dom {
                position: fixed;
                z-index: 2000;
                pointer-events: none;
                will-change: transform, opacity;
                animation: tomber 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
            }
            @keyframes tomber {
                0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
                100% { transform: translate3d(var(--x), var(--y), 0) rotate(var(--r)) scale(0.3); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    function randomInRange(min, max) { return Math.random() * (max - min) + min; }

    function creerParticule(originX) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti-dom');
        const size = randomInRange(8, 14);
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0%';
        confetti.style.backgroundColor = couleurs[Math.floor(Math.random() * couleurs.length)];
        confetti.style.left = `${originX * 100}vw`;
        confetti.style.top = `${randomInRange(70, 90)}vh`;
        const direction = originX < 0.5 ? 1 : -1;
        const angleX = randomInRange(100, 400) * direction;
        const angleY = randomInRange(-600, -200);
        const rotation = randomInRange(360, 720);
        confetti.style.setProperty('--x', `${angleX}px`);
        confetti.style.setProperty('--y', `${angleY}px`);
        confetti.style.setProperty('--r', `${rotation}deg`);
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 1200);
    }

    const interval = setInterval(function() {
        const timeLeft = animationEnd - performance.now();
        if (timeLeft <= 0) return clearInterval(interval);
        for (let i = 0; i < 30; i++) {
            creerParticule(randomInRange(0.1, 0.3));
            creerParticule(randomInRange(0.7, 0.9));
        }
    }, 250);
}