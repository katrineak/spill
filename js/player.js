/*
 * player.js — The dinosaur the player controls.
 *
 * The dino is affected by gravity every frame and moves upward when the
 * player "flaps" (presses Space or clicks/taps).  She can also shoot a
 * laser beam from her eyes with the L key.
 *
 * All physics use delta-time (dt) so the game runs consistently across
 * different refresh rates.
 */

// --------------- Constants ---------------

var DINO_WIDTH  = 40;
var DINO_HEIGHT = 36;
var GRAVITY     = 0.45;   // pixels/frame² — pulls the dino down
var FLAP_FORCE  = -7.5;   // negative = upward

// Laser settings
var LASER_DURATION = 14;  // frames the beam stays visible
var LASER_COOLDOWN = 40;  // frames between shots

// --------------- Constructor ---------------

function Player(canvasWidth, canvasHeight) {
  // Start roughly centred on screen
  this.x      = canvasWidth * 0.2;
  this.y      = canvasHeight / 2;
  this.width  = DINO_WIDTH;
  this.height = DINO_HEIGHT;

  // Physics
  this.velocityY = 0;

  // Boundaries
  this.canvasWidth  = canvasWidth;
  this.canvasHeight = canvasHeight;

  // Simple animation: the dino's mouth opens and closes
  this.mouthOpen  = false;
  this.frameCount = 0;

  // Wing animation — angle oscillates over time
  this.wingAngle = 0;

  // Death / angel state
  this.isDead = false;

  // Laser state
  this.laserActive   = false;
  this.laserTimer    = 0;     // counts down to zero while beam is visible
  this.laserCooldown = 0;     // counts down to zero before next shot
  this.laserEndX     = canvasWidth; // X where the beam terminates
  this.laserY        = 0;          // Y position of the beam

  // Power-up timers (frames remaining)
  this.shieldTimer = 0;
  this.slowTimer   = 0;
  this.rapidTimer  = 0;
}

// --------------- Methods ---------------

/** Apply gravity, animate, and tick timers.  Called once per frame. */
Player.prototype.update = function (dt) {
  this.velocityY += GRAVITY * dt;
  this.y += this.velocityY * dt;

  // Don't fall below the ground
  if (this.y + this.height > this.canvasHeight) {
    this.y = this.canvasHeight - this.height;
    this.velocityY = 0;
  }

  // Don't fly above the ceiling
  if (this.y < 0) {
    this.y = 0;
    this.velocityY = 0;
  }

  this.frameCount += dt;

  // Mouth animation — toggle every ~8 frames
  this.mouthOpen = (Math.floor(this.frameCount / 8) % 2 === 1);

  // Wing animation — flap faster when the dino is rising
  if (this.velocityY < -2) {
    this.wingAngle = Math.sin(this.frameCount * 0.5) * 0.7;
  } else {
    this.wingAngle = Math.sin(this.frameCount * 0.12) * 0.4 + 0.3;
  }

  // Laser cooldown tick
  if (this.laserCooldown > 0) {
    this.laserCooldown -= dt;
    if (this.laserCooldown < 0) this.laserCooldown = 0;
  }
  if (this.laserTimer > 0) {
    this.laserTimer -= dt;
    if (this.laserTimer <= 0) {
      this.laserTimer = 0;
      this.laserActive = false;
    }
  }

  // Power-up timers
  if (this.shieldTimer > 0) this.shieldTimer -= dt;
  if (this.slowTimer   > 0) this.slowTimer   -= dt;
  if (this.rapidTimer  > 0) this.rapidTimer  -= dt;
};

/** Flap! Makes the dino jump upward. */
Player.prototype.flap = function () {
  this.velocityY = FLAP_FORCE;
};

/**
 * Try to fire the laser.
 * Returns true if the laser was fired, false if still on cooldown.
 */
Player.prototype.shootLaser = function () {
  if (this.laserCooldown > 0 || this.laserActive) {
    return false;
  }

  this.laserActive   = true;
  this.laserTimer    = LASER_DURATION;
  this.laserCooldown = this.rapidTimer > 0 ? LASER_COOLDOWN * 0.3 : LASER_COOLDOWN;

  var eye = this.getEyePosition();
  this.laserY    = eye.y;
  this.laserEndX = this.canvasWidth; // default: beam reaches the edge

  return true;
};

/** Return the pixel position of the dino's eye (laser origin). */
Player.prototype.getEyePosition = function () {
  return {
    x: this.x + this.width - 7,
    y: this.y + 6
  };
};

/** Activate a collected power-up. */
Player.prototype.applyPowerUp = function (type, duration) {
  if (type === "shield") this.shieldTimer = duration;
  else if (type === "slow") this.slowTimer = duration;
  else if (type === "rapid") this.rapidTimer = duration;
};

/** Called once when the dino dies — begins the angel animation. */
Player.prototype.die = function () {
  this.isDead    = true;
  this.velocityY = 0;  // brief pause before floating upward
};

/** Animate the dead dino: gently float up like an angel. */
Player.prototype.updateDead = function (dt) {
  // Slowly accelerate upward to a max float speed
  this.velocityY -= 0.05 * dt;
  if (this.velocityY < -1.5) this.velocityY = -1.5;
  this.y += this.velocityY * dt;

  // Gentle, slow wing oscillation
  this.frameCount += dt;
  this.wingAngle = Math.sin(this.frameCount * 0.06) * 0.5;
};

/** Return a slightly-shrunken rectangle used for collision checks. */
Player.prototype.getHitbox = function () {
  var shrink = 4; // pixels of forgiveness on each side
  return {
    x:      this.x + shrink,
    y:      this.y + shrink,
    width:  this.width  - shrink * 2,
    height: this.height - shrink * 2
  };
};
