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
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeleteScopeDto } from './dto/delete-scope.dto';
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

  @IsOptional()
  @IsBoolean()
  liveLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;
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

class MessageReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  emoji: string;
}

class ForwardMessageDto {
  @IsString()
  messageId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  targetConversationIds: string[];
}

class ConversationPinDto {
  @IsBoolean()
  pinned: boolean;
}

class ConversationMuteDto {
  @IsBoolean()
  muted: boolean;
}

class MarkReadDto {
  @IsOptional()
  @IsString()
  lastMessageId?: string;
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
    @Body() dto: DeleteScopeDto,
  ) {
    return this.chatService.deleteMessage(
      id,
      messageId,
      user.id,
      dto.forEveryone ?? false,
    );
  }

  @Post('conversations/:id/messages/:messageId/seen')
  seen(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.markMessageSeen(id, messageId, user.id);
  }

  @Post('conversations/:id/messages/:messageId/reactions')
  react(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: MessageReactionDto,
  ) {
    return this.chatService.toggleMessageReaction(
      id,
      messageId,
      user.id,
      dto.emoji,
    );
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

  @Post('conversations/:id/read')
  read(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.chatService.markRead(id, user.id, dto.lastMessageId);
  }

  @Post('conversations/:id/pin')
  pinConversation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ConversationPinDto,
  ) {
    return this.chatService.setConversationPinned(id, user.id, dto.pinned);
  }

  @Post('conversations/:id/mute')
  muteConversation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ConversationMuteDto,
  ) {
    return this.chatService.setConversationMuted(id, user.id, dto.muted);
  }

  @Post('messages/forward')
  forward(
    @CurrentUser() user: { id: string },
    @Body() dto: ForwardMessageDto,
  ) {
    return this.chatService.forwardMessage(
      user.id,
      dto.messageId,
      dto.targetConversationIds,
    );
  }

  @Delete('conversations/:id/messages')
  clearHistory(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: DeleteScopeDto,
  ) {
    return this.chatService.deleteConversation(
      id,
      user.id,
      dto.forEveryone ?? false,
    );
  }

  @Get('conversations/:id/profile')
  conversationProfile(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.chatService.getConversationProfile(id, user.id);
  }

  @Get('conversations/:id/shared')
  sharedContent(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('type') type: 'media' | 'files' | 'links' | 'groups',
    @Query() q: PaginationDto,
  ) {
    return this.chatService.getConversationShared(
      id,
      user.id,
      type,
      q.cursor,
      q.limit,
    );
  }
}
