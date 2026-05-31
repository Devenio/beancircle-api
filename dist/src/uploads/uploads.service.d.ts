import { ConfigService } from '@nestjs/config';
export declare class UploadsService {
    private s3;
    private bucket;
    private publicUrl;
    constructor(config: ConfigService);
    presign(contentType: string, folder?: string): Promise<{
        uploadUrl: string;
        publicUrl: string;
        key: string;
    }>;
}
