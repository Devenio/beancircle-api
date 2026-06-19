import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

/** Admin: whitelist one or more cafes for a design. */
export class GrantDesignAccessDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  cafeIds!: string[];
}

/** Cafe owner: pick the menu / welcome design. `null` resets to default. */
export class SetDesignSelectionDto {
  // Present-but-null is meaningful (reset), so only validate when it's a string.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  menuDesignKey?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  welcomeDesignKey?: string | null;
}
