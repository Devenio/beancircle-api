import { friendshipPair } from '../common/geo/geo.util';

export { friendshipPair };

export function isFriendshipMember(
  friendship: { userAId: string; userBId: string },
  userId: string,
): boolean {
  return friendship.userAId === userId || friendship.userBId === userId;
}

export function friendIdFromPair(
  friendship: { userAId: string; userBId: string },
  viewerId: string,
): string {
  return friendship.userAId === viewerId ? friendship.userBId : friendship.userAId;
}
