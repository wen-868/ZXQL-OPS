import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FansProfileEntity, PrivateGroupEntity } from './index';
import { PrivateService } from './private.service';
import { PrivateController } from './private.controller';
import { NModule } from '../n/n.module';

@Module({
  imports: [
    NModule, // 操作审计 AuditService
    TypeOrmModule.forFeature([FansProfileEntity, PrivateGroupEntity]),
  ],
  controllers: [PrivateController],
  providers: [PrivateService],
  exports: [PrivateService],
})
export class UModule {}
