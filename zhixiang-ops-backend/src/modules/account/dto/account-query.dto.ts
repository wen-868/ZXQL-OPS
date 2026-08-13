import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination';
import { ACCOUNT_IDENTITIES, ACCOUNT_STAGES, ACCOUNT_STATUSES, PLATFORMS } from '../account.types';

/** 账号列表查询 DTO：分页 + 分组筛选 + 关键词 */
export class AccountQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsIn(ACCOUNT_IDENTITIES)
  identity?: string;

  @IsOptional()
  @IsString()
  track?: string;

  @IsOptional()
  @IsIn(ACCOUNT_STAGES)
  stage?: string;

  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}
