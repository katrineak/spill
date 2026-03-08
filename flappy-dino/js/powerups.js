/*
 * powerups.js — Collectible power-ups that spawn in obstacle gaps.
 *
 * Types:
 *   shield — temporary invincibility (blue bubble)
 *   slow   — obstacles move at half speed (purple)
 *   rapid  — laser cooldown reduced to 30 % (red)
 */

var POWERUP_TYPES = [
  { type: "shield", color: "#44AAFF", symbol: "\u25CB", duration: 300 },
  { type: "slow",   color: "#AA44FF", symbol: "\u223C", duration: 240 },
  { type: "rapid",  color: "#FF4444", symbol: "\u00BB", duration: 200 }
];

var POWERUP_SIZE = 12;
var POWERUP_SPAWN_CHANCE = 0.25; // 25 % chance per obstacle

// --------------- Constructor ---------------

function PowerUpManager(canvasWidth, canvasHeight) {
  this.canvasWidth  = canvasWidth;
  this.canvasHeight = canvasHeight;
  this.powerups     = [];
}

// --------------- Methods ---------------

/** Maybe spawn a power-up in the gap of a newly-created obstacle. */
PowerUpManager.prototype.trySpawn = function (x, gapTop, gapBottom) {
  if (Math.random() > POWERUP_SPAWN_CHANCE) return;

  var typeInfo  = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  var gapCenter = (gapTop + gapBottom) / 2;

  this.powerups.push({
    x:        x,
    y:        gapCenter,
    baseY:    gapCenter,
    type:     typeInfo.type,
    color:    typeInfo.color,
    symbol:   typeInfo.symbol,
    duration: typeInfo.duration,
    size:     POWERUP_SIZE,
    bobPhase: Math.random() * Math.PI * 2,
    age:      0
  });
};

/** Move power-ups left and bob them up and down. */
PowerUpManager.prototype.update = function (dt, speed) {
  for (var i = this.powerups.length - 1; i >= 0; i--) {
    var p = this.powerups[i];
    p.x  -= speed * dt;
    p.age += dt;
    p.y   = p.baseY + Math.sin(p.bobPhase + p.age * 0.08) * 8;

    if (p.x + p.size < -10) {
      this.powerups.splice(i, 1);
    }
  }
};

/** Check whether the player hitbox overlaps any power-up. */
PowerUpManager.prototype.checkCollision = function (hitbox) {
  for (var i = this.powerups.length - 1; i >= 0; i--) {
    var p = this.powerups[i];
    if (
      hitbox.x < p.x + p.size &&
      hitbox.x + hitbox.width  > p.x - p.size &&
      hitbox.y < p.y + p.size &&
      hitbox.y + hitbox.height > p.y - p.size
    ) {
      return this.powerups.splice(i, 1)[0];
    }
  }
  return null;
};

/** Clear all power-ups (used on game reset). */
PowerUpManager.prototype.reset = function () {
  this.powerups = [];
};
