/* ═══════════════════════════════════════════════
   Turnzaal Indelingsplanner — app.js
════════════════════════════════════════════════ */
'use strict';

// ── State ──────────────────────────────────────
const state = {
  counts: {},       // { [equipmentId]: number }
  selected: null,   // selected placed-item or floor-note element

  // Moving any canvas element
  moving: null,
  moveOffsetX: 0,
  moveOffsetY: 0,

  // Rotating any canvas element
  rotating: null,

  // Resizing a note
  resizing: null,
  resizeStartX: 0,
  resizeStartY: 0,
  resizeStartW: 0,
  resizeStartH: 0,
};

// ── DOM refs ───────────────────────────────────
const floorCanvas  = document.getElementById('floor-canvas');
const trashcan     = document.getElementById('trashcan');
const btnSave      = document.getElementById('btn-save');
const btnLoad      = document.getElementById('btn-load');
const btnExportPng = document.getElementById('btn-export-png');
const btnExportTxt = document.getElementById('btn-export-txt');
const btnClear     = document.getElementById('btn-clear');
const btnAddNote   = document.getElementById('btn-add-note');
const layoutName   = document.getElementById('layout-name');

// ══════════════════════════════════════════════
// 1. SIDEBAR — collapse / expand
// ══════════════════════════════════════════════
document.querySelectorAll('.category-header').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.closest('.category');
    cat.dataset.open = cat.dataset.open === 'true' ? 'false' : 'true';
  });
});

// ══════════════════════════════════════════════
// 2. SIDEBAR CLICK → place item at canvas centre
// ══════════════════════════════════════════════
document.querySelectorAll('.equipment-item').forEach(li => {
  li.addEventListener('click', () => {
    const canvasArea = document.querySelector('.canvas-area');
    const canvasRect = floorCanvas.getBoundingClientRect();
    const areaRect   = canvasArea.getBoundingClientRect();

    const visibleCX = Math.min(areaRect.right,  canvasRect.right)  - Math.max(areaRect.left, canvasRect.left);
    const visibleCY = Math.min(areaRect.bottom, canvasRect.bottom) - Math.max(areaRect.top,  canvasRect.top);

    const cx = canvasArea.scrollLeft + visibleCX / 2;
    const cy = canvasArea.scrollTop  + visibleCY / 2;

    createPlacedItem(li.dataset.id, li.dataset.label, li.dataset.img, cx, cy);
  });
});

// ══════════════════════════════════════════════
// 3. CREATE A PLACED EQUIPMENT ITEM
// ══════════════════════════════════════════════
function createPlacedItem(id, label, imgSrc, cx, cy, rotation, exactX, exactY, faded) {
  rotation = rotation || 0;
  faded    = faded || false;

  const wrapper = document.createElement('div');
  wrapper.className        = 'placed-item';
  wrapper.dataset.id       = id;
  wrapper.dataset.label    = label;
  wrapper.dataset.img      = imgSrc;
  wrapper.dataset.rotation = rotation;
  wrapper.dataset.faded    = faded ? 'true' : 'false';
  if (faded) wrapper.style.opacity = '0.5';

  const img = new Image();
  img.src       = imgSrc;
  img.alt       = label;
  img.draggable = false;

  img.addEventListener('load', () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    // If exact coordinates were provided (loading from file), use those directly.
    // Otherwise centre the item on the click point.
    if (exactX !== undefined && exactY !== undefined) {
      wrapper.style.left = exactX + 'px';
      wrapper.style.top  = exactY + 'px';
    } else {
      wrapper.style.left = Math.round(cx - w / 2) + 'px';
      wrapper.style.top  = Math.round(cy - h / 2) + 'px';
    }
    wrapper.style.width     = w + 'px';
    wrapper.style.height    = h + 'px';
    wrapper.style.transform = `rotate(${rotation}deg)`;
  });

  // Rotate handle
  const rotateHandle = document.createElement('div');
  rotateHandle.className   = 'rotate-handle';
  rotateHandle.textContent = '↻';
  rotateHandle.title       = 'Slepen om te draaien';

  // Delete handle
  const deleteHandle = document.createElement('div');
  deleteHandle.className   = 'delete-handle';
  deleteHandle.textContent = '✕';
  deleteHandle.title       = 'Item verwijderen';
  deleteHandle.addEventListener('click', e => {
    e.stopPropagation();
    if (confirm(`"${label}" verwijderen van de vloer?`)) {
      removeItem(wrapper);
    }
  });

  // Opacity (faded) toggle handle
  const opacityHandle = document.createElement('div');
  opacityHandle.className   = 'opacity-handle';
  opacityHandle.textContent = '⬓';
  opacityHandle.title       = 'Doorzichtigheid aan/uit (gestapeld materiaal)';
  opacityHandle.addEventListener('click', e => {
    e.stopPropagation();
    const isFaded = wrapper.dataset.faded === 'true';
    wrapper.dataset.faded  = isFaded ? 'false' : 'true';
    wrapper.style.opacity  = isFaded ? '1' : '0.5';
    opacityHandle.classList.toggle('is-active', !isFaded);
  });
  // Reflect initial state (e.g. when loaded from file)
  if (faded) opacityHandle.classList.add('is-active');

  wrapper.appendChild(img);
  wrapper.appendChild(rotateHandle);
  wrapper.appendChild(deleteHandle);
  wrapper.appendChild(opacityHandle);
  floorCanvas.appendChild(wrapper);

  changeCount(id, +1);
  attachMoveRotate(wrapper, rotateHandle);
  selectElement(wrapper);
}

