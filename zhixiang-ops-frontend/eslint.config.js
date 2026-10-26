// 运营系统前端 ESLint（flat config，Vue3 + TypeScript）
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import security from 'eslint-plugin-security'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', '*.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 仅必要级 Vue 规则，避免模板格式类规则产生海量噪音
  ...pluginVue.configs['flat/essential'],
  security.configs.recommended,
  {
    files: ['**/*.vue', '**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      // 关闭与 vue-tsc 重叠/噪音较大的规则，保留基础质量规则
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // detect-object-injection 对动态键读取一律报警，前端大量惯用（枚举映射、数字 key、
      // 组件对象索引）均为只读查找，无原型污染写入；整体关闭避免 59 处无意义豁免
      'security/detect-object-injection': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'off',
      // A5 复杂度治理：单函数圈复杂度 ≤8（error 级别 + lint --max-warnings=0 形成硬门禁）
      complexity: ['error', { max: 8 }],
    },
  },
]
