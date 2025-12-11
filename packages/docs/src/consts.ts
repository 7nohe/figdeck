// Shared site metadata - used by astro.config.mjs and pages
export const SITE = {
  title: "figdeck",
  description:
    "Convert Markdown files into Figma Slides with a CLI + Figma Plugin",
  url: "https://figdeck.vercel.app",
  ogImage: "https://figdeck.vercel.app/og-image.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
} as const;
