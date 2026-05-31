import { SearchService } from './search.service';
export declare class SearchController {
    private searchService;
    constructor(searchService: SearchService);
    search(q: string, type?: 'users' | 'cafes' | 'all', cityId?: string): Promise<{
        users: {
            id: string;
            name: string | null;
            username: string | null;
            bio: string | null;
            avatarUrl: string | null;
        }[];
        cafes: ({
            photos: {
                id: string;
                url: string;
                kind: import("@prisma/client").$Enums.CafePhotoKind;
                order: number;
                cafeId: string;
            }[];
        } & {
            id: string;
            name: string;
            countryId: string;
            cityId: string;
            createdAt: Date;
            updatedAt: Date;
            address: string;
            lat: number;
            lng: number;
            avgRating: number;
            followerCount: number;
            reviewCount: number;
            isPartner: boolean;
        })[];
    }>;
}
