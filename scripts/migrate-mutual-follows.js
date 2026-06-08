"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const follows = await prisma.userFollow.findMany({
        select: { followerId: true, followingId: true },
    });
    const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    const followSet = new Set(follows.map((f) => `${f.followerId}->${f.followingId}`));
    let created = 0;
    for (const f of follows) {
        const reverse = `${f.followingId}->${f.followerId}`;
        if (!followSet.has(reverse))
            continue;
        const userAId = f.followerId < f.followingId ? f.followerId : f.followingId;
        const userBId = f.followerId < f.followingId ? f.followingId : f.followerId;
        const key = pairKey(userAId, userBId);
        if (processed.has(key))
            continue;
        processed.add(key);
        await prisma.friendship.upsert({
            where: { userAId_userBId: { userAId, userBId } },
            create: { userAId, userBId },
            update: {},
        });
        created++;
    }
    console.log(`Created ${created} friendships from mutual follows`);
}
const processed = new Set();
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=migrate-mutual-follows.js.map