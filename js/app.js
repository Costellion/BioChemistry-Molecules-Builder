(function (global) {
  'use strict';

  var CHIPS = [
    { id: 'amino', name: '氨基', formula: '-NH₂' },
    { id: 'carboxyl', name: '羧基', formula: '-COOH' },
    { id: 'hydrogen', name: '氢', formula: '-H' },
    { id: 'methyl', name: '甲基', formula: '-CH₃' },
    { id: 'hydroxyl', name: '羟基', formula: '-OH' }
  ];

  var chipIndex = {};
  CHIPS.forEach(function (item) { chipIndex[item.id] = item; });

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
    chip.setAttribute('data-chip', item.id);
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', item.name + ' ' + item.formula);

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
    CHIPS.forEach(function (item) {
      var chip = createChip(item);
      list.appendChild(chip);
      global.APP.Drag.bind(chip);
    });
  }

  function placeInto(slot, sourceChip) {
    if (slot.classList.contains('is-occupied')) {
      say(slotName(slot) + '里已经有积木了，点一下它取下再换。');
      return false;
    }

    var item = chipIndex[sourceChip.getAttribute('data-chip')];
    if (!item) return false;

    var placed = createChip(item);
    placed.classList.add('is-placed');
    placed.setAttribute('title', '点击取下');

    slot.appendChild(placed);
    slot.classList.add('is-occupied');
    say('已放入' + slotName(slot) + '：' + item.name + '。');
    return true;
  }

  function bindSlot(slot) {
    slot.addEventListener('click', function () {
      if (!slot.classList.contains('is-occupied')) return;
      var placed = slot.querySelector('.chip');
      if (!placed) return;
      slot.removeChild(placed);
      slot.classList.remove('is-occupied');
      say('已从' + slotName(slot) + '取下。');
    });
  }

  function start() {
    buildPalette();

    var slots = document.querySelectorAll('[data-drop-target]');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('aria-label', '槽位：' + slotName(slot));
      bindSlot(slot);
    });

    global.APP.Drag.init({ onDrop: placeInto });
    say('阶段 3：拖拽已可用。这里只验证交互，还不做化学判定。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window);
