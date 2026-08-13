import process from 'node:process';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100/api';

async function get(path) {
  const r = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  const j = await r.json();
  return j && typeof j === 'object' && 'data' in j ? j.data : j;
}
async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`POST ${path} -> ${r.status}`);
  const j = await r.json();
  return j && typeof j === 'object' && 'data' in j ? j.data : j;
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log(`✔ ${name}`);
  else {
    console.log(`✘ ${name} ${extra ?? ''}`);
    failures++;
  }
}

(async () => {
  try {
    // 1) 策略覆盖度
    const list = await get('/ops/video-automation/strategies');
    const stages = Array.isArray(list) ? list : [list];
    const stageKeys = stages.map((s) => s.stage);
    check('视频全链路 8 阶段齐全', stageKeys.length === 8, stageKeys.join(','));
    let total = 0;
    for (const s of stages) {
      total += s.count;
      check(`阶段 ${s.stage} ≥5 策略 (实=${s.count})`, s.count >= 5);
    }
    check('策略总数 ≥40', total >= 40, 'total=' + total);

    // 2) 免人工干预跑通 8 阶段
    const run = await post('/ops/video-automation/run', {});
    check('返回 chainRunId', !!run.chainRunId, run.chainRunId);
    const stageReport = run.stages || {};
    const stageNames = Object.keys(stageReport);
    check('8 阶段均运行', stageNames.length === 8, stageNames.join(','));
    for (const [stage, r] of Object.entries(stageReport)) {
      check(`阶段 ${stage} ok (${r.strategy})`, r.ok === true, r.error || '');
    }

    // 3) 多维实现路径偏好切换
    const pref = {
      intel: 'intel_keyword_xhs',
      analyze: 'analyze_comments_bilibili',
      topic: 'topic_composite',
      script: 'script_story',
      material: 'material_video',
      compose: 'compose_horizontal',
      publish: 'publish_bilibili',
      recycle: 'recycle_conversion',
    };
    await post('/ops/video-automation/prefer', { tenantId: 't_demo', pref });
    const run2 = await post('/ops/video-automation/run', {});
    const usedWrong = [];
    for (const [stage, r] of Object.entries(run2.stages || {})) {
      if (r.strategy !== pref[stage]) usedWrong.push(`${stage}=${r.strategy}`);
    }
    check('偏好切换生效', usedWrong.length === 0, usedWrong.join(','));

    // 4) 运行记录可查
    const runs = await get('/ops/video-automation/runs');
    check('运行记录可查', Array.isArray(runs) && runs.length > 0, 'count=' + (runs?.length ?? 0));

    console.log(failures === 0 ? '\nALL GREEN ✅' : `\n${failures} 项失败 ❌`);
    process.exit(failures === 0 ? 0 : 1);
  } catch (e) {
    console.error('验证脚本异常:', e);
    process.exit(2);
  }
})();
