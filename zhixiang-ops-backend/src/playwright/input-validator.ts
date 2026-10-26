/**
 * AI 自动化输入验证器
 * 对所有浏览器操作输入进行验证和清理，防止注入攻击和异常行为
 */

import { Logger } from '../shared/logger';

const logger = Logger.getInstance();

/**
 * 验证 URL 格式
 */
export function validateUrl(url: string): { valid: boolean; error?: string; cleanUrl?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  const trimmed = url.trim();

  // 检查协议
  if (!/(^https?:\/\/)/i.test(trimmed)) {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }

  // 基本格式验证
  try {
    new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // 防止注入恶意字符
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'URL contains dangerous patterns' };
    }
  }

  return { valid: true, cleanUrl: trimmed };
}

/**
 * 验证 CSS/XPath 选择器
 */
export function validateSelector(selector: string): {
  valid: boolean;
  error?: string;
  cleanSelector?: string;
} {
  if (!selector || selector.trim().length === 0) {
    return { valid: false, error: 'Selector cannot be empty' };
  }

  const trimmed = selector.trim();
  const length = trimmed.length;

  // 选择器长度限制 (防止极长的选择器)
  if (length > 500) {
    return { valid: false, error: 'Selector too long (max 500 characters)' };
  }

  // 防止注入恶意内容
  const dangerousPatterns = [
    /javascript:/i,
    /expression\s*\(/i,
    /behavior\s*:/i,
    /--\s*javascript:/i,
    /on\w+\s*=/i,
    /<[^>]+>/i, // HTML 标签
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      logger.warn('Selector contains dangerous pattern', { selector: trimmed.substring(0, 100) });
      return { valid: false, error: 'Selector contains dangerous patterns' };
    }
  }

  // 验证选择器语法基本结构
  // 应以 . # 或元素名称开头
  const firstChar = trimmed[0];
  if (!/[\w#.[]/.test(firstChar)) {
    return { valid: false, error: 'Selector should start with #, ., or element name' };
  }

  return { valid: true, cleanSelector: trimmed };
}

/**
 * 验证指令负载
 */
export function validatePayload(payload: string): {
  valid: boolean;
  error?: string;
  cleanPayload?: string;
} {
  if (!payload || payload.trim().length === 0) {
    return { valid: false, error: 'Payload cannot be empty' };
  }

  const trimmed = payload.trim();

  // 长度限制
  if (trimmed.length > 10000) {
    return { valid: false, error: 'Payload too long (max 10000 characters)' };
  }

  // 防止大规模注入
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /expression\s*\(/gi,
    /eval\s*\(/gi,
    /document\.write/gi,
    /innerHTML\s*=/gi,
    /outerHTML\s*=/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      logger.warn('Payload contains dangerous pattern', { payload: trimmed.substring(0, 200) });
      return { valid: false, error: 'Payload contains dangerous patterns' };
    }
  }

  return { valid: true, cleanPayload: trimmed };
}

/**
 * 清理和规范化文本输入
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';

  // 移除 HTML 标签
  const cleaned = text.replace(/<[^>]+>/g, '');

  // 转义常见特殊字符（HTML 实体）
  const escaped = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 限制长度 (防止缓冲区溢出)
  const maxLength = 10000;
  return escaped.substring(0, maxLength);
}

/**
 * 验证浏览器操作参数的组合验证器
 */
export interface BrowserOperationValidation {
  url?: string;
  selector?: string;
  payload?: string;
  text?: string; // 将被 sanitizeText 处理
}

/**
 * 完整的浏览器操作验证
 */
export function validateBrowserOperation(validation: BrowserOperationValidation): {
  valid: boolean;
  errors: string[];
  cleanValidation: BrowserOperationValidation;
} {
  const errors: string[] = [];
  const clean: BrowserOperationValidation = {};

  // 字段 → 校验器（数据驱动，避免逐字段 if 分支堆叠）
  const fieldValidators: Array<{
    key: keyof BrowserOperationValidation;
    validate: (v: string) => { valid: boolean; error?: string; clean?: string };
    label: string;
  }> = [
    { key: 'url', validate: validateUrl, label: 'URL' },
    { key: 'selector', validate: validateSelector, label: 'Selector' },
    { key: 'payload', validate: validatePayload, label: 'Payload' },
  ];

  for (const { key, validate, label } of fieldValidators) {
    const value = validation[key];
    if (!value) {
      // 空值原样透传（保持调用方结构稳定）
      clean[key] = value;
      continue;
    }
    const result = validate(value);
    if (result.valid) {
      clean[key] = result.clean || value;
    } else {
      errors.push(result.error || `${label} validation failed`);
    }
  }

  // text 字段仅做净化（不校验）
  if (validation.text !== undefined) {
    clean.text = sanitizeText(validation.text);
  }

  return {
    valid: errors.length === 0,
    errors,
    cleanValidation: clean,
  };
}
