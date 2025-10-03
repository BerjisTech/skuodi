import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

const CATEGORIES = ['comment', 'issue'] as const;
const ANCHOR_TYPES = ['2d', '3d'] as const;

export class CreateCommentDto {
  @IsUUID()
  projectId!: string;

  @IsNotEmpty()
  body!: string;

  @IsOptional()
  anchor?: {
    type: (typeof ANCHOR_TYPES)[number];
    selection: Record<string, unknown>;
    screenshot?: string;
  };

  @IsOptional()
  @IsIn(CATEGORIES)
  category: (typeof CATEGORIES)[number] = 'comment';
}
