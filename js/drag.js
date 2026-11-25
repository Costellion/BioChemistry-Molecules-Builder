(function (global) {
  'use strict';

  var active = null;
  var handlers = { onDrop: null, onMessage: null };

  function findTarget(node) {
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.hasAttribute('data-drop-target')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function setTarget(node) {
    if (!active || active.target === node) return;
    if (active.target) active.target.classList.remove('is-drop-target');
    active.target = node;
    if (node) node.classList.add('is-drop-target');
  }

  function removeGhost(drag) {
    if (drag.ghost && drag.ghost.parentNode) {
      drag.ghost.parentNode.removeChild(drag.ghost);
    }
    drag.ghost = null;
  }

  function detach(drag) {
    var chip = drag.chip;
    chip.removeEventListener('pointermove', onPointerMove);
    chip.removeEventListener('pointerup', onPointerUp);
    chip.removeEventListener('pointercancel', onPointerCancel);
    chip.classList.remove('is-dragging');
    if (chip.hasPointerCapture && chip.hasPointerCapture(drag.pointerId)) {
      chip.releasePointerCapture(drag.pointerId);
    }
  }

  function clearDropState(drag) {
    if (drag.target) drag.target.classList.remove('is-drop-target');
    drag.target = null;
  }

  function snapBack(drag) {
    var ghost = drag.ghost;
    if (!ghost) return;
    ghost.style.transition = 'transform 160ms cubic-bezier(.2, .8, .2, 1)';
    ghost.style.transform =
      'translate(' + drag.originX + 'px,' + drag.originY + 'px) rotate(0deg)';
    window.setTimeout(function () { removeGhost(drag); }, 190);
  }

  function onPointerMove(event) {
    if (!active || event.pointerId !== active.pointerId) return;

    var x = event.clientX - active.offsetX;
    var y = event.clientY - active.offsetY;
    active.ghost.style.transform =
      'translate(' + x + 'px,' + y + 'px) rotate(-1.5deg)';

    var under = document.elementFromPoint(event.clientX, event.clientY);
    setTarget(under ? findTarget(under) : null);
  }

  function onPointerUp(event) {
    if (!active || event.pointerId !== active.pointerId) return;

    var drag = active;
    var target = drag.target;
    detach(drag);
    clearDropState(drag);
    active = null;

    var accepted = false;
    if (target && handlers.onDrop) {
      accepted = handlers.onDrop(target, drag.chip) !== false;
    }

    if (accepted) {
      removeGhost(drag);
    } else {
      snapBack(drag);
    }
  }

  function onPointerCancel(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    var drag = active;
    detach(drag);
    clearDropState(drag);
    removeGhost(drag);
    active = null;
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    var chip = event.currentTarget;
    var rect = chip.getBoundingClientRect();

    var ghost = chip.cloneNode(true);
    ghost.classList.remove('is-dragging');
    ghost.classList.add('drag-ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.transform = 'translate(' + rect.left + 'px,' + rect.top + 'px) rotate(0deg)';
    document.body.appendChild(ghost);

    chip.classList.add('is-dragging');
    // 捕获指针：之后即使移到积木外面，事件仍然回到这块积木上
    chip.setPointerCapture(event.pointerId);

    active = {
      chip: chip,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originX: rect.left,
      originY: rect.top,
      ghost: ghost,
      target: null
    };

    chip.addEventListener('pointermove', onPointerMove);
    chip.addEventListener('pointerup', onPointerUp);
    chip.addEventListener('pointercancel', onPointerCancel);

    event.preventDefault();
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape' || !active) return;
    var drag = active;
    detach(drag);
    clearDropState(drag);
    removeGhost(drag);
    active = null;
  }

  function bind(chip) {
    chip.addEventListener('pointerdown', onPointerDown);
  }

  function init(options) {
    handlers.onDrop = (options && options.onDrop) || null;
    handlers.onMessage = (options && options.onMessage) || null;
    document.addEventListener('keydown', onKeyDown);
  }

  global.APP = global.APP || {};
  global.APP.Drag = {
    bind: bind,
    init: init
  };

})(window);
