import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntelService } from './intel.service';
import { IntelController } from './intel.controller';
import { CompetitorEntity } from './competitor.entity';
import { CollectedCommentEntity } from './collected-comment.entity';
import { CollectTaskEntity } from './collect-task.entity';
import { HotSnapshotEntity } from './hot-snapshot.entity';
import { CollectRateLimiter } from './rate-limiter';
import { CollectorGateway } from './collector/collector.gateway';

/**
 * 情报采集模块（规划 §4-C）。
 * 注册 4 张实体（竞品/评论/任务/热点）；导出 IntelService 供 D 人性分析等下游消费。
 * RedisService 由 RedisModule(@Global) 提供，限流直接注入。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompetitorEntity,
      CollectedCommentEntity,
      CollectTaskEntity,
      HotSnapshotEntity,
    ]),
  ],
  controllers: [IntelController],
  providers: [IntelService, CollectRateLimiter, CollectorGateway],
  exports: [IntelService],
})
export class IntelModule {}
