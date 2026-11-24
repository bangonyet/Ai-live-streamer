(function (global) {
  'use strict';

  const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/';
  const MEDIAPIPE_CDN = {
    segmentation: CDN_BASE + 'selfie_segmentation',
    faceMesh: CDN_BASE + 'face_mesh'
  };

  const NICHE_THEMES = {
    EDUKASI: {
      rimColor: 'rgba(56, 189, 248, 0.75)',
      ambientTint: 'rgba(14, 165, 233, 0.06)',
      bgGradient: ['#0f172a', '#1e293b', '#0284c7'],
      showHeadset: false
    },
    HIBURAN: {
      rimColor: 'rgba(192, 132, 252, 0.80)',
      ambientTint: 'rgba(168, 85, 247, 0.07)',
      bgGradient: ['#18181b', '#2e1065', '#701a75'],
      showHeadset: false
    },
    JUALAN: {
      rimColor: 'rgba(251, 191, 36, 0.78)',
      ambientTint: 'rgba(245, 158, 11, 0.06)',
      bgGradient: ['#1c1917', '#451a03', '#b45309'],
      showHeadset: false
    }
  };class AvatarStudioEngine {
    constructor() {
      this.canvas = null;
      this.ctx = null;

      this.personCanvas = document.createElement('canvas');
      this.personCtx = this.personCanvas.getContext('2d');

      this.maskCanvas = document.createElement('canvas');
      this.maskCtx = this.maskCanvas.getContext('2d');

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

      this.posX = 0;
      this.posY = 0;
      this.scale = 0.78;
      this.deskCutY = 0.62;
      this.glassDesk = false;

      this.activeProductImg = null;
      this.productScale = 1.0;
    }setTransform(opts = {}) {
      if (typeof opts.posX === 'number') this.posX = opts.posX;
      if (typeof opts.posY === 'number') this.posY = opts.posY;
      if (typeof opts.scale === 'number') this.scale = opts.scale;
      if (typeof opts.deskCutY === 'number') this.deskCutY = opts.deskCutY;
      if (typeof opts.glassDesk === 'boolean') this.glassDesk = opts.glassDesk;
    }

    setAspectRatio(ratio) {
      if (!this.canvas) return;
      if (ratio === '16:9') {
        this.canvas.width = 960;
        this.canvas.height = 540;
      } else {
        this.canvas.width = 540;
        this.canvas.height = 960;
      }
      this._syncBufferSizes();
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
        this.canvas.width = 540;
        this.canvas.height = 960;
      }

      this.ctx = this.canvas.getContext('2d');
      this._syncBufferSizes();
      this._startRenderLoop();
      await this._loadMediaPipeDependencies();
      return true;
    }

    _syncBufferSizes() {
      const w = this.canvas.width || 540;
      const h = this.canvas.height || 960;
      this.personCanvas.width = w;
      this.personCanvas.height = h;
      this.maskCanvas.width = w;
      this.maskCanvas.height = h;
      this.rimCanvas.width = w;
      this.rimCanvas.height = h;
    }async _loadMediaPipeDependencies() {
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
        if (this.sourceImage) {
          await this._processFaceAnalysis();
        }
      } catch (err) {
        console.error('[AvatarStudio] Gagal memuat MediaPipe:', err);
      }
                                }async setFaceImage(imageSource) {
      return new Promise((resolve, reject) => {
        if (typeof imageSource === 'string') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = async () => {
            this.sourceImage = img;
            this.segmentationMask = null;
            this.faceLandmarks = null;
            await this._processFaceAnalysis();
            resolve(true);
          };
          img.onerror = reject;
          img.src = imageSource;
        } else {
          this.sourceImage = imageSource;
          this.segmentationMask = null;
          this.faceLandmarks = null;
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

    startSpeaking() { this.isSpeaking = true; }

    stopSpeaking() {
      this.isSpeaking = false;
      this.targetSpeechEnergy = 0;
            }bindAudioElement(audioEl) {
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
        const wave = Math.sin(this.clock * 16) * 0.45
          + Math.sin(this.clock * 27) * 0.35
          + Math.cos(this.clock * 9) * 0.20;
        this.targetSpeechEnergy = Math.max(0.08, Math.min(1, 0.45 + wave));
      }
      this.speechEnergy += (this.targetSpeechEnergy - this.speechEnergy) * 0.38;
                                  }_getHeadMetrics(drawRect) {
      if (!this.faceLandmarks) {
        return {
          centerX: drawRect.x + drawRect.w * 0.5,
          centerY: drawRect.y + drawRect.h * 0.38,
          rollAngle: 0,
          faceWidth: drawRect.w * 0.32,
          mouthCenter: { x: drawRect.x + drawRect.w * 0.5, y: drawRect.y + drawRect.h * 0.46 },
          mouthWidth: drawRect.w * 0.11,
          chinBottom: { x: drawRect.x + drawRect.w * 0.5, y: drawRect.y + drawRect.h * 0.55 },
          neckBase: { x: drawRect.x + drawRect.w * 0.5, y: drawRect.y + drawRect.h * 0.62 }
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
    }_startRenderLoop() {
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
      const targetH = H * 0.85 * this.scale;
      const targetW = targetH * imgRatio;

      let breathY = Math.sin(this.clock * 2.0) * (H * 0.004);
      let swayX = Math.cos(this.clock * 1.1) * (W * 0.002);
      let idleTilt = Math.sin(this.clock * 1.3) * 0.010;

      if (this.niche === 'HIBURAN') {
        swayX = Math.sin(this.clock * 2.1) * (W * 0.004);
        idleTilt = Math.sin(this.clock * 2.1) * 0.016;
      } else if (this.niche === 'JUALAN') {
        breathY = Math.sin(this.clock * 2.8) * (H * 0.005);
      }

      const offsetX = (this.posX / 100) * (W * 0.35);
      const offsetY = (this.posY / 100) * (H * 0.35);

      const drawRect = {
        x: (W - targetW) / 2 + offsetX + swayX,
        y: (H * 0.18) + offsetY + breathY,
        w: targetW,
        h: targetH
      };

      const metrics = this._getHeadMetrics(drawRect);
      this._prepareCutoutPerson(drawRect, theme);
      const cutLineY = H * this.deskCutY;if (this.glassDesk) {
        const tableTopThickness = H * 0.055;
        const glassStartY = cutLineY + tableTopThickness;
        const glassEndY = H * 0.89;
        if (glassEndY > glassStartY) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, glassStartY, W, glassEndY - glassStartY);
          ctx.clip();

          ctx.translate(metrics.neckBase.x, metrics.neckBase.y);
          ctx.rotate(idleTilt);
          ctx.translate(-metrics.neckBase.x, -metrics.neckBase.y);

          ctx.globalAlpha = 0.28;
          ctx.filter = 'brightness(0.75)';
          ctx.drawImage(this.personCanvas, 0, 0);
          ctx.restore();
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, cutLineY);
      ctx.clip();
      this._drawRimLightAura(ctx, theme, metrics, idleTilt);

      ctx.translate(metrics.neckBase.x, metrics.neckBase.y);
      ctx.rotate(idleTilt);
      ctx.translate(-metrics.neckBase.x, -metrics.neckBase.y);

      ctx.drawImage(this.personCanvas, 0, 0);
      this._applyLipAndJawWarping(ctx, metrics);

      ctx.globalCompositeOperation = 'source-atop';
      const contactGrad = ctx.createLinearGradient(0, cutLineY - 22, 0, cutLineY);
      contactGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      contactGrad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = contactGrad;
      ctx.fillRect(drawRect.x - 20, cutLineY - 22, drawRect.w + 40, 24);
      ctx.restore();

      if (this.niche === 'JUALAN' && this.activeProductImg) {
        this._drawHeldProduct(ctx, metrics, cutLineY);
      }

      ctx.fillStyle = theme.ambientTint;
      ctx.fillRect(0, 0, W, H);
    }_drawHeldProduct(ctx, metrics, cutLineY) {
      const boxSize = Math.max(42, metrics.faceWidth * 0.95 * this.productScale);
      const handX = metrics.neckBase.x + metrics.faceWidth * 0.85;
      const floatY = Math.sin(this.clock * 3.2) * 5;
      const handY = Math.min(cutLineY - boxSize * 0.6, metrics.neckBase.y + metrics.faceWidth * 0.65) + floatY;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(handX - boxSize / 2 - 4, handY - boxSize / 2 - 4, boxSize + 8, boxSize + 8, 10);
      ctx.fill();

      ctx.drawImage(this.activeProductImg, handX - boxSize / 2, handY - boxSize / 2, boxSize, boxSize);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(handX - boxSize / 2, handY - boxSize / 2 - 14, 46, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('PROMO', handX - boxSize / 2 + 6, handY - boxSize / 2 - 4);
      ctx.restore();
    }

    _drawStudioBackground(ctx, W, H, theme) {
      if (this.bgImage) {
        const bgRatio = this.bgImage.width / this.bgImage.height;
        const canvasRatio = W / H;
        let cw, ch, cx, cy;
        if (bgRatio > canvasRatio) {
          ch = H; cw = H * bgRatio; cx = (W - cw) / 2; cy = 0;
        } else {
          cw = W; ch = W / bgRatio; cx = 0; cy = (H - ch) / 2;
        }
        ctx.drawImage(this.bgImage, cx, cy, cw, ch);

        const grad = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.25, W / 2, H / 2, Math.max(W, H) * 0.78);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.42)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, theme.bgGradient[0]);
        grad.addColorStop(0.55, theme.bgGradient[1]);
        grad.addColorStop(1, theme.bgGradient[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
                   }_prepareCutoutPerson(drawRect, theme) {
      const pCtx = this.personCtx;
      const mCtx = this.maskCtx;
      const W = this.personCanvas.width;
      const H = this.personCanvas.height;

      pCtx.clearRect(0, 0, W, H);
      pCtx.save();

      if (this.segmentationMask) {
        mCtx.clearRect(0, 0, W, H);
        mCtx.save();
        mCtx.filter = 'blur(1.8px)';
        mCtx.drawImage(this.segmentationMask, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
        mCtx.restore();

        pCtx.drawImage(this.maskCanvas, 0, 0);
        pCtx.globalCompositeOperation = 'source-in';
      }

      pCtx.filter = 'contrast(1.03) saturate(1.04)';
      pCtx.drawImage(this.sourceImage, drawRect.x, drawRect.y, drawRect.w, drawRect.h);

      pCtx.globalCompositeOperation = 'source-atop';
      pCtx.filter = 'none';
      const relightGrad = pCtx.createLinearGradient(0, drawRect.y, 0, drawRect.y + drawRect.h);
      relightGrad.addColorStop(0, theme.ambientTint);
      relightGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.05)');
      relightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
      pCtx.fillStyle = relightGrad;
      pCtx.fillRect(0, 0, W, H);
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

    _drawRimLightAura(ctx, theme, metrics, idleTilt) {
      ctx.save();
      ctx.translate(metrics.neckBase.x, metrics.neckBase.y);
      ctx.rotate(idleTilt);
      ctx.translate(-metrics.neckBase.x, -metrics.neckBase.y);

      ctx.filter = 'blur(5px)';
      ctx.globalAlpha = 0.25;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(this.rimCanvas, -2.5, -1);
      ctx.drawImage(this.rimCanvas, 2.5, -1);
      ctx.restore();
    }_applyLipAndJawWarping(ctx, metrics) {
      if (this.speechEnergy < 0.02) return;
      const jawDrop = this.speechEnergy * (metrics.faceWidth * 0.095);
      const patchW = metrics.mouthWidth * 1.45;
      const patchH = (metrics.chinBottom.y - metrics.mouthCenter.y) * 1.25;
      if (patchW <= 4 || patchH <= 4) return;

      const sx = Math.max(0, metrics.mouthCenter.x - patchW);
      const sy = Math.max(0, metrics.mouthCenter.y - 2);
      const sw = Math.min(this.personCanvas.width - sx, patchW * 2);
      const sh = Math.min(this.personCanvas.height - sy, patchH * 1.5);
      if (sw <= 2 || sh <= 2) return;

      ctx.save();
      ctx.translate(metrics.mouthCenter.x, metrics.mouthCenter.y);
      ctx.rotate(metrics.rollAngle);

      const innerMouthH = jawDrop * 0.85;
      const innerMouthW = metrics.mouthWidth * 0.72;
      const grad = ctx.createRadialGradient(0, innerMouthH * 0.3, 1, 0, innerMouthH * 0.3, Math.max(2, innerMouthW * 0.6));
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

      ctx.drawImage(this.personCanvas, sx, sy, sw, sh, sx + shiftX, sy + shiftY, sw, sh + jawDrop * 0.25);
      ctx.restore();
    }

    _drawPlaceholderGuide(ctx, W, H) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '600 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Menunggu Scan / Foto Wajah di Tahap 2...', W / 2, H / 2);
      ctx.restore();
    }
  }

  global.AvatarStudio = new AvatarStudioEngine();
})(window);
