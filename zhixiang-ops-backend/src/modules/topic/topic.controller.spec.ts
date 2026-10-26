import { TopicController } from './topic.controller';

describe('TopicController', () => {
  let controller: TopicController;
  let topicService: { [k: string]: jest.Mock };

  beforeEach(() => {
    topicService = {
      generateTopics: jest.fn(),
      listTopics: jest.fn(),
      getTopic: jest.fn(),
      updateTopic: jest.fn(),
      createAbVariant: jest.fn(),
      scheduleTopic: jest.fn(),
    };
    controller = new TopicController(topicService as any);
  });

  it('generateTopics 委托 topicService.generateTopics 并原样返回', async () => {
    const dto = { count: 5 } as any;
    topicService.generateTopics.mockResolvedValue([{ id: 1 }]);
    await expect(controller.generateTopics(dto)).resolves.toEqual([{ id: 1 }]);
    expect(topicService.generateTopics).toHaveBeenCalledWith(dto);
  });

  it('listTopics 委托 topicService.listTopics 并原样返回', async () => {
    const query = { page: 1 } as any;
    topicService.listTopics.mockResolvedValue({ items: [] });
    await expect(controller.listTopics(query)).resolves.toEqual({ items: [] });
    expect(topicService.listTopics).toHaveBeenCalledWith(query);
  });

  it('getTopic 将 id 转换为 Number 并原样返回', async () => {
    topicService.getTopic.mockResolvedValue({ id: 2 });
    await expect(controller.getTopic('2')).resolves.toEqual({ id: 2 });
    expect(topicService.getTopic).toHaveBeenCalledWith(2);
  });

  it('updateTopic 将 id 转换为 Number 并原样返回', async () => {
    const dto = { title: 't' } as any;
    topicService.updateTopic.mockResolvedValue({ id: 3 });
    await expect(controller.updateTopic('3', dto)).resolves.toEqual({ id: 3 });
    expect(topicService.updateTopic).toHaveBeenCalledWith(3, dto);
  });

  it('createAbVariant 将 id 转换为 Number 并原样返回', async () => {
    const dto = { variant: 'A' } as any;
    topicService.createAbVariant.mockResolvedValue({ id: 4 });
    await expect(controller.createAbVariant('4', dto)).resolves.toEqual({ id: 4 });
    expect(topicService.createAbVariant).toHaveBeenCalledWith(4, dto);
  });

  it('scheduleTopic 将 id 转换为 Number 并原样返回', async () => {
    const dto = { at: '2026-01-01' } as any;
    topicService.scheduleTopic.mockResolvedValue({ scheduled: true });
    await expect(controller.scheduleTopic('5', dto)).resolves.toEqual({ scheduled: true });
    expect(topicService.scheduleTopic).toHaveBeenCalledWith(5, dto);
  });
});
