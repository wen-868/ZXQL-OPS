<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createRoom,
  getRoom,
  startRoom,
  endRoom,
  pushStream,
  getStats,
  reportStat,
  createDigitalHuman,
  danmuAiReply,
  type LiveRoomView,
  type DigitalHumanView,
  type LiveStatView,
  type LiveAiReplyView,
  type LiveRoomType,
  type LiveAiReplyStatus,
} from '@/api/live'
import { formatDateTime, formatAmount } from '@/utils/format'
import {
  roomTypeMeta,
  roomTypeOptions,
  roomStatusMeta,
  aiReplyStatusOptions,
  aiReplyStatusLabels,
} from './liveMaps'

// 注意：后端【无】rooms / digital-humans 的列表(GET 列表)端点，也无 GET 所有数字接口；
//       用本地数组维护本会话创建出来的直播间/数字人（create 后 push 进本地 ref）。
//       可对单个房间调用 getRoom / getStats / start / end / push / reportStat。

const activeTab = ref<'rooms' | 'digital' | 'danmu'>('rooms')

// ============ Tab 1. 直播间 ============
const rooms = ref<LiveRoomView[]>([])
const roomsLoading = ref(false)

// 创建直播间弹窗
const createDialog = ref(false)
const createSubmitting = ref(false)
const createForm = reactive<{
  type: LiveRoomType | undefined
  platform: string
  accountId: number | undefined
  title: string
  productIds: number[]
}>({
  type: undefined,
  platform: '',
  accountId: undefined,
  title: '',
  productIds: [],
})

function openCreate() {
  createForm.type = undefined
  createForm.platform = ''
  createForm.accountId = undefined
  createForm.title = ''
  createForm.productIds = []
  createDialog.value = true
}

async function confirmCreate() {
  if (!createForm.type) {
    ElMessage.warning('直播间类型必填')
    return
  }
  if (!createForm.platform.trim()) {
    ElMessage.warning('平台必填')
    return
  }
  if (createForm.accountId == null || Number.isNaN(createForm.accountId)) {
    ElMessage.warning('账号 ID 必填（需填真实 B 账号 id）')
    return
  }
  createSubmitting.value = true
  try {
    const room = await createRoom({
      type: createForm.type,
      platform: createForm.platform.trim(),
      accountId: createForm.accountId,
      title: createForm.title.trim() || undefined,
      productIds: createForm.productIds.length ? createForm.productIds : undefined,
    })
    rooms.value.push(room)
    ElMessage.success('直播间已创建')
    createDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    createSubmitting.value = false
  }
}

// 根据 id 更新本地数组中的某条
function patchLocalRoom(room: LiveRoomView) {
  const idx = rooms.value.findIndex((r) => r.id === room.id)
  if (idx >= 0) rooms.value.splice(idx, 1, room)
  else rooms.value.push(room)
}

// 状态机约束：created 才能 start，live 才能 end
async function onStart(row: LiveRoomView) {
  if (row.status !== 'created') return
  roomsLoading.value = true
  try {
    const updated = await startRoom(row.id)
    patchLocalRoom(updated)
    ElMessage.success('已开播')
  } catch {
    // 拦截器已提示
  } finally {
    roomsLoading.value = false
  }
}

async function onEnd(row: LiveRoomView) {
  if (row.status !== 'live') return
  roomsLoading.value = true
  try {
    const updated = await endRoom(row.id)
    patchLocalRoom(updated)
    ElMessage.success('已结束')
  } catch {
    // 拦截器已提示
  } finally {
    roomsLoading.value = false
  }
}

async function onRefresh(row: LiveRoomView) {
  roomsLoading.value = true
  try {
    const updated = await getRoom(row.id)
    patchLocalRoom(updated)
    ElMessage.success(`已刷新：attributionId=${updated.attributionId}`)
  } catch {
    // 拦截器已提示
  } finally {
    roomsLoading.value = false
  }
}

// 推流弹窗
const pushDialog = ref(false)
const pushSubmitting = ref(false)
const pushTarget = ref<LiveRoomView | null>(null)
const pushForm = reactive<{ rtmpUrl: string }>({ rtmpUrl: '' })

function openPush(row: LiveRoomView) {
  pushTarget.value = row
  pushForm.rtmpUrl = ''
  pushDialog.value = true
}

async function confirmPush() {
  if (!pushTarget.value) return
  if (!pushForm.rtmpUrl.trim()) {
    ElMessage.warning('rtmpUrl 必填')
    return
  }
  pushSubmitting.value = true
  try {
    const updated = await pushStream(pushTarget.value.id, pushForm.rtmpUrl.trim())
    patchLocalRoom(updated)
    ElMessage.success('已推流')
    pushDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    pushSubmitting.value = false
  }
}

