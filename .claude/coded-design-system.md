# Coded design system (menu & welcome) — API side

A three-layer system that lets developers ship hand-coded React designs for the
public **menu** and **welcome** screen, gated per cafe by the platform admin,
and chosen by each cafe owner. This is SEPARATE from `MenuTemplate` (which is a
content/theme template copied into the DB) — coded designs live in **code**.

## The three layers

1. **Registry (code = source of truth).** `src/designs/design-registry.ts`
   holds metadata for every coded design (`key`, `name`, `type: menu|welcome`,
   `previewImageUrl`, `enabled`). The frontend maps each `key` to a component.
2. **Access control (admin).** Many-to-many `DesignCafeAccess` table
   (`designKey` + `cafeId`). `designKey` references a registry key in code, so
   there is **no FK** — it is validated at the service layer. Admin routes live
   in `SuperAdminController` under `/super-admin/designs/...`.
3. **Selection (cafe owner).** `CafeMenu.selectedMenuDesignKey` /
   `selectedWelcomeDesignKey`. Cafe routes live in `DesignsController` under
   `/cafe-os/cafes/:cafeId/designs`.

## Key files

- `src/designs/design-registry.ts` — registry + `DEFAULT_DESIGN_KEY` + helpers.
- `src/designs/designs.service.ts` — the **single source of truth** for access
  and resolution. `availableDesignKeys()` and `resolveCafeDesigns()` are used by
  BOTH the cafe panel and the public render, so rules never diverge.
- `src/designs/designs.controller.ts` — cafe owner endpoints (CafeStaffGuard).
- `src/super-admin/super-admin.controller.ts` — admin access endpoints.
- `src/menus/menus.service.ts` → `getPublicBySlug()` attaches the resolved
  `menuDesignKey` / `welcomeDesignKey` to the public payload.

## Fallback rule (important)

When a cafe's selected design is missing, disabled, or no longer accessible,
`resolveCafeDesigns()` falls back to `DEFAULT_DESIGN_KEY[type]` at **render
time** WITHOUT clearing the stored selection. So if the admin re-grants access,
the owner's original choice silently returns. Revoke is never destructive.
Default designs must always exist, stay `enabled`, and must not be access-gated.

## How to add a new design (API side)

1. Add one entry to `DESIGN_REGISTRY` in `design-registry.ts` with a stable,
   never-reused `key`, the correct `type`, and `enabled: true`.
2. Do the frontend half (see `beancircle-front/.claude/coded-design-system.md`).

That's it — no DB change, no migration. It appears in the admin panel
automatically, and the admin can then whitelist it for cafes.

To retire a design: set `enabled: false` (don't delete the key) — cafes pointing
at it fall back to the default automatically.

## Migration note

The schema change (the two `CafeMenu` columns + `DesignCafeAccess`) is in
`prisma/migrations/20260619120000_add_coded_design_system`. Apply with
`npx prisma migrate deploy`.
