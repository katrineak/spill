/*
 * obstacles.js — Cactus obstacles that scroll from right to left.
 *
 * Each obstacle is a pair: a top cactus hanging from the ceiling and a
 * bottom cactus growing from the ground, with a gap for the dino to fly
 * through.  The laser can carve holes in the cactuses.
 *
 * Difficulty scales with score — speed increases and the gap shrinks.
 */

// --------------- Constants ---------------

var OBSTACLE_WIDTH = 52;
var GAP_HEIGHT     = 140;  // initial vertical space between top and bottom cactus
var OBSTACLE_SPEED = 2.5;  // initial pixels per frame
var SPAWN_INTERVAL = 100;  // frames between new obstacles

var LASER_HOLE_HEIGHT = 42; // how tall the hole carved by a laser hit is

// --------------- Difficulty ---------------

/**
 * Return speed, gap size, and spawn interval for a given score.
 * Called from game.js every frame.
 */
function getDifficulty(score) {
  var speed         = OBSTACLE_SPEED * (1 + Math.min(score * 0.015, 0.8));
  var gap           = Math.max(GAP_HEIGHT - score * 1.0, 95);
  var spawnInterval = Math.max(SPAWN_INTERVAL - score * 0.5, 60);
  return { speed: speed, gap: gap, spawnInterval: spawnInterval };
}

// --------------- Constructor ---------------

function ObstacleManager(canvasWidth, canvasHeight) {
  this.canvasWidth  = canvasWidth;
  this.canvasHeight = canvasHeight;
  this.obstacles    = [];
  this.debris       = [];  // falling cactus chunks after laser hits
  this.spawnAccum   = 0;   // accumulator for dt-based spawning
}

// --------------- Methods ---------------

/** Spawn a new obstacle pair at the right edge of the screen. */
ObstacleManager.prototype.spawn = function (gapSize) {
  var gap  = gapSize || GAP_HEIGHT;
  var minY = 80;
  var maxY = this.canvasHeight - 80 - gap;
  if (maxY < minY) maxY = minY;

  var gapTop = Math.floor(Math.random() * (maxY - minY)) + minY;

  var obs = {
    x:         this.canvasWidth,
    gapTop:    gapTop,
    gapBottom: gapTop + gap,
    width:     OBSTACLE_WIDTH,
    scored:    false,
    holes:     [],  // laser-carved holes: [{y, height}, ...]
    flowers:   generateFlowers(gapTop, gapTop + gap,
                               OBSTACLE_WIDTH, this.canvasHeight)
  };

  this.obstacles.push(obs);
  return obs;
};

/**
 * Move all obstacles left and spawn new ones on a timer.
 *
 * @param {number}   dt        — delta-time (1 = one frame at 60 fps)
 * @param {number}   playerX   — player X for scoring
 * @param {object}   difficulty — { speed, gap, spawnInterval }
 * @param {function} onSpawn   — optional callback(obs) when a new obstacle spawns
 * @returns {number} number of obstacles the player just passed
 */
ObstacleManager.prototype.update = function (dt, playerX, difficulty, onSpawn) {
  var speed = difficulty.speed;

  // Spawn timer
  this.spawnAccum += dt;
  if (this.spawnAccum >= difficulty.spawnInterval) {
    this.spawnAccum -= difficulty.spawnInterval;
    var obs = this.spawn(difficulty.gap);
    if (onSpawn) onSpawn(obs);
  }

  var scored = 0;

  for (var i = this.obstacles.length - 1; i >= 0; i--) {
    var obs = this.obstacles[i];
    obs.x -= speed * dt;

    if (!obs.scored && obs.x + obs.width < playerX) {
      obs.scored = true;
      scored++;
    }

    if (obs.x + obs.width < -10) {
      this.obstacles.splice(i, 1);
    }
  }

  // Update falling debris — gravity pulls them down while they scroll left
  for (var i = this.debris.length - 1; i >= 0; i--) {
    var d = this.debris[i];
    d.velocityY += GRAVITY * dt;
    d.y += d.velocityY * dt;
    d.x -= speed * dt;
    d.currentRotation += d.rotationSpeed * dt;

    if (d.y > this.canvasHeight + 50 || d.x + d.width < -10) {
      this.debris.splice(i, 1);
    }
  }

  return scored;
};

