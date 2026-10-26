<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorkspaceTask } from '@/stores/app'
import { runVideoChain, type VideoChainRunResult } from '@/api/automation'

const props = defineProps<{ task: WorkspaceTask; board: 'video' | 'ecommerce' }>()
const emit = defineEmits<{ confirm: []; reject: []; completed: [] }>()

// 步骤流：与后端视频自动化链阶段映射（intel/analyze 并入选题、material 并入成片；链不含直播段）
const STEPS = ['选题', '脚本', '成片', '分发', '直播', '复盘']
const activeStep = computed(() => props.task.stepIndex)

// ===== 真实链路执行 =====
const running = ref(false)
const runError = ref<string | null>(null)
const runResult = ref<VideoChainRunResult | null>(null)

/** 真实执行结果 → 工具日志行（降级/失败如实呈现） */
function stageLines(result: VideoChainRunResult): Array<{ type: string; text: string }> {
  const order: Array<[string, string, string, string[]]> = [
    ['intel', '情报', '采集任务', ['collectTaskIds']],
    ['analyze', '分析', '分析任务', ['analysisTaskIds']],
    ['topic', '选题', '选题', ['topicIds']],
    ['script', '脚本', '脚本', ['scriptIds']],
    ['material', '素材', '素材', ['materialIds']],
    ['compose', '成片', '成片', ['videoIds']],
    ['publish', '分发', '发布任务', ['publishTaskIds']],
    ['recycle', '复盘', '回收记录', ['recycleTaskIds']],
  ]
  return order.flatMap(([key, label, noun, countKeys]) => {
    const st = result.stages[key]
    if (!st) return []
    if (!st.ok) return [{ type: 'fail', text: `❌ ${label} 失败：${st.error ?? '未知错误'}` }]
    const d = (st.detail ?? {}) as Record<string, unknown>
    const n = countKeys.reduce((acc, k) => acc + (Array.isArray(d[k]) ? (d[k] as unknown[]).length : 0), 0)
    const note = typeof d.note === 'string' && d.note ? `（${d.note}）` : `· ${noun} ${n} 条`
    return [{ type: 'ok', text: `✅ ${label} 完成：${st.strategy} ${note}` }]
  })
}

// 工具日志：执行中为 run 行，完成后为真实结果行
const toollog = computed(() => {
  if (runResult.value) return stageLines(runResult.value)
  if (running.value)
    return [
      { type: 'run', text: '⏳ 正在执行自动化链（采集→分析→选题→脚本→素材→成片→发布→复盘）...' },
    ]
  if (props.task.status === 'pending_confirm')
    return [{ type: 'run', text: '⏳ 等待人工确认，确认后执行真实自动化链...' }]
  return [{ type: 'run', text: '⏳ 正在执行 选题 Agent...' }]
})

// 确认卡展示（真实链路执行前的人工确认）
const showConfirm = computed(
  () => props.task.status === 'pending_confirm' && !resolved.value && !running.value,
)

// 批准后产物卡片网格 / 驳回后红色状态卡
const resolved = ref<'approved' | 'rejected' | null>(null)
// 切换任务时重置执行结果，避免上一任务的状态残留
watch(
  () => props.task.id,
  () => {
    resolved.value = null
    runResult.value = null
    runError.value = null
  },
)

/** 从真实结果提取产物计数 */
function stageCount(result: VideoChainRunResult, stage: string, key: string): number {
  const d = (result.stages[stage]?.detail ?? {}) as Record<string, unknown>
  return Array.isArray(d[key]) ? (d[key] as unknown[]).length : 0
}

// 产物卡：真实链路产物计数（演示数据未命中时如实显示 0）
const products = computed<Array<[string, string]>>(() => {
  const r = runResult.value
  if (!r) return []
  return [
    ['选题', `${stageCount(r, 'topic', 'topicIds')} 条`],
    ['脚本', `${stageCount(r, 'script', 'scriptIds')} 篇`],
    ['成片', `${stageCount(r, 'compose', 'videoIds')} 个`],
    ['分发', `${stageCount(r, 'publish', 'publishTaskIds')} 个`],
    ['复盘', `${stageCount(r, 'recycle', 'recycleTaskIds')} 条`],
  ]
})

async function confirmTask() {
  running.value = true
  runError.value = null
  try {
    const result = await runVideoChain()
    runResult.value = result
    resolved.value = 'approved'
    emit('completed')
    emit('confirm')
  } catch (e) {
    runError.value = e instanceof Error ? e.message : '自动化链执行失败，请稍后重试'
  } finally {
    running.value = false
  }
}

function rejectTask() {
  resolved.value = 'rejected'
  emit('reject')
}
</script>

