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
exports.CafesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../common/guards/admin.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const cafes_service_1 = require("./cafes.service");
const checkins_service_1 = require("../checkins/checkins.service");
let CafesController = class CafesController {
    cafesService;
    checkinsService;
    constructor(cafesService, checkinsService) {
        this.cafesService = cafesService;
        this.checkinsService = checkinsService;
    }
    list(cityId, q) {
        return this.cafesService.list(cityId, q);
    }
    get(id, user) {
        return this.cafesService.get(id, user?.id);
    }
    follow(user, id) {
        return this.cafesService.follow(user.id, id);
    }
    unfollow(user, id) {
        return this.cafesService.unfollow(user.id, id);
    }
    checkin(user, id) {
        return this.checkinsService.create(user.id, id);
    }
    create(body) {
        return this.cafesService.create(body);
    }
    update(id, body) {
        return this.cafesService.update(id, body);
    }
};
exports.CafesController = CafesController;
__decorate([
    openapi.ApiQuery({ name: "cityId", required: false }),
    openapi.ApiQuery({ name: "q", required: false }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('cityId')),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CafesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CafesController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/follow'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CafesController.prototype, "follow", null);
__decorate([
    (0, common_1.Delete)(':id/follow'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CafesController.prototype, "unfollow", null);
__decorate([
    (0, common_1.Post)(':id/checkins'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CafesController.prototype, "checkin", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CafesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CafesController.prototype, "update", null);
exports.CafesController = CafesController = __decorate([
    (0, common_1.Controller)('cafes'),
    __metadata("design:paramtypes", [cafes_service_1.CafesService,
        checkins_service_1.CheckinsService])
], CafesController);
//# sourceMappingURL=cafes.controller.js.map