(function (global) {
  'use strict';

  const CDN_BASE = 'https:' + '//cdn.jsdelivr.net/npm/@mediapipe/';
  const MEDIAPIPE_CDN = {
    segmentation: CDN_BASE + 'selfie_segmentation',
    faceMesh: CDN_BASE + 'face_mesh'
  };

  const NICHE_THEMES = {
    EDUKASI: {
      rimColor: 'rgba(56, 189, 248, 0.85)',
      ambientTint: 'rgba(14, 165, 233, 0.08)',
      bgGradient: ['#0f172a', '#1e293b', '#0284c7'],
      outfitType: 'blazer_formal',
      showHeadset: false
    },
    HIBURAN: {
      rimColor: 'rgba(232, 121, 249, 0.9)',
      ambientTint: 'rgba(192, 38, 211, 0.10)',
      bgGradient: ['#18181b', '#2e1065', '#701a75'],
      outfitType: 'casual_hoodie',
      showHeadset: true
    },
    JUALAN: {
      rimColor: 'rgba(251, 191, 36, 0.88)',
      ambientTint: 'rgba(245, 158, 11, 0.08)',
      bgGradient: ['#1c1917', '#451a03', '#b45309'],
      outfitType: 'smart_casual_host',
      showHeadset: false
    }
  };

  class AvatarStudioEngine {
    constructor() {
      this.canvas = null;
      this.ctx = null;

      this.personCanvas = document.createElement('canvas');
      this.personCtx = this.personCanvas.getContext('2d');

      this.rimCanvas = document.createElement('canvas');
      this.rimCtx = this.rimCanvas.getContext('2d');

      this.sourceImage = null;
      this.bgImage = null;
      this.segmentationMask = null;
      this.faceLandmarks = null;

      this.niche = 'EDUKASI';
      this.hostStyle = 'Mentor Edukasi';
      this.isSpeaking = false;
      this.speechEnergy = 0;
      this.targetSpeechEnergy = 0;

      this.audioCtx = null;
      this.analyser = null;
      this.dataArray = null;

      this.selfieSegmentation = null;
      this.faceMesh = null;
      this.isModelsReady = false;

            this.clock = 0;

      // Pengaturan posisi host di belakang meja (bisa diatur dari slider)
      this.posX = 0;
      this.posY = -18;
      this.scale = 0.85;
      this.deskCutY = 0.72;

      // Produk yang sedang diperagakan di tangan (Niche Jualan)
      this.activeProductImg = null;
      this.productScale = 1.0;
    }

    setTransform(opts = {}) {
      if (typeof opts.posX === 'number') this.posX = opts.posX;
      if (typeof opts.posY === 'number') this.posY = opts.posY;
      if (typeof opts.scale === 'number') this.scale = opts.scale;
      if (typeof opts.deskCutY === 'number') this.deskCutY = opts.deskCutY;
    }

    setActiveProduct(imgSrc, sizeScale = 1.0) {
      if (!imgSrc) {
        this.activeProductImg = null;
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.activeProductImg = img;
        this.productScale = sizeScale;
      };
      img.src = imgSrc;
    }


    async init(canvasSelector = '#avatarCanvas') {
      this.canvas = typeof canvasSelector === 'string'
        ? document.querySelector(canvasSelector)
        : canvasSelector;

      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 720;
        this.canvas.height = 1280;
      }

      this.ctx = this.canvas.getContext('2d');
      this._syncBufferSizes();
      await this._loadMediaPipeDependencies();
      this._startRenderLoop();
      return true;
    }

    _syncBufferSizes() {
      const w = this.canvas.width || 720;
      const h = this.canvas.height || 1280;
      this.personCanvas.width = w;
      this.personCanvas.height = h;
      this.rimCanvas.width = w;
      this.rimCanvas.height = h;
    }

    async _loadMediaPipeDependencies() {
      const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

      try {
        if (!global.SelfieSegmentation) {
          await loadScript(MEDIAPIPE_CDN.segmentation + '/selfie_segmentation.js');
        }
        if (!global.FaceMesh) {
          await loadScript(MEDIAPIPE_CDN.faceMesh + '/face_mesh.js');
        }

        this.selfieSegmentation = new global.SelfieSegmentation({
          locateFile: (file) => MEDIAPIPE_CDN.segmentation + '/' + file
        });
        this.selfieSegmentation.setOptions({ modelSelection: 1, selfieMode: false });
        this.selfieSegmentation.onResults((res) => {
          this.segmentationMask = res.segmentationMask;
        });

        this.faceMesh = new global.FaceMesh({
          locateFile: (file) => MEDIAPIPE_CDN.faceMesh + '/' + file
        });
        this.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        this.faceMesh.onResults((res) => {
          if (res.multiFaceLandmarks && res.multiFaceLandmarks.length > 0) {
            this.faceLandmarks = res.multiFaceLandmarks[0];
          }
        });

        this.isModelsReady = true;
      } catch (err) {
        console.error('[AvatarStudio] Gagal memuat MediaPipe:', err);
      }
    }
    async setFaceImage(imageSource) {
      return new Promise((resolve, reject) => {
        if (typeof imageSource === 'string') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = async () => {
            this.sourceImage = img;
            await this._processFaceAnalysis();
            resolve(true);
          };
          img.onerror = reject;
          img.src = imageSource;
        } else {
          this.sourceImage = imageSource;
          this._processFaceAnalysis().then(() => resolve(true));
        }
      });
    }

    async _processFaceAnalysis() {
      if (!this.sourceImage || !this.isModelsReady) return;
      try {
        await this.selfieSegmentation.send({ image: this.sourceImage });
        await this.faceMesh.send({ image: this.sourceImage });
      } catch (e) {
        console.warn('[AvatarStudio] Analisis wajah fallback:', e);
      }
    }

    setNiche(nicheName) {
      const key = String(nicheName || 'EDUKASI').toUpperCase();
      if (NICHE_THEMES[key]) this.niche = key;
    }

    setHostStyle(styleName) {
      this.hostStyle = styleName || 'Mentor Edukasi';
    }

    setBackground(bgUrl) {
      if (!bgUrl) {
        this.bgImage = null;
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this.bgImage = img; };
      img.src = bgUrl;
    }

    startSpeaking() {
      this.isSpeaking = true;
    }

    stopSpeaking() {
      this.isSpeaking = false;
      this.targetSpeechEnergy = 0;
    }

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
        source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        audioEl.addEventListener('play', () => {
          if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
          this.startSpeaking();
        });
        audioEl.addEventListener('pause', () => this.stopSpeaking());
        audioEl.addEventListener('ended', () => this.stopSpeaking());
      } catch (e) {
        console.warn('[AvatarStudio] AudioContext warning:', e);
      }
    }

    _updateSpeechEnergy() {
      if (!this.isSpeaking) {
        this.speechEnergy += (0 - this.speechEnergy) * 0.25;
        return;
      }
      if (this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 2; i < 24; i++) sum += this.dataArray[i];
        const avg = sum / 22;
        this.targetSpeechEnergy = Math.min(1, Math.max(0, (avg - 25) / 110));
      } else {
        const wave = Math.sin(this.clock * 16) * 0.45 + Math.sin(this.clock * 27) * 0.35 + Math.cos(this.clock * 9) * 0.20;
        this.targetSpeechEnergy = Math.max(0.08, Math.min(1, 0.45 + wave));
      }
      this.speechEnergy += (this.targetSpeechEnergy - this.speechEnergy) * 0.38;
    }

    _getHeadMetrics(drawRect) {
      if (!this.faceLandmarks) {
        return {
          centerX: drawRect.x + drawRect.w * 0.5,
          centerY: drawRect.y + drawRect.h * 0.38,
          rollAngle: 0,
          faceWidth: drawRect.w * 0.42,
          mouthCenter: { x: drawRect.x + drawRect.w * 0.5, y: drawRect.y + drawRect.h * 0.48 },
          mouthWidth: drawRect.w * 0.14,
          chinBottom: { x: drawRect.x + drawRect.w * 0.5, y: drawRect.y + drawRect.h * 0.58 },
          neckBase: { x: drawRect.x + drawRect.w * 0.5, y: drawRect.y + drawRect.h * 0.65 }
        };
      }
      const lm = this.faceLandmarks;
      const mapPt = (idx) => ({
        x: drawRect.x + lm[idx].x * drawRect.w,
        y: drawRect.y + lm[idx].y * drawRect.h
      });
      const leftEye = mapPt(33);
      const rightEye = mapPt(263);
      const upperLip = mapPt(13);
      const lowerLip = mapPt(14);
      const mouthLeft = mapPt(61);
      const mouthRight = mapPt(291);
      const chin = mapPt(152);
      const leftTemple = mapPt(234);
      const rightTemple = mapPt(454);

      const rollAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
      const faceWidth = Math.hypot(rightTemple.x - leftTemple.x, rightTemple.y - leftTemple.y);
      const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);

      return {
        centerX: (leftTemple.x + rightTemple.x) / 2,
        centerY: (leftTemple.y + rightTemple.y) / 2,
        rollAngle,
        faceWidth,
        mouthCenter: { x: (upperLip.x + lowerLip.x) / 2, y: (upperLip.y + lowerLip.y) / 2 },
        mouthWidth,
        chinBottom: chin,
        neckBase: {
          x: chin.x - Math.sin(rollAngle) * (faceWidth * 0.25),
          y: chin.y + Math.cos(rollAngle) * (faceWidth * 0.28)
        }
      };
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
      const W = this.canvas.width;
      const H = this.canvas.height;
      const ctx = this.ctx;
      const theme = NICHE_THEMES[this.niche] || NICHE_THEMES.EDUKASI;

      ctx.clearRect(0, 0, W, H);
      this._drawStudioBackground(ctx, W, H, theme);

      if (!this.sourceImage) {
        this._drawPlaceholderGuide(ctx, W, H);
        return;
      }

      const imgRatio = this.sourceImage.width / this.sourceImage.height;
      const targetH = H * 0.84 * this.scale;
      const targetW = targetH * imgRatio;

      // Gerakan kepala & badan berbeda tiap niche
      let breathY = Math.sin(this.clock * 2.1) * 3.5;
      let swayX = Math.cos(this.clock * 1.2) * 2;
      let idleTilt = Math.sin(this.clock * 1.4) * 0.012;

      if (this.niche === 'HIBURAN') {
        swayX = Math.sin(this.clock * 2.4) * 5;
        idleTilt = Math.sin(this.clock * 2.4) * 0.025;
      } else if (this.niche === 'JUALAN') {
        breathY = Math.sin(this.clock * 3.0) * 4;
      }

      const drawRect = {
        x: (W - targetW) / 2 + this.posX + swayX,
        y: (H * 0.14) + this.posY + breathY,
        w: targetW,
        h: targetH
      };

      const metrics = this._getHeadMetrics(drawRect);
      this._prepareCutoutPerson(drawRect, theme);
      this._drawRimLightAura(ctx, theme);

      ctx.save();
      // Potong batas pinggang agar host rapi di belakang meja studio
      const cutLineY = H * this.deskCutY;
      ctx.beginPath();
      ctx.rect(0, 0, W, cutLineY);
      ctx.clip();

      ctx.translate(metrics.neckBase.x, metrics.neckBase.y);
      ctx.rotate(idleTilt);
      ctx.translate(-metrics.neckBase.x, -metrics.neckBase.y);

      // 1. Gambar tubuh & wajah asli hasil auto-cutout
      ctx.drawImage(this.personCanvas, 0, 0);

      // 2. Gerakan tangan berbeda tiap niche
      this._applyNicheHandGestures(ctx, drawRect, metrics);

      // 3. Deformasi bibir & dagu foto asli saat bicara
      this._applyLipAndJawWarping(ctx, metrics);

      // 4. Headset studio khusus Hiburan
      if (theme.showHeadset) this._drawStudioHeadset(ctx, metrics);

      ctx.restore();

      // 5. Peragaan produk di tangan host (khusus JUALAN)
      if (this.niche === 'JUALAN' && this.activeProductImg) {
        this._drawHeldProduct(ctx, metrics, cutLineY);
      }

      ctx.fillStyle = theme.ambientTint;
      ctx.fillRect(0, 0, W, H);
    }

    _applyNicheHandGestures(ctx, drawRect, metrics) {
      const shoulderY = metrics.neckBase.y + metrics.faceWidth * 0.25;
      const armH = drawRect.h * 0.45;
      const armW = drawRect.w * 0.28;
      if (armW <= 8 || armH <= 8) return;

      let leftAngle = 0;
      let rightAngle = 0;

      if (this.niche === 'EDUKASI') {
        // Edukasi: Tangan kanan aktif menjelaskan/menunjuk, tangan kiri tenang
        const amp = this.isSpeaking ? (0.05 + this.speechEnergy * 0.06) : 0.01;
        leftAngle = Math.sin(this.clock * 1.5) * 0.01;
        rightAngle = -Math.abs(Math.sin(this.clock * 3.4)) * amp;
      } else if (this.niche === 'HIBURAN') {
        // Hiburan: Kedua tangan mengayun santai mengikuti irama musik
        const amp = this.isSpeaking ? 0.075 : 0.04;
        leftAngle = Math.sin(this.clock * 3.0) * amp;
        rightAngle = Math.sin(this.clock * 3.0) * amp;
      } else {
        // Jualan: Gerak antusias memperagakan produk & menunjuk keranjang
        const amp = this.isSpeaking ? (0.06 + this.speechEnergy * 0.07) : 0.02;
        leftAngle = Math.sin(this.clock * 4.2) * amp;
        rightAngle = -Math.cos(this.clock * 4.2) * amp;
      }

      const leftPivotX = metrics.neckBase.x - metrics.faceWidth * 0.65;
      ctx.save();
      ctx.translate(leftPivotX, shoulderY);
      ctx.rotate(leftAngle);
      ctx.beginPath();
      ctx.rect(-armW * 0.8, 0, armW * 1.1, armH);
      ctx.clip();
      ctx.drawImage(this.personCanvas, -leftPivotX, -shoulderY);
      ctx.restore();

      const rightPivotX = metrics.neckBase.x + metrics.faceWidth * 0.65;
      ctx.save();
      ctx.translate(rightPivotX, shoulderY);
      ctx.rotate(rightAngle);
      ctx.beginPath();
      ctx.rect(-armW * 0.3, 0, armW * 1.1, armH);
      ctx.clip();
      ctx.drawImage(this.personCanvas, -rightPivotX, -shoulderY);
      ctx.restore();
    }

    _drawHeldProduct(ctx, metrics, cutLineY) {
      const boxSize = metrics.faceWidth * 0.95 * this.productScale;
      const handX = metrics.neckBase.x + metrics.faceWidth * 0.85;
      const floatY = Math.sin(this.clock * 3.2) * 5;
      const handY = Math.min(cutLineY - boxSize * 0.6, metrics.neckBase.y + metrics.faceWidth * 0.65) + floatY;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;

      // Bingkai kartu produk yang diangkat host
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(handX - boxSize / 2 - 4, handY - boxSize / 2 - 4, boxSize + 8, boxSize + 8, 10);
      ctx.fill();

      ctx.drawImage(this.activeProductImg, handX - boxSize / 2, handY - boxSize / 2, boxSize, boxSize);

      // Badge Promo kecil di sudut produk
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(handX - boxSize / 2, handY - boxSize / 2 - 12, 46, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('PROMO', handX - boxSize / 2 + 6, handY - boxSize / 2 - 2);
      ctx.restore();
    }


    _drawStudioBackground(ctx, W, H, theme) {
      if (this.bgImage) {
        const bgRatio = this.bgImage.width / this.bgImage.height;
        const canvasRatio = W / H;
        let bw, bh, bx, by;
        if (bgRatio > canvasRatio) {
          bh = H; bw = H * bgRatio; bx = (W - bw) / 2; by = 0;
        } else {
          bw = W; bh = W / bgRatio; bx = 0; by = (H - bh) / 2;
        }
        ctx.drawImage(this.bgImage, bx, by, bw, bh);
        const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, H * 0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0.05)');
        grad.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, theme.bgGradient[0]);
        grad.addColorStop(0.55, theme.bgGradient[1]);
        grad.addColorStop(1, theme.bgGradient[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.fillStyle = theme.rimColor;
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.arc(W * 0.2, H * 0.25, 90, 0, Math.PI * 2);
        ctx.arc(W * 0.82, H * 0.35, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    _prepareCutoutPerson(drawRect, theme) {
      const pCtx = this.personCtx;
      const W = this.personCanvas.width;
      const H = this.personCanvas.height;

      pCtx.clearRect(0, 0, W, H);
      pCtx.save();
      if (this.segmentationMask) {
        pCtx.drawImage(this.segmentationMask, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
        pCtx.globalCompositeOperation = 'source-in';
      }
      pCtx.drawImage(this.sourceImage, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
      pCtx.restore();

      const rCtx = this.rimCtx;
      rCtx.clearRect(0, 0, W, H);
      rCtx.save();
      rCtx.drawImage(this.personCanvas, 0, 0);
      rCtx.globalCompositeOperation = 'source-in';
      rCtx.fillStyle = theme.rimColor;
      rCtx.fillRect(0, 0, W, H);
      rCtx.restore();
    }

    _drawRimLightAura(ctx, theme) {
      ctx.save();
      ctx.filter = 'blur(10px)';
      ctx.globalAlpha = 0.78;
      ctx.drawImage(this.rimCanvas, -6, -4);
      ctx.drawImage(this.rimCanvas, 6, -4);
      ctx.restore();
    }

    _applyLipAndJawWarping(ctx, metrics) {
      if (this.speechEnergy < 0.02) return;
      const jawDrop = this.speechEnergy * (metrics.faceWidth * 0.095);
      const patchW = metrics.mouthWidth * 1.45;
      const patchH = (metrics.chinBottom.y - metrics.mouthCenter.y) * 1.25;
      if (patchW <= 4 || patchH <= 4) return;

      ctx.save();
      ctx.translate(metrics.mouthCenter.x, metrics.mouthCenter.y);
      ctx.rotate(metrics.rollAngle);

      const innerMouthH = jawDrop * 0.85;
      const innerMouthW = metrics.mouthWidth * 0.72;
      const grad = ctx.createRadialGradient(0, innerMouthH * 0.3, 1, 0, innerMouthH * 0.3, innerMouthW * 0.6);
      grad.addColorStop(0, '#2a080d');
      grad.addColorStop(0.75, '#4c111a');
      grad.addColorStop(1, 'rgba(76, 17, 26, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, innerMouthH * 0.35, innerMouthW * 0.5, Math.max(1.5, innerMouthH * 0.52), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, patchH * 0.45 + jawDrop * 0.5, patchW * 0.52, patchH * 0.58 + jawDrop * 0.4, 0, 0, Math.PI * 2);
      ctx.clip();

      ctx.rotate(-metrics.rollAngle);
      ctx.translate(-metrics.mouthCenter.x, -metrics.mouthCenter.y);

      const shiftX = -Math.sin(metrics.rollAngle) * jawDrop;
      const shiftY = Math.cos(metrics.rollAngle) * jawDrop;

      ctx.drawImage(
        this.personCanvas,
        metrics.mouthCenter.x - patchW,
        metrics.mouthCenter.y - 2,
        patchW * 2,
        patchH * 1.5,
        metrics.mouthCenter.x - patchW + shiftX,
        metrics.mouthCenter.y - 2 + shiftY,
        patchW * 2,
        patchH * 1.5 + jawDrop * 0.25
      );
      ctx.restore();
    }

    _drawRealisticWardrobe(ctx, metrics, theme) {
      const shoulderW = metrics.faceWidth * 2.35;
      const shoulderH = metrics.faceWidth * 1.35;

      ctx.save();
      ctx.translate(metrics.neckBase.x, metrics.neckBase.y);
      ctx.rotate(metrics.rollAngle * 0.45);

      if (theme.outfitType === 'blazer_formal') {
        const blazerGrad = ctx.createLinearGradient(0, 0, 0, shoulderH);
        blazerGrad.addColorStop(0, '#1e293b');
        blazerGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = blazerGrad;
        ctx.beginPath();
        ctx.ellipse(0, shoulderH * 0.42, shoulderW * 0.5, shoulderH * 0.52, 0, Math.PI, Math.PI * 2);
        ctx.fillRect(-shoulderW * 0.5, shoulderH * 0.42, shoulderW, shoulderH * 0.6);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-metrics.faceWidth * 0.32, 0);
        ctx.lineTo(0, shoulderH * 0.48);
        ctx.lineTo(metrics.faceWidth * 0.32, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (theme.outfitType === 'casual_hoodie') {
        const hoodieGrad = ctx.createLinearGradient(-shoulderW * 0.5, 0, shoulderW * 0.5, shoulderH);
        hoodieGrad.addColorStop(0, '#27272a');
        hoodieGrad.addColorStop(0.5, '#18181b');
        hoodieGrad.addColorStop(1, '#3b0764');
        ctx.fillStyle = hoodieGrad;
        ctx.beginPath();
        ctx.ellipse(0, shoulderH * 0.44, shoulderW * 0.52, shoulderH * 0.52, 0, Math.PI, Math.PI * 2);
        ctx.fillRect(-shoulderW * 0.52, shoulderH * 0.44, shoulderW * 1.04, shoulderH * 0.6);
        ctx.fill();

        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-metrics.faceWidth * 0.18, shoulderH * 0.12);
        ctx.lineTo(-metrics.faceWidth * 0.20, shoulderH * 0.45);
        ctx.moveTo(metrics.faceWidth * 0.18, shoulderH * 0.12);
        ctx.lineTo(metrics.faceWidth * 0.20, shoulderH * 0.45);
        ctx.stroke();
      } else {
        const shirtGrad = ctx.createLinearGradient(0, 0, 0, shoulderH);
        shirtGrad.addColorStop(0, '#b45309');
        shirtGrad.addColorStop(1, '#78350f');
        ctx.fillStyle = shirtGrad;
        ctx.beginPath();
        ctx.ellipse(0, shoulderH * 0.42, shoulderW * 0.5, shoulderH * 0.52, 0, Math.PI, Math.PI * 2);
        ctx.fillRect(-shoulderW * 0.5, shoulderH * 0.42, shoulderW, shoulderH * 0.6);
        ctx.fill();

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-metrics.faceWidth * 0.28, 0);
        ctx.lineTo(0, shoulderH * 0.52);
        ctx.lineTo(metrics.faceWidth * 0.28, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawStudioHeadset(ctx, metrics) {
      const earRadiusY = metrics.faceWidth * 0.22;
      const earRadiusX = metrics.faceWidth * 0.10;
      const headTopRadius = metrics.faceWidth * 0.56;

      ctx.save();
      ctx.translate(metrics.centerX, metrics.centerY);
      ctx.rotate(metrics.rollAngle);

      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = metrics.faceWidth * 0.085;
      ctx.beginPath();
      ctx.arc(0, -metrics.faceWidth * 0.05, headTopRadius, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();

      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -metrics.faceWidth * 0.05, headTopRadius + 2, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();

      [-headTopRadius, headTopRadius].forEach((offsetX, idx) => {
        const cupGrad = ctx.createLinearGradient(offsetX - earRadiusX, -earRadiusY, offsetX + earRadiusX, earRadiusY);
        cupGrad.addColorStop(0, '#3f3f46');
        cupGrad.addColorStop(0.5, '#18181b');
        cupGrad.addColorStop(1, '#09090b');

        ctx.fillStyle = cupGrad;
        ctx.beginPath();
        ctx.ellipse(offsetX, 0, earRadiusX, earRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d946ef';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(offsetX, 0, earRadiusX * 0.65, earRadiusY * 0.65, 0, 0, Math.PI * 2);
        ctx.stroke();

        if (idx === 0) {
          ctx.strokeStyle = '#27272a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(offsetX, earRadiusY * 0.5);
          ctx.quadraticCurveTo(
            offsetX * 0.7,
            metrics.faceWidth * 0.45,
            -metrics.mouthWidth * 0.65,
            metrics.faceWidth * 0.36
          );
          ctx.stroke();

          ctx.fillStyle = '#09090b';
          ctx.beginPath();
          ctx.ellipse(-metrics.mouthWidth * 0.65, metrics.faceWidth * 0.36, 9, 6, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();
    }

    _drawPlaceholderGuide(ctx, W, H) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '600 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Menunggu Scan / Foto Wajah di Tahap 2...', W / 2, H / 2);
      ctx.restore();
    }
  }

  global.AvatarStudio = new AvatarStudioEngine();
})(window);
