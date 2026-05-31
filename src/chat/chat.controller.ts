import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ChatService } from './chat.service';

class SendMessageDto {
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

class CreateConversationDto {
  @IsUUID()
  participantId: string;
}

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  list(@CurrentUser() user: { id: string }) {
    return this.chatService.listConversations(user.id);
  }

  @Post('conversations')
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.findOrCreate(user.id, dto.participantId);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query() q: PaginationDto,
  ) {
    return this.chatService.getMessages(id, user.id, q.cursor, q.limit);
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, user.id, dto);
  }
}
