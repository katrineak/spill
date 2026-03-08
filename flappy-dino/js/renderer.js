/*
 * renderer.js — All the drawing code lives here.
 *
 * Every function receives the canvas 2D context ("ctx") so it can draw.
 * Nothing in this file changes game state — it only reads and paints.
 */

// --------------- Colours ---------------

var CACTUS_DARK  = "#2E6B1E";
var CACTUS_MID   = "#3E8A2E";
var CACTUS_LIGHT = "#5AAA3A";
var DINO_BODY    = "#4A7A3F";
var DINO_BELLY   = "#8BBF78";
var WING_FILL    = "#5A9A4F";
var WING_EDGE    = "#3D6E33";

// --------------- Day / Night Cycle ---------------

// Each stage defines RGB triplets for the sky, mountains, clouds, ground
// and a star visibility alpha.
var DAY_STAGES = [
  // Dawn
  { skyTop: [255,140,105], skyBottom: [255,212,184],
    mount1: [139,107,139], mount2: [160,123,123],
    cloud: [255,224,204], ground: [194,178,128], starAlpha: 0 },
  // Day
  { skyTop: [135,206,235], skyBottom: [224,240,255],
    mount1: [123,155,181], mount2: [139,170,155],
    cloud: [255,255,255], ground: [194,178,128], starAlpha: 0 },
  // Dusk
  { skyTop: [255,107,53], skyBottom: [255,176,136],
    mount1: [107,75,107], mount2: [139,91,91],
    cloud: [255,208,170], ground: [184,160,112], starAlpha: 0 },
  // Night
  { skyTop: [11,11,43], skyBottom: [27,27,75],
    mount1: [21,21,48], mount2: [27,27,59],
    cloud: [51,51,85], ground: [59,53,48], starAlpha: 1 }
];

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function rgbStr(c) {
  return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
}

/** Return interpolated colours for the current score-based phase. */
function getDayNightColors(score) {
  var phase = (score % 40) / 40; // 0 → 1, repeating every 40 points
  var idx   = phase * 4;
  var from  = DAY_STAGES[Math.floor(idx) % 4];
  var to    = DAY_STAGES[(Math.floor(idx) + 1) % 4];
  var t     = idx - Math.floor(idx);

  // Smooth ease in-out
  t = t * t * (3 - 2 * t);

  return {
    skyTop:    rgbStr(lerpColor(from.skyTop,    to.skyTop,    t)),
    skyBottom: rgbStr(lerpColor(from.skyBottom, to.skyBottom, t)),
    mount1:    rgbStr(lerpColor(from.mount1,    to.mount1,    t)),
    mount2:    rgbStr(lerpColor(from.mount2,    to.mount2,    t)),
    cloud:     rgbStr(lerpColor(from.cloud,     to.cloud,     t)),
    ground:    rgbStr(lerpColor(from.ground,    to.ground,    t)),
    starAlpha: from.starAlpha + (to.starAlpha - from.starAlpha) * t
  };
}

// --------------- Parallax Helpers ---------------