// ══════════════════════════════════════════════
// 4. NOTES
// ══════════════════════════════════════════════
let noteCounter = 0;

btnAddNote.addEventListener('click', () => {
  const canvasArea = document.querySelector('.canvas-area');
  const canvasRect = floorCanvas.getBoundingClientRect();
  const areaRect   = canvasArea.getBoundingClientRect();

  const visibleCX = Math.min(areaRect.right,  canvasRect.right)  - Math.max(areaRect.left, canvasRect.left);
  const visibleCY = Math.min(areaRect.bottom, canvasRect.bottom) - Math.max(areaRect.top,  canvasRect.top);

  const cx = canvasArea.scrollLeft + visibleCX / 2;
  const cy = canvasArea.scrollTop  + visibleCY / 2;

  createNote('', cx, cy, 0);
});

function createNote(text, cx, cy, rotation) {
  rotation = rotation || 0;
  noteCounter++;

  const note = document.createElement('div');
  note.className        = 'floor-note';
  note.dataset.noteId   = noteCounter;
  note.dataset.rotation = rotation;
  note.style.left       = Math.round(cx - 90) + 'px';   // 90 = half of min-width 180
  note.style.top        = Math.round(cy - 50) + 'px';
  note.style.transform  = `rotate(${rotation}deg)`;

  // Rotate handle
  const rotateHandle = document.createElement('div');
  rotateHandle.className   = 'note-rotate-handle';
  rotateHandle.textContent = '↻';
  rotateHandle.title       = 'Slepen om te draaien';

  // Header bar (drag target + delete button)
  const header = document.createElement('div');
  header.className = 'note-header';

  const headerLabel = document.createElement('span');
  headerLabel.className   = 'note-header-label';
  headerLabel.textContent = 'Notitie';

  const deleteBtn = document.createElement('button');
  deleteBtn.className   = 'note-delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.title       = 'Notitie verwijderen';
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (confirm('Deze notitie verwijderen?')) {
      if (state.selected === note) state.selected = null;
      note.remove();
    }
  });

  header.appendChild(headerLabel);
  header.appendChild(deleteBtn);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.className   = 'note-textarea';
  textarea.placeholder = 'Typ hier je notitie…';
  textarea.value       = text;
  textarea.rows        = 3;

  // Prevent canvas deselect when clicking inside textarea
  textarea.addEventListener('mousedown', e => e.stopPropagation());

  // Resize handle (bottom-right corner)
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'note-resize-handle';
  resizeHandle.title     = 'Versleep om formaat aan te passen';

  note.appendChild(rotateHandle);
  note.appendChild(header);
  note.appendChild(textarea);
  note.appendChild(resizeHandle);
  floorCanvas.appendChild(note);

  // Wire up resize
  resizeHandle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    selectElement(note);
    state.resizing     = note;
    state.resizeStartX = e.clientX;
    state.resizeStartY = e.clientY;
    state.resizeStartW = note.offsetWidth;
    state.resizeStartH = note.offsetHeight;
  });

  // Move via header drag, rotate via rotate handle
  attachMoveRotate(note, rotateHandle, header);
  selectElement(note);

  // Focus textarea immediately for new notes (text is empty)
  if (!text) setTimeout(() => textarea.focus(), 50);

  return note;
}

