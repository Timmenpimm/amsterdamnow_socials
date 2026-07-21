export type SlideLayout = 'hero' | 'text' | 'list' | 'quote' | 'image' | 'cta';

export interface Slide {
  index: number;
  layout: SlideLayout;
  headline: string;
  body?: string;
  imagePrompt?: string;
  imageUrl?: string;
}

export interface CarouselContent {
  title: string;
  slides: Slide[];
  caption: string;
  hashtags: string[];
}

export interface BrandSettings {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  handle?: string;
}

export interface TemplateProps {
  slides: Slide[];
  brandSettings: BrandSettings;
  images: Record<number, string>;
}