// 上报统计弹窗
const reportDialog = ref(false)
const reportSubmitting = ref(false)
const reportTarget = ref<LiveRoomView | null>(null)
const reportForm = reactive<{ onlineCount: number | undefined; gmv: number | undefined }>({
  onlineCount: undefined,
  gmv: undefined,
})

function openReport(row: LiveRoomView) {
  reportTarget.value = row
  reportForm.onlineCount = undefined
  reportForm.gmv = undefined
  reportDialog.value = true
}

async function confirmReport() {
  if (!reportTarget.value) return
  reportSubmitting.value = true
  try {
    await reportStat(reportTarget.value.id, {
      onlineCount: reportForm.onlineCount ?? undefined,
      gmv: reportForm.gmv ?? undefined,
    })
    ElMessage.success('统计已上报')
    reportDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    reportSubmitting.value = false
  }
}

// 实时数据（按房间单独查询）
const statMap = ref<Record<number, LiveStatView | null>>({})
const statLoadingMap = ref<Record<number, boolean>>({})

async function refreshStat(row: LiveRoomView) {
  statLoadingMap.value[row.id] = true
  try {
    const stat = await getStats(row.id) // 可能为 null
    statMap.value[row.id] = stat
  } catch {
    // 拦截器已提示
    statMap.value[row.id] = null
  } finally {
    statLoadingMap.value[row.id] = false
  }
}

// ============ Tab 2. 数字人 ============
const digitalHumans = ref<DigitalHumanView[]>([])

const dhDialog = ref(false)
const dhSubmitting = ref(false)
const dhForm = reactive<{
  name: string
  avatar: string
  voice: string
  status: string
}>({
  name: '',
  avatar: '',
  voice: '',
  status: 'active',
})

function openCreateDH() {
  dhForm.name = ''
  dhForm.avatar = ''
  dhForm.voice = ''
  dhForm.status = 'active'
  dhDialog.value = true
}

async function confirmCreateDH() {
  if (!dhForm.name.trim()) {
    ElMessage.warning('名称必填')
    return
  }
  dhSubmitting.value = true
  try {
    const dh = await createDigitalHuman({
      name: dhForm.name.trim(),
      avatar: dhForm.avatar.trim() || undefined,
      voice: dhForm.voice.trim() || undefined,
      status: dhForm.status || undefined,
    })
    digitalHumans.value.push(dh)
    ElMessage.success('数字人已创建')
    dhDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    dhSubmitting.value = false
  }
}

// ============ Tab 3. 弹幕 AI 应答 ============
const danmuForm = reactive<{
  roomId: number | undefined
  question: string
  status: LiveAiReplyStatus
}>({
  roomId: undefined,
  question: '',
  status: 'auto',
})
const danmuSubmitting = ref(false)
const danmuResult = ref<LiveAiReplyView | null>(null)

async function onGenerateReply() {
  if (!danmuForm.roomId) {
    ElMessage.warning('请选择直播间')
    return
  }
  if (!danmuForm.question.trim()) {
    ElMessage.warning('弹幕问题必填')
    return
  }
  danmuSubmitting.value = true
  try {
    danmuResult.value = await danmuAiReply({
      roomId: danmuForm.roomId,
      question: danmuForm.question.trim(),
      status: danmuForm.status,
    })
    ElMessage.success(danmuResult.value.answer ? 'AI 已生成回复' : '已落入待确认')
  } catch {
    // 拦截器已提示
  } finally {
    danmuSubmitting.value = false
  }
}
</script>