// ══════════════════════════════════════════════
// 5. SHARED MOVE + ROTATE LOGIC
//    Works for both placed items and notes.
//    dragTarget: the element that initiates a move
//    (defaults to the wrapper itself if not provided)
// ══════════════════════════════════════════════
function attachMoveRotate(wrapper, rotateHandle, dragTarget) {
  const moveTarget = dragTarget || wrapper;

  moveTarget.addEventListener('mousedown', e => {
    if (e.target === rotateHandle) return;
    // Don't start move when clicking note's delete button or textarea
    if (e.target.classList.contains('note-delete-btn')) return;
    if (e.target.classList.contains('delete-handle'))   return;
    e.preventDefault();
    selectElement(wrapper);
    startMove(e, wrapper);
  });

  // Clicking the item body (not the header) also selects it
  if (dragTarget) {
    wrapper.addEventListener('mousedown', e => {
      if (e.target === rotateHandle) return;
      if (e.target.classList.contains('note-delete-btn')) return;
      if (e.target.tagName === 'TEXTAREA') return;
      selectElement(wrapper);
    });
  }

  rotateHandle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    selectElement(wrapper);
    state.rotating = wrapper;
  });
}

// ── Select / deselect ─────────────────────────
function selectElement(el) {
  if (state.selected && state.selected !== el) {
    state.selected.classList.remove('selected');
  }
  state.selected = el;
  el.classList.add('selected');
}

floorCanvas.addEventListener('mousedown', e => {
  if (e.target === floorCanvas && state.selected) {
    state.selected.classList.remove('selected');
    state.selected = null;
  }
});

// ── Start moving ──────────────────────────────
function startMove(e, wrapper) {
  const itemRect = wrapper.getBoundingClientRect();
  state.moving      = wrapper;
  state.moveOffsetX = e.clientX - itemRect.left;
  state.moveOffsetY = e.clientY - itemRect.top;
  // Bring to front by moving to last position in the DOM
  floorCanvas.appendChild(wrapper);
}

// ── Global mousemove ──────────────────────────
document.addEventListener('mousemove', e => {
  if (state.moving) {
    const canvasRect = floorCanvas.getBoundingClientRect();
    let x = e.clientX - canvasRect.left - state.moveOffsetX;
    let y = e.clientY - canvasRect.top  - state.moveOffsetY;

    const maxX = floorCanvas.offsetWidth  - state.moving.offsetWidth;
    const maxY = floorCanvas.offsetHeight - state.moving.offsetHeight;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    state.moving.style.left = x + 'px';
    state.moving.style.top  = y + 'px';

    updateTrashHighlight(e.clientX, e.clientY);
  }

  if (state.rotating) {
    const rect    = state.rotating.getBoundingClientRect();
    const cx      = rect.left + rect.width  / 2;
    const cy      = rect.top  + rect.height / 2;
    const angle   = Math.atan2(e.clientY - cy, e.clientX - cx);
    const degrees = angle * (180 / Math.PI) + 90;

    state.rotating.dataset.rotation = degrees;
    state.rotating.style.transform  = `rotate(${degrees}deg)`;
  }

  if (state.resizing) {
    const dx = e.clientX - state.resizeStartX;
    const dy = e.clientY - state.resizeStartY;
    const newW = Math.max(80,  state.resizeStartW + dx);
    const newH = Math.max(60, state.resizeStartH + dy);
    state.resizing.style.width  = newW + 'px';
    state.resizing.style.height = newH + 'px';
  }
});

