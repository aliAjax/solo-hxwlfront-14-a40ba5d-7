// 集装器库：待装/已装列表 + 新增集装器
import { useState } from 'react';
import { Button, Checkbox, Input, InputNumber, Select, Tag } from 'antd';
import { DG_CLASSES, DG_NAMES, STATIONS, ULD_TYPES } from '../data';
import { useStore } from '../store';
import type { DGClass, Uld } from '../types';

export default function UldLibrary() {
  const plan = useStore((s) => (s.staging.active ? s.staging.working : s.plan));
  const { selectedUld, selectUld, setUldRoute, addUld } = useStore();

  const [newType, setNewType] = useState('PMC');
  const [newWeight, setNewWeight] = useState(5000);
  const [newDg, setNewDg] = useState<DGClass | null>(null);
  const [newReefer, setNewReefer] = useState(false);
  const [newId, setNewId] = useState('');

  const submit = () => {
    const id = newId.trim() || `ULD-${100 + plan.ulds.length + 1}`;
    const u: Uld = {
      id,
      type: newType,
      weight: Math.max(0, Math.round(newWeight)),
      reefer: newReefer || ULD_TYPES[newType].reefer,
      dg: newDg,
      from: 0,
      to: STATIONS.length - 1,
    };
    addUld(u);
    setNewId('');
  };

  return (
    <div data-testid="uld-library">
      <div className="uld-list">
        {plan.ulds.map((u) => {
          const pos = plan.placements[u.id];
          return (
            <div
              key={u.id}
              data-testid={`uld-${u.id}`}
              className={`uld-card ${selectedUld === u.id ? 'uld-selected' : ''}`}
              onClick={() => selectUld(u.id)}
            >
              <div className="uld-line1">
                <b>{u.id}</b>
                <span>{ULD_TYPES[u.type].name}</span>
                <b>{u.weight.toLocaleString('zh-CN')} kg</b>
              </div>
              <div className="uld-line2">
                {u.reefer && <Tag color="blue">❄温控</Tag>}
                {u.dg && <Tag color="orange">{u.dg}类 {DG_NAMES[u.dg]}</Tag>}
                {pos ? <Tag color="green">已装 {pos}</Tag> : <Tag>待装</Tag>}
                <span className="uld-route">
                  <Select
                    size="small"
                    value={u.from}
                    style={{ width: 76 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(v) => setUldRoute(u.id, v, u.to)}
                    options={STATIONS.slice(0, -1).map((s, i) => ({ value: i, label: s }))}
                  />
                  →
                  <Select
                    size="small"
                    value={u.to}
                    style={{ width: 76 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(v) => setUldRoute(u.id, u.from, v)}
                    options={STATIONS.slice(1).map((s, i) => ({ value: i + 1, label: s }))}
                  />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="uld-add">
        <div className="uld-add-row">
          <Input size="small" placeholder="集装器号(可空)" value={newId} onChange={(e) => setNewId(e.target.value)} style={{ width: 120 }} data-testid="new-uld-id" />
          <Select size="small" value={newType} onChange={setNewType} style={{ width: 150 }} data-testid="new-uld-type"
            options={Object.values(ULD_TYPES).map((t) => ({ value: t.id, label: t.name }))} />
          <InputNumber size="small" value={newWeight} onChange={(v) => setNewWeight(v ?? 0)} min={0} step={100} addonAfter="kg" style={{ width: 140 }} data-testid="new-uld-weight" />
        </div>
        <div className="uld-add-row">
          <Select
            size="small"
            allowClear
            placeholder="危险品类别"
            value={newDg}
            onChange={(v) => setNewDg((v as DGClass) ?? null)}
            style={{ width: 170 }}
            data-testid="new-uld-dg"
            options={DG_CLASSES.map((c) => ({ value: c, label: `${c}类 ${DG_NAMES[c]}` }))}
          />
          <Checkbox checked={newReefer} onChange={(e) => setNewReefer(e.target.checked)} data-testid="new-uld-reefer">温控</Checkbox>
          <Button size="small" type="primary" onClick={submit} data-testid="btn-add-uld">添加集装器</Button>
        </div>
      </div>
    </div>
  );
}