<template>
  <section class="live-view" aria-label="K 直播中心">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="K 直播中心：直播间开播/推流/监控、数字人、弹幕 AI 应答；状态机约束 created→live→ended；tenantId 由统一拦截器注入。"
    />
    <el-tabs v-model="activeTab" type="border-card" aria-label="K 直播功能分区">
      <!-- ===== 1. 直播间 ===== -->
      <el-tab-pane name="rooms">
        <template #label><span aria-label="直播间标签页">直播间</span></template>
        <div class="filter-bar" aria-label="直播间操作栏">
          <el-button type="primary" @click="openCreate" aria-label="创建直播间">创建直播间</el-button>
          <span class="tip">说明：后端无列表接口，本页仅维护本会话创建的直播间</span>
        </div>
        <el-table
          :data="rooms"
          border
          v-loading="roomsLoading"
          aria-label="直播间列表"
        >
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag
                size="small"
                :style="{ color: roomTypeMeta[(row as LiveRoomView).type].color, borderColor: roomTypeMeta[(row as LiveRoomView).type].color }"
              >{{ roomTypeMeta[(row as LiveRoomView).type].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="platform" label="平台" width="120" />
          <el-table-column prop="accountId" label="账号ID" width="90" />
          <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="roomStatusMeta[(row as LiveRoomView).status].type">
                {{ roomStatusMeta[(row as LiveRoomView).status].label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="rtmpUrl" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ (row as LiveRoomView).rtmpUrl ?? '-' }}</template>
          </el-table-column>
          <el-table-column prop="attributionId" label="attributionId" min-width="160" show-overflow-tooltip />
          <el-table-column label="商品IDs" min-width="120">
            <template #default="{ row }">
              {{ (row as LiveRoomView).productIds.length ? (row as LiveRoomView).productIds.join(', ') : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime((row as LiveRoomView).createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" min-width="320" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="(row as LiveRoomView).status === 'created'"
                link
                type="success"
                @click="onStart(row as LiveRoomView)"
                :aria-label="`开播 ${(row as LiveRoomView).id}`"
              >开播</el-button>
              <el-button
                v-if="(row as LiveRoomView).status === 'live'"
                link
                type="warning"
                @click="onEnd(row as LiveRoomView)"
                :aria-label="`结束 ${(row as LiveRoomView).id}`"
              >结束</el-button>
              <el-button link type="primary" @click="openPush(row as LiveRoomView)" :aria-label="`推流 ${(row as LiveRoomView).id}`">推流</el-button>
              <el-button link type="info" @click="onRefresh(row as LiveRoomView)" :aria-label="`查看 ${(row as LiveRoomView).id}`">查看</el-button>
              <el-button link type="warning" @click="openReport(row as LiveRoomView)" :aria-label="`上报统计 ${(row as LiveRoomView).id}`">上报统计</el-button>
              <el-button
                link
                type="primary"
                :loading="statLoadingMap[(row as LiveRoomView).id]"
                @click="refreshStat(row as LiveRoomView)"
                :aria-label="`刷新数据 ${(row as LiveRoomView).id}`"
              >刷新数据</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!roomsLoading && !rooms.length" description="暂无直播间，点击「创建直播间」开始" />

        <!-- 实时数据展示 -->
        <div v-for="r in rooms" :key="`stat-${r.id}`" class="stat-block" v-loading="statLoadingMap[r.id]">
          <div class="stat-head">
            <span class="stat-title">直播间 #{{ r.id }} 实时数据</span>
            <el-button size="small" :loading="statLoadingMap[r.id]" @click="refreshStat(r)" aria-label="刷新该直播间数据">刷新数据</el-button>
          </div>
          <el-descriptions :column="4" border size="small" v-if="statMap[r.id]">
            <el-descriptions-item label="在线人数">{{ statMap[r.id]!.onlineCount }}</el-descriptions-item>
            <el-descriptions-item label="GMV">{{ formatAmount(statMap[r.id]!.gmv) }}</el-descriptions-item>
            <el-descriptions-item label="时间戳">{{ formatDateTime(statMap[r.id]!.ts) }}</el-descriptions-item>
            <el-descriptions-item label="attributionId">{{ statMap[r.id]!.attributionId }}</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else :image-size="60" description="暂无数据" />
        </div>
      </el-tab-pane>

      <!-- ===== 2. 数字人 ===== -->
      <el-tab-pane name="digital">
        <template #label><span aria-label="数字人标签页">数字人</span></template>
        <div class="filter-bar" aria-label="数字人操作栏">
          <el-button type="primary" @click="openCreateDH" aria-label="创建数字人">创建数字人</el-button>
        </div>
        <el-table :data="digitalHumans" border aria-label="数字人列表">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column label="头像" width="200">
            <template #default="{ row }">
              <el-image
                v-if="(row as DigitalHumanView).avatar"
                :src="(row as DigitalHumanView).avatar!"
                :preview-src-list="[(row as DigitalHumanView).avatar!]"
                style="width: 48px; height: 48px"
                fit="cover"
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="voice" label="音色" min-width="120" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime((row as DigitalHumanView).createdAt) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!digitalHumans.length" description="暂无数字人，点击「创建数字人」开始" />
      </el-tab-pane>

      <!-- ===== 3. 弹幕 AI 应答 ===== -->
      <el-tab-pane name="danmu">
        <template #label><span aria-label="弹幕AI应答标签页">弹幕 AI 应答</span></template>
        <el-card shadow="never" class="danmu-card">
          <el-form label-width="90px" @submit.prevent>
            <el-form-item label="直播间" required>
              <el-select
                v-model="danmuForm.roomId"
                placeholder="选择直播间"
                filterable
                style="width: 320px"
                aria-label="选择直播间"
              >
                <el-option
                  v-for="r in rooms"
                  :key="r.id"
                  :label="`#${r.id} ${r.title || '(无标题)'}`"
                  :value="r.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="问题" required>
              <el-input
                v-model="danmuForm.question"
                type="textarea"
                :rows="3"
                placeholder="弹幕问题（必填）"
                aria-label="弹幕问题"
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                v-model="danmuForm.status"
                placeholder="自动回复"
                style="width: 200px"
                aria-label="应答状态"
              >
                <el-option v-for="opt in aiReplyStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="danmuSubmitting" @click="onGenerateReply">
                生成回复
              </el-button>
            </el-form-item>
          </el-form>

          <div v-if="danmuResult" class="danmu-result" v-loading="danmuSubmitting">
            <h4 class="sub-title">应答结果</h4>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="直播间ID">{{ danmuResult.roomId }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag size="small">{{ aiReplyStatusLabels[danmuResult.status] }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="问题" :span="2">{{ danmuResult.question }}</el-descriptions-item>
              <el-descriptions-item label="回复" :span="2">
                <span v-if="danmuResult.answer">{{ danmuResult.answer }}</span>
                <el-tag v-else type="warning" size="small">待人工确认（answer 为 null）</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建直播间弹窗 -->
    <el-dialog v-model="createDialog" title="创建直播间" aria-label="创建直播间弹窗" width="520px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="类型" required>
          <el-select v-model="createForm.type" placeholder="选择类型" style="width: 100%" aria-label="直播间类型">
            <el-option v-for="opt in roomTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台" required>
          <el-input v-model="createForm.platform" placeholder="如 douyin / kuaishou" aria-label="直播平台" />
        </el-form-item>
        <el-form-item label="账号ID" required>
          <el-input v-model.number="createForm.accountId" type="number" placeholder="需填真实 B 账号 id" aria-label="直播账号ID" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="createForm.title" placeholder="直播间标题（可选）" aria-label="直播间标题" />
        </el-form-item>
        <el-form-item label="挂载商品">
          <el-select
            v-model="createForm.productIds"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="R 商品 id（可空）"
            style="width: 100%"
            aria-label="挂载商品id"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="confirmCreate">确定创建</el-button>
      </template>
    </el-dialog>

    <!-- 推流弹窗 -->
    <el-dialog v-model="pushDialog" title="推流" aria-label="推流弹窗" width="460px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="直播间">
          <span>{{ pushTarget ? `#${pushTarget.id}` : '-' }}</span>
        </el-form-item>
        <el-form-item label="rtmpUrl" required>
          <el-input v-model="pushForm.rtmpUrl" placeholder="推流地址（必填）" aria-label="推流地址rtmpUrl" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pushDialog = false">取消</el-button>
        <el-button type="primary" :loading="pushSubmitting" @click="confirmPush">确定推流</el-button>
      </template>
    </el-dialog>

    <!-- 上报统计弹窗 -->
    <el-dialog v-model="reportDialog" title="上报统计" aria-label="上报统计弹窗" width="460px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="直播间">
          <span>{{ reportTarget ? `#${reportTarget.id}` : '-' }}</span>
        </el-form-item>
        <el-form-item label="在线人数">
          <el-input v-model.number="reportForm.onlineCount" type="number" placeholder="≥0，默认 0" aria-label="在线人数" />
        </el-form-item>
        <el-form-item label="GMV">
          <el-input v-model.number="reportForm.gmv" type="number" placeholder="≥0，默认 0" aria-label="GMV" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reportDialog = false">取消</el-button>
        <el-button type="primary" :loading="reportSubmitting" @click="confirmReport">确定上报</el-button>
      </template>
    </el-dialog>

    <!-- 创建数字人弹窗 -->
    <el-dialog v-model="dhDialog" title="创建数字人" aria-label="创建数字人弹窗" width="520px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="名称" required>
          <el-input v-model="dhForm.name" placeholder="数字人名称（必填）" aria-label="数字人名称" />
        </el-form-item>
        <el-form-item label="头像">
          <el-input v-model="dhForm.avatar" placeholder="头像 URL（可选）" aria-label="数字人头像" />
        </el-form-item>
        <el-form-item label="音色">
          <el-input v-model="dhForm.voice" placeholder="音色（可选）" aria-label="数字人音色" />
        </el-form-item>
        <el-form-item label="状态">
          <el-input v-model="dhForm.status" placeholder="默认 active" aria-label="数字人状态" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dhDialog = false">取消</el-button>
        <el-button type="primary" :loading="dhSubmitting" @click="confirmCreateDH">确定创建</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.live-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.compliance-alert {
  margin-bottom: 0;
}
.filter-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
  align-items: center;
}
.tip {
  font-size: var(--text-sm);
  color: var(--el-text-color-secondary);
}
.stat-block {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--app-neutral-50);
  border-radius: var(--radius-lg);
}
.stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
.stat-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.sub-title {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--text-md);
  color: var(--el-text-color-primary);
}
.danmu-card {
  margin-bottom: var(--space-3);
}
.danmu-result {
  margin-top: var(--space-2);
}
</style>
