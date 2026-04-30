// Copyright (C) 2023 Bovination Productions, MIT License

import { devMode, getDateNumber, getYesterdaysWord } from './numbers.js';

/**
 * @constructor
 * View layer for the Lirdle game board. Manages all DOM interactions:
 * rendering the letter grid, on-screen keyboard coloring, win/deception
 * displays, hints panel, and stats overlays.
 */
export default function View() {
  this.board = document.getElementById('game-board');
  this.dupWord = document.getElementById('dupWord');
  this.secondaryWordWarning = document.getElementById('secondaryWordWarning');
  this.model = null;
  this.wordIsInvalid = false;
  this.wordIsNonTarget = false;
  this.gameFinished = false;
}

/**
 * Left-pad a value to a minimum string length.
 * @param {string|number} val - Value to pad
 * @param {number} minSize - Minimum output length
 * @param {string} padChar - Character to pad with
 * @returns {string} Padded string
 */
function pad(val, minSize, padChar) {
  let s = val.toString();
  while (s.length < minSize) {
    s = padChar + s;
  }
  return s;
}

const COLORS = ['grey', 'yellow', 'green'];

View.prototype = {
  /** @param {Object} model - Model instance */
  setModel(model) {
    this.model = model;
  },
  /** Post-initialization setup: show yesterday's word stats. */
  setModelContinue() {
    this.showYesterdaysWord();
    // this.initializeTheme(this.model.prefs.theme);
  },
  /**
   * Restore the board to a previously saved state, including guess words,
   * scores, and truth/lie marker classes on each letter box.
   * @param {number} numNeededRows - Number of board rows to initialize
   * @param {string[]} guessWords - Array of guessed words
   * @param {number[][]} scores - Array of score arrays per guess
   * @param {string[][]} markers - Array of marker strings per box
   */
  populateBoardFromSaveableState(numNeededRows, guessWords, scores, markers) {
    this.initBoard(numNeededRows);
    const rows = this.board.querySelectorAll('div.letter-row');
    for (let i = 0; i < guessWords.length; i++) {
      for (let j = 0; j < guessWords[i].length; j++) {
        this.model.addColorHit(guessWords[i][j], scores[i][j]);
        this.model.addLetterPosition(j, guessWords[i][j], scores[i][j]);
        this.insertLetter(guessWords[i][j], i, j);
      }
      this.enterScoredGuess(guessWords[i], scores[i], i, false, true);
      try {
        if (markers && markers[i] && markers[i].some((x) => x !== '')) {
          const row = rows[i];
          const boxes = Array.from(row.querySelectorAll('div.letter-box'));
          for (let j = 0; j < boxes.length; j++) {
            if (markers[i][j]) {
              boxes[j].classList.add(markers[i][j]);
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (
      this.board.querySelector('div.letter-row div.letter-box.show-lie') ||
      this.board.querySelector('div.letter-row div.letter-box.show-perceived-truth')
    ) {
      setTimeout(() => {
        document.getElementById('clear-markers').disabled = false;
      }, 0);
    }
  },

  /**
   * Cycle truth/lie markers on a filled letter box: none → lie → perceived truth.
   * @param {MouseEvent} e - Click event on a letter box
   */
  handleLetterBoxClick(e) {
    if (this.gameFinished) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    const target = e.target;
    if (!target.classList.contains('filled-box')) {
      return;
    }
    if (target.classList.contains('show-lie')) {
      target.classList.remove('show-lie');
      target.classList.add('show-perceived-truth');
    } else if (target.classList.contains('show-perceived-truth')) {
      target.classList.remove('show-perceived-truth');
    } else {
      // We avoid constraints on number of marked letters
      // due to complexity and individual preferences
      target.classList.add('show-lie');
    }
    e.preventDefault();
    this.model.updateSaveableState();
  },

  /** Add a new empty row to the board grid, with letter boxes and num-left container. */
  appendBoardRow() {
    const letterRowContainer = document.createElement('div');
    letterRowContainer.className = 'letter-row-container';

    const balancingLeftSideNumLeftHeading = document.createElement('div');
    balancingLeftSideNumLeftHeading.classList.add('balancingLeftSideNumLeftHeading', 'hidden');
    letterRowContainer.appendChild(balancingLeftSideNumLeftHeading);

    const letterRow = document.createElement('div');
    letterRow.className = 'letter-row';
    for (let j = 0; j < 5; j++) {
      let box = document.createElement('div');
      box.className = 'letter-box';
      box.addEventListener('click', this.handleLetterBoxClick.bind(this));
      letterRow.appendChild(box);
    }
    letterRowContainer.appendChild(letterRow);

    const numWordsLeft = document.createElement('div');
    numWordsLeft.classList.add('numWordsLeftContainer', 'hidden');
    const numLeftHeading = document.createElement('span');
    numLeftHeading.classList.add('numLeftHeading', 'hidden');
    numLeftHeading.textContent = ' (';
    const numLeftAmount = document.createElement('span');
    numLeftAmount.className = 'numLeftAmount';
    numLeftAmount.textContent = '';
    const numRightHeading = document.createElement('span');
    numRightHeading.classList.add('numLeftHeading', 'hidden');
    numRightHeading.textContent = ')   ';
    numWordsLeft.appendChild(numLeftHeading);
    numWordsLeft.appendChild(numLeftAmount);
    numWordsLeft.appendChild(numRightHeading);
    letterRowContainer.appendChild(numWordsLeft);

    this.board.appendChild(letterRowContainer);
    const classNames = ['small1', 'small2', 'small3', 'small4'];
    const classList = this.board.classList;
    const eltCount = this.board.childElementCount;
    classList.remove(...classNames);
    if (eltCount > 24) {
      classList.add('small4');
    } else if (eltCount > 18) {
      classList.add('small3');
    } else if (eltCount > 12) {
      classList.add('small2');
    } else if (eltCount > 6) {
      classList.add('small1');
    }
  },

  /**
   * Display the win UI: result message, deceptive squares, stats,
   * disable keyboard, start countdown timer.
   * @param {number} guessCount - How many guesses the player took
   * @param {Array} changes - Array of deceptive score changes
   */
  showTheWin(guessCount, changes) {
    this.showWinningInfo(guessCount);
    this.showDeceptiveSquares(changes, guessCount);
    this.activateWordsLeftLink();
    this.showAllDone();
    this.showTodaysStats();
    this.gameFinished = true;
    Array.from(document.querySelectorAll('#keyboard-cont button.keyboard-button')).forEach(
      (elt) => {
        elt.setAttribute('disabled', true);
      },
    );
  },

  /**
   * Show "You got it in N guesses!" message above the board.
   * @param {number} guessCount - Number of guesses taken
   */
  showWinningInfo(guessCount) {
    const msg = `You got it in ${guessCount} guess${guessCount > 1 ? 'es' : ''}!`;
    const result = document.getElementById('result');
    if (!result) {
      console.log(`Can't find result div`);
      setTimeout(() => {
        alert(msg);
      }, 1000);
      return;
    }
    result.children[0].textContent = msg;
    result.classList.remove('hidden');
    result.classList.add('show');
  },

  /** Show the countdown timer until the next puzzle is available. */
  showAllDone() {
    const msg = `until next game`;
    const allDone = document.getElementById('alldone');
    if (!allDone) {
      console.log(`Can't find div alldone`);
      setTimeout(() => {
        alert(msg);
      }, 1000);
      return;
    }
    allDone.children[0].textContent = msg;
    allDone.classList.remove('hidden');
    allDone.classList.add('show');
    const allDoneSpan = allDone.children[0];
    const startDate = getDateNumber();
    const setTimeLeft = () => {
      const thisDate = getDateNumber();
      if (thisDate > startDate) {
        allDoneSpan.textContent = 'You can refresh to get a new puzzle';
        return;
      }
      const t1 = new Date();
      const times = [
        23 - t1.getUTCHours(),
        pad(59 - t1.getUTCMinutes(), 2, '0'),
        pad(59 - t1.getUTCSeconds(), 2, '0'),
      ];
      allDoneSpan.textContent = `Next puzzle in ${times.join(':')} (UTC)`;
      setTimeout(setTimeLeft, 1 * 1000);
    };
    setTimeout(setTimeLeft, 0);
    this.showStats();
  },
  /**
   * changes: array of [index, actualResult, displayedResult]
   * @param changes
   */
  /**
   * Highlight squares where the score was deceptive by adding
   * color classes (actualGreen, actualYellow, actualGrey).
   * @param {Array} changes - Array of [position, trueScore, displayedScore], sparse array indexed by row
   * @param {number} guessCount - Number of guesses made (rows to check)
   */
  showDeceptiveSquares(changes, guessCount) {
    for (let i = 0; i < guessCount; i++) {
      const rowContainer = this.board.children.item(i);
      if (!rowContainer) {
        console.log(`showDeceptiveSquares: No rowContainer at entry ${i}`);
        break;
      }
      const change = changes[i];
      if (!change) continue;
      const rowLetters = rowContainer.querySelector('.letter-row');
      const box = rowLetters.children[change[0]];
      const actualColor = COLORS[change[1]];
      box.classList.add(`actual${actualColor}`);
    }
  },

  /** Convert num-left amounts into clickable buttons that show the list of remaining words. */
  activateWordsLeftLink() {
    const numLeftContainers = this.board.querySelectorAll(
      '.letter-row-container .numWordsLeftContainer',
    );
    for (let i = 0; i < numLeftContainers.length; i++) {
      const container = numLeftContainers.item(i);
      const numLeftAmountSpan = container.querySelector('span.numLeftAmount');
      if (!numLeftAmountSpan) continue;
      const numLeftAmount = parseInt(numLeftAmountSpan.textContent, 10);
      if (isNaN(numLeftAmount) || numLeftAmount <= 1) {
        break;
      } else if (numLeftAmount > 20) {
        continue;
      }
      const firstPart = container.querySelector('span.numLeftHeading');
      const numLeftButton = document.createElement('button');
      numLeftButton.textContent = numLeftAmountSpan.textContent;
      numLeftButton.addEventListener('click', (event) => {
        this.showMatchedWords(event, i, numLeftAmount);
      });
      numLeftAmountSpan.remove();
      if (firstPart) {
        firstPart.insertAdjacentElement('afterend', numLeftButton);
      }
    }
  },

  /**
   * Display a modal panel listing all words that could still be the
   * answer for a given row. Filters out the target word from the list.
   * @param {MouseEvent} event - Click event from the num-left button
   * @param {number} i - Row index
   */
  showMatchedWords(event, i) {
    const solverData = this.model.solverData;
    if (i >= solverData.remainingWords.length) {
      console.log(`Error: can't find row ${i} out of ${solverData.remainingWords.length}`);
      return;
    }
    const targetWord = this.model.targetString;
    const remainingWords = solverData.remainingWords[i].filter((x) => x !== targetWord);
    remainingWords.sort();

    const matchingWordsPanel = document.getElementById('matchingWords');
    if (!matchingWordsPanel) {
      console.log('Failed to get the matchingWords panel');
      alert(`Remaining words:\n\n${remainingWords.join(' ')}`);
      return;
    }
    const wordList = matchingWordsPanel.querySelector('#matchingWordsList');
    if (!wordList) {
      console.log('Got the matchingWords panel but not the wordList');
      alert(`Remaining words:\n\n${remainingWords.join(' ')}`);
      return;
    }
    const closeMatchingWordsButton = matchingWordsPanel.querySelector('#closeMatchingWords');
    if (!closeMatchingWordsButton) {
      console.log('Got the matchingWords panel and the wordList but not the panel');
      alert(`Remaining words:\n\n${remainingWords.join(' ')}`);
      return;
    }
    wordList.value = remainingWords.join('\n');
    const closeFunc = () => {
      matchingWordsPanel.classList.add('hidden');
      matchingWordsPanel.classList.remove('show');
    };
    closeMatchingWordsButton.addEventListener('click', () => {
      closeFunc();
    });
    matchingWordsPanel.addEventListener(
      'keyup',
      (e) => {
        if (e.key === 'Escape' || (e.ctrlKey && e.key === 'W')) {
          closeFunc();
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
    matchingWordsPanel.classList.remove('hidden');
    matchingWordsPanel.classList.add('show');
  },

  /** Show the statistics overlay if there are enough games played (more than 2). */
  showStats() {
    const stats = this.model.stats;
    if (stats.totalUnfinishedGames <= 2 && stats.totalFinishedGames <= 2) {
      return;
    }
    const statsDiv = document.getElementById('statistics');
    if (!statsDiv) {
      console.log("Can't find the stats div");
      return;
    }
    const statsBody = statsDiv.querySelector('div#statsBody');
    if (statsBody) {
      statsBody.innerHTML = stats.getStatsSummary();
    }
    statsDiv.classList.remove('hidden');
    statsDiv.classList.add('show');
  },

  /**
   * Toggle the visual invalid-word warning for the current row.
   * @param {number} rowNum - Current board row
   * @param {boolean} wordIsInvalid - Whether the word is invalid
   * @param {string} [guessString] - The invalid word for display
   */
  changeInvalidWordState(rowNum, wordIsInvalid, guessString) {
    if (this.wordIsInvalid !== wordIsInvalid) {
      if (!this.wordIsInvalid) {
        this.markCurrentWordInvalid(rowNum);
        if (guessString) {
          this.dupWord.querySelector('#dupWordContents').textContent = guessString;
          this.dupWord.classList.remove('hidden');
          this.dupWord.classList.add('show');
        }
      } else {
        this.markCurrentWordValid(rowNum);
        this.dupWord.classList.remove('show');
        this.dupWord.classList.add('hidden');
      }
      this.wordIsInvalid = wordIsInvalid;
    }
  },

  /**
   * Toggle the visual secondary-word (valid but not a target) warning.
   * @param {boolean} wordIsNonTarget - Whether to show the warning
   * @param {string} [guessString=''] - The guessed word
   */
  changeNonTargetWordState(wordIsNonTarget, guessString = '') {
    if (this.wordIsNonTarget !== wordIsNonTarget) {
      if (!this.wordIsNonTarget) {
        if (guessString) {
          this.secondaryWordWarning.classList.remove('hidden');
          this.secondaryWordWarning.classList.add('show');
        }
      } else {
        this.secondaryWordWarning.classList.remove('show');
        this.secondaryWordWarning.classList.add('hidden');
      }
      this.wordIsNonTarget = wordIsNonTarget;
    }
  },

  /**
   * Show a hint prompt element (duplicate-word or non-word).
   * @param {string} promptID - Element ID of the prompt
   */
  showInvalidWordPrompt(promptID) {
    const elt = document.getElementById(promptID);
    if (elt) {
      elt.classList.remove('hidden');
      elt.classList.add('show');
    }
  },

  /**
   * Hide one or all invalid word prompts.
   * @param {string} [promptID=''] - Specific prompt to clear, or empty to clear all
   */
  clearInvalidWordPrompt(promptID = '') {
    const elts = promptID
      ? [document.getElementById(promptID)]
      : Array.from(document.querySelectorAll('div.wordProblemPrompt.show'));
    for (const elt of elts) {
      if (elt) {
        elt.classList.remove('show');
        elt.classList.add('hidden');
      }
    }
  },

  /** Show a transient "Five-Green Fake-Out" notification that auto-hides after 10 seconds. */
  showHitFakeOut() {
    const elt = document.getElementById('fiveGreenFakeOut');
    if (elt) {
      elt.classList.remove('hidden');
      elt.classList.add('show');
      setTimeout(() => {
        elt.classList.remove('show');
        elt.classList.add('hidden');
      }, 10 * 1000);
    } else {
      console.log(`Can't find a "fiveGreenFakeOut" element.`);
    }
  },

  /** @param {number} rowNum - Row to mark invalid */
  markCurrentWordInvalid(rowNum) {
    const row = this.board
      .querySelectorAll('.letter-row-container')
      .item(rowNum)
      .querySelector('.letter-row');
    for (let i = 0; i < 5; i++) {
      const box = row.childNodes[i];
      box.classList.add('invalid');
    }
  },

  /** @param {number} rowNum - Row to unmark invalid */
  markCurrentWordValid(rowNum) {
    const row = this.board
      .querySelectorAll('.letter-row-container')
      .item(rowNum)
      .querySelector('.letter-row');
    for (let i = 0; i < 5; i++) {
      const box = row.childNodes[i];
      box.classList.remove('invalid');
    }
  },

  /** @param {number} numNeededRows - Ensure the board has at least this many rows */
  initBoard(numNeededRows) {
    for (let i = this.board.childElementCount; i < numNeededRows; i++) {
      this.appendBoardRow();
    }
  },

  /** Remove all rows from the board and reset keyboard colors. */
  clearBoard() {
    if (!this.board) {
      console.log('No board in clearBoard!');
      return;
    }
    while (this.board.childElementCount) {
      this.board.removeChild(this.board.lastChild);
    }
  },

  /**
   * Animate scoring a guess row by coloring each letter box and keyboard key.
   * @param {string} currentGuess - The guessed word
   * @param {number[]} scores - Score array (0/1/2 per position)
   * @param {number} guessCount - Row index
   * @param {boolean} guessedIt - Whether the guess was correct
   * @param {boolean} immediate - Skip animation delay
   */
  enterScoredGuess(currentGuess, scores, guessCount, guessedIt, immediate) {
    const row = document.getElementsByClassName('letter-row')[guessCount];
    const limit = 5;
    const enterScoredGuessForEntry = (i) => {
      if (i >= limit) {
        return;
      }
      const box = row.children[i];
      const letter = currentGuess[i]; // array or string
      const letterColor = COLORS[scores[i]];
      box.classList.add(`background-${letterColor}`);
      this.shadeKeyboard(letter, letterColor, guessedIt, this.model.scoresByLetter[letter]);
      if (immediate) {
        enterScoredGuessForEntry(i + 1);
      } else {
        setTimeout(enterScoredGuessForEntry, 100, i + 1);
      }
    };
    enterScoredGuessForEntry(0);
  },

  /**
   * Remove a letter from the board at the given position.
   * @param {number} rowNum - Row index
   * @param {number} colNum - Column index (0-4)
   */
  deleteLetter(rowNum, colNum) {
    let row = document.getElementsByClassName('letter-row')[rowNum];
    let box = row.children[colNum];
    box.textContent = '';
    box.classList.remove('filled-box', 'show-lie', 'show-perceived-truth');
  },

  /**
   * Insert a letter into a board cell.
   * @param {string} pressedKey - The letter to insert
   * @param {number} rowNum - Row index
   * @param {number} colNum - Column index (0-4)
   */
  insertLetter(pressedKey, rowNum, colNum) {
    pressedKey = pressedKey.toLowerCase();

    let row = document.getElementsByClassName('letter-row')[rowNum];
    let box = row.children[colNum];
    box.textContent = pressedKey;
    box.classList.add('filled-box');
  },

  /**
   * Update the on-screen keyboard key color based on the letter's score.
   * Green > Yellow > Light blue for non-correct hits.
   * @param {string} letter - The letter to shade
   * @param {string} color - CSS color string
   * @param {boolean} guessIt - Whether the guess was correct
   * @param {number[]} numHitsForEachScore - Hit counts per score type
   */
  shadeKeyboard(letter, color, guessIt, numHitsForEachScore) {
    for (const elem of document.getElementsByClassName('keyboard-button')) {
      if (elem.textContent === letter) {
        if (guessIt) {
          elem.style.backgroundColor = '';
        } else if (numHitsForEachScore[2]) {
          //TODO: Gradient these
          elem.style.backgroundColor = 'var(--green)';
        } else if (numHitsForEachScore[1]) {
          elem.style.backgroundColor = 'var(--yellow)';
        } else if (numHitsForEachScore[0]) {
          elem.style.backgroundColor = 'var(--gray)';
        }
        break;
      }
    }
  },

  /**
   * Handle keyboard input: letters, Backspace/Del, and Enter.
   * Delegates to model methods for game logic.
   * @param {KeyboardEvent} e - Keyboard event
   */
  keyHandler(e) {
    // console.log('>> keyup');
    const pressedKey = String(e.key);
    if (pressedKey === 'Backspace' || pressedKey === 'Del') {
      if (this.model.nextLetterPosition !== 0) {
        this.model.deleteLetter();
        console.log(`lirdle: ignoring backspace at position 0`);
      }
    } else if (pressedKey.toLowerCase() === 'enter') {
      // console.log(`pressed enter, currentTarget: ${e.currentTarget}, target: ${e.target}`);
      e.stopPropagation();
      e.cancelBubble = true;
      if (this.wordIsInvalid) {
        // Otherwise do nothing -- there's a line that we're on an invalid word
        return;
      } else if (this.model.nextLetterPosition < 5) {
        console.log(`lirdle: ignoring return before full word is typed`);
        return;
      }
      this.changeNonTargetWordState(false);
      this.model.checkGuess();
    } else if (pressedKey.match(/^[a-z]$/i)) {
      if (this.model.nextLetterPosition < 5) {
        this.model.insertLetter(pressedKey.toLowerCase());
      }
      // Otherwise do nothing -- there's a line that we're on
      // an invalid word
    } else {
      console.log(`Lirdle: ignoring key event ${pressedKey}`);
    }
  },
  /**
   * Fetch and display yesterday's word and its aggregate stats
   * (percentage finished, average tries) from the stats API.
   */
  showYesterdaysWord() {
    if (!devMode()) {
      const yesterdaysWord = getYesterdaysWord();
      const yesterdaysWordElt = document.getElementById('yesterdaysWord');
      const answerStatsElt = yesterdaysWordElt.querySelector('span#answerStats');
      if (!answerStatsElt) {
        return;
      }
      yesterdaysWordElt.querySelector('span#theAnswer').textContent = yesterdaysWord;
      yesterdaysWordElt.classList.remove('hidden');
      yesterdaysWordElt.classList.add('show');
      // TODO: treat Feb 18/23 as 0 and drop all uses of the 8-digit num except to calc the position
      const currentDateNumber = getDateNumber() - 20230218 - 1;
      let failureCount = 0;
      let intervalPID = 0;
      const fetchFunc = () => {
        fetch(`stats/day${pad(currentDateNumber, 4, '0')}.json`)
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            const fractionFinished = (data.finished * 1.0) / data.started;
            const fractionFinishedDisplay = Math.round(100 * fractionFinished);
            const avgTriesDisplay = Math.round(100 * data.finishedDetails.average) / 100.0;
            answerStatsElt.textContent = ` (${fractionFinishedDisplay}% finished, avg tries: ${avgTriesDisplay})`;
          })
          .catch((err) => {
            console.log(`Error fetching - ${err}`);
            failureCount += 1;
            if (failureCount > 10) {
              clearInterval(intervalPID);
            }
          });
      };
      fetchFunc();
      intervalPID = setInterval(fetchFunc, 30 * 60000);
    }
  },
  /**
   * Fetch and display today's aggregate stats (percentage finished,
   * average tries) from the stats API. Polls every 10 minutes.
   */
  showTodaysStats() {
    let numTriesNeededHere = this.model.saveableState.guessWords.length || 0;
    const todaysStatsElt = document.getElementById('todaysStats');
    const todaysPctFinishedSoFarElt = todaysStatsElt.querySelector('span#todaysPctFinishedSoFar');
    const todaysAvgSoFarElt = todaysStatsElt.querySelector('span#todaysAvgSoFar');
    let needToRevealTodaysElt = true;
    // TODO: treat Feb 18/23 as 0 and drop all uses of the 8-digit num except to calc the position
    const currentDateNumber = getDateNumber() - 20230218;
    let failureCount = 0;
    let intervalPID = 0;
    if (numTriesNeededHere === 0) {
      return;
    }
    const fetchFunc = () => {
      fetch(`stats/day${pad(currentDateNumber, 4, '0')}.json`)
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          if (data.finished === 0) {
            // We've got an early finisher, so assume their result hasn't been picked up yet.
            data.finished += 1;
            data.started += 1;
            data.finishedDetails = { average: numTriesNeededHere };
          }
          const fractionFinished = (data.finished * 1.0) / data.started;
          const fractionFinishedDisplay = Math.round(100 * fractionFinished);
          const avgTriesDisplay = Math.round(100 * data.finishedDetails.average) / 100.0;
          todaysPctFinishedSoFarElt.textContent = fractionFinishedDisplay.toString();
          todaysAvgSoFarElt.textContent = avgTriesDisplay.toString();
          if (needToRevealTodaysElt) {
            todaysStatsElt.classList.remove('hidden');
            todaysStatsElt.classList.add('show');
            needToRevealTodaysElt = false;
          }
        })
        .catch((err) => {
          console.log(`Error fetching - ${err}`);
          failureCount += 1;
          if (failureCount > 10) {
            clearInterval(intervalPID);
          }
        });
    };
    fetchFunc();
    intervalPID = setInterval(fetchFunc, 10 * 60000);
  },
  /** Load and display the weekly testimonial from the teaser file. */
  showTestimonial() {
    const currentDateNumber = getInternalDateNumber(getDateNumber());
    const currentWeekNum = pad(Math.floor(currentDateNumber / 7), 3, '0');
    const liTOTW = document.getElementById('tofw');
    if (!liTOTW) {
      return;
    }
    fetch(`/tease/t${currentWeekNum}.txt`)
      .then((response) => {
        if (response.status === 200) {
          return response.text();
        }
      })
      .then((txt) => {
        if (!txt || txt.length === 0) {
          this.showOnOff(liTOTW, false);
        } else {
          liTOTW.querySelector('span#tofw-body').innerHTML = this.sanitize(txt);
          this.showOnOff(liTOTW, true);
        }
      })
      .catch((err) => {
        console.log(`Failed to process t${currentWeekNum}.txt `, err);
        this.showOnOff(liTOTW, false);
      });
  },
  /**
   * Sanitize text for safe HTML insertion (escape &, <, and newlines).
   * @param {string} txt - Raw text
   * @returns {string} HTML-safe text
   */
  sanitize(txt) {
    return txt.trim().replace('&', '&amp;').replace('<', '&lt;').replace(/\r?\n/, '<br />');
  },
  /**
   * Toggle show/hide CSS classes on a DOM node.
   * @param {HTMLElement} node - DOM element
   * @param {boolean} showNode - True to show, false to hide
   */
  showOnOff(node, showNode) {
    if (showNode) {
      node.classList.add('show');
      node.classList.remove('hidden');
    } else {
      node.classList.add('hidden');
      node.classList.remove('show');
    }
  },

  /** Show browser-specific promo blurbs based on user-agent detection. */
  doBlurbs() {
    const useragent = navigator.userAgent.toLowerCase();
    const vendor = navigator.vendor;
    const blacklist = [/\bipad\b/, /\biphone os\b/, /\bsamsung.*mobile safari\b/];
    if (blacklist.some((t) => t.test(useragent))) {
      // do nothing
    } else if (useragent.match(/\bmozilla\b.*\bfirefox\b/)) {
      const div = document.querySelector('div#promos div.for-firefox');
      if (div) {
        div.classList.remove('hidden');
      }
    } else if (vendor.startsWith('Google') && useragent.match(/\bmozilla\b.*\bchrome\b/)) {
      const div = document.querySelector('div#promos div.for-chrome');
      if (div) {
        div.classList.remove('hidden');
      }
    }
  },
  // initializeTheme(theme) {
  //     document.querySelector('#theme-select').value = theme;
  //     if (theme !== 'classic') {
  //         this.changeTheme(theme);
  //     }
  // },
  // changeThemeHandler(e) {
  //     const value = e.target.value;
  //     if (!['brainerd', 'butter', 'classic', 'dark', 'distractle', 'frikadeller', 'kincaid', 'louisiana', 'pink', 'tommy'].includes(value)) {
  //         console.log(`Can't process theme ${ value }`);
  //         return;
  //     }
  //     this.changeTheme(value);
  //     return value;
  // },
  // changeTheme(theme) {
  //     const elts = Array.from(document.querySelectorAll('link.theme')).
  //     filter(elt => elt.classList.contains('theme'));
  //     for (const elt of elts) {
  //         if (elt.getAttribute('href') !== `styles/${ theme }.css`) {
  //             elt.parentElement.removeChild(elt);
  //         }
  //     }
  //     document.getElementsByTagName("head")[0].insertAdjacentHTML(
  //         "beforeend",
  //         `<link rel="stylesheet" class="theme" href="styles/${ theme }.css" />`);
  // },
  /**
   * Update hint count displays in the hints panel.
   * @param {Object} values - Key-value pairs of hint counts to update
   */
  updateHintCounts(values) {
    const hintsBlock = document.querySelector('div#hintsBlock');
    if (hintsBlock) {
      for (const k in values) {
        const span = hintsBlock.querySelector(`span#${k}`);
        if (span) {
          span.textContent = values[k].toString();
        }
      }
    }
  },
  /**
   * Show or hide the "number of possible words remaining" label
   * on all filled rows.
   * @param {boolean} checked - True to show
   */
  showOrHideNumLeft(checked) {
    const rowContainers = Array.from(this.board.querySelectorAll('div.letter-row-container'));
    let firstBlankRow = rowContainers.findIndex(
      (rowContainer) => !rowContainer.querySelector('.filled-box'),
    );
    if (firstBlankRow === -1) {
      firstBlankRow = rowContainers.length;
    }

    const nodes = rowContainers
      .slice(0, firstBlankRow)
      .map((rowContainer) => rowContainer.querySelector('div.numWordsLeftContainer'));
    if (!nodes.length) {
      // console.log(`QQQ: selector for the num-words-left-container failed`);
      return;
    }
    const [classToShow, classToHide] = checked ? ['show', 'hidden'] : ['hidden', 'show'];
    for (const node of nodes) {
      node.classList.add(classToShow);
      node.classList.remove(classToHide);
    }
  },
  /**
   * Show or hide the num-left label for a specific row.
   * @param {boolean} checked - True to show
   * @param {number} rowNum - Row index
   */
  showOrHideNumLeftForRow(checked, rowNum) {
    const rowContainer = this.board.querySelectorAll('div.letter-row-container').item(rowNum);
    const node = rowContainer.querySelector('div.numWordsLeftContainer');
    if (!node) {
      //console.log(`QQQ: selector for the num-words-left-container failed`);
      return;
    }
    const [classToShow, classToHide] = checked ? ['show', 'hidden'] : ['hidden', 'show'];
    node.classList.add(classToShow);
    node.classList.remove(classToHide);
  },

  /**
   * Update the displayed number of possible words for a row.
   * @param {boolean} checked - Whether the num-left display is active
   * @param {number} rowNum - Row index
   * @param {number} numLeft - Number of possible words remaining
   */
  updateShowNumLeft(checked, rowNum, numLeft) {
    const rowContainer = this.board.querySelectorAll('div.letter-row-container').item(rowNum);
    const numWordsLeftContainer = rowContainer.querySelector('div.numWordsLeftContainer');
    const showNumLeftSpan =
      numWordsLeftContainer && numWordsLeftContainer.querySelector('span.numLeftAmount');
    if (!showNumLeftSpan) {
      //console.log(`QQQ: updateShowNumLeft: no span#numLeftAmount uin the last child`);
      return;
    }
    showNumLeftSpan.textContent = numLeft.toString();
  },
};

/**
 * Convert a date number to internal days-since-epoch format.
 * @param {number} dateNumber - Date number (YYYYMMDD)
 * @returns {number} Days since 2023-02-18
 */
function getInternalDateNumber(dateNumber) {
  return dateNumber - 20230218;
}
