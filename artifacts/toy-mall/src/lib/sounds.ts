const MUTE_KEY = "toy-mall-sounds-muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isSoundMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export function setSoundMuted(v: boolean) {
  try {
    if (v) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch { /* ignore */ }
}

export function toggleSoundMute(): boolean {
  const next = !isSoundMuted();
  setSoundMuted(next);
  return next;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.4,
  fadeOut = true
) {
  if (isSoundMuted()) return;
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

/** Short double-beep — QR scan success (USB scanner) */
export function playScanBeep() {
  playTone(1046, 0.08, "square", 0.3); // C6
  setTimeout(() => playTone(1318, 0.12, "square", 0.3), 90); // E6
}

/** Single sharp blip — instant camera decode feedback */
export function playCameraDetect() {
  playTone(1760, 0.05, "square", 0.28); // A6 — distinct from the USB double-beep
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

/** Ascending 4-note fanfare — checkout success */
export function playCheckoutSuccess() {
  playTone(523, 0.1, "sine", 0.35);
  setTimeout(() => playTone(659, 0.1, "sine", 0.35), 110);
  setTimeout(() => playTone(784, 0.1, "sine", 0.35), 220);
  setTimeout(() => playTone(1047, 0.25, "sine", 0.4), 330);
}
