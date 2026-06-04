import { Module, forwardRef } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [SquadsController],
  providers: [SquadsService],
  exports: [SquadsService],
})
export class SquadsModule {}
