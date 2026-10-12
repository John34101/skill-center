// verify_publish.mjs — 发布后视觉验证：用 Playwright 启动 Chromium 截图核对在线页
//
// 用法（playwright 装在隔离 node workspace，用 NODE_PATH 指向它）：
//   NODE_PATH=/Users/zhaobin/.workbuddy/binaries/node/workspace/node_modules \
//     node verify_publish.mjs [URL]
//
// 默认 URL = https://s0zel9adg2.doubaoapps.com/app/app_17f88vb743c
// 也可传本地文件校验：node verify_publish.mjs "file:///绝对路径/Skill管理中心.html"
//
// 说明：
//   - 拦截 fonts.googleapis.com / fonts.gstatic.com，避免外网字体阻塞、省流量
//   - 内嵌数据由 sync_from_base.py 写入 HTML 快照，截全页即可核对渲染结果
//   - 输出 verify-shot.png，并打印页面标题，便于发布后人工/自动核对

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
const require = createRequire(import.meta.url);
// 复用隔离 node workspace 里的 playwright（ESM 不读 NODE_PATH，故显式指定路径）
const { chromium } = require('/Users/zhaobin/.workbuddy/binaries/node/workspace/node_modules/playwright');

// 复用本机已装的 Google Chrome（CHROME_PATH 可覆盖；默认 macOS 常见路径），避免从国外 CDN 下载 Playwright 自带的 chromium（龟速）
const EXEC = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const URL = process.argv[2] || 'https://s0zel9adg2.doubaoapps.com/app/app_17f88vb743c';
const OUT = 'verify-shot.png';

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

// 本地绝对路径自动转 file:// URL（处理中文/空格），方便发布前本地校验
let target = URL;
if (target.startsWith('/') && existsSync(target)) target = pathToFileURL(target).href;

// 省流量：拦截外部字体，其余放行
await page.route('**/*', (route) => {
  const u = route.request().url();
  if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.abort();
  return route.continue();
});

try {
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // 等内嵌数据渲染完成
  const title = await page.title();
  await page.screenshot({ path: OUT, fullPage: true });
  console.log('VERIFY OK  title=', JSON.stringify(title));
  console.log('screenshot=', OUT);
} catch (e) {
  console.error('VERIFY FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
