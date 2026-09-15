// 静态数据：机型、货舱隔位、油箱、危险品隔离表、演示集装器
import type { Aircraft, Compartment, DGClass, Plan, Position, Uld, UldType } from './types';

/** 机型：B747-400F（教学简化数据） */
export const AIRCRAFT: Aircraft = {
  type: 'B747-400F',
  oew: 160000,
  oewArm: 26.1, // → 25.0%MAC
  mac: 8.4,
  lemac: 24.0,
  mtow: 396890,
  mlw: 295742,
  mzfw: 276691,
  tanks: [
    { id: 'CTR',  name: '中央油箱',       cap: 90000, arm: 26.6 },
    { id: 'INL',  name: '左内主油箱',     cap: 28000, arm: 25.8 },
    { id: 'INR',  name: '右内主油箱',     cap: 28000, arm: 25.8 },
    { id: 'OUTL', name: '左外主油箱',     cap: 14000, arm: 26.4 },
    { id: 'OUTR', name: '右外主油箱',     cap: 14000, arm: 26.4 },
    { id: 'STAB', name: '水平安定面油箱', cap: 10000, arm: 46.5 },
  ],
  // 747 简化耗油顺序：先用中央，再内主，再外主，最后安定面
  burnOrder: ['CTR', 'INL', 'INR', 'OUTL', 'OUTR', 'STAB'],
};

/** 货舱 */
export const COMPARTMENTS: Compartment[] = [
  { id: 'MD',   name: '主货舱',   maxW: 60000, deck: 'main' },
  { id: 'FWD',  name: '前下货舱', maxW: 5000,  deck: 'lower' },
  { id: 'AFT',  name: '后下货舱', maxW: 7000,  deck: 'lower' },
  { id: 'BULK', name: '散货舱',   maxW: 2000,  deck: 'lower' },
];

const MAIN_DIMS = { l: 318, w: 244, h: 300 }; // 96×125 集装板位
const LD3_DIMS = { l: 156, w: 153, h: 163 };

/** 舱位（隔位）：力臂自机头基准点，单位 m */
export const POSITIONS: Position[] = [
  // 主货舱 M1..M8（前→后）
  ...[13.5, 16.5, 19.5, 22.5, 25.5, 28.5, 31.5, 34.5].map((arm, i) => ({
    id: `M${i + 1}`,
    comp: 'MD',
    arm,
    maxW: 11000,
    dims: MAIN_DIMS,
    powered: i >= 2 && i <= 5, // M3..M6 有温控电源
    types: ['PMC'],
    dgAllowed: true,
  })),
  // 前下货舱 F1..F4
  ...[14.0, 15.5, 17.0, 18.5].map((arm, i) => ({
    id: `F${i + 1}`,
    comp: 'FWD',
    arm,
    maxW: 1600,
    dims: LD3_DIMS,
    powered: i === 1, // F2 有温控电源
    types: ['AKE', 'RKN'],
    dgAllowed: true,
  })),
  // 后下货舱 A1..A4
  ...[33.5, 35.0, 36.5, 38.0].map((arm, i) => ({
    id: `A${i + 1}`,
    comp: 'AFT',
    arm,
    maxW: 1600,
    dims: LD3_DIMS,
    powered: i === 2, // A3 有温控电源
    types: ['AKE', 'RKN'],
    dgAllowed: true,
  })),
  // 散货舱
  { id: 'B1', comp: 'BULK', arm: 40.5, maxW: 2000, dims: { l: 300, w: 200, h: 160 }, powered: false, types: ['BULK'], dgAllowed: false },
];

/** 集装器类型 */
export const ULD_TYPES: Record<string, UldType> = {
  PMC:  { id: 'PMC',  name: 'PMC 集装板',      dims: MAIN_DIMS, tare: 120, reefer: false },
  AKE:  { id: 'AKE',  name: 'AKE 集装箱(LD3)', dims: LD3_DIMS,  tare: 80,  reefer: false },
  RKN:  { id: 'RKN',  name: 'RKN 冷藏箱(LD3)', dims: LD3_DIMS,  tare: 210, reefer: true  },
  BULK: { id: 'BULK', name: '散货',            dims: { l: 300, w: 200, h: 160 }, tare: 0, reefer: false },
};

