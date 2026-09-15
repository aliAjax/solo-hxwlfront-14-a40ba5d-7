// 燃油面板：各油箱油量、总油量、转油配平
import { useState } from 'react';
import { Button, InputNumber, Select } from 'antd';
import { AIRCRAFT } from '../data';
import { totalFuel } from '../core';
import { useStore } from '../store';

export default function FuelPanel() {
  const plan = useStore((s) => (s.staging.active ? s.staging.working : s.plan));
  const { setFuel, transferFuel } = useStore();
  const [from, setFrom] = useState('CTR');
  const [to, setTo] = useState('STAB');
  const [amount, setAmount] = useState(2000);

  const total = totalFuel(plan.fuel);
  const capTotal = AIRCRAFT.tanks.reduce((s, t) => s + t.cap, 0);

  return (
    <div data-testid="fuel-panel">
      <table className="mini-table">
        <thead>
          <tr><th>油箱</th><th>油量 kg</th><th>容量</th><th>力臂 m</th></tr>
        </thead>
        <tbody>
          {AIRCRAFT.tanks.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>
                <InputNumber
                  size="small"
                  min={0}
                  max={t.cap}
                  step={500}
                  value={plan.fuel[t.id] ?? 0}
                  onChange={(v) => setFuel(t.id, v ?? 0)}
                  style={{ width: 110 }}
                  data-testid={`fuel-${t.id}`}
                />
              </td>
              <td className="num">{t.cap.toLocaleString('zh-CN')}</td>
              <td className="num">{t.arm.toFixed(1)}</td>
            </tr>
          ))}
          <tr className="sum-row">
            <td>合计</td>
            <td className="num" data-testid="fuel-total">{total.toLocaleString('zh-CN')}</td>
            <td className="num">{capTotal.toLocaleString('zh-CN')}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="transfer-row">
        <span>转油配平：</span>
        <Select size="small" value={from} onChange={setFrom} style={{ width: 130 }} data-testid="transfer-from"
          options={AIRCRAFT.tanks.map((t) => ({ value: t.id, label: t.name }))} />
        →
        <Select size="small" value={to} onChange={setTo} style={{ width: 150 }} data-testid="transfer-to"
          options={AIRCRAFT.tanks.map((t) => ({ value: t.id, label: t.name }))} />
        <div data-testid="transfer-amount">
          <InputNumber size="small" value={amount} onChange={(v) => setAmount(v ?? 0)} min={0} step={500} style={{ width: 100 }} />
        </div>
        <Button size="small" onClick={() => transferFuel(from, to, amount)} data-testid="btn-transfer">转油</Button>
      </div>
    </div>
  );
}
