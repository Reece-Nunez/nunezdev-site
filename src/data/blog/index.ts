import type { BlogPost } from "./types";
import howMuchDoesAWebsiteCost from "./posts/how-much-does-a-small-business-website-cost";

/**
 * Blog post registry. Add new posts here (newest first ordering is handled
 * by the date sort below, so order in this array doesn't matter).
 */
const allPosts: BlogPost[] = [howMuchDoesAWebsiteCost];

export const posts: BlogPost[] = [...allPosts].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export type { BlogPost } from "./types";
