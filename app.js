'use strict';
// ── Instellingen ─────────────────────────────
const W = 15026, H = 8452;      // afmetingen van vloer.png in pixels
const MAX = 0.6;                // maximale zoom (schaal)
const EXPORT = 0.25;            // PNG-export op 25% van de originele vloer
const NOTE_BAR = 300;           // hoogte notitie-balk (zelfde als in style.css)

const $ = s => document.querySelector(s);
const vp = $('#viewport'), floor = $('#floor'), tb = $('#toolbar');
const nameInput = $('#layout-name'), slider = $('#zoom-slider'), readout = $('#zoom-readout');
let s = 0.09, fit = 0.09, tx = 0, ty = 0, sel = null, drag = null;

// ══ 1. Weergave: zoomen + verschuiven ════════
function applyView() {
  const w = vp.clientWidth, h = vp.clientHeight;
  s = Math.min(MAX, Math.max(fit, s));
  tx = W * s <= w ? (w - W * s) / 2 : Math.min(0, Math.max(w - W * s, tx));
  ty = H * s <= h ? (h - H * s) / 2 : Math.min(0, Math.max(h - H * s, ty));
  floor.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  floor.style.setProperty('--s', s);
  slider.value = Math.log(s / fit) / Math.log(MAX / fit) * 100;
  readout.textContent = Math.round(s / fit * 100) + '%';
  placeToolbar();
}
function zoomAt(ns, cx, cy) {                       // cx, cy = punt in de viewport dat blijft staan
  ns = Math.min(MAX, Math.max(fit, ns));
  tx = cx - (cx - tx) * ns / s;
  ty = cy - (cy - ty) * ns / s;
  s = ns; applyView();
}
const mid = () => [vp.clientWidth / 2, vp.clientHeight / 2];
function refit() {
  const z = s / fit;
  fit = Math.min(vp.clientWidth / W, vp.clientHeight / H);
  s = fit * z; applyView();
}
vp.addEventListener('wheel', e => {
  e.preventDefault();
  const r = vp.getBoundingClientRect(), d = e.deltaMode ? e.deltaY * 33 : e.deltaY;
  zoomAt(s * Math.exp(-d * 0.0015), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
$('#zoom-in').onclick  = () => zoomAt(s * 1.25, ...mid());
$('#zoom-out').onclick = () => zoomAt(s / 1.25, ...mid());
readout.onclick        = () => { s = fit; applyView(); };
slider.oninput         = () => zoomAt(fit * Math.pow(MAX / fit, slider.value / 100), ...mid());
window.addEventListener('resize', refit);

// ══ 2. Toestellen en notities plaatsen ═══════
const centre = () => ({ x: (vp.clientWidth / 2 - tx) / s, y: (vp.clientHeight / 2 - ty) / s });

function addItem(d, x, y, centred) {
  const el = document.createElement('div'), img = new Image();
  el.className = 'item';
  Object.assign(el.dataset, { id: d.id, label: d.label, img: d.img, rot: d.rot || 0, faded: d.faded ? 1 : 0 });
  el.style.transform = `rotate(${d.rot || 0}deg)`;
  el.style.opacity = d.faded ? 0.5 : 1;
  const put = () => {
    el.style.left = (centred ? x - el.offsetWidth / 2 : x) + 'px';
    el.style.top  = (centred ? y - el.offsetHeight / 2 : y) + 'px';
    placeToolbar();
  };
  img.draggable = false; img.alt = d.label;
  img.onload = put; img.src = d.img;
  el.append(img); floor.append(el);
  if (!centred) put();
  return el;
}

function addNote(d) {
  const n = document.createElement('div');
  n.className = 'note'; n.dataset.rot = d.rot || 0;
  n.innerHTML = '<div class="note-bar">📝<button class="note-del" title="Verwijderen">✕</button></div>' +
                '<textarea placeholder="Notitie…"></textarea><div class="note-resize"></div>';
  n.querySelector('textarea').value = d.text || '';
  n.style.cssText = `left:${d.x}px;top:${d.y}px;width:${Math.max(d.w || 0, 1500)}px;height:${Math.max(d.h || 0, 900)}px;` +
                    `transform:rotate(${d.rot || 0}deg)`;
  n.querySelector('.note-del').onclick = () => { if (sel === n) select(null); n.remove(); };
  floor.append(n);
  return n;
}

$('.sidebar').addEventListener('click', e => {
  const head = e.target.closest('.category-header');
  if (head) { const c = head.parentElement; c.dataset.open = c.dataset.open === 'true' ? 'false' : 'true'; return; }
  const li = e.target.closest('.equipment-item');
  if (li) {
    const c = centre();
    select(addItem({ id: li.dataset.id, label: li.dataset.label, img: li.dataset.img }, c.x, c.y, true));
  }
});
$('#btn-note').onclick = () => { const c = centre(); select(addNote({ x: c.x - 1100, y: c.y - 650 })); };

// Teller per toestel in de sidebar
new MutationObserver(() => {
  document.querySelectorAll('.item-count').forEach(b => {
    const n = floor.querySelectorAll(`.item[data-id="${b.dataset.for}"]`).length;
    b.textContent = n; b.classList.toggle('active', n > 0);
  });
}).observe(floor, { childList: true });

// ══ 3. Selecteren + knopjes boven het toestel ═
function select(el) {
  if (sel) sel.classList.remove('sel');
  sel = el;
  if (el) el.classList.add('sel');
  placeToolbar();
}
function placeToolbar() {
  if (!sel || !sel.classList.contains('item')) { tb.hidden = true; return; }
  const r = sel.getBoundingClientRect(), a = vp.getBoundingClientRect();
  const visible = r.right > a.left && r.left < a.right && r.bottom > a.top && r.top < a.bottom;
  tb.hidden = !visible;
  if (!visible) return;
  const w = tb.offsetWidth, h = tb.offsetHeight;
  let top = r.top - h - 8;
  if (top < a.top + 4) top = r.bottom + 8;
  top = Math.max(a.top + 4, Math.min(top, a.bottom - h - 4));
  tb.style.top = top + 'px';
  tb.style.left = Math.max(a.left + 4, Math.min(r.left + r.width / 2 - w / 2, a.right - w - 4)) + 'px';
}
$('#tb-fade').onclick = () => {
  if (!sel) return;
  const f = sel.dataset.faded !== '1';
  sel.dataset.faded = f ? 1 : 0; sel.style.opacity = f ? 0.5 : 1;
};
$('#tb-del').onclick = () => { if (sel) { const el = sel; select(null); el.remove(); } };
$('#tb-rot').addEventListener('pointerdown', e => { e.preventDefault(); drag = { k: 'rot' }; });
window.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !/TEXTAREA|INPUT/.test(document.activeElement.tagName)) {
    const el = sel; select(null); el.remove();
  }
});

