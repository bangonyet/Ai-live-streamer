(function(global) {
  'use strict';
  const PRESETS = {
    none: { notes: [], tempo: 0, wave: 'sine' },
    lofi: { notes: [261.6, 329.6, 392.0, 493.9], tempo: 650, wave: 'triangle' },
    piano: { notes: [293.7, 349.2, 440.0, 523.3], tempo: 800, wave: 'sine' },
    ambient: { notes: [220.0, 261.6, 329.6, 392.0], tempo: 1100, wave: 'sine' },
    zen: { notes: [523.3, 659.3, 784.0, 659.3], tempo: 950, wave: 'sine' },
    acoustic: { notes: [196.0, 246.9, 293.7, 369.9], tempo: 720, wave: 'triangle' }
  };
  const StudioDecor = {
    activeItems: { eduBoard: false, eduNameTag: false, hibNeon: false, hibEq: false, jualSaleTag: false, jualBanner: false },
    audioCtx: null, timer: null, step: 0, gain: null, baseVol: 0.12,
    toggleItem(k) { this.activeItems[k] = !this.activeItems[k]; },
    playEduInstrument(key) {
      this.stopEduInstrument();
      const cfg = PRESETS[key]; if (!cfg || !cfg.notes.length) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AC();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.gain = this.audioCtx.createGain();
      this.baseVol = 0.15 * (Number(document.getElementById('rngMusicVol')?.value ?? 65) / 100);
      this.gain.gain.value = this.baseVol; this.gain.connect(this.audioCtx.destination);
      this.timer = setInterval(() => {
        const osc = this.audioCtx.createOscillator(), ng = this.audioCtx.createGain(), now = this.audioCtx.currentTime;
        osc.type = cfg.wave; osc.frequency.setValueAtTime(cfg.notes[this.step++ % cfg.notes.length], now);
        ng.gain.setValueAtTime(0.001, now); ng.gain.exponentialRampToValueAtTime(0.5, now + 0.08);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(ng); ng.connect(this.gain); osc.start(now); osc.stop(now + 0.6);
      }, cfg.tempo);
    },
    setEduMusicVolume(p) { this.baseVol = 0.15 * (p / 100); if (this.gain) this.gain.gain.value = this.baseVol; },
    duckEduMusic(spk) { if (this.gain) this.gain.gain.value = spk ? this.baseVol * 0.2 : this.baseVol; },
    stopEduInstrument() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
    renderOverlay() {}
  };
  global.StudioDecor = StudioDecor;
})(window);
