import { IsNotEmpty } from 'class-validator';

export class CreateSpaceDto {
  @IsNotEmpty()
  name!: string;
}
