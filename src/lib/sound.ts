/**
 * The "rest's up" sound. iOS only lets a page play audio after the user has
 * tapped something, so `unlockSound` runs inside a tap (✓, Warm-up, +30 s)
 * and the sound can play later. Everything is feature-detected and fails
 * silently; Web Audio follows the silent switch, and there's no vibration
 * (iOS doesn't support it).
 */
let ctx: AudioContext | null = null;

export function unlockSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    // A silent sample played inside the tap is what unlocks audio on iOS.
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // No sound, then.
  }
}

/** Two short soft beeps. Does nothing if audio was never unlocked. */
export function playReadySound() {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const start = ctx.currentTime + 0.02;
    [0, 0.18].forEach((offset) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.14);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.15);
    });
  } catch {
    // No sound, then.
  }
}
