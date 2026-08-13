<template>
  <div class="page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">P · 合规预检</h1>
        <p class="page-subtitle">文本预检（极限词/广告法）、违禁词库治理、预检日志复盘</p>
      </div>
    </div>

    <!-- 功能说明 -->
    <div class="card info-bar">
      <el-icon color="var(--app-brand-500)" :size="16"><Warning /></el-icon>
      <span>预检结果供 F 脚本 / H 成片 / I 发布 / K 直播 / AA 客服 复用，命中即拦截或告警。</span>
    </div>

    <el-tabs v-model="tab">
      <!-- 文本预检 -->
      <el-tab-pane label="文本预检" name="check">
        <div class="card">
          <div class="toolbar">
            <el-select v-model="checkScene" style="width:160px">
              <el-option label="脚本 script" value="script" />
              <el-option label="发布 publish" value="publish" />
              <el-option label="直播 live" value="live" />
              <el-option label="客服 aa" value="aa" />
              <el-option label="审核 review" value="review" />
            </el-select>
            <el-button type="primary" @click="runCheck">预检</el-button>
          </div>
          <el-input v-model="checkInput" type="textarea" :rows="4" placeholder="输入待预检文本（如脚本/标题/口播文案）" />
          <el-alert v-if="checkResult" class="result" :type="resultType" :closable="false" show-icon>
            <template #title>
              处置：{{ checkResult.result }} ｜ 最高风险：{{ checkResult.level }} ｜ 风险评分：{{ checkResult.score }}
            </template>
            <div v-if="checkResult.hits.length">
              命中词：
              <el-tag v-for="h in checkResult.hits" :key="h.position" :type="levelType(h.level)" size="small" class="perm-tag">
                {{ h.word }}（{{ h.level }}@{{ h.position }}）
              </el-tag>
            </div>
            <div v-else class="muted">未命中违禁词，通过。</div>
          </el-alert>
        </div>
      </el-tab-pane>

      <!-- 违禁词库 -->
      <el-tab-pane label="违禁词库" name="words">
        <div class="card">
          <div class="toolbar">
            <el-button type="primary" @click="wordDialog=true; wordForm={word:'',category:'',level:'high',action:'block',enabled:true}">+ 新增违禁词</el-button>
          </div>
          <el-table :data="words" v-loading="wordLoading" stripe>
            <el-table-column prop="word" label="词" min-width="120" />
            <el-table-column prop="category" label="分类" width="120" />
            <el-table-column prop="level" label="级别" width="100">
              <template #default="{ row }"><el-tag :type="levelType(row.level)" size="small">{{ row.level }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="action" label="处置" width="100">
              <template #default="{ row }"><el-tag :type="actionType(row.action)" size="small">{{ row.action }}</el-tag></template>
            </el-table-column>
            <el-table-column label="启用" width="80">
              <template #default="{ row }"><el-tag :type="row.enabled?'success':'info'" size="small">{{ row.enabled?'是':'否' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openEditWord(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="onDeleteWord(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!wordLoading && !words.length" description="暂无违禁词" />
          <div class="table-pagination" v-if="wordTotal > 0">
            <el-pagination layout="total, prev, pager, next" :total="wordTotal" :page-size="wordPageSize" :current-page="wordPage" @current-change="(p:number)=>{wordPage=p;loadWords()}" />
          </div>
        </div>
      </el-tab-pane>

      <!-- 预检日志 -->
      <el-tab-pane label="预检日志" name="logs">
        <div class="card">
          <div class="toolbar">
            <el-select v-model="logFilter.scene" clearable placeholder="场景" style="width:140px">
              <el-option label="script" value="script" />
              <el-option label="publish" value="publish" />
              <el-option label="live" value="live" />
              <el-option label="aa" value="aa" />
              <el-option label="review" value="review" />
            </el-select>
            <el-select v-model="logFilter.result" clearable placeholder="处置" style="width:120px">
              <el-option label="pass" value="pass" />
              <el-option label="warn" value="warn" />
              <el-option label="block" value="block" />
            </el-select>
            <el-button type="primary" @click="loadLogs">查询</el-button>
          </div>
          <el-table :data="logs" v-loading="logLoading" stripe>
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatTs(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="scene" label="场景" width="100" />
            <el-table-column prop="text" label="文本" min-width="200" show-overflow-tooltip />
            <el-table-column prop="level" label="级别" width="100">
              <template #default="{ row }"><el-tag :type="levelType(row.level)" size="small">{{ row.level }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="score" label="评分" width="80" />
            <el-table-column prop="result" label="处置" width="100">
              <template #default="{ row }"><el-tag :type="actionType(row.result)" size="small">{{ row.result }}</el-tag></template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!logLoading && !logs.length" description="无预检日志" />
          <div class="table-pagination" v-if="logTotal > 0">
            <el-pagination layout="total, prev, pager, next" :total="logTotal" :page-size="logPageSize" :current-page="logPage" @current-change="(p:number)=>{logPage=p;loadLogs()}" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 违禁词 新建/编辑 -->
    <el-dialog v-model="wordDialog" :title="wordForm.id?'编辑违禁词':'新增违禁词'" width="480px">
      <el-form :model="wordForm" label-width="80px">
        <el-form-item label="词"><el-input v-model="wordForm.word" :disabled="!!wordForm.id" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="wordForm.category" /></el-form-item>
        <el-form-item label="级别">
          <el-select v-model="wordForm.level" style="width:100%">
            <el-option label="low" value="low" />
            <el-option label="medium" value="medium" />
            <el-option label="high" value="high" />
          </el-select>
        </el-form-item>
        <el-form-item label="处置">
          <el-select v-model="wordForm.action" style="width:100%">
            <el-option label="pass" value="pass" />
            <el-option label="warn" value="warn" />
            <el-option label="block" value="block" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="wordForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wordDialog=false">取消</el-button>
        <el-button type="primary" @click="submitWord">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import {
  checkText, queryWords, addWord, updateWord, removeWord, queryLogs,
  type ComplianceCheckResult, type ComplianceWord, type ComplianceLog,
  type ComplianceWordLevel, type ComplianceWordAction,
} from '@/api/compliance'

const tab = ref<'check' | 'words' | 'logs'>('check')

// 文本预检
const checkScene = ref('script')
const checkInput = ref('')
const checkResult = ref<ComplianceCheckResult | null>(null)
const resultType = ref<'success' | 'warning' | 'error'>('success')
async function runCheck() {
  if (!checkInput.value) { ElMessage.warning('请输入待预检文本'); return }
  try {
    const r = await checkText(checkInput.value, checkScene.value)
    checkResult.value = r
    resultType.value = r.result === 'block' ? 'error' : r.result === 'warn' ? 'warning' : 'success'
  } catch { /* */ }
}

// 违禁词库
const words = ref<ComplianceWord[]>([])
const wordLoading = ref(false)
const wordPage = ref(1)
const wordPageSize = ref(10)
const wordTotal = ref(0)
async function loadWords() {
  wordLoading.value = true
  try { const res = await queryWords({ page: wordPage.value, pageSize: wordPageSize.value }); words.value = res.list; wordTotal.value = res.total } catch { /* */ } finally { wordLoading.value = false }
}
const wordDialog = ref(false)
const wordForm = ref<{ id?: number; word: string; category: string; level: ComplianceWordLevel; action: ComplianceWordAction; enabled: boolean }>({ word: '', category: '', level: 'high', action: 'block', enabled: true })
function openEditWord(row: ComplianceWord) { wordForm.value = { id: row.id, word: row.word, category: row.category, level: row.level, action: row.action, enabled: row.enabled }; wordDialog.value = true }
async function submitWord() {
  try {
    if (wordForm.value.id) {
      await updateWord(wordForm.value.id, { category: wordForm.value.category, level: wordForm.value.level, action: wordForm.value.action, enabled: wordForm.value.enabled })
      ElMessage.success('已更新')
    } else {
      if (!wordForm.value.word) { ElMessage.warning('请填写词'); return }
      await addWord({ word: wordForm.value.word, category: wordForm.value.category, level: wordForm.value.level, action: wordForm.value.action, enabled: wordForm.value.enabled })
      ElMessage.success('已新增')
    }
    wordDialog.value = false; loadWords()
  } catch { /* */ }
}
async function onDeleteWord(row: ComplianceWord) {
  try { await ElMessageBox.confirm(`确认删除违禁词「${row.word}」？`, '删除确认', { type: 'warning' }) } catch { return }
  try { await removeWord(row.id); ElMessage.success('已删除'); loadWords() } catch { /* */ }
}

// 预检日志
const logs = ref<ComplianceLog[]>([])
const logLoading = ref(false)
const logPage = ref(1)
const logPageSize = ref(10)
const logTotal = ref(0)
const logFilter = ref<{ scene: string; result: string }>({ scene: '', result: '' })
async function loadLogs() {
  logLoading.value = true
  try {
    const res = await queryLogs({ page: logPage.value, pageSize: logPageSize.value, scene: logFilter.value.scene || undefined, result: logFilter.value.result || undefined })
    logs.value = res.list; logTotal.value = res.total
  } catch { /* */ } finally { logLoading.value = false }
}

function levelType(l?: string): 'success' | 'info' | 'warning' | 'danger' {
  if (l === 'high') return 'danger'
  if (l === 'medium') return 'warning'
  if (l === 'low') return 'info'
  return 'success'
}
function actionType(a?: string): 'success' | 'info' | 'warning' | 'danger' {
  if (a === 'block') return 'danger'
  if (a === 'warn') return 'warning'
  if (a === 'pass') return 'success'
  return 'info'
}
function formatTs(ts: string): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

onMounted(() => { loadWords(); loadLogs() })
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }
.info-bar {
  margin-bottom: var(--space-md);
  padding: var(--space-3) var(--space-4);
  background: var(--app-brand-50);
  border: 1px solid var(--app-brand-100);
  display: flex; align-items: flex-start; gap: var(--space-2);
  font-size: var(--text-base-sm);
  color: var(--app-brand-700);
  border-radius: var(--radius-lg);
}
.toolbar { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); flex-wrap: wrap; }
.result { margin-top: var(--space-3); }
.perm-tag { margin: 2px 4px 2px 0; }
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
.muted { color: var(--el-text-color-secondary); font-size: var(--text-sm); }
</style>
