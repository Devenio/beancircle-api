import { Module } from '@nestjs/common';
import { CheckinsModule } from '../checkins/checkins.module';
import { CafesController } from './cafes.controller';
import { CafesService } from './cafes.service';

@Module({
  imports: [CheckinsModule],
  controllers: [CafesController],
  providers: [CafesService],
  exports: [CafesService],
})
export class CafesModule {}
