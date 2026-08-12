// 无浏览器/无 TTY 环境下完成 PartyKit 登录：
// 读取 scripts 流程中生成的设备码，轮询 GitHub 直到用户授权，写入 ~/.partykit/config.json。
// 仅在 partykit login -p github 因缺少 TTY 无法交互时使用。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const f = path.join(os.tmpdir(), 'pk-device.json');
if (!fs.existsSync(f)) {
  console.error('未找到设备码文件，请先运行获取设备码的步骤');
  process.exit(1);
}
const dev = JSON.parse(fs.readFileSync(f, 'utf8'));
const CLIENT_ID = '670a9f76d6be706f5209';
const expiresAt = Date.now() + (dev.expires_in - 10) * 1000;

console.log(`[poll] 等待你在 ${dev.verification_uri} 输入验证码 ${dev.user_code} 并授权 PartyKit...`);

while (Date.now() < expiresAt) {
  let j;
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'partykit/x' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: dev.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
      signal: AbortSignal.timeout(30000),
    });
    j = await res.json();
  } catch (e) {
    console.log(`[warn] 网络错误，继续重试: ${e.message}`);
    await new Promise((r) => setTimeout(r, (dev.interval || 5) * 1000));
    continue;
  }
  if (j.access_token) {
    const me = await (
      await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${j.access_token}`, 'User-Agent': 'partykit/x' },
      })
    ).json();
    const cfgDir = path.join(os.homedir(), '.partykit');
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(
      path.join(cfgDir, 'config.json'),
      JSON.stringify({ login: me.login, access_token: j.access_token, type: 'github' }, null, 2)
    );
    console.log(`[ok] 凭据已写入 ${path.join(cfgDir, 'config.json')}，GitHub 登录名: ${me.login}`);
    process.exit(0);
  }
  if (j.error && j.error !== 'authorization_pending') {
    console.error('[error]', j.error, j.error_description || '');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, (dev.interval || 5) * 1000));
}
console.error('[timeout] 设备码已过期，请重新获取验证码');
process.exit(1);
