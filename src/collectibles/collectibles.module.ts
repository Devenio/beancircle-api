import { Global, Module } from '@nestjs/common';
import { CollectiblesController } from './collectibles.controller';
import { CollectiblesService } from './collectibles.service';

@Global()
@Module({
  controllers: [CollectiblesController],
  providers: [CollectiblesService],
  exports: [CollectiblesService],
})
export class CollectiblesModule {}
