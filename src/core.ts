// 计算核心：放置校验、燃油消耗、逐航段重量与重心、包线判定、配平建议
import { AIRCRAFT, COMPARTMENTS, DG_NAMES, ENVELOPE, POSITIONS, ULD_TYPES, isSegregated } from './data';
import type { Aircraft, Compartment, Plan, PlanResult, Position, SegmentResult, Uld } from './types';

export const fmt = (n: number) => n.toLocaleString('zh-CN');
export const fmtCg = (cg: number) => `${cg.toFixed(1)}%MAC`;

/** 力臂(m) → 重心(%MAC) */
export function armToCg(arm: number, ac: Aircraft = AIRCRAFT): number {
  return ((arm - ac.lemac) / ac.mac) * 100;
}

/** 重心(%MAC) → 力臂(m) */
export function cgToArm(cg: number, ac: Aircraft = AIRCRAFT): number {
  return ac.lemac + (cg / 100) * ac.mac;
}

// ---------------------------------------------------------------- 包线

function limitAt(points: Array<{ w: number; cg: number }>, w: number): number {
  if (w <= points[0].w) return points[0].cg;
  for (let i = 1; i < points.length; i++) {
    if (w <= points[i].w) {
      const a = points[i - 1];
      const b = points[i];
      return a.cg + ((w - a.w) / (b.w - a.w)) * (b.cg - a.cg);
    }
  }
  return points[points.length - 1].cg;
}

export const fwdLimit = (w: number) => limitAt(ENVELOPE.fwd, w);
export const aftLimit = (w: number) => limitAt(ENVELOPE.aft, w);

export type CgStatus = 'ok' | 'fwd' | 'aft';
export function cgStatus(w: number, cg: number): CgStatus {
  if (cg < fwdLimit(w)) return 'fwd';
  if (cg > aftLimit(w)) return 'aft';
  return 'ok';
}

// ---------------------------------------------------------------- 燃油

export function totalFuel(fuel: Record<string, number>): number {
  return Object.values(fuel).reduce((s, v) => s + v, 0);
}

export function fuelMoment(fuel: Record<string, number>, ac: Aircraft = AIRCRAFT): number {
  return ac.tanks.reduce((s, t) => s + (fuel[t.id] ?? 0) * t.arm, 0);
}

/**
 * 按耗油顺序消耗燃油，返回 { fuel: 新油量, burned, burnedMoment }。
 * 若燃油不足，burned < amount，由调用方判定“燃油不足”。
 */
export function burnFuel(
  fuel: Record<string, number>,
  amount: number,
  ac: Aircraft = AIRCRAFT,
): { fuel: Record<string, number>; burned: number; burnedMoment: number } {
  const next = { ...fuel };
  let remaining = amount;
  let burnedMoment = 0;
  for (const id of ac.burnOrder) {
    const tank = ac.tanks.find((t) => t.id === id)!;
    const take = Math.min(next[id] ?? 0, remaining);
    next[id] = (next[id] ?? 0) - take;
    burnedMoment += take * tank.arm;
    remaining -= take;
    if (remaining <= 0) break;
  }
  return { fuel: next, burned: amount - remaining, burnedMoment };
}

// ---------------------------------------------------------------- 放置校验

export interface PlacementCheck {
  ok: boolean;
  errors: string[];
}

/**
 * 校验 ULD 能否落于指定舱位。
 * 所有错误均指出具体舱位号；任一约束不满足即不能落位。
 */
