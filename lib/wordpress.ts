import type { WordPressCredentials, WordPressPost } from "@/types/wordpress";

/**
 * WordPress REST API client.
 *
 * Supports both public sites (no credentials) and sites protected with
 * Basic Auth via a WordPress "application password". Content HTML coming
 * back from the API (title/content/excerpt `.rendered`) is passed through
 * untouched — nothing is stripped or sanitized here.
 *
 * Deliberately NOT marked "server-only": it holds no secrets of its own
 * (credentials are passed in by the caller) and is imported directly by
 * scripts/test-wordpress.ts for live-testing outside of Next.js. Callers
 * that do hold secrets (e.g. lib/wordpress-connection.ts) are marked
 * server-only instead.
 */

export type WordPressErrorCode =
  | "unreachable"
  | "not_wordpress"
  | "unauthorized"
  | "not_found"
  | "unknown";

export class WordPressApiError extends Error {
  code: WordPressErrorCode;

  constructor(code: WordPressErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WordPressApiError";
    this.code = code;
  }
}

export interface GetPostsOptions {
  page?: number;
  perPage?: number;
}

interface WpRenderedField {
  rendered: string;
}

interface WpTerm {
  id: number;
  name: string;
  taxonomy: string;
}

interface WpEmbedded {
  "wp:featuredmedia"?: Array<{ source_url?: string }>;
  "wp:term"?: WpTerm[][];
}

interface WpRestPost {
  id: number;
  date: string;
  link: string;
  title: WpRenderedField;
  content: WpRenderedField;
  excerpt: WpRenderedField;
  _embedded?: WpEmbedded;
}

interface WpRestMedia {
  id: number;
  source_url?: string;
}

/** Strips a trailing slash and validates the credentials' base URL. */
function normalizeBaseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new WordPressApiError(
      "unreachable",
      `"${rawUrl}" is geen geldige URL.`
    );
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function buildHeaders(credentials: WordPressCredentials): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };

  if (credentials.username && credentials.appPassword) {
    const token = Buffer.from(
      `${credentials.username}:${credentials.appPassword}`
    ).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  return headers;
}

/**
 * Performs a request against the WordPress REST API and translates
 * network/HTTP failures into typed WordPressApiError instances.
 */
async function wpFetch<T>(
  credentials: WordPressCredentials,
  path: string,
  searchParams?: Record<string, string>
): Promise<T> {
  const baseUrl = normalizeBaseUrl(credentials.url);
  const url = new URL(`${baseUrl}/wp-json/wp/v2${path}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, { headers: buildHeaders(credentials) });
  } catch (error) {
    throw new WordPressApiError(
      "unreachable",
      `Kon de WordPress-site op ${baseUrl} niet bereiken.`,
      { cause: error }
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new WordPressApiError(
      "unauthorized",
      "De inloggegevens zijn ongeldig (401/403). Controleer gebruikersnaam en applicatiewachtwoord."
    );
  }

  if (response.status === 404) {
    throw new WordPressApiError(
      "not_found",
      `Niet gevonden op ${baseUrl} (404).`
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new WordPressApiError(
      "not_wordpress",
      `${baseUrl} lijkt geen bereikbare WordPress REST API te hebben (geen JSON-response).`
    );
  }

  if (!response.ok) {
    throw new WordPressApiError(
      "unknown",
      `WordPress REST API-fout (status ${response.status}) op ${baseUrl}.`
    );
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new WordPressApiError(
      "not_wordpress",
      `Antwoord van ${baseUrl} kon niet als JSON worden gelezen.`,
      { cause: error }
    );
  }
}

function extractTermNames(embedded: WpEmbedded | undefined, taxonomy: string): string[] {
  const groups = embedded?.["wp:term"] ?? [];
  return groups
    .flat()
    .filter((term) => term.taxonomy === taxonomy)
    .map((term) => term.name);
}

function mapPost(post: WpRestPost): WordPressPost {
  return {
    wordpressId: post.id,
    title: post.title?.rendered ?? "",
    content: post.content?.rendered ?? "",
    excerpt: post.excerpt?.rendered ?? "",
    featuredImageUrl: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
    categories: extractTermNames(post._embedded, "category"),
    tags: extractTermNames(post._embedded, "post_tag"),
    publishedAt: post.date,
    url: post.link,
  };
}

/**
 * Fetches a page of posts, newest first, with featured media/categories/
 * tags embedded via `_embed` so no extra round-trips are needed.
 */
export async function getPosts(
  credentials: WordPressCredentials,
  options: GetPostsOptions = {}
): Promise<WordPressPost[]> {
  const { page = 1, perPage = 10 } = options;

  const posts = await wpFetch<WpRestPost[]>(credentials, "/posts", {
    _embed: "1",
    page: String(page),
    per_page: String(perPage),
    orderby: "date",
    order: "desc",
  });

  return posts.map(mapPost);
}

/** Fetches a single post by its WordPress ID, with the same embedding as getPosts. */
export async function getPostById(
  credentials: WordPressCredentials,
  id: number
): Promise<WordPressPost> {
  const post = await wpFetch<WpRestPost>(credentials, `/posts/${id}`, {
    _embed: "1",
  });

  return mapPost(post);
}

/** Resolves a media library ID to its full-size source URL. */
export async function getFeaturedImage(
  credentials: WordPressCredentials,
  mediaId: number
): Promise<string | undefined> {
  const media = await wpFetch<WpRestMedia>(credentials, `/media/${mediaId}`);
  return media.source_url;
}
