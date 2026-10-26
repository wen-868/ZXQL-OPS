// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist', 'node_modules', 'coverage', 'scripts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  security.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // no-unsafe-*（type-checked 系）：存量 `any` 传播已大规模收敛（78 → 1 处），
      // 剩余多为第三方无类型返回值与 jest mock 的固有形态。维持 warn 持续收敛，
      // 不作为合并阻断；新增代码应按「unknown + 类型守卫」编写（见 playwright/err-msg.ts）。
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      // HttpStatus 是数字枚举，与 number 比较（status >= 500 等）是 NestJS 惯用写法，
      // 该规则对数字枚举比对过于严苛，关闭以免误报。
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      // 允许用 _ 前缀显式标记"故意未使用"的参数/变量/catch 错误
      // （与 TypeScript 编译器 noUnusedParameters 的 _ 前缀忽略行为对齐）
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // 复杂度门禁：单函数 ≤8（warn 级，避免阻塞在存量 64 处遗留热点上；
      // 前端为 error 级硬门禁，后端以 warn 呈现，配合复杂度报告持续治理）。
      complexity: ['warn', { max: 8 }],
      // eslint-plugin-security 的 detect-object-injection 对所有"动态键读取"一律报警，
      // 本项目惯用法均为只读查找且带安全回退（process.env、ROLE_ALIAS/rank 封闭映射、
      // 数字 key 定时器、pino 动态方法），无原型污染写入路径；整体关闭避免大量无意义豁免。
      'security/detect-object-injection': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // 测试文件大量使用 `as any` mock 依赖、async 无 await 的 mock 函数、
    // jest.spyOn 拆解方法引用，均属测试惯用法；豁免相关规则避免无法落地的噪声。
    files: ['**/*.spec.ts', '**/test-utils/**'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