/**
 * Fire a laser beam from (eyeX, eyeY) going right.
 * Carves a hole in the first solid cactus section the beam hits.
 *
 * @returns {{hitX: number, hitY: number}|null}  hit info, or null if no hit
 */
ObstacleManager.prototype.fireLaser = function (eyeX, eyeY) {
  // We need the nearest obstacle (by X) that the beam would hit.
  var bestHit  = null;
  var bestDist = Infinity;

  for (var i = 0; i < this.obstacles.length; i++) {
    var obs = this.obstacles[i];

    // Obstacle must be (at least partially) to the right of the eye
    if (obs.x + obs.width <= eyeX) continue;

    // Does the beam Y land inside the top or bottom cactus?
    var hitsTop    = eyeY < obs.gapTop;
    var hitsBottom = eyeY > obs.gapBottom;

    if (!hitsTop && !hitsBottom) continue; // beam goes through the gap

    // Check that the beam Y is inside a *solid* section (not a hole)
    var blocked;
    if (hitsTop) {
      blocked = isYInSegments(eyeY, getSolidSegments(0, obs.gapTop, obs.holes));
    } else {
      blocked = isYInSegments(eyeY,
        getSolidSegments(obs.gapBottom, this.canvasHeight, obs.holes));
    }

    if (!blocked) continue; // beam passes through a previously-carved hole

    var hitX = Math.max(obs.x, eyeX);
    var dist = hitX - eyeX;

    if (dist < bestDist) {
      bestDist = dist;
      bestHit  = { obs: obs, hitX: hitX };
    }
  }

  if (bestHit) {
    // Check if a flower absorbs the hit instead of the cactus body
    var flowerIdx = findFlowerAtY(bestHit.obs, eyeY, this.canvasHeight);

    if (flowerIdx >= 0) {
      // Flower takes the hit — knock it off, cactus stays intact
      playFlowerHitSound();
      var flower = bestHit.obs.flowers[flowerIdx];
      flower.fallen = true;
      this.debris.push({
        x:               bestHit.obs.x + flower.offsetX,
        y:               flower.y,
        width:           0,
        height:          0,
        velocityY:       -2,   // slight upward pop
        rotationSpeed:   (Math.random() - 0.5) * 0.15,
        currentRotation: 0,
        isFlower:        true,
        flowerColor:     flower.color,
        flowerRadius:    flower.radius
      });
    } else {
      // No flower in the way — carve the cactus
      playCactusHitSound();
      var holeY = eyeY - LASER_HOLE_HEIGHT / 2;
      bestHit.obs.holes.push({ y: holeY, height: LASER_HOLE_HEIGHT });

      // Any cactus pieces no longer connected to ceiling/ground should fall
      this.findAndDropDisconnected(bestHit.obs);
    }

    return { hitX: bestHit.obs.x, hitY: eyeY };
  }

  return null;
};

/**
 * Check whether a hitbox rectangle overlaps any *solid* part of any
 * obstacle (accounts for laser-carved holes).
 */
ObstacleManager.prototype.checkCollision = function (hitbox) {
  for (var i = 0; i < this.obstacles.length; i++) {
    var obs = this.obstacles[i];

    // Top cactus — solid segments only
    var topSegs = getSolidSegments(0, obs.gapTop, obs.holes);
    for (var j = 0; j < topSegs.length; j++) {
      if (rectsOverlap(hitbox, {
        x: obs.x, y: topSegs[j].y,
        width: obs.width, height: topSegs[j].height
      })) {
        return true;
      }
    }

    // Bottom cactus — solid segments only
    var botSegs = getSolidSegments(obs.gapBottom, this.canvasHeight, obs.holes);
    for (var j = 0; j < botSegs.length; j++) {
      if (rectsOverlap(hitbox, {
        x: obs.x, y: botSegs[j].y,
        width: obs.width, height: botSegs[j].height
      })) {
        return true;
      }
    }
  }

  return false;
};

