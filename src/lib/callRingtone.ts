// A short two-tone ring. Microphone access is never needed to play it.
export class CallRingtone {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tones = new Set<OscillatorNode>();
  async unlock() {
    try {
      if (!this.context || this.context.state === 'closed') this.context = new AudioContext();
      await this.context.resume();
      return this.context.state === 'running';
    } catch { return false; }
  }
  private pulse() {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    for (const offset of [0, 0.6]) for (const frequency of [440, 480]) {
      const tone = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + offset;
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.055, start + 0.02);
      gain.gain.setValueAtTime(0.055, start + 0.35); gain.gain.linearRampToValueAtTime(0, start + 0.4);
      tone.connect(gain); gain.connect(context.destination); this.tones.add(tone);
      tone.onended = () => { this.tones.delete(tone); tone.disconnect(); gain.disconnect(); };
      tone.start(start); tone.stop(start + 0.42);
    }
  }
  start() {
    if (this.context?.state !== 'running') return false;
    if (!this.timer) { this.pulse(); this.timer = setInterval(() => this.pulse(), 3000); }
    return true;
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const tone of this.tones) { try { tone.stop(); } catch { /* Already ended. */ } }
    this.tones.clear();
  }
  close() { this.stop(); void this.context?.close().catch(() => {}); this.context = null; }
}
