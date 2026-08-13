/// <reference types="vite/client" />

// 全局运行期环境变量（dev 默认从 .env 读取）
interface ImportMetaEnv {
  readonly VITE_TENANT_ID?: string
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Vue 单文件组件类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
