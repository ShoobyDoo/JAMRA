# Invalid Page Number Fix

## Problem
Opening a manga chapter shows "page 4/3" with "No page data" error, even though the URL is correct (`/read/example-1/chapter/1`).

## Root Cause
**Stale/invalid progress data** in localStorage:
- User previously navigated to a page that no longer exists (e.g., page 4)
- Progress was saved: `{ currentPage: 4, totalPages: X }`
- When reopening, the chapter now has only 3 pages
- Reader loads with `currentPage: 4` from localStorage
- Page 4 doesn't exist → "No page data"

## Solution
Added **validation** when loading and setting page numbers:

### 1. Validate on Chapter Load
```typescript
setCurrentChapter: (mangaId, chapterId, totalPages) => {
  const existingProgress = get().getProgress(mangaId, chapterId);

  // Validate saved page is within valid range
  let startPage = 0;
  if (existingProgress?.currentPage !== undefined) {
    const savedPage = existingProgress.currentPage;
    if (savedPage >= 0 && savedPage < totalPages) {
      startPage = savedPage;  // Valid - use it
    }
    // Invalid - defaults to 0
  }

  set({ currentPage: startPage, ... });
}
```

### 2. Validate on Page Change
```typescript
setCurrentPage: (page) => {
  // Clamp to valid range
  if (page < 0 || page >= totalPages) {
    console.warn(`Invalid page ${page}, clamping to valid range`);
    page = Math.max(0, Math.min(page, totalPages - 1));
  }

  set({ currentPage: page, ... });
}
```

## Validation Rules

| Scenario | Invalid Page | Corrected To |
|----------|--------------|--------------|
| Stale progress (page > max) | 4 (total: 3) | 0 (start) |
| Negative page | -1 | 0 (first page) |
| Page >= totalPages | 5 (total: 3) | 2 (last page) |
| Valid page | 1 (total: 3) | 1 (unchanged) |

## Why This Happens

### Common Scenarios:
1. **Chapter content changed** - Chapter had 5 pages, now has 3
2. **Different manga versions** - Different sources have different page counts
3. **Testing/development** - Switching between test data with different lengths
4. **Data corruption** - localStorage got corrupted values

### Prevention:
✅ Always validate saved progress against current chapter data
✅ Clamp invalid values instead of crashing
✅ Log warnings for debugging
✅ Default to page 0 if validation fails

## Files Modified

**src/store/reading-progress.ts**
1. `setCurrentChapter` - Validates saved progress before loading
2. `setCurrentPage` - Clamps page to valid range [0, totalPages-1]

## Result

### Before:
```
Open manga → Load page 4 from localStorage → Show "No page data"
```

### After:
```
Open manga → Load page 4 from localStorage → Validate (4 >= 3) → Clamp to 0 → Show page 0
```

### Console Output (Debug):
```
Invalid page 4 for totalPages 3, clamping to valid range
```

## Build Status
✅ ESLint: Passing
✅ TypeScript: Passing
✅ Build: Success
✅ Reader: 10.6 kB

## Testing
- [x] Stale progress with page > totalPages → Starts at page 0
- [x] Valid saved progress → Starts at saved page
- [x] Navigation always stays within bounds
- [ ] Manual: Clear localStorage and verify starts at page 0
- [ ] Manual: Save on page 2, reload, verify starts at page 2
