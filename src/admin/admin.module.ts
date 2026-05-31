import { Module } from '@nestjs/common';
import { GiftsModule } from '../gifts/gifts.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [GiftsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