/**
 * After carving a hole, find cactus segments that are no longer
 * connected to their anchor edge (ceiling or ground) and turn them
 * into falling debris.
 */
ObstacleManager.prototype.findAndDropDisconnected = function (obs) {
  var topH = obs.gapTop;           // height of the top cactus
  var botH = this.canvasHeight - obs.gapBottom; // height of the bottom cactus

  // Pre-calculate the absolute Y of each arm so we can attach them
  // to the correct debris chunk.  Matches the logic in drawCactusArms.
  var topArmYs = [];
  if (topH >= 90) {
    topArmYs.push({ y: topH * 0.30, side: -1 });
    topArmYs.push({ y: topH * 0.62, side:  1 });
  }
  var botArmYs = [];
  if (botH >= 90) {
    botArmYs.push({ y: obs.gapBottom + botH * 0.70, side: -1 });
    botArmYs.push({ y: obs.gapBottom + botH * 0.38, side:  1 });
  }

  // --- Top cactus (anchored to the ceiling at y = 0) ---
  var topSegs = getSolidSegments(0, obs.gapTop, obs.holes);
  for (var i = 0; i < topSegs.length; i++) {
    var seg = topSegs[i];
    if (seg.y < 0.5) continue; // touches the ceiling — still anchored

    this.debris.push(
      this.buildChunkDebris(obs, seg, true, topArmYs)
    );
    obs.holes.push({ y: seg.y, height: seg.height });
  }

  // --- Bottom cactus (anchored to the ground at y = canvasHeight) ---
  var botSegs = getSolidSegments(obs.gapBottom, this.canvasHeight, obs.holes);
  for (var i = 0; i < botSegs.length; i++) {
    var seg = botSegs[i];
    if (seg.y + seg.height > this.canvasHeight - 0.5) continue;

    this.debris.push(
      this.buildChunkDebris(obs, seg, false, botArmYs)
    );
    obs.holes.push({ y: seg.y, height: seg.height });
  }
};

/**
 * Build a debris object for a disconnected cactus chunk, carrying
 * along any flowers and arms that were attached to it.
 */
ObstacleManager.prototype.buildChunkDebris = function (obs, seg, isFlipped, armYs) {
  var segEnd = seg.y + seg.height;

  // Collect flowers that sit on this chunk
  var chunkFlowers = [];
  for (var f = 0; f < obs.flowers.length; f++) {
    var fl = obs.flowers[f];
    if (fl.fallen) continue;
    if (fl.isTop !== isFlipped) continue;          // wrong cactus half
    if (fl.y >= seg.y && fl.y < segEnd) {
      chunkFlowers.push({
        relY:    fl.y - seg.y,
        offsetX: fl.offsetX,
        color:   fl.color,
        radius:  fl.radius
      });
      fl.fallen = true;
    }
  }

  // Collect arms whose Y falls inside this chunk
  var chunkArms = [];
  for (var a = 0; a < armYs.length; a++) {
    var ay = armYs[a].y;
    if (ay >= seg.y - 5 && ay < segEnd + 5) {
      chunkArms.push({ relY: ay - seg.y, side: armYs[a].side });
    }
  }

  return {
    x:               obs.x,
    y:               seg.y,
    width:           obs.width,
    height:          seg.height,
    velocityY:       0,
    rotationSpeed:   (Math.random() - 0.5) * 0.03,
    currentRotation: 0,
    flowers:         chunkFlowers,
    arms:            chunkArms,
    isFlipped:       isFlipped
  };
};

/** Reset everything for a new game. */
ObstacleManager.prototype.reset = function () {
  this.obstacles  = [];
  this.debris     = [];
  this.spawnAccum = 0;
};

// --------------- Helpers ---------------

/** Do two axis-aligned rectangles overlap? */
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width  &&
    a.x + a.width  > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Given a vertical range [fromY, toY), subtract all holes and return
 * the remaining solid segments as [{y, height}, ...].
 */
