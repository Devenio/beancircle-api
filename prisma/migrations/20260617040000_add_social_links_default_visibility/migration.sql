-- AlterTable
-- Adds a per-user default visibility level for social links shown on the profile.
-- Individual links may override this with their own `visibility` field.
ALTER TABLE "UserSettings" ADD COLUMN "socialLinksDefaultVisibility" "VisibilityLevel" NOT NULL DEFAULT 'EVERYONE';
