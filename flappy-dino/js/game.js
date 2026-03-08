/*
 * game.js — Main entry point.
 *
 * Sets up the canvas, creates game objects, listens for input, and runs
 * the game loop using requestAnimationFrame with delta-time.
 */

// --------------- Canvas Setup ---------------

var canvas = document.getElementById("gameCanvas");
var ctx    = canvas.getContext("2d");

// Size the canvas to fill the entire browser window
var WIDTH, HEIGHT;

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  WIDTH  = canvas.width;
  HEIGHT = canvas.height;
}

resizeCanvas();

// --------------- Game State ---------------

var state = "start";   // "start" | "playing" | "paused" | "over"
var score = 0;

// Parallax scroll offset (increases while playing)
var scrollOffset = 0;

// Delta-time tracking
var lastTime = 0;

// --------------- Combo System ---------------

var comboCount   = 0;
var comboTimer   = 0;
var COMBO_TIMEOUT = 120; // frames before combo resets

// --------------- High Scores ---------------

var HIGH_SCORE_KEY = "flappyDinoHighScores";
var MAX_HIGH_SCORES = 10;

var highScores        = [];   // [{name, score}, ...] sorted descending
var enteringInitials  = false;
var initials          = "";
var newScoreIndex     = -1;   // position of the just-entered score in the table

function loadHighScores() {
  try {
    var data = localStorage.getItem(HIGH_SCORE_KEY);
    if (data) {
      highScores = JSON.parse(data);
    }
  } catch (e) {
    highScores = [];
  }
}

function saveHighScores() {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(highScores));
  } catch (e) {
    // localStorage unavailable — scores won't persist
  }
}

/** Does the given score qualify for the top-10 list? */
function scoreQualifies(s) {
  if (highScores.length < MAX_HIGH_SCORES) return true;
  return s > highScores[highScores.length - 1].score;
}

/** Insert a score into the list and return its index. */
function insertScore(name, s) {
  var entry = { name: name, score: s };
  var idx = 0;
  while (idx < highScores.length && highScores[idx].score >= s) {
    idx++;
  }
  highScores.splice(idx, 0, entry);
  if (highScores.length > MAX_HIGH_SCORES) {
    highScores.length = MAX_HIGH_SCORES;
  }
  saveHighScores();
  return idx;
}

loadHighScores();

// --------------- Game Objects ---------------

var player    = new Player(WIDTH, HEIGHT);
var obstacles = new ObstacleManager(WIDTH, HEIGHT);
var particles = new ParticleManager();
var powerups  = new PowerUpManager(WIDTH, HEIGHT);

// Re-fit canvas when the browser window is resized
window.addEventListener("resize", function () {
  resizeCanvas();
  player.canvasWidth  = WIDTH;
  player.canvasHeight = HEIGHT;
  obstacles.canvasWidth  = WIDTH;
  obstacles.canvasHeight = HEIGHT;
  powerups.canvasWidth  = WIDTH;
  powerups.canvasHeight = HEIGHT;
});

// --------------- Input ---------------

document.addEventListener("keydown", function (event) {
  // --- Start screen ---
  if (state === "start") {
    if (event.code === "KeyS" || event.code === "Space") {
      event.preventDefault();
      startGame();
      return;
    }
  }

  // --- Playing ---
  if (state === "playing") {
    if (event.code === "Space") {
      event.preventDefault();
      doFlap();
    }

    if (event.code === "KeyL") {
      handleLaser();
    }

    if (event.code === "KeyP" || event.code === "Escape") {
      state = "paused";
      return;
    }
  }

  // --- Paused ---
  if (state === "paused") {
    if (event.code === "KeyP" || event.code === "Escape") {
      state = "playing";
      lastTime = 0; // prevent a huge dt spike on resume
      return;
    }
  }

  // --- Game-over input ---
  if (state === "over") {
    if (enteringInitials) {
      // Capture A-Z letters
      if (event.code.startsWith("Key") && initials.length < 3) {
        initials += event.code.charAt(3).toUpperCase();
        if (initials.length === 3) {
          newScoreIndex = insertScore(initials, score);
          enteringInitials = false;
        }
        return;
      }
      // Backspace to delete last letter
      if (event.code === "Backspace" && initials.length > 0) {
        event.preventDefault();
        initials = initials.slice(0, -1);
        return;
      }
    } else {
      if (event.code === "KeyS" || event.code === "Space") {
        event.preventDefault();
        resetGame();
      }
    }
  }
});

