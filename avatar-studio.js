(function(global) {
  'use strict';
  const BG_MAP = { EDUKASI: 'studio-edukasi.jpg', HIBURAN: 'studio-hiburan.jpeg', JUALAN: 'studio-jualan.jpeg' };
  const HF_SPACES = ['Dentro/face-swap', 'tonyassi/face-swap'];

  class AIFaceSwapStudio {
    constructor() {
      this.canvas = null; this.ctx = null;
      this.swappedImg = null; this.baseImg = null; this.faceDataUrl = null;
      this.niche = 'EDUKASI'; this.hostStyle = 'Mentor Edukasi';
      this.isSpeaking = false; this.energy = 0; this.clock = 0; this.isSwapping = false;
      this.rig = { headScale: 1, bodyScale: 1, cameraAngle: 'medium', posX: 0, posY: 0 };
    }
    async init(sel) {
      this.canvas = document.querySelector(sel);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      await this._loadBaseTemplate(BG_MAP[this.niche]);
      const loop = () => { this.clock += 0.016; this._render(); requestAnimationFrame(loop); };
      loop();
    }
    _loadBaseTemplate(url) {
      return new Promise(res => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => { this.baseImg = img; res(img); };
        img.onerror = () => res(null);
        img.src = url;
      });
    }
    async setFaceImage(src) {
      if (!src) return false;
      this.faceDataUrl = src;
      await this._runAIFaceSwap();
      return true;
    }
    async _toBlob(src) {
      if (!src) return null;
      const r = await fetch(src);
      return await r.blob();
    }
    async _runAIFaceSwap() {
      if (!this.faceDataUrl || !this.baseImg || this.isSwapping) return;
      this.isSwapping = true;
      const sub = document.getElementById('studioSubCaption');
      if (sub) sub.innerText = '⏳ AI sedang menyatukan wajah ke studio...';
      try {
        const { Client } = await import('https://jsdelivr.net');
        const srcBlob = await this._toBlob(this.faceDataUrl);
        const dstBlob = await this._toBlob(this.baseImg.src);
        for (const space of HF_SPACES) {
          try {
            const app = await Client.connect(space);
            const res = await app.predict('/predict', [srcBlob, dstBlob]);
            const outUrl = res?.data?.[0]?.url || res?.data?.[0];
            if (outUrl) {
              const outImg = new Image(); outImg.crossOrigin = 'anonymous';
              await new Promise((ok, err) => { outImg.onload = ok; outImg.onerror = err; outImg.src = outUrl; });
              this.swappedImg = outImg;
              if (sub) sub.innerText = '✅ Avatar Realistis Siap Live!';
              break;
            }
          } catch (e) {}
        }
      } catch (err) {
        if (sub) sub.innerText = '⚠️ Server AI sibuk, memakai mode studio standar';
      }
      this.isSwapping = false;
    }
    _render() {
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, t = this.clock;
      const targetE = this.isSpeaking ? (0.3 + Math.abs(Math.sin(t * 14)) * 0.7) : 0;
      this.energy += (targetE - this.energy) * 0.3;
      ctx.clearRect(0, 0, W, H);
      if (!this.faceDataUrl && global.savedAvatarData?.src) this.setFaceImage(global.savedAvatarData.src);
      const activeImg = this.swappedImg || this.baseImg;
      if (activeImg) {
        const zoom = this.rig.cameraAngle === 'closeup' ? 1.28 : (this.rig.cameraAngle === 'wide' ? 0.92 : 1.0);
        const sc = (this.rig.bodyScale || 1) * zoom;
        const r = Math.max(W / activeImg.width, H / activeImg.height) * sc;
        const nw = activeImg.width * r, nh = activeImg.height * r;
        const dx = (W - nw) / 2 + (this.rig.posX || 0) * 1.5;
        const dy = (H - nh) / 2 + (this.rig.posY || 0) * 1.5 + Math.sin(t * 2.1) * 2.5;
        ctx.drawImage(activeImg, dx, dy, nw, nh);
        if (this.energy > 0.05) {
          ctx.save(); ctx.globalAlpha = 0.25;
          ctx.drawImage(activeImg, dx, dy + this.energy * 3.5, nw, nh);
          ctx.restore();
        }
      }
      if (this.isSwapping) {
        ctx.fillStyle = 'rgba(6,9,19,0.65)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('⏳ AI Face-Swap...', W / 2, H / 2);
      }
    }
    async setNiche(n) { this.niche = n || 'EDUKASI'; this.swappedImg = null; await this._loadBaseTemplate(BG_MAP[this.niche]); if (this.faceDataUrl) this._runAIFaceSwap(); }
    applyNichePreset(n) { this.setNiche(n); return { defaultPosY: 0, defaultScale: 1, defaultDeskCut: 0.62 }; }
    setHostStyle(s) { this.hostStyle = s; } setRig(o) { Object.assign(this.rig, o); } setTransform(o) { Object.assign(this.rig, o); }
    setWearable() {} setActiveProduct() {} bindAudioElement() {}
    setAspectRatio(r) { if (this.canvas) { this.canvas.width = r === '16:9' ? 960 : 540; this.canvas.height = r === '16:9' ? 540 : 960; } }
    startSpeaking() { this.isSpeaking = true; } stopSpeaking() { this.isSpeaking = false; }
    async uploadCustomBackground(f) {
      const u = f instanceof Blob ? URL.createObjectURL(f) : f;
      this.swappedImg = null; await this._loadBaseTemplate(u); if (this.faceDataUrl) this._runAIFaceSwap();
      return { ok: true, hideFurniture: true };
    }
  }
  global.AvatarStudio = new AIFaceSwapStudio();
})(window);
