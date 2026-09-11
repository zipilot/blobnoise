# Search and social metadata

Canonical site: <https://d16acm1lzz4dn2.cloudfront.net/>

Source: <https://github.com/alejo-valencia/blobnoise>

The site remains a functional editor, not a collection of keyword pages.
`apps/studio/index.html` contains the title, description, canonical URL,
robots directive, Open Graph and Twitter card metadata, and WebApplication
JSON-LD. A short visible description and documentation links remain in the
HTML even without JavaScript or WebGL. They are the same content for people
and crawlers, not hidden SEO copy.

The structured data describes implemented features only. It does not invent
ratings, reviews, usage counts or search-result eligibility. The website is
accessible without payment; GitHub package authentication is a separate
distribution concern.

## Public assets

| File | Purpose |
|---|---|
| `robots.txt` | Allows public crawling and names the canonical sitemap |
| `sitemap.xml` | Lists the canonical homepage, not duplicate parameter URLs |
| `og-image.png` | Original 1200 x 630 social preview from the real renderer |
| `favicon.svg` / `apple-touch-icon.png` | Original project icon |
| `404.html` | Useful error page with `noindex`; CloudFront returns HTTP 404 |

The social card is procedural output from this project's Cloud preset and
original typography/layout, not AI-generated imagery or a third-party asset.
To regenerate it, run the development server and then:

```sh
npm run generate:social -- http://127.0.0.1:5173
```

Commit the generated PNGs. Keep `og:image`, Twitter image, canonical URL,
sitemap and structured data consistent when changing the public hostname.
Update sitemap `lastmod` only for meaningful page changes, not every build.

## Validation and limitations

The existing Playwright tests exercise no-JavaScript content, metadata,
schema consistency, robots/sitemap and actual image dimensions. The public
smoke command checks these surfaces and the live HTTP 404 behavior alongside
real media exports. Site assets use HTTPS, immutable hashed bundles and
revalidated HTML.

On 2026-09-11, the production smoke flow succeeded under the deployed
CloudFront security headers, without loosening the script policy for JSON-LD.
The sitemap and 1200 x 630 PNG were publicly available, missing pages returned
404, and the visible GitHub link fit desktop and 320-pixel layouts.

This makes the site crawlable and provides accurate search/social metadata.
It does not prove the site is already indexed, guarantee rankings, or force
Google to use the supplied description. Search Console submission/inspection
needs the owner's access and was not performed automatically.

Primary guidance read 2026-09-11:
[Google JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
