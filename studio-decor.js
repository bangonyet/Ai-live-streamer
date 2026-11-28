(function (global) {
  'use strict';

  const EDU_PRESETS = {
    none: { label: 'Tanpa Musik', notes: [], tempo: 0, wave: 'sine' },
    lofi: { label: '🎧 Lo-Fi Study', notes: [261.6, 329.6, 392.0, 493.9, 392.0, 329.6], tempo: 650, wave: 'triangle' },
    piano: { label: '🎹 Soft Piano', notes: [293.7, 349.2, 440.0, 523.3, 440.0, 349.2], tempo: 800, wave: 'sine' },
    ambient: { label: '🌌 Ambient Focus', notes: [220.0, 261.6, 329.6, 392.0, 329.6, 261.6], tempo: 1100, wave: 'sine' },
    zen: { label: '🔔 Zen Bells', notes: [523.3, 659.3, 784.0, 659.3, 587.3, 493.9], tempo: 950, wave: 'sine' },
    acoustic: { label: '🎸 Acoustic Warm', notes: [196.0, 246.9, 293.7, 369.9, 293.7, 246.9], tempo: 720, wave: 'triangle' }
  };

  const StudioDecor = {
    activeItems: {
      eduBoard: true, eduNameTag: true,
      hibNeon: true, hibEq: true,
      jualSaleTag: true, jualBanner: true
    },
    eduMusicKey: 'none', audioCtx: null, musicTimer: null, noteStep: 0, masterGain: null, baseVolume: 0.14,

    toggleItem(key, val) { this.activeItems[key] = (typeof val === 'boolean') ? val : !this.activeItems[key]; },

    playEduInstrument(presetKey) {
      this.stopEduInstrument();
      this.eduMusicKey = presetKey || 'none';
      const cfg = EDU_PRESETS[this.eduMusicKey];
      if (!cfg || !cfg.notes.length) return;
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.masterGain = this.audioCtx.createGain();
      const volSlider = Number(document.getElementById('rngMusicVol')?.value ?? 65) / 100;
      this.baseVolume = 0.18 * volSlider;
      this.masterGain.gain.value = this.baseVolume;
      this.masterGain.connect(this.audioCtx.destination);
      this.noteStep = 0;
      const playStep = () => {
        if (!this.audioCtx || this.eduMusicKey === 'none') return;
        const freq = cfg.notes[this.noteStep % cfg.notes.length];
        this.noteStep++;
        const osc = this.audioCtx.createOscillator(), noteGain = this.audioCtx.createGain();
        osc.type = cfg.wave; osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        const now = this.audioCtx.currentTime;
        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.6, now + 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + (cfg.tempo / 1000) * 0.92);
        osc.connect(noteGain); noteGain.connect(this.masterGain);
        osc.start(now); osc.stop(now + (cfg.tempo / 1000));
      };
      playStep();
      this.musicTimer = setInterval(playStep, cfg.tempo);
    },

    setEduMusicVolume(percent) {
      this.baseVolume = 0.18 * (Math.max(0, Math.min(100, percent)) / 100);
      if (this.masterGain && this.audioCtx) this.masterGain.gain.setTargetAtTime(this.baseVolume, this.audioCtx.currentTime, 0.08);
    },

    duckEduMusic(isSpeaking) {
      if (!this.masterGain || !this.audioCtx) return;
      const target = isSpeaking ? (this.baseVolume * 0.22) : this.baseVolume;
      this.masterGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.12);
    },

    stopEduInstrument() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } this.eduMusicKey = 'none'; },

    renderOverlay(ctx, W, H, engine) {
      const niche = engine.niche || 'EDUKASI', cutY = H * engine.deskCutY, t = engine.clock || 0;
      if (niche === 'EDUKASI') {
        if (this.activeItems.eduBoard) {
          const bw = W * 0.34, bh = H * 0.11, bx = W * 0.05, by = H * 0.11;
          ctx.save(); ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('📌 TOPIK LIVE', bx + 8, by + 18);
          const title = (global.data && global.data.title) ? global.data.title : 'Sesi Edukasi Interaktif';
          ctx.fillStyle = '#f8fafc'; ctx.font = '10px sans-serif'; ctx.fillText(title.slice(0, 22), bx + 8, by + 36); ctx.restore();
        }
        if (this.activeItems.eduNameTag) {
          const styleTxt = (global.data && global.data.style) ? global.data.style : 'Mentor Edukasi';
          ctx.save(); ctx.fillStyle = 'rgba(2, 132, 199, 0.9)'; ctx.beginPath(); ctx.roundRect(W * 0.54, cutY - 12, W * 0.40, 22, 6); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('🎓 ' + styleTxt, W * 0.56, cutY + 3); ctx.restore();
        }
      } else if (niche === 'HIBURAN') {
        if (this.activeItems.hibNeon) {
          const pulse = 0.25 + Math.abs(Math.sin(t * 3.5)) * 0.35;
          ctx.save(); const neonGrad = ctx.createLinearGradient(0, 0, W, 0);
          neonGrad.addColorStop(0, `rgba(232, 121, 249, ${pulse})`); neonGrad.addColorStop(0.5, 'rgba(0,0,0,0)'); neonGrad.addColorStop(1, `rgba(56, 189, 248, ${pulse})`);
          ctx.fillStyle = neonGrad; ctx.fillRect(0, 0, W, H * 0.45); ctx.restore();
        }
        if (this.activeItems.hibEq) {
          const eqW = W * 0.44, eqX = (W - eqW) / 2, eqY = cutY + 6;
          ctx.save(); ctx.fillStyle = 'rgba(24, 24, 27, 0.85)'; ctx.beginPath(); ctx.roundRect(eqX, eqY, eqW, 18, 5); ctx.fill();
          for (let i = 0; i < 12; i++) {
            const barH = 3 + Math.abs(Math.sin(t * 7 + i * 0.8)) * 11;
            ctx.fillStyle = i % 2 === 0 ? '#e879f9' : '#38bdf8';
            ctx.fillRect(eqX + 8 + i * ((eqW - 16) / 12), eqY + 15 - barH, 6, barH);
          }
          ctx.restore();
        }
      } else if (niche === 'JUALAN') {
        if (this.activeItems.jualSaleTag) {
          const scalePulse = 1 + Math.sin(t * 5) * 0.04;
          ctx.save(); ctx.translate(W * 0.20, H * 0.14); ctx.scale(scalePulse, scalePulse);
          ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(-42, -14, 84, 28, 8); ctx.fill();
          ctx.fillStyle = '#fef08a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔥 FLASH SALE', 0, 4); ctx.restore();
        }
        if (this.activeItems.jualBanner) {
          ctx.save(); ctx.fillStyle = 'rgba(245, 158, 11, 0.92)'; ctx.beginPath(); ctx.roundRect(W * 0.08, cutY - 11, W * 0.84, 22, 6); ctx.fill();
          ctx.fillStyle = '#1c1917'; ctx.font = 'bold 10.5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🛒 CO SEKARANG • STOK PROMO TERBATAS • BISA COD', W / 2, cutY + 4); ctx.restore();
        }
      }
    }
  };

  global.StudioDecor = StudioDecor;
})(window);
