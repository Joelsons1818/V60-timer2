import { KEEP_AWAKE_VIDEO } from './keepAwakeVideo';

// Keeps the phone screen on while a brew is running.
//
// Two mechanisms run together because neither is reliable everywhere:
//  1. the Screen Wake Lock API (Android, desktop, recent Safari);
//  2. a tiny looping video, which is what keeps the screen on in iPhone
//     home-screen apps and older browsers where the API is missing or broken.
// The video can only start from a tap, so enable() must be called from a
// click handler at least once (the "Start Brewing" button does it).

const isIosHomeScreenApp = () => {
  return typeof navigator !== 'undefined' && navigator.standalone === true;
};

class ScreenKeeper {
  constructor() {
    this.wanted = false;
    this.lock = null;
    this.pendingRequest = null;
    this.video = null;

    if (typeof document !== 'undefined') {
      // The browser drops the lock whenever the app goes to the background.
      document.addEventListener('visibilitychange', () => {
        if (this.wanted && document.visibilityState === 'visible') {
          this.acquire();
        }
      });
    }
  }

  getVideo() {
    if (!this.video) {
      const video = document.createElement('video');

      video.setAttribute('playsinline', '');
      video.setAttribute('title', 'V60 Timer');
      video.loop = true;
      video.src = KEEP_AWAKE_VIDEO;
      video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(video);
      this.video = video;
    }

    return this.video;
  }

  playVideo() {
    try {
      const result = this.getVideo().play();

      result?.catch?.(() => {
        // Not started from a tap: the next tap will start it.
      });
    } catch (error) {
      console.debug('Keep-awake video unavailable', error);
    }
  }

  pauseVideo() {
    this.video?.pause();
  }

  async requestNativeLock() {
    if (this.lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') {
      return Boolean(this.lock);
    }

    try {
      const lock = await navigator.wakeLock.request('screen');

      if (!this.wanted) {
        lock.release().catch(() => {});
        return false;
      }

      this.lock = lock;
      lock.addEventListener('release', () => {
        if (this.lock === lock) {
          this.lock = null;
        }

        if (this.wanted && document.visibilityState === 'visible') {
          window.setTimeout(() => this.acquire(), 150);
        }
      }, { once: true });

      return true;
    } catch (error) {
      console.debug('Wake lock unavailable', error);
      return false;
    }
  }

  acquire() {
    // Start the video right away (we may be inside a tap) and only stop it
    // once the native lock is confirmed. On iPhone home-screen apps the
    // native lock is not trustworthy, so the video keeps playing there.
    if (!this.lock || isIosHomeScreenApp()) {
      this.playVideo();
    }

    if (!this.pendingRequest) {
      this.pendingRequest = this.requestNativeLock().then((locked) => {
        this.pendingRequest = null;

        if (!this.wanted || (locked && !isIosHomeScreenApp())) {
          this.pauseVideo();
        }
      });
    }
  }

  enable() {
    this.wanted = true;
    this.acquire();
  }

  disable() {
    this.wanted = false;
    this.pauseVideo();

    if (this.lock) {
      const lock = this.lock;

      this.lock = null;
      lock.release().catch(() => {});
    }
  }
}

const screenKeeper = new ScreenKeeper();

export default screenKeeper;
