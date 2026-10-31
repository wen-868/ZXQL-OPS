import { filterAndSortMigrationNames, isAllowedMigrationName } from './migration-file-policy';

describe('迁移文件名白名单纯策略', () => {
  it('合法 3 位序号文件保留：001/025/123', () => {
    expect(isAllowedMigrationName('001_base.sql')).toBe(true);
    expect(isAllowedMigrationName('025_skill_provider_byo.sql')).toBe(true);
    expect(isAllowedMigrationName('123_dashboard_configs.sql')).toBe(true);
  });

  it('拒绝路径穿越 / 绝对路径 / 路径分隔符', () => {
    expect(isAllowedMigrationName('../x.sql')).toBe(false);
    expect(isAllowedMigrationName('..\\x.sql')).toBe(false);
    expect(isAllowedMigrationName('a/../b.sql')).toBe(false);
    expect(isAllowedMigrationName('/etc/passwd.sql')).toBe(false);
    expect(isAllowedMigrationName('C:\\x.sql')).toBe(false);
    expect(isAllowedMigrationName('sub/001_x.sql')).toBe(false);
  });

  it('拒绝大写与非法字符', () => {
    expect(isAllowedMigrationName('001_Base.sql')).toBe(false);
    expect(isAllowedMigrationName('001-abc.sql')).toBe(false);
    expect(isAllowedMigrationName('001 abc.sql')).toBe(false);
    expect(isAllowedMigrationName('001_中文.sql')).toBe(false);
    expect(isAllowedMigrationName('001_x.sql ')).toBe(false);
  });

  it('拒绝非 SQL 后缀', () => {
    expect(isAllowedMigrationName('001_a.ts')).toBe(false);
    expect(isAllowedMigrationName('001_a.sql.bak')).toBe(false);
    expect(isAllowedMigrationName('001_a')).toBe(false);
    expect(isAllowedMigrationName('')).toBe(false);
  });

  it('拒绝少/多位数序号', () => {
    expect(isAllowedMigrationName('1_a.sql')).toBe(false);
    expect(isAllowedMigrationName('01_a.sql')).toBe(false);
    expect(isAllowedMigrationName('0001_a.sql')).toBe(false);
    expect(isAllowedMigrationName('0012_a.sql')).toBe(false);
  });

  it('白名单过滤 + 按文件名升序排序', () => {
    const sorted = filterAndSortMigrationNames([
      '025_x.sql',
      '001_base.sql',
      '123_bad.sql',
      '../evil.sql',
      '0001_wide.sql',
      '123_c.sql',
    ]);
    expect(sorted).toEqual(['001_base.sql', '025_x.sql', '123_bad.sql', '123_c.sql']);
  });

  it('防御性输入', () => {
    expect(isAllowedMigrationName(undefined)).toBe(false);
    expect(isAllowedMigrationName(null)).toBe(false);
    expect(isAllowedMigrationName(123)).toBe(false);
    expect(isAllowedMigrationName('a'.repeat(256) + '.sql'.slice(4))).toBe(false);
  });
});
