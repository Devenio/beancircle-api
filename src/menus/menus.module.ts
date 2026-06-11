import { Module } from '@nestjs/common';
import { OwnerModule } from '../owner/owner.module';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

@Module({
  imports: [OwnerModule],
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
