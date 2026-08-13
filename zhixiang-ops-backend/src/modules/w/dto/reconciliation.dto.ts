import { IsString } from 'class-validator';

/** 生成对账（按周期 YYYY-MM） */
export class ReconcileDto {
  @IsString()
  period!: string;
}
