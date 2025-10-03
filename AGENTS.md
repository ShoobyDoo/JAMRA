# Repository Guidelines

## Project Structure & Module Organization

The app follows the Next.js App Router. Route groups and pages live in `src/app`, with key segments such as `(account)`, `manga`, `read`, and `search`. Shared UI sits in `src/components`, divided into `nav`, `topbar`, and `ui` primitives. Cross-cutting helpers belong in `src/lib`, while client state is centralized in the Zustand store at `src/store/ui.ts`. Global styles and Tailwind tokens load from `src/app/globals.css`, and static assets (favicons, images) go under `public/`.

## Build, Test, and Development Commands

- `pnpm install` — refresh dependencies before new work.
- `pnpm dev` — start the Turbopack dev server at http://localhost:3000.
- `pnpm build` — produce an optimized bundle; run before shipping feature branches.
- `pnpm start` — serve the production build locally for smoke checks.
- `pnpm lint` — run the Next.js + ESLint ruleset; fix issues prior to review.

## Coding Style & Naming Conventions

TypeScript is strict; annotate component props and Zustand store slices explicitly. Keep imports path-aware via the `@/` alias instead of deep relative paths. Use 2-space indentation, PascalCase for components, camelCase for variables and functions, and snake-case directory names only when mirroring existing segments. Tailwind utility classes should leverage the design tokens defined in `tailwind.config.js`; bundle common variants in `src/components/ui` before reusing them.

## Testing Guidelines

Automated tests are not wired up yet—add component tests alongside features using your preferred runner (e.g., Vitest + Testing Library) and name files `*.test.tsx`. Until a `pnpm test` script is committed, validate flows manually in `pnpm dev` and document steps in the PR description. Prioritize coverage of navigation (sidebar, topbar) and reader interactions to avoid regressions.

## Commit & Pull Request Guidelines

Follow Conventional Commits (`feat:`, `fix:`, `chore:`) as seen in the history, and keep messages imperative and scoped to a single change. PRs should include: a concise summary, linked issue or task ID, screenshots or clips for UI changes, manual test notes, and a checklist of outstanding TODOs. Request review once linting and any relevant manual checks are green.

## Environment & Tooling Tips

Use pnpm 8+ and Node 22 to stay aligned with the Electron/Next.js toolchains. When adding packages that require native extensions, update `pnpm-workspace.yaml` if they must be built. Document any new environment variables in an `.env.example` and avoid hardcoding secrets in `src` or `public`.
