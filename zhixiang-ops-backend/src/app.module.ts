import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './cache/redis.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { SkillModule } from './skill/skill.module';
import { IntegrationModule } from './integration/integration.module';
import { AccountModule } from './modules/account/account.module';
import { IntelModule } from './modules/intel/intel.module';
import { AnalyzeModule } from './modules/analyze/analyze.module';
import { TopicModule } from './modules/topic/topic.module';
import { ScriptModule } from './modules/script/script.module';
import { PublishModule } from './modules/publish/publish.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { RecycleModule } from './modules/recycle/recycle.module';
import { NModule } from './modules/n/n.module';
import { TModule } from './modules/t/t.module';
import { RModule } from './modules/r/r.module';
import { KModule } from './modules/k/k.module';
import { SModule } from './modules/s/s.module';
import { UModule } from './modules/u/u.module';
import { WModule } from './modules/w/w.module';
import { YModule } from './modules/y/y.module';
import { AAModule } from './modules/aa/aa.module';
import { MModule } from './modules/m/m.module';
import { GModule } from './modules/g/g.module';
import { HModule } from './modules/h/h.module';
import { VModule } from './modules/v/v.module';
import { XModule } from './modules/x/x.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { SkillCenterModule } from './modules/skill-center/skill-center.module';
import { OpsAutomationModule } from './modules/ops-automation/ops-automation.module';
import { VideoAutomationModule } from './modules/video-automation/video-automation.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { LlmModule } from './modules/llm/llm.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { SystemModule } from './modules/system/system.module';
import { DemoModule } from './modules/system/demo.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';

/**
 * 应用根模块。
 * 脚手架阶段装配基础设施（数据库 / Redis / 租户 / 鉴权 / 健康检查）
 * + 第0步基建（能力网关 SkillModule / 适配层 IntegrationModule）。
 * 业务模块（A~Z）后续按《开发顺序设计.md》逐模块注册。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    TenantModule,
    AuthModule,
    HealthModule,
    SkillModule,
    IntegrationModule,
    AccountModule,
    IntelModule,
    AnalyzeModule,
    TopicModule,
    ScriptModule,
    PublishModule,
    WorkflowModule,
    RecycleModule,
    NModule,
    TModule,
    RModule,
    KModule,
    SModule,
    UModule,
    WModule,
    YModule,
    AAModule,
    MModule,
    GModule,
    HModule,
    VModule,
    XModule,
    ComplianceModule,
    SkillCenterModule,
    OpsAutomationModule,
    VideoAutomationModule,
    DashboardModule,
    AiChatModule,
    LlmModule,
    EmployeeModule,
    SystemModule,
    DemoModule,
    SystemConfigModule,
  ],
})
export class AppModule {}
