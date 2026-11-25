(function (global) {
  'use strict';

  var VALENCE = { C: 4, N: 3, O: 2, S: 2, H: 1 };

  function copyAtoms(list) {
    return list.map(function (a) { return { id: a.id, el: a.el }; });
  }

  function copyBonds(list) {
    return list.map(function (b) { return { a: b.a, b: b.b, order: b.order }; });
  }

  function adjacency(graph) {
    var adj = {};
    graph.atoms.forEach(function (a) { adj[a.id] = []; });
    graph.bonds.forEach(function (b) {
      if (!adj[b.a] || !adj[b.b]) return;
      adj[b.a].push({ to: b.b, order: b.order });
      adj[b.b].push({ to: b.a, order: b.order });
    });
    return adj;
  }

  function usedValence(graph) {
    var used = {};
    graph.atoms.forEach(function (a) { used[a.id] = 0; });
    graph.bonds.forEach(function (b) {
      if (used[b.a] === undefined || used[b.b] === undefined) return;
      used[b.a] += b.order;
      used[b.b] += b.order;
    });
    return used;
  }

  // 氢不写在图里：每个原子还空着的价键数就是它隐含的氢数。
  // 空着的 R 槽不会被自动补成氢，所以 Gly 必须真的放一个 H 进去才算成立。
  function implicitHydrogen(graph) {
    var used = usedValence(graph);
    var out = {};
    graph.atoms.forEach(function (a) {
      var limit = VALENCE[a.el];
      out[a.id] = limit === undefined ? 0 : Math.max(0, limit - (used[a.id] || 0));
    });
    return out;
  }

  function validate(graph) {
    var errors = [];
    var known = {};

    graph.atoms.forEach(function (a) {
      if (known[a.id]) errors.push('原子名重复：' + a.id);
      known[a.id] = true;
      if (VALENCE[a.el] === undefined) errors.push('未知元素 ' + a.el + '（原子 ' + a.id + '）');
    });

    var pairs = {};
    graph.bonds.forEach(function (b) {
      if (!known[b.a] || !known[b.b]) {
        errors.push('键的端点不存在：' + b.a + ' - ' + b.b);
        return;
      }
      if (b.a === b.b) errors.push('自环键：' + b.a);
      if ([1, 2, 3].indexOf(b.order) < 0) errors.push('非法键级 ' + b.order + '（' + b.a + ' - ' + b.b + '）');
      var key = b.a < b.b ? b.a + '|' + b.b : b.b + '|' + b.a;
      if (pairs[key]) errors.push('重复键：' + b.a + ' - ' + b.b);
      pairs[key] = true;
    });

    var used = usedValence(graph);
    graph.atoms.forEach(function (a) {
      var limit = VALENCE[a.el];
      if (limit === undefined) return;
      var u = used[a.id] || 0;
      if (u > limit) errors.push('价键溢出：' + a.id + ' 已用 ' + u + '，上限 ' + limit);
      if (a.el === 'H' && u !== 1) errors.push('氢原子必须恰好成 1 键：' + a.id + ' 当前 ' + u);
    });

    return errors;
  }

  function formula(graph) {
    var used = usedValence(graph);
    var count = {};
    var hydrogen = 0;

    graph.atoms.forEach(function (a) {
      count[a.el] = (count[a.el] || 0) + 1;
      var limit = VALENCE[a.el];
      if (limit === undefined) return;
      var free = limit - (used[a.id] || 0);
      if (free > 0 && a.el !== 'H') hydrogen += free;
    });
    count.H = (count.H || 0) + hydrogen;

    var order = ['C', 'H', 'N', 'O', 'S'];
    var text = '';
    order.forEach(function (e) {
      if (count[e]) text += e + (count[e] > 1 ? count[e] : '');
    });
    Object.keys(count).forEach(function (e) {
      if (order.indexOf(e) < 0) text += e + (count[e] > 1 ? count[e] : '');
    });
    return text;
  }

  function degrees(graph) {
    var adj = adjacency(graph);
    var out = {};
    Object.keys(adj).forEach(function (id) { out[id] = adj[id].length; });
    return out;
  }

  function build(record) {
    var data = global.APP.DATA;
    var graph = {
      atoms: copyAtoms(data.scaffold.atoms).concat(copyAtoms(record.frag.atoms)),
      bonds: copyBonds(data.scaffold.bonds).concat(copyBonds(record.frag.bonds))
    };
    var errors = validate(graph);
    if (errors.length) throw new Error(record.id + ' 图结构非法：' + errors.join('；'));
    return graph;
  }

  global.APP = global.APP || {};
  global.APP.Graph = {
    VALENCE: VALENCE,
    adjacency: adjacency,
    usedValence: usedValence,
    implicitHydrogen: implicitHydrogen,
    validate: validate,
    formula: formula,
    degrees: degrees,
    build: build
  };

})(window);
