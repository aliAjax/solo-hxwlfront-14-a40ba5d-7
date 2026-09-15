// 航段重量与重心表：逐航段 ZFW/TOW/LDW 及重心，含判定
import { Tag } from 'antd';
import { aftLimit, fmtCg, fwdLimit } from '../core';
import type { PlanResult } from '../types';

function CgCell({ w, cg, testid }: { w: number; cg: number; testid: string }) {
  const bad = cg < fwdLimit(w) || cg > aftLimit(w);
  return (
    <td className={`num ${bad ? 'cg-bad' : ''}`} data-testid={testid}>
      {fmtCg(cg)}
    </td>
  );
}

export default function SegmentTable({ result, testPrefix }: { result: PlanResult; testPrefix: string }) {
  return (
    <table className="mini-table seg-table" data-testid={`${testPrefix}-table`}>
      <thead>
        <tr>
          <th>航段</th>
          <th>业载 kg</th>
          <th>无油重 ZFW</th>
          <th>ZFW 重心</th>
          <th>起飞油 kg</th>
          <th>起飞重 TOW</th>
          <th>TOW 重心</th>
          <th>耗油 kg</th>
          <th>落地油 kg</th>
          <th>落地重 LDW</th>
          <th>LDW 重心</th>
          <th>判定</th>
        </tr>
      </thead>
      <tbody>
        {result.segments.map((s) => (
          <tr key={s.index} data-testid={`${testPrefix}-seg-${s.index}`}>
            <td>{s.from}→{s.to}</td>
            <td className="num" data-testid={`${testPrefix}-seg-${s.index}-payload`}>{s.payloadW.toLocaleString('zh-CN')}</td>
            <td className="num" data-testid={`${testPrefix}-seg-${s.index}-zfw`}>{s.zfw.toLocaleString('zh-CN')}</td>
            <CgCell w={s.zfw} cg={s.zfwCg} testid={`${testPrefix}-seg-${s.index}-zfwcg`} />
            <td className="num" data-testid={`${testPrefix}-seg-${s.index}-fueldep`}>{s.fuelDep.toLocaleString('zh-CN')}</td>
            <td className="num" data-testid={`${testPrefix}-seg-${s.index}-tow`}>{s.tow.toLocaleString('zh-CN')}</td>
            <CgCell w={s.tow} cg={s.towCg} testid={`${testPrefix}-seg-${s.index}-towcg`} />
            <td className="num" data-testid={`${testPrefix}-seg-${s.index}-burn`}>{s.burn.toLocaleString('zh-CN')}</td>
            <td className="num" data-testid={`${testPrefix}-seg-${s.index}-fuelarr`}>{s.fuelArr.toLocaleString('zh-CN')}</td>
            <td className="num" data-testid={`${testPrefix}-seg-${s.index}-ldw`}>{s.ldw.toLocaleString('zh-CN')}</td>
            <CgCell w={s.ldw} cg={s.ldwCg} testid={`${testPrefix}-seg-${s.index}-ldwcg`} />
            <td data-testid={`${testPrefix}-seg-${s.index}-status`}>
              {s.issues.length === 0 ? (
                <Tag color="green">通过</Tag>
              ) : (
                <Tag color="red">{s.issues.length} 项不符</Tag>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
