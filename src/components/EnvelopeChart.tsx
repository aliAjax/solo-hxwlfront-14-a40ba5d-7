// 重心包线图（echarts）：包线、结构限重线、逐航段 ZFW/TOW/LDW 点
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { AIRCRAFT, ENVELOPE } from '../data';
import { aftLimit, cgStatus, fwdLimit } from '../core';
import { useStore } from '../store';
import type { PlanResult } from '../types';

const SEG_COLORS = ['#1677ff', '#13c2c2', '#722ed1'];

function pointsOf(result: PlanResult, symbol: (phase: string) => string, hollow: boolean) {
  const pts: Array<Record<string, unknown>> = [];
  for (const s of result.segments) {
    const phases: Array<[string, number, number]> = [
      ['ZFW', s.zfwCg, s.zfw],
      ['TOW', s.towCg, s.tow],
      ['LDW', s.ldwCg, s.ldw],
    ];
    for (const [phase, cg, w] of phases) {
      const bad = cgStatus(w, cg) !== 'ok';
      pts.push({
        value: [cg, w],
        name: `航段${s.index + 1} ${phase}`,
        symbol: symbol(phase),
        symbolSize: phase === 'TOW' ? 13 : 10,
        itemStyle: {
          color: hollow ? 'transparent' : bad ? '#f5222d' : SEG_COLORS[s.index % 3],
          borderColor: bad ? '#f5222d' : SEG_COLORS[s.index % 3],
          borderWidth: hollow || bad ? 2 : 0,
          borderType: hollow ? 'dashed' : 'solid',
        },
        label: {
          show: phase === 'TOW',
          position: 'top',
          fontSize: 10,
          formatter: `${hollow ? '演练' : ''}S${s.index + 1}-${phase}`,
        },
      });
    }
  }
  return pts;
}

export default function EnvelopeChart() {
  const ref = useRef<HTMLDivElement>(null);
  const plan = useStore((s) => s.plan);
  const staging = useStore((s) => s.staging);
  const official = useStore((s) => s.officialResult);
  const stagingResult = useStore((s) => s.stagingResult);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    const fwd = ENVELOPE.fwd.map((p) => [p.cg, p.w]);
    const aft = ENVELOPE.aft.map((p) => [p.cg, p.w]);

    const series: Array<Record<string, unknown>> = [
      {
        name: '前限', type: 'line', data: fwd, showSymbol: false,
        lineStyle: { color: '#fa8c16', width: 2 }, endLabel: { show: true, formatter: '前限' },
        markLine: {
          silent: true, symbol: 'none',
          data: [
            { yAxis: AIRCRAFT.mzfw, label: { formatter: 'MZFW' }, lineStyle: { type: 'dashed', color: '#999' } },
            { yAxis: AIRCRAFT.mlw, label: { formatter: 'MLW' } },
            { yAxis: AIRCRAFT.mtow, label: { formatter: 'MTOW' } },
          ],
        },
      },
      { name: '后限', type: 'line', data: aft, showSymbol: false, lineStyle: { color: '#fa8c16', width: 2 }, endLabel: { show: true, formatter: '后限' } },
      {
        name: '正式方案', type: 'scatter',
        data: pointsOf(official, (p) => (p === 'TOW' ? 'triangle' : p === 'ZFW' ? 'circle' : 'diamond'), false),
      },
    ];
    if (staging.active && stagingResult) {
      series.push({
        name: '演练(未确认)', type: 'scatter',
        data: pointsOf(stagingResult, (p) => (p === 'TOW' ? 'triangle' : p === 'ZFW' ? 'circle' : 'diamond'), true),
      });
    }

    chart.setOption({
      animation: false,
      grid: { left: 70, right: 60, top: 30, bottom: 40 },
      tooltip: {
        trigger: 'item',
        formatter: (p: { name?: string; value: [number, number] }) =>
          `${p.name ?? ''}<br/>重心 ${Number(p.value[0]).toFixed(1)}%MAC<br/>重量 ${Number(p.value[1]).toLocaleString('zh-CN')} kg<br/>包线 ${fwdLimit(p.value[1]).toFixed(1)} ~ ${aftLimit(p.value[1]).toFixed(1)}%MAC`,
      },
      xAxis: { name: '重心 %MAC', min: 10, max: 40, nameLocation: 'middle', nameGap: 26 },
      yAxis: {
        name: '重量 kg', min: 150000, max: 410000,
        axisLabel: { formatter: (v: number) => `${Math.round(v / 1000)}k` },
      },
      series,
    } as unknown as echarts.EChartsOption);

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [official, stagingResult, staging.active, plan]);

  return <div ref={ref} data-testid="cg-chart" style={{ width: '100%', height: 360 }} />;
}
