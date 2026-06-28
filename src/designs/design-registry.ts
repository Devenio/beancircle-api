/**
 * Coded-design registry — the single source of truth for which hand-coded
 * menu / welcome designs exist on the platform.
 *
 * THIS FILE IS THE "THEMES FOLDER" FOR CODED DESIGNS.
 * To ship a new design:
 *   1. Build the React component on the frontend and map its `key` in
 *      `beancircle-front/src/components/designs/registry.tsx`.
 *   2. Add one entry to `DESIGN_REGISTRY` below.
 * No database change is needed — the new design appears in the admin panel
 * automatically, and the admin can then whitelist it for specific cafes.
 *
 * Access control is enforced server-side against this registry, so the
 * frontend never decides what a cafe may use.
 */

export type DesignType = 'menu' | 'welcome';

export interface RegisteredDesign {
  /** Stable, unique slug. Persisted on cafes + the access table. Never reuse. */
  key: string;
  /** Human-friendly name shown in the admin and cafe panels. */
  name: string;
  /** Whether this design targets the public menu or the welcome screen. */
  type: DesignType;
  /** Short blurb shown under the name. */
  description?: string;
  /** Thumbnail / preview shown in both panels. */
  previewImageUrl?: string;
  /**
   * When false the design is hidden everywhere (admin, cafe panel, public
   * render) and any cafe pointing at it falls back to the default — lets us
   * retire a design without deleting code or breaking pages.
   */
  enabled: boolean;
}

/**
 * The default design per type. Used as the fallback whenever a cafe has no
 * selection, or its selection is no longer enabled / no longer accessible.
 * These keys must always exist and stay enabled, and must NOT be access-gated
 * on the frontend so a page can never fail to render.
 */
export const DEFAULT_DESIGN_KEY: Record<DesignType, string> = {
  menu: 'classic-menu',
  welcome: 'classic-welcome',
};

export const DESIGN_REGISTRY: readonly RegisteredDesign[] = [
  {
    key: 'classic-menu',
    name: 'Classic Menu',
    type: 'menu',
    description:
      'The default menu layout. Always available to every cafe as a safe fallback.',
    previewImageUrl:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80',
    enabled: true,
  },
  {
    key: 'classic-welcome',
    name: 'Classic Welcome',
    type: 'welcome',
    description:
      'The default welcome screen. Always available to every cafe as a safe fallback.',
    previewImageUrl:
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&q=80',
    enabled: true,
  },
  {
    key: 'editorial-menu',
    name: 'Editorial Menu',
    type: 'menu',
    description: 'Magazine-style menu with large imagery and serif headings.',
    previewImageUrl:
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&q=80',
    enabled: true,
  },
  {
    key: 'spotlight-welcome',
    name: 'Spotlight Welcome',
    type: 'welcome',
    description: 'Full-bleed hero welcome screen with a centered call to view.',
    previewImageUrl:
      'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80',
    enabled: true,
  },
  {
    key: 'splash-welcome',
    name: 'Logo Splash Welcome',
    type: 'welcome',
    description:
      'Dark splash with the self-drawing BeanCircle logo, then the cafe title.',
    previewImageUrl:
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefda?w=600&q=80',
    enabled: true,
  },
] as const;

const BY_KEY = new Map(DESIGN_REGISTRY.map((d) => [d.key, d]));

/** Look up a design by key (returns undefined for unknown keys). */
export function getDesign(key: string): RegisteredDesign | undefined {
  return BY_KEY.get(key);
}

/** All registered designs of a type, including disabled ones (admin view). */
export function listDesigns(type?: DesignType): RegisteredDesign[] {
  const all = [...DESIGN_REGISTRY];
  return type ? all.filter((d) => d.type === type) : all;
}

/** True when the key exists and is enabled (usable for selection / render). */
export function isUsableDesign(key: string | null | undefined): boolean {
  if (!key) return false;
  const d = BY_KEY.get(key);
  return !!d && d.enabled;
}
