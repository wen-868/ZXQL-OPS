/** 从对象上提取 message 字符串（不存在/非字符串时返回 null） */
function objectMessage(err: object): string | null {
  if (!('message' in err)) return null;
  const m = (err as { message?: unknown }).message;
  return typeof m === 'string' ? m : null;
}

/** 安全序列化（循环引用/ BigInt 等场景回落） */
function safeStringify(err: unknown): string {
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return '未知错误';
  }
}

/**
 * 异常信息提取（类型安全）。
 * catch 变量声明为 unknown 时无法直接读 .message；本工具统一做窄化，
 * 兼容「throw 非 Error」的情况（字符串/对象/null），保证错误信息可读且不抛二次异常。
 */
export function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    return objectMessage(err) ?? safeStringify(err);
  }
  return safeStringify(err);
}

/** 取原始错误对象（供需要区分类型的调用方；非 Error 返回 undefined） */
export function asError(err: unknown): Error | undefined {
  return err instanceof Error ? err : undefined;
}
