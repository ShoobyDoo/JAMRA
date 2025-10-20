# Page Counter Flash Fix

## Problem

When navigating pages (keyboard, buttons, or click), the page counter at the bottom would flash incorrect values:

- Navigate from page 1 to page 2
- Display shows: `2 / 3` → `1 / 3` → `2 / 3` (flashing)

## Root Cause

The `setCurrentPage` function in the Zustand store was making **two separate state updates**:

```typescript
// OLD - Two separate updates causing race condition
setCurrentPage: (page) => {
  set({ currentPage: page });  // Update 1

  if (currentMangaId && currentChapterId) {
    get().setProgress(...);     // Update 2 (separate render)
  }
}
```

### Why This Caused Flashing:

1. First `set()` updates `currentPage` → triggers re-render with new page
2. Component reads `currentPage = 2` but old progress data still exists
3. Second `setProgress()` updates progress → triggers another re-render
4. Component flashes between states during the two renders

## Solution

Combined both updates into a **single atomic operation** using a state updater function:

```typescript
// NEW - Single atomic update
setCurrentPage: (page) => {
  const { currentMangaId, currentChapterId, totalPages } = get();

  if (currentMangaId && currentChapterId) {
    const key = `${currentMangaId}:${currentChapterId}`;
    set((state) => ({
      currentPage: page, // Update current page
      progress: {
        // AND update progress
        ...state.progress,
        [key]: {
          mangaId: currentMangaId,
          chapterId: currentChapterId,
          currentPage: page,
          totalPages,
          lastReadAt: Date.now(),
        },
      },
    }));
  } else {
    set({ currentPage: page });
  }
};
```

### Benefits:

✅ **Single state update** - Only one `set()` call
✅ **Atomic operation** - Both `currentPage` and `progress` update together
✅ **No race conditions** - Components only re-render once with correct data
✅ **No flashing** - Counter shows correct value immediately

## Technical Details

### Zustand State Update Patterns

**❌ Bad - Multiple updates:**

```typescript
set({ currentPage: page });
get().setProgress(...); // Calls set() again
// Result: 2 re-renders = flashing
```

**✅ Good - Single atomic update:**

```typescript
set((state) => ({
  currentPage: page,
  progress: { ...state.progress, [key]: {...} }
}));
// Result: 1 re-render = smooth
```

### Why It Matters

- React batches updates within the same event handler
- But separate `set()` calls in Zustand can trigger multiple renders
- Using the updater function `set((state) => ...)` ensures atomicity

## Files Modified

1. **src/store/reading-progress.ts**
   - Refactored `setCurrentPage` to use atomic update
   - Eliminated duplicate `setProgress` call
   - Combined both state changes into single operation

## Result

### Before:

```
Click Next → Display: 2/3 → 1/3 → 2/3 (flash!)
```

### After:

```
Click Next → Display: 2/3 (instant, no flash)
```

## Build Status

✅ ESLint: Passing
✅ TypeScript: Passing
✅ Build: Success
✅ No performance impact (fewer renders = better performance)

## Testing

- [x] Button navigation: No flashing
- [x] Keyboard navigation: No flashing
- [x] Progress bar updates smoothly
- [x] Page counter shows correct value immediately
- [x] No visual glitches or lag
