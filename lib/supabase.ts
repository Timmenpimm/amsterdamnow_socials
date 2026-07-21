/**
 * Supabase Integration Layer
 *
 * This application uses Prisma ORM for database access, which connects directly to
 * the PostgreSQL database provided by Supabase.
 *
 * ## Connection Setup
 *
 * Prisma is configured to connect via the DATABASE_URL environment variable,
 * which should be set to your Supabase PostgreSQL connection string:
 *
 * Example:
 * DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]?schema=public"
 *
 * You can find your connection string in the Supabase dashboard:
 * 1. Navigate to Settings → Database → Connection Strings
 * 2. Select "URI" and copy the connection string
 * 3. Set DATABASE_URL in your .env.local file
 *
 * ## Database Migrations
 *
 * After updating database/schema.prisma:
 * 1. Run: npx prisma migrate dev --name <description>
 * 2. This creates a migration file and applies it to your Supabase database
 *
 * ## Accessing the Database
 *
 * Use the `db` client from lib/db.ts in your API routes and server components:
 *
 * ```typescript
 * import { db } from "@/lib/db";
 *
 * const users = await db.user.findMany();
 * ```
 *
 * ## Why No supabase-js Dependency?
 *
 * Prisma handles all PostgreSQL communication directly. We don't need supabase-js
 * for standard database operations. Use supabase-js only if you need Supabase-specific
 * features (Auth, Realtime, File Storage) beyond standard PostgreSQL.
 */

// No exports — this file is purely documentation.
// All database access goes through the Prisma client in lib/db.ts
