/*
 * particles.js — Lightweight particle system for visual effects.
 *
 * Supports two kinds of particles:
 *   "circle" — small coloured dots (dust, sparks)
 *   "text"   — floating text that fades out (score popups, combo labels)
 */

function ParticleManager() {
  this.particles = [];
}

/** Puff of dust behind the dino when she flaps. */
ParticleManager.prototype.addDust = function (x, y) {
  for (var i = 0; i < 5; i++) {
    this.particles.push({
      type: "circle",
      x: x,
      y: y,
      vx: (Math.random() - 0.7) * 3,
      vy: (Math.random() - 0.5) * 2,
      life: 1,
      decay: 0.03 + Math.random() * 0.02,
      size: 2 + Math.random() * 3,
      r: 194, g: 178, b: 128
    });
  }
};

/** Bright sparks at a laser impact point. */
ParticleManager.prototype.addSparks = function (x, y) {
  for (var i = 0; i < 8; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 2 + Math.random() * 4;
    this.particles.push({
      type: "circle",
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.04 + Math.random() * 0.03,
      size: 1.5 + Math.random() * 2,
      r: 255, g: 200, b: 50
    });
  }
};

/** Floating text label (e.g. "+1", "COMBO x3"). */
ParticleManager.prototype.addScorePopup = function (x, y, text, color) {
  this.particles.push({
    type: "text",
    x: x,
    y: y,
    vx: 0,
    vy: -1.5,
    life: 1,
    decay: 0.015,
    text: text,
    textColor: color || "#FFF"
  });
};

/** Advance every particle by dt frames. Remove dead ones. */
ParticleManager.prototype.update = function (dt) {
  for (var i = this.particles.length - 1; i >= 0; i--) {
    var p = this.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= p.decay * dt;

    if (p.type === "circle") {
      p.vy += 0.05 * dt; // slight gravity on dots
    }

    if (p.life <= 0) {
      this.particles.splice(i, 1);
    }
  }
};

/** Wipe all particles (used on game reset). */
ParticleManager.prototype.reset = function () {
  this.particles = [];
};
