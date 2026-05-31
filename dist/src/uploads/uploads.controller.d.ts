import { UploadsService } from './uploads.service';
declare class PresignDto {
    contentType: string;
    folder: string;
}
export declare class UploadsController {
    private uploadsService;
    constructor(uploadsService: UploadsService);
    presign(dto: PresignDto): Promise<{
        uploadUrl: string;
        publicUrl: string;
        key: string;
    }>;
}
export {};
