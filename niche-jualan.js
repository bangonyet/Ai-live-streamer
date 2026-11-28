(function (global) {
  'use strict';

  const NicheJualan = {
    currentProductIdx: 0,

    activate() {
      const frame = document.getElementById('studioFrame');
      const boxUmum = document.getElementById('boxMateriUmum');
      const boxJualan = document.getElementById('boxMateriJualan');
      const fEdu = document.getElementById('boxFiturEdukasi');
      const fHib = document.getElementById('boxFiturHiburan');
      const ovQna = document.getElementById('studioQnaOverlay');
      const ovKar = document.getElementById('studioKaraokeMini');

      if (frame) frame.style.borderColor = '#34d399';
      if (boxUmum) boxUmum.style.display = 'none';
      if (boxJualan) boxJualan.style.display = 'block';
      if (fEdu) fEdu.style.display = 'none';
      if (fHib) fHib.style.display = 'none';
      if (ovQna) ovQna.style.display = 'none';
      if (ovKar) ovKar.style.display = 'none';

      if (global.data && global.data.products.length === 0) this.addProductRow();
      this.previewProduct(0);
    },

    addProductRow() {
      if (!global.data) return;
      const no = global.data.products.length + 1;
      global.data.products.push({ no, name: '', script: '', imgUrl: '' });
      const container = document.getElementById('productListContainer');
      if (!container) return;

      const idx = no - 1;
      const row = document.createElement('div');
      row.style.cssText = 'background:rgba(15,23,42,0.85);padding:8px;border-radius:8px;border:1px solid #334155';
      row.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">' +
          '<span style="font-size:11px;color:#fbbf24;font-weight:bold">Etalase No. ' + no + '</span>' +
          '<label style="font-size:10px;background:#334155;color:#38bdf8;padding:3px 7px;border-radius:5px;cursor:pointer">' +
            '📷 + Foto Produk<input type="file" accept="image/*" onchange="NicheJualan.setProductPhoto(' + idx + ', this)" style="display:none">' +
          '</label>' +
        '</div>' +
        '<input type="text" placeholder="Nama Produk" oninput="data.products[' + idx + '].name=this.value; NicheJualan.previewProduct(' + idx + ')" style="text-align:left;font-size:11px;padding:7px;margin-bottom:5px">' +
        '<input type="text" placeholder="Deskripsi / Promo Singkat" oninput="data.products[' + idx + '].script=this.value" style="text-align:left;font-size:11px;padding:7px;margin-bottom:0">';
      container.appendChild(row);
    },

    setProductPhoto(idx, inp) {
      if (inp.files && inp.files && global.data && global.data.products[idx]) {
        global.data.products[idx].imgUrl = URL.createObjectURL(inp.files);
        this.previewProduct(idx);
      }
    },

    previewProduct(idx) {
      const ov = document.getElementById('studioEtalaseOverlay');
      const p = global.data ? global.data.products[idx] : null;
      this.currentProductIdx = idx;
      if (ov && p) {
        ov.style.display = 'block';
        document.getElementById('etalaseBadgeTxt').innerText = '👇 Cek Keranjang • Etalase No. ' + p.no;
        document.getElementById('etalaseTitleTxt').innerText = p.name || 'Nama Produk';
        const imgEl = document.getElementById('etalaseProdImg');
        if (imgEl) {
          if (p.imgUrl) { imgEl.src = p.imgUrl; imgEl.style.display = 'block'; }
          else imgEl.style.display = 'none';
        }
        if (global.AvatarStudio && global.AvatarStudio.setActiveProduct) {
          global.AvatarStudio.setActiveProduct(p.imgUrl || null, 1.0);
        }
      }
    },
    getNextPitch() {
      const prods = global.data ? global.data.products : [];
      if (!prods.length) {
        return 'Yuk kak langsung cek keranjang kuning di bawah sebelum kehabisan stok promonya!';
      }
      const idx = this.currentProductIdx % prods.length;
      const p = prods[idx];
      this.previewProduct(idx);
      this.currentProductIdx = idx + 1;
      return `Cek etalase nomor ${p.no}, ${p.name || 'produk pilihan kami'}. ${p.script || 'Buruan di-checkout sebelum kehabisan ya kak!'}`;
    },

    handleSpillComment(user, msg) {
      const cleanName = (user || '@penonton').replace('@', '');
      const prods = global.data ? global.data.products : [];
      const numMatch = String(msg || '').toLowerCase().match(/(?:no|nomor|etalase)\s*(\d+)/);
      let idx = numMatch ? (parseInt(numMatch, 10) - 1) : 0;
      if (idx < 0 || idx >= prods.length) idx = 0;

      const prod = prods[idx];
      let reply = '';
      if (prod && prod.name) {
        this.previewProduct(idx);
        reply = 'Halo kak ' + cleanName + '! Ini dia etalase nomor ' + prod.no + ', ' + prod.name + '. '
          + (prod.script || 'Stok promonya terbatas banget, langsung klik keranjang kuning sekarang ya kak!');
      } else {
        reply = 'Halo kak ' + cleanName + ', selamat datang di live shopping kami! Langsung cek keranjang kuning di bawah ya kak!';
      }

      const sub = document.getElementById('studioSubCaption');
      if (sub) sub.innerText = reply;
      if (typeof global.speakTextSafe === 'function') global.speakTextSafe(reply);
    }
  };

  global.NicheJualan = NicheJualan;
})(window);
