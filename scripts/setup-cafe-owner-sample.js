const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

const p = new PrismaClient();

(async () => {
  const user = await p.user.findUnique({ where: { username: 'nima' } });
  if (!user) throw new Error('Seed user "nima" not found. Run: pnpm prisma db seed');

  const cafe = await p.cafe.findFirst({
    where: { name: 'Bean Circle Cafe' },
  });
  if (!cafe) throw new Error('Bean Circle Cafe not found. Run: pnpm prisma db seed');

  const claimCode = cafe.claimCode ?? `CLM-${randomBytes(4).toString('hex').toUpperCase()}`;
  const checkinCode = cafe.checkinCode ?? `BC-${randomBytes(4).toString('hex').toUpperCase()}`;

  await p.cafe.update({
    where: { id: cafe.id },
    data: { isPartner: true, claimCode, checkinCode },
  });

  await p.cafeOwner.upsert({
    where: { userId_cafeId: { userId: user.id, cafeId: cafe.id } },
    update: {},
    create: { userId: user.id, cafeId: cafe.id },
  });

  console.log(
    JSON.stringify(
      {
        login: {
          phone: user.phone,
          otp: '123456',
          username: user.username,
          name: user.name,
        },
        cafe: {
          name: cafe.name,
          claimCode,
          checkinCode,
        },
        ownerDashboard: '/en/owner',
        menuEditor: `/en/owner/${cafe.id}/menu`,
      },
      null,
      2,
    ),
  );

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e.message);
  await p.$disconnect();
  process.exit(1);
});
