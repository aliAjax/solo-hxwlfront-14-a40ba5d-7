// 浏览器验证：重心边界、前后舱配平、危险品隔离、多航段燃油变化、演练隔离
import { test, expect } from '@playwright/test';

const num = (s) => parseInt(String(s).replace(/[^\d-]/g, ''), 10);
const cgVal = (s) => parseFloat(String(s));

async function place(page, uldTestId, posTestId) {
  // 点击卡片标题行选择集装器（避开卡片内的装卸站下拉框），再点舱位与放置按钮
  await page.getByTestId(uldTestId).locator('.uld-line1').click();
  await page.getByTestId(posTestId).click();
  await page.getByTestId('btn-place').click();
}

async function cellText(page, testid) {
  return page.getByTestId(testid).innerText();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hold-diagram')).toBeVisible();
});

test('页面加载：标题、舱位图、重心包线图渲染', async ({ page }) => {
  await expect(page.locator('.app-title')).toContainText('航班装载与重心校核台');
  await expect(page.getByTestId('pos-M1')).toBeVisible();
  await expect(page.getByTestId('pos-B1')).toBeVisible();
  await expect(page.locator('[data-testid="cg-chart"] canvas')).toBeVisible();
  await expect(page.getByTestId('global-status')).toBeVisible();
});

test('放置约束：超限/超容/类型/温控/占用均拒绝落位并指出具体舱位', async ({ page }) => {
  const errors = page.getByTestId('error-list');

  // 单舱位限重：ULD-108 (12,500 kg) > M1 限重 11,000 kg
  await place(page, 'uld-ULD-108', 'pos-M1');
  await expect(errors).toContainText('舱位 M1 超限');
  await expect(errors).toContainText('12,500');
  await expect(errors).toContainText('11,000');
  await expect(page.getByTestId('pos-M1')).toContainText('空');

  // LD3 舱位限重：ULD-109 (1,750 kg) > F1 限重 1,600 kg
  await place(page, 'uld-ULD-109', 'pos-F1');
  await expect(errors).toContainText('舱位 F1 超限');
  await expect(errors).toContainText('1,600');

  // 类型不符：PMC 不能进 LD3 舱位
  await place(page, 'uld-ULD-101', 'pos-F1');
  await expect(errors).toContainText('舱位 F1 不接受 PMC 型');

  // 温控：冷藏箱落无电源舱位被拒
  await place(page, 'uld-ULD-106', 'pos-F1');
  await expect(errors).toContainText('舱位 F1 无温控电源');
  // 有电源的 F2 可以落位
  await place(page, 'uld-ULD-106', 'pos-F2');
  await expect(page.getByTestId('pos-F2')).toContainText('ULD-106');

  // 占用冲突
  await place(page, 'uld-ULD-101', 'pos-M1');
  await expect(page.getByTestId('pos-M1')).toContainText('ULD-101');
  await place(page, 'uld-ULD-103', 'pos-M1');
  await expect(errors).toContainText('舱位 M1 已被 ULD-101 占用');

  // 舱段累计超容：前下货舱限 5,000 kg；装入 107/105/112 后累计 980+1,450+1,200+900 = 4,530 kg
  await place(page, 'uld-ULD-107', 'pos-F1');
  await place(page, 'uld-ULD-105', 'pos-F3');
  await place(page, 'uld-ULD-112', 'pos-F4');
  // ULD-202 (1,500 kg) 本身可正常落位（后下货舱 A1）
  await page.evaluate(() => {
    window.__app.store.getState().addUld({ id: 'ULD-202', type: 'AKE', weight: 1500, reefer: false, dg: null, from: 0, to: 3 });
  });
  await place(page, 'uld-ULD-202', 'pos-A1');
  await expect(page.getByTestId('pos-A1')).toContainText('ULD-202');
  await page.getByTestId('pos-A1').click();
  await page.getByTestId('btn-remove').click();
  // 卸下 F4 腾出舱位，但放入 202 后舱段累计 3,630+1,500 = 5,130 > 5,000 → 超容拒绝并指出 F4
  await page.getByTestId('pos-F4').click();
  await page.getByTestId('btn-remove').click();
  await place(page, 'uld-ULD-202', 'pos-F4');
  await expect(errors).toContainText('前下货舱超容');
  await expect(errors).toContainText('F4');
  await expect(page.getByTestId('pos-F4')).toContainText('空');
});

