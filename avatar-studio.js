(function (global) {
  'use strict';

  const PROTO = 'ht' + 'tps://';
  const CDN_BASE = PROTO + 'cdn.jsdelivr.net/npm/@mediapipe/';
  const MEDIAPIPE_CDN = {
    faceMesh: CDN_BASE + 'face_mesh'
  };

  const NICHE_THEMES = {
    EDUKASI: {
      rimColor: '#38bdf8',
      outfitMain: '#1e3a8a',
      outfitAccent: '#38bdf8',
      chairColor: '#1e293b',
      chairTrim: '#38bdf8',
      deskColor: '#0f172a',
      bgGradient: ['#0f172a', '#1e293b', '#0284c7']
    },
    HIBURAN: {
      rimColor: '#e879f9',
      outfitMain: '#4c1d95',
      outfitAccent: '#e879f9',
      chairColor: '#18181b',
      chairTrim: '#e879f9',
      deskColor: '#27272a',
      bgGradient: ['#18181b', '#2e1065', '#701a75']
    },
    JUALAN: {
      rimColor: '#fbbf24',
      outfitMain: '#78350f',
      outfitAccent: '#fbbf24',
      chairColor: '#292524',
      chairTrim: '#fbbf24',
      deskColor: '#1c1917',
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
      this.faceLandmarks = null;
      this.faceMesh = null;
      this.isModelsReady = false;

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

      // Parameter Kontrol 2.5D & Proporsi Tubuh
      this.rig = {
        headScale: 1.0,
        bodyScale: 1.0,
        armPose: 0,      // -50 (turun/meja) s/d +50 (angkat/sapa)
        legSpread: 0,    // -50 (rapat) s/d +50 (santai)
        yawAngle: 0,     // -35 (serong kiri) s/d +35 (serong kanan)
        cameraAngle: 'medium', // 'closeup' | 'medium' | 'wide'
        posX: 0,
        posY: 0,
        glassDesk: false
      };

      this.deskCutY = 0.62;
      this.activeProductImg = null;
      this.productScale = 1.0;
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
    }

    applyNichePreset(nicheName) {
      const key = String(nicheName || 'EDUKASI').toUpperCase();
      this.niche = NICHE_THEMES[key] ? key : 'EDUKASI';
      this.rig.glassDesk = (this.niche === 'HIBURAN');
      return {
        defaultDeskCut: this.deskCutY,
        defaultScale: this.rig.bodyScale,
        defaultPosY: this.rig.posY
      };
    }

    setAspectRatio(ratio) {
      if (!this.canvas) return;
      this.canvas.width = (ratio === '16:9') ? 960 : 540;
      this.canvas.height = (ratio === '16:9') ? 540 : 960;
      this._syncBufferSizes();
    }

    _syncBufferSizes() {
      this.headCanvas.width = 260;
      this.headCanvas.height = 300;
    }

    async init(canvasSelector = '#avatarCanvas') {
      this.canvas = typeof canvasSelector === 'string' ? document.querySelector(canvasSelector) : canvasSelector;
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 540;
        this.canvas.height = 960;
      }
      this.ctx = this.canvas.getContext('2d');
      this._syncBufferSizes();
      this._startRenderLoop();

      if (global.savedAvatarData && global.savedAvatarData.src && !this.sourceImage) {
        await this.setFaceImage(global.savedAvatarData.src, global.savedAvatarData.box);
      }
      this._loadFaceMesh();
      return true;
    }
    async _loadFaceMesh() {
      const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) return resolve();
        const s = document.createElement('script');
        s.src = src; s.crossOrigin = 'anonymous';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      try {
        if (!global.FaceMesh) await loadScript(MEDIAPIPE_CDN.faceMesh + '/face_mesh.js');
        this.faceMesh = new global.FaceMesh({
          locateFile: (file) => MEDIAPIPE_CDN.faceMesh + '/' + file
        });
        this.faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.45, minTrackingConfidence: 0.45 });
        this.faceMesh.onResults((res) => {
          if (res.multiFaceLandmarks && res.multiFaceLandmarks.length > 0) {
            this.faceLandmarks = res.multiFaceLandmarks[0];
            this._prepareCutoutHead();
          }
        });
        this.isModelsReady = true;
        if (this.sourceImage) await this.faceMesh.send({ image: this.sourceImage });
      } catch (e) {
        console.warn('[AvatarStudio] Mode fallback kepala aktif.');
      }
    }

    async setFaceImage(imageSource, faceBox) {
      if (faceBox) this.fallbackBox = faceBox;
      return new Promise((resolve) => {
        const onImgReady = (img) => {
          this.sourceImage = img;
          this.faceLandmarks = null;
          this._prepareCutoutHead();
          if (this.isModelsReady && this.faceMesh) {
            this.faceMesh.send({ image: img }).catch(() => {});
          }
          resolve(true);
        };
        if (typeof imageSource === 'string') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => onImgReady(img);
          img.onerror = () => resolve(false);
          img.src = imageSource;
        } else if (imageSource) {
          onImgReady(imageSource);
        } else {
          resolve(false);
        }
      });
    }

    _prepareCutoutHead() {
      if (!this.sourceImage) return;
      const hCtx = this.headCtx;
      const cw = this.headCanvas.width, ch = this.headCanvas.height;
      hCtx.clearRect(0, 0, cw, ch);

      const iw = this.sourceImage.naturalWidth || this.sourceImage.width || 480;
      const ih = this.sourceImage.naturalHeight || this.sourceImage.height || 640;

      let sx = iw * 0.25, sy = ih * 0.12, sw = iw * 0.5, sh = ih * 0.55;
      if (this.fallbackBox && this.fallbackBox.width > 0) {
        const b = this.fallbackBox;
        sx = Math.max(0, b.x - b.width * 0.28);
        sy = Math.max(0, b.y - b.height * 0.42);
        sw = Math.min(iw - sx, b.width * 1.56);
        sh = Math.min(ih - sy, b.height * 1.65);
      }

      hCtx.save();
      hCtx.beginPath();
      hCtx.ellipse(cw / 2, ch * 0.48, cw * 0.40, ch * 0.45, 0, 0, Math.PI * 2);
      hCtx.clip();
      hCtx.drawImage(this.sourceImage, sx, sy, sw, sh, 10, 10, cw - 20, ch - 20);
      hCtx.restore();
    }

    setNiche(nicheName) { const k = String(nicheName || 'EDUKASI').toUpperCase(); if (NICHE_THEMES[k]) this.niche = k; }
    setHostStyle(styleName) { this.hostStyle = styleName || 'Mentor Edukasi'; }
    setBackground(bgUrl) {
      if (!bgUrl) { this.bgImage = null; return; }
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { this.bgImage = img; };
      img.onerror = () => { this.bgImage = null; };
      img.src = bgUrl;
    }
    setActiveProduct(imgSrc, sizeScale = 1.0) {
      if (!imgSrc) { this.activeProductImg = null; return; }
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { this.activeProductImg = img; this.productScale = sizeScale; };
      img.src = imgSrc;
    }

    startSpeaking() { this.isSpeaking = true; this.wordPulse = 0.85; }
    stopSpeaking() { this.isSpeaking = false; this.targetSpeechEnergy = 0; this.wordPulse = 0; }
    pulseSpeechWord() { if (this.isSpeaking) this.wordPulse = 0.95; }

    bindAudioElement(audioEl) {
      if (!audioEl) return;
      try {
        if (!this.audioCtx) {
          const AudioContext = global.AudioContext || global.webkitAudioContext;
          this.audioCtx = new AudioContext();
        }
        const source = this.audioCtx.createMediaElementSource(audioEl);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128;
        source.connect(this.analyser); this.analyser.connect(this.audioCtx.destination);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        audioEl.addEventListener('play', () => { if (this.audioCtx.state === 'suspended') this.audioCtx.resume(); this.startSpeaking(); });
        audioEl.addEventListener('pause', () => this.stopSpeaking());
        audioEl.addEventListener('ended', () => this.stopSpeaking());
      } catch (e) {}
    }

    _updateSpeechEnergy() {
      if (!this.isSpeaking) {
        this.speechEnergy += (0 - this.speechEnergy) * 0.28; this.wordPulse *= 0.75; return;
      }
      const customAud = document.getElementById('userCustomAudio');
      if (this.analyser && this.dataArray && customAud && !customAud.paused) {
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 2; i < 24; i++) sum += this.dataArray[i];
        this.targetSpeechEnergy = Math.min(1, Math.max(0, ((sum / 22) - 22) / 105));
      } else {
        const wave = Math.abs(Math.sin(this.clock * 15)) * 0.55 + Math.abs(Math.cos(this.clock * 23)) * 0.25;
        this.targetSpeechEnergy = Math.min(1, Math.max(0.18, wave * 0.65 + this.wordPulse * 0.55));
        this.wordPulse *= 0.84;
      }
      this.speechEnergy += (this.targetSpeechEnergy - this.speechEnergy) * 0.42;
    }

    _startRenderLoop() {
      const render = () => {
        this.clock += 0.016;
        this._updateSpeechEnergy();
        this._renderFrame();
        this.rafId = requestAnimationFrame(render);
      };
      if (this.rafId) cancelAnimationFrame(this.rafId);
      render();
    }
    _renderFrame() {
      const W = this.canvas.width, H = this.canvas.height, ctx = this.ctx;
      const theme = NICHE_THEMES[this.niche] || NICHE_THEMES.EDUKASI;
      ctx.clearRect(0, 0, W, H);

      // 1. Background Studio
      if (this.bgImage) {
        const bgRatio = this.bgImage.width / this.bgImage.height, canvasRatio = W / H;
        let cw, ch, cx, cy;
        if (bgRatio > canvasRatio) { ch = H; cw = H * bgRatio; cx = (W - cw) / 2; cy = 0; }
        else { cw = W; ch = W / bgRatio; cx = 0; cy = (H - ch) / 2; }
        ctx.drawImage(this.bgImage, cx, cy, cw, ch);
        ctx.fillStyle = 'rgba(6, 9, 19, 0.35)';
        ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, theme.bgGradient[0]);
        grad.addColorStop(0.55, theme.bgGradient[1]);
        grad.addColorStop(1, theme.bgGradient[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      if (!this.sourceImage && global.savedAvatarData && global.savedAvatarData.src) {
        this.setFaceImage(global.savedAvatarData.src, global.savedAvatarData.box);
      }

      // Hitung Zoom & Posisi Kamera
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

      // 2. LAYER KURSI 2.5D (Bisa diputar mengikuti yawAngle)
      this._draw25DChair(ctx, centerX - yawShiftX * 0.35, baseY, bScale, yawRad, theme);

      // 3. LAYER KAKI (Terlihat saat Wide atau Meja Kaca)
      if (this.rig.cameraAngle === 'wide' || this.rig.glassDesk) {
        this._draw25DLegs(ctx, centerX, baseY, bScale, yawRad, theme);
      }

      // 4. LAYER BADAN / TORSO 2.5D
      const shoulderY = this._draw25DTorso(ctx, centerX, baseY + breathY, bScale, yawRad, theme);

      // 5. LAYER TANGAN KIRI & KANAN
      this._draw25DArms(ctx, centerX, shoulderY, bScale, yawRad, theme);

      // 6. LAYER KEPALA + WAJAH FOTO PENGGUNA
      this._draw25DHead(ctx, centerX, shoulderY, bScale, yawRad, theme);

      // 7. LAYER MEJA 2.5D (Bisa diputar mengikuti yawAngle)
      if (this.rig.cameraAngle !== 'closeup') {
        this._draw25DDesk(ctx, W, H, centerX, baseY, bScale, yawRad, theme);
      }

      ctx.restore();

      if (global.StudioDecor && global.StudioDecor.renderOverlay) {
        global.StudioDecor.renderOverlay(ctx, W, H, this);
      }
    }

    _draw25DChair(ctx, cx, by, sc, yaw, theme) {
      const cw = 185 * sc * Math.cos(yaw * 0.55);
      const ch = 260 * sc;
      const topY = by - 210 * sc;
      const offset3D = Math.sin(yaw) * 26 * sc;

      ctx.save();
      // Kedalaman Sandaran (Efek 2.5D)
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.roundRect(cx - cw / 2 + offset3D, topY, cw, ch, 28 * sc);
      ctx.fill();

      // Sandaran Utama
      ctx.fillStyle = theme.chairColor;
      ctx.strokeStyle = theme.chairTrim;
      ctx.lineWidth = 3 * sc;
      ctx.beginPath();
      ctx.roundRect(cx - cw / 2, topY, cw, ch, 28 * sc);
      ctx.fill();
      ctx.stroke();

      // Bantal Leher Kursi
      ctx.fillStyle = theme.chairTrim;
      ctx.beginPath();
      ctx.roundRect(cx - (cw * 0.32), topY + 26 * sc, cw * 0.64, 24 * sc, 10 * sc);
      ctx.fill();
      ctx.restore();
    }

    _draw25DLegs(ctx, cx, by, sc, yaw, theme) {
      const spread = (this.rig.legSpread / 50) * 26 * sc;
      const hipY = by + 10 * sc;
      const kneeY = by + 95 * sc;
      const footY = by + 185 * sc;

      ctx.save();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 28 * sc;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Kaki Kiri
      ctx.beginPath();
      ctx.moveTo(cx - 28 * sc, hipY);
      ctx.lineTo(cx - (42 * sc + spread), kneeY);
      ctx.lineTo(cx - (38 * sc + spread * 0.8), footY);
      ctx.stroke();

      // Kaki Kanan
      ctx.beginPath();
      ctx.moveTo(cx + 28 * sc, hipY);
      ctx.lineTo(cx + (42 * sc + spread), kneeY);
      ctx.lineTo(cx + (38 * sc + spread * 0.8), footY);
      ctx.stroke();

      // Sepatu
      ctx.fillStyle = theme.outfitAccent;
      ctx.beginPath();
      ctx.ellipse(cx - (38 * sc + spread * 0.8), footY + 6 * sc, 18 * sc, 9 * sc, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + (38 * sc + spread * 0.8), footY + 6 * sc, 18 * sc, 9 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _draw25DTorso(ctx, cx, by, sc, yaw, theme) {
      const shoulderW = 156 * sc * Math.cos(yaw * 0.45);
      const waistW = 116 * sc * Math.cos(yaw * 0.45);
      const torsoH = 145 * sc;
      const shoulderY = by - 125 * sc;

      ctx.save();
      // Leher
      ctx.fillStyle = '#e2a887';
      ctx.beginPath();
      ctx.roundRect(cx - 18 * sc, shoulderY - 26 * sc, 36 * sc, 36 * sc, 10 * sc);
      ctx.fill();

      // Badan / Baju 2.5D
      ctx.fillStyle = theme.outfitMain;
      ctx.strokeStyle = theme.outfitAccent;
      ctx.lineWidth = 2.5 * sc;
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW / 2, shoulderY);
      ctx.lineTo(cx + shoulderW / 2, shoulderY);
      ctx.lineTo(cx + waistW / 2, shoulderY + torsoH);
      ctx.lineTo(cx - waistW / 2, shoulderY + torsoH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Kerah / Aksen Tengah Baju
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(cx - 22 * sc, shoulderY);
      ctx.lineTo(cx + 22 * sc, shoulderY);
      ctx.lineTo(cx, shoulderY + 46 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      return shoulderY;
    }

    _draw25DArms(ctx, cx, shoulderY, sc, yaw, theme) {
      const shoulderW = 152 * sc * Math.cos(yaw * 0.45);
      const poseLift = (this.rig.armPose / 50) * 55 * sc;
      const speakWave = this.isSpeaking ? Math.sin(this.clock * 6) * (8 + this.speechEnergy * 16) * sc : 0;

      ctx.save();
      ctx.strokeStyle = theme.outfitMain;
      ctx.lineWidth = 24 * sc;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Tangan Kiri
      const lStartX = cx - shoulderW / 2;
      const lElbowX = lStartX - 24 * sc;
      const lElbowY = shoulderY + 62 * sc - poseLift * 0.4;
      const lHandX = cx - 44 * sc;
      const lHandY = shoulderY + 115 * sc - poseLift - speakWave;

      ctx.beginPath();
      ctx.moveTo(lStartX, shoulderY + 10 * sc);
      ctx.lineTo(lElbowX, lElbowY);
      ctx.lineTo(lHandX, lHandY);
      ctx.stroke();

      // Tangan Kanan
      const rStartX = cx + shoulderW / 2;
      const rElbowX = rStartX + 24 * sc;
      const rElbowY = shoulderY + 62 * sc - poseLift * 0.4;
      const rHandX = cx + 44 * sc;
      const rHandY = shoulderY + 115 * sc - poseLift + speakWave * 0.6;

      ctx.beginPath();
      ctx.moveTo(rStartX, shoulderY + 10 * sc);
      ctx.lineTo(rElbowX, rElbowY);
      ctx.lineTo(rHandX, rHandY);
      ctx.stroke();

      // Telapak Tangan
      ctx.fillStyle = '#e2a887';
      ctx.beginPath();
      ctx.arc(lHandX, lHandY, 13 * sc, 0, Math.PI * 2);
      ctx.arc(rHandX, rHandY, 13 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _draw25DHead(ctx, cx, shoulderY, sc, yaw, theme) {
      const hScale = sc * this.rig.headScale;
      const headW = 112 * hScale;
      const headH = 132 * hScale;
      const headTilt = Math.sin(this.clock * 1.5) * 0.02 + Math.sin(this.clock * 5) * (this.speechEnergy * 0.04);
      const nodY = Math.sin(this.clock * 6) * (this.speechEnergy * 4 * hScale);
      const headCenterY = shoulderY - (headH * 0.56) + nodY;

      ctx.save();
      ctx.translate(cx + Math.sin(yaw) * 8 * hScale, headCenterY);
      ctx.rotate(headTilt);

      // Bingkai Glow Kepala
      ctx.shadowColor = theme.rimColor;
      ctx.shadowBlur = 14;

      if (this.sourceImage) {
        ctx.drawImage(this.headCanvas, -headW / 2, -headH / 2, headW, headH);
      } else {
        // Placeholder Wajah Sebelum Scan
        ctx.fillStyle = '#e2a887';
        ctx.beginPath();
        ctx.ellipse(0, 0, headW * 0.42, headH * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold ' + Math.round(11 * hScale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Wajah Anda', 0, 4);
      }

      // Animasi Bibir Berbicara
      if (this.speechEnergy > 0.05) {
        const mouthOpen = this.speechEnergy * 10 * hScale;
        ctx.fillStyle = '#3f0d12';
        ctx.beginPath();
        ctx.ellipse(0, headH * 0.22, 14 * hScale, Math.max(2, mouthOpen), 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    _draw25DDesk(ctx, W, H, cx, by, sc, yaw, theme) {
      const deskY = by + 15 * sc;
      const deskW = W * 0.86;
      const skewY = Math.sin(yaw) * 28 * sc;

      ctx.save();
      if (this.rig.glassDesk) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.strokeStyle = '#38bdf8';
      } else {
        ctx.fillStyle = theme.deskColor;
        ctx.strokeStyle = theme.rimColor;
      }
      ctx.lineWidth = 3;

      // Permukaan Meja Perspektif 2.5D
      ctx.beginPath();
      ctx.moveTo(cx - deskW * 0.46, deskY - skewY);
      ctx.lineTo(cx + deskW * 0.46, deskY + skewY);
      ctx.lineTo(cx + deskW * 0.52, deskY + 26 * sc + skewY);
      ctx.lineTo(cx - deskW * 0.52, deskY + 26 * sc - skewY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bagian Bawah Meja
      if (!this.rig.glassDesk) {
        ctx.fillStyle = '#060913';
