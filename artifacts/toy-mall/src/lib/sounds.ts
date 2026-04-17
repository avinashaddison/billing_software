let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.4,
  fadeOut = true
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();
  osc.connect(gainNode);
  gainNode.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ac.currentTime);
  gainNode.gain.setValueAtTime(gain, ac.currentTime);
  if (fadeOut) {
    gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  }
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

/** Short double-beep — QR scan success */
export function playScanBeep() {
  playTone(1046, 0.08, "square", 0.3); // C6
  setTimeout(() => playTone(1318, 0.12, "square", 0.3), 90); // E6
}

/** Soft tick — quantity +/- adjust */
export function playTick() {
  playTone(600, 0.04, "sine", 0.15);
}

/** Rising two-tone — Stock IN success */
export function playStockIn() {
  playTone(523, 0.12, "sine", 0.35); // C5
  setTimeout(() => playTone(784, 0.18, "sine", 0.35), 110); // G5
}

/** Falling two-tone — Stock OUT */
export function playStockOut() {
  playTone(660, 0.12, "sine", 0.35); // E5
  setTimeout(() => playTone(440, 0.18, "sine", 0.35), 110); // A4
}

/** Low buzz — error / insufficient stock */
export function playError() {
  playTone(200, 0.25, "sawtooth", 0.2);
}
