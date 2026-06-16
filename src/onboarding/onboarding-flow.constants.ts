/**
 * Onboarding flow registry — the single source of truth for the activation
 * steps that follow the mandatory username (`identity`) gate. On boot
 * OnboardingFlowService upserts any missing rows so the admin panel always
 * lists every step. Keys are stable identifiers consumed by the front-end
 * onboarding shell; do not rename an existing key.
 *
 * The mandatory `identity` username gate is intentionally NOT part of this
 * registry — it is always required and cannot be disabled or reordered.
 */
export interface OnboardingFlowStepDef {
  key: string;
  label: string;
  description: string;
  /** Default position in the flow (admins can reorder afterwards). */
  order: number;
}

export const ONBOARDING_FLOW_STEPS: OnboardingFlowStepDef[] = [
  {
    key: 'welcome',
    label: 'Welcome',
    description: 'Intro splash that opens the activation flow',
    order: 0,
  },
  {
    key: 'interests',
    label: 'Interests',
    description: 'Pick coffee interests to personalize the feed',
    order: 1,
  },
  {
    key: 'avatar',
    label: 'Bean Avatar',
    description: 'Customize the user’s bean avatar',
    order: 2,
  },
  {
    key: 'circle',
    label: 'Build Circle',
    description: 'Follow suggested people to seed the social graph',
    order: 3,
  },
  {
    key: 'firstPost',
    label: 'First Post',
    description: 'Publish a first bean/post',
    order: 4,
  },
  {
    key: 'cafe',
    label: 'Discover Cafes',
    description: 'Explore and follow nearby cafes',
    order: 5,
  },
  {
    key: 'achievement',
    label: 'Achievement',
    description: 'Celebrate the First Sip badge',
    order: 6,
  },
  {
    key: 'profile',
    label: 'Complete Profile',
    description: 'Fill in profile details (bio, city, photo)',
    order: 7,
  },
  {
    key: 'invite',
    label: 'Invite Friends',
    description: 'Share an invite to grow the circle',
    order: 8,
  },
];

export const ONBOARDING_FLOW_KEYS = ONBOARDING_FLOW_STEPS.map((s) => s.key);
export type OnboardingStepKey = (typeof ONBOARDING_FLOW_STEPS)[number]['key'];
