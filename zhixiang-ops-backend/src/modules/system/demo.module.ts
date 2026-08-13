import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../auth/user.entity';
import { AccountEntity } from '../account/account.entity';
import { TopicEntity } from '../topic/topic.entity';
import { ScriptEntity } from '../script/script.entity';
import { PublishTaskEntity } from '../publish/publish.entity';
import { DemoService } from './demo.service';

/**
 * 演示模式模块：提供演示数据种子 / 清除能力，并导出 DemoService 供 Auth（演示登录）
 * 与 System（初始化清除）复用。演示数据落在独立演示租户，与真实业务租户物理隔离。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, AccountEntity, TopicEntity, ScriptEntity, PublishTaskEntity]),
  ],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
