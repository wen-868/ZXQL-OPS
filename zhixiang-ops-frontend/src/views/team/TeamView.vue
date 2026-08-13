<template>
  <div class="page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">团队与权限</h1>
        <p class="page-subtitle">角色(RBAC) 与全局操作审计</p>
      </div>
      <el-button type="primary" @click="openCreate">新建角色</el-button>
    </div>

    <el-tabs v-model="tab">
      <!-- 角色管理 -->
      <el-tab-pane label="角色管理" name="role">
        <el-card shadow="never">
          <el-table :data="roles" v-loading="roleLoading" stripe>
            <el-table-column prop="name" label="角色名" min-width="120" />
            <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
            <el-table-column label="权限点" min-width="220">
              <template #default="{ row }">
                <el-tag v-for="p in row.permissions" :key="p" size="small" class="perm-tag">{{ p }}</el-tag>
                <span v-if="!row.permissions || !row.permissions.length" class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="90">
              <template #default="{ row }">
                <el-tag :type="row.isSystem ? 'danger' : 'info'" size="small">
                  {{ row.isSystem ? '系统' : '自定义' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button link type="primary" @click="openAssign(row)">分配</el-button>
                <el-button link type="danger" :disabled="row.isSystem" @click="onDelete(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无角色" />
            </template>
          </el-table>
          <div class="table-pagination">
            <el-pagination
              layout="total, prev, pager, next"
              :total="roleTotal"
              :page-size="rolePageSize"
              :current-page="rolePage"
              @current-change="(p: number) => { rolePage = p; loadRoles() }"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 审计日志 -->
      <el-tab-pane label="操作审计" name="audit">
        <!-- 筛选区 -->
        <el-card shadow="never" class="filter-card">
          <el-form inline @submit.prevent>
            <el-form-item label="模块">
              <el-input v-model="auditFilter.module" placeholder="模块" clearable style="width:150px" />
            </el-form-item>
            <el-form-item label="动作">
              <el-input v-model="auditFilter.action" placeholder="动作" clearable style="width:150px" />
            </el-form-item>
            <el-form-item label="用户ID">
              <el-input v-model="auditFilter.userId" placeholder="用户ID" clearable style="width:120px" />
            </el-form-item>
            <el-form-item>
              <div class="filter-actions">
                <el-button type="primary" @click="loadAudit">查询</el-button>
                <el-button @click="resetAuditFilter">重置</el-button>
              </div>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 表格区 -->
        <el-card shadow="never">
          <el-table :data="audits" v-loading="auditLoading" stripe>
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatTs(row.ts) }}</template>
            </el-table-column>
            <el-table-column prop="module" label="模块" width="120" />
            <el-table-column prop="action" label="动作" width="130" />
            <el-table-column prop="resource" label="资源" min-width="200" show-overflow-tooltip />
            <el-table-column prop="userId" label="用户" width="90" />
            <el-table-column prop="traceId" label="traceId" min-width="200" show-overflow-tooltip />
            <template #empty>
              <el-empty description="暂无审计日志" />
            </template>
          </el-table>
          <div class="table-pagination">
            <el-pagination
              layout="total, prev, pager, next"
              :total="auditTotal"
              :page-size="auditPageSize"
              :current-page="auditPage"
              @current-change="(p: number) => { auditPage = p; loadAudit() }"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 角色 新建 / 编辑 -->
    <el-dialog v-model="roleDialog" :title="roleForm.id ? '编辑角色' : '新建角色'" width="520px">
      <el-form :model="roleForm" label-width="80px">
        <el-form-item label="角色名">
          <el-input v-model="roleForm.name" :disabled="!!roleForm.id && roleForm.isSystem" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="roleForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="权限点">
          <el-select v-model="roleForm.permissions" multiple filterable style="width:100%" placeholder="选择权限点">
            <el-option v-for="p in COMMON_PERMISSIONS" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialog = false">取消</el-button>
        <el-button type="primary" @click="submitRole">保存</el-button>
      </template>
    </el-dialog>

    <!-- 角色分配 -->
    <el-dialog v-model="assignDialog" :title="`分配角色：${assignRoleName}`" width="520px">
      <el-form label-width="80px">
        <el-form-item label="用户ID">
          <el-input v-model="assignUserId" type="number" style="width:200px" />
          <el-button style="margin-left:8px" @click="loadUserRoles">查询该用户</el-button>
        </el-form-item>
        <el-alert
          v-if="userRoles"
          :title="`当前已绑定 ${userRoles.roles.length} 个角色，合并 ${userRoles.permissions.length} 个权限点`"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <div class="muted">角色：<el-tag v-for="r in userRoles.roles" :key="r.id" size="small" class="perm-tag">{{ r.name }}</el-tag></div>
            <div class="muted">权限：<el-tag v-for="p in userRoles.permissions" :key="p" size="small" type="success" class="perm-tag">{{ p }}</el-tag></div>
          </template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
  getUserRoles,
  queryAudit,
  COMMON_PERMISSIONS,
  type RoleView,
  type UserRoleView,
  type AuditLogView,
} from '@/api/team'

