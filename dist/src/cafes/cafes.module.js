"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CafesModule = void 0;
const common_1 = require("@nestjs/common");
const checkins_module_1 = require("../checkins/checkins.module");
const cafes_controller_1 = require("./cafes.controller");
const cafes_service_1 = require("./cafes.service");
let CafesModule = class CafesModule {
};
exports.CafesModule = CafesModule;
exports.CafesModule = CafesModule = __decorate([
    (0, common_1.Module)({
        imports: [checkins_module_1.CheckinsModule],
        controllers: [cafes_controller_1.CafesController],
        providers: [cafes_service_1.CafesService],
        exports: [cafes_service_1.CafesService],
    })
], CafesModule);
//# sourceMappingURL=cafes.module.js.map