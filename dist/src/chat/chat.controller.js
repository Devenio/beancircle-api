"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const chat_service_1 = require("./chat.service");
class MessageAttachmentDto {
    url;
    name;
    mimeType;
    size;
    durationSec;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], MessageAttachmentDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], MessageAttachmentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], MessageAttachmentDto.prototype, "mimeType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MessageAttachmentDto.prototype, "size", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MessageAttachmentDto.prototype, "durationSec", void 0);
class MessageLocationDto {
    lat;
    lng;
    label;
}
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageLocationDto.prototype, "lat", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageLocationDto.prototype, "lng", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], MessageLocationDto.prototype, "label", void 0);
class SendMessageDto {
    type;
    body;
    imageUrl;
    attachment;
    location;
    sticker;
    replyToId;
    replyToSnippet;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([
        'text',
        'image',
        'file',
        'location',
        'voice',
        'video',
        'sticker',
        ...Object.values(client_1.MessageType),
    ]),
    __metadata("design:type", String)
], SendMessageDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], SendMessageDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], SendMessageDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MessageAttachmentDto),
    __metadata("design:type", MessageAttachmentDto)
], SendMessageDto.prototype, "attachment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MessageLocationDto),
    __metadata("design:type", MessageLocationDto)
], SendMessageDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendMessageDto.prototype, "sticker", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SendMessageDto.prototype, "replyToId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], SendMessageDto.prototype, "replyToSnippet", void 0);
class CreateConversationDto {
    participantId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "participantId", void 0);
class EditMessageDto {
    body;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], EditMessageDto.prototype, "body", void 0);
class PinMessageDto {
    pinned;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PinMessageDto.prototype, "pinned", void 0);
let ChatController = class ChatController {
    chatService;
    constructor(chatService) {
        this.chatService = chatService;
    }
    list(user) {
        return this.chatService.listConversations(user.id);
    }
    create(user, dto) {
        return this.chatService.findOrCreate(user.id, dto.participantId);
    }
    messages(user, id, q) {
        return this.chatService.getMessages(id, user.id, q.cursor, q.limit);
    }
    send(user, id, dto) {
        return this.chatService.sendMessage(id, user.id, dto);
    }
    edit(user, id, messageId, dto) {
        return this.chatService.editMessage(id, messageId, user.id, dto.body);
    }
    delete(user, id, messageId) {
        return this.chatService.deleteMessage(id, messageId, user.id);
    }
    seen(user, id, messageId) {
        return this.chatService.markMessageSeen(id, messageId, user.id);
    }
    pin(user, id, messageId, dto) {
        return this.chatService.setMessagePinned(id, messageId, user.id, dto.pinned);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('conversations'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('conversations'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateConversationDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('conversations/:id/messages'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, SendMessageDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "send", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/messages/:messageId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, EditMessageDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "edit", null);
__decorate([
    (0, common_1.Delete)('conversations/:id/messages/:messageId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages/:messageId/seen'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "seen", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages/:messageId/pin'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, PinMessageDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "pin", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map