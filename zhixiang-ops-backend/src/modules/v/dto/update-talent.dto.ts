import { IsOptional, IsString } from 'class-validator';
import { TalentFieldsDto } from './talent-fields.dto';

/** 更新达人 DTO：全字段可选，字段集合与创建一致（继承 TalentFieldsDto）。 */
export class UpdateTalentDto extends TalentFieldsDto {
  @IsOptional()
  @IsString()
  name?: string;
}
