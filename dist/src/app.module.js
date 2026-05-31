"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const admin_module_1 = require("./admin/admin.module");
const auth_module_1 = require("./auth/auth.module");
const cafes_module_1 = require("./cafes/cafes.module");
const chat_module_1 = require("./chat/chat.module");
const checkins_module_1 = require("./checkins/checkins.module");
const comments_module_1 = require("./comments/comments.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const gifts_module_1 = require("./gifts/gifts.module");
const likes_module_1 = require("./likes/likes.module");
const notifications_module_1 = require("./notifications/notifications.module");
const posts_module_1 = require("./posts/posts.module");
const prisma_module_1 = require("./prisma/prisma.module");
const realtime_module_1 = require("./realtime/realtime.module");
const redis_module_1 = require("./redis/redis.module");
const reviews_module_1 = require("./reviews/reviews.module");
const search_module_1 = require("./search/search.module");
const uploads_module_1 = require("./uploads/uploads.module");
const users_module_1 = require("./users/users.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            cafes_module_1.CafesModule,
            posts_module_1.PostsModule,
            comments_module_1.CommentsModule,
            likes_module_1.LikesModule,
            reviews_module_1.ReviewsModule,
            checkins_module_1.CheckinsModule,
            search_module_1.SearchModule,
            chat_module_1.ChatModule,
            notifications_module_1.NotificationsModule,
            gifts_module_1.GiftsModule,
            admin_module_1.AdminModule,
            uploads_module_1.UploadsModule,
            realtime_module_1.RealtimeModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map