import { BALL_SIZE, BALL_SPEED } from "./constants.js";

/** @type {Array<{el: HTMLElement, x: number, y: number, speedX: number, speedY: number}>} */
export let balls = [];

/**
 * Crée la balle principale au-dessus de la raquette.
 * @param {HTMLElement} board
 * @param {number} paddleX
 * @param {number} paddleWidth
 */

const angle = (Math.random() * 60 + 30) * (Math.PI / 180);

export function createMainBall(board, paddleX, paddleWidth) {
    balls = [];

    const el = document.createElement("div");
    el.classList.add("ball");
    el.style.backgroundColor = "white";
    board.appendChild(el);

    balls.push({
        el,
        x: paddleX + paddleWidth / 2 - BALL_SIZE / 2,
        y: board.clientHeight - 40,
        // Angle garanti entre 30° et 60°
        speedX: BALL_SPEED * Math.cos(angle) * (Math.random() < 0.5 ? 1 : -1),
        speedY: -BALL_SPEED * Math.sin(angle),
    });
}

/**
 * Supprime toutes les balles du DOM et vide le tableau.
 */
export function resetBalls() {
    for (const b of balls) b.el?.remove();
    balls = [];
}

/**
 * Duplique la première balle en inversant son speedX (bonus multi).
 * @param {HTMLElement} board
 */
export function spawnExtraBall(board) {
    if (balls.length === 0) return;

    const el = document.createElement("div");
    el.classList.add("ball");
    el.style.backgroundColor = "white";
    board.appendChild(el);

    const base = balls[0];
    balls.push({
        el,
        x: base.x,
        y: base.y,
        speedX: -base.speedX,
        speedY: base.speedY,
    });
}