// ── Global mouseup ────────────────────────────
document.addEventListener('mouseup', e => {
  if (state.moving) {
    if (isOverTrashcan(e.clientX, e.clientY)) {
      // Notes don't have an equipment id, so check type first
      if (state.moving.classList.contains('placed-item')) {
        removeItem(state.moving);
      } else if (state.moving.classList.contains('floor-note')) {
        if (confirm('Deze notitie verwijderen?')) {
          if (state.selected === state.moving) state.selected = null;
          state.moving.remove();
        }
      }
    }
    trashcan.classList.remove('active');
    state.moving = null;
  }
  if (state.rotating) state.rotating = null;
  if (state.resizing) state.resizing = null;
});

// ── Trashcan helpers ──────────────────────────
function isOverTrashcan(clientX, clientY) {
  const r = trashcan.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right &&
         clientY >= r.top  && clientY <= r.bottom;
}

function updateTrashHighlight(clientX, clientY) {
  trashcan.classList.toggle('active', isOverTrashcan(clientX, clientY));
}

// ── Remove a placed equipment item ────────────
function removeItem(wrapper) {
  const id = wrapper.dataset.id;
  if (state.selected === wrapper) state.selected = null;
  wrapper.remove();
  changeCount(id, -1);
}

// ── Keyboard: Delete key removes selected element
document.addEventListener('keydown', e => {
  if (!state.selected) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement.tagName === 'INPUT')    return;
    if (document.activeElement.tagName === 'TEXTAREA') return;
    if (state.selected.classList.contains('placed-item')) {
      removeItem(state.selected);
    } else if (state.selected.classList.contains('floor-note')) {
      if (confirm('Deze notitie verwijderen?')) {
        state.selected.remove();
        state.selected = null;
      }
    }
  }
});

// ══════════════════════════════════════════════
// 6. COUNT BADGES
// ══════════════════════════════════════════════
function changeCount(id, delta) {
  state.counts[id] = Math.max(0, (state.counts[id] || 0) + delta);
  const badge = document.querySelector(`.item-count[data-for="${id}"]`);
  if (badge) {
    badge.textContent = state.counts[id];
    badge.classList.toggle('active', state.counts[id] > 0);
  }
}

// ══════════════════════════════════════════════
// 7. NAME VALIDATION HELPER
// ══════════════════════════════════════════════
function requireName() {
  const name = layoutName.value.trim();
  if (!name) {
    layoutName.focus();
    layoutName.classList.add('input-error');
    setTimeout(() => layoutName.classList.remove('input-error'), 1500);
    alert('Vul de naam van nummer in voordat je opslaat of exporteert.');
    return null;
  }
  return name;
}

function nameToSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ══════════════════════════════════════════════
// 8. SAVE LAYOUT — download JSON
// ══════════════════════════════════════════════
btnSave.addEventListener('click', () => {
  const name = requireName();
  if (!name) return;

  const items = [];
  floorCanvas.querySelectorAll('.placed-item').forEach(wrapper => {
    items.push({
      type:     'item',
      id:       wrapper.dataset.id,
      label:    wrapper.dataset.label,
      img:      wrapper.dataset.img,
      x:        parseInt(wrapper.style.left, 10),
      y:        parseInt(wrapper.style.top,  10),
      rotation: parseFloat(wrapper.dataset.rotation) || 0,
      faded:    wrapper.dataset.faded === 'true',
    });
  });

  floorCanvas.querySelectorAll('.floor-note').forEach(note => {
    items.push({
      type:     'note',
      text:     note.querySelector('.note-textarea').value,
      x:        parseInt(note.style.left, 10),
      y:        parseInt(note.style.top,  10),
      width:    note.offsetWidth,
      height:   note.offsetHeight,
      rotation: parseFloat(note.dataset.rotation) || 0,
    });
  });

  const payload = { version: 2, name, savedAt: new Date().toISOString(), items };
  const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link    = document.createElement('a');
  link.download = `indeling-${nameToSlug(name)}.json`;
  link.href     = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
});

