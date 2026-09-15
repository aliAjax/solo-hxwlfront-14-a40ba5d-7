// 货舱布局图：主货舱 / 前下货舱 / 后下货舱 / 散货舱
import { useMemo } from 'react';
import { Tag, Tooltip } from 'antd';
import { COMPARTMENTS, DG_NAMES, POSITIONS } from '../data';
import { useStore } from '../store';
import type { Plan, Position, Uld } from '../types';

function Slot({ pos, uld }: { pos: Position; uld?: Uld }) {
  const { selectedPos, selectPos, selectUld } = useStore();
  const selected = selectedPos === pos.id;

  return (
    <Tooltip
      title={
        <>
          <div>舱位 {pos.id}（{COMPARTMENTS.find((c) => c.id === pos.comp)!.name}）</div>
          <div>力臂 {pos.arm} m ｜ 限重 {pos.maxW.toLocaleString('zh-CN')} kg</div>
          <div>
            {pos.powered ? '有温控电源' : '无温控电源'} ｜ {pos.dgAllowed ? '允许危险品' : '禁止危险品'}
          </div>
        </>
      }
    >
      <div
        data-testid={`pos-${pos.id}`}
        className={`slot ${uld ? 'slot-filled' : ''} ${selected ? 'slot-selected' : ''}`}
        onClick={() => {
          selectPos(pos.id);
          if (uld) selectUld(uld.id);
        }}
      >
        <div className="slot-head">
          <b>{pos.id}</b>
          {pos.powered && <span className="slot-power">⚡</span>}
        </div>
        {uld ? (
          <div className="slot-body">
            <div className="slot-uld">{uld.id}</div>
            <div className="slot-w">{uld.weight.toLocaleString('zh-CN')} kg</div>
            <div className="slot-tags">
              {uld.reefer && <Tag color="blue">❄温控</Tag>}
              {uld.dg && (
                <Tag color="orange">
                  {uld.dg}类 {DG_NAMES[uld.dg]}
                </Tag>
              )}
            </div>
          </div>
        ) : (
          <div className="slot-empty">空</div>
        )}
      </div>
    </Tooltip>
  );
}

export default function HoldDiagram() {
  const plan = useStore((s) => (s.staging.active ? s.staging.working : s.plan));
  const stagingActive = useStore((s) => s.staging.active);

  // posId -> uld
  const byPos = useMemo(() => {
    const m = new Map<string, Uld>();
    for (const [uid, pid] of Object.entries(plan.placements)) {
      const u = plan.ulds.find((x) => x.id === uid);
      if (u) m.set(pid, u);
    }
    return m;
  }, [plan]);

  const groups = COMPARTMENTS.map((c) => ({ comp: c, positions: POSITIONS.filter((p) => p.comp === c.id) }));

  return (
    <div data-testid="hold-diagram">
      {stagingActive && <Tag color="purple" style={{ marginBottom: 8 }}>演练视图：显示的是未确认的工作副本</Tag>}
      {groups.map(({ comp, positions }) => {
        const used = positions.reduce((s, p) => s + (byPos.get(p.id)?.weight ?? 0), 0);
        return (
          <div key={comp.id} className="comp-block" data-testid={`comp-${comp.id}`}>
            <div className="comp-title">
              {comp.name}
              <span className={used > comp.maxW ? 'comp-over' : 'comp-ok'}>
                {used.toLocaleString('zh-CN')} / {comp.maxW.toLocaleString('zh-CN')} kg
              </span>
            </div>
            <div className="slot-row">
              {positions.map((p) => (
                <Slot key={p.id} pos={p} uld={byPos.get(p.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
