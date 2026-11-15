// Timer beeps.
//
// The beeps are deliberately "polite": the audio session is set to ambient, so
// they mix with a podcast or music playing in another app instead of pausing
// it. The trade-off is that an iPhone on silent mode will not play them.
// resume() is called from taps to unlock the audio engine, and every beep
// first makes sure the engine is actually running.

// Ambient audio never interrupts what other apps are playing.
export const setAmbientAudioSession = () => {
  try {
    if (navigator.audioSession) {
      navigator.audioSession.type = 'ambient';
    }
  } catch (error) {
    console.debug('Audio session type unavailable', error);
  }
};

class AudioController {
  constructor() {
    this.context = null;
    this.isUnlocked = false;

    if (typeof document !== 'undefined') {
      // Any tap re-awakens the audio engine if the system suspended it.
      const wake = () => this.wakeContext();

      document.addEventListener('pointerdown', wake, { passive: true });
      document.addEventListener('touchend', wake, { passive: true });
      document.addEventListener('keydown', wake);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          wake();
        }
      });
    }
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

  wakeContext() {
    const ctx = this.context;

    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') {
      return Promise.resolve();
    }

    return ctx.resume().catch((error) => {
      console.debug('Audio resume skipped', error);
    });
  }

  // Must be called from a tap/click handler.
  resume() {
    try {
      const ctx = this.getContext();
      if (!ctx) {
        return;
      }

      setAmbientAudioSession();
      this.wakeContext();

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

  scheduleTone(ctx, freq, type, duration, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playTone(freq = 800, type = 'sine', duration = 0.1, volume = 0.3) {
    try {
      const ctx = this.getContext();
      if (!ctx) {
        return;
      }

      if (ctx.state === 'running') {
        this.scheduleTone(ctx, freq, type, duration, volume);
        return;
      }

      // Engine was suspended: wake it first, otherwise the beep is lost.
      this.wakeContext().then(() => {
        if (ctx.state === 'running') {
          this.scheduleTone(ctx, freq, type, duration, volume);
        }
      });
    } catch (error) {
      console.error('Audio play failed', error);
    }
  }
}

const audioController = new AudioController();

export default audioController;
