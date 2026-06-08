# SelfStack — Agent instructions

## Stack

Astro 6.3.1 + Svelte 5 + Tailwind CSS 4 + TypeScript 5.9.  
pnpm-only (`preinstall` hook enforces it). Node >= 22, pnpm >= 9.

## Key commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Dev server on `localhost:4321` |
| `pnpm build` | `node scripts/generate-icons.js` → `astro build` → `pagefind --site dist` |
| `pnpm check` | `astro check` (type-check Astro files) |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` (stricter TS check) |
| `pnpm format` | `biome format --write ./src` |
| `pnpm lint` | `biome check --write ./src` (lints + formats + organizes imports) |
| `pnpm new-post <filename>` | Scaffolds `src/content/posts/<filename>.md` with frontmatter |
| `pnpm preview` | Serve built site from `dist/` |

**Order for PR readiness**: `pnpm lint && pnpm check && pnpm type-check && pnpm build` (build runs the most work; run it last).

## Architecture

- **Config driven**: `src/config/*.ts` exports all site settings. Edit these files to customize; do not hardcode.
- **Content**: `src/content/posts/**/*.{md,mdx}` via Astro content collections. Frontmatter schema in `src/content.config.ts`.
- **i18n**: `src/i18n/` — key-based translations (`I18nKey` enum); `siteConfig.ts` sets the default `SITE_LANG`.
- **Layouts**: `src/layouts/` — main page shells.
- **Components**: `src/components/` — Astro + Svelte 5 components.
- **Plugins**: `src/plugins/` — remark/rehype custom plugins (mermaid, plantuml, figure, email protection, etc.).
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`). PostCSS for `postcss-import` + `postcss-nesting`.
- **Markdown plugins** (configured in `astro.config.mjs`): remark-math, rehype-katex, rehype-callouts, remark-directive, expressive-code, mermaid, plantuml, GitHub card component, image grid, reading time, excerpt, sectionize.

## Biome (linter + formatter)

- Config: `biome.json` — tabs, double quotes, organizes imports on save.
- CSS, `src/public/`, `dist/`, `node_modules/`, `src/constants/icons.ts` are excluded.
- `.astro`, `.svelte`, `.vue` files have relaxed rules (`useConst`, `useImportType` off; unused vars/imports allowed).

## Build quirks

- `pnpm build` runs icon generation + Astro build + Pagefind indexing. The `generate-icons.js` script must run **before** `astro build`.
- `astro.config.mjs` sets `rustCompiler: false`, `queuedRendering: true`.
- Production build drops `console.log` and `debugger` statements (via esbuild).
- Sitemap filters out disabled pages (friends, sponsor, guestbook, bangumi, gallery) based on `siteConfig.pages.*`.
- `tsconfig.json` path aliases: `@/*` → `src/*`, `@components/*`, `@utils/*`, etc.

## CI

- `biome.yml` — runs `biome ci` on push/PR to master.
- `build.yml` — `pnpm install --frozen-lockfile` → `pnpm astro check` + `pnpm astro build` on Node 22 & 23.
- `deploy.yml` — builds on master push, deploys `dist/` to `pages` branch via `JamesIves/github-pages-deploy-action`.

## Testing

No test framework is configured. Verification is done via `pnpm check`, `pnpm type-check`, and `pnpm build`.

## Content frontmatter

Supported fields: `title`, `published`, `updated`, `draft`, `description`, `image`, `tags`, `category`, `lang`, `pinned`, `author`, `sourceLink`, `licenseName`, `licenseUrl`, `comment`, `password`, `passwordHint`. Schema at `src/content.config.ts`.
