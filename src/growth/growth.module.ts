import { Module } from '@nestjs/common';
import { BeanScoreModule } from '../beanscore/beanscore.module';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';

@Module({
  imports: [BeanScoreModule],
  controllers: [GrowthController],
  providers: [GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
