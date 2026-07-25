-- Template: user-uploaded HTML carousel templates.
-- Matches database/schema.prisma model `Template` (Prisma default naming:
-- quoted PascalCase table, camelCase columns — same as the existing tables).
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "html" TEXT NOT NULL,
    "placeholders" JSONB NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1350,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Template_userId_idx" ON "Template"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Template_userId_fkey'
  ) THEN
    ALTER TABLE "Template"
      ADD CONSTRAINT "Template_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Existing tables have RLS enabled; the app role has BYPASSRLS.
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
