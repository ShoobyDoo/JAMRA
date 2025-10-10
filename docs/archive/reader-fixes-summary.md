# Manga Reader - Bug Fixes Summary

## Issues Fixed

### 1. TypeScript Build Error ✅
**Error**: `Argument of type 'RefObject<HTMLDivElement | null>' is not assignable to parameter of type 'RefObject<HTMLElement>'`

**File**: `src/components/reader/hooks/use-touch-gestures.ts`

**Fix**: Updated function signature to accept nullable ref
```typescript
// Before
export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  callbacks: TouchGestureCallbacks
)

// After
export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement | null>,
  callbacks: TouchGestureCallbacks
)
```

### 2. Layout Conflict - Reader Extends Under Sidebar ✅
**Problem**: Reader used `fixed inset-0` positioning which overlaid the entire viewport, extending beneath the left sidebar instead of respecting the content area.

**Root Cause**: All routes were wrapped in `AppLayout` which includes the sidebar/topbar

**Solution**: Restructured Next.js route architecture
- Removed `AppLayout` from root layout
- Created `(app)` route group for regular pages with AppLayout
- Reader routes remain at root level with full viewport control

**Files Changed**:
- `src/app/layout.tsx` - Removed AppLayout wrapper
- `src/app/(app)/layout.tsx` - Created new layout with AppLayout
- Moved all regular pages into `(app)` route group

**Result**:
```
Root Layout (Mantine only)
├── (app) Layout → Regular pages with sidebar/topbar
│   ├── Home, Discover, Extensions, etc.
│   └── Manga details
└── Reader → Full viewport control (no sidebar)
    └── /read/[slug]/chapter/[number]
```

### 3. Infinite Loop in ReaderControls ✅
**Error**: `Maximum update depth exceeded. This can happen when a component calls setState inside useEffect`

**File**: `src/components/reader/reader-controls.tsx`

**Problem**: `hideTimeout` state was being set inside useEffect and also in the dependency array, causing infinite re-renders

**Fix**: Changed `hideTimeout` from state to ref
```typescript
// Before
const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

useEffect(() => {
  // ... code that calls setHideTimeout(timeout)
}, [autoHideControls, autoHideDelay, zenMode, hideTimeout]); // ❌ hideTimeout causes infinite loop

// After
const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  // ... code that sets hideTimeoutRef.current = timeout
}, [autoHideControls, autoHideDelay, zenMode]); // ✅ No infinite loop
```

**Why this works**:
- `useRef` doesn't trigger re-renders when its value changes
- Timeout tracking doesn't need to be reactive state
- Effect only re-runs when settings actually change

## Build Status

✅ **All Builds Passing**
- TypeScript compilation: Success
- ESLint: No errors, no warnings
- Next.js build: Success
- All 12 routes building correctly

## Testing Checklist

- [x] Build completes without errors
- [x] TypeScript types are correct
- [x] No infinite loops or console errors
- [ ] Reader displays without overlapping sidebar
- [ ] Auto-hide controls work correctly
- [ ] Touch gestures function properly
- [ ] All reading modes render correctly

## Files Modified

1. `src/app/layout.tsx` - Removed AppLayout wrapper
2. `src/app/(app)/layout.tsx` - Created app layout
3. `src/components/reader/hooks/use-touch-gestures.ts` - Fixed TS type
4. `src/components/reader/reader-controls.tsx` - Fixed infinite loop
5. Route restructuring - Moved pages into `(app)` group
