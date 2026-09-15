// 截图脚本：载入演示方案后截取主界面与演练区
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 1400 } });
await page.goto('http://localhost:4173');
await page.getByTestId('hold-diagram').waitFor();
await page.getByTestId('btn-load-demo').click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/screenshot-main.png', fullPage: true });

// 演练区视图
await page.getByTestId('btn-lock').click();
await page.getByTestId('btn-enter-staging').click();
await page.getByTestId('new-uld-id').fill('ULD-201');
await page.getByTestId('btn-add-uld').click();
await page.getByTestId('uld-ULD-201').locator('.uld-line1').click();
await page.getByTestId('pos-M1').click();
await page.getByTestId('btn-place').click();
await page.getByTestId('btn-validate-staging').click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/screenshot-staging.png', fullPage: true });

await browser.close();
console.log('screenshots saved');
