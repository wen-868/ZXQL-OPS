import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../auth/user.entity';
import { RoleEntity } from '../n/role.entity';
import { ComplianceWordEntity } from '../compliance/compliance-word.entity';
import { DemoModule } from './demo.module';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';

/** 系统初始化：部署引导 + 运行期基线数据 seed（幂等，不删除现有数据） */
@Module({
  imports: [TypeOrmModule.forFeature([User, RoleEntity, ComplianceWordEntity]), DemoModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
