/**
 * Manual live-test for lib/wordpress.ts against a real, public WordPress
 * site (read-only, no credentials needed). Not part of the build or test
 * suite — run it by hand with:
 *
 *   npx tsx scripts/test-wordpress.ts [siteUrl]
 *
 * Defaults to https://amsterdamnow.com if no siteUrl is given.
 */
import { getPosts } from "../lib/wordpress";

async function main() {
  const siteUrl = process.argv[2] ?? "https://amsterdamnow.com";

  console.log(`Fetching latest posts from ${siteUrl} ...`);

  const posts = await getPosts(
    { url: siteUrl, username: "", appPassword: "" },
    { page: 1, perPage: 3 }
  );

  console.log(`\nGot ${posts.length} post(s):\n`);
  for (const post of posts) {
    console.log(`- [${post.wordpressId}] ${post.title}`);
  }
}

main().catch((error) => {
  console.error("test-wordpress failed:", error);
  process.exitCode = 1;
});
