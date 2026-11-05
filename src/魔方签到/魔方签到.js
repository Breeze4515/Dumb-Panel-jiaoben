/**
 * 魔方云 滑块验证码求解网关平台 - 青龙面板自动签到脚本
 *
 * 适用站点：https://mf.yinxiaoxing.dpdns.org/?invite=9c427a68
 * 功能：
 *   1. 通过环境变量 MF_COOKIE 携带登录 Cookie 鉴权
 *   2. GET /api/me         —— 读取 账户余额 / 累计求解次数 / 累计消费
 *   3. POST /api/my/checkin —— 执行每日签到，获取余额奖励
 *   4. 用青龙 notify.sendNotify 推送签到结果
 *
 * 环境变量（青龙面板-环境变量中配置）：
 *   MF_COOKIE        登录后的 Cookie 字符串（必需）
 *   MF_EGRESS_IP     可选，固定出口 IP；未设置时脚本自动通过 ipify 获取本机出口 IP
 *   MF_IPIFY_API     可选，自定义出口 IP 回显服务地址，默认 https://api.ipify.org
 *
 * 定时建议（青龙 cron）：
 *   10 8 * * *       每天 08:10 执行
 */

// ---------- 配置 ----------
const BASE = 'https://mf.yinxiaoxing.dpdns.org';
const COOKIE = process.env.MF_COOKIE || '';
const EGRESS_IP = process.env.MF_EGRESS_IP || '';
const IPIFY_API = process.env.MF_IPIFY_API || 'https://api.ipify.org';
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36';

// ---------- 工具：青龙通知 ----------
let notify = null;
try {
  ({ sendNotify: notify } = require('sendNotify'));
} catch (e) {
  // 青龙面板之外运行（如本地 node 调试）时无 sendNotify，降级为控制台打印
  notify = null;
}

function log(...args) {
  const ts = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log(`[${ts}]`, ...args);
}

// ---------- 工具：HTTP 请求（基于 fetch，青龙 Node 环境 Node >= 18 自带） ----------
async function api(method, path, payload) {
  const headers = {
    'User-Agent': USER_AGENT,
    Referer: BASE + '/',
    'Content-Type': 'application/json',
    Accept: '*/*',
  };
  if (COOKIE) headers.Cookie = COOKIE;

  const opts = { method, headers };
  if (payload !== undefined) opts.body = JSON.stringify(payload);

  const resp = await fetch(BASE + path, opts);
  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { success: false, message: `非 JSON 响应(${resp.status}): ${text.slice(0, 200)}` };
  }
  if (!resp.ok) {
    data.success = false;
    data.status = resp.status;
  }
  return data;
}

// 获取本机出口 IP；失败返回空字符串
async function getEgressIP() {
  try {
    const resp = await fetch(IPIFY_API);
    const ip = (await resp.text()).trim();
    // 简单 IPv4/IPv6 校验
    if (/^[0-9a-fA-F:.\d]+$/.test(ip) && ip.length <= 45) return ip;
    return '';
  } catch (e) {
    return '';
  }
}

// ---------- 主流程 ----------
async function main() {
  if (!COOKIE) {
    const msg = '未配置 MF_COOKIE 环境变量，请先在青龙面板-环境变量中添加登录 Cookie。';
    log(msg);
    if (notify) await notify('魔方签到失败', msg);
    process.exit(1);
    return;
  }

  // 1. 查询用户信息（余额/累计求解次数/累计消费）
  const me = await api('GET', '/api/me');
  let username = '未知';
  let balance = 0;
  let totalCalls = 0;
  let totalCost = 0;
  if (me && me.success) {
    const d = me.data || {};
    username = d.username || username;
    balance = typeof d.balance === 'number' ? d.balance : 0;
    totalCalls = typeof d.total_calls === 'number' ? d.total_calls : 0;
    totalCost = typeof d.total_cost === 'number' ? d.total_cost : 0;
  } else {
    const errMsg = me && me.message ? me.message : '查询用户信息失败（可能 Cookie 失效）';
    log(`⚠️ ${errMsg}`);
    if (notify) await notify('魔方签到-查询失败', errMsg);
    process.exit(1);
    return;
  }

  log(`用户: ${username}  余额: ${balance}  累计求解: ${totalCalls} 次  累计消费: ${totalCost} 元`);

  // 2. 检查今日是否已签到（可选；部分站点 GET 状态与 POST 结果二选一即可）
  const status = await api('GET', '/api/my/checkin');

  // 3. 执行签到
  let reward = 0;
  let checkinMsg = '';
  const alreadySigned =
    status && status.data && status.data.can_checkin === false;

  if (alreadySigned) {
    checkinMsg = '今日已签到，无需重复操作';
    log('ℹ️ ' + checkinMsg);
  } else {
    // 确定出口 IP
    let egressIp = EGRESS_IP;
    if (!egressIp) egressIp = await getEgressIP();
    if (!egressIp) {
      log('⚠️ 未获取到出口 IP，使用占位 IP 继续');
      egressIp = '0.0.0.0';
    }

    const r = await api('POST', '/api/my/checkin', { egress_ip: egressIp });
    if (r && r.success) {
      reward = typeof r.reward === 'number' ? r.reward : 0;
      checkinMsg = (r.message || '').replace(/[\u0000-\u001f]/g, '');
      if (!checkinMsg) checkinMsg = '签到成功';
      log('✅ ' + checkinMsg + (reward ? `（奖励 ${reward} 元）` : ''));
    } else {
      const errMsg = r && r.message ? r.message : '签到请求失败';
      // 返回“已签到”类提示视为正常，不当作失败
      if (/今日已签到|已签到|重复签到/.test(errMsg)) {
        checkinMsg = '今日已签到，无需重复操作';
        log('ℹ️ ' + checkinMsg);
      } else {
        log('❌ ' + errMsg);
        checkinMsg = '签到失败：' + errMsg;
      }
    }
  }

  // 4. 组装通知内容
  const lines = [
    `👤 用户：${username}`,
    `💰 账户余额: ${balance} 元`,
    `🔢 累计求解次数: ${totalCalls} 次`,
    `💸 累计消费: ${totalCost} 元`,
    '',
    `📝 签到结果：${checkinMsg}`,
  ];
  if (reward > 0) lines.splice(lines.length - 1, 0, `🎁 本次签到余额: +${reward} 元`);
  const content = lines.join('\n');
  const title = `魔方签到 · ${username}`;

  log('\n------------------------------');
  log(content);
  log('------------------------------\n');

  if (notify) {
    await notify(title, content);
  }
}

main().catch((e) => {
  const msg = `脚本异常: ${(e && e.message) || e}`;
  log('❌ ' + msg);
  if (notify) notify('魔方签到-异常', msg);
});
