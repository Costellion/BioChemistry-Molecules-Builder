(function (global) {
  'use strict';

  var DATA = global.APP.DATA;

  var FIXED = [
    { kind: 'fixed', slot: 'amino', name: '氨基', formula: '-NH₂' },
    { kind: 'fixed', slot: 'carboxyl', name: '羧基', formula: '-COOH' },
    { kind: 'fixed', slot: 'hydrogen', name: '氢', formula: '-H' }
  ];

  var SIDE = DATA.aminoAcids.map(function (aa) {
    return { kind: 'side', id: aa.id, name: aa.zh, formula: aa.abbr3 };
  });

  var CODE_MAP = {};
  DATA.aminoAcids.forEach(function (aa) {
    CODE_MAP[global.APP.Canonical.code(global.APP.Graph.build(aa))] = aa;
  });

  var state = { amino: null, carboxyl: null, hydrogen: null, sideChain: null };

  function say(text) {
    var out = document.getElementById('message');
    if (out) out.textContent = text;
  }

  function slotName(slot) {
    var hint = slot.querySelector('.slot-hint');
    return hint ? hint.textContent.trim() : '槽位';
  }

  function createChip(item) {
    var chip = document.createElement('div');
    chip.className = 'chip';
    chip.setAttribute('data-kind', item.kind);
    chip.setAttribute('data-key', item.kind === 'fixed' ? item.slot : item.id);

    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.name;

    var formula = document.createElement('span');
    formula.className = 'formula';
    formula.textContent = item.formula;

    chip.appendChild(name);
    chip.appendChild(formula);
    return chip;
  }

  function buildPalette() {
    var list = document.getElementById('chip-list');
    if (!list) return;

    FIXED.forEach(function (item) {
      var chip = createChip(item);
      list.appendChild(chip);
      global.APP.Drag.bind(chip);
    });

    var divider = document.createElement('div');
    divider.className = 'divider';
    divider.textContent = '侧链积木';
    list.appendChild(divider);

    SIDE.forEach(function (item) {
      var chip = createChip(item);
      list.appendChild(chip);
      global.APP.Drag.bind(chip);
    });
  }

  function accepts(slotId, chip) {
    var kind = chip.getAttribute('data-kind');
    var key = chip.getAttribute('data-key');
    if (kind === 'fixed') return slotId === key;
    return slotId === 'sideChain';
  }

  function placeInto(slot, chip) {
    var slotId = slot.getAttribute('data-slot');

    if (!accepts(slotId, chip)) {
      say(slotName(slot) + '不能放这个。' + slotName(slot) + '只接受对应的基团。');
      return false;
    }
    if (slot.classList.contains('is-occupied')) {
      say(slotName(slot) + '已经有积木了，点一下它取下再换。');
      return false;
    }

    var placed = createChip({
      kind: chip.getAttribute('data-kind'),
      slot: chip.getAttribute('data-key'),
      id: chip.getAttribute('data-key'),
      name: chip.querySelector('.name').textContent,
      formula: chip.querySelector('.formula').textContent
    });
    placed.classList.add('is-placed');
    placed.setAttribute('data-source', chip.getAttribute('data-key'));
    placed.setAttribute('title', '点击取下');

    slot.appendChild(placed);
    slot.classList.add('is-occupied');
    state[slotId] = chip.getAttribute('data-key');

    refresh(slotName(slot));
    return true;
  }

  function bindSlot(slot) {
    slot.addEventListener('click', function () {
      if (!slot.classList.contains('is-occupied')) return;
      var placed = slot.querySelector('.chip');
      if (!placed) return;
      slot.removeChild(placed);
      slot.classList.remove('is-occupied');
      state[slot.getAttribute('data-slot')] = null;
      refresh(null);
    });
  }

  function structureBox() {
    var box = document.getElementById('structure');
    return box;
  }

  function clearStructure() {
    var box = structureBox();
    if (box) box.innerHTML = '';
  }

  function showInfo(aa) {
    var box = document.getElementById('info');
    if (!box) return;
    box.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'info-title';
    title.textContent = aa.zh + '　' + aa.abbr3 + '　' + aa.abbr1;
    box.appendChild(title);

    var rows = [
      ['分类', DATA.categories[aa.category].label],
      ['亲疏水', aa.solubility],
      ['分子式', aa.formula],
      ['等电点', aa.pI.toFixed(2)],
      ['疏水指数', aa.hydropathy.toFixed(2)],
      ['pKa', aa.pKa.carboxyl + ' / ' + aa.pKa.amino + (aa.pKa.sideChain ? ' / ' + aa.pKa.sideChain : '')],
      ['必需性', aa.essential]
    ];

    var dl = document.createElement('dl');
    dl.className = 'info-list';
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    box.appendChild(dl);

    var note = document.createElement('p');
    note.className = 'info-note';
    note.textContent = aa.note;
    box.appendChild(note);
  }

  function refresh(lastSlot) {
    var complete = state.amino && state.carboxyl && state.hydrogen && state.sideChain;

    if (!complete) {
      clearStructure();
      var box = document.getElementById('info');
      if (box) {
        box.innerHTML = '';
        var tip = document.createElement('p');
        tip.className = 'placeholder';
        tip.textContent = '四个槽位都放对，就拼出一个完整的氨基酸。';
        box.appendChild(tip);
      }
      if (lastSlot) say('已放入' + lastSlot + '，还差几个槽位。');
      return;
    }

    var record = DATA.aminoAcids.filter(function (a) { return a.id === state.sideChain; })[0];
    if (!record) return;

    var graph = global.APP.Graph.build(record);
    var code = global.APP.Canonical.code(graph);
    var matched = CODE_MAP[code];

    var target = structureBox();
    if (target) {
      target.innerHTML = global.APP.Render.markup(graph);
    }

    if (matched) {
      showInfo(matched);
      say('拼装完成：' + matched.zh + '（' + matched.abbr3 + '）。');
    } else {
      var info = document.getElementById('info');
      if (info) {
        info.innerHTML = '<p class="placeholder">这是一个合法的结构，但不是 20 种标准氨基酸之一。</p>';
      }
      say('合法的侧链，但不在 20 种标准氨基酸里。');
    }
  }

  function start() {
    buildPalette();

    var slots = document.querySelectorAll('[data-drop-target]');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('aria-label', '槽位：' + slotName(slot));
      bindSlot(slot);
    });

    global.APP.Drag.init({ onDrop: placeInto });
    say('把四个槽位放对，就会拼出一个完整的氨基酸结构式。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window);