// --------------- Pointer helpers (mouse + touch) ---------------

function getCanvasPos(clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width  / rect.width),
    y: (clientY - rect.top)  * (canvas.height / rect.height)
  };
}

function handlePointerAt(x, y) {
  if (state === "start") {
    startGame();
  } else if (state === "playing") {
    // Check laser button first
    var btn = getLaserButtonLayout(WIDTH, HEIGHT);
    var dx = x - btn.cx;
    var dy = y - btn.cy;
    if (dx * dx + dy * dy <= btn.radius * btn.radius) {
      handleLaser();
    } else {
      doFlap();
    }
  } else if (state === "over") {
    if (enteringInitials) {
      handleLetterTap(x, y);
    } else {
      resetGame();
    }
  }
}

function handleLetterTap(x, y) {
  var lp = getLetterPickerLayout(WIDTH, HEIGHT);
  var cs = lp.cellSize;

  // Check A-Z
  for (var i = 0; i < 26; i++) {
    var col = i % lp.cols;
    var row = Math.floor(i / lp.cols);
    var cx = lp.startX + col * cs;
    var cy = lp.startY + row * cs;

    if (x >= cx && x < cx + cs && y >= cy && y < cy + cs) {
      if (initials.length < 3) {
        initials += lp.letters[i];
        if (initials.length === 3) {
          newScoreIndex = insertScore(initials, score);
          enteringInitials = false;
        }
      }
      return;
    }
  }

  // Check DEL (col 8, row 2)
  var delX = lp.startX + 8 * cs;
  var delY = lp.startY + 2 * cs;
  if (x >= delX && x < delX + cs && y >= delY && y < delY + cs) {
    if (initials.length > 0) {
      initials = initials.slice(0, -1);
    }
  }
}

canvas.addEventListener("click", function (event) {
  var pos = getCanvasPos(event.clientX, event.clientY);
  handlePointerAt(pos.x, pos.y);
});

canvas.addEventListener("touchstart", function (event) {
  event.preventDefault();
  var pos = getCanvasPos(event.touches[0].clientX, event.touches[0].clientY);
  handlePointerAt(pos.x, pos.y);
});

// --------------- Actions ---------------

/** Flap the dino and emit dust particles. */
function doFlap() {
  player.flap();
  playFlapSound();
  particles.addDust(player.x, player.y + player.height);
}

/** Transition from the start screen into gameplay. */
function startGame() {
  state = "playing";
  lastTime = 0;
  doFlap();
}

/** Try to fire the laser, handle combo and spark effects. */
function handleLaser() {
  if (!player.shootLaser()) return; // still on cooldown
  playLaserSound();

  var eye = player.getEyePosition();
  var hit = obstacles.fireLaser(eye.x, eye.y);

  if (hit) {
    player.laserEndX = hit.hitX; // beam stops at the cactus

    // Combo tracking
    comboCount++;
    comboTimer = 0;

    if (comboCount > 1) {
      var bonus = comboCount;
      score += bonus;
      playComboSound(comboCount);
      particles.addScorePopup(hit.hitX, hit.hitY, "+" + bonus + " COMBO", "#FF4444");
    }

    // Sparks at impact point
    particles.addSparks(hit.hitX, hit.hitY);
  } else {
    player.laserEndX = WIDTH; // beam reaches the edge
    comboCount = 0;           // miss resets combo
  }
}

// --------------- Core Loop ---------------

