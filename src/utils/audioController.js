class AudioController {
  constructor() {
    this.context = null;
    this.isUnlocked = false;
  }

  getContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        return null;
      }

      this.context = new AudioContext();
    }

    return this.context;
  }

  resume() {
    try {
      const ctx = this.getContext();
      if (!ctx) {
        return;
      }

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (!this.isUnlocked) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        this.isUnlocked = true;
      }
    } catch (error) {
      console.error('Audio resume failed', error);
    }
  }

  playTone(freq = 800, type = 'sine', duration = 0.1) {
    try {
      const ctx = this.getContext();
      if (!ctx) {
        return;
      }

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (error) {
      console.error('Audio play failed', error);
    }
  }
}

const audioController = new AudioController();

export default audioController;
