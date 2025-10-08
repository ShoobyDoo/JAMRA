# Reader Virtualisation

## Context

The reader now streams chapter pages in chunks, but every fetched page is still mounted into the DOM. Long chapters loaded in vertical or dual-page mode create dozens (or hundreds) of `<img>` elements, making scrolling janky and increasing memory usage. We need to virtualise the page list and defer rendering of off-screen images.

## Objectives

- Virtualise page rendering across vertical and horizontal reading modes to keep the DOM lightweight.
- Ensure navigation (keyboard, slider, programmatic jumps) still works with off-screen pages.
- Retain preloading of imminent pages without reloading already viewed images.

## Plan

1. Introduce a shared virtual scrolling abstraction (likely leveraging `@tanstack/react-virtual` or a custom intersection observer) that exposes a window of visible indexes and estimated heights.
2. Refactor `VerticalMode`, `PagedMode`, and `DualPageMode` to render only the visible window while keeping navigation APIs unchanged.
3. Adapt `useChapterPagePreloader` to align with the virtual window (preload current/next pages even if not mounted).
4. Validate keyboard/touch navigation, page slider jumps, and chunk prefetch triggers with the virtualised list active.
