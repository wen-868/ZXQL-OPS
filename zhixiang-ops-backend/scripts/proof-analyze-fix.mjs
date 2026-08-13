const BASE = process.env.BASE_URL || 'http://127.0.0.1:3104/api';
const TENANT = 't_demo';

async function main() {
  const r = await fetch(`${BASE}/ops/video-automation/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT }),
  });
  const j = await r.json();
  const stages = j?.data?.stages || {};
  const analyze = stages.analyze;
  console.log('analyze present:', !!analyze);
  console.log('analyze ok:', analyze?.ok);
  console.log('analyze detail:', JSON.stringify(analyze?.detail, null, 2));
  const ids = analyze?.detail?.analysisTaskIds || [];
  console.log('analyze produced real taskIds:', ids.length ? JSON.stringify(ids) : 'NONE (degraded)');
}
main().catch((e) => { console.error('PROOF_ERR', e); process.exit(1); });
