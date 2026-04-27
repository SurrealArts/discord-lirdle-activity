import { WORDS } from './words.js';
/**
 * Create initial solver state with the full word list as possible words.
 * @returns {{ level: number, possibleWords: string[], remainingWords: string[][], possibleWordCounts: number[] }}
 */
export function getSolverData() {
    return {
        level: 0,
        possibleWords: WORDS,
        remainingWords: [],
        possibleWordCounts: [],
    };
}
/**
 * Update the solver after each guess by filtering possible words.
 * Iterates through unprocessed guesses and narrows the possible word
 * list to words that could produce the observed scores.
 * @param {string[]} guesses - Array of guessed words
 * @param {number[][]} scores - Array of score arrays per guess
 * @param {{ level: number, possibleWords: string[], remainingWords: string[][], possibleWordCounts: number[] }} solver - Solver state to mutate
 * @param {boolean} [finished=false] - If true, ignore the last guess
 */
export function updateSolver(guesses, scores, solver, finished = false) {
    const lim = guesses.length - (finished ? 2 : 1);
    while (solver.level <= lim) {
        const possibleWords = evalPossibleWords(guesses[solver.level], scores[solver.level], solver.possibleWords);
        if (possibleWords.length === 0) {
            throw new Error("Can't happen - no words match this line");
        }
        solver.possibleWords = possibleWords;
        solver.possibleWordCounts[solver.level] = possibleWords.length;
        solver.remainingWords[solver.level] = possibleWords;
        solver.level += 1;
    }
}
/**
 * Filter a word list to only words that make sense given a guess and its scores.
 * Removes the guessed word itself from the result set.
 * @param {string} guess - The guessed word
 * @param {number[]} scores - The scores for this guess (0/1/2 per position)
 * @param {string[]} currentWordList - Current possible word list
 * @returns {string[]} Filtered possible words
 */
export function evalPossibleWords(guess, scores, currentWordList) {
    const possibleWords = {};
    const lim = currentWordList.length;
    if (lim === 1 && currentWordList[0] === guess) {
        // This is needed when restarting so it doesn't reject 2-2-2-2-2 on the final word
        return [guess];
    }
    for (let i = 0; i < lim; i++) {
        const candidateWord = currentWordList[i];
        if (scoreMakesSense(guess, candidateWord, scores)) {
            possibleWords[candidateWord] = true;
        }
    }
    // The miner bug -- if we're looking for possible words, make sure we drop the current one.
    delete possibleWords[guess];
    return Object.keys(possibleWords);
}
/**
 * Compute the true score of a guess against the target word.
 * Returns an array of scores: 0 (letter absent), 1 (wrong position), 2 (correct position).
 * First pass marks exact matches, second pass marks misplaced letters.
 * @param {string} targetWord - The target word
 * @param {string} guess - The guessed word
 * @returns {number[]} Array of 5 scores (0, 1, or 2)
 */
export function evaluateGuess(targetWord, guess) {
    const target = Array.from(targetWord);
    const myGuess = Array.from(guess);
    const scores = [0, 0, 0, 0, 0];
    // Issue #19: find the perfect hits first!
    for (let i = 0; i < 5; i++) {
        if (myGuess[i] === target[i]) {
            scores[i] = 2;
            myGuess[i] = target[i] = '#';
        }
    }
    for (let i = 0; i < 5; i++) {
        if (myGuess[i] === '#') {
            continue;
        }
        const letterPosition = target.indexOf(myGuess[i]);
        if (letterPosition !== -1) {
            scores[i] = 1;
            target[letterPosition] = '#';
        }
    }
    return scores;
}
/**
 * Check whether a candidate word could produce the observed scores
 * when evaluated against the given guess. Used to narrow down the
 * set of possible words after each guess.
 * @param {string} guess - The guessed word
 * @param {string} candidateWord - A candidate word to test
 * @param {number[]} scores - The observed scores
 * @returns {boolean} True if the candidate is compatible with the scores
 */
export function scoreMakesSense(guess, candidateWord, scores) {
    const thisScores = evaluateGuess(candidateWord, guess);
    if (thisScores.length !== scores.length) {
        throw new Error(`Doesn't make sense: expected ${scores.length} scores, got ${thisScores.length}`);
    }
    return (thisScores.filter((elt, i) => {
        return elt !== scores[i];
    }).length === 1);
}
