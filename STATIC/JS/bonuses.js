import { BONUS_TYPES, BALL_SPEED } from "./constants.js";
import { spawnExtraBall } from "./balls.js";
import { balls } from "./balls.js";
import { playSound } from "./sounds.js";

/** @type {HTMLElement[]} */
export let bonuses = [];

export function createBonus(board, x, y) {
    const el = document.createElement("div");
    el.classList.add("bonus");
    el.dataset.type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
    el.style.left = x + "px";
    el.style.top  = y + "px";
    board.appendChild(el);
    bonuses.push(el);
}

let slowTimeoutId = null;
let paddleTimeoutId = null;

export function applyBonus(type, paddle, state, board) {
    if (type === "paddle") {
        if (paddleTimeoutId) clearTimeout(paddleTimeoutId);
        
        // Signale à main.js de lancer la barre de progression
        if (state.activatePaddle) state.activatePaddle();

        paddle.style.width = "150px";
        paddleTimeoutId = setTimeout(() => {
            paddle.style.width = "100px";
            paddleTimeoutId = null;
        }, 7000);
    }

    if (type === "slow") {
        if (slowTimeoutId) {
            clearTimeout(slowTimeoutId);
        } else {
            balls.forEach(b => {
                b.speedX *= 0.6;
                b.speedY *= 0.6;
            });
        }

        // Signale à main.js de lancer la barre de progression
        if (state.activateSlow) state.activateSlow();

        slowTimeoutId = setTimeout(() => {
            balls.forEach(b => {
                const currentSpeed = Math.hypot(b.speedX, b.speedY);
                if (currentSpeed > 0) {
                    b.speedX = (b.speedX / currentSpeed) * BALL_SPEED;
                    b.speedY = (b.speedY / currentSpeed) * BALL_SPEED;
                }
            });
            slowTimeoutId = null;
        }, 6000);
    }

    if (type === "multi") {
        spawnExtraBall(board);
        if (slowTimeoutId && balls.length > 1) {
            const baseBall = balls[0];
            const newBall = balls[balls.length - 1];
            const angle = Math.atan2(newBall.speedY, newBall.speedX);
            const slowSpeed = Math.hypot(baseBall.speedX, baseBall.speedY);
            newBall.speedX = Math.cos(angle) * slowSpeed;
            newBall.speedY = Math.sin(angle) * slowSpeed;
        }
    }

    if (type === "life" && state.life < 3) {
        state.life++;
    }
}

export function updateBonuses(paddle, board, state) {
    for (let i = 0; i < bonuses.length; i++) {
        const bonus = bonuses[i];
        bonus.style.top = bonus.offsetTop + 3 + "px";

        if (isCollision(bonus, paddle)) {
            playSound("bonus");
            applyBonus(bonus.dataset.type, paddle, state, board);
            bonus.remove();
            bonuses.splice(i, 1);
            state.score += 25
            i--;
        } else if (bonus.offsetTop > board.clientHeight) {
            bonus.remove();
            bonuses.splice(i, 1);
            i--;
        }
    }
}

export function resetBonuses() {
    bonuses.forEach(b => b.remove());
    bonuses.length = 0;
}

function isCollision(a, b) {
    const r1 = a.getBoundingClientRect();
    const r2 = b.getBoundingClientRect();
    return !(r1.right < r2.left || r1.left > r2.right ||
             r1.bottom < r2.top || r1.top > r2.bottom);
}