const tab = ref<'role' | 'audit'>('role')

// ---------- 角色 ----------
const roles = ref<RoleView[]>([])
const roleLoading = ref(false)
const rolePage = ref(1)
const rolePageSize = ref(10)
const roleTotal = ref(0)

async function loadRoles() {
  roleLoading.value = true
  try {
    const res = await listRoles({ page: rolePage.value, pageSize: rolePageSize.value })
    roles.value = res.list
    roleTotal.value = res.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    roleLoading.value = false
  }
}

const roleDialog = ref(false)
const roleForm = ref<{ id?: number; name: string; description: string; permissions: string[]; isSystem: boolean }>({
  id: undefined,
  name: '',
  description: '',
  permissions: [],
  isSystem: false,
})

function openCreate() {
  roleForm.value = { id: undefined, name: '', description: '', permissions: [], isSystem: false }
  roleDialog.value = true
}
function openEdit(row: RoleView) {
  roleForm.value = {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    permissions: [...(row.permissions ?? [])],
    isSystem: row.isSystem,
  }
  roleDialog.value = true
}
async function submitRole() {
  if (!roleForm.value.name) {
    ElMessage.warning('请填写角色名')
    return
  }
  try {
    if (roleForm.value.id) {
      await updateRole(roleForm.value.id, {
        name: roleForm.value.name,
        description: roleForm.value.description,
        permissions: roleForm.value.permissions,
      })
      ElMessage.success('已更新')
    } else {
      await createRole({
        name: roleForm.value.name,
        description: roleForm.value.description,
        permissions: roleForm.value.permissions,
      })
      ElMessage.success('已创建')
    }
    roleDialog.value = false
    loadRoles()
  } catch {
    /* 拦截器已提示 */
  }
}
async function onDelete(row: RoleView) {
  try {
    await ElMessageBox.confirm(`确认删除角色「${row.name}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteRole(row.id)
    ElMessage.success('已删除')
    loadRoles()
  } catch {
    /* 拦截器已提示 */
  }
}

// ---------- 分配 ----------
const assignDialog = ref(false)
const assignRoleId = ref<number>()
const assignRoleName = ref('')
const assignUserId = ref<string>('')
const userRoles = ref<UserRoleView | null>(null)

function openAssign(row: RoleView) {
  assignRoleId.value = row.id
  assignRoleName.value = row.name
  assignUserId.value = ''
  userRoles.value = null
  assignDialog.value = true
}
async function loadUserRoles() {
  const id = Number(assignUserId.value)
  if (!id) {
    ElMessage.warning('请输入用户ID')
    return
  }
  try {
    userRoles.value = await getUserRoles(id)
  } catch {
    /* 拦截器已提示 */
  }
}
async function submitAssign() {
  const id = Number(assignUserId.value)
  if (!assignRoleId.value || !id) {
    ElMessage.warning('请先查询并确认用户ID')
    return
  }
  try {
    await assignRole(assignRoleId.value, id)
    ElMessage.success('已分配')
    assignDialog.value = false
  } catch {
    /* 拦截器已提示 */
  }
}

// ---------- 审计 ----------
const audits = ref<AuditLogView[]>([])
const auditLoading = ref(false)
const auditPage = ref(1)
const auditPageSize = ref(10)
const auditTotal = ref(0)
const auditFilter = ref<{ module: string; action: string; userId: string }>({
  module: '',
  action: '',
  userId: '',
})

async function loadAudit() {
  auditLoading.value = true
  try {
    const res = await queryAudit({
      page: auditPage.value,
      pageSize: auditPageSize.value,
      module: auditFilter.value.module || undefined,
      action: auditFilter.value.action || undefined,
      userId: auditFilter.value.userId || undefined,
    })
    audits.value = res.list
    auditTotal.value = res.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    auditLoading.value = false
  }
}
function resetAuditFilter() {
  auditFilter.value = { module: '', action: '', userId: '' }
  loadAudit()
}

function formatTs(ts: string): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

onMounted(() => {
  loadRoles()
})
</script>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 筛选区 */
.filter-card { padding: var(--space-lg); margin-bottom: var(--space-md); }
.filter-card .el-form { margin-bottom: 12px; }
.filter-actions { display: flex; gap: var(--space-sm); }

/* 表格分页 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }

/* 标签 */
.perm-tag { margin: 2px 4px 2px 0; }
.muted { color: var(--el-text-color-secondary); font-size: var(--text-sm); }
</style>
