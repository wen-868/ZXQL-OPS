import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoService } from './h.service';
import { VideoController } from './h.controller';
import { VideoEntity } from './video.entity';
import { ScriptEntity } from '../script/script.entity';
import { MaterialEntity } from '../g/material.entity';
import { ComplianceModule } from '../compliance/compliance.module';

/**
 * 智能成片模块（规划 §4-H / 开发顺序 H 智能成片 / 阶段3 增强）。
 * 注册 VideoEntity / ScriptEntity（读取 F 脚本分镜）/ MaterialEntity（读取 G 素材拼装，P1-2）；
 * 合规预检复用 P 域 ComplianceModule。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([VideoEntity, ScriptEntity, MaterialEntity]),
    ComplianceModule,
  ],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class HModule {}
