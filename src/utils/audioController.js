const WAV_SAMPLE_RATE = 44100;
const BEEP_DURATION_SECONDS = 0.34;
const BASE_BEEP_FREQUENCY = 720;

const writeAscii = (view, offset, value) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const createBeepWavDataUrl = () => {
  const sampleCount = Math.round(WAV_SAMPLE_RATE * BEEP_DURATION_SECONDS);
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / WAV_SAMPLE_RATE;
    const attackProgress = Math.min(1, time / 0.012);
    const releaseProgress = Math.min(1, (BEEP_DURATION_SECONDS - time) / 0.045);
    const attack = Math.sin((Math.PI / 2) * attackProgress);
    const release = Math.sin((Math.PI / 2) * Math.max(0, releaseProgress));
    const decay = Math.exp((-2.4 * time) / BEEP_DURATION_SECONDS);
    const envelope = attack * release * decay;
    const fundamental = Math.sin(2 * Math.PI * BASE_BEEP_FREQUENCY * time);
    const harmonic = Math.sin(2 * Math.PI * BASE_BEEP_FREQUENCY * 2 * time);
    const sample = envelope * ((fundamental * 0.96) + (harmonic * 0.04));
    const pcmValue = Math.round(Math.max(-1, Math.min(1, sample * 0.8)) * 32767);

    view.setInt16(44 + (index * bytesPerSample), pcmValue, true);
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
};

class AudioController {
  constructor() {
    this.context = null;
    this.mediaElement = null;
    this.mediaSource = null;
    this.isMediaUnlocked = false;
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

  getMediaElement() {
    if (this.mediaElement || typeof Audio === 'undefined') {
      return this.mediaElement;
    }

    if (!this.mediaSource) {
      this.mediaSource = createBeepWavDataUrl();
    }

    const mediaElement = new Audio();
    mediaElement.preload = 'auto';
    mediaElement.playsInline = true;
    mediaElement.src = this.mediaSource;
    mediaElement.volume = 1;
    mediaElement.load();

    this.mediaElement = mediaElement;
    return mediaElement;
  }

  async resumeContext() {
    try {
      const context = this.getContext();
      if (!context || context.state === 'closed') {
        return false;
      }

      if (context.state !== 'running') {
        await context.resume();
      }

      return context.state === 'running';
    } catch (error) {
      console.warn('Audio context resume failed', error);
      return false;
    }
  }

  async playMediaTone(frequency = BASE_BEEP_FREQUENCY) {
    const mediaElement = this.getMediaElement();
    if (!mediaElement) {
      return false;
    }

    try {
      mediaElement.pause();
      mediaElement.currentTime = 0;
      mediaElement.playbackRate = frequency >= 1400
        ? 1.12
        : frequency >= 1100
          ? 1.07
          : 1;

      const playAttempt = mediaElement.play();
      if (playAttempt && typeof playAttempt.then === 'function') {
        await playAttempt;
      }

      this.isMediaUnlocked = true;
      this.isUnlocked = true;
      return true;
    } catch (error) {
      console.warn('HTML audio playback failed', error);
      return false;
    }
  }

  playContextTone(frequency = 800, type = 'sine', duration = 0.22) {
    try {
      const context = this.getContext();
      if (!context || context.state !== 'running') {
        return false;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const audibleDuration = Math.max(0.18, duration);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + audibleDuration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + audibleDuration);
      this.isUnlocked = true;
      return true;
    } catch (error) {
      console.warn('Web Audio playback failed', error);
      return false;
    }
  }

  async resume({ testSound = false } = {}) {
    const contextResume = this.resumeContext();
    const mediaPlayback = testSound
      ? this.playMediaTone(BASE_BEEP_FREQUENCY)
      : Promise.resolve(this.isMediaUnlocked);

    const [contextReady, mediaReady] = await Promise.all([contextResume, mediaPlayback]);
    this.isUnlocked = mediaReady || contextReady;

    if (testSound && !mediaReady && contextReady) {
      return this.playContextTone(1000, 'triangle', 0.28);
    }

    return this.isUnlocked;
  }

  async playTone(frequency = 800, type = 'sine', duration = 0.1) {
    const mediaPlayed = await this.playMediaTone(frequency);
    if (mediaPlayed) {
      return true;
    }

    const contextReady = await this.resumeContext();
    if (!contextReady) {
      this.isUnlocked = false;
      return false;
    }

    return this.playContextTone(frequency, type, duration);
  }
}

const audioController = new AudioController();

export default audioController;
