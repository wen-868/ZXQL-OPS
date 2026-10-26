import { FileStorageService } from '../shared/file-storage.service';

/**
 * FileStorageService 单元测试（本地磁盘模式）。
 * service 通过 `import { promises as fs } from 'fs'` 使用异步文件 API，
 * 故按模块级 jest.mock('fs'/'path'/'crypto') 隔离真实磁盘与哈希。
 */

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual.promises as object),
      mkdir: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
    },
  };
});

jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    ...actual,
    // 以 '/' 拼接便于跨平台断言（Windows 下路径分隔符为 '\'）
    join: jest.fn((...args: string[]) => args.join('/')),
    resolve: jest.fn((...args: string[]) => args.join('/')),
    // 忠实版相对路径计算（供 delete 的 uploadDir 包含性校验使用）
    relative: jest.fn((from: string, to: string) => {
      const f = from.split('/');
      const t = to.split('/');
      let i = 0;
      while (i < f.length && i < t.length && f[i] === t[i]) i++;
      return '../'.repeat(f.length - i) + t.slice(i).join('/');
    }),
  };
});

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    createHash: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('abcdef123456'),
    }),
  };
});

import { promises as fs } from 'fs';

const TENANT = 'tn-1';
const PUBLIC_BASE = 'http://localhost:3100';
const MONTH = new Date().toISOString().slice(0, 7);

const mockFs = fs as unknown as {
  mkdir: jest.Mock;
  writeFile: jest.Mock;
  unlink: jest.Mock;
};

describe('FileStorageService', () => {
  let svc: FileStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new FileStorageService();
  });

  it('OSS 未配置时使用本地磁盘（isOss=false）', () => {
    expect(svc.isOss).toBe(false);
  });

  it('本地保存：创建月份目录并写入文件，返回 url/path/size', async () => {
    const mockFile = {
      originalname: 'test.png',
      size: 1024,
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image-data'),
    } as Express.Multer.File;

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const result = await svc.save(mockFile, TENANT);

    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('uploads'), {
      recursive: true,
    });
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(`${TENANT}/${MONTH}/abcdef123456.png`),
      Buffer.from('fake-image-data'),
    );
    expect(result.url).toBe(`${PUBLIC_BASE}/uploads/${TENANT}/${MONTH}/abcdef123456.png`);
    expect(result.path).toBe(`${TENANT}/${MONTH}/abcdef123456.png`);
    expect(result.size).toBe(1024);
  });

  it('本地保存：URL 含 tenantId+month+hash+ext', async () => {
    const mockFile = {
      originalname: 'video.mp4',
      size: 5_000_000,
      mimetype: 'video/mp4',
      buffer: Buffer.alloc(5_000_000),
    } as Express.Multer.File;

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const result = await svc.save(mockFile, TENANT);

    expect(result.url).toMatch(/tn-1\/\d{4}-\d{2}\/[a-f0-9]{12}\.mp4$/);
    expect(result.url).toContain(PUBLIC_BASE);
  });

  it('本地删除：调用 unlink（文件存在则删除）', async () => {
    mockFs.unlink.mockResolvedValue(undefined);
    await svc.delete(`${TENANT}/${MONTH}/abcdef123456.png`);
    expect(mockFs.unlink).toHaveBeenCalledWith(
      expect.stringContaining(`${TENANT}/${MONTH}/abcdef123456.png`),
    );
  });

  it('本地删除：文件不存在时静默忽略', async () => {
    mockFs.unlink.mockRejectedValue(new Error('ENOENT'));
    await expect(svc.delete(`${TENANT}/${MONTH}/nonexistent.png`)).resolves.toBeUndefined();
  });

  it('本地删除：越界路径（../）被拒绝且不调用 unlink', async () => {
    const spy = jest.spyOn(svc, 'delete');
    mockFs.unlink.mockResolvedValue(undefined);
    await svc.delete('../../outside.png');
    expect(mockFs.unlink).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('获取本地完整路径', () => {
    const full = svc.getFullPath(`${TENANT}/${MONTH}/file.png`);
    expect(full).toContain('uploads');
    expect(full).toContain(`${TENANT}/${MONTH}/file.png`);
  });

  it('获取本地公开 URL（本地模式）', () => {
    const url = svc.getPublicUrl(`${TENANT}/${MONTH}/file.png`);
    expect(url).toBe(`${PUBLIC_BASE}/uploads/${TENANT}/${MONTH}/file.png`);
  });
});
