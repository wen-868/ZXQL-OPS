/**
 * 指令解析模块
 * 负责将人类可读的指令字符串解析为结构化的指令对象
 * 支持的指令类型：navigate, click, input, wait, screenshot
 * 内置智能解析、别名映射和验证逻辑
 */

export enum InstructionType {
  Navigate = 'navigate',
  Click = 'click',
  Input = 'input',
  Wait = 'wait',
  Screenshot = 'screenshot',
}

/**
 * 指令对象
 */
export interface Instruction {
  type: InstructionType;
  payload: string;
  timeout?: number; // 可选的超时时间(毫秒)
}

/** 带前缀指令（`<prefix> <arg>`）通用解析；arg 为空时抛指定错误 */
function parseArgDirective(
  normalized: string,
  prefixes: RegExp,
  build: (arg: string) => Instruction,
  emptyError: string,
): Instruction {
  // 先去掉指令名（裸命令如 "navigate" 无空白可去，结果为原串）
  const rest = normalized.replace(prefixes, '');
  // 裸命令（去掉指令名后无剩余内容）时 rest 仍等于指令名本身 → 视为缺参
  const arg = rest.trim();
  const isBareCommand = arg === normalized;
  if (!arg || isBareCommand) throw new Error(emptyError);
  return build(arg);
}

/** input 指令：`selector:text` 拆分与校验 */
function parseInputDirective(normalized: string): Instruction {
  const content = normalized.replace(/^(input|输入)\s+/i, '').trim();
  const colonIndex = content.indexOf(':');
  if (colonIndex === -1) {
    throw new Error('input 指令格式应为 "input selector:text"');
  }
  const selector = content.substring(0, colonIndex).trim();
  const text = content.substring(colonIndex + 1).trim();
  if (!selector) throw new Error('input 指令需要提供选择器');
  if (!text) throw new Error('input 指令需要提供文本内容');
  return { type: InstructionType.Input, payload: `input ${selector}:${text}` };
}

/** wait 指令：时长解析（数字/秒/毫秒/中文单位），夹取 100ms~300s */
function parseWaitDirective(normalized: string): Instruction {
  // 去掉指令名后剩余即时长串（锚定替换，无嵌套量词，避免 ReDoS 告警）
  const durationStr = normalized.replace(/^(?:wait|等待)/i, '').replace(/\s+/g, '') || '1000';

  const cleaned = durationStr.toLowerCase();
  // 先判长后缀，避免 "ms"/"毫秒" 被 "s"/"秒" 分支抢先吞掉
  let ms: number;
  if (cleaned.endsWith('ms') || cleaned.endsWith('毫秒')) {
    ms = parseFloat(cleaned);
  } else if (cleaned.endsWith('s') || cleaned.endsWith('秒')) {
    ms = parseFloat(cleaned) * 1000;
  } else {
    ms = parseInt(cleaned, 10);
  }
  if (!Number.isFinite(ms)) ms = 1000; // 非法数值回落默认

  const safeMs = Math.max(100, Math.min(ms, 300000)); // 1秒到5分钟
  return { type: InstructionType.Wait, payload: `wait ${safeMs}`, timeout: safeMs };
}

/** 指令解析器表：每类指令一个纯函数（含各自参数校验），顺序即匹配优先级 */
const DIRECTIVE_PARSERS: Array<{
  match: (n: string) => boolean;
  parse: (n: string) => Instruction;
}> = [
  {
    match: (n) => n.startsWith('navigate ') || n.startsWith('go ') || n === 'navigate',
    parse: (n) =>
      parseArgDirective(
        n,
        /^(navigate|go)\s+/i,
        (url) => ({
          type: InstructionType.Navigate,
          payload: `navigate ${url}`,
        }),
        'navigate 指令需要提供 URL',
      ),
  },
  {
    match: (n) => n.startsWith('click ') || n.startsWith('点击 ') || n === 'click',
    parse: (n) =>
      parseArgDirective(
        n,
        /^(click|点击)\s+/i,
        (selector) => ({
          type: InstructionType.Click,
          payload: `click ${selector}`,
        }),
        'click 指令需要提供选择器',
      ),
  },
  { match: (n) => n.startsWith('input ') || n.startsWith('输入 '), parse: parseInputDirective },
  { match: (n) => n.startsWith('wait') || n.startsWith('等待'), parse: parseWaitDirective },
  {
    match: (n) => n === 'screenshot' || n === '截图',
    parse: () => ({ type: InstructionType.Screenshot, payload: 'screenshot' }),
  },
];

