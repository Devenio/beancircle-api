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
exports.GiftsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const public_decorator_1 = require("../common/decorators/public.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const admin_guard_1 = require("../common/guards/admin.guard");
const gifts_service_1 = require("./gifts.service");
class CreateGiftDto {
    amount;
}
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateGiftDto.prototype, "amount", void 0);
class RedeemDto {
    voucherCode;
    cafeId;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RedeemDto.prototype, "voucherCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RedeemDto.prototype, "cafeId", void 0);
let GiftsController = class GiftsController {
    giftsService;
    constructor(giftsService) {
        this.giftsService = giftsService;
    }
    create(user, dto) {
        return this.giftsService.create(user.id, dto.amount);
    }
    webhook(giftId) {
        return this.giftsService.completePayment(giftId);
    }
    voucher(user, id) {
        return this.giftsService.getVoucher(id, user.id);
    }
    redeem(user, dto) {
        return this.giftsService.redeem(dto.voucherCode, dto.cafeId, user.id);
    }
    list() {
        return this.giftsService.listAll();
    }
};
exports.GiftsController = GiftsController;
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateGiftDto]),
    __metadata("design:returntype", void 0)
], GiftsController.prototype, "create", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('webhook/payment'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)('giftId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GiftsController.prototype, "webhook", null);
__decorate([
    (0, common_1.Get)(':id/voucher'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GiftsController.prototype, "voucher", null);
__decorate([
    (0, common_1.Post)('redeem'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RedeemDto]),
    __metadata("design:returntype", void 0)
], GiftsController.prototype, "redeem", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GiftsController.prototype, "list", null);
exports.GiftsController = GiftsController = __decorate([
    (0, common_1.Controller)('gifts'),
    __metadata("design:paramtypes", [gifts_service_1.GiftsService])
], GiftsController);
//# sourceMappingURL=gifts.controller.js.map