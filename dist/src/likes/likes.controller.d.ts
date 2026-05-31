import { LikesService } from './likes.service';
export declare class LikesController {
    private likesService;
    constructor(likesService: LikesService);
    likePost(user: {
        id: string;
    }, postId: string): Promise<{
        liked: boolean;
    }>;
    unlikePost(user: {
        id: string;
    }, postId: string): Promise<{
        liked: boolean;
    }>;
    likeReview(user: {
        id: string;
    }, reviewId: string): Promise<{
        liked: boolean;
    }>;
    unlikeReview(user: {
        id: string;
    }, reviewId: string): Promise<{
        liked: boolean;
    }>;
}
