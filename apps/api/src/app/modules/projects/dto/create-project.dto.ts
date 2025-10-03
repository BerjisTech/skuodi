import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  spaceId!: string;

  @IsNotEmpty()
  name!: string;
}
