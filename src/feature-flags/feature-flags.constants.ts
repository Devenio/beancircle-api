/**
 * Feature-flag registry — the single source of truth for every toggleable
 * BeanCircle feature. On boot FeatureFlagsService upserts any missing rows so
 * new flags appear automatically. Keys are stable identifiers; do not rename
 * an existing key (add a new one and migrate instead).
 *
 * The same keys are consumed by the front-end <FeatureGate flag="..."> and by
 * the @RequireFeature('...') API guard.
 */
export interface FeatureFlagDef {
  key: string;
  label: string;
  description: string;
  category: string;
}

export const FEATURE_FLAGS: FeatureFlagDef[] = [
  // Social & content
  { key: 'feed', label: 'Home Feed', description: 'Main social feed of posts and activity', category: 'social' },
  { key: 'posts', label: 'Posts', description: 'Create and view photo/text posts', category: 'social' },
  { key: 'comments', label: 'Comments', description: 'Comment on posts and reviews', category: 'social' },
  { key: 'likes', label: 'Likes', description: 'Like posts and content', category: 'social' },
  { key: 'reactions', label: 'Reactions', description: 'Emoji reactions on posts', category: 'social' },
  { key: 'reviews', label: 'Reviews', description: 'Write and read cafe reviews', category: 'social' },
  { key: 'beans', label: 'Beans (microblog)', description: 'Short-form bean posts, replies and reactions', category: 'social' },

  // Discovery
  { key: 'discover', label: 'Discover', description: 'Discover cafes, people and the map', category: 'discovery' },
  { key: 'search', label: 'Search', description: 'Global search across the app', category: 'discovery' },
  { key: 'cafes', label: 'Cafe Profiles', description: 'Browse cafe profiles and details', category: 'discovery' },
  { key: 'discover_people', label: 'Discover People', description: 'People discovery and suggestions', category: 'discovery' },

  // Check-ins & gamification
  { key: 'checkins', label: 'Check-ins', description: 'Check in at cafes (app and QR)', category: 'gamification' },
  { key: 'passport', label: 'Passport', description: 'Stamps, badges and passport progress', category: 'gamification' },
  { key: 'beanscore', label: 'BeanScore', description: 'Loyalty points and BeanScore profile', category: 'gamification' },
  { key: 'gamification', label: 'Gamification', description: 'Badges, rewards and leaderboards', category: 'gamification' },
  { key: 'collectibles', label: 'Collectibles', description: 'Collectible cafe cards', category: 'gamification' },
  { key: 'streaks', label: 'Streaks', description: 'Visit and activity streaks', category: 'gamification' },
  { key: 'challenges', label: 'Challenges', description: 'Community challenges', category: 'gamification' },

  // Community
  { key: 'community', label: 'Community', description: 'Community hub', category: 'community' },
  { key: 'events', label: 'Events', description: 'Community events and RSVPs', category: 'community' },
  { key: 'squads', label: 'Squads', description: 'Squads / group chats and activity', category: 'community' },
  { key: 'friends', label: 'Friends', description: 'Friend requests and friendships', category: 'community' },
  { key: 'follow', label: 'Following', description: 'Follow users and cafes', category: 'community' },

  // Social graph extras
  { key: 'work_insights', label: 'Workspace Insights', description: 'Live wifi/noise/outlet work reports', category: 'workspace' },

  // Gifts & growth
  { key: 'gifts', label: 'Gift Coffee', description: 'Send and redeem coffee gifts', category: 'commerce' },
  { key: 'promotions', label: 'Promotions', description: 'Cafe promotions and announcements', category: 'commerce' },
  { key: 'growth', label: 'Growth / Referrals', description: 'Referral and growth program', category: 'commerce' },

  // Messaging & notifications
  { key: 'chat', label: 'Chat / Messaging', description: 'Direct messages and conversations', category: 'messaging' },
  { key: 'notifications', label: 'Notifications', description: 'In-app and push notifications', category: 'messaging' },
  { key: 'push', label: 'Push Notifications', description: 'Web push delivery', category: 'messaging' },

  // Cafe business tools
  { key: 'cafe_os', label: 'Cafe OS', description: 'Cafe owner/staff back-office tools', category: 'cafe' },
  { key: 'menus', label: 'Digital Menus', description: 'Public digital menus and QR ordering', category: 'cafe' },
  { key: 'owner_tools', label: 'Owner Tools', description: 'Legacy owner dashboard tools', category: 'cafe' },
  { key: 'loyalty', label: 'Loyalty Programs', description: 'Stamp cards and loyalty programs', category: 'cafe' },

  // Platform
  { key: 'scan', label: 'QR Scan', description: 'QR scanning flows', category: 'platform' },
  { key: 'bug_reports', label: 'Bug Reports', description: 'In-app bug reporting', category: 'platform' },
  { key: 'uploads', label: 'Uploads', description: 'Media uploads', category: 'platform' },
];

export const FEATURE_FLAG_KEYS = FEATURE_FLAGS.map((f) => f.key);
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]['key'];
