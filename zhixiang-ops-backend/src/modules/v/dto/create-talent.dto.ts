import { IsString } from 'class-validator';
import { TalentFieldsDto } from './talent-fields.dto';

/** 创建达人 DTO：必填 name，其余字段继承 TalentFieldsDto。 */
export class CreateTalentDto extends TalentFieldsDto {
  @IsString()
  name!: string;
}
