import { Global, Module, forwardRef } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Global()
@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
