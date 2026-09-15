// 航班装载与重心校核台 —— 主界面
import { Alert, Button, Card, Col, Row, Space, Tag } from 'antd';
import { AIRCRAFT } from './data';
import { trimSuggestion } from './core';
import { useStore } from './store';
import HoldDiagram from './components/HoldDiagram';
import UldLibrary from './components/UldLibrary';
import FuelPanel from './components/FuelPanel';
import SegmentPanel from './components/SegmentPanel';
import SegmentTable from './components/SegmentTable';
import EnvelopeChart from './components/EnvelopeChart';
import StagingPanel from './components/StagingPanel';

export default function App() {
  const {
    plan, locked, staging, officialResult, stagingResult,
    selectedUld, selectedPos, lastErrors,
    place, removeAt, loadDemo, resetAll, lock, unlock,
  } = useStore();

  const ok = officialResult.issues.length === 0;
  const trimTips = officialResult.segments
    .map((s, i) => trimSuggestion(plan, i))
    .filter((t): t is string => !!t);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          ✈️ 航班装载与重心校核台
          <span className="flight-info">航班 CA1041 ｜ 机型 {AIRCRAFT.type} ｜ 航路 PEK–PVG–HKG–SIN</span>
        </div>
        <Space wrap>
          {locked ? <Tag color="gold" data-testid="tag-locked">正式方案（已锁定）</Tag> : <Tag data-testid="tag-editing">草案（未锁定）</Tag>}
          {staging.active && <Tag color="purple" data-testid="tag-staging">演练中（未确认）</Tag>}
          <Tag color={ok ? 'green' : 'red'} data-testid="global-status">
            {locked ? '正式方案' : '草案'}：{ok ? '全部约束通过' : `${officialResult.issues.length} 项不符`}
          </Tag>
          <Button size="small" onClick={loadDemo} data-testid="btn-load-demo">载入演示方案</Button>
          {locked
            ? <Button size="small" onClick={unlock} data-testid="btn-unlock">解除锁定</Button>
            : <Button size="small" onClick={lock} data-testid="btn-lock">锁定为正式方案</Button>}
          <Button size="small" danger onClick={resetAll} data-testid="btn-reset">重置</Button>
        </Space>
      </header>

      {lastErrors && (
        <Alert
          type="error"
          showIcon
          closable
          className="error-bar"
          data-testid="error-list"
          message={lastErrors.title}
          description={
            <ul className="issue-list">
              {lastErrors.items.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          }
        />
      )}

      {trimTips.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className="error-bar"
          data-testid="trim-tips"
          message="配平建议"
          description={<ul className="issue-list">{trimTips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        />
      )}

      <Row gutter={[12, 12]} className="app-body">
        <Col xs={24} xl={6}>
          <Card size="small" title={`机型与燃油（OEW ${AIRCRAFT.oew.toLocaleString('zh-CN')} kg）`}>
            <FuelPanel />
          </Card>
          <Card size="small" title="航段与航程耗油" style={{ marginTop: 12 }}>
            <SegmentPanel />
          </Card>
        </Col>

        <Col xs={24} xl={11}>
          <Card
            size="small"
            title="货舱隔位"
            extra={
              <Space>
                <Button size="small" type="primary" onClick={place} data-testid="btn-place">放入所选舱位</Button>
                <Button size="small" disabled={!selectedPos} onClick={() => selectedPos && removeAt(selectedPos)} data-testid="btn-remove">
                  卸下所选舱位
                </Button>
              </Space>
            }
          >
            <div className="muted" style={{ marginBottom: 6 }}>
              当前选择：集装器 <b data-testid="sel-uld">{selectedUld ?? '—'}</b> ｜ 舱位 <b data-testid="sel-pos">{selectedPos ?? '—'}</b>
            </div>
            <HoldDiagram />
          </Card>
          <Card size="small" title="重心包线（●正式方案 ｜ ○演练未确认）" style={{ marginTop: 12 }}>
            <EnvelopeChart />
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card size="small" title="集装器库（点击选择，再点舱位落位）">
            <UldLibrary />
          </Card>
          <Card size="small" title="演练区" style={{ marginTop: 12 }}>
            <StagingPanel />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="逐航段重量与重心 —— 正式方案" style={{ marginTop: 12 }}>
        <SegmentTable result={officialResult} testPrefix="seg-official" />
        {officialResult.issues.length > 0 && (
          <Alert
            style={{ marginTop: 8 }}
            type="error"
            showIcon
            data-testid="official-issues"
            message="正式方案存在不符项"
            description={<ul className="issue-list">{officialResult.issues.map((s, i) => <li key={i}>{s}</li>)}</ul>}
          />
        )}
      </Card>

      {staging.active && stagingResult && (
        <Card size="small" title="逐航段重量与重心 —— 演练（未确认）" style={{ marginTop: 12 }}>
          <SegmentTable result={stagingResult} testPrefix="seg-staging" />
        </Card>
      )}
    </div>
  );
}
