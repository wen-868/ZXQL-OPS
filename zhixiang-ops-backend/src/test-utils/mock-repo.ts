/**
 * 测试辅助：Repository 的最小强类型 mock。
 * 属性均为 jest.Mock 实例（非“方法”），因此：
 *  - 不会触发 no-unsafe-*（参数/返回均有显式类型）；
 *  - 不会触发 unbound-method（引用的是对象属性，而非类方法）；
 *  - 通过 `as unknown as Repository<T>` 桥接到构造函数入参。
 */
export type MockRepo<T> = {
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  find: jest.Mock<Promise<T[]>, [unknown?]>;
  findOne: jest.Mock<Promise<T | null>, [unknown?]>;
  createQueryBuilder: jest.Mock<unknown, []>;
};

export function createMockRepo<T>(): MockRepo<T> {
  return {
    create: jest.fn((e: Partial<T>) => ({ ...e }) as T),
    save: jest.fn((e: Partial<T>) => Promise.resolve({ ...e } as T)),
    find: jest.fn<Promise<T[]>, [unknown?]>(),
    findOne: jest.fn<Promise<T | null>, [unknown?]>(),
    createQueryBuilder: jest.fn<unknown, []>(),
  };
}
