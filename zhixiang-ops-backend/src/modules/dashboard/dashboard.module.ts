import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardConfigEntity } from './dashboard-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DashboardConfigEntity])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
