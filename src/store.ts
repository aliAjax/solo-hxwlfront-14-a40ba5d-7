// 状态管理：草案 →（全量校验）→ 正式方案 →（只能演练区调整，确认后并入）
import { create } from 'zustand';
import { AIRCRAFT, COMPARTMENTS, DEMO_PLACEMENTS, POSITIONS, emptyPlan } from './data';
import { checkPlacement, computePlan, totalFuel, validatePlanFull } from './core';
import type { Plan, PlanResult, Uld } from './types';

export interface StagingState {
  active: boolean;
  working: Plan;
  ops: string[];
  validation: { ok: boolean; issues: string[] } | null;
}

export interface ErrorBox {
  title: string;
  items: string[];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const EMPTY_STAGING: StagingState = { active: false, working: emptyPlan(), ops: [], validation: null };

interface AppState {
  plan: Plan;                  // 当前方案：未锁定=草案，已锁定=正式方案
  locked: boolean;
  staging: StagingState;
  selectedUld: string | null;
  selectedPos: string | null;
  lastErrors: ErrorBox | null;
  officialResult: PlanResult;        // 当前方案逐航段结果（派生）
  stagingResult: PlanResult | null;  // 演练工作副本逐航段结果（派生）

  selectUld: (id: string | null) => void;
  selectPos: (id: string | null) => void;
  place: () => void;
  removeAt: (posId: string) => void;
  setFuel: (tank: string, kg: number) => void;
  transferFuel: (from: string, to: string, kg: number) => void;
  setBurn: (segIndex: number, kg: number) => void;
  setUldRoute: (uldId: string, from: number, to: number) => void;
  addUld: (u: Uld) => void;
  loadDemo: () => void;
  resetAll: () => void;
  lock: () => void;
  unlock: () => void;
  enterStaging: () => void;
  discardStaging: () => void;
  validateStaging: () => void;
  confirmStaging: () => void;
}

/** 当前可编辑的方案：演练中→工作副本，否则→当前方案（草案/正式） */
function target(s: Pick<AppState, 'plan' | 'staging'>): Plan {
  return s.staging.active ? s.staging.working : s.plan;
}

/** 是否允许直接编辑：正式方案锁定后，一切改动只能经演练区 */
function editable(s: Pick<AppState, 'locked' | 'staging'>): boolean {
  return !s.locked || s.staging.active;
}

function derive(plan: Plan, staging: StagingState) {
  return {
    officialResult: computePlan(plan),
    stagingResult: staging.active ? computePlan(staging.working) : null,
  };
}

export const useStore = create<AppState>((set, get) => {
  /** 统一提交：更新派生结果 */
  const commit = (partial: Partial<AppState>) => {
    const next = { ...get(), ...partial };
    set({ ...partial, ...derive(next.plan, next.staging) });
  };

  const fail = (title: string, items: string[]) => set({ lastErrors: { title, items } });
  const clearErrors = () => set({ lastErrors: null });
  const lockedError = () => fail('操作被拒绝', ['正式方案已锁定：临时加货 / 转油 / 航段调整请先进入演练区']);

  /** 对当前目标方案做一次修改；演练中自动记录操作并使上次校验失效 */
  const mutate = (opLabel: string, fn: (p: Plan) => void): boolean => {
    const s = get();
    if (!editable(s)) {
      lockedError();
      return false;
    }
    if (s.staging.active) {
      const working = clone(s.staging.working);
      fn(working);
      commit({ staging: { ...s.staging, working, ops: [...s.staging.ops, opLabel], validation: null } });
    } else {
      const plan = clone(s.plan);
      fn(plan);
      commit({ plan });
    }
    return true;
  };

  return {
    plan: emptyPlan(),
    locked: false,
    staging: EMPTY_STAGING,
    selectedUld: null,
    selectedPos: null,
    lastErrors: null,
    ...derive(emptyPlan(), EMPTY_STAGING),

    selectUld: (id) => set({ selectedUld: id }),
    selectPos: (id) => set({ selectedPos: id }),

    place: () => {
      const s = get();
      if (!s.selectedUld || !s.selectedPos) {
        fail('操作被拒绝', ['请先在右侧选择集装器，再在舱位图中选择舱位']);
        return;
      }
      if (!editable(s)) {
        lockedError();
        return;
      }
      const cur = target(s);
      const check = checkPlacement(cur, s.selectedUld, s.selectedPos, POSITIONS, COMPARTMENTS);
      if (!check.ok) {
        fail('不能落位', check.errors);
        return;
      }
      const ok = mutate(`装机 ${s.selectedUld} → ${s.selectedPos}`, (p) => {
        p.placements[s.selectedUld!] = s.selectedPos!;
      });
      if (ok) {
        clearErrors();
        set({ selectedUld: null, selectedPos: null });
      }
    },

    removeAt: (posId) => {
      const s = get();
      const cur = target(s);
      const entry = Object.entries(cur.placements).find(([, p]) => p === posId);
      if (!entry) return;
      const ok = mutate(`卸下 ${entry[0]}（${posId}）`, (p) => {
        delete p.placements[entry[0]];
      });
      if (ok) clearErrors();
    },

    setFuel: (tank, kg) => {
      const t = AIRCRAFT.tanks.find((x) => x.id === tank)!;
      const v = Math.max(0, Math.min(t.cap, Math.round(kg)));
      mutate(`加油 ${t.name} → ${v.toLocaleString('zh-CN')} kg`, (p) => {
        p.fuel[tank] = v;
      });
    },

    transferFuel: (from, to, kg) => {
      const s = get();
      const cur = target(s);
      const fromTank = AIRCRAFT.tanks.find((t) => t.id === from)!;
      const toTank = AIRCRAFT.tanks.find((t) => t.id === to)!;
      const avail = cur.fuel[from] ?? 0;
      const room = toTank.cap - (cur.fuel[to] ?? 0);
      const v = Math.min(kg, avail, room);
      if (v <= 0) {
        fail('转油不可行', [`${fromTank.name} 可用 ${avail.toLocaleString('zh-CN')} kg，${toTank.name} 剩余容量 ${room.toLocaleString('zh-CN')} kg`]);
        return;
      }
      const ok = mutate(`燃油配平 ${fromTank.name} → ${toTank.name} ${v.toLocaleString('zh-CN')} kg`, (p) => {
        p.fuel[from] -= v;
        p.fuel[to] += v;
      });
      if (ok) clearErrors();
    },

    setBurn: (i, kg) => {
      mutate(`航段 ${i + 1} 耗油调整为 ${kg.toLocaleString('zh-CN')} kg`, (p) => {
        p.segments[i].burn = Math.max(0, Math.round(kg));
      });
    },

    setUldRoute: (uldId, from, to) => {
      mutate(`调整 ${uldId} 装/卸站`, (p) => {
        const u = p.ulds.find((x) => x.id === uldId);
        if (u && from < to) {
          u.from = from;
          u.to = to;
        }
      });
    },

    addUld: (u) => {
      const s = get();
      if (target(s).ulds.some((x) => x.id === u.id)) {
        fail('新增集装器失败', [`集装器号 ${u.id} 已存在`]);
        return;
      }
      const ok = mutate(`新增集装器 ${u.id}`, (p) => {
        p.ulds.push(u);
      });
      if (ok) clearErrors();
    },

    loadDemo: () => {
      const ok = mutate('载入演示方案', (p) => {
        p.placements = { ...DEMO_PLACEMENTS };
      });
      if (ok) {
        clearErrors();
        set({ selectedUld: null, selectedPos: null });
      }
    },

    resetAll: () => {
      const plan = emptyPlan();
      commit({ plan, locked: false, staging: { ...EMPTY_STAGING, working: clone(plan) }, selectedUld: null, selectedPos: null, lastErrors: null });
    },

    /** 锁定为正式方案：先全量校验（放置/隔离/重量重心/燃油），任一项不通过即拒绝 */
    lock: () => {
      const s = get();
      if (s.locked) return;
      const issues = validatePlanFull(s.plan);
      if (issues.length > 0) {
        fail(`草案校验未通过（${issues.length} 项），不能形成正式方案`, issues);
        return;
      }
      set({ locked: true, lastErrors: null });
    },

    unlock: () => set({ locked: false }),

    enterStaging: () => {
      const s = get();
      if (s.staging.active) return;
      commit({ staging: { active: true, working: clone(s.plan), ops: [], validation: null }, lastErrors: null });
    },

    discardStaging: () => commit({ staging: { ...EMPTY_STAGING, working: clone(get().plan) }, lastErrors: null }),

    validateStaging: () => {
      const s = get();
      if (!s.staging.active) return;
      const issues = validatePlanFull(s.staging.working);
      commit({ staging: { ...s.staging, validation: { ok: issues.length === 0, issues } } });
    },

    confirmStaging: () => {
      const s = get();
      if (!s.staging.active || !s.staging.validation?.ok) return;
      commit({ plan: clone(s.staging.working), staging: { ...EMPTY_STAGING, working: emptyPlan() }, lastErrors: null });
    },
  };
});

// 供浏览器自动化验证使用
if (typeof window !== 'undefined') {
  (window as unknown as { __app: unknown }).__app = {
    store: useStore,
    core: { computePlan, checkPlacement, totalFuel, validatePlanFull },
    data: { AIRCRAFT, POSITIONS, COMPARTMENTS },
  };
}
