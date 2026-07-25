const WAV_SAMPLE_RATE = 44100;
const COUNTDOWN_SOUND = 'countdown';
const TRANSITION_SOUND = 'transition';
const FINISH_SOUND = 'finish';
const AUDIO_SPRITE_DURATION = 2;

const SOUND_DEFINITIONS = {
  [COUNTDOWN_SOUND]: {
    offset: 0,
    duration: 0.26,
    volume: 0.88,
    notes: [
      { start: 0, duration: 0.24, frequency: 523.25, gain: 0.82 },
    ],
  },
  [TRANSITION_SOUND]: {
    offset: 0.55,
    duration: 0.32,
    volume: 0.88,
    notes: [
      { start: 0, duration: 0.3, frequency: 587.33, gain: 0.82 },
    ],
  },
  [FINISH_SOUND]: {
    offset: 1.1,
    duration: 0.64,
    volume: 0.9,
    notes: [
      { start: 0, duration: 0.62, frequency: 392, gain: 0.82 },
    ],
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

const getNoteSample = (spriteTime, definition, note) => {
  const noteTime = spriteTime - definition.offset - note.start;
  if (noteTime < 0 || noteTime >= note.duration) {
    return 0;
  }

  const attackDuration = Math.min(0.025, note.duration * 0.12);
  const releaseDuration = Math.min(0.2, note.duration * 0.55);
  const attackProgress = Math.min(1, noteTime / attackDuration);
  const releaseProgress = Math.min(1, (note.duration - noteTime) / releaseDuration);
  const attack = Math.sin((Math.PI / 2) * attackProgress);
  const release = Math.sin((Math.PI / 2) * Math.max(0, releaseProgress));
  const decay = Math.exp((-0.5 * noteTime) / note.duration);
  const envelope = attack * release * decay;
  const fundamental = Math.sin(2 * Math.PI * note.frequency * noteTime);

  return fundamental * envelope * note.gain;
};

const createAudioSpriteDataUrl = () => {
  const sampleCount = Math.round(WAV_SAMPLE_RATE * AUDIO_SPRITE_DURATION);
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
    const mixedSample = Object.values(SOUND_DEFINITIONS).reduce((total, definition) => {
      if (time < definition.offset || time >= definition.offset + definition.duration) {
        return total;
      }

      const soundSample = definition.notes.reduce((sum, note) => {
        return sum + getNoteSample(time, definition, note);
      }, 0);

      return total + (soundSample * definition.volume);
    }, 0);
    const pcmValue = Math.round(Math.max(-1, Math.min(1, mixedSample)) * 32767);

    view.setInt16(44 + (index * bytesPerSample), pcmValue, true);
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
};

class AudioController {
  constructor() {
    this.context = null;
    this.mediaElement = null;
    this.mediaSource = null;
    this.mediaPauseTimeout = null;
    this.mediaPlaybackToken = 0;
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
      this.mediaSource = createAudioSpriteDataUrl();
    }

    const mediaElement = new Audio();
    mediaElement.preload = 'auto';
    mediaElement.playsInline = true;
    mediaElement.volume = 1;
    mediaElement.src = this.mediaSource;
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

  async playMediaSound(soundName = COUNTDOWN_SOUND) {
    const mediaElement = this.getMediaElement();
    const definition = SOUND_DEFINITIONS[soundName];
    if (!mediaElement || !definition) {
      return false;
    }

    try {
      this.mediaPlaybackToken += 1;
      const playbackToken = this.mediaPlaybackToken;

      if (this.mediaPauseTimeout) {
        globalThis.clearTimeout(this.mediaPauseTimeout);
        this.mediaPauseTimeout = null;
      }

      mediaElement.pause();
      mediaElement.currentTime = definition.offset;
      mediaElement.playbackRate = 1;

      const playAttempt = mediaElement.play();
      if (playAttempt && typeof playAttempt.then === 'function') {
        await playAttempt;
      }

      this.mediaPauseTimeout = globalThis.setTimeout(() => {
        if (this.mediaPlaybackToken === playbackToken) {
          mediaElement.pause();
        }
      }, Math.round(definition.duration * 1000));

      this.isMediaUnlocked = true;
      this.isUnlocked = true;
      return true;
    } catch (error) {
      console.warn('HTML audio playback failed', error);
      return false;
    }
  }

  playContextTone(
    frequency = 523.25,
    type = 'sine',
    duration = 0.24,
    volume = 0.36,
    delay = 0,
  ) {
    try {
      const context = this.getContext();
      if (!context || context.state !== 'running') {
        return false;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startTime = context.currentTime + delay;
      const audibleDuration = Math.max(0.22, duration);
      const attackDuration = Math.min(0.025, audibleDuration * 0.12);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + attackDuration);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + audibleDuration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + audibleDuration);
      this.isUnlocked = true;
      return true;
    } catch (error) {
      console.warn('Web Audio playback failed', error);
      return false;
    }
  }

  playContextTransitionTone() {
    return this.playContextTone(587.33, 'sine', 0.3, 0.36);
  }

  playContextFinishTone() {
    return this.playContextTone(392, 'sine', 0.62, 0.38);
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

  async playTone() {
    const mediaPlayed = await this.playMediaSound(COUNTDOWN_SOUND);
    if (mediaPlayed) {
      return true;
    }

    const contextReady = await this.resumeContext();
    if (!contextReady) {
      this.isUnlocked = false;
      return false;
    }

    return this.playContextTone();
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

  async playFinishTone() {
    const mediaPlayed = await this.playMediaSound(FINISH_SOUND);
    if (mediaPlayed) {
      return true;
    }

    const contextReady = await this.resumeContext();
    if (!contextReady) {
      this.isUnlocked = false;
      return false;
    }

    return this.playContextFinishTone();
  }
}

const audioController = new AudioController();

export default audioController;
