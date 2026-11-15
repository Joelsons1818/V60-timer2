// Timer beeps.
//
// Phones only allow sound after a tap, and iPhones additionally mute Web Audio
// when the side switch is on silent. To make the beeps dependable:
//  - resume() is called from taps to unlock the audio engine;
//  - the audio session is switched to "playback" and a silent looping <audio>
//    element runs during the brew, which makes iOS treat the app like a media
//    player (sound plays even with the silent switch on);
//  - every beep first makes sure the engine is actually running.

const buildSilentWavUrl = () => {
  const sampleRate = 8000;
  const samples = sampleRate / 2;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const writeText = (offset, text) => {
    [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  writeText(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); // 8-bit
  writeText(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence

  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
};

class AudioController {
  constructor() {
    this.context = null;
    this.isUnlocked = false;
    this.keepAlive = null;

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

  startKeepAlive() {
    try {
      if (navigator.audioSession) {
        navigator.audioSession.type = 'playback';
      }
    } catch (error) {
      console.debug('Audio session type unavailable', error);
    }

    try {
      if (!this.keepAlive) {
        this.keepAlive = new Audio(buildSilentWavUrl());
        this.keepAlive.loop = true;
        this.keepAlive.setAttribute('playsinline', '');
      }

      this.keepAlive.play()?.catch?.(() => {
        // Not started from a tap: the next tap will start it.
      });
    } catch (error) {
      console.debug('Silent audio loop unavailable', error);
    }
  }

  // Call when the brew screen closes.
  stopKeepAlive() {
    this.keepAlive?.pause();
  }

  // Must be called from a tap/click handler.
  resume() {
    try {
      const ctx = this.getContext();
      if (!ctx) {
        return;
      }

      this.startKeepAlive();
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
