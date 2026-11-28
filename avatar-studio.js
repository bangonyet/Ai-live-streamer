(function(global) {
  'use strict';
  const BG_MAP = {
    EDUKASI: 'studio-edukasi.jpg',
    HIBURAN: 'studio-hiburan.jpeg',
    JUALAN: 'studio-jualan.jpeg'
  };
  class PhotorealAvatarStudio {
    constructor() {
      this.canvas = null; this.ctx = null;
      this.faceCanvas = document.createElement('canvas');
      this.faceCtx = this.faceCanvas.getContext('2d');
      this.faceImg = null; this.faceBox = null; this.bgImg = null;
      this.niche = 'EDUKASI'; this.hostStyle = 'Mentor Edukasi';
      this.isSpeaking = false; this.energy = 0; this.clock = 0;
      this.rig = { headScale: 1, bodyScale: 1, armPose: 0, legSpread: 0, yawAngle: 0, micAngle: -25, cameraAngle: 'medium', posX: 0, posY: 0 };
    }
    async init(sel) {
      this.canvas = document.querySelector(sel);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.faceCanvas.width = 320; this.faceCanvas.height = 380;
      this.setBackground(BG_MAP[this.niche]);
      const loop = () => { this.clock += 0.016; this._render(); requestAnimationFrame(loop); };
      loop();
    }
    setBackground(url) {
      if (!url) return;
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { this.bgImg = img; }; img.src = url;
    }
    setFaceImage(src, box) {
      if (!src) return Promise.resolve(false);
      return new Promise(res => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => { this.faceImg = img; this.faceBox = box; this._buildFeatheredFace(); res(true); };
        img.src = src;
      });
    }
    _buildFeatheredFace() {
      if (!this.faceImg) return;
      const ctx = this.faceCtx, w = this.faceCanvas.width, h = this.faceCanvas.height;
      ctx.clearRect(0, 0, w, h);
      const iw = this.faceImg.naturalWidth || 480, ih = this.faceImg.naturalHeight || 640;
      let sx = iw * 0.22, sy = ih * 0.1, sw = iw * 0.56, sh = ih * 0.62;
      if (this.faceBox && this.faceBox.width > 0) {
        const b = this.faceBox;
        sx = Math.max(0, b.x - b.width * 0.35); sy = Math.max(0, b.y - b.height * 0.45);
        sw = Math.min(iw - sx, b.width * 1.7); sh = Math.min(ih - sy, b.height * 1.8);
      }
      ctx.save();
      ctx.filter = 'contrast(1.06) saturate(1.08) brightness(0.96)';
      ctx.drawImage(this.faceImg, sx, sy, sw, sh, 0, 0, w, h);
      ctx.restore();
      ctx.globalCompositeOperation = 'destination-in';
      const mask = ctx.createRadialGradient(w * 0.5, h * 0.46, w * 0.24, w * 0.5, h * 0.48, w * 0.48);
      mask.addColorStop(0, 'rgba(0,0,0,1)');
      mask.addColorStop(0.72, 'rgba(0,0,0,0.92)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mask; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    _render() {
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, t = this.clock;
      const targetE = this.isSpeaking ? (0.3 + Math.abs(Math.sin(t * 14)) * 0.7) : 0;
      this.energy += (targetE - this.energy) * 0.32;
      ctx.clearRect(0, 0, W, H);
      if (this.bgImg) {
        const r = Math.max(W / this.bgImg.width, H / this.bgImg.height);
        const nw = this.bgImg.width * r, nh = this.bgImg.height * r;
        ctx.drawImage(this.bgImg, (W - nw) / 2, (H - nh) / 2, nw, nh);
      } else {
        ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, W, H);
      }
      if (!this.faceImg && global.savedAvatarData?.src) {
        this.setFaceImage(global.savedAvatarData.src, global.savedAvatarData.box);
      }
      this._renderRealisticHost(ctx, W, H, t);
    }
    _renderRealisticHost(ctx, W, H, t) {
      const zoom = this.rig.cameraAngle === 'closeup' ? 1.32 : (this.rig.cameraAngle === 'wide' ? 0.85 : 1.0);
      const sc = (this.rig.bodyScale || 1) * zoom;
      const cx = W * 0.5 + (this.rig.posX || 0) * 1.4;
      const by = H * 0.62 + (this.rig.posY || 0) * 1.4 + Math.sin(t * 2.1) * 2.5;
      const rim = this.niche === 'HIBURAN' ? 'rgba(232,121,249,0.55)' : (this.niche === 'JUALAN' ? 'rgba(251,191,36,0.45)' : 'rgba(56,189,248,0.55)');
      // Siluet Bahu & Hoodie Realistis Menyatu dengan Kursi Studio
      ctx.save();
      const bodyG = ctx.createLinearGradient(cx - 110 * sc, by - 70 * sc, cx + 110 * sc, by + 160 * sc);
      bodyG.addColorStop(0, '#0f172a'); bodyG.addColorStop(0.5, '#1e293b'); bodyG.addColorStop(1, '#090d16');
      ctx.fillStyle = bodyG; ctx.shadowColor = rim; ctx.shadowBlur = 18 * sc;
      ctx.beginPath(); ctx.ellipse(cx, by + 85 * sc, 118 * sc, 155 * sc, 0, Math.PI, 0); ctx.fill();
      ctx.restore();
      // Kepala & Wajah Fotorealistis dengan Rim Light Studio + Gerak Napas/Bicara
      const hSc = sc * (this.rig.headScale || 1);
      const headY = by - 95 * sc + Math.sin(t * 5.5) * (this.energy * 3.5 * hSc);
      const tilt = Math.sin(t * 1.4) * 0.018 + Math.sin(t * 4.8) * (this.energy * 0.03);
      ctx.save(); ctx.translate(cx, headY); ctx.rotate(tilt);
      ctx.shadowColor = rim; ctx.shadowBlur = 22 * hSc;
      if (this.faceImg) {
        const fw = 158 * hSc, fh = 188 * hSc;
        ctx.drawImage(this.faceCanvas, -fw / 2, -fh / 2, fw, fh);
        // Animasi Bibir & Rahang Organik Saat Berbicara
        if (this.energy > 0.04) {
          ctx.save(); ctx.globalAlpha = Math.min(0.85, this.energy * 0.9);
          ctx.drawImage(this.faceCanvas, 65, 225, 190, 120, -fw * 0.28, fh * 0.14 + this.energy * 7 * hSc, fw * 0.56, fh * 0.32);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    setNiche(n) { this.niche = n || 'EDUKASI'; this.setBackground(BG_MAP[this.niche]); }
    applyNichePreset(n) { this.setNiche(n); return { defaultPosY: 0, defaultScale: 1, defaultDeskCut: 0.62 }; }
    setHostStyle(s) { this.hostStyle = s; }
    setRig(o) { Object.assign(this.rig, o); }
    setTransform(o) { Object.assign(this.rig, o); }
    setWearable() {} setActiveProduct() {} bindAudioElement() {}
    setAspectRatio(r) { if (this.canvas) { this.canvas.width = r === '16:9' ? 960 : 540; this.canvas.height = r === '16:9' ? 540 : 960; } }
    startSpeaking() { this.isSpeaking = true; } stopSpeaking() { this.isSpeaking = false; }
    uploadCustomBackground(f) {
      const u = f instanceof Blob ? URL.createObjectURL(f) : f;
      this.setBackground(u); return Promise.resolve({ ok: true, hideFurniture: true });
    }
  }
  global.AvatarStudio = new PhotorealAvatarStudio();
})(window);