// ══ 4. Slepen: verplaatsen, draaien, formaat, pannen ═
vp.addEventListener('pointerdown', e => {
  const t = e.target;
  if (e.button || t.closest('#zoom-bar') || t.closest('.note-del')) return;
  const item = t.closest('.item'), note = t.closest('.note');
  if (document.activeElement.blur) document.activeElement.blur();
  if (t.classList.contains('note-resize')) {
    select(note);
    drag = { k: 'size', el: note, x: e.clientX, y: e.clientY, w: note.offsetWidth, h: note.offsetHeight };
  } else if (item || t.closest('.note-bar')) {
    const el = item || note; select(el);
    drag = { k: 'move', el, x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop };
  } else if (note) { select(note); return; }            // klik in de tekst: gewoon typen
  else drag = { k: 'pan', x: e.clientX, y: e.clientY, tx, ty, moved: false };
  e.preventDefault();
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (drag.k === 'pan') {
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    tx = drag.tx + dx; ty = drag.ty + dy; applyView();
  } else if (drag.k === 'move') {
    const el = drag.el;
    el.style.left = Math.max(0, Math.min(drag.l + dx / s, W - el.offsetWidth)) + 'px';
    el.style.top  = Math.max(0, Math.min(drag.t + dy / s, H - el.offsetHeight)) + 'px';
    placeToolbar();
  } else if (drag.k === 'size') {
    drag.el.style.width  = Math.max(800, drag.w + dx / s) + 'px';
    drag.el.style.height = Math.max(600, drag.h + dy / s) + 'px';
  } else if (drag.k === 'rot' && sel) {
    const r = sel.getBoundingClientRect();
    let a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI + 90;
    a = e.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
    sel.dataset.rot = a; sel.style.transform = `rotate(${a}deg)`;
    placeToolbar();
  }
});
const endDrag = () => { if (drag && drag.k === 'pan' && !drag.moved) select(null); drag = null; };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

