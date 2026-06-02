# Bean Circle — Features & Pages Discovery

Complete map of the **beancircle-front** (Next.js) and **beancircle-api** (NestJS) codebases as of June 2026.

| Repo | Stack | Base URL (local) |
|------|-------|------------------|
| Front | Next.js 16, React 19, next-intl, TanStack Query, Socket.IO client | `http://localhost:3000/{locale}` |
| API | NestJS 11, Prisma, PostgreSQL, Redis, Socket.IO | `http://localhost:3001/api/v1` |

**Locales:** `fa` (default), `en` — all user-facing routes live under `/[locale]/…`.

**Swagger:** `http://localhost:3001/docs`

---

## Table of contents

1. [App structure](#app-structure)
2. [Front-end pages](#front-end-pages)
3. [Navigation & access control](#navigation--access-control)
4. [Feature domains](#feature-domains)
5. [API reference by module](#api-reference-by-module)
6. [Real-time (WebSocket)](#real-time-websocket)
7. [Data model overview](#data-model-overview)
8. [Front ↔ API wiring matrix](#front--api-wiring-matrix)
9. [Gaps & not-yet-wired items](#gaps--not-yet-wired-items)

---

## App structure

### Front-end route groups

```
src/app/
├── layout.tsx                          # Root layout, providers
├── [locale]/
│   ├── layout.tsx                      # next-intl locale wrapper
│   ├── (auth)/                         # Unauthenticated flows
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── onboarding/page.tsx
│   ├── auth/callback/page.tsx          # Google OAuth return
│   ├── admin/page.tsx                  # Admin read-only dashboard
│   └── (main)/                         # Authenticated shell + bottom nav
│       ├── layout.tsx
│       ├── page.tsx                    # Home feed
│       ├── discover/page.tsx
│       ├── passport/page.tsx
│       ├── messages/page.tsx
│       ├── messages/[id]/page.tsx
│       ├── profile/page.tsx            # Redirects to /profile/{username}
│       ├── profile/[username]/page.tsx
│       ├── cafe/[id]/page.tsx
│       ├── post/[id]/page.tsx
│       ├── create/page.tsx
│       ├── cafes/page.tsx
│       ├── community/page.tsx
│       ├── explore/page.tsx            # Redirect → /discover
│       ├── gift/page.tsx
│       ├── notifications/page.tsx
│       ├── settings/page.tsx
│       ├── owner/page.tsx
│       └── owner/[id]/page.tsx
```

### API modules (`src/app.module.ts`)

| Module | Purpose |
|--------|---------|
| Auth | OTP, Google OAuth, refresh tokens, logout |
| Users | Profile, follow, cities, favorite cafes |
| Posts | Feed, create, save |
| Comments | Post & review comments |
| Likes | Post & review likes |
| Reactions | Emoji reactions on posts |
| Reviews | Cafe reviews |
| Cafes | List, detail, follow, check-in, CRUD |
| Checkins | Standalone check-in records |
| Passport | Stamps, badges, rewards, QR check-in |
| Discover | Curated cafe sections & filtered search |
| Work | Workspace scores & crowd-sourced reports |
| BeanScore | Points, levels, daily bonus, leaderboard |
| Community | City-scoped community feed |
| Challenges | Community challenges & progress |
| Events | Community events & RSVP |
| Growth | Referral codes & apply |
| Owner | Cafe claim, analytics, partner editing |
| Chat | Conversations & rich messages |
| Notifications | In-app notifications |
| Gifts | Gift coffee vouchers & redemption |
| Reports | User/content moderation reports |
| Admin | Moderation dashboards |
| Search | Users & cafes |
| Home | Aggregated home payload (feed + suggestions) |
| Uploads | S3/R2 presigned upload URLs |
| Realtime | Socket.IO gateway (chat presence, typing) |
| Redis | Online presence, caching |

---

## Front-end pages

### Auth & onboarding

| Route | File | Description | API used |
|-------|------|-------------|----------|
| `/{locale}/login` | `(auth)/login/page.tsx` | Phone OTP login + Google OAuth link | `POST /auth/otp/request`, `POST /auth/otp/verify`, redirect to `/auth/google` |
| `/{locale}/onboarding` | `(auth)/onboarding/page.tsx` | Username, display name, city, optional referral | `GET /users/cities`, `PATCH /users/me`, `POST /growth/referrals/apply` |
| `/{locale}/auth/callback` | `auth/callback/page.tsx` | Google OAuth code exchange | `POST /auth/google/exchange`, `GET /users/me` |

### Main tab bar (bottom nav)

Defined in `src/components/layout/bottom-nav.tsx`:

| Tab | Route | Page |
|-----|-------|------|
| Home | `/` | Home feed |
| Discover | `/discover` | Cafe discovery |
| Passport | `/passport` | Coffee passport & BeanScore |
| Messages | `/messages` | Conversation list |
| Profile | `/profile` | Redirects to own profile |

### Home & social feed

| Route | Description | Key components | API |
|-------|-------------|----------------|-----|
| `/` | Chronological post feed | `FeedCard`, `PostReactions` | `GET /posts/feed` |
| `/create` | Create text/photo post | — | `POST /posts` |
| `/post/[id]` | Post detail + comments | `FeedCard` | `GET /posts/:id`, `GET/POST /posts/:id/comments` |
| `/community` | Challenges, events, community feed | `ChallengesSection`, `EventsSection`, `CommunityFeed` | `GET /challenges`, `GET /events`, `GET /community/feed` |

**Feed card actions:** like, save, emoji reactions, link to author/cafe/post.

### Discover & cafes

| Route | Description | API |
|-------|-------------|-----|
| `/discover` | Section carousels (trending, recommended, new, hidden gems), search, attribute filters, user search | `GET /discover/sections`, `GET /discover`, `GET /search` |
| `/cafes` | Searchable cafe list for user's city | `GET /cafes?cityId=&q=` |
| `/cafe/[id]` | Cafe detail: photos, follow, check-in, reviews, work reports, report | `GET /cafes/:id`, `POST/DELETE /cafes/:id/follow`, `POST /passport/checkin`, `POST /reviews/cafes/:id`, `GET/POST /cafes/:id/work`, `POST /cafes/:id/work-reports`, `POST /reports` |
| `/explore` | **Redirect only** → `/discover` | — |

**Discover filters:** `bestCoffee`, `bestWorkspace`, `quiet`, `studyFriendly`, `fastWifi`, `outdoorSeating`, `dateFriendly`, `petFriendly`.

### Passport & gamification

| Route | Description | API |
|-------|-------------|-----|
| `/passport` | Stamp collection, QR check-in, badges, reward catalog, BeanScore panel | `GET /passport/me`, `POST /passport/checkin`, `POST /passport/rewards/:id/redeem`, `GET /beanscore/me`, `POST /beanscore/daily`, `GET /beanscore/leaderboard` |

**Deep link:** `/passport?code=CHECKIN_CODE` auto-submits QR check-in.

**Passport mechanics (API):**
- First check-in at a cafe earns a **stamp** (one per cafe).
- **Badges:** `FIRST_CHECKIN`, `FIVE_CAFES`, `TEN_CAFES`, `TWENTY_CAFES`, `WEEKLY_EXPLORER`.
- **Rewards:** unlocked by stamp count; types include free drink, discounts, partner perks.
- Check-in sources: `APP` or `QR`.

### Profile & settings

| Route | Description | API |
|-------|-------------|-----|
| `/profile` | Redirect to `/profile/{username}` | `GET /users/me` |
| `/profile/[username]` | Public profile, follow, message, BeanScore (self) | `GET /users/:username`, `POST/DELETE /users/:id/follow`, `POST /conversations` |
| `/settings` | Theme, language, referrals, owner dashboard link, gift link, notifications link, logout | `POST /auth/logout`, referral & owner links |
| `/notifications` | Notification inbox (read-only list) | `GET /notifications` |

### Messaging

| Route | Description | Features |
|-------|-------------|----------|
| `/messages` | Conversation list with unread badge | `GET /conversations` |
| `/messages/[id]` | Full chat room (hides bottom nav) | Real-time via Socket.IO + REST |

**Chat capabilities (front components):**
- Text, image, file, voice, video, location, sticker messages
- Reply, edit, delete, pin
- Read receipts & seen state
- Message reactions (LIKE, HEART, FIRE, CLAP)
- Typing indicators & online presence
- Context menu & mobile action sheet

### Gifts

| Route | Description | API |
|-------|-------------|-----|
| `/gift` | Send gift coffee, display voucher QR | `POST /gifts`, `GET /gifts/:id/voucher` |

Gift lifecycle: `PENDING_PAYMENT` → `PAID` → `ASSIGNED` → `REDEEMED`.

### Owner (cafe business)

| Route | Description | API |
|-------|-------------|-----|
| `/owner` | Claim cafe via code, list owned cafes | `GET /owner/cafes`, `POST /owner/cafes/claim` |
| `/owner/[id]` | Analytics dashboard, edit name, toggle partner | `GET /owner/cafes/:id/analytics`, `PATCH /owner/cafes/:id` |

### Admin

| Route | Description | API |
|-------|-------------|-----|
| `/admin` | JSON dumps of users, cafes, reviews, reports, checkins, gifts (ADMIN role only) | `GET /admin/*` |

---

## Navigation & access control

### Main layout guards (`(main)/layout.tsx`)

1. No token & no user → redirect to `/login`
2. `user.needsOnboarding` → redirect to `/onboarding`
3. Chat room routes hide bottom navigation
4. `useSocket()` connects WebSocket on every main-layout page

### Auth methods

| Method | Flow |
|--------|------|
| Phone OTP | Request code → verify → JWT access + refresh tokens |
| Google OAuth | `/auth/google` → callback → `POST /auth/google/exchange` or token query params |
| Token refresh | `POST /auth/refresh` |
| Logout | `POST /auth/logout` + clear local storage |

### Mock / dev mode

Set `NEXT_PUBLIC_USE_MOCK_DATA=true` on the front to use in-memory mock API (`src/lib/api/mock-handler.ts`) without the backend.

---

## Feature domains

### 1. Authentication & identity

- Phone OTP (mock returns code in dev)
- Google OAuth with PKCE/code exchange
- JWT access + refresh token rotation (`RefreshToken` model)
- Roles: `USER`, `ADMIN`
- Onboarding: username validation, city selection, optional referral

### 2. Social graph

- Follow / unfollow users
- Follow / unfollow cafes
- Favorite cafes (API only — no dedicated UI yet)
- User search via `/search`

### 3. Content (posts)

- Post types: `PHOTO`, `TEXT`, `PHOTO_TEXT`, `CHECKIN`
- Feed pagination (cursor-based)
- Likes, saved posts, comments
- Emoji reactions: `LIKE`, `HEART`, `FIRE`, `CLAP`
- Posts can tag a cafe or link to a check-in

### 4. Reviews

- 1–5 star ratings with optional body & photos
- Comments and likes on reviews
- Aggregated `avgRating` on cafes

### 5. Check-ins & passport

- Check-in at cafe (app or QR code)
- Passport tracks total stamps & check-ins
- Badge & reward progression
- Public endpoint: `GET /passport/cafe-by-code/:code`

### 6. Discover & search

- City-scoped sections: trending, recommended, new, hidden gems
- Full-text / filter query on cafe attributes
- Combined user + cafe search

### 7. Workspace (“Work”) insights

- Crowd-sourced wifi, noise, outlet scores (1–5)
- Live aggregated scores on cafe (`liveWifiScore`, `liveNoiseLevel`, `liveOutletScore`)
- `workspaceScore` & `workFriendlyScore` derived metrics
- Badges: `bestWorkspace`, `fastWifi`, `quiet`, etc.

### 8. BeanScore (loyalty points)

| Action | Points (enum) |
|--------|---------------|
| Check-in, new stamp, post, photo post, review, like received, daily active, referral, challenge complete | `BeanScoreAction` |

- Levels with thresholds
- Daily bonus claim (`POST /beanscore/daily`)
- City-scoped leaderboard

### 9. Community

- **Challenges:** types `CHECKIN_COUNT`, `NEW_STAMPS`, `VISIT_UNIQUE_CAFES`; city-scoped; reward points
- **Events:** title, description, cafe/location, RSVP (`GOING` / `INTERESTED`)
- **Community feed:** separate from main home feed (`GET /community/feed`)

### 10. Growth / referrals

- Unique referral code per user
- Apply code on onboarding or in settings
- 50 points per successful referral
- Stats: total referrals, points earned

### 11. Gifts

- Send coffee gift (amount in local currency units)
- Payment webhook (`POST /gifts/webhook/payment` — public)
- Voucher QR generation
- Redemption at partner cafes

### 12. Owner tools

- Claim cafe with `claimCode`
- 30-day analytics: check-ins, reviews, stamps, followers
- Toggle partner status, rename cafe

### 13. Chat & notifications

- 1:1 conversations (find-or-create)
- Rich message types (see `MessageType` enum)
- Push-oriented `Device` model (push tokens)
- Notification types: `NEW_FOLLOWER`, `NEW_COMMENT`, `NEW_LIKE`, `NEW_MESSAGE`, `GIFT_COFFEE`

### 14. Moderation

- Report targets: `USER`, `POST`, `REVIEW`, `CAFE`, `MESSAGE`
- Admin resolves reports: `PATCH /admin/reports/:id`
- `ReportDialog` component on cafe page (extensible to other targets)

### 15. Uploads

- Presigned S3/R2 URLs (`POST /uploads/presign`)
- Front create-post currently accepts raw image URL (presign not wired in UI)

---

## API reference by module

All routes prefixed with `/api/v1`. `@Public()` routes skip JWT.

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/otp/request` | Public | Send OTP |
| POST | `/otp/verify` | Public | Verify OTP, return tokens |
| GET | `/google` | Public | Start Google OAuth |
| GET | `/google/callback` | Public | OAuth callback |
| POST | `/google/exchange` | Public | Exchange auth code for tokens |
| POST | `/refresh` | Public | Refresh access token |
| POST | `/logout` | JWT | Revoke refresh token |

### Users — `/users`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cities` | Public — list cities |
| GET | `/me` | Current user profile |
| PATCH | `/me` | Update profile |
| GET | `/me/favorite-cafes` | List favorites |
| POST | `/me/favorite-cafes/:cafeId` | Add favorite |
| DELETE | `/me/favorite-cafes/:cafeId` | Remove favorite |
| GET | `/:username` | Public profile by username |
| POST | `/:id/follow` | Follow user |
| DELETE | `/:id/follow` | Unfollow user |

### Posts — `/posts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/feed` | Home feed |
| GET | `/:id` | Post detail |
| POST | `/` | Create post |
| POST | `/:id/save` | Save post |
| DELETE | `/:id/save` | Unsave post |

### Comments — `/posts/...` & `/reviews/...`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/posts/:postId/comments` | List post comments |
| POST | `/posts/:postId/comments` | Add post comment |
| GET | `/reviews/:reviewId/comments` | List review comments |
| POST | `/reviews/:reviewId/comments` | Add review comment |

### Likes — `/likes`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/posts/:postId` | Like post |
| DELETE | `/posts/:postId` | Unlike post |
| POST | `/reviews/:reviewId` | Like review |
| DELETE | `/reviews/:reviewId` | Unlike review |

### Reactions — `/posts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:id/reactions` | List reactions |
| POST | `/:id/reactions` | Set reaction emoji |
| DELETE | `/:id/reactions` | Remove reaction |

### Reviews — `/reviews`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cafes/:cafeId` | Create review |
| GET | `/cafes/:cafeId` | List cafe reviews |

### Cafes — `/cafes`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List cafes (`cityId`, `q`) |
| GET | `/:id` | Cafe detail |
| POST | `/` | Create cafe |
| PATCH | `/:id` | Update cafe |
| POST | `/:id/follow` | Follow cafe |
| DELETE | `/:id/follow` | Unfollow cafe |
| POST | `/:id/checkins` | Create check-in |
| GET | `/:id/work` | Work insights |
| POST | `/:id/work-reports` | Submit work report |

### Checkins — `/checkins`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create check-in |
| GET | `/` | List user's check-ins |

### Passport — `/passport`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Passport, stamps, badges, rewards |
| POST | `/checkin` | Check in (cafeId or checkinCode) |
| GET | `/cafe-by-code/:code` | Public — resolve cafe from QR code |
| POST | `/rewards/:rewardId/redeem` | Redeem unlocked reward |

### Discover — `/discover`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Filtered cafe list (`cityId`, `q`, `filter`) |
| GET | `/sections` | Curated sections for a city |

### Home — `/home`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Feed + suggested cafes + unread notification count |

### Search — `/search`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Search users & cafes (`q`) |

### BeanScore — `/beanscore`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Points, level, next threshold |
| GET | `/me/events` | Point history |
| POST | `/daily` | Claim daily bonus |
| GET | `/leaderboard` | Top users (`cityId` optional) |

### Community — `/community`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/feed` | City/community post feed |

### Challenges — `/challenges`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Active challenges (`cityId` optional) |
| GET | `/me` | User's challenge progress |

### Events — `/events`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Upcoming events |
| GET | `/:id` | Event detail |
| POST | `/:id/rsvp` | RSVP going/interested |

### Growth — `/growth`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/referrals/me` | Referral stats & code |
| POST | `/referrals/apply` | Apply someone's referral code |

### Owner — `/owner`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cafes` | Owned cafes |
| POST | `/cafes/claim` | Claim with `claimCode` |
| GET | `/cafes/:id/analytics` | Dashboard metrics |
| PATCH | `/cafes/:id` | Update owned cafe |

### Chat — `/conversations`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | List conversations |
| POST | `/conversations` | Create/find 1:1 conversation |
| GET | `/conversations/:id/messages` | Paginated messages |
| POST | `/conversations/:id/messages` | Send message |
| PATCH | `/conversations/:id/messages/:messageId` | Edit message |
| DELETE | `/conversations/:id/messages/:messageId` | Delete message |
| POST | `/conversations/:id/messages/:messageId/seen` | Mark seen |
| POST | `/conversations/:id/messages/:messageId/reactions` | Toggle reaction |
| POST | `/conversations/:id/messages/:messageId/pin` | Pin/unpin |

### Notifications — `/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List notifications |
| PATCH | `/:id/read` | Mark one read |
| POST | `/read-all` | Mark all read |

### Gifts — `/gifts`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create gift |
| GET | `/` | List sent/received gifts |
| GET | `/:id/voucher` | Voucher QR |
| POST | `/redeem` | Redeem voucher at cafe |
| POST | `/webhook/payment` | Public payment webhook |

### Reports — `/reports`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Submit report |

### Admin — `/admin` (ADMIN role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | All users |
| GET | `/cafes` | All cafes |
| GET | `/reviews` | All reviews |
| GET | `/reports` | Pending reports |
| GET | `/checkins` | All check-ins |
| GET | `/gifts` | All gifts |
| PATCH | `/reports/:id` | Resolve/dismiss report |

### Uploads — `/uploads`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/presign` | Get presigned upload URL |

---

## Real-time (WebSocket)

**Gateway:** `RealtimeGateway` — Socket.IO, JWT auth on connect.

| Event (client → server) | Description |
|-------------------------|-------------|
| `conversation:join` | Join conversation room |
| `conversation:leave` | Leave conversation room |
| `typing` / `conversation:typing` | Typing indicator |
| `message:read` | Mark conversation read |

| Event (server → client) | Description |
|-------------------------|-------------|
| `presence` | User online/offline |
| `typing` / `conversation:typing` | Someone is typing |
| `message:read` | Read receipt broadcast |
| `message:new` | New message (via ChatService) |

Redis tracks online users; rooms: `user:{userId}`, `conversation:{conversationId}`.

---

## Data model overview

### Core entities

```
Country → City → User, Cafe, Post, Review, Checkin, GiftCoffee
User ↔ UserFollow (followers/following)
User ↔ CafeFollow, FavoriteCafe
Cafe → CafePhoto, Review, Checkin, Stamp, WorkReport, CommunityEvent
Post → PostPhoto, Comment, Like, PostReaction, SavedPost
Passport → Stamp (unique per cafe)
User → UserBadge, UserReward, BeanScoreProfile, BeanScoreEvent
Conversation → ConversationMember, Message → MessageReaction
CommunityChallenge → ChallengeParticipation
CommunityEvent → EventRsvp
GiftCoffee → VoucherRedemption
CafeOwner (user owns cafe)
Referral (referrer → referred user)
Report, Notification, RefreshToken, Device
```

### Key enums

See `prisma/schema.prisma` for full list: `PostType`, `MessageType`, `NotificationType`, `GiftStatus`, `ReportTargetType`, `BadgeCode`, `RewardType`, `CheckinSource`, `BeanScoreAction`, `ChallengeType`, `EventRsvpStatus`, `ReactionEmoji`, `CafePhotoKind`.

---

## Front ↔ API wiring matrix

| Feature | Front page/component | API | Status |
|---------|---------------------|-----|--------|
| Home feed | `/` | `GET /posts/feed` | Wired |
| Home aggregate | — | `GET /home` | **API only** (front uses `/posts/feed`) |
| Create post | `/create` | `POST /posts` | Wired (URL input, no presign) |
| Post detail | `/post/[id]` | posts + comments | Wired |
| Discover | `/discover` | discover + search | Wired |
| Cafe list | `/cafes` | `GET /cafes` | Wired |
| Cafe detail | `/cafe/[id]` | cafes, passport, reviews, work, reports | Wired |
| Passport | `/passport` | passport + beanscore | Wired |
| Community | `/community` | challenges, events, community feed | Wired, **not in bottom nav** |
| Profile | `/profile/[username]` | users + beanscore | Wired |
| Messages | `/messages/*` | conversations + socket | Wired |
| Notifications | `/settings` link | `GET /notifications` | Wired (no mark-read UI) |
| Gifts | `/gift` | gifts | Wired |
| Referrals | settings `ReferralPanel` | growth | Wired |
| Owner | `/owner/*` | owner | Wired |
| Admin | `/admin` | admin | Wired (read-only JSON) |
| Favorite cafes | — | users favorites | **API only** |
| Gift redeem | — | `POST /gifts/redeem` | **API only** |
| BeanScore events history | — | `GET /beanscore/me/events` | **API only** |
| Challenges “me” | partial | `GET /challenges/me` | Section uses list endpoint |
| Event RSVP | `EventsSection` | `POST /events/:id/rsvp` | Wired |
| Upload presign | — | `POST /uploads/presign` | **API only** |
| Report dialog | cafe page | `POST /reports` | Partial (cafe only) |
| Mark notifications read | — | PATCH/read-all | **API only** |

---

## Gaps & not-yet-wired items

1. **`/community` not in bottom nav** — page exists but users must navigate manually.
2. **`GET /home` unused** — front fetches feed and me separately instead of aggregated home payload.
3. **Favorite cafes** — full CRUD on API, no UI.
4. **Upload presign** — create post uses pasted URLs instead of direct upload flow.
5. **Notification actions** — list only; mark-read endpoints not called from UI.
6. **Gift redemption** — voucher creation UI exists; cafe-side redeem flow not in front.
7. **Admin panel** — raw JSON debug view, no moderation actions in UI (API supports report resolution).
8. **Report dialog** — implemented for cafes; not yet on posts, users, messages, reviews.
9. **Explore route** — legacy redirect to discover.
10. **Mock mode** — many newer endpoints (passport, discover, beanscore, owner, etc.) may fall through mock handler with errors unless API is running.

---

## Quick local URLs

| What | URL |
|------|-----|
| App (Farsi) | http://localhost:3000/fa |
| App (English) | http://localhost:3000/en |
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/docs |
| Seed users | `admin` (ADMIN), `nima` (demo) |
| Mock OTP | `123456` or code in API response |

---

*Generated from codebase discovery. Update this file when adding routes, modules, or pages.*
