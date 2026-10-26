import { IsIn, IsString } from 'class-validator';
import { PLATFORMS } from '../account.types';
import { AccountFieldsDto } from './account-fields.dto';

/**
 * 创建账号 DTO。Token 以明文入参，由服务层加密存储（明文不落库）。
 * 共用可选字段见 AccountFieldsDto。
 */
export class CreateAccountDto extends AccountFieldsDto {
  @IsIn(PLATFORMS)
  platform!: string;

  @IsString()
  platformAccountId!: string;
}
