(function (global) {
  'use strict';

  var DATA = global.APP.DATA;

  var atomSeq = 0;

  // 环：一次插入多个原子和多根键，内部键不可改
  var RINGS = [
    {
      kind: 'ring',
      id: 'benzene',
      name: '苯环',
      formula: 'C₆H₅',
      attach: 'a0',
      atoms: [
        { id: 'a0', el: 'C' }, { id: 'a1', el: 'C' }, { id: 'a2', el: 'C' },
        { id: 'a3', el: 'C' }, { id: 'a4', el: 'C' }, { id: 'a5', el: 'C' }
      ],
      bonds: [
        { a: 'a0', b: 'a1', order: 1 }, { a: 'a1', b: 'a2', order: 2 },
        { a: 'a2', b: 'a3', order: 1 }, { a: 'a3', b: 'a4', order: 2 },
        { a: 'a4', b: 'a5', order: 1 }, { a: 'a5', b: 'a0', order: 2 }
      ]
    },
    {
      kind: 'ring',
      id: 'imidazole',
      name: '咪唑环',
      formula: 'C₃H₃N₂',
      attach: 'a0',
      atoms: [
        { id: 'a0', el: 'C' }, { id: 'a1', el: 'N' }, { id: 'a2', el: 'C' },
        { id: 'a3', el: 'N' }, { id: 'a4', el: 'C' }
      ],
      bonds: [
        { a: 'a0', b: 'a1', order: 1 }, { a: 'a1', b: 'a2', order: 1 },
        { a: 'a2', b: 'a3', order: 2 }, { a: 'a3', b: 'a0', order: 1 },
        { a: 'a0', b: 'a4', order: 2 }, { a: 'a4', b: 'a1', order: 1 }
      ]
    },
    {
      kind: 'ring',
      id: 'indole',
      name: '吲哚环',
      formula: 'C₈H₆N',
      attach: 'a0',
      atoms: [
        { id: 'a0', el: 'C' }, { id: 'a1', el: 'C' }, { id: 'a2', el: 'C' },
        { id: 'a3', el: 'N' }, { id: 'a4', el: 'C' }, { id: 'a5', el: 'C' },
        { id: 'a6', el: 'C' }, { id: 'a7', el: 'C' }, { id: 'a8', el: 'C' }
      ],
      bonds: [
        { a: 'a0', b: 'a1', order: 2 }, { a: 'a1', b: 'a3', order: 1 },
        { a: 'a3', b: 'a4', order: 1 }, { a: 'a4', b: 'a2', order: 1 },
        { a: 'a2', b: 'a0', order: 1 }, { a: 'a2', b: 'a5', order: 2 },
        { a: 'a5', b: 'a7', order: 1 }, { a: 'a7', b: 'a8', order: 2 },
        { a: 'a8', b: 'a6', order: 1 }, { a: 'a6', b: 'a4', order: 2 }
      ]
    }
  ];

  var CODE_MAP = {};
  DATA.aminoAcids.forEach(function (aa) {
    CODE_MAP[global.APP.Canonical.code(global.APP.Graph.build(aa))] = aa;
  });

  var state = { amino: null, carboxyl: null, hydrogen: null, sideChain: null, side: null, selected: null };

  function say(text) {
    var out = document.getElementById('message');
    if (out) out.textContent = text;
  }

  function slotName(slot) {
    if (slot.getAttribute('data-name')) return slot.getAttribute('data-name');
    var hint = slot.querySelector('.slot-hint');
    return hint ? hint.textContent.trim() : '槽位';
  }

  function renderSide() {
    var box = document.getElementById('r-canvas');
    if (!box) return;

    var side = state.side;
    var clear = document.getElementById('r-clear');
    if (clear) clear.hidden = !(side && side.atoms.length);

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

    // 单个原子：点一下选中，再点另一个就连键；双击删掉这个原子
    Array.prototype.forEach.call(box.querySelectorAll('circle[data-atom]'), function (node) {
      var id = node.getAttribute('data-atom');
      node.style.cursor = 'pointer';
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        onAtomClick(id);
      });
      node.addEventListener('dblclick', function (event) {
        event.stopPropagation();
        state.selected = null;
        removeAtom(id);
      });
    });

    // 键：点一下在单键/双键之间切换
    Array.prototype.forEach.call(box.querySelectorAll('[data-bond]'), function (node) {
      node.style.cursor = 'pointer';
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleBond(node.getAttribute('data-bond'));
      });
    });

    if (state.selected) {
      var picked = box.querySelector('circle[data-atom="' + state.selected + '"]');
      if (picked) {
        picked.setAttribute('stroke', '#2f6feb');
        picked.setAttribute('stroke-width', '2.6');
      }
    }

    // 只给"这一次新出现的"东西挂上入场动画，之后重绘就不再重播
    if (state.lastAtom) {
      Array.prototype.forEach.call(
        box.querySelectorAll('circle[data-atom="' + state.lastAtom + '"]'),
        function (node) { node.classList.add('atom-new'); }
      );
      state.lastAtom = null;
    }
    if (state.lastBond) {
      Array.prototype.forEach.call(
        box.querySelectorAll('[data-bond="' + state.lastBond + '"]'),
        function (node) { node.classList.add('bond-new'); }
      );
      state.lastBond = null;
    }

    box.onclick = function () {
      if (!state.selected) return;
      state.selected = null;
      renderSide();
    };
  }

  function elementOf(id) {
    var atom = (state.side ? state.side.atoms : []).filter(function (a) { return a.id === id; })[0];
    return atom ? atom.el : null;
  }

  function bondUsage() {
    var used = {};
    if (!state.side) return used;
    state.side.atoms.forEach(function (a) { used[a.id] = 0; });
    state.side.bonds.forEach(function (b) {
      used[b.a] = (used[b.a] || 0) + b.order;
      used[b.b] = (used[b.b] || 0) + b.order;
    });
    return used;
  }

  function findBond(a, b) {
    if (!state.side) return null;
    return state.side.bonds.filter(function (x) {
      return (x.a === a && x.b === b) || (x.a === b && x.b === a);
    })[0] || null;
  }

  function onAtomClick(id) {
    if (!state.side) return;

    if (!state.selected) {
      state.selected = id;
      renderSide();
      say('已选中一个原子，点击另一个原子以连接共价键；双击原子可以将其删除');
      return;
    }
    if (state.selected === id) {
      state.selected = null;
      renderSide();
      say('已取消选中');
      return;
    }

    if (tryBond(state.selected, id)) {
      state.selected = null;
      renderSide();
      refresh(null);
    }
  }

  function tryBond(a, b) {
    var limit = global.APP.Graph.VALENCE;
    var elA = elementOf(a);
    var elB = elementOf(b);
    var used = bondUsage();

    if ((used[a] || 0) + 1 > limit[elA]) {
      say(elA + ' 的价键已经用尽');
      return false;
    }
    if ((used[b] || 0) + 1 > limit[elB]) {
      say(elB + ' 的价键已经用尽');
      return false;
    }
    if (findBond(a, b)) {
      say('两个原子已经连接');
      return false;
    }

    state.side.bonds.push({ a: a, b: b, order: 1 });
    state.lastBond = a + "|" + b;
    return true;
  }

  function toggleBond(key) {
    var parts = key.split('|');
    var bond = findBond(parts[0], parts[1]);
    if (!bond) return;

    if (bond.order === 2) {
      bond.order = 1;
    } else {
      var limit = global.APP.Graph.VALENCE;
      var used = bondUsage();
      if ((used[bond.a] || 0) + 1 > limit[elementOf(bond.a)] ||
          (used[bond.b] || 0) + 1 > limit[elementOf(bond.b)]) {
        say('价键不足');
        return;
      }
      bond.order = 2;
    }

    renderSide();
    refresh(null);
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

  // 积木现在是写死在 HTML 里的按钮，JS 只负责挂上拖拽
  function buildPalette() {
    var chips = document.querySelectorAll('#palette .chip');
    Array.prototype.forEach.call(chips, function (chip) {
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
    var kind = chip.getAttribute('data-kind');

    if (!accepts(slotId, chip)) {
      say('位置错误');
      return false;
    }

    // 原子：落进 R 基画布，追加一个节点。这一步还不连键（连键在 5c-3）
    if (kind === 'atom') {
      slot.classList.add('is-occupied');
      addAtom(chip.getAttribute('data-key'));
      return true;
    }

    // 环块：一次插入多个原子和多根键，内部键不可改
    if (kind === 'ring') {
      var block = RINGS.filter(function (r) { return r.id === chip.getAttribute('data-key'); })[0];
      if (!block) return false;
      slot.classList.add('is-occupied');
      addBlock(block);
      return true;
    }

    if (slot.classList.contains('is-occupied')) {
      say('此处已有基团');
      return false;
    }

    var key = chip.getAttribute('data-key');
    var placed = createChip({
      kind: kind,
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

    refresh(null);
    return true;
  }

  function bindSlot(slot) {
    slot.addEventListener('click', function () {
      if (!slot.classList.contains('is-occupied')) return;
      // R 基画布里的原子靠"点原子"删除，点空白不做事
      if (slot.getAttribute('data-slot') === 'sideChain') return;

      var placed = slot.querySelector('.chip');
      if (!placed) return;
      slot.removeChild(placed);
      slot.classList.remove('is-occupied');
      state[slot.getAttribute('data-slot')] = null;
      refresh(null);
    });
  }

  // ---- R 基的原子增删 ----

  function clearSide() {
    state.side = null;
    state.selected = null;
    var slot = document.querySelector('[data-slot="sideChain"]');
    if (slot) slot.classList.remove('is-occupied');
    renderSide();
    refresh(null);
    say('已清空 R 基。');
  }

  function addAtom(el) {
    if (!state.side) state.side = { atoms: [], bonds: [], root: null };
    atomSeq += 1;
    var id = 'r' + atomSeq;
    state.side.atoms.push({ id: id, el: el });
    if (!state.side.root) state.side.root = id;
    state.lastAtom = id;
    renderSide();
    refresh(null);
  }

  function addBlock(block) {
    if (!state.side) state.side = { atoms: [], bonds: [], root: null };
    atomSeq += 1;
    var prefix = 'b' + atomSeq + '_';
    var mapping = {};

    block.atoms.forEach(function (a) {
      var id = prefix + a.id;
      mapping[a.id] = id;
      state.side.atoms.push({ id: id, el: a.el });
    });
    block.bonds.forEach(function (b) {
      state.side.bonds.push({ a: mapping[b.a], b: mapping[b.b], order: b.order });
    });

    if (!state.side.root) state.side.root = mapping[block.attach];
    renderSide();
    refresh(null);
  }

  function removeAtom(id) {
    if (!state.side) return;
    state.side.atoms = state.side.atoms.filter(function (a) { return a.id !== id; });
    state.side.bonds = state.side.bonds.filter(function (b) {
      return b.a !== id && b.b !== id;
    });
    if (state.side.root === id) {
      state.side.root = state.side.atoms.length ? state.side.atoms[0].id : null;
    }
    if (!state.side.atoms.length) {
      state.side = null;
      var slot = document.querySelector('[data-slot="sideChain"]');
      if (slot) slot.classList.remove('is-occupied');
    }
    renderSide();
    refresh(null);
  }

  function fill(id, text) {
    var node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  function showInfo(aa) {
    var empty = document.getElementById('info-empty');
    var body = document.getElementById('info-body');
    if (!empty || !body) return;

    empty.hidden = true;
    body.hidden = false;

    fill('info-title', aa.zh + '　' + aa.abbr3 + '　' + aa.abbr1);
    fill('info-category', DATA.categories[aa.category].label);
    fill('info-solubility', aa.solubility);
    fill('info-formula', aa.formula);
    fill('info-pi', aa.pI.toFixed(2));
    fill('info-hydropathy', aa.hydropathy.toFixed(2));
    fill('info-pka', aa.pKa.carboxyl + ' / ' + aa.pKa.amino +
      (aa.pKa.sideChain ? ' / ' + aa.pKa.sideChain : ''));
    fill('info-essential', aa.essential);
    fill('info-note', aa.note);
  }

  // 信息面板只有一块提示位，三种状态轮流用它
  function setInfo(text) {
    var empty = document.getElementById('info-empty');
    var body = document.getElementById('info-body');
    if (body) body.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.textContent = text;
    }
  }

  function showStructure(aa) {
    var figure = document.getElementById('structure');
    var img = document.getElementById('structure-img');
    var caption = document.getElementById('structure-caption');
    if (!figure || !img) return;

    if (!aa) {
      figure.hidden = true;
      return;
    }
    img.src = 'img/' + aa.id + '.png';
    img.alt = aa.zh + '的结构式';
    if (caption) caption.textContent = aa.zh + '　' + aa.abbr3;
    figure.hidden = false;
  }

  function hideModal() {
    var modal = document.getElementById('modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function showModal(aa) {
    var modal = document.getElementById('modal');
    if (!modal) return;

    fill('modal-title', aa.zh);
    fill('modal-sub', aa.en + '　' + aa.abbr3 + ' / ' + aa.abbr1 + '　' +
      DATA.categories[aa.category].label);

    var img = document.getElementById('modal-img');
    if (img) {
      img.src = 'img/' + aa.id + '.png';
      img.alt = aa.zh + '的结构式';
    }
    fill('modal-caption', aa.zh + '　' + aa.abbr3);

    fill('modal-formula', aa.formula);
    fill('modal-pi', aa.pI.toFixed(2));
    fill('modal-hydropathy', aa.hydropathy.toFixed(2));
    fill('modal-solubility', aa.solubility);
    fill('modal-essential', aa.essential);
    fill('modal-note', aa.note);

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
    var hasSide = !!(state.side && state.side.atoms.length);
    var complete = state.amino && state.carboxyl && state.hydrogen && hasSide;

    if (!complete) {
      showStructure(null);
      setInfo('需要将四个槽位都放置完成。');
      if (lastSlot) say('已放入' + lastSlot + '，还差几个槽位');
      return;
    }

    // 侧链还没连成一体时，不能拿去比对——那是"还没拼完"，不是"拼错了"
    if (!global.APP.Graph.sideConnected(state.side)) {
      showStructure(null);
      setInfo('有原子未连接。');
      say('等待拼接');
      return;
    }

    // 5c：整图由骨架 + 侧链图装配而来，手拼和现成数据走同一条通路
    var graph = global.APP.Graph.assemble(state.side);
    var code = global.APP.Canonical.code(graph);
    var matched = CODE_MAP[code];

    if (matched) {
      showStructure(matched);
      showInfo(matched);
      showModal(matched);
      say('拼装完成：' + matched.zh + '（' + matched.abbr3 + '）。');
    } else {
      showStructure(null);
      setInfo('这是一个合法的结构，但不是 20 种标准氨基酸之一。');
      say('不在 20 种标准氨基酸里');
    }
  }

  function start() {
    buildPalette();
    bindModal();
    renderSide();

    var clearBtn = document.getElementById('r-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearSide);

    var slots = document.querySelectorAll('[data-drop-target]');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('aria-label', '槽位：' + slotName(slot));
      bindSlot(slot);
    });

    if (global.APP.Effects) global.APP.Effects.init();
    global.APP.Drag.init({ onDrop: placeInto });
    say('需要把四个槽位都放对');
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
    },
    addAtom: addAtom
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window);
