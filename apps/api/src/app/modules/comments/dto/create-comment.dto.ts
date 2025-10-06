import { IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

const CATEGORIES = ['comment', 'issue'] as const;
type AnchorType = '2d' | '3d';

export class CreateCommentDto {
  @IsUUID()
  projectId!: string;

  @IsNotEmpty()
  body!: string;

  @IsOptional()
  anchor?: {
    type: AnchorType;
    selection: Record<string, unknown>;
    screenshot?: string;
  };

  @IsOptional()
  @IsIn(CATEGORIES)
  category: (typeof CATEGORIES)[number] = 'comment';
}
