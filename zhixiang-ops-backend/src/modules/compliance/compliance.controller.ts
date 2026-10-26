import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { AddComplianceWordDto, UpdateComplianceWordDto } from './dto/add-word.dto';
import { CheckTextDto } from './dto/check-text.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 合规预检控制器（规划 §4-P）。
 * 路径前缀 ops/compliance（对齐全局 /api 前缀与 ops 命名约定）。
 */
@ApiTags('compliance')
@Controller('ops/compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('check')
  @ApiOperation({ summary: 'POST checkText' })
  checkText(@Body() dto: CheckTextDto) {
    return this.complianceService.checkText(dto.text, dto.scene ?? 'script');
  }

  @Get('words')
  @ApiOperation({ summary: 'GET listWords' })
  listWords(@Query() q: QueryWordsDto) {
    return this.complianceService.listWords(q);
  }

  @Post('words')
  @ApiOperation({ summary: 'POST addWord' })
  addWord(@Body() dto: AddComplianceWordDto) {
    return this.complianceService.addWord(dto);
  }

  @Put('words/:id')
  @ApiOperation({ summary: 'PUT updateWord' })
  updateWord(@Param('id') id: string, @Body() dto: UpdateComplianceWordDto) {
    return this.complianceService.updateWord(Number(id), dto);
  }

  @Delete('words/:id')
  @ApiOperation({ summary: 'DELETE removeWord' })
  removeWord(@Param('id') id: string) {
    return this.complianceService.removeWord(Number(id));
  }

  @Get('logs')
  @ApiOperation({ summary: 'GET getLogs' })
  getLogs(@Query() q: QueryLogsDto) {
    return this.complianceService.getLogs(q);
  }
}