<template>
  <div class="task-panel">
    <div class="ov-title">任务工作台 · {{ task.title }}</div>
    <div class="steps" aria-label="任务步骤">
      <div
        v-for="(s, i) in STEPS"
        :key="s"
        class="step"
        :class="{ done: i < activeStep, active: i === activeStep }"
      >
        <div class="num">{{ i + 1 }}</div>
        <div class="lbl">{{ s }}</div>
        <div v-if="i < STEPS.length - 1" class="bar" />
      </div>
    </div>

    <div class="toollog" aria-live="polite">
      <div v-for="(line, i) in toollog" :key="i" :class="line.type">
        {{ line.text }}
      </div>
      <div v-if="runError" class="fail">❌ {{ runError }}</div>
    </div>

    <!-- 人工确认卡：确认后执行真实后端自动化链 -->
    <div v-if="showConfirm" class="confirm">
      <h4>人工确认 · 执行任务</h4>
      <p>
        将在本租户执行真实自动化链：采集 → 分析 → 选题 → 脚本 → 素材 → 成片 → 发布 →
        复盘（发布走抖音模拟回执）。确认执行？
      </p>
      <div class="acts">
        <button type="button" class="btn" :disabled="running" @click="rejectTask">驳回</button>
        <button type="button" class="btn primary" :disabled="running" @click="confirmTask">
          {{ running ? '执行中…' : '批准执行' }}
        </button>
      </div>
    </div>

    <!-- 批准后产物卡片网格（真实链路产物计数） -->
    <div v-if="resolved === 'approved' && products.length" class="products">
      <div v-for="[k, v] in products" :key="k" class="prod">
        <span class="pk">{{ k }}</span>
        <span class="pv">{{ v }}</span>
      </div>
    </div>

    <!-- 驳回后红色状态卡（原型：红边红底确认框，标题红字、正文常规色） -->
    <div v-if="resolved === 'rejected'" class="rejected">
      <h4>已驳回</h4>
      <p>任务暂停，等待人工修改后重试。</p>
    </div>
  </div>
</template>

<style scoped>
.ov-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}
.steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 16px 0;
  flex-wrap: wrap;
}
.step {
  display: flex;
  align-items: center;
  gap: 8px;
}
.num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--app-neutral-100);
  border: 1px solid var(--app-neutral-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--app-neutral-400);
}
.step.done .num {
  background: var(--app-success-500);
  color: #06210f;
  border-color: var(--app-success-500);
}
.step.active .num {
  background: var(--app-brand-500);
  color: #fff;
  border-color: var(--app-brand-500);
  box-shadow: 0 0 0 3px var(--app-brand-50);
}
.lbl {
  font-size: 13px;
  color: var(--app-neutral-400);
}
.step.active .lbl {
  color: var(--app-neutral-800);
}
.bar {
  width: 34px;
  height: 2px;
  background: var(--app-neutral-200);
  margin: 0 6px;
}
.step.done .bar {
  background: var(--app-success-500);
}
.toollog {
  background: #eef0f3;
  border: 1px solid var(--app-neutral-200);
  border-radius: 8px;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.9;
  margin-bottom: 14px;
  min-height: 80px;
}
.toollog .run {
  color: var(--app-warning-500);
}
.toollog .ok {
  color: var(--app-success-500);
}
.toollog .fail {
  color: var(--app-danger-500);
}
.confirm {
  background: #fdf6ec;
  border: 1px solid var(--app-warning-500);
  border-radius: 10px;
  padding: 16px;
}
.confirm h4 {
  font-size: 14px;
  color: var(--app-warning-500);
  margin: 0 0 8px;
}
.confirm p {
  font-size: 13px;
  color: var(--app-neutral-800);
  line-height: 1.7;
  margin: 0 0 12px;
}
.acts {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.btn {
  min-width: 88px;
  text-align: center;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--app-neutral-200);
  background: var(--app-neutral-100);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}
.btn.primary {
  background: var(--app-brand-500);
  border-color: var(--app-brand-500);
  color: #fff;
}
.products {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 8px;
}
.prod {
  background: #fff;
  border: 1px solid var(--app-neutral-200);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pk {
  font-size: 12px;
  color: var(--app-neutral-400);
}
.pv {
  font-size: 13px;
  color: var(--app-neutral-800);
}
.rejected {
  background: #fdecec;
  border: 1px solid #f3c2c2;
  border-radius: 10px;
  padding: 16px;
  margin-top: 14px;
}
.rejected h4 {
  font-size: 14px;
  color: var(--app-danger-500);
  margin: 0 0 8px;
}
.rejected p {
  font-size: 13px;
  color: var(--app-neutral-800);
  line-height: 1.7;
  margin: 0;
}
@media (max-width: 900px) {
  .products {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
