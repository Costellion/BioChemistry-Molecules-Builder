(function (global) {
  'use strict';

  // 光斑跟随（Fluent 的 Reveal 效果）
  function init() {
    var fine = global.matchMedia && global.matchMedia('(pointer: fine)').matches;
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    var nodes = document.querySelectorAll('.chip');
    Array.prototype.forEach.call(nodes, function (node) {
      var frame = 0;

      node.addEventListener('pointermove', function (event) {
        if (frame) return;
        frame = global.requestAnimationFrame(function () {
          frame = 0;
          var rect = node.getBoundingClientRect();
          node.style.setProperty('--mx', (event.clientX - rect.left) + 'px');
          node.style.setProperty('--my', (event.clientY - rect.top) + 'px');
        });
      });
    });
  }

  global.APP = global.APP || {};
  global.APP.Effects = { init: init };

})(window);
