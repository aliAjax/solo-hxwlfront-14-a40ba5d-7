// 航段设置：每段航程耗油
import { InputNumber } from 'antd';
import { useStore } from '../store';

export default function SegmentPanel() {
  const plan = useStore((s) => (s.staging.active ? s.staging.working : s.plan));
  const setBurn = useStore((s) => s.setBurn);

  return (
    <div data-testid="segment-panel">
      <table className="mini-table">
        <thead>
          <tr><th>航段</th><th>航程耗油 kg</th></tr>
        </thead>
        <tbody>
          {plan.segments.map((seg, i) => (
            <tr key={i}>
              <td>{seg.from} → {seg.to}</td>
              <td>
                <div data-testid={`burn-${i}`}>
                  <InputNumber
                    size="small"
                    min={0}
                    step={1000}
                    value={seg.burn}
                    onChange={(v) => setBurn(i, v ?? 0)}
                    style={{ width: 120 }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