// ══ 5. Opslaan / inladen / PNG / verwijderen ═
const slug = t => t.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-');
function needName() {
  const n = nameInput.value.trim();
  if (!n) { alert('Geef de indeling eerst een naam.'); nameInput.focus(); }
  return n;
}
function download(href, file) { const a = document.createElement('a'); a.href = href; a.download = file; a.click(); }

$('#btn-save').onclick = () => {
  const name = needName(); if (!name) return;
  const items = [...floor.children].map(el => el.classList.contains('item')
    ? { type: 'item', id: el.dataset.id, label: el.dataset.label, img: el.dataset.img, x: el.offsetLeft, y: el.offsetTop,
        rotation: +el.dataset.rot, faded: el.dataset.faded === '1' }
    : { type: 'note', text: el.querySelector('textarea').value, x: el.offsetLeft, y: el.offsetTop,
        width: el.offsetWidth, height: el.offsetHeight, rotation: +el.dataset.rot });
  const blob = new Blob([JSON.stringify({ version: 2, name, savedAt: new Date().toISOString(), items }, null, 2)], { type: 'application/json' });
  download(URL.createObjectURL(blob), `indeling-${slug(name)}.json`);
};

function clearAll() { select(null); floor.replaceChildren(); }
$('#btn-clear').onclick = () => { if (confirm('Alles verwijderen en opnieuw beginnen?')) clearAll(); };

$('#file-load').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let p;
    try { p = JSON.parse(r.result); if (!Array.isArray(p.items)) throw 0; }
    catch { alert('Dit is geen geldig indelingsbestand (.json).'); return; }
    clearAll();
    nameInput.value = p.name || '';
    p.items.forEach(i => i.type === 'note'
      ? addNote({ text: i.text, x: i.x, y: i.y, w: i.width, h: i.height, rot: i.rotation })
      : addItem({ id: i.id, label: i.label, img: i.img, rot: i.rotation, faded: i.faded }, i.x, i.y));
  };
  r.readAsText(f); e.target.value = '';
};

// PNG: we tekenen zelf op een canvas (geen extra bibliotheek nodig)
$('#btn-png').onclick = async () => {
  const name = needName(); if (!name) return;
  select(null);
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = Math.round(W * EXPORT); c.height = Math.round(H * EXPORT);
  try {
    const bg = new Image(); bg.src = 'vloer.png'; await bg.decode();
    g.drawImage(bg, 0, 0, c.width, c.height);
    for (const el of floor.children) {
      const w = el.offsetWidth * EXPORT, h = el.offsetHeight * EXPORT;
      g.save();
      g.translate(el.offsetLeft * EXPORT + w / 2, el.offsetTop * EXPORT + h / 2);
      g.rotate(+el.dataset.rot * Math.PI / 180);
      if (el.classList.contains('item')) {
        g.globalAlpha = el.dataset.faded === '1' ? 0.5 : 1;
        g.drawImage(el.firstChild, -w / 2, -h / 2, w, h);
      } else {
        const bar = NOTE_BAR * EXPORT, fs = 160 * EXPORT, pad = 40 * EXPORT;
        g.fillStyle = '#fef9c3'; g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle = '#fde047'; g.fillRect(-w / 2, -h / 2, w, bar);
        g.strokeStyle = '#ca8a04'; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h);
        g.fillStyle = '#1a1d23'; g.font = `500 ${fs}px Barlow, sans-serif`; g.textBaseline = 'top';
        let y = -h / 2 + bar + pad;
        for (const para of el.querySelector('textarea').value.split('\n')) {
          let line = '';
          for (const word of para.split(' ')) {
            const t = line ? line + ' ' + word : word;
            if (line && g.measureText(t).width > w - 2 * pad) { g.fillText(line, -w / 2 + pad, y); y += fs * 1.25; line = word; }
            else line = t;
          }
          g.fillText(line, -w / 2 + pad, y); y += fs * 1.25;
        }
      }
      g.restore();
    }
    c.toBlob(b => download(URL.createObjectURL(b), `indeling-${slug(name)}.png`));
  } catch (err) {
    alert('PNG exporteren mislukt. Gebruik Live Server of de website (niet het bestand direct openen).\n\n' + err.message);
  }
};

// ══ Start ════════════════════════════════════
refit();