/** Deterministic pseudo-random based on an integer seed. */
function pseudoRandom(n) {
  var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// --------------- Parallax Background ---------------

function drawParallaxBackground(ctx, width, height, scrollOffset, score) {
  var c = getDayNightColors(score);

  // Sky gradient
  var grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, c.skyTop);
  grad.addColorStop(1, c.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Stars (visible at night)
  if (c.starAlpha > 0) {
    drawStars(ctx, width, height, scrollOffset, c.starAlpha);
  }

  // Far mountains
  drawMountainLayer(ctx, width, height, scrollOffset * 0.1, 0.35, c.mount1);

  // Near mountains
  drawMountainLayer(ctx, width, height, scrollOffset * 0.2, 0.25, c.mount2);

  // Clouds
  drawCloudLayer(ctx, width, height, scrollOffset * 0.4, c.cloud);

  // Ground line
  ctx.fillStyle = c.ground;
  ctx.fillRect(0, height - 2, width, 2);
}

/** Draw twinkling stars scattered across the upper sky. */
function drawStars(ctx, width, height, scrollOffset, alpha) {
  ctx.fillStyle = "#FFF";
  for (var i = 0; i < 60; i++) {
    var sx = pseudoRandom(i * 3) * width;
    var sy = pseudoRandom(i * 3 + 1) * height * 0.5;
    var sz = 0.5 + pseudoRandom(i * 3 + 2) * 1.5;

    var twinkle = Math.sin(scrollOffset * 0.01 + i * 2.5) * 0.3 + 0.7;
    ctx.globalAlpha = alpha * twinkle;
    ctx.beginPath();
    ctx.arc(sx, sy, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Draw a procedural mountain silhouette that scrolls. */
function drawMountainLayer(ctx, width, height, offset, heightFactor, color) {
  var baseY = height * (1 - heightFactor);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);

  for (var x = 0; x <= width; x += 4) {
    var wx = x + offset;
    var h = Math.sin(wx * 0.004) * 40
          + Math.sin(wx * 0.009 + 1.3) * 25
          + Math.sin(wx * 0.017 + 2.7) * 15;
    ctx.lineTo(x, baseY + h);
  }

  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

/** Draw procedural clouds that scroll across the sky. */
function drawCloudLayer(ctx, width, height, offset, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5;

  var spacing = 300;
  var startX  = -(offset % spacing) - spacing;

  for (var cx = startX; cx < width + spacing; cx += spacing) {
    var seed = Math.floor((cx + offset) / spacing);
    var cy   = height * 0.1 + pseudoRandom(seed) * height * 0.2;
    var size = 20 + pseudoRandom(seed + 1) * 30;

    // Cloud = cluster of overlapping circles
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + size * 0.8, cy - size * 0.2, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - size * 0.6, cy + size * 0.1, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + size * 0.3, cy - size * 0.4, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// --------------- Dinosaur ---------------

function drawDino(ctx, player) {
  var x = player.x;
  var y = player.y;
  var w = player.width;
  var h = player.height;

  // Choose colours — white in angel mode (dead)
  var bodyCol, bellyCol, wFill, wEdge, mouthCol;
  if (player.isDead) {
    bodyCol  = "#FFFFFF";
    bellyCol = "#E8E8F0";
    wFill    = "#FFFFFF";
    wEdge    = "#DDDDEE";
    mouthCol = "#CCCCCC";
  } else {
    bodyCol  = DINO_BODY;
    bellyCol = DINO_BELLY;
    wFill    = WING_FILL;
    wEdge    = WING_EDGE;
    mouthCol = "#2E5A1E";
  }

  ctx.save();

  // --- Halo (angel mode only) ---
  if (player.isDead) {
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + 2, y - 6, 11, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Soft glow behind the halo
    ctx.strokeStyle = "rgba(255, 230, 100, 0.4)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + 2, y - 6, 11, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Wings (drawn behind the body) ---
  drawWing(ctx, x, y, player.wingAngle, wFill, wEdge);

  // --- Tail ---
  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.moveTo(x + 4,  y + 10);
  ctx.lineTo(x - 8,  y + 4);
  ctx.lineTo(x - 4,  y + 12);
  ctx.lineTo(x - 10, y + 8);
  ctx.lineTo(x + 4,  y + 18);
  ctx.closePath();
  ctx.fill();

  // --- Body (rounded rectangle) ---
  ctx.fillStyle = bodyCol;
  roundRect(ctx, x + 4, y + 6, w - 8, h - 10, 6);
  ctx.fill();

  // --- Belly highlight ---
  ctx.fillStyle = bellyCol;
  roundRect(ctx, x + 10, y + 14, w - 22, h - 22, 4);
  ctx.fill();

  // --- Head ---
  ctx.fillStyle = bodyCol;
  roundRect(ctx, x + w - 18, y, 18, 18, 5);
  ctx.fill();

  // --- Eye ---
  if (player.isDead) {
    // Peaceful closed eye (small arc)
    ctx.strokeStyle = "#AAAAAA";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 7, 2.5, Math.PI, 0);
    ctx.stroke();
  } else {
    // Glow red when laser is active
    if (player.laserActive) {
      ctx.fillStyle = "rgba(255, 60, 40, 0.5)";
      ctx.beginPath();
      ctx.arc(x + w - 8, y + 6, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = player.laserActive ? "#FF4433" : "#FFF";
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (!player.laserActive) {
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x + w - 7, y + 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Mouth ---
  if (!player.isDead && player.mouthOpen) {
    ctx.fillStyle = "#C0392B";
    ctx.fillRect(x + w - 12, y + 13, 10, 3);
  } else {
    ctx.strokeStyle = mouthCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w - 12, y + 14);
    ctx.lineTo(x + w - 2,  y + 14);
    ctx.stroke();
  }

  // --- Tiny arm ---
  ctx.strokeStyle = bodyCol;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w - 12, y + 20);
  ctx.lineTo(x + w - 6,  y + 25);
  ctx.stroke();

  // --- Legs ---
  ctx.fillStyle = bodyCol;
  ctx.fillRect(x + 10, y + h - 6, 5, 6);
  ctx.fillRect(x + 20, y + h - 6, 5, 6);

  // --- Shield bubble (when power-up active) ---
  if (!player.isDead && player.shieldTimer > 0) {
    ctx.strokeStyle = "#44AAFF";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4 + Math.sin(player.frameCount * 0.2) * 0.2;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.max(w, h) * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// --------------- Wings ---------------

/**
 * Draw two wings on the dino's back.  The angle oscillates so they
 * appear to flap.  Colour parameters allow angel-mode white wings.
 */
function drawWing(ctx, dinoX, dinoY, angle, fillColor, edgeColor) {
  var pivotX = dinoX + 10;
  var pivotY = dinoY + 8;

  // --- Back wing (further from camera, slightly smaller & dimmer) ---
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle + 0.15);
  ctx.fillStyle = edgeColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-10, -22, -4, -28);
  ctx.quadraticCurveTo(2,  -18, 4, -8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- Front wing ---
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-14, -24, -6, -32);
  ctx.quadraticCurveTo(2,  -20,  5, -8);
  ctx.closePath();
  ctx.fill();

  // Membrane lines
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(-8, -18, -4, -26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, -1);
  ctx.quadraticCurveTo(-4, -14, -1, -22);
  ctx.stroke();
  ctx.restore();
}

// --------------- Laser Beam ---------------

function drawLaser(ctx, player) {
  var eye = player.getEyePosition();
  var endX = player.laserEndX;
  var beamY = player.laserY;

  // Fade the beam out as the timer runs down
  var alpha = Math.min(1, player.laserTimer / 6);

  // Outer glow (wide, semi-transparent)
  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.strokeStyle = "#FF2200";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(eye.x, beamY);
  ctx.lineTo(endX, beamY);
  ctx.stroke();

  // Core beam (bright, narrow)
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#FF6644";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(eye.x, beamY);
  ctx.lineTo(endX, beamY);
  ctx.stroke();

  // White-hot centre
  ctx.strokeStyle = "#FFDDCC";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(eye.x, beamY);
  ctx.lineTo(endX, beamY);
  ctx.stroke();

  // Impact flash at the hit point (only if beam didn't reach edge)
  if (endX < player.canvasWidth - 1) {
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = "#FFFF80";
    ctx.beginPath();
    ctx.arc(endX, beamY, 8 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = "#FF8844";
    ctx.beginPath();
    ctx.arc(endX, beamY, 14 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// --------------- Cooldown Indicator ---------------

/** Small bar under the dino showing laser cooldown. */
function drawCooldownBar(ctx, player) {
  if (player.laserCooldown <= 0) return;  // ready — nothing to show

  var maxCD = player.rapidTimer > 0 ? LASER_COOLDOWN * 0.3 : LASER_COOLDOWN;
  var barW = player.width;
  var barH = 3;
  var barX = player.x;
  var barY = player.y + player.height + 4;
  var pct  = 1 - (player.laserCooldown / maxCD);

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(barX, barY, barW, barH);

  // Fill
  ctx.fillStyle = pct < 1 ? "#FF6644" : "#44FF44";
  ctx.fillRect(barX, barY, barW * pct, barH);
}

// --------------- Obstacles (Cactus Pairs) ---------------

function drawObstacles(ctx, obstacleManager) {
  var list = obstacleManager.obstacles;

  for (var i = 0; i < list.length; i++) {
    var obs = list[i];
    drawCactus(ctx, obs.x, 0,            obs.width, obs.gapTop,    true,  obs.holes);
    drawCactus(ctx, obs.x, obs.gapBottom, obs.width,
               obstacleManager.canvasHeight - obs.gapBottom, false, obs.holes);
    drawFlowers(ctx, obs, obstacleManager.canvasHeight);
  }
}

/** Draw all falling debris pieces (cactus chunks and knocked-off flowers). */
function drawDebris(ctx, obstacleManager) {
  var debris = obstacleManager.debris;

  for (var i = 0; i < debris.length; i++) {
    var d = debris[i];
    ctx.save();

    if (d.isFlower) {
      // --- Falling flower ---
      ctx.translate(d.x, d.y);
      ctx.rotate(d.currentRotation);
      drawFlowerShape(ctx, 0, 0, d.flowerColor, d.flowerRadius);
    } else {
      // --- Cactus chunk with all its decorations ---
      var cx = d.x + d.width / 2;
      var cy = d.y + d.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(d.currentRotation);
      ctx.translate(-cx, -cy);

      var stemInset = 10;
      var stemX = d.x + stemInset;
      var stemW = d.width - stemInset * 2;

      // Stem
      ctx.fillStyle = CACTUS_DARK;
      ctx.fillRect(stemX, d.y, stemW, d.height);
      ctx.fillStyle = CACTUS_LIGHT;
      ctx.fillRect(stemX + 3, d.y, 5, d.height);
      ctx.fillStyle = CACTUS_MID;
      ctx.fillRect(stemX + stemW - 7, d.y, 3, d.height);

      // Cut edges
      ctx.fillStyle = "#5C3A1E";
      ctx.fillRect(stemX, d.y, stemW, 2);
      ctx.fillRect(stemX, d.y + d.height - 2, stemW, 2);

      // Spines
      ctx.strokeStyle = "#1B4510";
      ctx.lineWidth = 1;
      for (var sy = d.y + 8; sy < d.y + d.height - 4; sy += 18) {
        ctx.beginPath();
        ctx.moveTo(stemX, sy);
        ctx.lineTo(stemX - 3, sy - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(stemX + stemW, sy + 6);
        ctx.lineTo(stemX + stemW + 3, sy + 4);
        ctx.stroke();
      }

      // Arms
      if (d.arms) {
        var tipDir = d.isFlipped ? 1 : -1;
        for (var a = 0; a < d.arms.length; a++) {
          var arm  = d.arms[a];
          var armY = d.y + arm.relY;
          var armLen = 10;
          var tipH   = 16;

          ctx.fillStyle = CACTUS_DARK;
          if (arm.side === -1) {
            ctx.fillRect(stemX - armLen, armY - 3, armLen, 7);
            var tipX = stemX - armLen - 1;
            var tipY = (tipDir === -1) ? armY - tipH : armY;
            ctx.fillRect(tipX, tipY, 6, tipH);
            ctx.fillStyle = CACTUS_LIGHT;
            ctx.fillRect(tipX + 1, tipY, 2, tipH);
          } else {
            var rightEdge = stemX + stemW;
            ctx.fillRect(rightEdge, armY - 3, armLen, 7);
            var tipX2 = rightEdge + armLen - 5;
            var tipY2 = (tipDir === -1) ? armY - tipH : armY;
            ctx.fillRect(tipX2, tipY2, 6, tipH);
            ctx.fillStyle = CACTUS_LIGHT;
            ctx.fillRect(tipX2 + 1, tipY2, 2, tipH);
          }
        }
      }

      // Flowers
      if (d.flowers) {
        for (var f = 0; f < d.flowers.length; f++) {
          var fl = d.flowers[f];
          drawFlowerShape(ctx, d.x + fl.offsetX, d.y + fl.relY,
                          fl.color, fl.radius);
        }
      }
    }

    ctx.restore();
  }
}

// --------------- Flowers ---------------

/** Draw all non-fallen flowers on a single obstacle. */
function drawFlowers(ctx, obs, canvasHeight) {
  for (var i = 0; i < obs.flowers.length; i++) {
    var f = obs.flowers[i];
    if (f.fallen) continue;

    // Only draw if the flower sits on a solid cactus segment
    var segs;
    if (f.isTop) {
      segs = getSolidSegments(0, obs.gapTop, obs.holes);
    } else {
      segs = getSolidSegments(obs.gapBottom, canvasHeight, obs.holes);
    }
    if (!isYInSegments(f.y, segs)) continue;

    drawFlowerShape(ctx, obs.x + f.offsetX, f.y, f.color, f.radius);
  }
}

/** Draw a single flower (5 petals + yellow centre) at the given position. */
function drawFlowerShape(ctx, x, y, color, radius) {
  // Petals
  ctx.fillStyle = color;
  var petalR = radius * 0.5;
  for (var p = 0; p < 5; p++) {
    var angle = (p / 5) * Math.PI * 2 - Math.PI / 2;
    var px = x + Math.cos(angle) * radius * 0.55;
    var py = y + Math.sin(angle) * radius * 0.55;
    ctx.beginPath();
    ctx.arc(px, py, petalR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Yellow centre
  ctx.fillStyle = "#FFFFAA";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a single cactus (top or bottom half of a pair).
 *
 * @param {boolean} flipped  true = hanging from the ceiling (upside-down)
 * @param {Array}   holes    laser-carved holes [{y, height}, ...]
 */
function drawCactus(ctx, x, y, w, h, flipped, holes) {
  if (h <= 0) return;

  // Break the cactus into solid segments (skip laser holes)
  var segments = getSolidSegments(y, y + h, holes || []);
  if (segments.length === 0) return;

  var stemInset = 10;
  var stemX = x + stemInset;
  var stemW = w - stemInset * 2;

  // --- Draw each solid segment as a cactus trunk piece ---
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (seg.height <= 0) continue;

    // Main stem
    ctx.fillStyle = CACTUS_DARK;
    ctx.fillRect(stemX, seg.y, stemW, seg.height);

    // Light stripe (left-of-centre highlight)
    ctx.fillStyle = CACTUS_LIGHT;
    ctx.fillRect(stemX + 3, seg.y, 5, seg.height);

    // Subtle right highlight
    ctx.fillStyle = CACTUS_MID;
    ctx.fillRect(stemX + stemW - 7, seg.y, 3, seg.height);
  }

  // --- Rounded cap at the gap-side end ---
  var capH = 12;
  var capY = flipped ? (y + h - capH) : y;
  if (isYRangeInSegments(capY, capY + capH, segments)) {
    ctx.fillStyle = CACTUS_DARK;
    roundRect(ctx, x + 3, capY, w - 6, capH, 5);
    ctx.fill();
    // Highlight on cap
    ctx.fillStyle = CACTUS_LIGHT;
    ctx.fillRect(x + 7, capY + 2, 5, capH - 4);
  }

  // --- Arms (small branches sticking out left and right) ---
  drawCactusArms(ctx, x, y, w, h, stemX, stemW, flipped, segments);

  // --- Spines (tiny marks along the edges) ---
  drawCactusSpines(ctx, stemX, stemW, segments);
}

/**
 * Draw 1–2 arms branching off the cactus if there is enough height.
 */
function drawCactusArms(ctx, x, y, w, h, stemX, stemW, flipped, segments) {
  if (h < 90) return; // too short for arms

  var arms = [
    { side: -1, relPos: 0.30 },
    { side:  1, relPos: 0.62 }
  ];

  for (var a = 0; a < arms.length; a++) {
    var arm = arms[a];

    var armY;
    if (flipped) {
      armY = y + h * arm.relPos;
    } else {
      armY = y + h * (1 - arm.relPos);
    }

    if (!isYRangeInSegments(armY - 5, armY + 5, segments)) continue;

    var armLen = 10;
    var tipH   = 16;
    var tipDir = flipped ? 1 : -1;

    ctx.fillStyle = CACTUS_DARK;

    if (arm.side === -1) {
      ctx.fillRect(stemX - armLen, armY - 3, armLen, 7);
      var tipX = stemX - armLen - 1;
      var tipY = (tipDir === -1) ? armY - tipH : armY;
      ctx.fillRect(tipX, tipY, 6, tipH);
      ctx.fillStyle = CACTUS_LIGHT;
      ctx.fillRect(tipX + 1, tipY, 2, tipH);
    } else {
      var rightEdge = stemX + stemW;
      ctx.fillRect(rightEdge, armY - 3, armLen, 7);
      var tipX2 = rightEdge + armLen - 5;
      var tipY2 = (tipDir === -1) ? armY - tipH : armY;
      ctx.fillRect(tipX2, tipY2, 6, tipH);
      ctx.fillStyle = CACTUS_LIGHT;
      ctx.fillRect(tipX2 + 1, tipY2, 2, tipH);
    }
  }
}

/** Draw small spine marks along the cactus edges. */
function drawCactusSpines(ctx, stemX, stemW, segments) {
  ctx.strokeStyle = "#1B4510";
  ctx.lineWidth = 1;

  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    for (var sy = seg.y + 8; sy < seg.y + seg.height - 4; sy += 18) {
      ctx.beginPath();
      ctx.moveTo(stemX, sy);
      ctx.lineTo(stemX - 3, sy - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(stemX + stemW, sy + 6);
      ctx.lineTo(stemX + stemW + 3, sy + 4);
      ctx.stroke();
    }
  }
}

// --------------- Particles ---------------

function drawParticles(ctx, particleManager) {
  var parts = particleManager.particles;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    ctx.save();
    if (p.type === "text") {
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.textColor;
      ctx.strokeStyle = "#000";
      ctx.lineWidth   = 2;
      ctx.font        = "bold 18px monospace";
      ctx.textAlign   = "center";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = "rgb(" + p.r + "," + p.g + "," + p.b + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// --------------- Power-Ups ---------------

function drawPowerUps(ctx, powerUpManager) {
  var list = powerUpManager.powerups;
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    ctx.save();

    // Glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size + 4, 0, Math.PI * 2);
    ctx.fill();

    // Solid circle
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    // Symbol
    ctx.fillStyle = "#FFF";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.symbol, p.x, p.y);

    ctx.restore();
  }
}

/** Show small indicators for active power-ups (top-left). */
function drawActivePowerUps(ctx, player) {
  var indicators = [];
  if (player.shieldTimer > 0) indicators.push({ label: "SHIELD", color: "#44AAFF" });
  if (player.slowTimer   > 0) indicators.push({ label: "SLOW",   color: "#AA44FF" });
  if (player.rapidTimer  > 0) indicators.push({ label: "RAPID",  color: "#FF4444" });

  ctx.save();
  ctx.font      = "bold 14px monospace";
  ctx.textAlign = "left";
  for (var i = 0; i < indicators.length; i++) {
    var ind = indicators[i];
    var y   = 70 + i * 22;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle   = ind.color;
    ctx.strokeStyle = "#000";
    ctx.lineWidth   = 2;
    ctx.strokeText(ind.label, 10, y);
    ctx.fillText(ind.label, 10, y);
  }
  ctx.restore();
}

// --------------- Combo Display ---------------

function drawCombo(ctx, comboCount, width) {
  ctx.save();
  ctx.fillStyle   = "#FF4444";
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 2;
  ctx.font        = "bold 20px monospace";
  ctx.textAlign   = "center";
  ctx.strokeText("COMBO x" + comboCount, width / 2, 80);
  ctx.fillText("COMBO x" + comboCount, width / 2, 80);
  ctx.restore();
}

// --------------- Score ---------------

function drawScore(ctx, score, canvasWidth) {
  ctx.fillStyle   = "#FFF";
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 3;
  ctx.font        = "bold 32px monospace";
  ctx.textAlign   = "center";
  ctx.strokeText(score, canvasWidth / 2, 50);
  ctx.fillText(score,   canvasWidth / 2, 50);
}

// --------------- Screens ---------------

function drawStartScreen(ctx, width, height, highScores) {
  ctx.fillStyle   = "#FFF";
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 3;
  ctx.textAlign   = "center";

  ctx.font = "bold 36px monospace";
  ctx.strokeText("Flappy Dinosaur", width / 2, height / 3);
  ctx.fillText("Flappy Dinosaur",   width / 2, height / 3);

  // High score table between title and controls
  var tableY = height / 3 + 30;
  var tableBottom = drawHighScoreTable(ctx, width / 2, tableY, highScores, -1);

  var controlsY = Math.max(tableBottom + 20, height / 2 - 10);
  ctx.font = "18px monospace";
  ctx.fillStyle   = "#FFF";
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 3;
  ctx.strokeText("S or SPACE to start (tap on mobile)", width / 2, controlsY);
  ctx.fillText("S or SPACE to start (tap on mobile)",   width / 2, controlsY);
  ctx.strokeText("SPACE to flap, L to laser, P to pause", width / 2, controlsY + 30);
  ctx.fillText("SPACE to flap, L to laser, P to pause",   width / 2, controlsY + 30);
}

function drawGameOverScreen(ctx, width, height, score,
                            enteringInitials, initials, highScores, newScoreIndex) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle   = "#FFF";
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 3;
  ctx.textAlign   = "center";

  ctx.font = "bold 36px monospace";
  ctx.strokeText("Game Over", width / 2, height / 3);
  ctx.fillText("Game Over",   width / 2, height / 3);

  ctx.font = "24px monospace";
  ctx.strokeText("Score: " + score, width / 2, height / 3 + 50);
  ctx.fillText("Score: " + score,   width / 2, height / 3 + 50);

  var nextY = height / 3 + 80;

  if (enteringInitials) {
    // Prompt for initials
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#FFD700";
    ctx.strokeText("NEW HIGH SCORE!", width / 2, nextY);
    ctx.fillText("NEW HIGH SCORE!",   width / 2, nextY);
    nextY += 35;

    // Show initials slots: filled letters + underscores
    var display = "";
    for (var i = 0; i < 3; i++) {
      if (i > 0) display += " ";
      display += i < initials.length ? initials.charAt(i) : "_";
    }
    ctx.font = "bold 28px monospace";
    ctx.fillStyle = "#FFF";
    ctx.strokeText(display, width / 2, nextY);
    ctx.fillText(display,   width / 2, nextY);
    nextY += 15;
  } else {
    // Show high score table
    nextY = drawHighScoreTable(ctx, width / 2, nextY, highScores, newScoreIndex);
    nextY += 20;

    ctx.font = "18px monospace";
    ctx.fillStyle   = "#FFF";
    ctx.strokeStyle = "#000";
    ctx.lineWidth   = 3;
    ctx.strokeText("S / SPACE / tap to retry",          width / 2, nextY);
    ctx.fillText("S / SPACE / tap to retry",            width / 2, nextY);
    ctx.strokeText("SPACE to flap, L to laser, P to pause", width / 2, nextY + 30);
    ctx.fillText("SPACE to flap, L to laser, P to pause",   width / 2, nextY + 30);
  }
}

// --------------- Pause Screen ---------------

function drawPauseScreen(ctx, width, height) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle   = "#FFF";
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 3;
  ctx.textAlign   = "center";

  ctx.font = "bold 36px monospace";
  ctx.strokeText("PAUSED", width / 2, height / 2);
  ctx.fillText("PAUSED",   width / 2, height / 2);

  ctx.font = "18px monospace";
  ctx.strokeText("P or ESC to resume", width / 2, height / 2 + 40);
  ctx.fillText("P or ESC to resume",   width / 2, height / 2 + 40);
}

// --------------- High Score Table ---------------

/**
 * Draw the top-10 high score table centred at (cx, startY).
 * highlightIdx highlights the row of a newly-entered score (-1 = none).
 * Returns the Y position just below the last row.
 */
function drawHighScoreTable(ctx, cx, startY, highScores, highlightIdx) {
  if (highScores.length === 0) return startY;

  var lineH = 24;
  var headerY = startY + lineH;

  ctx.textAlign   = "center";
  ctx.fillStyle   = "#FFD700";
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 2;
  ctx.font        = "bold 16px monospace";
  ctx.strokeText("HIGH SCORES", cx, headerY);
  ctx.fillText("HIGH SCORES",   cx, headerY);

  ctx.font = "14px monospace";
  var y = headerY + lineH;

  for (var i = 0; i < highScores.length; i++) {
    var entry = highScores[i];
    var rank  = (i + 1) + ".";
    var line  = padStart(rank, 3) + " " + entry.name + " " + padStart("" + entry.score, 5);

    if (i === highlightIdx) {
      ctx.fillStyle = "#FFD700";
    } else {
      ctx.fillStyle = "#FFF";
    }
    ctx.strokeText(line, cx, y);
    ctx.fillText(line,   cx, y);
    y += lineH;
  }

  return y;
}

/** Left-pad a string with spaces to the given length. */
function padStart(str, len) {
  while (str.length < len) str = " " + str;
  return str;
}

// --------------- Mobile UI: Laser Button ---------------

function getLaserButtonLayout(width, height) {
  return { cx: width - 50, cy: height - 60, radius: 30 };
}

function drawLaserButton(ctx, width, height, player) {
  var btn = getLaserButtonLayout(width, height);
  ctx.save();

  var ready = player.laserCooldown <= 0 && !player.laserActive;
  ctx.globalAlpha = ready ? 0.6 : 0.25;

  ctx.fillStyle = "#FF4444";
  ctx.beginPath();
  ctx.arc(btn.cx, btn.cy, btn.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = ready ? 0.95 : 0.4;
  ctx.fillStyle = "#FFF";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("L", btn.cx, btn.cy);

  ctx.restore();
}

// --------------- Mobile UI: Letter Picker ---------------

function getLetterPickerLayout(width, height) {
  var cellSize = Math.min(40, Math.floor((width - 20) / 9));
  var cols = 9;
  var gridW = cols * cellSize;
  var startX = Math.floor((width - gridW) / 2);
  var startY = Math.floor(height / 3 + 145);
  return {
    cellSize: cellSize,
    cols: cols,
    startX: startX,
    startY: startY,
    letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  };
}

function drawLetterPicker(ctx, width, height) {
  var lp = getLetterPickerLayout(width, height);
  var cs = lp.cellSize;

  for (var i = 0; i < 26; i++) {
    var col = i % lp.cols;
    var row = Math.floor(i / lp.cols);
    var x = lp.startX + col * cs;
    var y = lp.startY + row * cs;

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, x + 2, y + 2, cs - 4, cs - 4, 4);
    ctx.fill();

    ctx.fillStyle = "#FFF";
    ctx.font = "bold " + Math.floor(cs * 0.45) + "px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lp.letters[i], x + cs / 2, y + cs / 2);
  }

  // DEL button after Z (col 8, row 2)
  var delX = lp.startX + 8 * cs;
  var delY = lp.startY + 2 * cs;
  ctx.fillStyle = "rgba(255,100,100,0.25)";
  roundRect(ctx, delX + 2, delY + 2, cs - 4, cs - 4, 4);
  ctx.fill();
  ctx.fillStyle = "#FF8888";
  ctx.font = "bold " + Math.floor(cs * 0.35) + "px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DEL", delX + cs / 2, delY + cs / 2);
}

// --------------- Canvas Helpers ---------------

/** Begin a rounded-rectangle sub-path (caller must fill/stroke). */
function roundRect(ctx, x, y, w, h, r) {
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
