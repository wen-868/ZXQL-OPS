import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmProviderEntity } from './llm-provider.entity';
import { LlmProviderService } from './llm.service';
import { LlmController } from './llm.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LlmProviderEntity])],
  controllers: [LlmController],
  providers: [LlmProviderService],
  exports: [LlmProviderService],
})
export class LlmModule {}
