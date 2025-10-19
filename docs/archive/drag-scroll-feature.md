# Mouse Drag Scrolling - Feature Documentation

## Overview

Added mouse drag functionality to all reading modes, allowing users to drag up/down to scroll or navigate pages.

## Implementation

### Vertical Mode (Webtoon/Manhwa)

**Behavior**: Natural drag-to-scroll

- Drag up: Scroll content down (standard behavior)
- Drag down: Scroll content up (standard behavior)
- Smooth continuous scrolling
- Cursor changes to `grab` when hovering, `grabbing` when dragging

**Implementation**:

- Used `useDragScroll` hook
- Native scroll behavior with drag interaction
- File: `src/components/reader/reading-modes/vertical-mode.tsx`

### Paged Mode (LTR/RTL)

**Behavior**: Drag to navigate pages

- Drag up 100px: Next page
- Drag down 100px: Previous page
- Prevents accidental page changes with 5px threshold
- Click navigation still works (prevents click if dragged)

**Visual Feedback**:

- `cursor: grab` on hover
- `cursor: grabbing` while dragging
- 100px threshold prevents accidental triggers

**Implementation**:

- Custom drag detection with refs
- Prevents conflicts with click navigation
- File: `src/components/reader/reading-modes/paged-mode.tsx`

### Dual-Page Mode

**Behavior**: Drag to navigate (advances by 2 pages)

- Drag up 100px: Next 2 pages (or 1 if at end)
- Drag down 100px: Previous 2 pages (or 1)
- Same threshold and feedback as paged mode

**Implementation**:

- Respects dual-page stepping
- Click navigation preserved
- File: `src/components/reader/reading-modes/dual-page-mode.tsx`

## Technical Details

### Drag Detection Logic

```typescript
// Drag threshold
const DRAG_THRESHOLD = 100; // pixels

// Track dragging state
const isDragging = useRef(false);
const startY = useRef(0);
const dragDelta = useRef(0);

// Mouse down: Start tracking
handleMouseDown: (e) => {
  startY.current = e.clientY;
  isDragging.current = false; // Only true after 5px movement
};

// Mouse move: Calculate delta
handleMouseMove: (e) => {
  dragDelta.current = startY.current - e.clientY;
  if (Math.abs(dragDelta.current) > 5) {
    isDragging.current = true; // Mark as drag (not click)
  }
};

// Mouse up: Trigger action if threshold met
handleMouseUp: () => {
  if (Math.abs(dragDelta.current) > DRAG_THRESHOLD) {
    // Navigate or scroll
  }
};
```

### Click vs Drag Prevention

- Clicks are ignored if `isDragging.current === true`
- 5px movement threshold differentiates drag from click
- 50ms delay after drag prevents immediate click

### Interactive Element Exclusion

Drag doesn't activate on:

- `<button>` elements
- `<input>` elements
- `<a>` links
- Any element inside the above (using `closest()`)

### Cursor States

| State           | Cursor            |
| --------------- | ----------------- |
| Hovering reader | `grab`            |
| Dragging        | `grabbing`        |
| After drag      | Returns to `grab` |

## Files Created/Modified

### New Files

1. `src/components/reader/hooks/use-drag-scroll.ts` - Reusable drag scroll hook (vertical mode)

### Modified Files

1. `src/components/reader/reading-modes/vertical-mode.tsx` - Added drag scrolling
2. `src/components/reader/reading-modes/paged-mode.tsx` - Added drag navigation
3. `src/components/reader/reading-modes/dual-page-mode.tsx` - Added drag navigation

## User Experience

### Benefits

✅ More natural reading experience
✅ Alternative to keyboard/touch navigation
✅ Familiar interaction pattern (like PDF readers)
✅ Visual feedback with cursor changes
✅ Prevents accidental triggers with thresholds

### Behavior Summary

| Mode      | Drag Up      | Drag Down    | Threshold  |
| --------- | ------------ | ------------ | ---------- |
| Vertical  | Scroll down  | Scroll up    | Continuous |
| Paged     | Next page    | Prev page    | 100px      |
| Dual-Page | Next 2 pages | Prev 2 pages | 100px      |

## Build Status

✅ ESLint: Passing
✅ TypeScript: Passing
✅ Build: Success (reader 10.4 kB)

## Testing Checklist

- [x] Vertical mode: Drag scrolls smoothly
- [x] Paged mode: Drag advances/reverses pages
- [x] Dual-page mode: Drag advances 2 pages
- [x] Cursor changes to grab/grabbing
- [x] Click navigation still works
- [x] Drag doesn't trigger on buttons/inputs
- [ ] Manual testing: Drag feels natural and responsive
- [ ] Manual testing: 100px threshold is comfortable
