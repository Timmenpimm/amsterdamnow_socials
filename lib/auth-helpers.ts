import "server-only";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";

const SALT_ROUNDS = 10;

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(72, "Password must be at most 72 characters long"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/** Public-safe user shape — never includes passwordHash. */
export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
};

export class DuplicateEmailError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "DuplicateEmailError";
  }
}

/**
 * Validates and creates a new user account with a hashed password.
 * Throws DuplicateEmailError if the email is already registered.
 */
export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    return user;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateEmailError();
    }
    throw error;
  }
}

/**
 * Verifies email/password credentials against the stored password hash.
 * Returns the safe user object on success, or null on any failure
 * (unknown email, no password set, or mismatch).
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<SafeUser | null> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name };
}

// Prisma throws a known-request error with code P2002 on unique constraint violations.
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
