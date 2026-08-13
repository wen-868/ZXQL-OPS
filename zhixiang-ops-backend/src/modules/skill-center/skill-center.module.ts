import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillCatalog } from './skill-catalog.entity';
import { SkillInstall } from './skill-install.entity';
import { SkillProviderEntity } from '../../skill/skill-provider.entity';
import { SkillCenterService } from './skill-center.service';
import { SkillCenterController } from './skill-center.controller';
import { NModule } from '../n/n.module';

/**
 * 技能中心模块（规划 §4-Z / ⑦ 管理平面）。
 * 维护内置技能目录(skills)与租户启用绑定(skill_installs)，并复用 skill_providers 表做 BYO 绑定。
 * 注入 NModule 以对启用/改绑等管理操作落审计。SkillCenterService 导出供 SkillGateway 做启用门禁。
 */
@Module({
  imports: [TypeOrmModule.forFeature([SkillCatalog, SkillInstall, SkillProviderEntity]), NModule],
  controllers: [SkillCenterController],
  providers: [SkillCenterService],
  exports: [SkillCenterService],
})
export class SkillCenterModule {}
