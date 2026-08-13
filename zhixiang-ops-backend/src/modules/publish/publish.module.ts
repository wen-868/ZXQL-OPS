import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublishService } from './publish.service';
import { PublishController } from './publish.controller';
import { PublishTaskEntity } from './publish.entity';
import { ScriptEntity } from '../script/script.entity';
import { AccountEntity } from '../account/account.entity';
import { VideoEntity } from '../h/video.entity';
import { DouyinClientService } from '../../integration/douyin-client.service';

/**
 * 发布与分发模块（规划 §4-I）。
 * 消费 F 脚本（ScriptEntity）与 B 账号（AccountEntity），两者均通过 forFeature 复用。
 * 视频资产通过 VideoEntity 精确关联（不再盲目搜索系统目录）。
 * 抖音/快手平台走 DouyinClientService 真实 API（有凭证时），无凭证降级模拟。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PublishTaskEntity, ScriptEntity, AccountEntity, VideoEntity]),
  ],
  controllers: [PublishController],
  providers: [PublishService, DouyinClientService],
  exports: [PublishService],
})
export class PublishModule {}