test('危险品隔离：同舱冲突拒绝并指出舱位，异舱允许，1类与所有类隔离', async ({ page }) => {
  const errors = page.getByTestId('error-list');
  // 新增 3 类 AKE 并落入前下货舱 F1
  await page.evaluate(() => {
    window.__app.store.getState().addUld({ id: 'ULD-203', type: 'AKE', weight: 1000, reefer: false, dg: '3', from: 0, to: 3 });
  });
  await place(page, 'uld-ULD-203', 'pos-F1');
  await expect(page.getByTestId('pos-F1')).toContainText('ULD-203');

  // 5.1 类与 3 类同舱（前下货舱）→ 隔离冲突，指出 F1/F2
  await place(page, 'uld-ULD-105', 'pos-F2');
  await expect(errors).toContainText('前下货舱危险品隔离冲突');
  await expect(errors).toContainText('F1');
  await expect(errors).toContainText('不能落位 F2');
  await expect(page.getByTestId('pos-F2')).toContainText('空');

  // 异舱（后下货舱）允许
  await place(page, 'uld-ULD-105', 'pos-A1');
  await expect(page.getByTestId('pos-A1')).toContainText('ULD-105');

  // 1 类爆炸品与所有类隔离：ULD-110(1类) 装 M1 后，ULD-102(3类) 不能进主货舱
  await place(page, 'uld-ULD-110', 'pos-M1');
  await expect(page.getByTestId('pos-M1')).toContainText('ULD-110');
  await place(page, 'uld-ULD-102', 'pos-M2');
  await expect(errors).toContainText('主货舱危险品隔离冲突');
  await expect(errors).toContainText('1 类(爆炸品)');
  await expect(errors).toContainText('不能落位 M2');
  await expect(page.getByTestId('pos-M2')).toContainText('空');

  // 散货舱禁止危险品
  await place(page, 'uld-ULD-112', 'pos-B1');
  await expect(errors).toContainText('不允许装载危险品');
});

test('前后舱配平：集装器后移使重心后移，燃油配平触发后限报警与配平建议，可恢复', async ({ page }) => {
  await page.getByTestId('btn-load-demo').click();
  await expect(page.getByTestId('global-status')).toContainText('全部约束通过');

  const before = cgVal(await cellText(page, 'seg-official-seg-0-towcg'));

  // 将 ULD-101 由 M3(臂19.5m) 移至 M8(臂34.5m)
  await page.getByTestId('pos-M3').click();
  await page.getByTestId('btn-remove').click();
  await page.getByTestId('pos-M8').click();
  await page.getByTestId('btn-place').click();
  await expect(page.getByTestId('pos-M8')).toContainText('ULD-101');

  const after = cgVal(await cellText(page, 'seg-official-seg-0-towcg'));
  expect(after).toBeGreaterThan(before + 3); // 理论增量 ≈ +4.5%MAC
  expect(after).toBeLessThan(before + 6);

  // 燃油配平：中央油箱 → 水平安定面 6,000 kg，重心进一步后移并超出后限
  await page.getByTestId('transfer-amount').locator('input').fill('6000');
  await page.getByTestId('btn-transfer').click();
  await expect(page.getByTestId('official-issues')).toContainText('后于包线后限');
  await expect(page.getByTestId('trim-tips')).toContainText('配平建议');
  await expect(page.getByTestId('global-status')).toContainText('项不符');

  // 转回燃油，恢复全绿
  await page.evaluate(() => window.__app.store.getState().transferFuel('STAB', 'CTR', 6000));
  await expect(page.getByTestId('global-status')).toContainText('全部约束通过');
});

test('重心边界：演示方案全绿；过度前装触发前限报警', async ({ page }) => {
  await page.getByTestId('btn-load-demo').click();
  await expect(page.getByTestId('global-status')).toContainText('全部约束通过');
  for (const i of [0, 1, 2]) {
    await expect(page.getByTestId(`seg-official-seg-${i}-status`)).toContainText('通过');
  }

  // 重置后全部前装 → 无油重心前于前限
  await page.getByTestId('btn-reset').click();
  await place(page, 'uld-ULD-101', 'pos-M1');
  await place(page, 'uld-ULD-102', 'pos-M2');
  await place(page, 'uld-ULD-103', 'pos-M3');
  await expect(page.getByTestId('official-issues')).toContainText('前于包线前限');
  await expect(page.getByTestId('global-status')).toContainText('项不符');
});

