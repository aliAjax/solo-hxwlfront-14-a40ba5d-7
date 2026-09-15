// 演练区面板：操作记录、校验、确认/放弃
import { Alert, Button, Space, Tag } from 'antd';
import { useStore } from '../store';

export default function StagingPanel() {
  const { staging, locked, enterStaging, discardStaging, validateStaging, confirmStaging } = useStore();

  if (!staging.active) {
    return (
      <div data-testid="staging-panel">
        <p className="muted">临时加货或配平调整先进入演练区：所有约束校验通过后才能确认并入正式方案，未确认的改动不影响正式方案。</p>
        <Button type="primary" onClick={enterStaging} data-testid="btn-enter-staging">
          进入演练区
        </Button>
        {!locked && <p className="muted" style={{ marginTop: 8 }}>提示：正式方案未锁定时可直接编制；锁定后一切改动只能经演练区确认。</p>}
      </div>
    );
  }

  const v = staging.validation;
  return (
    <div data-testid="staging-panel">
      <Alert type="warning" showIcon message="演练进行中 —— 以下改动尚未进入正式方案" style={{ marginBottom: 8 }} />
      <div className="ops-list" data-testid="staging-ops">
        {staging.ops.length === 0 ? (
          <span className="muted">暂无演练操作（可直接装机、卸货、调油、改航段耗油）</span>
        ) : (
          staging.ops.map((op, i) => <Tag key={i} color="purple">{op}</Tag>)
        )}
      </div>
      <Space style={{ margin: '8px 0' }} wrap>
        <Button onClick={validateStaging} data-testid="btn-validate-staging">校验演练</Button>
        <Button
          type="primary"
          disabled={!v?.ok}
          onClick={confirmStaging}
          data-testid="btn-confirm-staging"
        >
          确认并入正式方案
        </Button>
        <Button danger onClick={discardStaging} data-testid="btn-discard-staging">
          放弃演练
        </Button>
      </Space>
      {v && (
        <Alert
          data-testid="staging-validation"
          type={v.ok ? 'success' : 'error'}
          showIcon
          message={v.ok ? '校验通过：全部约束满足，可以确认' : `校验未通过（${v.issues.length} 项）`}
          description={
            v.issues.length > 0 && (
              <ul className="issue-list">
                {v.issues.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )
          }
        />
      )}
    </div>
  );
}
