(function (global) {
  'use strict';

  // 单位长度 = 1 根键，最后由 bond 缩放到像素。
  // 规则：环放正多边形，主链走 120° 锯齿，骨架固定成十字。

  var SCAFFOLD_POINTS = {
    CA: { x: 0, y: 0 },
    N: { x: -1, y: 0 },
    C: { x: 0, y: -1 },
    O: { x: -0.866, y: -1.5 },
    OXT: { x: 0.866, y: -1.5 },
    HA: { x: 1, y: 0 }
  };

  // 吲哚（色氨酸）双环：5 元环 + 6 元环共用一条边，按 PDB 原子名给坐标，单位键长。
  var INDOLE = {
    CD2: { x: 0.688, y: -0.5 },
    CE2: { x: 0.688, y: 0.5 },
    CG: { x: -0.263, y: -0.809 },
    CD1: { x: -0.851, y: 0 },
    NE1: { x: -0.263, y: 0.809 },
    CE3: { x: 1.554, y: -1 },
    CZ3: { x: 2.42, y: -0.5 },
    CH2: { x: 2.42, y: 0.5 },
    CZ2: { x: 1.554, y: 1 }
  };

  function rotate(v, degrees) {
    var r = (degrees * Math.PI) / 180;
    return {
      x: v.x * Math.cos(r) - v.y * Math.sin(r),
      y: v.x * Math.sin(r) + v.y * Math.cos(r)
    };
  }

  function normalise(v) {
    var length = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
    return { x: v.x / length, y: v.y / length };
  }

  function adjacency(graph) {
    var adj = {};
    graph.atoms.forEach(function (a) { adj[a.id] = []; });
    graph.bonds.forEach(function (b) {
      if (!adj[b.a] || !adj[b.b]) return;
      adj[b.a].push(b.b);
      adj[b.b].push(b.a);
    });
    return adj;
  }

  function splitBonds(graph) {
    var known = {};
    graph.atoms.forEach(function (a) { known[a.id] = true; });
    var inner = [];
    var stubs = [];
    graph.bonds.forEach(function (b) {
      if (known[b.a] && known[b.b]) inner.push(b);
      else if (known[b.a]) stubs.push({ from: b.a, to: b.b, order: b.order });
      else if (known[b.b]) stubs.push({ from: b.b, to: b.a, order: b.order });
    });
    return { inner: inner, stubs: stubs };
  }

  // 反复剪掉度为 1 的原子，剩下的就是处在环上的原子。
  function ringAtoms(graph, adj) {
    var degree = {};
    var alive = {};
    graph.atoms.forEach(function (a) {
      degree[a.id] = adj[a.id].length;
      alive[a.id] = true;
    });

    var queue = [];
    Object.keys(degree).forEach(function (id) { if (degree[id] <= 1) queue.push(id); });

    while (queue.length) {
      var id = queue.shift();
      if (!alive[id]) continue;
      alive[id] = false;
      adj[id].forEach(function (next) {
        if (!alive[next]) return;
        degree[next] -= 1;
        if (degree[next] <= 1) queue.push(next);
      });
    }

    var result = {};
    graph.atoms.forEach(function (a) { if (alive[a.id]) result[a.id] = true; });
    return result;
  }

  function ringComponents(ringSet, adj) {
    var seen = {};
    var groups = [];
    Object.keys(ringSet).forEach(function (start) {
      if (seen[start]) return;
      var group = [];
      var stack = [start];
      seen[start] = true;
      while (stack.length) {
        var id = stack.pop();
        group.push(id);
        adj[id].forEach(function (next) {
          if (ringSet[next] && !seen[next]) {
            seen[next] = true;
            stack.push(next);
          }
        });
      }
      groups.push(group);
    });
    return groups;
  }

  function ringOrder(group, adj, ringSet) {
    var order = [group[0]];
    var previous = null;
    var current = group[0];
    while (order.length < group.length) {
      var next = adj[current].filter(function (id) {
        return ringSet[id] && id !== previous && order.indexOf(id) < 0;
      })[0];
      if (!next) break;
      order.push(next);
      previous = current;
      current = next;
    }
    return order.length === group.length ? order : null;
  }

  function polygon(order, size) {
    var radius = 1 / (2 * Math.sin(Math.PI / size));
    var points = {};
    order.forEach(function (id, index) {
      var angle = Math.PI + (index * 2 * Math.PI) / size;
      points[id] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
    return points;
  }

  function renameTemplate(template, ids) {
    var points = {};
    var ok = true;
    ids.forEach(function (id) {
      if (!template[id]) { ok = false; return; }
      points[id] = { x: template[id].x, y: template[id].y };
    });
    return ok ? points : null;
  }

  function centroid(points, ids) {
    var x = 0;
    var y = 0;
    ids.forEach(function (id) {
      x += points[id].x;
      y += points[id].y;
    });
    return { x: x / ids.length, y: y / ids.length };
  }

  function placeSystem(local, anchor, target, away) {
    var ref = normalise({
      x: local[anchor].x - local[anchor].x + (0),
      y: 0
    });
    var centre = centroid(local, Object.keys(local));
    var direction = normalise({ x: centre.x - local[anchor].x, y: centre.y - local[anchor].y });
    var wanted = normalise(away);
    var angle = Math.atan2(wanted.y, wanted.x) - Math.atan2(direction.y, direction.x);
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);

    var out = {};
    Object.keys(local).forEach(function (id) {
      var dx = local[id].x - local[anchor].x;
      var dy = local[id].y - local[anchor].y;
      out[id] = {
        x: target.x + dx * cos - dy * sin,
        y: target.y + dx * sin + dy * cos
      };
    });
    return out;
  }

  function buildSystems(graph, adj, ringSet) {
    var groups = ringComponents(ringSet, adj);
    var systems = [];
    var ok = true;

    groups.forEach(function (group) {
      var ringBonds = 0;
      graph.bonds.forEach(function (b) {
        if (ringSet[b.a] && ringSet[b.b]) ringBonds++;
      });

      var local = null;
      var order = ringOrder(group, adj, ringSet);

      if (order && ringBonds === group.length) {
        local = polygon(order, group.length);
      } else {
        local = renameTemplate(INDOLE, group);
      }

      if (!local) { ok = false; return; }
      systems.push({ atoms: group, local: local });
    });

    return ok ? systems : null;
  }

  function molecule(graph, options) {
    var opts = options || {};
    var bond = opts.bond || 34;
    var padding = opts.padding || 22;

    var adj = adjacency(graph);
    var parts = splitBonds(graph);
    var ids = graph.atoms.map(function (a) { return a.id; });
    var known = {};
    ids.forEach(function (id) { known[id] = true; });

    var ringSet = ringAtoms(graph, adj);
    // 骨架位置是固定的，不能参与环的排布（脯氨酸的环就把 CA 和 N 卷了进去）
    Object.keys(SCAFFOLD_POINTS).forEach(function (id) { delete ringSet[id]; });
    var systems = buildSystems(graph, adj, ringSet);
    if (systems === null) return null;

    var systemOf = {};
    var placedSystem = {};
    systems.forEach(function (system, index) {
      system.atoms.forEach(function (id) { systemOf[id] = index; });
    });

    var points = {};
    var occupied = [];

    function free(point) {
      var min = 0.72;
      for (var i = 0; i < occupied.length; i++) {
        var dx = point.x - occupied[i].x;
        var dy = point.y - occupied[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < min) return false;
      }
      return true;
    }

    function remember(id, point) {
      points[id] = point;
      occupied.push(point);
    }

    // 骨架按教科书十字固定：羧基在上、氨基在左、氢在右、侧链朝下。
    var hasScaffold = false;
    Object.keys(SCAFFOLD_POINTS).forEach(function (id) { if (known[id]) hasScaffold = true; });

    var queue = [];

    if (hasScaffold) {
      Object.keys(SCAFFOLD_POINTS).forEach(function (id) {
        if (known[id]) remember(id, { x: SCAFFOLD_POINTS[id].x, y: SCAFFOLD_POINTS[id].y });
      });
      adj.CA.forEach(function (next) {
        if (!known[next] || points[next]) return;
        queue.push({ id: next, from: 'CA', dir: { x: 0, y: 1 } });
      });
    } else {
      // 侧链图：从指定的根原子开始，默认朝下长（和教材里 R 基在 Cα 下方一致）
      var root = (opts.root && known[opts.root])
        ? opts.root
        : (ids.filter(function (id) {
          return !ringSet[id] && adj[id].length === 1;
        })[0] || ids[0]);
      var heading = opts.direction || { x: 0, y: 1 };
      remember(root, { x: 0, y: 0 });
      adj[root].forEach(function (next) {
        queue.push({ id: next, from: root, dir: heading });
      });
    }

    var flip = 1;

    while (queue.length) {
      var item = queue.shift();
      if (points[item.id]) continue;

      var target = {
        x: points[item.from].x + item.dir.x,
        y: points[item.from].y + item.dir.y
      };

      var systemIndex = systemOf[item.id];
      if (systemIndex !== undefined && !placedSystem[systemIndex]) {
        var system = systems[systemIndex];
        placedSystem[systemIndex] = true;
        var block = placeSystem(system.local, item.id, target, item.dir);
        system.atoms.forEach(function (id) {
          if (block[id]) remember(id, block[id]);
        });
      } else {
        remember(item.id, target);
      }

      adj[item.id].forEach(function (next) {
        if (!known[next] || points[next] || next === item.from) return;

        var sign = flip;
        flip = -flip;
        var direction = rotate(item.dir, 60 * sign);
        var candidate = {
          x: points[item.id].x + direction.x,
          y: points[item.id].y + direction.y
        };

        if (!free(candidate)) {
          var alternative = rotate(item.dir, -60 * sign);
          var other = {
            x: points[item.id].x + alternative.x,
            y: points[item.id].y + alternative.y
          };
          if (free(other) || !free(candidate)) direction = alternative;
        }

        queue.push({ id: next, from: item.id, dir: direction });
      });
    }

    if (Object.keys(points).length !== ids.length) return null;

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    ids.forEach(function (id) {
      minX = Math.min(minX, points[id].x);
      maxX = Math.max(maxX, points[id].x);
      minY = Math.min(minY, points[id].y);
      maxY = Math.max(maxY, points[id].y);
    });

    var scaled = {};
    ids.forEach(function (id) {
      scaled[id] = {
        x: (points[id].x - minX) * bond + padding,
        y: (points[id].y - minY) * bond + padding
      };
    });

    return {
      points: scaled,
      width: (maxX - minX) * bond + padding * 2,
      height: (maxY - minY) * bond + padding * 2,
      stubs: parts.stubs,
      inner: parts.inner
    };
  }

  global.APP = global.APP || {};
  global.APP.Layout = {
    molecule: molecule
  };

})(window);
