export interface WordPressPost {
  wordpressId: number;
  title: string;
  content: string;
  excerpt: string;
  featuredImageUrl?: string;
  categories: string[];
  tags: string[];
  publishedAt: string;
  url: string;
}

export interface WordPressCredentials {
  url: string;
  username: string;
  appPassword: string;
}
