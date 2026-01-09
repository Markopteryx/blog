export const SITE = {
  website: "https://markopteryx.dev/",
  author: "Marko",
  profile: "https://markopteryx.dev/",
  desc: "A personal blog about programming, technology, and life.",
  title: "Markopteryx",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  scheduledPostMargin: 15 * 60 * 1000,
  showArchives: false,
  showBackButton: true,
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Australia/Sydney", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
