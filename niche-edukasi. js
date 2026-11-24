(function (global) {
  'use strict';

  const PROTO = 'ht' + 'tps://';
  const WIKI_API = PROTO + 'id.wikipedia.org/api/rest_v1/page/summary/';

  const NicheEdukasi = {
    chunks: [],
    currentIndex: 0,

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
      const ovKar = document.getElementById('studioKaraokeMini');
      const ovEta = document.getElementById('studioEtalaseOverlay');

      if (frame) frame.style.borderColor = '#38bdf8';
      if (boxUmum) boxUmum.style.display = 'block';
      if (boxJualan) boxJualan.style.display = 'none';
      if (fEdu) fEdu.style.display = 'block';
      if (fHib) fHib.style.display = 'none';
      if (ovQna) ovQna.style.display = 'none';
      if (ovKar) ovKar.style.display = 'none';
      if (ovEta) ovEta.style.display = 'none';

      if (titleEl) {
        titleEl.innerText = '📚 Materi Edukasi & Poin Penjelasan';
        titleEl.style.color = '#38bdf8';
      }
      if (inTitle) inTitle.placeholder = 'Judul Materi (misal: Tips Belajar Bahasa Inggris)';
      if (inScript) inScript.placeholder = 'Tulis atau tempel materi panjang di sini (bisa berjam-jam)...';

      if (typeof global.setStudioBg === 'function') {
        global.setStudioBg('image', 'studio-edukasi.jpg');
      }
      this.updateStats();
    },

    loadTxtFile(input) {
      if (!input.files || !input.files[0]) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = String(e.target.result || '').trim();
        const inScript = document.getElementById('liveScriptInput');
        if (inScript) {
          inScript.value = content;
          if (typeof global.syncLiveMateri === 'function') global.syncLiveMateri();
          this.updateStats();
        }
      };
      reader.readAsText(input.files[0]);
    },

    updateStats() {
      const raw = (document.getElementById('liveScriptInput')?.value || '').trim();
      const statEl = document.getElementById('eduMateriStats');
      const words = raw ? raw.split(/\s+/).length : 0;
      const mins = Math.max(1, Math.round(words / 130));
      const durText = mins >= 60
        ? Math.floor(mins / 60) + ' jam ' + (mins % 60) + ' menit'
        : mins + ' menit';

      this.chunks = this.splitIntoSafeChunks(raw);
      if (statEl) {
        statEl.innerText = words > 0
          ? `📊 Total: ${words.toLocaleString('id-ID')} kata • Estimasi siaran: ~${durText} (${this.chunks.length} segmen)`
          : '📊 Mendukung materi panjang hingga puluhan ribu kata (anti-macet)';
      }
    },

    splitIntoSafeChunks(text) {
      if (!text) return [];
      const rawSentences = text
        .replace(/\r\n/g, '\n')
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(Boolean);

      const result = [];
      for (const sentence of rawSentences) {
        if (sentence.length <= 150) {
          result.push(sentence);
        } else {
          const parts = sentence.match(/.{1,145}(?:\s|$)/g) || [sentence];
          parts.forEach(p => { if (p.trim()) result.push(p.trim()); });
        }
      }
      return result;
    },

    getNextChunk() {
      const raw = (document.getElementById('liveScriptInput')?.value || '').trim();
      if (!this.chunks.length && raw) {
        this.chunks = this.splitIntoSafeChunks(raw);
      }
      if (!this.chunks.length) {
        return 'Terima kasih yang sudah bergabung di live edukasi hari ini, tulis pertanyaan kalian di kolom komentar ya!';
      }
      const line = this.chunks[this.currentIndex % this.chunks.length];
      this.currentIndex++;
      return line;
    },

    async handleQna(user, question) {
      const cleanUser = (user || '@penonton').trim();
      const q = (question || '').trim();
      if (!q) return;

      const ov = document.getElementById('studioQnaOverlay');
      if (ov) {
        ov.style.display = 'block';
        document.getElementById('qnaAskUser').innerText = '💬 Pertanyaan dari ' + cleanUser;
        document.getElementById('qnaAskText').innerText = q;
      }

      const lowQ = q.toLowerCase();
      const keywords = lowQ.replace(/[?!.,]/g, '').split(' ').filter(w => w.length > 3);
      let matched = this.chunks.find(c => keywords.some(k => c.toLowerCase().includes(k)));

      if (!matched) {
        try {
          const topic = lowQ.replace(/^(apa itu|siapa|jelaskan|pengertian|cara|kenapa|mengapa)\s+/i, '').trim();
          const res = await fetch(WIKI_API + encodeURIComponent(topic.replace(/[?!.]/g, '')));
          if (res.ok) {
            const json = await res.json();
            if (json && json.extract) {
              matched = json.extract.split('. ').slice(0, 2).join('. ') + '.';
            }
          }
        } catch (e) {}
      }

      const answer = 'Pertanyaan bagus dari ' + cleanUser.replace('@', '') + '! '
        + (matched || 'Poin pentingnya adalah kita perlu konsisten mempraktikkan langkah-langkah sesuai materi kita hari ini.');

      const sub = document.getElementById('studioSubCaption');
      if (sub) sub.innerText = answer;
      if (typeof global.speakTextSafe === 'function') global.speakTextSafe(answer);
    }
  };

  global.NicheEdukasi = NicheEdukasi;
})(window);