function getSolidSegments(fromY, toY, holes) {
  var segments = [{ y: fromY, height: toY - fromY }];

  for (var i = 0; i < holes.length; i++) {
    var hole    = holes[i];
    var holeEnd = hole.y + hole.height;
    var next    = [];

    for (var j = 0; j < segments.length; j++) {
      var seg    = segments[j];
      var segEnd = seg.y + seg.height;

      // No overlap — keep the segment as-is
      if (hole.y >= segEnd || holeEnd <= seg.y) {
        next.push(seg);
        continue;
      }

      // Part above the hole
      if (hole.y > seg.y) {
        next.push({ y: seg.y, height: hole.y - seg.y });
      }

      // Part below the hole
      if (holeEnd < segEnd) {
        next.push({ y: holeEnd, height: segEnd - holeEnd });
      }
    }

    segments = next;
  }

  return segments;
}

/** Is a single Y coordinate inside any of the given segments? */
function isYInSegments(y, segments) {
  for (var i = 0; i < segments.length; i++) {
    if (y >= segments[i].y && y < segments[i].y + segments[i].height) {
      return true;
    }
  }
  return false;
}

/** Does the vertical range [fromY, toY) overlap any segment? */
function isYRangeInSegments(fromY, toY, segments) {
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (fromY < seg.y + seg.height && toY > seg.y) {
      return true;
    }
  }
  return false;
}

// --------------- Flower Helpers ---------------

/**
 * Generate 5–8 random flowers for a new obstacle.
 * Colours have the same saturation as the cactus but a non-green hue.
 */
function generateFlowers(gapTop, gapBottom, obsWidth, canvasHeight) {
  var count   = 5 + Math.floor(Math.random() * 4); // 5-8
  var flowers = [];
  var stemInset = 10;

  for (var i = 0; i < count; i++) {
    // Pick a random cactus half (top or bottom)
    var isTop = Math.random() < 0.5;

    var minY, maxY;
    if (isTop) {
      minY = 16;
      maxY = gapTop - 18;
    } else {
      minY = gapBottom + 18;
      maxY = canvasHeight - 16;
    }

    if (maxY <= minY) continue; // cactus too short for a flower

    var y = minY + Math.random() * (maxY - minY);

    // Place on left or right edge of the stem
    var side    = Math.random() < 0.5 ? -1 : 1;
    var offsetX = (side === -1) ? stemInset : obsWidth - stemInset;

    // Non-green hue at similar saturation
    var hue   = randomNonGreenHue();
    var color  = "hsl(" + Math.round(hue) + ", 60%, 55%)";
    var radius = 6 + Math.random() * 3; // 6 – 9 px

    flowers.push({
      offsetX: offsetX,
      y:       y,
      color:   color,
      radius:  radius,
      isTop:   isTop,
      fallen:  false
    });
  }

  return flowers;
}

/**
 * Return a random hue (0-360) that avoids green (70-170).
 */
function randomNonGreenHue() {
  // Non-green range = [0,70) + [170,360) = 260 degrees total
  var r = Math.random() * 260;
  return r < 70 ? r : r + 100;   // skip the 70-170 green band
}

/**
 * Find a (non-fallen) flower near the beam's Y on the given obstacle.
 * Returns the flower index, or -1 if none found.
 */
function findFlowerAtY(obs, beamY, canvasHeight) {
  for (var i = 0; i < obs.flowers.length; i++) {
    var f = obs.flowers[i];
    if (f.fallen) continue;
    if (Math.abs(f.y - beamY) > f.radius + 5) continue;

    // Make sure the flower is still on a solid section (not inside a hole)
    var segs;
    if (f.isTop) {
      segs = getSolidSegments(0, obs.gapTop, obs.holes);
    } else {
      segs = getSolidSegments(obs.gapBottom, canvasHeight, obs.holes);
    }
    if (!isYInSegments(f.y, segs)) continue;

    return i;
  }
  return -1;
}
