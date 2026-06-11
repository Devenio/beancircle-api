import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BeansController } from './beans.controller';
import { BeansService } from './beans.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BeansController],
  providers: [BeansService],
  exports: [BeansService],
})
export class BeansModule {}
