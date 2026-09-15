// 领域类型定义 —— 货运航空配载与重心校核

/** 危险品类别（简化 IATA 分类） */
export type DGClass = '1' | '2.1' | '3' | '4.2' | '4.3' | '5.1' | '6.1' | '7' | '8' | '9';

export interface Dims {
  l: number; // cm
  w: number;
  h: number;
}

/** 燃油箱 */
export interface Tank {
  id: string;
  name: string;
  cap: number; // kg
  arm: number; // 力臂 m（距基准点）
}

/** 机型参数 */
export interface Aircraft {
  type: string;
  oew: number;    // 使用空重 kg
  oewArm: number; // 空机力臂 m
  mac: number;    // 平均气动弦长 m
  lemac: number;  // 平均气动弦前缘位置 m
  mtow: number;   // 最大起飞重量 kg
  mlw: number;    // 最大落地重量 kg
  mzfw: number;   // 最大无油重量 kg
  tanks: Tank[];
  burnOrder: string[]; // 耗油顺序（油箱 id）
}

/** 货舱（隔舱） */
export interface Compartment {
  id: string;
  name: string;
  maxW: number; // 舱段累计限重 kg
  deck: 'main' | 'lower';
}

/** 舱位（隔位） */
export interface Position {
  id: string;
  comp: string;      // 所属货舱 id
  arm: number;       // 力臂 m
  maxW: number;      // 该舱位限重 kg
  dims: Dims;        // 可容纳最大尺寸
  powered: boolean;  // 是否有温控电源
  types: string[];   // 可接受的集装器类型
  dgAllowed: boolean;// 是否允许危险品
}

/** 集装器类型 */
export interface UldType {
  id: string;
  name: string;
  dims: Dims;
  tare: number; // 自重 kg
  reefer: boolean;
}

/** 集装器（ULD） */
export interface Uld {
  id: string;
  type: string;        // UldType id
  weight: number;      // 总重 kg（含自重）
  reefer: boolean;     // 需要温控
  dg: DGClass | null;  // 危险品类别
  from: number;        // 装机站 index
  to: number;          // 卸机站 index（不含）
}

/** 航段 */
export interface Segment {
  from: string;
  to: string;
  burn: number; // 航程耗油 kg
}

/** 装载方案（正式方案或演练工作副本） */
export interface Plan {
  ulds: Uld[];
  placements: Record<string, string>; // uldId -> positionId
  fuel: Record<string, number>;       // tankId -> kg
  segments: Segment[];
}

/** 单航段计算结果 */
export interface SegmentResult {
  index: number;
  from: string;
  to: string;
  payloadW: number;   // 本段业载 kg
  zfw: number;
  zfwCg: number;      // %MAC
  fuelDep: number;    // 起飞油量
  tow: number;
  towCg: number;
  burn: number;
  fuelArr: number;    // 落地剩油
  ldw: number;
  ldwCg: number;
  issues: string[];
}

export interface PlanResult {
  segments: SegmentResult[];
  issues: string[]; // 全方案级问题（含各航段，带航段前缀）
}
