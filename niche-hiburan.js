(function (global) {
  'use strict';

  const NicheHiburan = {
    queue: [],
    isPlayingMusic: false,

    activate() {
      const frame = document.getElementById('studioFrame');
      const boxUmum = document.getElementById('boxMateriUmum');
      const boxJualan = document.getElementById('boxMateriJualan');
      const titleEl = document.getElementById('materiBoxTitle');
      const inTitle = document.getElementById('liveTitleInput');
      const inScript = document.getElementById('liveScriptInput');
      const fEdu = document.getElementById('boxFiturEdukasi');
      const fHib = document.getElementById('boxFiturHiburan');
      const ovQna = document.getElementById('studioQnaOverlay');
      const ovEta = document.getElementById('studioEtalaseOverlay');

      if (frame) frame.style.borderColor = '#c084fc';
      if (boxUmum) boxUmum.style.display = 'block';
      if (boxJualan) boxJualan.style.display = 'none';
      if (fEdu) fEdu.style.display = 'none';
      if (fHib) fHib.style.display = 'block';
      if (ovQna) ovQna.style.display = 'none';
      if (ovEta) ovEta.style.display = 'none';

      if (titleEl) {
        titleEl.innerText = '🎭 Topik Hiburan & Obrolan Interaktif';
        titleEl.style.color = '#c084fc';
      }
      if (inTitle) inTitle.placeholder = 'Tema Live (misal: Karaoke Santai / Tebak-Tebakan Seru)';
      if (inScript) inScript.placeholder = 'Tulis topik obrolan santai, candaan, atau sapaan penonton...';

      this.syncLyricVisibility();
    },

    setMusicPlaying(playing) {
      this.isPlayingMusic = Boolean(playing);
      this.syncLyricVisibility();
    },

    syncLyricVisibility() {
      const ovKar = document.getElementById('studioKaraokeMini');
      if (!ovKar) return;
      const isHiburan = (global.data && global.data.niche === 'HIBURAN');
      if (isHiburan && this.isPlayingMusic) {
        ovKar.style.display = 'block';
        this.updateLyrics();
      } else {
        ovKar.style.display = 'none';
      }
    },

    updateLyrics() {
      const raw = (document.getElementById('karaokeLyricsIn')?.value || '').trim();
      const scrollEl = document.getElementById('karaokeLyricScroll');
      if (!scrollEl) return;
      if (raw) {
        scrollEl.innerText = '♪ ' + raw.replace(/\n+/g, '   •   ') + ' ♪';
      } else if (this.queue.length > 0) {
        scrollEl.innerText = '♪ Sedang Memutar: ' + this.queue.title + ' (' + this.queue.user + ') ♪';
      } else {
        scrollEl.innerText = '♪ Musik Karaoke Sedang Diputar... Selamat Bernyanyi! ♪';
      }
    },

    handleRequest(user, msg) {
      const cleanName = (user || '@penonton').replace('@', '');
      const reqMatch = String(msg || '').match(/(?:req|request|nyanyi|lagu)\s+(.+)/i);
      if (!reqMatch || !reqMatch) return false;

      const songTitle = reqMatch.trim();
      this.queue.push({ user: user || '@penonton', title: songTitle });
      this.renderQueue();
      const reply = 'Siap kak ' + cleanName + '! Request lagu ' + songTitle + ' sudah masuk antrean nomor ' + this.queue.length + ' ya, ditunggu sebentar!';
      const sub = document.getElementById('studioSubCaption');
      if (sub) sub.innerText = reply;
      if (typeof global.speakTextSafe === 'function') global.speakTextSafe(reply);

      if (this.queue.length === 1) {
        this.playNext();
      }
      return true;
    },

    renderQueue() {
      const box = document.getElementById('karaokeQueueBox');
      const txt = document.getElementById('karaokeQueueTxt');
      if (!box || !txt) return;
      box.style.display = 'block';
      txt.innerText = this.queue.length
        ? this.queue.map((item, i) => (i + 1) + '. ' + item.title + ' (' + item.user + ')').join(' | ')
        : 'Belum ada antrean';
    },

    playNext() {
      if (!this.queue.length) {
        this.setMusicPlaying(false);
        return;
      }
      const current = this.queue.shift();
      this.renderQueue();
      this.setMusicPlaying(true);

      const scrollEl = document.getElementById('karaokeLyricScroll');
      if (scrollEl) {
        scrollEl.innerText = '♪ Sedang Diputar: ' + current.title + ' (Request dari ' + current.user + ') • Selamat Bernyanyi! ♪';
      }
      const stat = document.getElementById('ytMusicStatus');
      if (stat) {
        stat.style.color = '#e879f9';
        stat.innerText = '🎤 Antrean Aktif: ' + current.title + ' (' + current.user + ')';
      }
    }
  };

  global.NicheHiburan = NicheHiburan;
})(window);
