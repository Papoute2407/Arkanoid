export const sounds = {
    paddle: new Audio("../STATIC/sound/bounce.mp3"),
    brick:  new Audio("../STATIC/sound/brick.mp3"),
    bonus:  new Audio("../STATIC/sound/bonus.mp3"),
    wall:   new Audio("../STATIC/sound/wall.mp3"),
    lose:   new Audio("../STATIC/sound/loose.mp3"),
    ball:   new Audio("../STATIC/sound/ball.mp3"),
    win:   new Audio("../STATIC/sound/win.mp3"),
    level:   new Audio("../STATIC/sound/level.mp3"),
};

export const ambiance = new Audio("../STATIC/sound/ambiance.mp3")

ambiance.loop = true
ambiance.volume = 0.3

/**
 * Joue un son en le remettant au début.
 * @param {keyof typeof sounds} name
 */
export function playSound(name) {
    const originalSound = sounds[name];
    if (!originalSound) return;

    // On clone le nœud audio existant
    const clonedSound = originalSound.cloneNode(true);

    // On joue le clone. JavaScript le détruira automatiquement une fois fini.
    clonedSound.play().catch(err => {
        console.log("Lecture du bruitage bloquée :", err);
    });
}