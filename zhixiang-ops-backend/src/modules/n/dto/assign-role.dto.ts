import { IsInt, Min } from 'class-validator';

/** 给用户分配角色 DTO */
export class AssignRoleDto {
  @IsInt()
  @Min(1)
  userId!: number;
}
