(function (global) {
  'use strict';

  var DEFAULTS = {
    bond: 34,
    padding: 22,
    iterations: 420,
    seed: 17,
    stub: 26,
    hydrogens: true,
    root: null,
    direction: null
  };

  var ELEMENT_COLOR = {
    C: '#2b3242',
    N: '#2f6feb',
    O: '#d14343',
    S: '#c08a1e',
    H: '#7b8496'
  };

  var VALENCE = { C: 4, N: 3, O: 2, S: 2, H: 1 };

  // 氢不写进图里，按"还剩几个价"补出来：把已有键的方向摊开，在空出来的方向补 H。
  function hydrogenSites(graph, points, bondLength) {
    var used = {};
    var neighbours = {};
    graph.atoms.forEach(function (a) {
      used[a.id] = 0;
      neighbours[a.id] = [];
    });

    var centre = { x: 0, y: 0 };
    var counted = 0;
    graph.atoms.forEach(function (a) {
      var p = points[a.id];
      if (!p) return;
      centre.x += p.x;
      centre.y += p.y;
      counted += 1;
    });
    if (counted) {
      centre.x /= counted;
      centre.y /= counted;
    }
    graph.bonds.forEach(function (b) {
      used[b.a] += b.order;
      used[b.b] += b.order;
      neighbours[b.a].push(b.b);
      neighbours[b.b].push(b.a);
    });

    var sites = [];
    graph.atoms.forEach(function (a) {
      if (a.el === 'H') return;
      var limit = VALENCE[a.el];
      if (!limit) return;
      var free = limit - used[a.id];
      if (free <= 0) return;

      var base = points[a.id];
      if (!base) return;

      var taken = neighbours[a.id].map(function (id) {
        var p = points[id];
        return Math.atan2(p.y - base.y, p.x - base.x);
      }).sort(function (x, y) { return x - y; });

      var total = taken.length + free;
      var step = (Math.PI * 2) / total;
      var start = taken.length ? taken[0] : 0;
      var candidates = [];

      for (var k = 0; k < total; k++) {
        var angle = start + k * step;
        var occupied = taken.some(function (existing) {
          var diff = Math.atan2(Math.sin(angle - existing), Math.cos(angle - existing));
          return Math.abs(diff) < 0.25;
        });
        if (!occupied) candidates.push(angle);
      }

      // 按"离其它原子越远越好、越朝外越好"打分，取前 free 个方向
      var radius = bondLength * 0.88;
      var scored = candidates.map(function (angle) {
        var px = base.x + Math.cos(angle) * radius;
        var py = base.y + Math.sin(angle) * radius;
        var nearest = Infinity;

        graph.atoms.forEach(function (other) {
          if (other.id === a.id) return;
          var p = points[other.id];
          if (!p) return;
          var dist = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
          if (dist < nearest) nearest = dist;
        });
        if (!isFinite(nearest)) nearest = bondLength * 2;

        var outward = Math.sqrt(
          (px - centre.x) * (px - centre.x) + (py - centre.y) * (py - centre.y)
        );

        return { x: px, y: py, score: nearest + outward * 0.4 };
      });

      scored.sort(function (u, v) { return v.score - u.score; });
      scored.slice(0, free).forEach(function (site) {
        sites.push({ x: site.x, y: site.y, fromX: base.x, fromY: base.y });
      });
    });
    return sites;
  }

  function createRandom(seed) {
    var state = seed || 17;
    return function () {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  function optionsOf(options) {
    var result = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      result[key] = (options && options[key] !== undefined) ? options[key] : DEFAULTS[key];
    });
    return result;
  }

  // 片段里指向骨架（CA/N/C/O/OXT/HA）的键不参与布局，它们是"接到 α-碳上"的那一根。
  function splitBonds(fragment) {
    var known = {};
    fragment.atoms.forEach(function (a) { known[a.id] = true; });

    var inner = [];
    var stubs = [];
    fragment.bonds.forEach(function (b) {
      if (known[b.a] && known[b.b]) inner.push(b);
      else if (known[b.a]) stubs.push({ from: b.a, to: b.b, order: b.order });
      else if (known[b.b]) stubs.push({ from: b.b, to: b.a, order: b.order });
    });
    return { inner: inner, stubs: stubs };
  }

  // Fruchterman–Reingold：节点互斥、成键相吸，迭代到大致均匀。
  // 好处是不用为环单独写一套坐标，苯环、吲哚这类会自动张开。
  function layout(fragment, options) {
    var opts = optionsOf(options);
    var ids = fragment.atoms.map(function (a) { return a.id; });
    if (!ids.length) return { points: {}, width: 0, height: 0 };

    var parts = splitBonds(fragment);
    var random = createRandom(opts.seed);
    var position = {};
    ids.forEach(function (id, index) {
      var angle = (index / ids.length) * Math.PI * 2;
      position[id] = {
        x: Math.cos(angle) + (random() - 0.5) * 0.05,
        y: Math.sin(angle) + (random() - 0.5) * 0.05
      };
    });

    var ideal = 1;
    var temperature = 0.5;

    for (var step = 0; step < opts.iterations; step++) {
      var delta = {};
      ids.forEach(function (id) { delta[id] = { x: 0, y: 0 }; });

      for (var i = 0; i < ids.length; i++) {
        for (var j = i + 1; j < ids.length; j++) {
          var a = ids[i];
          var b = ids[j];
          var dx = position[a].x - position[b].x;
          var dy = position[a].y - position[b].y;
          var distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var force = (ideal * ideal) / distance;
          var ux = dx / distance;
          var uy = dy / distance;
          delta[a].x += ux * force;
          delta[a].y += uy * force;
          delta[b].x -= ux * force;
          delta[b].y -= uy * force;
        }
      }

      parts.inner.forEach(function (edge) {
        var dx = position[edge.a].x - position[edge.b].x;
        var dy = position[edge.a].y - position[edge.b].y;
        var distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var force = (distance * distance) / ideal;
        var ux = dx / distance;
        var uy = dy / distance;
        delta[edge.a].x -= ux * force;
        delta[edge.a].y -= uy * force;
        delta[edge.b].x += ux * force;
        delta[edge.b].y += uy * force;
      });

      ids.forEach(function (id) {
        delta[id].x -= position[id].x * 0.05;
        delta[id].y -= position[id].y * 0.05;

        var length = Math.sqrt(delta[id].x * delta[id].x + delta[id].y * delta[id].y) || 0.01;
        var limited = Math.min(length, temperature);
        position[id].x += (delta[id].x / length) * limited;
        position[id].y += (delta[id].y / length) * limited;
      });

      temperature = Math.max(0.01, temperature * 0.985);
    }

    // FR 只保证"大致均匀"，键长仍会参差。这里再做一轮松弛：
    // 成键的两端向标准键长靠拢，非键合但挨太近的原子互相推开。
    var bonded = {};
    parts.inner.forEach(function (edge) {
      bonded[edge.a + '|' + edge.b] = true;
      bonded[edge.b + '|' + edge.a] = true;
    });

    for (var pass = 0; pass < 80; pass++) {
      parts.inner.forEach(function (edge) {
        var ax = position[edge.a];
        var bx = position[edge.b];
        var dx = bx.x - ax.x;
        var dy = bx.y - ax.y;
        var distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var correction = ((distance - ideal) / distance) * 0.5;
        ax.x += dx * correction;
        ax.y += dy * correction;
        bx.x -= dx * correction;
        bx.y -= dy * correction;
      });

      for (var m = 0; m < ids.length; m++) {
        for (var n = m + 1; n < ids.length; n++) {
          var p = ids[m];
          var q = ids[n];
          if (bonded[p + '|' + q]) continue;
          var ddx = position[q].x - position[p].x;
          var ddy = position[q].y - position[p].y;
          var gap = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01;
          if (gap >= 1.15) continue;
          var push = ((1.15 - gap) / gap) * 0.35;
          position[p].x -= ddx * push;
          position[p].y -= ddy * push;
          position[q].x += ddx * push;
          position[q].y += ddy * push;
        }
      }
    }

    // 缩放到像素：先按平均键长归一，再平移到左上角留出 padding。
    var average = 1;
    if (parts.inner.length) {
      var total = 0;
      parts.inner.forEach(function (edge) {
        var dx = position[edge.a].x - position[edge.b].x;
        var dy = position[edge.a].y - position[edge.b].y;
        total += Math.sqrt(dx * dx + dy * dy);
      });
      average = total / parts.inner.length || 1;
    }
    var scale = opts.bond / average;

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    ids.forEach(function (id) {
      position[id].x *= scale;
      position[id].y *= scale;
      minX = Math.min(minX, position[id].x);
      maxX = Math.max(maxX, position[id].x);
      minY = Math.min(minY, position[id].y);
      maxY = Math.max(maxY, position[id].y);
    });

    var offsetX = opts.padding - minX;
    var offsetY = opts.padding - minY;
    ids.forEach(function (id) {
      position[id].x += offsetX;
      position[id].y += offsetY;
    });

    return {
      points: position,
      width: maxX - minX + opts.padding * 2,
      height: maxY - minY + opts.padding * 2,
      stubs: parts.stubs,
      inner: parts.inner
    };
  }

  function pointOnLine(from, to, ratio, shift) {
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / length;
    var ny = dx / length;
    return {
      x: from.x + dx * ratio + nx * shift,
      y: from.y + dy * ratio + ny * shift
    };
  }

  function markup(fragment, options) {
    var opts = optionsOf(options);
    var placed = (global.APP.Layout && global.APP.Layout.molecule(fragment, opts)) || layout(fragment, opts);
    if (!placed || !placed.points || !fragment.atoms.length) return '';

    var element = {};
    fragment.atoms.forEach(function (a) { element[a.id] = a.el; });
    var margin = opts.hydrogens === false
      ? 0
      : Math.round(opts.bond * 0.88 + 10);
    var width = placed.width + opts.stub + margin * 2;
    var height = placed.height + margin * 2;
    var parts = [];

    parts.push(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(width) +
      '" height="' + Math.round(height) + '" viewBox="0 0 ' +
      Math.round(width) + ' ' + Math.round(height) + '">'
    );
    if (margin) parts.push('<g transform="translate(' + margin + ',' + margin + ')">');

    placed.stubs.forEach(function (stub) {
      var from = placed.points[stub.from];
      if (!from) return;
      var to = { x: from.x - opts.stub, y: from.y };
      parts.push(
        '<line x1="' + from.x.toFixed(1) + '" y1="' + from.y.toFixed(1) +
        '" x2="' + to.x.toFixed(1) + '" y2="' + to.y.toFixed(1) +
        '" stroke="#c3c9d6" stroke-width="2" stroke-dasharray="4 3"/>'
      );
      // Pro 特判
      if (stub.to !== 'CA') {
        var label = stub.to.replace(/[^A-Za-z].*$/, '').charAt(0) || '?';
        parts.push(
          '<text x="' + (to.x - 2).toFixed(1) + '" y="' + (to.y + 4).toFixed(1) +
          '" text-anchor="end" font-size="10" font-family="system-ui, sans-serif" fill="#9aa3b2">' +
          label + '</text>'
        );
      }
    });

    placed.inner.forEach(function (edge) {
      var a = placed.points[edge.a];
      var b = placed.points[edge.b];
      if (!a || !b) return;

      var key = edge.a + '|' + edge.b;

      if (edge.order === 2) {
        var shift = 2.6;
        var p1 = pointOnLine(a, b, 0.18, shift);
        var p2 = pointOnLine(a, b, 0.82, shift);
        var p3 = pointOnLine(a, b, 0.18, -shift);
        var p4 = pointOnLine(a, b, 0.82, -shift);
        parts.push('<line data-bond="' + key + '" x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '" stroke="#2b3242" stroke-width="1.8"/>');
        parts.push('<line data-bond="' + key + '" x1="' + p3.x.toFixed(1) + '" y1="' + p3.y.toFixed(1) + '" x2="' + p4.x.toFixed(1) + '" y2="' + p4.y.toFixed(1) + '" stroke="#2b3242" stroke-width="1.8"/>');
      } else {
        parts.push(
          '<line data-bond="' + key + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
          '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
          '" stroke="#2b3242" stroke-width="1.8"/>'
        );
      }
    });

    fragment.atoms.forEach(function (a) {
      var p = placed.points[a.id];
      if (!p) return;
      var fill = ELEMENT_COLOR[a.el] || '#2b3242';
      parts.push('<circle data-atom="' + a.id + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="11" fill="#ffffff" stroke="' + fill + '" stroke-width="1.6"/>');
      parts.push(
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 3.8).toFixed(1) +
        '" text-anchor="middle" font-size="11" font-family="system-ui, sans-serif" fill="' + fill + '">' +
        a.el + '</text>'
      );
      // 为了方便点击，增加了透明的大点击区盖在上面
      parts.push('<circle data-atom="' + a.id + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="19" fill="transparent" style="cursor:pointer"/>');
    });

    if (opts.hydrogens !== false) {
      hydrogenSites(fragment, placed.points, opts.bond).forEach(function (site) {
        parts.push(
          '<line x1="' + site.fromX.toFixed(1) + '" y1="' + site.fromY.toFixed(1) +
          '" x2="' + site.x.toFixed(1) + '" y2="' + site.y.toFixed(1) +
          '" stroke="#9aa3b2" stroke-width="1.4"/>'
        );
        parts.push(
          '<circle cx="' + site.x.toFixed(1) + '" cy="' + site.y.toFixed(1) +
          '" r="8" fill="#ffffff" stroke="#9aa3b2" stroke-width="1.2"/>'
        );
        parts.push(
          '<text x="' + site.x.toFixed(1) + '" y="' + (site.y + 3.2).toFixed(1) +
          '" text-anchor="middle" font-size="9" font-family="system-ui, sans-serif" fill="#7b8496">H</text>'
        );
      });
    }

    parts.push(margin ? '</g>' : '');
    parts.push('</svg>');
    return parts.join('');
  }

  global.APP = global.APP || {};
  global.APP.Render = {
    layout: layout,
    markup: markup
  };

})(window);
