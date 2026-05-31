import {
  NotificationType,
  PostType,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const COFFEE_IMG =
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800';
const LATTE_IMG =
  'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800';

async function main() {
  const iran = await prisma.country.upsert({
    where: { code: 'IR' },
    update: {},
    create: { code: 'IR', name: 'Iran' },
  });

  const cities = [
    { slug: 'fardis', name: 'Fardis' },
    { slug: 'karaj', name: 'Karaj' },
    { slug: 'tehran', name: 'Tehran' },
  ];

  const cityRecords: Record<string, string> = {};
  for (const c of cities) {
    const city = await prisma.city.upsert({
      where: { countryId_slug: { countryId: iran.id, slug: c.slug } },
      update: {},
      create: { countryId: iran.id, name: c.name, slug: c.slug },
    });
    cityRecords[c.slug] = city.id;
  }

  const fardisId = cityRecords.fardis;

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Admin',
      phone: '+989120000000',
      cityId: fardisId,
      countryId: iran.id,
      role: UserRole.ADMIN,
      refreshTokenHash: await bcrypt.hash('admin-refresh', 10),
    },
  });

  const demo = await prisma.user.upsert({
    where: { username: 'nima' },
    update: {},
    create: {
      username: 'nima',
      name: 'Nima',
      phone: '+989121111111',
      bio: 'Coffee lover in Fardis',
      cityId: fardisId,
      countryId: iran.id,
    },
  });

  const sara = await prisma.user.upsert({
    where: { username: 'sara' },
    update: {},
    create: {
      username: 'sara',
      name: 'Sara',
      phone: '+989122222222',
      bio: 'Espresso enthusiast',
      cityId: fardisId,
      countryId: iran.id,
    },
  });

  const cafes = [
    {
      name: 'Bean Circle Cafe',
      address: 'Fardis, Alborz',
      lat: 35.724,
      lng: 50.988,
      isPartner: true,
    },
    {
      name: 'Fardis Roastery',
      address: 'Fardis Main St',
      lat: 35.726,
      lng: 50.991,
      isPartner: true,
    },
    {
      name: 'Corner Brew',
      address: 'Fardis Park Ave',
      lat: 35.722,
      lng: 50.985,
      isPartner: false,
    },
  ];

  const cafeRecords: Record<string, string> = {};
  for (const cafe of cafes) {
    const existing = await prisma.cafe.findFirst({
      where: { name: cafe.name, cityId: fardisId },
    });
    if (existing) {
      cafeRecords[cafe.name] = existing.id;
    } else {
      const created = await prisma.cafe.create({
        data: {
          ...cafe,
          cityId: fardisId,
          countryId: iran.id,
          photos: {
            create: {
              url: COFFEE_IMG,
              kind: 'GALLERY',
            },
          },
        },
      });
      cafeRecords[cafe.name] = created.id;
    }
  }

  const beanCircleId = cafeRecords['Bean Circle Cafe'];
  const roasteryId = cafeRecords['Fardis Roastery'];

  // Follows so nima's feed has content
  await prisma.userFollow.upsert({
    where: {
      followerId_followingId: { followerId: demo.id, followingId: sara.id },
    },
    update: {},
    create: { followerId: demo.id, followingId: sara.id },
  });
  await prisma.userFollow.upsert({
    where: {
      followerId_followingId: { followerId: demo.id, followingId: admin.id },
    },
    update: {},
    create: { followerId: demo.id, followingId: admin.id },
  });
  await prisma.cafeFollow.upsert({
    where: { userId_cafeId: { userId: demo.id, cafeId: beanCircleId } },
    update: {},
    create: { userId: demo.id, cafeId: beanCircleId },
  });

  await prisma.user.update({
    where: { id: demo.id },
    data: { followingCount: 2 },
  });
  await prisma.user.update({
    where: { id: sara.id },
    data: { followersCount: 1 },
  });
  await prisma.user.update({
    where: { id: admin.id },
    data: { followersCount: 1 },
  });

  const postCount = await prisma.post.count();
  if (postCount === 0) {
    const post1 = await prisma.post.create({
      data: {
        authorId: demo.id,
        cafeId: beanCircleId,
        type: PostType.PHOTO_TEXT,
        caption: 'Morning ritual ☕',
        cityId: fardisId,
        countryId: iran.id,
        photos: { create: { url: COFFEE_IMG, order: 0 } },
      },
    });
    const post2 = await prisma.post.create({
      data: {
        authorId: sara.id,
        cafeId: roasteryId,
        type: PostType.PHOTO_TEXT,
        caption: 'New seasonal blend at the roastery',
        cityId: fardisId,
        countryId: iran.id,
        photos: { create: { url: LATTE_IMG, order: 0 } },
      },
    });
    await prisma.post.create({
      data: {
        authorId: admin.id,
        cafeId: beanCircleId,
        type: PostType.TEXT,
        caption: 'Welcome to Bean Circle — your cafe community!',
        cityId: fardisId,
        countryId: iran.id,
      },
    });

    await prisma.like.create({
      data: { userId: demo.id, postId: post2.id },
    });
    await prisma.comment.create({
      data: {
        authorId: sara.id,
        postId: post1.id,
        body: 'Looks amazing!',
      },
    });
    await prisma.comment.create({
      data: {
        authorId: admin.id,
        postId: post1.id,
        body: 'Need to try this place',
      },
    });

    await prisma.user.update({
      where: { id: demo.id },
      data: { postsCount: 1 },
    });
    await prisma.user.update({
      where: { id: sara.id },
      data: { postsCount: 1 },
    });
    await prisma.user.update({
      where: { id: admin.id },
      data: { postsCount: 1 },
    });
  }

  const reviewCount = await prisma.review.count();
  if (reviewCount === 0) {
    await prisma.review.create({
      data: {
        cafeId: beanCircleId,
        authorId: sara.id,
        rating: 5,
        body: 'Best flat white in Fardis!',
        cityId: fardisId,
        countryId: iran.id,
      },
    });
    await prisma.review.create({
      data: {
        cafeId: roasteryId,
        authorId: demo.id,
        rating: 4,
        body: 'Fresh beans every morning.',
        cityId: fardisId,
        countryId: iran.id,
      },
    });
    await prisma.cafe.update({
      where: { id: beanCircleId },
      data: { avgRating: 5, reviewCount: 1 },
    });
    await prisma.cafe.update({
      where: { id: roasteryId },
      data: { avgRating: 4, reviewCount: 1 },
    });
  }

  const convCount = await prisma.conversation.count();
  if (convCount === 0) {
    const conversation = await prisma.conversation.create({
      data: {
        members: {
          create: [{ userId: demo.id }, { userId: sara.id }],
        },
      },
    });
    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: sara.id,
          body: 'Hey! Have you tried the new blend?',
        },
        {
          conversationId: conversation.id,
          senderId: demo.id,
          body: 'Not yet — planning to go tomorrow.',
        },
        {
          conversationId: conversation.id,
          senderId: sara.id,
          body: 'See you at Bean Circle tomorrow?',
        },
      ],
    });
  }

  const notifCount = await prisma.notification.count({
    where: { userId: demo.id },
  });
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: demo.id,
          type: NotificationType.NEW_LIKE,
          actorId: sara.id,
          entityType: 'post',
        },
        {
          userId: demo.id,
          type: NotificationType.NEW_FOLLOWER,
          actorId: admin.id,
          entityType: 'user',
          entityId: admin.id,
        },
        {
          userId: demo.id,
          type: NotificationType.NEW_COMMENT,
          actorId: sara.id,
          entityType: 'post',
        },
      ],
    });
  }

  console.log('Seed complete:', {
    admin: admin.id,
    demo: demo.id,
    sara: sara.id,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
