import { issueCsrfToken, verifyCsrfToken } from './csrf';

/** CSRF 无状态令牌单测（商业级清单 C2）：签发、验签、防篡改、过期。 */

describe('csrf token', () => {
  it('签发的令牌可被验签通过', () => {
    const token = issueCsrfToken(42, 't_dev');
    expect(token).toContain('.');
    expect(verifyCsrfToken(token)).toBe(true);
  });

  it('篡改载荷导致验签失败', () => {
    const token = issueCsrfToken(42, 't_dev');
    const [body, sig] = token.split('.');
    const tampered = `${body.replace(/.$/, 'X')}.${sig}`;
    expect(verifyCsrfToken(tampered)).toBe(false);
  });

  it('篡改签名导致验签失败', () => {
    const token = issueCsrfToken(42, 't_dev');
    const [body] = token.split('.');
    expect(verifyCsrfToken(`${body}.aaaa`)).toBe(false);
  });

  it('过期令牌验签失败', () => {
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow - 13 * 60 * 60 * 1000);
    const token = issueCsrfToken(42, 't_dev');
    jest.spyOn(Date, 'now').mockReturnValue(realNow);
    expect(verifyCsrfToken(token)).toBe(false);
    jest.restoreAllMocks();
  });

  it('空值/超长/畸形输入一律拒绝', () => {
    expect(verifyCsrfToken('')).toBe(false);
    expect(verifyCsrfToken('no-dot')).toBe(false);
    expect(verifyCsrfToken('.sig-only')).toBe(false);
    expect(verifyCsrfToken('a'.repeat(600))).toBe(false);
    expect(verifyCsrfToken('!@#')).toBe(false);
  });

  it('同一用户可独立签发并验签（时间不同则令牌不同）', () => {
    const a = issueCsrfToken(1, 't1');
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 1);
    const b = issueCsrfToken(1, 't1');
    jest.restoreAllMocks();
    expect(a).not.toBe(b);
    expect(verifyCsrfToken(a)).toBe(true);
    expect(verifyCsrfToken(b)).toBe(true);
  });
});