/** 危险品类别名称 */
export const DG_NAMES: Record<DGClass, string> = {
  '1': '爆炸品',
  '2.1': '易燃气体',
  '3': '易燃液体',
  '4.2': '自燃物质',
  '4.3': '遇水释放易燃气体',
  '5.1': '氧化剂',
  '6.1': '毒性物质',
  '7': '放射性物质',
  '8': '腐蚀性物质',
  '9': '杂项(锂电池)',
};

export const DG_CLASSES = Object.keys(DG_NAMES) as DGClass[];

/**
 * 危险品隔离表（简化自 IATA DGR 9.3.A，仅演示用）：
 * 表中为 true 的两类危险品不得装于同一货舱。
 */
const SEG_PAIRS: Array<[DGClass, DGClass]> = [
  // 1 类爆炸品与所有类别隔离（含同类）
  ...DG_CLASSES.map((c): [DGClass, DGClass] => ['1', c]),
  ['2.1', '5.1'],
  ['3', '5.1'],
  ['4.2', '5.1'],
  ['4.3', '5.1'],
  ['4.3', '8'],
];

const SEG_SET = new Set(SEG_PAIRS.map(([a, b]) => `${a}|${b}`));

export function isSegregated(a: DGClass, b: DGClass): boolean {
  return SEG_SET.has(`${a}|${b}`) || SEG_SET.has(`${b}|${a}`);
}

/** 航路站点 */
export const STATIONS = ['PEK', 'PVG', 'HKG', 'SIN'];

/** 重心包线（重量 kg → %MAC），分段线性 */
export const ENVELOPE = {
  fwd: [
    { w: 160000, cg: 15 },
    { w: 280000, cg: 17 },
    { w: 396890, cg: 21 },
  ],
  aft: [
    { w: 160000, cg: 33 },
    { w: 300000, cg: 33.5 },
    { w: 396890, cg: 32 },
  ],
};

/** 演示集装器库 */
export function demoUlds(): Uld[] {
  return [
    { id: 'ULD-101', type: 'PMC', weight: 8000,  reefer: false, dg: null,  from: 0, to: 3 },
    { id: 'ULD-102', type: 'PMC', weight: 9500,  reefer: false, dg: '3',   from: 0, to: 3 },
    { id: 'ULD-103', type: 'PMC', weight: 7200,  reefer: false, dg: null,  from: 0, to: 3 },
    { id: 'ULD-104', type: 'PMC', weight: 6800,  reefer: false, dg: null,  from: 0, to: 2 },
    { id: 'ULD-105', type: 'AKE', weight: 1200,  reefer: false, dg: '5.1', from: 0, to: 3 },
    { id: 'ULD-106', type: 'RKN', weight: 980,   reefer: true,  dg: null,  from: 0, to: 3 },
    { id: 'ULD-107', type: 'AKE', weight: 1450,  reefer: false, dg: null,  from: 1, to: 3 },
    { id: 'ULD-108', type: 'PMC', weight: 12500, reefer: false, dg: null,  from: 0, to: 3 }, // 超单舱位限重
    { id: 'ULD-109', type: 'AKE', weight: 1750,  reefer: false, dg: null,  from: 0, to: 3 }, // 超 LD3 位限重
    { id: 'ULD-110', type: 'PMC', weight: 5000,  reefer: false, dg: '1',   from: 0, to: 3 }, // 爆炸品
    { id: 'ULD-111', type: 'BULK', weight: 600,  reefer: false, dg: null,  from: 0, to: 3 },
    { id: 'ULD-112', type: 'AKE', weight: 900,   reefer: false, dg: '8',   from: 0, to: 3 },
  ];
}

/** 初始（空）方案：默认燃油与三航段 */
export function emptyPlan(): Plan {
  return {
    ulds: demoUlds(),
    placements: {},
    fuel: { CTR: 55000, INL: 24000, INR: 24000, OUTL: 10000, OUTR: 10000, STAB: 4000 },
    segments: [
      { from: 'PEK', to: 'PVG', burn: 38000 },
      { from: 'PVG', to: 'HKG', burn: 34000 },
      { from: 'HKG', to: 'SIN', burn: 30000 },
    ],
  };
}

/** 演示装载方案（全部约束通过的均衡配载） */
export const DEMO_PLACEMENTS: Record<string, string> = {
  'ULD-101': 'M3',
  'ULD-102': 'M5',
  'ULD-103': 'M4',
  'ULD-104': 'M6',
  'ULD-105': 'A2',
  'ULD-106': 'F2',
  'ULD-107': 'A3',
  'ULD-111': 'B1',
  'ULD-112': 'F1',
};