function gameLoop(timestamp) {
  // --- Delta time ---
  var dt;
  if (lastTime === 0) {
    lastTime = timestamp;
    dt = 0; // skip physics on first frame / after pause
  } else {
    dt = (timestamp - lastTime) / 16.667; // normalised: 1.0 at 60 fps
    if (dt > 3) dt = 3; // cap to prevent huge jumps
  }
  lastTime = timestamp;

  // --- Update ---
  if (state === "playing") {
    var diff = getDifficulty(score);

    // Slow-motion power-up halves speed
    if (player.slowTimer > 0) {
      diff.speed *= 0.5;
    }

    player.update(dt);

    var scored = obstacles.update(dt, player.x, diff, function (obs) {
      powerups.trySpawn(obs.x, obs.gapTop, obs.gapBottom);
    });

    // Score points for passing obstacles
    if (scored > 0) {
      score += scored;
      playScoreSound();
      particles.addScorePopup(WIDTH / 2, 60, "+" + scored, "#FFD700");
    }

    powerups.update(dt, diff.speed);
    particles.update(dt);

    // Combo timeout
    if (comboCount > 0) {
      comboTimer += dt;
      if (comboTimer > COMBO_TIMEOUT) {
        comboCount = 0;
      }
    }

    // Power-up collection
    var pu = powerups.checkCollision(player.getHitbox());
    if (pu) {
      player.applyPowerUp(pu.type, pu.duration);
      playPowerUpSound();
      particles.addScorePopup(pu.x, pu.y, pu.type.toUpperCase(), pu.color);
    }

    // Collision detection
    var died = false;
    if (player.shieldTimer > 0) {
      // Shield — bounce off edges instead of dying
      if (player.y + player.height >= HEIGHT) {
        player.y = HEIGHT - player.height;
        player.velocityY *= -0.5;
      }
      if (player.y <= 0) {
        player.y = 0;
        player.velocityY *= -0.5;
      }
      // Shield absorbs obstacle collision (no death)
    } else {
      if (obstacles.checkCollision(player.getHitbox())) died = true;
      if (player.y + player.height >= HEIGHT)           died = true;
      if (player.y <= 0)                                died = true;
    }

    if (died) {
      state = "over";
      player.die();
      playDeathSound();
      playAngelMelody();

      if (scoreQualifies(score)) {
        enteringInitials = true;
        initials = "";
        newScoreIndex = -1;
      } else {
        enteringInitials = false;
        newScoreIndex = -1;
      }
    }

    scrollOffset += diff.speed * dt;

  } else if (state === "over") {
    // Angel floats upward while the world stays frozen
    player.updateDead(dt);
    scrollOffset += OBSTACLE_SPEED * 0.3 * dt;
  }
  // "start" and "paused" — nothing updates

  // --- Draw ---
  drawParallaxBackground(ctx, WIDTH, HEIGHT, scrollOffset, score);

  if (state === "start") {
    drawStartScreen(ctx, WIDTH, HEIGHT, highScores);
  } else if (state === "playing") {
    drawObstacles(ctx, obstacles);
    drawDebris(ctx, obstacles);
    drawPowerUps(ctx, powerups);
    drawDino(ctx, player);
    if (player.laserActive) {
      drawLaser(ctx, player);
    }
    drawCooldownBar(ctx, player);
    drawParticles(ctx, particles);
    drawScore(ctx, score, WIDTH);
    if (comboCount > 1) {
      drawCombo(ctx, comboCount, WIDTH);
    }
    drawActivePowerUps(ctx, player);
    drawLaserButton(ctx, WIDTH, HEIGHT, player);
  } else if (state === "paused") {
    drawObstacles(ctx, obstacles);
    drawDebris(ctx, obstacles);
    drawPowerUps(ctx, powerups);
    drawDino(ctx, player);
    drawScore(ctx, score, WIDTH);
    drawPauseScreen(ctx, WIDTH, HEIGHT);
  } else if (state === "over") {
    drawObstacles(ctx, obstacles);
    drawDebris(ctx, obstacles);
    drawDino(ctx, player);
    if (player.laserActive) {
      drawLaser(ctx, player);
    }
    drawGameOverScreen(ctx, WIDTH, HEIGHT, score,
                       enteringInitials, initials, highScores, newScoreIndex);
    if (enteringInitials) {
      drawLetterPicker(ctx, WIDTH, HEIGHT);
    }
  }

  requestAnimationFrame(gameLoop);
}

// --------------- Reset ---------------

function resetGame() {
  player    = new Player(WIDTH, HEIGHT);
  obstacles = new ObstacleManager(WIDTH, HEIGHT);
  particles = new ParticleManager();
  powerups  = new PowerUpManager(WIDTH, HEIGHT);
  score        = 0;
  comboCount   = 0;
  comboTimer   = 0;
  scrollOffset = 0;
  lastTime     = 0;
  state        = "playing";
  doFlap();
}

// --------------- Start! ---------------

gameLoop(performance.now());
