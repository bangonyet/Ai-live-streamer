(function(global) {
  'use strict';
  const NicheEdukasi = {
    activate() {
      const f = document.getElementById('studioFrame');
      if (f) f.style.borderColor = '#38bdf8';
      ['boxMateriUmum', 'boxFiturEdukasi'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; });
      ['boxMateriJualan', 'boxFiturHiburan', 'studioEtalaseOverlay', 'studioKaraokeMini'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      if (typeof global.setStudioBg === 'function') global.setStudioBg('image', 'studio-edukasi.jpg');
    },
    loadTxtFile(inp) {
      if (!inp.files || !inp.files[0]) return;
      const r = new FileReader();
      r.onload = e => {
        const sc = document.getElementById('liveScriptInput');
        if (sc) { sc.value = e.target.result || ''; this.updateStats(); if (typeof global.syncLiveMateri === 'function') global.syncLiveMateri(); }
      };
      r.readAsText(inp.files[0]);
    },
    updateStats() {
      const txt = (document.getElementById('liveScriptInput')?.value || '').trim();
      const words = txt ? txt.split(/\s+/).length : 0;
      const st = document.getElementById('eduMateriStats');
      if (st) st.innerText = `📊 ${words} kata siap dibacakan (~${Math.max(1, Math.ceil(words / 130))} menit live)`;
    },
    async handleQna(user, q) {
      const clean = (user || '@penonton').replace('@', '');
      const ov = document.getElementById('studioQnaOverlay');
      if (ov) { ov.style.display = 'block'; document.getElementById('qnaAskUser').innerText = '💬 ' + (user || '@penonton'); document.getElementById('qnaAskText').innerText = q; }
      const materi = (document.getElementById('liveScriptInput')?.value || '').split('\n').filter(Boolean);
      const topik = document.getElementById('liveTitleInput')?.value || 'topik kita hari ini';
      const kunci = q.toLowerCase().split(/\s+/).find(w => w.length > 3) || '';
      const cocok = materi.find(m => kunci && m.toLowerCase().includes(kunci));
      const jawab = cocok
        ? `Halo kak ${clean}, pertanyaan bagus! Terkait ${q}, ${cocok}`
        : `Halo kak ${clean}, terima kasih sudah bertanya soal ${q}. Pada pembahasan ${topik}, hal ini sangat penting dipahami bertahap ya kak!`;
      const sub = document.getElementById('studioSubCaption');
      if (sub) sub.innerText = jawab;
      if (typeof global.speakTextSafe === 'function') global.speakTextSafe(jawab);
    }
  };
  global.NicheEdukasi = NicheEdukasi;
})(window);
