(function (global) {
  'use strict';

  var DATA = global.APP.DATA;

  var FIXED = [
    { kind: 'fixed', slot: 'amino', name: '氨基', formula: '-NH₂' },
    { kind: 'fixed', slot: 'carboxyl', name: '羧基', formula: '-COOH' },
    { kind: 'fixed', slot: 'hydrogen', name: '氢', formula: '-H' }
  ];

  // 5c-2：R 基不再从 20 个现成侧链里挑，改成自己拖原子拼
  var ATOMS = [
    { kind: 'atom', id: 'C', el: 'C', name: '碳', formula: 'C' },
    { kind: 'atom', id: 'N', el: 'N', name: '氮', formula: 'N' },
    { kind: 'atom', id: 'O', el: 'O', name: '氧', formula: 'O' },
    { kind: 'atom', id: 'S', el: 'S', name: '硫', formula: 'S' },
    { kind: 'atom', id: 'H', el: 'H', name: '氢', formula: 'H' }
  ];

  var atomSeq = 0;

  // 环块：一次插入多个原子和多根键，内部键不可改
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

  // R 槽不再放文字积木，改成把侧链图渲染成 SVG
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
    divider.textContent = '原子';
    list.appendChild(divider);

    ATOMS.forEach(function (item) {
      var chip = createChip(item);
      list.appendChild(chip);
      global.APP.Drag.bind(chip);
    });

    var ringDivider = document.createElement('div');
    ringDivider.className = 'divider';
    ringDivider.textContent = '环';
    list.appendChild(ringDivider);

    RINGS.forEach(function (item) {
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
    var hasSide = !!(state.side && state.side.atoms.length);
    var complete = state.amino && state.carboxyl && state.hydrogen && hasSide;

    if (!complete) {
      var box0 = document.getElementById('structure');
      if (box0) box0.innerHTML = '';

      var info0 = document.getElementById('info');
      if (info0) {
        info0.innerHTML = '';
        var tip = document.createElement('p');
        tip.className = 'placeholder';
        tip.textContent = '需要将四个槽位都放置完成。';
        info0.appendChild(tip);
      }
      if (lastSlot) say('已放入' + lastSlot + '，还差几个槽位');
      return;
    }

    // 侧链还没连成一体时，不能拿去比对——那是"还没拼完"，不是"拼错了"
    if (!global.APP.Graph.sideConnected(state.side)) {
      var pending = document.getElementById('info');
      if (pending) {
        pending.innerHTML = '<p class="placeholder">有原子未连接。</p>';
      }
      var box = document.getElementById('structure');
      if (box) box.innerHTML = '';
      say('等待拼接');
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
