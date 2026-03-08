/*
 * sounds.js — Procedural sound effects using the Web Audio API.
 *
 * The AudioContext is created lazily on the first user interaction
 * to comply with browser autoplay policies.
 */

var audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Short upward chirp — played on every flap / jump. */
function playFlapSound() {
  var ctx = getAudioCtx();
  var t   = ctx.currentTime;

  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.linearRampToValueAtTime(600, t + 0.08);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.1);
}

/** Descending electric zap — played when the laser fires. */
function playLaserSound() {
  var ctx = getAudioCtx();
  var t   = ctx.currentTime;

  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);

  gain.gain.setValueAtTime(0.12, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.18);
}

/** Soft pop / chime — played when a laser hits a flower. */
function playFlowerHitSound() {
  var ctx = getAudioCtx();
  var t   = ctx.currentTime;

  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.2);
}

/** Crunchy thud — played when a laser carves into a cactus. */
function playCactusHitSound() {
  var ctx = getAudioCtx();
  var t   = ctx.currentTime;

  // Noise burst for crunch
  var bufferSize = ctx.sampleRate * 0.12;
  var buffer     = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  var data       = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }

  var noise = ctx.createBufferSource();
  noise.buffer = buffer;

  var noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.18, t);
  noiseGain.gain.linearRampToValueAtTime(0, t + 0.12);

  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // Low thud underneath
  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);

  gain.gain.setValueAtTime(0.2, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  noise.start(t);
  osc.start(t);
  osc.stop(t + 0.15);
}

/** Sad descending tone — played when the dino dies. */
function playDeathSound() {
  var ctx = getAudioCtx();
  var t   = ctx.currentTime;

  // Descending wail
  var osc1  = ctx.createOscillator();
  var gain1 = ctx.createGain();

  osc1.type = "square";
  osc1.frequency.setValueAtTime(500, t);
  osc1.frequency.exponentialRampToValueAtTime(80, t + 0.5);

  gain1.gain.setValueAtTime(0.1, t);
  gain1.gain.linearRampToValueAtTime(0.08, t + 0.2);
  gain1.gain.linearRampToValueAtTime(0, t + 0.5);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  // Noise crackle layered on top
  var bufferSize = ctx.sampleRate * 0.3;
  var buffer     = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  var data       = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
  }

  var noise     = ctx.createBufferSource();
  noise.buffer  = buffer;
  var noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.12, t);
  noiseGain.gain.linearRampToValueAtTime(0, t + 0.3);

  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  osc1.start(t);
  osc1.stop(t + 0.5);
  noise.start(t);
}

/** Sad music-box melody — plays while the angel floats upward. */
function playAngelMelody() {
  var ctx = getAudioCtx();
  var t   = ctx.currentTime + 0.5; // start after the death sound fades

  // D minor descending melody (frequencies in Hz)
  var notes = [
    { freq: 587.33, dur: 0.4 },  // D5
    { freq: 523.25, dur: 0.4 },  // C5
    { freq: 466.16, dur: 0.6 },  // Bb4
    { freq: 440.00, dur: 0.4 },  // A4
    { freq: 392.00, dur: 0.4 },  // G4
    { freq: 349.23, dur: 0.6 },  // F4
    { freq: 329.63, dur: 0.4 },  // E4
    { freq: 293.66, dur: 1.0 }   // D4 (long final note)
  ];

  var offset = 0;

  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    var noteStart = t + offset;

    // Main tone (soft sine)
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(note.freq, noteStart);

    // Each note fades in gently and decays
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(0.1, noteStart + 0.03);
    gain.gain.linearRampToValueAtTime(0.07, noteStart + note.dur * 0.5);
    gain.gain.linearRampToValueAtTime(0, noteStart + note.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(noteStart);
    osc.stop(noteStart + note.dur);

    // Octave-up shimmer for a music-box feel
    var osc2  = ctx.createOscillator();
    var gain2 = ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(note.freq * 2, noteStart);

    gain2.gain.setValueAtTime(0, noteStart);
    gain2.gain.linearRampToValueAtTime(0.03, noteStart + 0.03);
    gain2.gain.linearRampToValueAtTime(0, noteStart + note.dur * 0.7);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(noteStart);
    osc2.stop(noteStart + note.dur);

    offset += note.dur;
  }
}

// --------------- New sounds ---------------

/** Quick high pling — played when the player scores a point. */
function playScoreSound() {
  var ctx = getAudioCtx();
  var t   = ctx.currentTime;

  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.linearRampToValueAtTime(1100, t + 0.05);

  gain.gain.setValueAtTime(0.08, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.08);
}

/** Cheerful ascending arpeggio — played when a power-up is collected. */
function playPowerUpSound() {
  var ctx   = getAudioCtx();
  var t     = ctx.currentTime;
  var notes = [523, 659, 784]; // C5, E5, G5

  for (var i = 0; i < notes.length; i++) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();

    var start = t + i * 0.06;
    osc.type = "sine";
    osc.frequency.setValueAtTime(notes[i], start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.12);
  }
}

/** Rising tone whose pitch scales with the combo count. */
function playComboSound(comboCount) {
  var ctx  = getAudioCtx();
  var t    = ctx.currentTime;
  var freq = Math.min(400 + comboCount * 80, 1200);

  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.linearRampToValueAtTime(freq * 1.5, t + 0.08);

  gain.gain.setValueAtTime(0.1, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.12);
}
