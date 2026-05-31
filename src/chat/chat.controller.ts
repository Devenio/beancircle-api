import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ChatService } from './chat.service';

class MessageAttachmentDto {
  @IsString()
  @MaxLength(10000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;
}

class MessageLocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;
}

class SendMessageDto {
  @IsOptional()
  @IsIn([
    'text',
    'image',
    'file',
    'location',
    'voice',
    'video',
    'sticker',
    ...Object.values(MessageType),
  ])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  imageUrl?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MessageAttachmentDto)
  attachment?: MessageAttachmentDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MessageLocationDto)
  location?: MessageLocationDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sticker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  replyToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  replyToSnippet?: string;
}

class CreateConversationDto {
  @IsUUID()
  participantId: string;
}

class EditMessageDto {
  @IsString()
  @MaxLength(4000)
  body: string;
}

class PinMessageDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
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

  @Patch('conversations/:id/messages/:messageId')
  edit(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(id, messageId, user.id, dto.body);
  }

  @Delete('conversations/:id/messages/:messageId')
  delete(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.deleteMessage(id, messageId, user.id);
  }

  @Post('conversations/:id/messages/:messageId/seen')
  seen(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.markMessageSeen(id, messageId, user.id);
  }

  @Post('conversations/:id/messages/:messageId/pin')
  pin(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: PinMessageDto,
  ) {
    return this.chatService.setMessagePinned(
      id,
      messageId,
      user.id,
      dto.pinned,
    );
  }
}
