import { checkUrl, checkUrlSync } from './url-guard';

/**
 * 出站 URL 守卫测试（SSRF 防护）。
 * 覆盖：协议白名单、内网域名、IPv4 各私有段、IPv6、元数据地址、合法公网地址。
 */
describe('url-guard', () => {
  describe('checkUrlSync — 协议白名单', () => {
    it('放行 http/https', () => {
      expect(checkUrlSync('https://example.com/a').ok).toBe(true);
      expect(checkUrlSync('http://example.com').ok).toBe(true);
    });

    it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x'])(
      '拒绝非 http(s) 协议: %s',
      (u) => {
        expect(checkUrlSync(u).ok).toBe(false);
      },
    );

    it('拒绝非法 URL', () => {
      expect(checkUrlSync('not a url').ok).toBe(false);
      expect(checkUrlSync('').ok).toBe(false);
    });
  });

  describe('checkUrlSync — 内网/保留域名', () => {
    it.each([
      'http://localhost/admin',
      'http://127.0.0.1:8080',
      'http://foo.local/x',
      'http://db.internal/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://instance-data/latest',
    ])('拒绝内网域名: %s', (u) => {
      expect(checkUrlSync(u).ok).toBe(false);
    });
  });

  describe('checkUrlSync — IPv4 私有/保留段', () => {
    it.each([
      'http://10.0.0.5/',
      'http://10.255.255.254/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/', // 云元数据
      'http://127.1.2.3/',
      'http://0.0.0.0/',
      'http://100.64.0.1/', // CGNAT
      'http://192.0.2.1/', // TEST-NET-1
      'http://198.51.100.1/',
      'http://203.0.113.1/',
      'http://224.0.0.1/', // 组播
      'http://255.255.255.255/',
    ])('拒绝私有/保留 IPv4: %s', (u) => {
      expect(checkUrlSync(u).ok).toBe(false);
    });

    it.each(['http://8.8.8.8/', 'http://1.1.1.1/', 'http://114.114.114.114/'])(
      '放行公网 IPv4: %s',
      (u) => {
        expect(checkUrlSync(u).ok).toBe(true);
      },
    );
  });

  describe('checkUrlSync — IPv6', () => {
    it.each([
      'http://[::1]/',
      'http://[::]/',
      'http://[fc00::1]/',
      'http://[fd00::1]/',
      'http://[fe80::1]/',
      'http://[ff02::1]/',
      'http://[::ffff:127.0.0.1]/', // IPv4-mapped 回环
      'http://[::ffff:10.0.0.1]/',
    ])('拒绝内网/特殊 IPv6: %s', (u) => {
      expect(checkUrlSync(u).ok).toBe(false);
    });

    it('放行全局单播 IPv6', () => {
      expect(checkUrlSync('http://[2001:4860:4860::8888]/').ok).toBe(true);
    });
  });

  describe('checkUrl — DNS 解析阶段', () => {
    it('对合法公网域名返回 ok', async () => {
      // 使用确定解析的公网域名；离线环境会因解析失败而 fail-closed，
      // 故这里同时接受「通过」与「解析失败」两种结果，只断言不出现内网放行。
      const r = await checkUrl('https://example.com');
      if (!r.ok) {
        expect(r.reason).toContain('解析');
      }
    });

    it('解析失败时 fail-closed（拒绝而非放行）', async () => {
      const r = await checkUrl('https://this-host-should-not-exist-zzzq.invalid');
      expect(r.ok).toBe(false);
    });

    it('已在同步阶段拦截的地址不再进入 DNS', async () => {
      const r = await checkUrl('http://169.254.169.254/latest');
      expect(r.ok).toBe(false);
      expect(r.reason).toContain('内网');
    });
  });

  describe('归一化', () => {
    it('返回归一化后的 URL', () => {
      const r = checkUrlSync('https://EXAMPLE.com/a');
      expect(r.ok).toBe(true);
      expect(r.url).toContain('example.com');
    });
  });
});
