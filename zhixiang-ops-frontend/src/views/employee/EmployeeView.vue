<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">员工管理</h2>
        <p class="page-sub">
          管理运营系统操作员账号（登录账号），支持启用/禁用与 RBAC 角色绑定。
        </p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增员工</el-button>
    </div>

    <div class="info-bar">
      <el-table :data="list" v-loading="loading" style="width: 100%">
        <el-table-column prop="username" label="账号" min-width="140" />
        <el-table-column prop="realName" label="姓名" min-width="120" />
        <el-table-column label="主角色" width="110">
          <template #default="{ row }">
            <el-tag>{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="RBAC 角色" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="r in row.roles"
              :key="r.id"
              class="role-tag"
              size="small"
              type="info"
            >{{ r.name }}</el-tag>
            <span v-if="!row.roles?.length" class="muted">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              @change="(v: any) => toggleStatus(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" @click="openRoles(row)">角色</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="total > pageSize">
        <el-pagination
          background
          layout="prev,pager,next"
          :total="total"
          :page-size="pageSize"
          v-model:current-page="page"
          @current-change="load"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑员工' : '新增员工'" width="460px">
      <el-form :model="form" label-width="88px">
        <el-form-item label="账号" required>
          <el-input v-model="form.username" :disabled="editing" placeholder="登录账号（3-64 位）" />
        </el-form-item>
        <el-form-item :label="editing ? '重置密码' : '密码'" required>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="editing ? '留空则不修改' : '6-64 位'"
          />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.realName" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="主角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.statusOn" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="roleDialog" title="RBAC 角色绑定" width="480px">
      <div v-if="currentEmp">
        <div class="role-current">
          <span class="role-current-label">当前角色：</span>
          <el-tag
            v-for="r in currentEmp.roles"
            :key="r.id"
            class="role-tag"
            closable
            @close="unassign(r)"
          >{{ r.name }}</el-tag>
          <span v-if="!currentEmp.roles?.length" class="muted">未绑定</span>
        </div>
        <el-divider>添加角色</el-divider>
        <el-select v-model="pendingRole" placeholder="选择角色" style="width: 100%">
          <el-option
            v-for="r in roleOptions"
            :key="r.id"
            :label="r.name"
            :value="r.id"
            :disabled="currentEmp.roles?.some((x) => x.id === r.id)"
          />
        </el-select>
        <el-button
          type="primary"
          style="margin-top: 12px"
          :disabled="!pendingRole"
          @click="assign"
        >添加</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listRoleOptions,
  assignEmployeeRole,
  unassignEmployeeRole,
  getEmployeeRoles,
  type Employee,
  type RoleOption,
  type RoleBasic,
} from '@/api/employee'

const list = ref<Employee[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const roleOptions = ref<RoleOption[]>([])

const dialogVisible = ref(false)
const editing = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ username: '', password: '', realName: '', role: 'editor', statusOn: true })

const roleDialog = ref(false)
const currentEmp = ref<Employee | null>(null)
const pendingRole = ref<number | null>(null)

const ROLE_LABEL: Record<string, string> = { admin: '管理员', editor: '编辑', viewer: '访客' }
const roleLabel = (r: string) => ROLE_LABEL[r] || r

async function load() {
  loading.value = true
  try {
    const res = await listEmployees({ page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}
async function loadRoles() {
  roleOptions.value = await listRoleOptions()
}

function openCreate() {
  Object.assign(form, { username: '', password: '', realName: '', role: 'editor', statusOn: true })
  editing.value = false
  editingId.value = null
  dialogVisible.value = true
}
function openEdit(row: Employee) {
  Object.assign(form, {
    username: row.username,
    password: '',
    realName: row.realName || '',
    role: row.role,
    statusOn: row.status === 1,
  })
  editing.value = true
  editingId.value = row.id
  dialogVisible.value = true
}
async function handleSave() {
  if (!form.username) {
    ElMessage.warning('请填写账号')
    return
  }
  if (!editing.value && !form.password) {
    ElMessage.warning('请填写密码')
    return
  }
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      realName: form.realName || undefined,
      role: form.role,
      status: form.statusOn ? 1 : 0,
    }
    if (form.password) payload.password = form.password
    if (editing.value && editingId.value) {
      await updateEmployee(editingId.value, payload as any)
      ElMessage.success('已更新')
    } else {
      await createEmployee({ username: form.username, password: form.password, ...(payload as any) })
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}
async function toggleStatus(row: Employee, v: boolean) {
  await updateEmployee(row.id, { status: v ? 1 : 0 })
  row.status = v ? 1 : 0
  ElMessage.success('已更新状态')
}
async function handleDelete(row: Employee) {
  await ElMessageBox.confirm(`确认删除员工「${row.username}」？`, '提示', { type: 'warning' })
  await deleteEmployee(row.id)
  ElMessage.success('已删除')
  await load()
}
function openRoles(row: Employee) {
  currentEmp.value = row
  pendingRole.value = null
  roleDialog.value = true
}
async function assign() {
  if (!currentEmp.value || !pendingRole.value) return
  await assignEmployeeRole(currentEmp.value.id, pendingRole.value)
  await refreshCurrentRoles()
  pendingRole.value = null
  ElMessage.success('已绑定')
}
async function unassign(r: RoleBasic) {
  if (!currentEmp.value) return
  await unassignEmployeeRole(currentEmp.value.id, r.id)
  await refreshCurrentRoles()
}
async function refreshCurrentRoles() {
  if (!currentEmp.value) return
  const { roles } = await getEmployeeRoles(currentEmp.value.id)
  currentEmp.value = { ...currentEmp.value, roles }
}

onMounted(() => {
  load()
  loadRoles()
})
</script>

<style scoped>
.page-container {
  padding: 20px;
  background: var(--app-bg, #f5f6f8);
  min-height: 100vh;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--app-text, #1f2329);
}
.page-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--app-text-secondary, #8a8f99);
  max-width: 720px;
}
.info-bar {
  background: #fff;
  border-radius: 12px;
  padding: 8px 16px 16px;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
.muted {
  color: var(--app-text-secondary, #8a8f99);
}
.role-tag {
  margin-right: 6px;
}
.role-current-label {
  color: var(--app-text-secondary, #8a8f99);
  margin-right: 4px;
}
</style>
