/**
 * 单元测试规格 - InputValidator
 *
 * 测试输入验证器的 URL、选择器和负载验证功能
 */

import {
  validateUrl,
  validateSelector,
  validatePayload,
  sanitizeText,
  validateBrowserOperation,
  BrowserOperationValidation,
} from './input-validator';

describe('InputValidator', () => {
  describe('validateUrl', () => {
    test('应验证有效 URL', () => {
      const result = validateUrl('https://example.com');
      expect(result.valid).toBe(true);
      expect(result.cleanUrl).toBe('https://example.com');
    });

    test('应拒绝无效 URL', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
    });

    test('应拒绝空 URL', () => {
      const result = validateUrl('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSelector', () => {
    test('应验证有效 CSS 选择器', () => {
      const result = validateSelector('.btn-submit');
      expect(result.valid).toBe(true);
      expect(result.cleanSelector).toBe('.btn-submit');
    });

    test('应拒绝危险选择器', () => {
      const result = validateSelector('<script>');
      expect(result.valid).toBe(false);
    });

    test('应拒绝空选择器', () => {
      const result = validateSelector('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePayload', () => {
    test('应验证有效负载', () => {
      const result = validatePayload('click .btn-submit');
      expect(result.valid).toBe(true);
      expect(result.cleanPayload).toBe('click .btn-submit');
    });

    test('应拒绝危险负载', () => {
      const result = validatePayload('<script>alert(1)</script>');
      expect(result.valid).toBe(false);
    });

    test('应拒绝空负载', () => {
      const result = validatePayload('');
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    test('应清理文本', () => {
      const dirty = '<b>Hello</b> <script>alert(1)</script> World';
      const clean = sanitizeText(dirty);
      expect(clean).not.toContain('<b>');
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Hello');
      expect(clean).toContain('World');
    });

    test('应处理空文本', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });
  });

  describe('validateBrowserOperation', () => {
    test('应验证完整的浏览器操作', () => {
      const validation: BrowserOperationValidation = {
        url: 'https://example.com',
        selector: '.btn-submit',
        payload: 'click .btn-submit',
        text: 'Hello World',
      };

      const result = validateBrowserOperation(validation);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.cleanValidation.url).toBe('https://example.com');
      expect(result.cleanValidation.selector).toBe('.btn-submit');
      expect(result.cleanValidation.payload).toBe('click .btn-submit');
      expect(result.cleanValidation.text).toBe('Hello World');
    });

    test('应收集多个验证错误', () => {
      const validation: BrowserOperationValidation = {
        url: 'bad url',
        selector: '<script>',
        payload: '<script>',
        text: 'Normal text',
      };

      const result = validateBrowserOperation(validation);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