// ══════════════════════════════════════════════
// 9. LOAD LAYOUT — read JSON and reconstruct
// ══════════════════════════════════════════════
btnLoad.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    let payload;
    try {
      payload = JSON.parse(ev.target.result);
    } catch {
      alert('Het bestand kon niet worden gelezen. Zorg dat het een geldig .json bestand is dat door deze applicatie is opgeslagen.');
      return;
    }

    if (!payload.items || !Array.isArray(payload.items)) {
      alert('Dit lijkt geen geldig indelingsbestand te zijn.');
      return;
    }

    clearAll(false);
    if (payload.name) layoutName.value = payload.name;

    payload.items.forEach(item => {
      if (item.type === 'note') {
        const note = createNote(item.text, 0, 0, item.rotation);
        note.style.left      = item.x + 'px';
        note.style.top       = item.y + 'px';
        note.style.transform = `rotate(${item.rotation}deg)`;
        if (item.width)  note.style.width  = item.width  + 'px';
        if (item.height) note.style.height = item.height + 'px';
      } else {
        // Legacy v1 files have no type field — treat as item.
        // Pass exact x/y so position is applied inside the image load callback,
        // avoiding any race condition from grabbing the wrapper after the fact.
        createPlacedItem(item.id, item.label, item.img, 0, 0, item.rotation, item.x, item.y, item.faded || false);
      }
    });
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ══════════════════════════════════════════════
// 10. EXPORT PNG
// ══════════════════════════════════════════════
btnExportPng.addEventListener('click', async () => {
  const name = requireName();
  if (!name) return;

  if (state.selected) {
    state.selected.classList.remove('selected');
    state.selected = null;
  }

  try {
    const canvas = await html2canvas(floorCanvas, {
      useCORS: true,
      scale: 1,
      backgroundColor: null,
    });
    const link    = document.createElement('a');
    link.download = `indeling-${nameToSlug(name)}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    alert('PNG exporteren mislukt. Zorg dat je Live Server gebruikt en het bestand niet rechtstreeks opent.\n\n' + err.message);
  }
});

// ══════════════════════════════════════════════
// 11. EXPORT TXT
// ══════════════════════════════════════════════
btnExportTxt.addEventListener('click', () => {
  const name = requireName();
  if (!name) return;

  const used = Object.entries(state.counts).filter(([, n]) => n > 0);
  if (used.length === 0) {
    alert('Er is nog geen materiaal geplaatst.');
    return;
  }

  const lines = [
    'TURNZAAL INDELING — MATERIAALLIJST',
    '═'.repeat(40),
    `Naam:       ${name}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-NL')}`,
    '',
    'GEBRUIKT MATERIAAL:',
    '─'.repeat(40),
  ];

  used
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([id, count]) => {
      const el    = document.querySelector(`.equipment-item[data-id="${id}"]`);
      const label = el ? el.dataset.label : id;
      lines.push(`  ${String(count).padStart(3)}x  ${label}`);
    });

  // Include note texts if any
  const notes = [...floorCanvas.querySelectorAll('.floor-note')]
    .map(n => n.querySelector('.note-textarea').value.trim())
    .filter(Boolean);

  if (notes.length > 0) {
    lines.push('');
    lines.push('NOTITIES:');
    lines.push('─'.repeat(40));
    notes.forEach((txt, i) => lines.push(`  ${i + 1}. ${txt}`));
  }

  const total = used.reduce((s, [, n]) => s + n, 0);
  lines.push('');
  lines.push('─'.repeat(40));
  lines.push(`  ${String(total).padStart(3)}   TOTAAL ITEMS`);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const link = document.createElement('a');
  link.download = `materiaallijst-${nameToSlug(name)}.txt`;
  link.href     = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
});

// ══════════════════════════════════════════════
// 12. CLEAR ALL
// ══════════════════════════════════════════════
btnClear.addEventListener('click', () => clearAll(true));

function clearAll(confirm_first) {
  if (confirm_first && !confirm('Alle geplaatste items en notities verwijderen en de vloer resetten?')) return;

  floorCanvas.querySelectorAll('.placed-item, .floor-note').forEach(el => el.remove());

  Object.keys(state.counts).forEach(id => {
    state.counts[id] = 0;
    const badge = document.querySelector(`.item-count[data-for="${id}"]`);
    if (badge) { badge.textContent = '0'; badge.classList.remove('active'); }
  });

  state.selected = null;
  state.moving   = null;
  state.rotating = null;
}
