(function (global) {
  'use strict';

  var META = {
    version: 2,
    updated: '2026-11-25',
    naming: '骨架原子保留名：CA(α-碳)、N(氨基氮)、C(羧基碳)、O(羰基氧)、OXT(羟基氧)、HA(α-氢)。侧链原子沿用 PDB 惯用名（CB/CG/CD/CE/CZ/NZ/OG/SG/OD1/OE1/ND1/NE1/NE2/NH1/NH2 等）。',
    graph: 'atoms 只声明节点，bonds 声明边。bonds 的 a/b 可指向保留骨架原子名，用于表示侧链与骨架的连接；Pro 另有一条 CD-N 的闭环键。氢不写入数据，由价键表按隐式氢规则补足。芳香环用 Kekulé 交替单双键表示。',
    source: '结构式、pKa、疏水指数、亲疏水与必需性依据：杨荣武《生物化学原理》（第四版）相应表格及图 2-2～2-5。pI 由该表 pKa 计算得出。',
    scope: '收录 20 种常见的蛋白质氨基酸。'
  };

  var CATEGORIES = {
    aliphatic: { label: '非极性脂肪族', charge: '中性' },
    aromatic: { label: '芳香族', charge: '中性' },
    polar: { label: '侧链不带电的极性', charge: '中性' },
    basic: { label: '侧链带正电荷', charge: '正' },
    acidic: { label: '侧链带负电荷', charge: '负' }
  };

  var SCAFFOLD = {
    atoms: [
      { id: 'CA', el: 'C' },
      { id: 'N', el: 'N' },
      { id: 'C', el: 'C' },
      { id: 'O', el: 'O' },
      { id: 'OXT', el: 'O' },
      { id: 'HA', el: 'H' }
    ],
    bonds: [
      { a: 'CA', b: 'N', order: 1 },
      { a: 'CA', b: 'C', order: 1 },
      { a: 'CA', b: 'HA', order: 1 },
      { a: 'C', b: 'O', order: 2 },
      { a: 'C', b: 'OXT', order: 1 }
    ],
    slots: {
      amino: 'N',
      carboxyl: 'C',
      hydrogen: 'HA',
      sideChain: 'CA'
    }
  };

  var AMINO_ACIDS = [
    {
      id: 'ala',
      zh: '丙氨酸',
      en: 'alanine',
      abbr3: 'Ala',
      abbr1: 'A',
      category: 'aliphatic',
      solubility: '疏水',
      essential: '非必需',
      pKa: { carboxyl: 2.3, amino: 9.7, sideChain: null },
      pI: 6.00,
      hydropathy: 0.62,
      formula: 'C3H7NO2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 }
        ]
      },
      note: '侧链仅为一个甲基，是最小的手性氨基酸，疏水。'
    },
    {
      id: 'gly',
      zh: '甘氨酸',
      en: 'glycine',
      abbr3: 'Gly',
      abbr1: 'G',
      category: 'aliphatic',
      solubility: '疏水',
      essential: '非必需',
      pKa: { carboxyl: 2.4, amino: 9.8, sideChain: null },
      pI: 6.10,
      hydropathy: 0.40,
      formula: 'C2H5NO2',
      frag: {
        atoms: [
          { id: 'HA2', el: 'H' }
        ],
        bonds: [
          { a: 'CA', b: 'HA2', order: 1 }
        ]
      },
      note: '侧链是一个氢原子而非碳氢链，α-碳不具手性，是唯一无手性中心的蛋白质氨基酸。其疏水性不典型，教材也常将其另列为中性一类。'
    },
    {
      id: 'ile',
      zh: '异亮氨酸',
      en: 'isoleucine',
      abbr3: 'Ile',
      abbr1: 'I',
      category: 'aliphatic',
      solubility: '疏水',
      essential: '必需',
      pKa: { carboxyl: 2.4, amino: 9.7, sideChain: null },
      pI: 6.05,
      hydropathy: 1.40,
      formula: 'C6H13NO2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG1', el: 'C' },
          { id: 'CG2', el: 'C' },
          { id: 'CD1', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG1', order: 1 },
          { a: 'CB', b: 'CG2', order: 1 },
          { a: 'CG1', b: 'CD1', order: 1 }
        ]
      },
      note: '侧链为仲丁基，支链位于 β 碳。与 Leu 互为同分异构体（均为 C6H13），差别只在支链位置。'
    },
    {
      id: 'leu',
      zh: '亮氨酸',
      en: 'leucine',
      abbr3: 'Leu',
      abbr1: 'L',
      category: 'aliphatic',
      solubility: '疏水',
      essential: '必需',
      pKa: { carboxyl: 2.4, amino: 9.6, sideChain: null },
      pI: 6.00,
      hydropathy: 1.10,
      formula: 'C6H13NO2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD1', el: 'C' },
          { id: 'CD2', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD1', order: 1 },
          { a: 'CG', b: 'CD2', order: 1 }
        ]
      },
      note: '侧链为异丁基，支链位于 γ 碳。与 Ile 互为同分异构体。'
    },
    {
      id: 'met',
      zh: '甲硫氨酸',
      en: 'methionine',
      abbr3: 'Met',
      abbr1: 'M',
      category: 'aliphatic',
      solubility: '疏水',
      essential: '必需',
      pKa: { carboxyl: 2.3, amino: 9.2, sideChain: null },
      pI: 5.75,
      hydropathy: 0.64,
      formula: 'C5H11NO2S',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'SD', el: 'S' },
          { id: 'CE', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'SD', order: 1 },
          { a: 'SD', b: 'CE', order: 1 }
        ]
      },
      note: '侧链含硫醚（亦称蛋氨酸）。硫与氧性质相近，故其疏水性不典型。是真核生物蛋白质合成的起始氨基酸。'
    },
    {
      id: 'pro',
      zh: '脯氨酸',
      en: 'proline',
      abbr3: 'Pro',
      abbr1: 'P',
      category: 'aliphatic',
      solubility: '疏水',
      essential: '非必需',
      pKa: { carboxyl: 2.0, amino: 11.0, sideChain: null },
      pI: 6.50,
      hydropathy: 0.12,
      formula: 'C5H9NO2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD', order: 1 },
          { a: 'CD', b: 'N', order: 1 }
        ]
      },
      note: '侧链与 α-氨基成环（吡咯烷），α-氮为仲胺，故属亚氨基酸而非氨基酸。环状结构使主链刚性增强，常见于转角处。'
    },
    {
      id: 'val',
      zh: '缬氨酸',
      en: 'valine',
      abbr3: 'Val',
      abbr1: 'V',
      category: 'aliphatic',
      solubility: '疏水',
      essential: '必需',
      pKa: { carboxyl: 2.3, amino: 9.6, sideChain: null },
      pI: 5.95,
      hydropathy: 1.10,
      formula: 'C5H11NO2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG1', el: 'C' },
          { id: 'CG2', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG1', order: 1 },
          { a: 'CB', b: 'CG2', order: 1 }
        ]
      },
      note: '侧链为异丙基，与 Leu、Ile 同属支链氨基酸。'
    },
    {
      id: 'phe',
      zh: '苯丙氨酸',
      en: 'phenylalanine',
      abbr3: 'Phe',
      abbr1: 'F',
      category: 'aromatic',
      solubility: '疏水',
      essential: '必需',
      pKa: { carboxyl: 1.8, amino: 9.1, sideChain: null },
      pI: 5.45,
      hydropathy: 1.20,
      formula: 'C9H11NO2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD1', el: 'C' },
          { id: 'CD2', el: 'C' },
          { id: 'CE1', el: 'C' },
          { id: 'CE2', el: 'C' },
          { id: 'CZ', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD1', order: 1 },
          { a: 'CD1', b: 'CE1', order: 2 },
          { a: 'CE1', b: 'CZ', order: 1 },
          { a: 'CZ', b: 'CE2', order: 2 },
          { a: 'CE2', b: 'CD2', order: 1 },
          { a: 'CD2', b: 'CG', order: 2 }
        ]
      },
      note: '侧链为苄基，含苯环，是疏水性最强的氨基酸之一，多见于蛋白质内核。'
    },
    {
      id: 'trp',
      zh: '色氨酸',
      en: 'tryptophan',
      abbr3: 'Trp',
      abbr1: 'W',
      category: 'aromatic',
      solubility: '疏水',
      essential: '必需',
      pKa: { carboxyl: 2.4, amino: 9.4, sideChain: null },
      pI: 5.90,
      hydropathy: 0.81,
      formula: 'C11H12N2O2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD1', el: 'C' },
          { id: 'CD2', el: 'C' },
          { id: 'NE1', el: 'N' },
          { id: 'CE2', el: 'C' },
          { id: 'CE3', el: 'C' },
          { id: 'CZ2', el: 'C' },
          { id: 'CZ3', el: 'C' },
          { id: 'CH2', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD1', order: 2 },
          { a: 'CD1', b: 'NE1', order: 1 },
          { a: 'NE1', b: 'CE2', order: 1 },
          { a: 'CE2', b: 'CD2', order: 1 },
          { a: 'CD2', b: 'CG', order: 1 },
          { a: 'CD2', b: 'CE3', order: 2 },
          { a: 'CE3', b: 'CZ3', order: 1 },
          { a: 'CZ3', b: 'CH2', order: 2 },
          { a: 'CH2', b: 'CZ2', order: 1 },
          { a: 'CZ2', b: 'CE2', order: 2 }
        ]
      },
      note: '侧链含吲哚环，体积最大，疏水。吲哚 N 上的氢可作为氢键供体。'
    },
    {
      id: 'tyr',
      zh: '酪氨酸',
      en: 'tyrosine',
      abbr3: 'Tyr',
      abbr1: 'Y',
      category: 'aromatic',
      solubility: '亲水',
      essential: '非必需',
      pKa: { carboxyl: 2.2, amino: 9.1, sideChain: 10.5 },
      pI: 5.65,
      hydropathy: 0.26,
      formula: 'C9H11NO3',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD1', el: 'C' },
          { id: 'CD2', el: 'C' },
          { id: 'CE1', el: 'C' },
          { id: 'CE2', el: 'C' },
          { id: 'CZ', el: 'C' },
          { id: 'OH', el: 'O' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD1', order: 1 },
          { a: 'CD1', b: 'CE1', order: 2 },
          { a: 'CE1', b: 'CZ', order: 1 },
          { a: 'CZ', b: 'CE2', order: 2 },
          { a: 'CE2', b: 'CD2', order: 1 },
          { a: 'CD2', b: 'CG', order: 2 },
          { a: 'CZ', b: 'OH', order: 1 }
        ]
      },
      note: '侧链含酚羟基（pKa 10.5），可电离。疏水苯环与亲水羟基并存，属两亲性，正处于亲水与疏水的边界上。'
    },
    {
      id: 'asn',
      zh: '天冬酰胺',
      en: 'asparagine',
      abbr3: 'Asn',
      abbr1: 'N',
      category: 'polar',
      solubility: '亲水',
      essential: '非必需',
      pKa: { carboxyl: 2.2, amino: 9.0, sideChain: null },
      pI: 5.60,
      hydropathy: -0.78,
      formula: 'C4H8N2O3',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'OD1', el: 'O' },
          { id: 'ND2', el: 'N' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'OD1', order: 2 },
          { a: 'CG', b: 'ND2', order: 1 }
        ]
      },
      note: '侧链为酰胺，极性强但不带电。是 N-连接糖基化的位点。'
    },
    {
      id: 'cys',
      zh: '半胱氨酸',
      en: 'cysteine',
      abbr3: 'Cys',
      abbr1: 'C',
      category: 'polar',
      solubility: '亲水',
      essential: '非必需',
      pKa: { carboxyl: 2.0, amino: 10.3, sideChain: 8.4 },
      pI: 5.20,
      hydropathy: 0.29,
      formula: 'C3H7NO2S',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'SG', el: 'S' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'SG', order: 1 }
        ]
      },
      note: '侧链含巯基（pKa 8.4）。两个巯基可氧化形成二硫键，稳定蛋白质三级结构。'
    },
    {
      id: 'gln',
      zh: '谷氨酰胺',
      en: 'glutamine',
      abbr3: 'Gln',
      abbr1: 'Q',
      category: 'polar',
      solubility: '亲水',
      essential: '非必需',
      pKa: { carboxyl: 2.2, amino: 9.1, sideChain: null },
      pI: 5.65,
      hydropathy: -0.85,
      formula: 'C5H10N2O3',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD', el: 'C' },
          { id: 'OE1', el: 'O' },
          { id: 'NE2', el: 'N' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD', order: 1 },
          { a: 'CD', b: 'OE1', order: 2 },
          { a: 'CD', b: 'NE2', order: 1 }
        ]
      },
      note: '侧链为酰胺，极性强但不带电，是血液中氨的主要运输形式。'
    },
    {
      id: 'ser',
      zh: '丝氨酸',
      en: 'serine',
      abbr3: 'Ser',
      abbr1: 'S',
      category: 'polar',
      solubility: '亲水',
      essential: '非必需',
      pKa: { carboxyl: 2.2, amino: 9.2, sideChain: 13.6 },
      pI: 5.70,
      hydropathy: -0.18,
      formula: 'C3H7NO3',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'OG', el: 'O' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'OG', order: 1 }
        ]
      },
      note: '侧链含羟基，是常见的磷酸化位点，也常参与酶活性中心的催化。'
    },
    {
      id: 'thr',
      zh: '苏氨酸',
      en: 'threonine',
      abbr3: 'Thr',
      abbr1: 'T',
      category: 'polar',
      solubility: '亲水',
      essential: '必需',
      pKa: { carboxyl: 2.1, amino: 9.6, sideChain: 13.6 },
      pI: 5.85,
      hydropathy: -0.05,
      formula: 'C4H9NO3',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'OG1', el: 'O' },
          { id: 'CG2', el: 'C' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'OG1', order: 1 },
          { a: 'CB', b: 'CG2', order: 1 }
        ]
      },
      note: '侧链含羟基，可被磷酸化。β 碳为第二个手性中心，是唯一含两个手性中心的蛋白质氨基酸。'
    },
    {
      id: 'arg',
      zh: '精氨酸',
      en: 'arginine',
      abbr3: 'Arg',
      abbr1: 'R',
      category: 'basic',
      solubility: '亲水',
      essential: '半必需',
      pKa: { carboxyl: 2.2, amino: 9.0, sideChain: 12.5 },
      pI: 10.75,
      hydropathy: -2.50,
      formula: 'C6H14N4O2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD', el: 'C' },
          { id: 'NE', el: 'N' },
          { id: 'CZ', el: 'C' },
          { id: 'NH1', el: 'N' },
          { id: 'NH2', el: 'N' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD', order: 1 },
          { a: 'CD', b: 'NE', order: 1 },
          { a: 'NE', b: 'CZ', order: 1 },
          { a: 'CZ', b: 'NH1', order: 2 },
          { a: 'CZ', b: 'NH2', order: 1 }
        ]
      },
      note: '侧链含胍基（pKa 12.5），生理条件下几乎完全质子化，是碱性最强的蛋白质氨基酸。人体可合成但量有限，故列为半必需。'
    },
    {
      id: 'his',
      zh: '组氨酸',
      en: 'histidine',
      abbr3: 'His',
      abbr1: 'H',
      category: 'basic',
      solubility: '亲水',
      essential: '必需',
      pKa: { carboxyl: 1.8, amino: 9.3, sideChain: 6.0 },
      pI: 7.65,
      hydropathy: 0.40,
      formula: 'C6H9N3O2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'ND1', el: 'N' },
          { id: 'CD2', el: 'C' },
          { id: 'CE1', el: 'C' },
          { id: 'NE2', el: 'N' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'ND1', b: 'CD2', order: 1 },
          { a: 'CD2', b: 'NE2', order: 2 },
          { a: 'NE2', b: 'CG', order: 1 },
          { a: 'CG', b: 'CE1', order: 2 },
          { a: 'CE1', b: 'ND1', order: 1 }
        ]
      },
      note: '侧链为咪唑环（pKa 6.0），生理 pH 下仅部分质子化。这一接近中性的 pKa 使其成为酶活性中心最常见的酸碱催化基团。'
    },
    {
      id: 'lys',
      zh: '赖氨酸',
      en: 'lysine',
      abbr3: 'Lys',
      abbr1: 'K',
      category: 'basic',
      solubility: '亲水',
      essential: '必需',
      pKa: { carboxyl: 2.2, amino: 9.0, sideChain: 10.5 },
      pI: 9.75,
      hydropathy: -1.50,
      formula: 'C6H14N2O2',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD', el: 'C' },
          { id: 'CE', el: 'C' },
          { id: 'NZ', el: 'N' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD', order: 1 },
          { a: 'CD', b: 'CE', order: 1 },
          { a: 'CE', b: 'NZ', order: 1 }
        ]
      },
      note: '侧链末端含 ε-氨基（pKa 10.5），生理条件下带正电。常被乙酰化、甲基化修饰以调节染色质结构。'
    },
    {
      id: 'asp',
      zh: '天冬氨酸',
      en: 'aspartic acid',
      abbr3: 'Asp',
      abbr1: 'D',
      category: 'acidic',
      solubility: '亲水',
      essential: '非必需',
      pKa: { carboxyl: 1.9, amino: 9.6, sideChain: 3.9 },
      pI: 2.90,
      hydropathy: -0.90,
      formula: 'C4H7NO4',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'OD1', el: 'O' },
          { id: 'OD2', el: 'O' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'OD1', order: 2 },
          { a: 'CG', b: 'OD2', order: 1 }
        ]
      },
      note: '侧链含羧基（pKa 3.9），生理条件下带负电，常见于酶活性中心与金属配位位点。'
    },
    {
      id: 'glu',
      zh: '谷氨酸',
      en: 'glutamic acid',
      abbr3: 'Glu',
      abbr1: 'E',
      category: 'acidic',
      solubility: '亲水',
      essential: '非必需',
      pKa: { carboxyl: 2.2, amino: 9.7, sideChain: 4.1 },
      pI: 3.15,
      hydropathy: -0.74,
      formula: 'C5H9NO4',
      frag: {
        atoms: [
          { id: 'CB', el: 'C' },
          { id: 'CG', el: 'C' },
          { id: 'CD', el: 'C' },
          { id: 'OE1', el: 'O' },
          { id: 'OE2', el: 'O' }
        ],
        bonds: [
          { a: 'CA', b: 'CB', order: 1 },
          { a: 'CB', b: 'CG', order: 1 },
          { a: 'CG', b: 'CD', order: 1 },
          { a: 'CD', b: 'OE1', order: 2 },
          { a: 'CD', b: 'OE2', order: 1 }
        ]
      },
      note: '侧链含羧基（pKa 4.1），比 Asp 多一个亚甲基。是中枢神经系统主要的兴奋性神经递质。'
    }
  ];

  global.APP = global.APP || {};
  global.APP.DATA = {
    meta: META,
    categories: CATEGORIES,
    scaffold: SCAFFOLD,
    aminoAcids: AMINO_ACIDS
  };

})(window);
