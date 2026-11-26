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

  var state = { amino: null, carboxyl: null, hydrogen: null, sideChain: null, side: null };

  function say(text) {
    var out = document.getElementById('message');
    if (out) out.textContent = text;
  }

  function slotName(slot) {
    if (slot.getAttribute('data-name')) return slot.getAttribute('data-name');
    var hint = slot.querySelector('.slot-hint');
    return hint ? hint.textContent.trim() : '槽位';
  }

  // R 槽不再放文字积木，改成把侧链图渲染成 SVG
  function renderSide() {
    var box = document.getElementById('r-canvas');
    if (!box) return;

    var side = state.side;
    if (!side || !side.atoms.length) {
      box.innerHTML = '<p class="r-empty">把原子拖到这里<br>再用点击把它们连起来</p>';
      return;
    }

    var graph = {
      atoms: side.atoms.map(function (a) { return { id: a.id, el: a.el }; }),
      bonds: side.bonds.map(function (b) { return { a: b.a, b: b.b, order: b.order }; })
    };

    box.innerHTML = global.APP.Render.markup(graph, {
      bond: 34,
      padding: 14,
      root: side.root,
      direction: { x: 0, y: 1 },
      // 编辑区不画氢：一个甲基就要多三个圆，画布里会挤成一团。
      // 氢留到判定通过后的教材原图里去呈现。
      hydrogens: false
    });
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
      say(slotName(slot) + '不能放这个，只接受对应的基团。');
      return false;
    }
    if (slot.classList.contains('is-occupied')) {
      say(slotName(slot) + '已经有积木了，点一下它取下再换。');
      return false;
    }

    var key = chip.getAttribute('data-key');

    if (slotId === 'sideChain') {
      var sideRecord = DATA.aminoAcids.filter(function (a) { return a.id === key; })[0];
      if (!sideRecord) return false;
      state.sideChain = key;
      state.side = global.APP.Graph.sideFromRecord(sideRecord);
      slot.classList.add('is-occupied');
      renderSide();
      refresh(slotName(slot));
      return true;
    }

    var placed = createChip({
      kind: chip.getAttribute('data-kind'),
      slot: key,
      id: key,
      name: chip.querySelector('.name').textContent,
      formula: chip.querySelector('.formula').textContent
    });
    placed.classList.add('is-placed');
    placed.setAttribute('title', '点击取下');

    slot.appendChild(placed);
    slot.classList.add('is-occupied');
    state[slotId] = key;

    refresh(slotName(slot));
    return true;
  }

  function bindSlot(slot) {
    slot.addEventListener('click', function () {
      if (!slot.classList.contains('is-occupied')) return;

      if (slot.getAttribute('data-slot') === 'sideChain') {
        state.sideChain = null;
        state.side = null;
        slot.classList.remove('is-occupied');
        renderSide();
        refresh(null);
        return;
      }

      var placed = slot.querySelector('.chip');
      if (!placed) return;
      slot.removeChild(placed);
      slot.classList.remove('is-occupied');
      state[slot.getAttribute('data-slot')] = null;
      refresh(null);
    });
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

  function hideModal() {
    var modal = document.getElementById('modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function showModal(aa, graph) {
    var modal = document.getElementById('modal');
    if (!modal) return;

    document.getElementById('modal-title').textContent = aa.zh;
    document.getElementById('modal-sub').textContent =
      aa.en + '　' + aa.abbr3 + ' / ' + aa.abbr1 + '　' + DATA.categories[aa.category].label;

    document.getElementById('modal-figure').innerHTML =
      '<img class="figure" src="img/' + aa.id + '.png" alt="' + aa.zh + '的结构式">';

    var props = document.getElementById('modal-props');
    props.innerHTML = '';
    [
      ['分子式', aa.formula],
      ['等电点', aa.pI.toFixed(2)],
      ['疏水指数', aa.hydropathy.toFixed(2)],
      ['亲疏水', aa.solubility],
      ['必需性', aa.essential]
    ].forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      props.appendChild(dt);
      props.appendChild(dd);
    });

    document.getElementById('modal-note').textContent = aa.note;

    modal.hidden = false;
    document.body.classList.add('modal-open');
    var close = document.getElementById('modal-close');
    if (close) close.focus();
  }

  function bindModal() {
    var modal = document.getElementById('modal');
    if (!modal) return;

    var close = document.getElementById('modal-close');
    if (close) close.addEventListener('click', hideModal);

    modal.addEventListener('click', function (event) {
      if (event.target === modal) hideModal();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) hideModal();
    });
  }

  function refresh(lastSlot) {
    var complete = state.amino && state.carboxyl && state.hydrogen && state.sideChain;

    if (!complete) {
      var box0 = document.getElementById('structure');
      if (box0) box0.innerHTML = '';

      var info0 = document.getElementById('info');
      if (info0) {
        info0.innerHTML = '';
        var tip = document.createElement('p');
        tip.className = 'placeholder';
        tip.textContent = '四个槽位都放对，就拼出一个完整的氨基酸。';
        info0.appendChild(tip);
      }
      if (lastSlot) say('已放入' + lastSlot + '，还差几个槽位。');
      return;
    }

    // 5c：整图由骨架 + 侧链图装配而来，手拼和现成数据走同一条通路
    var graph = global.APP.Graph.assemble(state.side);
    var code = global.APP.Canonical.code(graph);
    var matched = CODE_MAP[code];

    var target = document.getElementById('structure');
    if (target) {
      target.innerHTML = matched
        ? '<img class="figure" src="img/' + matched.id + '.png" alt="' + matched.zh + '的结构式">'
        : '';
    }

    if (matched) {
      showInfo(matched);
      showModal(matched, graph);
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
    bindModal();
    renderSide();

    var slots = document.querySelectorAll('[data-drop-target]');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('aria-label', '槽位：' + slotName(slot));
      bindSlot(slot);
    });

    global.APP.Drag.init({ onDrop: placeInto });
    say('把四个槽位放对，就会拼出一个完整的氨基酸结构式。');
  }

  global.APP.App = {
    assemble: function (id) {
      var record = DATA.aminoAcids.filter(function (a) { return a.id === id; })[0];
      state.amino = 'amino';
      state.carboxyl = 'carboxyl';
      state.hydrogen = 'hydrogen';
      state.sideChain = record ? id : null;
      state.side = record ? global.APP.Graph.sideFromRecord(record) : null;

      var slot = document.querySelector('[data-slot="sideChain"]');
      if (slot) {
        if (record) slot.classList.add('is-occupied');
        else slot.classList.remove('is-occupied');
      }

      renderSide();
      refresh(null);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window);
