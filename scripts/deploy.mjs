#!/usr/bin/env node
/**
 * 一键部署「现代艺术」联机版（PartyKit 服务端 + 静态前端）
 *
 * 流程：
 *   1) 检查 PartyKit 登录；未登录则走 GitHub 设备码登录（无需本机浏览器，
 *      只需在 github.com/login/device 输入终端显示的验证码并授权即可）。
 *   2) partykit deploy  -> 拿到 <项目名>.<账号>.partykit.dev 主机。
 *   3) 用 VITE_PARTYKIT_HOST=<host> 构建联机版静态前端到 dist/。
 *   4) 提示用 WorkBuddy 的 CloudStudio 部署 dist/ 得到公网联机分享链接。
 *
 * 用法：
 *   node scripts/deploy.mjs
 *   npm run deploy:online
 */

import { spawnSync } from 'node:child_process';

const root = process.cwd();
const isWin = process.platform === 'win32';

const log = (...a) => console.log('▶', ...a);
const ok = (...a) => console.log('✅', ...a);
const warn = (...a) => console.log('⚠️', ...a);
const err = (...a) => console.error('❌', ...a);

/** 运行命令；inherit=true 时透传终端（用于交互式登录/构建）；否则捕获输出。 */
function run(cmd, args, { inherit = true, env = {} } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: inherit ? 'inherit' : 'pipe',
    shell: isWin,
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    err(`命令失败（exit ${r.status}）：${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
  return ((r.stdout || '').toString() + (r.stderr || '').toString());
}

/** 是否已登录 PartyKit */
function isLoggedIn() {
  const out = run('npx', ['partykit', 'whoami'], { inherit: false });
  return !/Not logged in/i.test(out);
}

/** 从部署输出中解析 partykit.dev 主机名 */
function parseHost(deployOut) {
  const withProto = deployOut.match(/https?:\/\/([a-z0-9-]+\.partykit\.dev)/i);
  if (withProto) return withProto[1];
  const bare = deployOut.match(/([a-z0-9-]+\.partykit\.dev)/i);
  return bare ? bare[1] : null;
}

async function main() {
  console.log('\n=== 现代艺术 · 联机版一键部署 ===\n');

  // 步骤 1：登录
  log('步骤 1/3  PartyKit 登录');
  if (isLoggedIn()) {
    ok('已登录，跳过');
  } else {
    warn('未登录，将使用 GitHub 设备码登录。');
    warn('终端会显示验证码与网址，请在自己的浏览器打开并完成授权。');
    run('npx', ['partykit', 'login', '-p', 'github']);
    if (!isLoggedIn()) {
      err('登录仍未完成，请确认已在 github.com/login/device 输入验证码并授权。');
      process.exit(1);
    }
    ok('登录成功');
  }

  // 步骤 2：部署 PartyKit 服务端
  log('步骤 2/3  部署 PartyKit 服务端（partykit deploy）');
  const deployOut = run('npx', ['partykit', 'deploy'], { inherit: false });
  process.stdout.write(deployOut);
  const host = parseHost(deployOut);
  if (!host) {
    err('未能从部署输出解析出 *.partykit.dev 主机名，请检查上方输出。');
    process.exit(1);
  }
  ok('PartyKit 主机：', host);

  // 步骤 3：构建联机版前端
  log(`步骤 3/3  构建联机版前端（VITE_PARTYKIT_HOST=${host}）`);
  run('npm', ['run', 'build'], { env: { VITE_PARTYKIT_HOST: host } });
  ok('联机版前端已构建到 dist/');

  console.log('\n=== 部署完成 ===');
  console.log('PartyKit 控制台：', `https://${host}`);
  console.log('下一步：在 WorkBuddy 中执行 CloudStudio 部署（目录 dist/），');
  console.log('        即可获得支持「创建/加入房间」公网联机的分享链接。\n');
}

main().catch((e) => {
  err(e?.message || e);
  process.exit(1);
});
