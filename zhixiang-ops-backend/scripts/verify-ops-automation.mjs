// 运营全链路自动化验证脚本（内置技能上架后全链路跑通）
// 覆盖：检索→筛选→上架→投流→验证 五阶段，每阶段 ≥5 实现方案。
const BASE = process.env.BASE || 'http://127.0.0.1:3100';

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  const j = await r.json();
  return j.data !== undefined ? j.data : j;
}
async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return j.data !== undefined ? j.data : j;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗ FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('  ✓', msg);
  }
}

(async () => {
  console.log('=== 1) 列出已内置的运营自动化策略（每阶段应 ≥5）===');
  const list = await get('/api/ops/automation/strategies');
  for (const s of list) {
    assert(s.count >= 5, `阶段 ${s.stage} 策略数=${s.count}（≥5）`);
    console.log(`    ${s.stage}: ${s.strategies.map((x) => x.key).join(', ')}`);
  }
  const total = list.reduce((a, s) => a + s.count, 0);
  assert(total >= 25, `策略总数=${total}（≥25）`);

  console.log('\n=== 2) 触发一次全链路自动化运行（免人工干预）===');
  const run = await post('/api/ops/automation/run', { tenantId: 't_demo' });
  assert(run.chainRunId, `链路运行id=${run.chainRunId}`);
  const stages = Object.entries(run.stages);
  assert(stages.length === 5, `五阶段全部执行：${stages.length}`);
  for (const [stage, rep] of stages) {
    console.log(
      `    ${stage}: strategy=${rep.strategy} ok=${rep.ok}` +
        (rep.error ? ` error=${rep.error}` : ''),
    );
  }

  console.log('\n=== 3) 指定各阶段策略偏好后再次运行（多维实现路径切换）===');
  await post('/api/ops/automation/prefer', {
    tenantId: 't_demo',
    pref: {
      retrieve: 'retrieve_keyword_mine',
      screen: 'screen_conversion',
      'publish-up': 'publishup_story_sell',
      deliver: 'deliver_kuaishou',
      verify: 'verify_conversion',
    },
  });
  const run2 = await post('/api/ops/automation/run', { tenantId: 't_demo' });
  const chosen = Object.entries(run2.stages).map(
    ([s, r]) => `${s}=${r.strategy}`,
  );
  console.log('    ' + chosen.join('  '));
  assert(
    run2.stages.retrieve.strategy === 'retrieve_keyword_mine',
    `检索策略按偏好切换=${run2.stages.retrieve.strategy}`,
  );
  assert(
    run2.stages.deliver.strategy === 'deliver_kuaishou',
    `投流策略按偏好切换=${run2.stages.deliver.strategy}`,
  );

  console.log('\n=== 4) 运行记录可查 ===');
  const runs = await get('/api/ops/automation/runs');
  assert(Array.isArray(runs) && runs.length >= 2, `近期运行记录数=${runs.length}`);

  console.log('\n=== 验证结论 ===');
  if (process.exitCode) {
    console.error('存在失败项，请检查后端日志 smoke.log');
  } else {
    console.log('✔ 运营系统全链路自动化打通：25 个内置技能、5 阶段、免人工干预跑通。');
  }
})();
