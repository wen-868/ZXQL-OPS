/**
 * 试运营全链路冒烟脚本（零依赖，Node ≥ 18）。
 *
 * 经运营看板代理（默认 http://localhost:8080）跑全链路 9 个看板接口，
 * 校验响应信封 {code,msg,data,traceId} 与数据非空，输出试运营健康报告。
 *
 * 用法： node trial-smoke.js [tenantId]
 *   tenantId 缺省 't_dev'（与 MEMORY 约定一致；也可传 '1' 等）。
 *
 * 退出码： 全部接口返回 code=0 且至少命中数据 → 0；否则 1。
 */
'use strict';

const BASE = process.env.SMOKE_BASE || 'http://localhost:8080';
const TENANT = process.argv[2] || 't_dev';
const SMOKE_USER = process.env.SMOKE_USER || 'admin';
const SMOKE_PASS = process.env.SMOKE_PASS || 'admin123';

// 看板聚合接口（对应 ops-dashboard/index.html 的 loadAll 调用集）
const ENDPOINTS = [
  { path: '/api/ops/dashboard/overview', name: '经营概览', probe: (d) => d && ((d.trend && d.trend.length) || (d.cards && Object.values(d.cards).some((v) => v))) },
  { path: '/api/ops/dashboard/funnel', name: '全链路漏斗', probe: (d) => d && d.stages && d.stages.length },
  { path: '/api/ops/dashboard/account-compare', name: '账号对比', probe: (d) => d && d.accounts && d.accounts.length },
  { path: '/api/ops/dashboard/topic-efficiency', name: '选题效能榜', probe: (d) => d && d.items && d.items.length },
  { path: '/api/ops/dashboard/human-hook', name: '人性钩子分析', probe: (d) => d && d.items && d.items.length },
  { path: '/api/ops/talent/summary', name: '达人概览(V)', probe: (d) => d && (d.talentCount || d.orderCount) },
  { path: '/api/ops/talent/brand-orders', name: '商单列表(V)', probe: (d) => Array.isArray(d) && d.length },
  { path: '/api/ops/overseas/summary', name: '出海概览(X)', probe: (d) => d && (d.platformCount || d.videoCount) },
  { path: '/api/ops/overseas/videos', name: '出海视频(X)', probe: (d) => Array.isArray(d) && d.length },
];

async function callOne(ep, token) {
  const t0 = Date.now();
  try {
    const headers = { 'x-tenant-id': TENANT };
    if (token) headers['authorization'] = 'Bearer ' + token;
    const res = await fetch(BASE + ep.path, { headers });
    const text = await res.text();
    const ms = Date.now() - t0;
    let json = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    if (!res.ok) {
      return { ...ep, ok: false, code: 'HTTP' + res.status, data: false, ms, detail: text.slice(0, 80) };
    }
    if (!json || json.code !== '0') {
      return { ...ep, ok: false, code: json ? json.code : 'NOJSON', data: false, ms, detail: json ? (json.msg || '') : '' };
    }
    const hasData = typeof ep.probe === 'function' ? ep.probe(json.data) : !!json.data;
    return { ...ep, ok: true, code: json.code, data: hasData, ms, traceId: json.traceId };
  } catch (e) {
    return { ...ep, ok: false, code: 'ERR', data: false, ms: Date.now() - t0, detail: e.message };
  }
}

(async () => {
  console.log('════════════════════════════════════════════════════════');
  console.log(` 智享全链运营 · 试运营冒烟`);
  console.log(` 看板代理 : ${BASE}`);
  console.log(` 租户     : ${TENANT}`);
  console.log(` 时间     : ${new Date().toLocaleString('zh-CN')}`);
  console.log('════════════════════════════════════════════════════════');

  // 代理探活
  const proxyOk = await fetch(BASE + '/api/ops/health').then((r) => r.ok).catch(() => false);
  if (!proxyOk) {
    console.log(' ❌ 看板代理不可达（8080）。请先运行 ops-trial.ps1 启动全栈。');
    process.exit(1);
  }

  // 登录获取 JWT（8/9 起全局鉴权，业务接口需带 token）
  let token = '';
  try {
    const loginRes = await fetch(BASE + '/api/ops/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT },
      body: JSON.stringify({ username: SMOKE_USER, password: SMOKE_PASS }),
    });
    const loginJson = await loginRes.json().catch(() => null);
    if (loginRes.ok && loginJson && loginJson.code === '0' && loginJson.data && loginJson.data.token) {
      token = loginJson.data.token;
      console.log(` ✅ 登录成功：${SMOKE_USER}@${TENANT}`);
    } else {
      console.log(` ❌ 登录失败：${SMOKE_USER}（HTTP ${loginRes.status} ${loginJson ? loginJson.msg : ''}）`);
      console.log('    可设置 SMOKE_USER / SMOKE_PASS 环境变量指定试运营账号。');
      process.exit(1);
    }
  } catch (e) {
    console.log(' ❌ 登录请求异常：' + e.message);
    process.exit(1);
  }

  const results = [];
  for (const ep of ENDPOINTS) {
    const r = await callOne(ep, token);
    const flag = !r.ok ? '❌' : (r.data ? '✅' : '⚠️ ');
    const info = !r.ok ? r.detail : (r.data ? 'data ✓' : 'envelope ok, 无数据');
    console.log(` ${flag} ${r.name.padEnd(14)} ${r.path.padEnd(34)} ${String(r.ms).padStart(4)}ms  ${info}`);
    results.push(r);
  }

  const fail = results.filter((r) => !r.ok).length;
  const withData = results.filter((r) => r.ok && r.data).length;
  console.log('────────────────────────────────────────────────────────');
  console.log(` 汇总： ${results.length} 接口 ｜ 通过 ${results.length - fail} ｜ 失败 ${fail} ｜ 命中数据 ${withData}`);
  if (fail > 0) {
    console.log(' ❌ 试运营冒烟未通过：存在失败接口。');
    process.exit(1);
  }
  if (withData === 0) {
    console.log(' ⚠️ 接口全绿但租户无数据（空库）。试运营冒烟通过；如需业务闭环数据，先跑种子/采集流程。');
    process.exit(0);
  }
  console.log(' ✅ 试运营全链路冒烟通过，看板有数据。');
  process.exit(0);
})();
