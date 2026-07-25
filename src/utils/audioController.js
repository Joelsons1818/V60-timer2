const WAV_SAMPLE_RATE = 44100;
const COUNTDOWN_SOUND = 'countdown';
const TRANSITION_SOUND = 'transition';

const SOUND_DEFINITIONS = {
  [COUNTDOWN_SOUND]: {
    duration: 0.24,
    frequencies: [
      { frequency: 880, gain: 0.92 },
      { frequency: 1760, gain: 0.08 },
    ],
    attack: 0.008,
    release: 0.065,
    decay: 0.18,
    volume: 0.94,
  },
  [TRANSITION_SOUND]: {
    duration: 0.42,
    frequencies: [
      { frequency: 1046.5, gain: 0.78 },
      { frequency: 1568, gain: 0.22 },
    ],
    attack: 0.012,
    release: 0.11,
    decay: 0.68,
    volume: 0.88,
  },
};

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

const createSoundWavDataUrl = (soundName) => {
  const definition = SOUND_DEFINITIONS[soundName];
  const sampleCount = Math.round(WAV_SAMPLE_RATE * definition.duration);
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
    const attackProgress = Math.min(1, time / definition.attack);
    const releaseProgress = Math.min(1, (definition.duration - time) / definition.release);
    const attack = Math.sin((Math.PI / 2) * attackProgress);
    const release = Math.sin((Math.PI / 2) * Math.max(0, releaseProgress));
    const decay = Math.exp((-definition.decay * time) / definition.duration);
    const envelope = attack * release * decay;
    const waveform = definition.frequencies.reduce((sum, tone) => {
      return sum + (Math.sin(2 * Math.PI * tone.frequency * time) * tone.gain);
    }, 0);
    const sample = waveform * envelope * definition.volume;
    const pcmValue = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);

    view.setInt16(44 + (index * bytesPerSample), pcmValue, true);
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
};

class AudioController {
  constructor() {
    this.context = null;
    this.mediaElement = null;
    this.mediaSources = {};
    this.currentMediaSound = null;
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

  getMediaSource(soundName) {
    if (!this.mediaSources[soundName]) {
      this.mediaSources[soundName] = createSoundWavDataUrl(soundName);
    }

    return this.mediaSources[soundName];
  }

  getMediaElement() {
    if (this.mediaElement || typeof Audio === 'undefined') {
      return this.mediaElement;
    }

    const mediaElement = new Audio();
    mediaElement.preload = 'auto';
    mediaElement.playsInline = true;
    mediaElement.volume = 1;
    mediaElement.src = this.getMediaSource(COUNTDOWN_SOUND);
    mediaElement.load();

    this.currentMediaSound = COUNTDOWN_SOUND;
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

  async playMediaSound(soundName = COUNTDOWN_SOUND) {
    const mediaElement = this.getMediaElement();
    if (!mediaElement) {
      return false;
    }

    try {
      mediaElement.pause();

      if (this.currentMediaSound !== soundName) {
        mediaElement.src = this.getMediaSource(soundName);
        mediaElement.load();
        this.currentMediaSound = soundName;
      }

      mediaElement.currentTime = 0;
      mediaElement.playbackRate = 1;

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

  playContextTone(frequency = 880, type = 'sine', duration = 0.24, volume = 0.45) {
    try {
      const context = this.getContext();
      if (!context || context.state !== 'running') {
        return false;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const audibleDuration = Math.max(0.22, duration);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(volume, now);
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

  playContextTransitionTone() {
    const lowerTone = this.playContextTone(1046.5, 'sine', 0.4, 0.28);
    const upperTone = this.playContextTone(1568, 'sine', 0.4, 0.1);
    return lowerTone || upperTone;
  }

  async resume({ testSound = false } = {}) {
    const contextResume = this.resumeContext();
    const mediaPlayback = testSound
      ? this.playMediaSound(COUNTDOWN_SOUND)
      : Promise.resolve(this.isMediaUnlocked);

    const [contextReady, mediaReady] = await Promise.all([contextResume, mediaPlayback]);
    this.isUnlocked = mediaReady || contextReady;

    if (testSound && !mediaReady && contextReady) {
      return this.playContextTone();
    }

    return this.isUnlocked;
  }

  async playTone(frequency = 880, type = 'sine', duration = 0.24) {
    const mediaPlayed = await this.playMediaSound(COUNTDOWN_SOUND);
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

  async playTransitionTone() {
    const mediaPlayed = await this.playMediaSound(TRANSITION_SOUND);
    if (mediaPlayed) {
      return true;
    }

    const contextReady = await this.resumeContext();
    if (!contextReady) {
      this.isUnlocked = false;
      return false;
    }

    return this.playContextTransitionTone();
  }
}

const audioController = new AudioController();

export default audioController;