test('多航段燃油变化：逐段累计重量与重心正确，改耗油逐级联，燃油不足报警', async ({ page }) => {
  await page.getByTestId('btn-load-demo').click();

  // 逐段起飞油 = 上段落地剩油（累计），LDW = TOW - 耗油
  const expectVals = [
    { i: 0, payload: 35180, zfw: 195180, fuelDep: 127000, tow: 322180, fuelArr: 89000, ldw: 284180 },
    { i: 1, payload: 36630, zfw: 196630, fuelDep: 89000, tow: 285630, fuelArr: 55000, ldw: 251630 },
    { i: 2, payload: 29830, zfw: 189830, fuelDep: 55000, tow: 244830, fuelArr: 25000, ldw: 214830 },
  ];
  for (const v of expectVals) {
    expect(num(await cellText(page, `seg-official-seg-${v.i}-payload`))).toBe(v.payload);
    expect(num(await cellText(page, `seg-official-seg-${v.i}-zfw`))).toBe(v.zfw);
    expect(num(await cellText(page, `seg-official-seg-${v.i}-fueldep`))).toBe(v.fuelDep);
    expect(num(await cellText(page, `seg-official-seg-${v.i}-tow`))).toBe(v.tow);
    expect(num(await cellText(page, `seg-official-seg-${v.i}-fuelarr`))).toBe(v.fuelArr);
    expect(num(await cellText(page, `seg-official-seg-${v.i}-ldw`))).toBe(v.ldw);
  }

  // 燃油消耗使各段落地重心不同
  const ldwCgs = [];
  for (const i of [0, 1, 2]) ldwCgs.push(cgVal(await cellText(page, `seg-official-seg-${i}-ldwcg`)));
  expect(new Set(ldwCgs).size).toBe(3);

  // 调整第一段耗油 38,000 → 45,000：后续各段起飞油级联减少
  await page.getByTestId('burn-0').locator('input').fill('45000');
  await page.keyboard.press('Enter');
  expect(num(await cellText(page, 'seg-official-seg-0-fuelarr'))).toBe(82000);
  expect(num(await cellText(page, 'seg-official-seg-1-fueldep'))).toBe(82000);
  expect(num(await cellText(page, 'seg-official-seg-2-fueldep'))).toBe(48000);

  // 耗油超过机载燃油 → 燃油不足
  await page.getByTestId('burn-2').locator('input').fill('200000');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('official-issues')).toContainText('燃油不足');
});

test('演练区隔离：锁定后直改被拒，演练不进正式方案，校验通过才能确认，放弃可回滚', async ({ page }) => {
  await page.getByTestId('btn-load-demo').click();
  await page.getByTestId('btn-lock').click();
  await expect(page.getByTestId('tag-locked')).toBeVisible();

  // 锁定后直接改 → 拒绝
  await place(page, 'uld-ULD-103', 'pos-M1');
  await expect(page.getByTestId('error-list')).toContainText('正式方案已锁定');

  // 进入演练区，临时加货 ULD-201 → M1
  await page.getByTestId('btn-enter-staging').click();
  await expect(page.getByTestId('tag-staging')).toBeVisible();
  await page.getByTestId('new-uld-id').fill('ULD-201');
  await page.getByTestId('btn-add-uld').click();
  await place(page, 'uld-ULD-201', 'pos-M1');
  await expect(page.getByTestId('staging-ops')).toContainText('装机 ULD-201 → M1');

  // 演练副本已变（35,180 + 5,000），正式方案不变
  expect(num(await cellText(page, 'seg-staging-seg-0-payload'))).toBe(40180);
  expect(num(await cellText(page, 'seg-official-seg-0-payload'))).toBe(35180);
  await expect(page.getByTestId('global-status')).toContainText('全部约束通过');

  // 校验通过 → 确认并入 → 正式方案更新
  await page.getByTestId('btn-validate-staging').click();
  await expect(page.getByTestId('staging-validation')).toContainText('校验通过');
  await page.getByTestId('btn-confirm-staging').click();
  await expect(page.getByTestId('tag-staging')).toBeHidden();
  expect(num(await cellText(page, 'seg-official-seg-0-payload'))).toBe(40180);

  // 再次演练：卸下 ULD-201 但放弃 → 正式方案保持 40,180
  await page.getByTestId('btn-enter-staging').click();
  await page.getByTestId('pos-M1').click();
  await page.getByTestId('btn-remove').click();
  expect(num(await cellText(page, 'seg-staging-seg-0-payload'))).toBe(35180);
  await page.getByTestId('btn-discard-staging').click();
  expect(num(await cellText(page, 'seg-official-seg-0-payload'))).toBe(40180);

  // 演练导致重心超限（两件后移 + 向安定面转油）→ 校验不通过 → 确认按钮禁用
  await page.getByTestId('btn-enter-staging').click();
  await page.getByTestId('pos-M3').click();
  await page.getByTestId('btn-remove').click();
  await page.getByTestId('pos-M7').click();
  await page.getByTestId('btn-place').click();
  await page.getByTestId('pos-M5').click();
  await page.getByTestId('btn-remove').click();
  await page.getByTestId('pos-M8').click();
  await page.getByTestId('btn-place').click();
  await page.evaluate(() => window.__app.store.getState().transferFuel('CTR', 'STAB', 6000));
  await page.getByTestId('btn-validate-staging').click();
  await expect(page.getByTestId('staging-validation')).toContainText('校验未通过');
  await expect(page.getByTestId('staging-validation')).toContainText('后于包线后限');
  await expect(page.getByTestId('btn-confirm-staging')).toBeDisabled();
  await page.getByTestId('btn-discard-staging').click();
  await expect(page.getByTestId('global-status')).toContainText('全部约束通过');
});
