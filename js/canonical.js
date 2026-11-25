(function (global) {
  'use strict';

  var DEFAULT_CAP = 200000;

  function pad(value, width) {
    var text = String(value);
    while (text.length < width) text = '0' + text;
    return text;
  }

  // 把"原子自身 + 它的邻域"反复折叠成一个颜色标签，直到颜色不再变化。
  // 折叠收敛后，同一颜色的原子在当前图上彼此不可区分（还可能互为等价位置）。
  function refine(graph, adj, used) {
    var element = {};
    var ids = graph.atoms.map(function (a) {
      element[a.id] = a.el;
      return a.id;
    });

    var color = {};
    ids.forEach(function (id) {
      color[id] = element[id] + ':' + pad(used[id] || 0, 2) + ':' + pad(adj[id].length, 2);
    });

    for (var round = 0; round < ids.length; round++) {
      var signature = {};
      ids.forEach(function (id) {
        var neighbours = adj[id].map(function (e) {
          return e.order + '@' + color[e.to];
        }).sort();
        signature[id] = element[id] + '|' + pad(used[id] || 0, 2) + '|' + neighbours.join(',');
      });

      var distinct = [];
      var seen = {};
      ids.forEach(function (id) {
        if (!seen[signature[id]]) {
          seen[signature[id]] = true;
          distinct.push(signature[id]);
        }
      });
      distinct.sort();

      var index = {};
      distinct.forEach(function (s, i) { index[s] = i; });

      var changed = false;
      ids.forEach(function (id) {
        var next = pad(index[signature[id]], 4);
        if (color[id] !== next) {
          color[id] = next;
          changed = true;
        }
      });
      if (!changed) break;
    }

    return color;
  }

  function permute(items, visit) {
    var current = [];
    var taken = items.map(function () { return false; });

    (function walk() {
      if (current.length === items.length) {
        visit(current.slice());
        return;
      }
      for (var i = 0; i < items.length; i++) {
        if (taken[i]) continue;
        taken[i] = true;
        current.push(items[i]);
        walk();
        current.pop();
        taken[i] = false;
      }
    })();
  }

  function serialise(order, adj, element) {
    var position = {};
    for (var i = 0; i < order.length; i++) position[order[i]] = i;

    var parts = [];
    for (var j = 0; j < order.length; j++) {
      var id = order[j];
      var neighbours = adj[id].map(function (e) {
        return pad(position[e.to], 3) + ':' + e.order;
      }).sort();
      parts.push(element[id] + '#' + neighbours.join(','));
    }
    return parts.join(';');
  }

  function factorial(n) {
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  function prepare(graph) {
    var Graph = global.APP.Graph;
    var adj = Graph.adjacency(graph);
    var used = Graph.usedValence(graph);
    var color = refine(graph, adj, used);

    var buckets = {};
    var keys = [];
    graph.atoms.forEach(function (a) {
      var c = color[a.id];
      if (!buckets[c]) {
        buckets[c] = [];
        keys.push(c);
      }
      buckets[c].push(a.id);
    });
    keys.sort();

    var groups = keys.map(function (key) {
      return buckets[key].slice().sort();
    });

    var combinations = groups.reduce(function (product, group) {
      return product * factorial(group.length);
    }, 1);

    return { adj: adj, groups: groups, combinations: combinations };
  }

  // 颜色相同的位置互为候选，枚举这些位置的全部排列，取字典序最小的写法。
  // 这样同一分子无论原子以什么顺序录入，得到的编码都相同。
  function compute(graph, cap) {
    if (!graph.atoms.length) return { code: '', exact: true, groups: 0, combinations: 0 };

    var info = prepare(graph);
    var element = {};
    graph.atoms.forEach(function (a) { element[a.id] = a.el; });

    var best = null;
    var visited = 0;
    var exact = true;

    (function walk(groupIndex, prefix) {
      if (visited >= cap) {
        exact = false;
        return;
      }
      if (groupIndex === info.groups.length) {
        visited += 1;
        var text = serialise(prefix, info.adj, element);
        if (best === null || text < best) best = text;
        return;
      }
      permute(info.groups[groupIndex], function (arrangement) {
        walk(groupIndex + 1, prefix.concat(arrangement));
      });
    })(0, []);

    return {
      code: best,
      exact: exact,
      groups: info.groups.length,
      combinations: info.combinations
    };
  }

  function code(graph, options) {
    var limit = (options && options.cap) || DEFAULT_CAP;
    return compute(graph, limit).code;
  }

  function inspect(graph, options) {
    var limit = (options && options.cap) || DEFAULT_CAP;
    var summary = compute(graph, limit);
    return {
      code: summary.code,
      exact: summary.exact,
      colorClasses: summary.groups,
      combinations: summary.combinations,
      atoms: graph.atoms.length,
      bonds: graph.bonds.length
    };
  }

  function same(a, b, options) {
    return code(a, options) === code(b, options);
  }

  global.APP = global.APP || {};
  global.APP.Canonical = {
    code: code,
    inspect: inspect,
    same: same,
    DEFAULT_CAP: DEFAULT_CAP
  };

})(window);
