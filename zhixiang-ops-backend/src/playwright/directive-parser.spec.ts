import {
  InstructionType,
  parseInstruction,
  normalizeInstruction,
  validateInstruction,
  smartComplete,
  InstructionAliases,
} from './directive-parser';

describe('directive-parser', () => {
  describe('parseInstruction — navigate', () => {
    it('解析 navigate URL', () => {
      const i = parseInstruction('navigate https://example.com');
      expect(i.type).toBe(InstructionType.Navigate);
      expect(i.payload).toBe('navigate https://example.com');
    });

    it('解析 go 别名', () => {
      expect(parseInstruction('go https://example.com').type).toBe(InstructionType.Navigate);
    });

    it('缺少 URL 时抛错', () => {
      expect(() => parseInstruction('navigate ')).toThrow('navigate 指令需要提供 URL');
    });
  });

  describe('parseInstruction — click', () => {
    it('解析 click 与中文别名', () => {
      expect(parseInstruction('click .btn').payload).toBe('click .btn');
      expect(parseInstruction('点击 .btn').payload).toBe('click .btn');
    });

    it('缺少选择器时抛错', () => {
      expect(() => parseInstruction('click ')).toThrow('click 指令需要提供选择器');
    });
  });

  describe('parseInstruction — input', () => {
    it('解析 input selector:text', () => {
      expect(parseInstruction('input #name:张三').payload).toBe('input #name:张三');
    });

    it('缺少冒号时抛错', () => {
      expect(() => parseInstruction('input #name')).toThrow('input 指令格式');
    });

    it('缺少选择器时抛错', () => {
      expect(() => parseInstruction('input :text')).toThrow('input 指令需要提供选择器');
    });

    it('缺少文本时抛错', () => {
      expect(() => parseInstruction('input #name:')).toThrow('input 指令需要提供文本内容');
    });
  });

  describe('parseInstruction — wait', () => {
    it('默认 1000ms', () => {
      expect(parseInstruction('wait').payload).toBe('wait 1000');
    });

    it('解析毫秒与秒', () => {
      expect(parseInstruction('wait 3000').payload).toBe('wait 3000');
      expect(parseInstruction('wait 3s').payload).toBe('wait 3000');
      expect(parseInstruction('wait 500ms').payload).toBe('wait 500');
    });

    it('中文别名', () => {
      expect(parseInstruction('等待 2秒').type).toBe(InstructionType.Wait);
    });

    it('夹取到合法区间（下限 100 / 上限 300000）', () => {
      expect(parseInstruction('wait 1').payload).toBe('wait 100');
      expect(parseInstruction('wait 999999').payload).toBe('wait 300000');
    });
  });

  describe('parseInstruction — screenshot', () => {
    it('解析 screenshot 与截图', () => {
      expect(parseInstruction('screenshot').type).toBe(InstructionType.Screenshot);
      expect(parseInstruction('截图').type).toBe(InstructionType.Screenshot);
    });
  });

  describe('parseInstruction — 异常', () => {
    it('空指令抛错', () => {
      expect(() => parseInstruction('   ')).toThrow('指令不能为空');
    });

    it('未知指令抛错', () => {
      expect(() => parseInstruction('doSomething')).toThrow('未知的指令格式');
    });

    it('规范化多余空白', () => {
      expect(parseInstruction('  click    .a   ').payload).toBe('click .a');
    });
  });

  describe('validateInstruction', () => {
    it('校验各类型合法指令', () => {
      expect(validateInstruction(parseInstruction('navigate https://a.com'))).toBe(true);
      expect(validateInstruction(parseInstruction('click .a'))).toBe(true);
      expect(validateInstruction(parseInstruction('input .a:b'))).toBe(true);
      expect(validateInstruction(parseInstruction('wait 100'))).toBe(true);
      expect(validateInstruction(parseInstruction('screenshot'))).toBe(true);
    });

    it('无效类型返回 false', () => {
      expect(validateInstruction({ type: 'bogus' as never, payload: 'x' })).toBe(false);
    });

    it('payload 与类型不匹配返回 false', () => {
      expect(validateInstruction({ type: InstructionType.Navigate, payload: 'click .a' })).toBe(
        false,
      );
      expect(validateInstruction({ type: InstructionType.Screenshot, payload: 'nope' })).toBe(
        false,
      );
    });
  });

  describe('normalizeInstruction / 别名', () => {
    it('别名映射为标准指令', () => {
      expect(normalizeInstruction('go https://a.com').type).toBe(InstructionType.Navigate);
      expect(normalizeInstruction('open https://a.com').type).toBe(InstructionType.Navigate);
      expect(normalizeInstruction('点击 .a').type).toBe(InstructionType.Click);
      expect(normalizeInstruction('c .a').type).toBe(InstructionType.Click);
      expect(normalizeInstruction('w 100').type).toBe(InstructionType.Wait);
    });

    it('非别名直接解析', () => {
      expect(normalizeInstruction('screenshot').type).toBe(InstructionType.Screenshot);
    });

    it('别名表包含常用映射', () => {
      expect(InstructionAliases['go']).toBe('navigate');
      expect(InstructionAliases['截图']).toBe('screenshot');
    });
  });

  describe('smartComplete', () => {
    it('补全常见前缀', () => {
      expect(smartComplete('nav')).toBe('navigate ');
      expect(smartComplete('sc')).toBe('screenshot');
    });

    it('已完整或无关输入返回 null', () => {
      expect(smartComplete('navigate https://a.com')).toBeNull();
      expect(smartComplete('zzz')).toBeNull();
    });
  });
});
