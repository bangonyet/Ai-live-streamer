(function (global) {
  'use strict';

  const NICHE_THEMES = {
    EDUKASI: {
      rimColor: '#38bdf8',
      outfitMain: '#1e3a8a',
      outfitAccent: '#38bdf8',
      chairColor: '#1e293b',
      chairTrim: '#38bdf8',
      deskColor: '#0f172a',
      defaultBg: 'assets/bg-edukasi-clean.jpg',
      bgGradient: ['#0f172a', '#1e293b', '#0284c7']
    },
    HIBURAN: {
      rimColor: '#e879f9',
      outfitMain: '#4c1d95',
      outfitAccent: '#e879f9',
      chairColor: '#18181b',
      chairTrim: '#e879f9',
      deskColor: '#27272a',
      defaultBg: 'assets/bg-hiburan-clean.jpg',
      bgGradient: ['#18181b', '#2e1065', '#701a75']
    },
    JUALAN: {
      rimColor: '#fbbf24',
      outfitMain: '#78350f',
      outfitAccent: '#fbbf24',
      chairColor: '#292524',
      chairTrim: '#fbbf24',
      deskColor: '#1c1917',
      defaultBg: 'assets/bg-jualan-clean.jpg',
      bgGradient: ['#1c1917', '#451a03', '#b45309']
    }
  };
  class AvatarStudioEngine {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.headCanvas = document.createElement('canvas');
      this.headCtx = this.headCanvas.getContext('2d');
      this.sourceImage = null;
      this.fallbackBox = null;
      this.bgImage = null;
      this.isCustomBg = false;
      this.wearables = {
        outfitImg: null, outfitStyle: 'default',
        hatImg: null, hatStyle: 'none',
        glassesImg: null, glassesStyle: 'none',
        hasHeadset: true
      };
      this.niche = 'EDUKASI';
      this.hostStyle = 'Mentor Edukasi';
      this.isSpeaking = false;
      this.speechEnergy = 0;
      this.targetSpeechEnergy = 0;
      this.wordPulse = 0;
      this.audioCtx = null;
      this.analyser = null;
      this.dataArray = null;
      this.clock = 0;
      this.rafId = null;
      this.rig = {
        headScale: 1.0, bodyScale: 1.0, armPose: 0, legSpread: 0,
        yawAngle: 0, micAngle: -25, cameraAngle: 'medium',
        posX: 0, posY: 0, glassDesk: false, hideFurniture: false
      };
      this.deskCutY = 0.62;
      this.activeProductImg = null;
      this.productScale = 1.0;
    }
    async init(canvasSelector = '#avatarCanvas') {
      this.canvas = typeof canvasSelector === 'string' ? document.querySelector(canvasSelector) : canvasSelector;
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 540;
        this.canvas.height = 960;
      }
      this.ctx = this.canvas.getContext('2d');
      this.headCanvas.width = 260;
      this.headCanvas.height = 300;
      this.setBackground(NICHE_THEMES[this.niche].defaultBg, false);
      this._startRenderLoop();
      if (global.savedAvatarData && global.savedAvatarData.src && !this.sourceImage) {
        await this.setFaceImage(global.savedAvatarData.src, global.savedAvatarData.box);
      }
      return true;
    }

    setRig(opts = {}) {
      Object.assign(this.rig, opts);
      if (this.rig.cameraAngle === 'closeup') this.deskCutY = 0.78;
      else if (this.rig.cameraAngle === 'wide') this.deskCutY = 0.64;
      else this.deskCutY = 0.62;
    }

    setTransform(opts = {}) {
      if (typeof opts.posX === 'number') this.rig.posX = opts.posX;
      if (typeof opts.posY === 'number') this.rig.posY = opts.posY;
      if (typeof opts.scale === 'number') this.rig.bodyScale = opts.scale;
      if (typeof opts.deskCutY === 'number') this.deskCutY = opts.deskCutY;
      if (typeof opts.glassDesk === 'boolean') this.rig.glassDesk = opts.glassDesk;
      if (typeof opts.hideFurniture === 'boolean') this.rig.hideFurniture = opts.hideFurniture;
    }

    setWearable(type, styleKey, externalUrl) {
      if (type === 'outfit') { this.wearables.outfitStyle = styleKey || 'default'; this._loadAsset('outfitImg', externalUrl); }
      else if (type === 'hat') { this.wearables.hatStyle = styleKey || 'none'; this._loadAsset('hatImg', externalUrl); }
      else if (type === 'glasses') { this.wearables.glassesStyle = styleKey || 'none'; this._loadAsset('glassesImg', externalUrl); }
      else if (type === 'headset') { this.wearables.hasHeadset = Boolean(styleKey); }
    }
    _loadAsset(propName, url) {
      if (!url || url === 'none') { this.wearables[propName] = null; return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this.wearables[propName] = img; };
      img.onerror = () => { this.wearables[propName] = null; };
      img.src = url;
    }

    uploadCustomBackground(fileOrUrl, forceHideFurniture = null) {
      return new Promise((resolve) => {
        const processImg = (src) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.bgImage = img;
            this.isCustomBg = true;
            this.rig.hideFurniture = (typeof forceHideFurniture === 'boolean') ? forceHideFurniture : this._detectStudioInImage(img);
            resolve({ ok: true, hideFurniture: this.rig.hideFurniture });
          };
          img.onerror = () => resolve({ ok: false, hideFurniture: false });
          img.src = src;
        };
        if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (e) => processImg(e.target.result);
          reader.readAsDataURL(fileOrUrl);
        } else { processImg(fileOrUrl); }
      });
    }

    _detectStudioInImage(img) {
      try {
        const tmp = document.createElement('canvas');
        tmp.width = 64; tmp.height = 64;
        const tCtx = tmp.getContext('2d');
        tCtx.drawImage(img, 0, 0, 64, 64);
        const d = tCtx.getImageData(12, 36, 40, 26).data;
        let score = 0;
        for (let i = 0; i < d.length - 4; i += 4) if (Math.abs(d[i] - d[i + 4]) + Math.abs(d[i + 1] - d[i + 5]) > 38) score++;
        return score > 85;
      } catch (e) { return true; }
    }
    setBackground(bgUrl, isCustom = false) {
      this.isCustomBg = isCustom;
      if (!isCustom) this.rig.hideFurniture = false;
      if (!bgUrl) { this.bgImage = null; return; }
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { this.bgImage = img; }; img.onerror = () => { this.bgImage = null; };
      img.src = bgUrl;
    }

    applyNichePreset(nicheName) {
      const key = String(nicheName || 'EDUKASI').toUpperCase();
      this.niche = NICHE_THEMES[key] ? key : 'EDUKASI';
      this.rig.glassDesk = (this.niche === 'HIBURAN');
      this.wearables.hasHeadset = (this.niche === 'HIBURAN' || this.niche === 'EDUKASI');
      if (!this.isCustomBg) this.setBackground(NICHE_THEMES[this.niche].defaultBg, false);
      return { defaultDeskCut: this.deskCutY, defaultScale: this.rig.bodyScale, defaultPosY: this.rig.posY };
    }

    setNiche(n) { this.applyNichePreset(n); }
    setHostStyle(s) { this.hostStyle = s || 'Mentor Edukasi'; }
    setAspectRatio(r) { if (this.canvas) { this.canvas.width = (r === '16:9') ? 960 : 540; this.canvas.height = (r === '16:9') ? 540 : 960; } }
    setActiveProduct(src, sc = 1.0) {
      if (!src) { this.activeProductImg = null; return; }
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { this.activeProductImg = img; this.productScale = sc; }; img.src = src;
    }

    async setFaceImage(imageSource, faceBox) {
      if (faceBox) this.fallbackBox = faceBox;
      return new Promise((resolve) => {
        const onReady = (img) => { this.sourceImage = img; this._prepareCutoutHead(); resolve(true); };
        if (typeof imageSource === 'string') {
          const img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = () => onReady(img); img.onerror = () => resolve(false); img.src = imageSource;
        } else if (imageSource) onReady(imageSource); else resolve(false);
      });
    }

    _prepareCutoutHead() {
      if (!this.sourceImage) return;
      const hCtx = this.headCtx, cw = this.headCanvas.width, ch = this.headCanvas.height;
      hCtx.clearRect(0, 0, cw, ch);
      const iw = this.sourceImage.naturalWidth || 480, ih = this.sourceImage.naturalHeight || 640;
      let sx = iw * 0.25, sy = ih * 0.12, sw = iw * 0.5, sh = ih * 0.55;
      if (this.fallbackBox && this.fallbackBox.width > 0) {
        const b = this.fallbackBox;
        sx = Math.max(0, b.x - b.width * 0.28); sy = Math.max(0, b.y - b.height * 0.42);
        sw = Math.min(iw - sx, b.width * 1.56); sh = Math.min(ih - sy, b.height * 1.65);
      }
      hCtx.save(); hCtx.beginPath(); hCtx.ellipse(cw / 2, ch * 0.48, cw * 0.40, ch * 0.45, 0, 0, Math.PI * 2); hCtx.clip();
      hCtx.drawImage(this.sourceImage, sx, sy, sw, sh, 10, 10, cw - 20, ch - 20); hCtx.restore();
    }
    startSpeaking() { this.isSpeaking = true; this.wordPulse = 0.85; }
    stopSpeaking() { this.isSpeaking = false; this.targetSpeechEnergy = 0; this.wordPulse = 0; }
    pulseSpeechWord() { if (this.isSpeaking) this.wordPulse = 0.95; }

    bindAudioElement(audioEl) {
      if (!audioEl) return;
      try {
        if (!this.audioCtx) this.audioCtx = new (global.AudioContext || global.webkitAudioContext)();
        const src = this.audioCtx.createMediaElementSource(audioEl);
        this.analyser = this.audioCtx.createAnalyser(); this.analyser.fftSize = 128;
        src.connect(this.analyser); this.analyser.connect(this.audioCtx.destination);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        audioEl.addEventListener('play', () => { if (this.audioCtx.state === 'suspended') this.audioCtx.resume(); this.startSpeaking(); });
        audioEl.addEventListener('pause', () => this.stopSpeaking()); audioEl.addEventListener('ended', () => this.stopSpeaking());
      } catch (e) {}
    }

    _updateSpeechEnergy() {
      if (!this.isSpeaking) { this.speechEnergy += (0 - this.speechEnergy) * 0.28; this.wordPulse *= 0.75; return; }
      const aud = document.getElementById('userCustomAudio');
      if (this.analyser && this.dataArray && aud && !aud.paused) {
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0; for (let i = 2; i < 24; i++) sum += this.dataArray[i];
        this.targetSpeechEnergy = Math.min(1, Math.max(0, ((sum / 22) - 22) / 105));
      } else {
        const w = Math.abs(Math.sin(this.clock * 15)) * 0.55 + Math.abs(Math.cos(this.clock * 23)) * 0.25;
        this.targetSpeechEnergy = Math.min(1, Math.max(0.18, w * 0.65 + this.wordPulse * 0.55)); this.wordPulse *= 0.84;
      }
      this.speechEnergy += (this.targetSpeechEnergy - this.speechEnergy) * 0.42;
    }

    _startRenderLoop() {
      const render = () => { this.clock += 0.016; this._updateSpeechEnergy(); this._renderFrame(); this.rafId = requestAnimationFrame(render); };
      if (this.rafId) cancelAnimationFrame(this.rafId); render();
    }
    _renderFrame() {
      const W = this.canvas.width, H = this.canvas.height, ctx = this.ctx;
      const theme = NICHE_THEMES[this.niche] || NICHE_THEMES.EDUKASI;
      ctx.clearRect(0, 0, W, H);
      if (this.bgImage) {
        const bgRatio = this.bgImage.width / this.bgImage.height, canvasRatio = W / H;
        let cw, ch, cx, cy;
        if (bgRatio > canvasRatio) { ch = H; cw = H * bgRatio; cx = (W - cw) / 2; cy = 0; }
        else { cw = W; ch = W / bgRatio; cx = 0; cy = (H - ch) / 2; }
        ctx.drawImage(this.bgImage, cx, cy, cw, ch);
        ctx.fillStyle = 'rgba(6, 9, 19, 0.22)'; ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, theme.bgGradient[0]); grad.addColorStop(0.55, theme.bgGradient[1]); grad.addColorStop(1, theme.bgGradient[2]);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      }
      if (!this.sourceImage && global.savedAvatarData && global.savedAvatarData.src) {
        this.setFaceImage(global.savedAvatarData.src, global.savedAvatarData.box);
      }
      let camZoom = 1.0, camYShift = 0;
      if (this.rig.cameraAngle === 'closeup') { camZoom = 1.38; camYShift = H * 0.14; }
      else if (this.rig.cameraAngle === 'wide') { camZoom = 0.78; camYShift = -H * 0.04; }
      const yawRad = (this.rig.yawAngle * Math.PI) / 180;
      const yawShiftX = Math.sin(yawRad) * (W * 0.14);
      const centerX = (W * 0.5) + ((this.rig.posX / 100) * W * 0.3) + yawShiftX;
      const baseY = (H * 0.56) + ((this.rig.posY / 100) * H * 0.25) + camYShift;
      const bScale = this.rig.bodyScale * camZoom;
      const breathY = Math.sin(this.clock * 2.2) * 3;
      ctx.save();
      if (!this.rig.hideFurniture) this._draw25DChair(ctx, centerX - yawShiftX * 0.35, baseY, bScale, yawRad, theme);
      if (this.rig.cameraAngle === 'wide' || this.rig.glassDesk || this.rig.hideFurniture) this._draw25DLegs(ctx, centerX, baseY, bScale, yawRad, theme);
      const shoulderY = this._draw25DTorso(ctx, centerX, baseY + breathY, bScale, yawRad, theme);
      this._draw25DArms(ctx, centerX, shoulderY, bScale, yawRad, theme);
      this._draw25DHead(ctx, centerX, shoulderY, bScale, yawRad, theme);
      if (this.rig.cameraAngle !== 'closeup' && !this.rig.hideFurniture) this._draw25DDeskAndMic(ctx, W, H, centerX, baseY, bScale, yawRad, theme);
      else if (this.rig.hideFurniture && this.rig.cameraAngle !== 'closeup') this._drawFloatingMic(ctx, W, centerX, baseY, bScale, theme);
      ctx.restore();
      if (global.StudioDecor && global.StudioDecor.renderOverlay) global.StudioDecor.renderOverlay(ctx, W, H, this);
    }
    _draw25DChair(ctx, cx, by, sc, yaw, theme) {
      const cw = 185 * sc * Math.cos(yaw * 0.55), ch = 260 * sc, topY = by - 210 * sc, off = Math.sin(yaw) * 26 * sc;
      ctx.save(); ctx.fillStyle = '#090d16'; ctx.beginPath(); ctx.roundRect(cx - cw / 2 + off, topY, cw, ch, 28 * sc); ctx.fill();
      ctx.fillStyle = theme.chairColor; ctx.strokeStyle = theme.chairTrim; ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.roundRect(cx - cw / 2, topY, cw, ch, 28 * sc); ctx.fill(); ctx.stroke();
      ctx.fillStyle = theme.chairTrim; ctx.beginPath(); ctx.roundRect(cx - (cw * 0.32), topY + 26 * sc, cw * 0.64, 24 * sc, 10 * sc); ctx.fill(); ctx.restore();
    }

    _draw25DLegs(ctx, cx, by, sc, yaw, theme) {
      const sp = (this.rig.legSpread / 50) * 26 * sc, hipY = by + 10 * sc, kneeY = by + 95 * sc, footY = by + 185 * sc;
      ctx.save(); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 28 * sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 28 * sc, hipY); ctx.lineTo(cx - (42 * sc + sp), kneeY); ctx.lineTo(cx - (38 * sc + sp * 0.8), footY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 28 * sc, hipY); ctx.lineTo(cx + (42 * sc + sp), kneeY); ctx.lineTo(cx + (38 * sc + sp * 0.8), footY); ctx.stroke();
      ctx.fillStyle = theme.outfitAccent; ctx.beginPath();
      ctx.ellipse(cx - (38 * sc + sp * 0.8), footY + 6 * sc, 18 * sc, 9 * sc, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + (38 * sc + sp * 0.8), footY + 6 * sc, 18 * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    _draw25DTorso(ctx, cx, by, sc, yaw, theme) {
      const sW = 156 * sc * Math.cos(yaw * 0.45), wW = 116 * sc * Math.cos(yaw * 0.45), tH = 145 * sc, sY = by - 125 * sc;
      ctx.save(); ctx.fillStyle = '#e2a887'; ctx.beginPath(); ctx.roundRect(cx - 18 * sc, sY - 26 * sc, 36 * sc, 36 * sc, 10 * sc); ctx.fill();
      if (this.wearables.outfitImg) {
        ctx.drawImage(this.wearables.outfitImg, cx - (sW * 1.25) / 2, sY - 8 * sc, sW * 1.25, tH * 1.15);
      } else {
        const oS = this.wearables.outfitStyle;
        const mCol = oS === 'jas' ? '#0f172a' : (oS === 'hoodie' ? '#312e81' : (oS === 'batik' ? '#7c2d12' : theme.outfitMain));
        const aCol = oS === 'jas' ? '#38bdf8' : (oS === 'hoodie' ? '#f43f5e' : (oS === 'batik' ? '#fbbf24' : theme.outfitAccent));
        ctx.fillStyle = mCol; ctx.strokeStyle = aCol; ctx.lineWidth = 2.5 * sc;
        ctx.beginPath(); ctx.moveTo(cx - sW / 2, sY); ctx.lineTo(cx + sW / 2, sY); ctx.lineTo(cx + wW / 2, sY + tH); ctx.lineTo(cx - wW / 2, sY + tH); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = oS === 'hoodie' ? aCol : '#f8fafc';
        ctx.beginPath(); ctx.moveTo(cx - 22 * sc, sY); ctx.lineTo(cx + 22 * sc, sY); ctx.lineTo(cx, sY + 46 * sc); ctx.closePath(); ctx.fill();
      }
      ctx.restore(); return sY;
    }
    _draw25DArms(ctx, cx, sY, sc, yaw, theme) {
      const sW = 152 * sc * Math.cos(yaw * 0.45), lift = (this.rig.armPose / 50) * 55 * sc;
      const wave = this.isSpeaking ? Math.sin(this.clock * 6) * (8 + this.speechEnergy * 16) * sc : 0;
      const oS = this.wearables.outfitStyle;
      const armCol = oS === 'jas' ? '#0f172a' : (oS === 'hoodie' ? '#312e81' : (oS === 'batik' ? '#7c2d12' : theme.outfitMain));
      ctx.save(); ctx.strokeStyle = armCol; ctx.lineWidth = 24 * sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - sW / 2, sY + 10 * sc); ctx.lineTo(cx - sW / 2 - 24 * sc, sY + 62 * sc - lift * 0.4); ctx.lineTo(cx - 44 * sc, sY + 115 * sc - lift - wave); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + sW / 2, sY + 10 * sc); ctx.lineTo(cx + sW / 2 + 24 * sc, sY + 62 * sc - lift * 0.4); ctx.lineTo(cx + 44 * sc, sY + 115 * sc - lift + wave * 0.6); ctx.stroke();
      ctx.fillStyle = '#e2a887'; ctx.beginPath(); ctx.arc(cx - 44 * sc, sY + 115 * sc - lift - wave, 13 * sc, 0, Math.PI * 2); ctx.arc(cx + 44 * sc, sY + 115 * sc - lift + wave * 0.6, 13 * sc, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    _draw25DHead(ctx, cx, sY, sc, yaw, theme) {
      const hSc = sc * this.rig.headScale, hW = 112 * hSc, hH = 132 * hSc;
      const tilt = Math.sin(this.clock * 1.5) * 0.02 + Math.sin(this.clock * 5) * (this.speechEnergy * 0.04);
      const headY = sY - (hH * 0.56) + Math.sin(this.clock * 6) * (this.speechEnergy * 4 * hSc);
      ctx.save(); ctx.translate(cx + Math.sin(yaw) * 8 * hSc, headY); ctx.rotate(tilt);
      if (this.wearables.hasHeadset) { ctx.strokeStyle = '#334155'; ctx.lineWidth = 8 * hSc; ctx.beginPath(); ctx.arc(0, -4 * hSc, hW * 0.54, Math.PI, 0); ctx.stroke(); }
      ctx.shadowColor = theme.rimColor; ctx.shadowBlur = 14;
      if (this.sourceImage) ctx.drawImage(this.headCanvas, -hW / 2, -hH / 2, hW, hH);
      else { ctx.fillStyle = '#e2a887'; ctx.beginPath(); ctx.ellipse(0, 0, hW * 0.42, hH * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.font = 'bold ' + Math.round(11 * hSc) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Wajah Anda', 0, 4); }
      ctx.shadowBlur = 0;
      if (this.wearables.hasHeadset) { ctx.fillStyle = '#1e293b'; ctx.strokeStyle = theme.rimColor; ctx.lineWidth = 2.5 * hSc; ctx.beginPath(); ctx.roundRect(-hW * 0.56, -16 * hSc, 14 * hSc, 36 * hSc, 6 * hSc); ctx.roundRect(hW * 0.42, -16 * hSc, 14 * hSc, 36 * hSc, 6 * hSc); ctx.fill(); ctx.stroke(); }
      if (this.wearables.glassesImg) ctx.drawImage(this.wearables.glassesImg, -hW * 0.39, -hH * 0.14, hW * 0.78, hH * 0.24);
      else if (this.wearables.glassesStyle !== 'none') { ctx.strokeStyle = this.wearables.glassesStyle === 'hitam' ? '#090d16' : '#38bdf8'; ctx.fillStyle = this.wearables.glassesStyle === 'hitam' ? 'rgba(9,13,22,0.85)' : 'rgba(56,189,248,0.18)'; ctx.lineWidth = 3 * hSc; ctx.beginPath(); ctx.roundRect(-hW * 0.34, -hH * 0.12, hW * 0.28, hH * 0.16, 5 * hSc); ctx.roundRect(hW * 0.06, -hH * 0.12, hW * 0.28, hH * 0.16, 5 * hSc); ctx.fill(); ctx.stroke(); }
      if (this.wearables.hatImg) ctx.drawImage(this.wearables.hatImg, -hW * 0.59, -hH * 0.76, hW * 1.18, hH * 0.55);
      else if (this.wearables.hatStyle !== 'none') { ctx.fillStyle = this.wearables.hatStyle === 'peci' ? '#0f172a' : '#ef4444'; ctx.beginPath(); ctx.ellipse(0, -hH * 0.42, hW * 0.46, hH * 0.18, 0, Math.PI, 0); ctx.fill(); if (this.wearables.hatStyle === 'topi') { ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.ellipse(0, -hH * 0.40, hW * 0.58, hH * 0.07, 0, 0, Math.PI * 2); ctx.fill(); } }
      if (this.speechEnergy > 0.05) { ctx.fillStyle = '#3f0d12'; ctx.beginPath(); ctx.ellipse(0, hH * 0.22, 13 * hSc, Math.max(2, this.speechEnergy * 10 * hSc), 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    _draw25DDeskAndMic(ctx, W, H, cx, by, sc, yaw, theme) {
      const deskY = by + 15 * sc, deskW = W * 0.86, skewY = Math.sin(yaw) * 28 * sc;
      ctx.save();
      ctx.fillStyle = this.rig.glassDesk ? 'rgba(56, 189, 248, 0.22)' : theme.deskColor;
      ctx.strokeStyle = this.rig.glassDesk ? '#38bdf8' : theme.rimColor;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - deskW * 0.46, deskY - skewY); ctx.lineTo(cx + deskW * 0.46, deskY + skewY);
      ctx.lineTo(cx + deskW * 0.52, deskY + 26 * sc + skewY); ctx.lineTo(cx - deskW * 0.52, deskY + 26 * sc - skewY); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!this.rig.glassDesk) {
        ctx.fillStyle = '#060913'; ctx.beginPath();
        ctx.moveTo(cx - deskW * 0.48, deskY + 26 * sc - skewY); ctx.lineTo(cx + deskW * 0.48, deskY + 26 * sc + skewY);
        ctx.lineTo(cx + deskW * 0.48, H); ctx.lineTo(cx - deskW * 0.48, H); ctx.closePath(); ctx.fill();
      }
      const micOff = (this.rig.micAngle / 60) * (deskW * 0.35), micX = cx + micOff, micBaseY = deskY + (micOff / (deskW * 0.46)) * skewY;
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4 * sc; ctx.beginPath(); ctx.moveTo(micX, micBaseY); ctx.lineTo(micX - micOff * 0.15, micBaseY - 46 * sc); ctx.stroke();
      ctx.fillStyle = '#1e293b'; ctx.strokeStyle = theme.rimColor; ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.roundRect(micX - micOff * 0.15 - 11 * sc, micBaseY - 76 * sc, 22 * sc, 32 * sc, 10 * sc); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    _drawFloatingMic(ctx, W, cx, by, sc, theme) {
      const micOff = (this.rig.micAngle / 60) * (W * 0.32), micX = cx + micOff, micY = by - 25 * sc;
      ctx.save(); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 4 * sc; ctx.beginPath(); ctx.moveTo(micOff < 0 ? 0 : W, micY + 45 * sc); ctx.lineTo(micX, micY); ctx.stroke();
      ctx.fillStyle = '#0f172a'; ctx.strokeStyle = theme.rimColor; ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.roundRect(micX - 10 * sc, micY - 16 * sc, 20 * sc, 30 * sc, 9 * sc); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  global.AvatarStudio = new AvatarStudioEngine();
})(window);
