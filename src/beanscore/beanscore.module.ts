import { Global, Module } from '@nestjs/common';
import { BeanScoreController } from './beanscore.controller';
import { BeanScoreService } from './beanscore.service';

@Global()
@Module({
  controllers: [BeanScoreController],
  providers: [BeanScoreService],
  exports: [BeanScoreService],
})
export class BeanScoreModule {}
