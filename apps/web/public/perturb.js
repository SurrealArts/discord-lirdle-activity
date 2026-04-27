/**
 * Suggest a hint by perturbing one position's score. Picks a random
 * starting position and direction (increase or decrease), then falls
 * back to a weighted random selection across all 10 possible moves
 * if the initial pick would create a contradiction. Weights favor
 * moves with lower contradiction scores to avoid giving away the answer.
 * @param {string} guessWord - The current guessed word
 * @param {number[]} scores - Current perceived scores (0/1/2 per position)
 * @param {{ green?: Object.<string, string[]>, assignments?: Object.<string, [number, number][]>, black?: Object.<string, number>, yellow?: Object.<string, number> }} lettersByPosition - Letter position tracking
 * @returns {[number, number]} [position, direction] where direction is -1 (decrease) or +1 (increase)
 */
export function perturb(guessWord, scores, lettersByPosition) {
    const i = Math.floor(Math.random() * scores.length);
    const direction = Math.random() < 0.5 ? -1 : +1;
    if (scoreContradiction(guessWord, scores, lettersByPosition, [i, direction]) === 0) {
        return [i, direction];
    }
    // We picked a contraction. Favor the others, but now we need to evaluate all possible 10 moves
    let indices = [];
    const directives = [];
    for (let i = 0; i < 5; i++) {
        directives.push([i, -1]);
        directives.push([i, +1]);
    }
    for (let i = 0; i < directives.length; i++) {
        let score = scoreContradiction(guessWord, scores, lettersByPosition, directives[i]);
        if (score < 0) {
            score = 0;
        }
        const numIters = 10 - score;
        for (let j = 0; j < numIters; j++) {
            indices.push(i);
        }
    }
    if (indices.length === 0) {
        indices = [];
        for (let i = 0; i < 10; i++) {
            indices.push(i);
        }
    }
    const index = indices[Math.floor(Math.random() * indices.length)];
    return directives[index];
}
/**
 * Score how contradictory a proposed hint directive would be.
 * Checks against existing green/yellow/black position data and
 * previously assigned directives for the same word. Returns a
 * higher score for moves that conflict with known information.
 * @param {string} guessWord - The current guessed word
 * @param {number[]} scores - Current perceived scores
 * @param {Object} lettersByPosition - Position tracking data
 * @param {[number, number]} directive - [position, direction] to check
 * @returns {number} Contradiction score (0 = safe, 9 = maximum contradiction)
 */
export function scoreContradiction(guessWord, scores, lettersByPosition, directive) {
    const greenLettersByPosition = lettersByPosition.green; // array of strings
    const directivesByWord = lettersByPosition.assignments; // hash of string => array of directives
    const blackPositions = lettersByPosition.black || {};
    const yellowPositions = lettersByPosition.yellow || {};
    if (!greenLettersByPosition && !directivesByWord && !blackPositions && !yellowPositions) {
        return 0;
    }
    const directives = directivesByWord && directivesByWord[guessWord];
    if (directives && directives.find((dir) => dir[0] === directive[0] && dir[1] === directive[1])) {
        return 9;
    }
    const [posn, direction] = directive;
    const oldVal = scores[posn] + 3;
    const newVal = (oldVal + direction) % 3;
    const c = guessWord[posn];
    if (newVal !== 2) {
        const [otherPositions, samePositions] = newVal === 0 ? [yellowPositions, blackPositions] : [blackPositions, yellowPositions];
        const delta = (otherPositions[c] || 0) - (samePositions[c] || 0);
        if (delta > 0) {
            return delta >= 9 ? 9 : delta;
        }
        return 0;
    }
    if (!greenLettersByPosition) {
        return 0;
    }
    const currentGreensAtPosn = lettersByPosition.green[posn];
    if (!currentGreensAtPosn || currentGreensAtPosn.includes(c)) {
        return 0;
    }
    switch (currentGreensAtPosn.length) {
        case 1:
            // Weight this too high and it makes it likelier the second green is truthful
            return 3;
        case 2:
            return 7;
        default:
            return 9;
    }
}
