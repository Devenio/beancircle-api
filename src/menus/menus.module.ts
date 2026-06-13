import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CafeOsModule } from '../cafe-os/cafe-os.module';
import { OwnerModule } from '../owner/owner.module';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

@Module({
  imports: [OwnerModule, AuthModule, CafeOsModule],
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
