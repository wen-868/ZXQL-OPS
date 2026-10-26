import { multerConfig, MAX_FILE_SIZE, ALLOWED_MIMES } from './multer.config';

/** 通用 multer 配置测试：大小上限、MIME 白名单、未知类型回退 */
describe('multer.config', () => {
  const filter = multerConfig.fileFilter as (
    _req: unknown,
    file: { mimetype: string },
    cb: (err: Error | null, accept?: boolean) => void,
  ) => void;

  const run = (mimetype: string) =>
    new Promise<{ err: Error | null; accept?: boolean }>((resolve) => {
      filter({}, { mimetype }, (err, accept) => resolve({ err, accept }));
    });

  it('常量：上限 100MB，白名单非空', () => {
    expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    expect(ALLOWED_MIMES.length).toBeGreaterThan(0);
  });

  it.each(['image/png', 'video/mp4', 'application/octet-stream'])(
    '显式白名单放行: %s',
    async (m) => {
      const r = await run(m);
      expect(r.err).toBeNull();
      expect(r.accept).toBe(true);
    },
  );

  it.each(['image/avif', 'video/avi'])('image/ 或 video/ 前缀放行: %s', async (m) => {
    const r = await run(m);
    expect(r.accept).toBe(true);
  });

  it.each(['application/pdf', 'text/html', 'application/x-msdownload', 'font/woff2'])(
    '拒绝未知类型: %s',
    async (m) => {
      const r = await run(m);
      expect(r.err).toBeInstanceOf(Error);
      expect(r.err!.message).toContain('不支持的文件类型');
      expect(r.accept).toBe(false);
    },
  );

  it('内存存储策略', () => {
    expect(multerConfig.storage).toBeDefined();
  });
});