export function checkPlacement(
  plan: Plan,
  uldId: string,
  posId: string,
  positions: Position[] = POSITIONS,
  comps: Compartment[] = COMPARTMENTS,
): PlacementCheck {
  const errors: string[] = [];
  const uld = plan.ulds.find((u) => u.id === uldId);
  const pos = positions.find((p) => p.id === posId);
  if (!uld) return { ok: false, errors: [`未找到集装器 ${uldId}`] };
  if (!pos) return { ok: false, errors: [`未找到舱位 ${posId}`] };
  const comp = comps.find((c) => c.id === pos.comp)!;
  const type = ULD_TYPES[uld.type];

  // 1. 舱位占用 / ULD 已装
  const occupant = Object.entries(plan.placements).find(([, p]) => p === posId);
  if (occupant) errors.push(`舱位 ${posId} 已被 ${occupant[0]} 占用`);
  if (plan.placements[uldId]) errors.push(`${uldId} 已落于舱位 ${plan.placements[uldId]}，需先卸下`);

  // 2. 集装器类型
  if (!pos.types.includes(uld.type))
    errors.push(`舱位 ${posId} 不接受 ${uld.type} 型集装器（该位允许：${pos.types.join(' / ')}）`);

  // 3. 单舱位限重
  if (uld.weight > pos.maxW)
    errors.push(`舱位 ${posId} 超限：${uld.id} 总重 ${fmt(uld.weight)} kg 超过该舱位限重 ${fmt(pos.maxW)} kg`);

  // 4. 尺寸
  if (type && (type.dims.l > pos.dims.l || type.dims.w > pos.dims.w || type.dims.h > pos.dims.h))
    errors.push(
      `舱位 ${posId} 尺寸不足：${uld.type} 外型 ${type.dims.l}×${type.dims.w}×${type.dims.h} cm 超过该位 ${pos.dims.l}×${pos.dims.w}×${pos.dims.h} cm`,
    );

  // 5. 温控电源
  if (uld.reefer && !pos.powered)
    errors.push(`舱位 ${posId} 无温控电源插座，冷藏集装器 ${uld.id} 不能落位（可选：${positions.filter((p) => p.powered && p.types.includes(uld.type)).map((p) => p.id).join('、') || '无'}）`);

  // 6. 危险品：舱位许可与同舱隔离
  if (uld.dg) {
    if (!pos.dgAllowed)
      errors.push(`${comp.name} ${posId} 不允许装载危险品（${uld.dg} 类 ${DG_NAMES[uld.dg]}）`);
    for (const [otherId, otherPosId] of Object.entries(plan.placements)) {
      const otherPos = positions.find((p) => p.id === otherPosId)!;
      if (otherPos.comp !== pos.comp) continue;
      const other = plan.ulds.find((u) => u.id === otherId)!;
      if (!other.dg) continue;
      if (isSegregated(uld.dg, other.dg))
        errors.push(
          `${comp.name}危险品隔离冲突：舱位 ${otherPosId} 已装 ${other.dg} 类(${DG_NAMES[other.dg]})，与 ${uld.dg} 类(${DG_NAMES[uld.dg]}) 不得同舱，${uld.id} 不能落位 ${posId}`,
        );
    }
  }

  // 7. 舱段累计限重
  const compWeight = Object.entries(plan.placements)
    .filter(([, pid]) => positions.find((p) => p.id === pid)!.comp === pos.comp)
    .reduce((s, [uid]) => s + plan.ulds.find((u) => u.id === uid)!.weight, 0);
  if (compWeight + uld.weight > comp.maxW)
    errors.push(
      `${comp.name}超容：已装 ${fmt(compWeight)} kg + ${uld.id} ${fmt(uld.weight)} kg = ${fmt(compWeight + uld.weight)} kg，超过舱段限重 ${fmt(comp.maxW)} kg（拟落位 ${posId}）`,
    );

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------- 航段重量与重心

function placedUlds(plan: Plan): Array<{ uld: Uld; pos: Position }> {
  return Object.entries(plan.placements).map(([uid, pid]) => ({
    uld: plan.ulds.find((u) => u.id === uid)!,
    pos: POSITIONS.find((p) => p.id === pid)!,
  }));
}

/** 业载（某航段上在机的集装器）重量与力矩 */
function payloadForSegment(plan: Plan, segIndex: number): { w: number; moment: number } {
  let w = 0;
  let moment = 0;
  for (const { uld, pos } of placedUlds(plan)) {
    if (uld.from <= segIndex && segIndex < uld.to) {
      w += uld.weight;
      moment += uld.weight * pos.arm;
    }
  }
  return { w, moment };
}

/** 逐航段计算累计重量与重心（含燃油消耗带来的变化），并做包线与结构限重判定 */
export function computePlan(plan: Plan, ac: Aircraft = AIRCRAFT): PlanResult {
  const segments: SegmentResult[] = [];
  const issues: string[] = [];
  let fuel = { ...plan.fuel };

  plan.segments.forEach((seg, i) => {
    const label = `${seg.from}→${seg.to}`;
    const segIssues: string[] = [];
    const { w: payloadW, moment: payloadMoment } = payloadForSegment(plan, i);

    // 无油重量 ZFW
    const zfw = ac.oew + payloadW;
    const zfwMoment = ac.oew * ac.oewArm + payloadMoment;
    const zfwCg = armToCg(zfwMoment / zfw, ac);
    if (zfw > ac.mzfw) segIssues.push(`无油重量 ${fmt(zfw)} kg 超过 MZFW ${fmt(ac.mzfw)} kg`);
    checkCg(segIssues, '无油', zfw, zfwCg);

    // 起飞重量 TOW
    const fuelDep = totalFuel(fuel);
    const tow = zfw + fuelDep;
    const towMoment = zfwMoment + fuelMoment(fuel, ac);
    const towCg = armToCg(towMoment / tow, ac);
    if (tow > ac.mtow) segIssues.push(`起飞重量 ${fmt(tow)} kg 超过 MTOW ${fmt(ac.mtow)} kg`);
    checkCg(segIssues, '起飞', tow, towCg);

    // 耗油 → 落地重量 LDW
    const burned = burnFuel(fuel, seg.burn, ac);
    if (burned.burned < seg.burn)
      segIssues.push(`燃油不足：本段需 ${fmt(seg.burn)} kg，机载仅剩 ${fmt(burned.burned)} kg`);
    fuel = burned.fuel;
    const fuelArr = totalFuel(fuel);
    const ldw = zfw + fuelArr;
    const ldwMoment = zfwMoment + fuelMoment(fuel, ac);
    const ldwCg = armToCg(ldwMoment / ldw, ac);
    if (ldw > ac.mlw) segIssues.push(`落地重量 ${fmt(ldw)} kg 超过 MLW ${fmt(ac.mlw)} kg`);
    checkCg(segIssues, '落地', ldw, ldwCg);

    segments.push({
      index: i,
      from: seg.from,
      to: seg.to,
      payloadW,
      zfw, zfwCg,
      fuelDep, tow, towCg,
      burn: seg.burn,
      fuelArr, ldw, ldwCg,
      issues: segIssues,
    });
    issues.push(...segIssues.map((s) => `航段 ${label}：${s}`));
  });

  return { segments, issues };
}

function checkCg(issues: string[], phase: string, w: number, cg: number): void {
  const st = cgStatus(w, cg);
  if (st === 'fwd') issues.push(`${phase}重心 ${fmtCg(cg)} 前于包线前限 ${fmtCg(fwdLimit(w))}`);
  if (st === 'aft') issues.push(`${phase}重心 ${fmtCg(cg)} 后于包线后限 ${fmtCg(aftLimit(w))}`);
}

// ---------------------------------------------------------------- 配平建议

/** 针对指定航段给出前后配平建议（基于起飞重心） */
export function trimSuggestion(plan: Plan, segIndex: number, ac: Aircraft = AIRCRAFT): string | null {
  const res = computePlan(plan, ac).segments[segIndex];
  if (!res) return null;
  const st = cgStatus(res.tow, res.towCg);
  if (st === 'ok') return null;

  const placed = placedUlds(plan).filter(({ uld }) => uld.from <= segIndex && segIndex < uld.to);
  if (placed.length === 0) return '机上无业载可移动，请调整燃油或减载';

  const targetCg = st === 'aft' ? aftLimit(res.tow) : fwdLimit(res.tow);
  const deltaMoment = (cgToArm(res.towCg, ac) - cgToArm(targetCg, ac)) * res.tow; // 需向机头方向移动的力矩
  const dir = st === 'aft' ? '前' : '后';

  // 找最靠后/前的已装舱位与最前/后的空舱位
  const occupied = new Set(Object.values(plan.placements));
  const sorted = [...placed].sort((a, b) => (st === 'aft' ? b.pos.arm - a.pos.arm : a.pos.arm - b.pos.arm));
  const cand = sorted[0];
  const targets = POSITIONS.filter(
    (p) => !occupied.has(p.id) && p.types.includes(cand.uld.type) && p.maxW >= cand.uld.weight
      && (st === 'aft' ? p.arm < cand.pos.arm : p.arm > cand.pos.arm),
  ).sort((a, b) => (st === 'aft' ? a.arm - b.arm : b.arm - a.arm));
  const tgt = targets[0];

  const parts = [`航段 ${plan.segments[segIndex].from}→${plan.segments[segIndex].to} 起飞重心偏${dir === '前' ? '后' : '前'}，需向${dir}移动力矩约 ${fmt(Math.round(Math.abs(deltaMoment)))} kg·m`];
  if (tgt) {
    const gain = Math.abs(cand.pos.arm - tgt.arm) * cand.uld.weight;
    parts.push(`建议：将 ${cand.uld.id}（${fmt(cand.uld.weight)} kg）由 ${cand.pos.id}（臂 ${cand.pos.arm} m）移至 ${tgt.id}（臂 ${tgt.arm} m），可移动力矩 ${fmt(Math.round(gain))} kg·m`);
    if (gain < Math.abs(deltaMoment)) parts.push('单件移动不足，需继续移动其他集装器或配合燃油配平');
  } else {
    parts.push('无可用空舱位直接移动，可考虑换装、减载或安定面油箱配平');
  }
  return parts.join('；');
}
