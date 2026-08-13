import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  LiveRoomEntity,
  DigitalHumanEntity,
  LiveDanmuEntity,
  LiveAiReplyEntity,
  LiveStatEntity,
} from './index';
import { LiveService } from './live.service';
import { LiveController } from './live.controller';
import { AccountEntity } from '../account/account.entity';
import { AccountGroupEntity } from '../account/account-group.entity';
import { AccountHealthEventEntity } from '../account/account-health-event.entity';
import { ProductEntity } from '../r/product.entity';
import { NModule } from '../n/n.module';

@Module({
  imports: [
    NModule, // 操作审计 AuditService
    TypeOrmModule.forFeature([
      LiveRoomEntity,
      DigitalHumanEntity,
      LiveDanmuEntity,
      LiveAiReplyEntity,
      LiveStatEntity,
      AccountEntity,
      AccountGroupEntity,
      AccountHealthEventEntity,
      ProductEntity,
    ]),
  ],
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class KModule {}
