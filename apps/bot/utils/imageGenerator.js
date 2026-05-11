import { createCanvas, loadImage } from 'canvas';

const COLORS = {
  EMPTY: '#C9C9C9',
  GREY: '#808080',
  YELLOW: '#eab308',
  GREEN: '#32B827',
  BACKGROUND: '#333333',
  BORDER: '#171717',
};

const CELL_SIZE = 60;
const BLOCK_SIZE = 48;
const BORDER_WIDTH = 6;
const THIN_BORDER = 2;
const RADIUS = 6;
const GAP = 8;

function getColorCode(scoreValue) {
  if (scoreValue === 2) return COLORS.GREEN;
  if (scoreValue === 1) return COLORS.YELLOW;
  if (scoreValue === 0) return COLORS.GREY;
  return COLORS.EMPTY;
}

function createRoundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Generates the Lirdle Grid Image
 * @param {Array} guessWords - Array of strings (the words guessed)
 * @param {Array} perceivedScores - Array of arrays (the scores the game SHOWED the user)
 * @param {Array} changes - The actual lies array from the database session!
 * @param {Boolean} isFinished - Has the user won/given up?
 * @param {Boolean} showLetters - Render the guessed letters inside the blocks
 */
export async function generateLirdleImage(
  guessWords,
  perceivedScores,
  changes,
  isFinished,
  showLetters = false,
) {
  // Canvas dimensions: 5 columns, N rows (minimum 6)
  const rows = Math.max(6, guessWords.length);
  const width = 5 * CELL_SIZE + 4 * GAP + 40; // 40px padding
  const height = rows * CELL_SIZE + (rows - 1) * GAP + 40;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  // Grid
  for (let row = 0; row < rows; row++) {
    const guess = guessWords[row];
    const perceivedScoreRow = perceivedScores[row];

    const changeLine = changes && changes[row] ? changes[row] : null;

    for (let col = 0; col < 5; col++) {
      const cellX = 20 + col * (CELL_SIZE + GAP);
      const cellY = 20 + row * (CELL_SIZE + GAP);

      const blockOffset = (CELL_SIZE - BLOCK_SIZE) / 2;
      const blockX = cellX + blockOffset;
      const blockY = cellY + blockOffset;

      if (!guess || !perceivedScoreRow || !Array.isArray(perceivedScoreRow)) {
        createRoundRectPath(ctx, blockX, blockY, BLOCK_SIZE, BLOCK_SIZE, RADIUS);
        ctx.fillStyle = COLORS.EMPTY;
        ctx.fill();

        ctx.lineWidth = THIN_BORDER;
        ctx.strokeStyle = COLORS.BORDER;
        ctx.stroke();
        continue;
      }

      const perceivedColor = getColorCode(perceivedScoreRow[col]);
      const isLying = changeLine && changeLine[0] === col;
      const trueColor = isLying ? getColorCode(changeLine[1]) : perceivedColor;

      // Render Truth Outer Border
      if (isFinished && isLying) {
        createRoundRectPath(
          ctx,
          blockX - BORDER_WIDTH,
          blockY - BORDER_WIDTH,
          BLOCK_SIZE + BORDER_WIDTH * 2,
          BLOCK_SIZE + BORDER_WIDTH * 2,
          RADIUS + 2,
        );
        ctx.fillStyle = trueColor;
        ctx.fill();
      }

      // Render Base Block Fill
      createRoundRectPath(ctx, blockX, blockY, BLOCK_SIZE, BLOCK_SIZE, RADIUS);
      ctx.fillStyle = perceivedColor;
      ctx.fill();

      // Render Thin Border
      ctx.lineWidth = THIN_BORDER;
      ctx.strokeStyle = COLORS.BORDER;
      ctx.stroke();

      // Render Letters
      if (showLetters && guess) {
        const letter = guess[col].toUpperCase();
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText(letter, blockX + BLOCK_SIZE / 2, blockY + BLOCK_SIZE / 2);
      }
    }
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generates a dynamic, auto-scaling grid of players.
 * Used for BOTH Live Spectator and the Midnight Leaderboard.
 */
export async function generateGridDashboard(players, title) {
  // Determine Grid Scaling based on Player Count
  const N = players.length;
  let cols = Math.min(N, 4);
  if (N === 0) cols = 1;
  const rows = Math.ceil(N / cols) || 1;

  let scale;
  if (N <= 2) scale = 1.2;
  else if (N <= 4) scale = 1.0;
  else if (N <= 8) scale = 0.85;
  else scale = 0.7;

  // Base Tile Dimensions (Before Scale)
  const T_WIDTH = 180;
  const T_HEIGHT = 280;

  const PADDING = 40;
  const TITLE_HEIGHT = 80;
  const width = Math.max(600, cols * T_WIDTH * scale + PADDING * 2);
  const height = TITLE_HEIGHT + rows * T_HEIGHT * scale + PADDING * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 50);

  // Mini Block Settings
  const M_CELL = 24;
  const M_BLOCK = 20;
  const M_BORDER = 3;
  const M_THIN = 1;
  const M_RAD = 4;
  const M_GAP = 4;
  const GRID_WIDTH = 5 * M_CELL + 4 * M_GAP;

  // Render Each Player
  for (let i = 0; i < N; i++) {
    const player = players[i];
    const r = Math.floor(i / cols);
    const itemsInThisRow = Math.min(cols, N - r * cols);
    const rowWidth = itemsInThisRow * T_WIDTH * scale;
    const startX = (width - rowWidth) / 2;

    const x = startX + (i % cols) * T_WIDTH * scale;
    const y = TITLE_HEIGHT + r * T_HEIGHT * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const colCenter = T_WIDTH / 2;

    // Player Avatar
    try {
      const avatar = await loadImage(player.avatarUrl);
      const aSize = 48;
      const aY = 20;

      ctx.save();
      ctx.beginPath();
      ctx.arc(colCenter, aY + aSize / 2, aSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, colCenter - aSize / 2, aY, aSize, aSize);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(colCenter, aY + aSize / 2, aSize / 2, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = player.won ? COLORS.GREEN : '#555555';
      ctx.stroke();
    } catch (e) {
      console.error('Avatar error', e);

      const avatar = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png');
      const aSize = 48;
      const aY = 20;

      ctx.save();
      ctx.beginPath();
      ctx.arc(colCenter, aY + aSize / 2, aSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, colCenter - aSize / 2, aY, aSize, aSize);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(colCenter, aY + aSize / 2, aSize / 2, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = player.won ? COLORS.GREEN : '#555555';
      ctx.stroke();
    }

    // Player Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const dName =
      player.username.length > 12 ? player.username.substring(0, 10) + '..' : player.username;
    ctx.fillText(dName, colCenter, 95);

    // Overflow Logic
    const totalGuesses = player.guessWords.length;
    const showPill = totalGuesses >= 7;

    let displayGuesses = player.guessWords;
    let displayScores = player.perceivedScores;
    let startIndex = 0;

    if (showPill) {
      startIndex = totalGuesses - 5;
      displayGuesses = player.guessWords.slice(startIndex);
      displayScores = player.perceivedScores.slice(startIndex);
    }

    const changesArray = player.changes || [];

    // Render 6 rows
    const gridX = colCenter - GRID_WIDTH / 2;
    let startY = 110;

    for (let row = 0; row < 6; row++) {
      const cellY = startY + row * (M_CELL + M_GAP);

      // Render 5 rows, 1st row replaced by overflow pill
      if (showPill && row === 0) {
        const hiddenCount = totalGuesses - 5;

        ctx.fillStyle = '#4b5563';
        createRoundRectPath(
          ctx,
          gridX,
          cellY + (M_CELL - M_BLOCK) / 2,
          GRID_WIDTH,
          M_BLOCK,
          M_RAD * 2,
        );
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`+${hiddenCount} older guesses`, colCenter, cellY + M_CELL / 2 + 2);
        continue;
      }

      const dataIndex = showPill ? row - 1 : row;
      const originalIndex = startIndex + dataIndex;
      const guess = displayGuesses[dataIndex];
      const perceivedScoreRow = displayScores[dataIndex];
      const changeLine = changesArray[originalIndex];

      for (let col = 0; col < 5; col++) {
        const cellX = gridX + col * (M_CELL + M_GAP);
        const blockX = cellX + (M_CELL - M_BLOCK) / 2;
        const blockY = cellY + (M_CELL - M_BLOCK) / 2;

        if (!guess || !perceivedScoreRow) {
          createRoundRectPath(ctx, blockX, blockY, M_BLOCK, M_BLOCK, M_RAD);
          ctx.fillStyle = COLORS.EMPTY;
          ctx.fill();
          ctx.lineWidth = M_THIN;
          ctx.strokeStyle = COLORS.BORDER;
          ctx.stroke();
          continue;
        }

        const perceivedColor = getColorCode(perceivedScoreRow[col]);
        const isLying = changeLine && changeLine[0] === col;
        const trueColor = isLying ? getColorCode(changeLine[1]) : perceivedColor;

        if (player.isFinished && isLying) {
          createRoundRectPath(
            ctx,
            blockX - M_BORDER,
            blockY - M_BORDER,
            M_BLOCK + M_BORDER * 2,
            M_BLOCK + M_BORDER * 2,
            M_RAD + 1,
          );
          ctx.fillStyle = trueColor;
          ctx.fill();
        }

        createRoundRectPath(ctx, blockX, blockY, M_BLOCK, M_BLOCK, M_RAD);
        ctx.fillStyle = perceivedColor;
        ctx.fill();
        ctx.lineWidth = M_THIN;
        ctx.strokeStyle = COLORS.BORDER;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  return canvas.toBuffer('image/png');
}