/**
 * 解析指令字符串为 Instruction 对象。
 * 主流程只做「归一化 → 查表分发」，单函数圈复杂度由 26 降至 ~3。
 *
 * @param input - 原始指令字符串
 * @returns 解析后的 Instruction 对象，解析失败抛出错误
 */
export function parseInstruction(input: string): Instruction {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('指令不能为空');
  }

  const normalized = trimmed.replace(/\s+/g, ' ').trim();
  for (const { match, parse } of DIRECTIVE_PARSERS) {
    if (match(normalized)) return parse(normalized);
  }

  throw new Error(
    `未知的指令格式: "${trimmed}"。支持的格式: navigate URL, click SELECTOR, input SELECTOR:TEXT, wait MS, screenshot`,
  );
}

/**
 * 别名映射
 * 便于用户使用不同的命令格式
 */
export const InstructionAliases: Record<string, string> = {
  go: 'navigate',
  open: 'navigate',
  点击: 'click',
  输入: 'input',
  等待: 'wait',
  截图: 'screenshot',
  w: 'wait',
  c: 'click',
  i: 'input',
};

/** 各指令类型的 payload 前缀规则（数据驱动，替代 switch 分支） */
const INSTRUCTION_PAYLOAD_RULES: Record<InstructionType, (payload: string) => boolean> = {
  [InstructionType.Navigate]: (p) => p.startsWith('navigate '),
  [InstructionType.Click]: (p) => p.startsWith('click '),
  [InstructionType.Input]: (p) => p.startsWith('input '),
  [InstructionType.Wait]: (p) => p.startsWith('wait '),
  [InstructionType.Screenshot]: (p) => p === 'screenshot',
};

/**
 * 验证指令是否有效
 *
 * @param instruction - 要验证的指令对象
 * @returns 验证结果
 */
export function validateInstruction(instruction: Instruction): boolean {
  const rule = INSTRUCTION_PAYLOAD_RULES[instruction.type];
  if (!rule) return false;
  return !!instruction.payload && rule(instruction.payload);
}

/**
 * 将别名转换为标准指令类型
 *
 * @param input - 用户输入的指令（可能包含别名）
 * @returns 标准化的指令对象
 */
export function normalizeInstruction(input: string): Instruction {
  const lower = input.trim().toLowerCase();

  // 检查是否是别名
  for (const [alias, standard] of Object.entries(InstructionAliases)) {
    if (lower.startsWith(alias)) {
      // 移除别名，保留剩余部分
      const remainder = input.trim().substring(alias.length).trim();
      return parseInstruction(`${standard} ${remainder}`);
    }
  }

  // 否则直接解析
  return parseInstruction(input);
}

/**
 * 智能指令补全
 * 当输入不完整时，尝试补全常见指令
 *
 * @param input - 部分输入的指令
 * @returns 补全后的指令或 null
 */
export function smartComplete(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  // 常见的不完整指令模式（仅当前缀本身即整词/输入开头，且后面没有更多内容时才补全）
  const patterns: Record<string, string> = {
    nav: 'navigate ',
    click: 'click ',
    in: 'input ',
    wait: 'wait ',
    sc: 'screenshot',
  };

  for (const [prefix, completion] of Object.entries(patterns)) {
    if (
      trimmed.startsWith(prefix) &&
      trimmed.length === prefix.length && // 仅补全「正好打到前缀」的半截输入
      !trimmed.endsWith(':')
    ) {
      return completion;
    }
  }

  return null;
}
