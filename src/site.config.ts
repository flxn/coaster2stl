import { relatedTools } from './cross-promotion/tools.ts';

/**
 * Everything that identifies this tool: name, URLs, links, ads and analytics.
 * Search engine texts (title, description, features) are translated and live in src/tool/i18n (`seo`).
 *
 * Used by the app (header, footer, export file names) and at build time by
 * `vite/site-plugin.ts` (meta tags, JSON-LD, robots.txt, sitemap.xml, web manifest).
 * This is the first file to change when you start a new tool from the template.
 */

export interface AdUnit {
  /** ad unit id from the AdSense dashboard */
  slot: string;
  width: number;
  height: number;
}

export interface SiteConfig {
  /** product name shown in the header and footer */
  name: string;
  /** square logo next to the name in the header and footer */
  logo: string;
  /** canonical URL of the default language, with trailing slash; other languages live at <url><locale>/ */
  url: string;
  /** absolute URL of the social preview image (1200×630, public/preview.png) */
  image: string;
  /** prefix of downloaded files, e.g. `name-plate-1712345678.stl` */
  filePrefix: string;
  author: {
    name: string;
    url: string;
    twitter?: string;
  };
  links: {
    repository?: string;
    support?: string;
    contact?: string;
    /** the directory this tool is listed in */
    directory?: string;
  };
  /** sibling tools, linked in the footer */
  relatedTools: { name: string; url: string; icon: string }[];
  analytics: {
    /** Umami tracking script; leave websiteId empty to disable tracking */
    umamiScript: string;
    umamiWebsiteId: string;
  };
  ads: {
    /** AdSense publisher id (ca-pub-…); leave empty to disable all ads */
    client: string;
    units: {
      /** 468×60 in the header on very wide screens */
      header?: AdUnit;
      /** 728×90 below the workbench */
      model?: AdUnit;
      /** 300×250 in the export dialog */
      export?: AdUnit;
    };
  };
}

const siteConfig: SiteConfig = {
  name: 'Coaster2STL',
  logo: '/coaster2stl-logo.png',
  url: 'https://coaster2stl.printer.tools/',
  image: 'https://coaster2stl.printer.tools/preview.png',
  filePrefix: 'coaster',
  author: {
    name: 'Felix Stein',
    url: 'https://flxn.de',
    twitter: '@flxnde',
  },
  links: {
    repository: 'https://github.com/flxn/coaster2stl',
    support: 'https://paypal.me/fstein42',
    contact: 'mailto:mail@flxn.de',
    directory: 'https://printer.tools',
  },
  relatedTools,
  analytics: {
    umamiScript: 'https://track.printer.tools/script.js',
    umamiWebsiteId: '258386d2-ef57-4a9a-99a4-4bcff82d508e',
  },
  ads: {
    client: '',
    units: {},
  },
};

export default siteConfig;
