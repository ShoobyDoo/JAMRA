# Reader Layout Fix - Architecture Changes

## Problem
The manga reader was using `fixed inset-0` positioning which caused it to overlay the entire viewport, ignoring the sidebar from AppLayout. The reader would extend beneath the left sidebar instead of respecting the content area.

## Solution
Restructured the Next.js route architecture to properly separate reader routes from app routes.

### Changes Made

#### 1. Root Layout Modification
**File**: `src/app/layout.tsx`
- Removed `AppLayout` wrapper from root layout
- Root layout now only provides Mantine provider and global styles
- This allows child routes to choose their own layout structure

#### 2. Route Group Restructuring
Created `(app)` route group for regular application pages:
```
src/app/(app)/
├── layout.tsx              # Wraps children with AppLayout
├── (account)/             # Account pages (moved)
├── (public)/              # Public pages (moved)
├── extensions/            # Extensions page (moved)
├── manga/                 # Manga details (moved)
└── search/                # Search page (moved)
```

#### 3. Reader Routes (Isolated)
Reader routes remain at root level without AppLayout:
```
src/app/read/
└── [slug]/chapter/[number]/page.tsx
```

### Layout Hierarchy

**Before:**
```
Root Layout (with AppLayout) → All pages wrapped in sidebar/header
└── Reader pages ❌ (conflicts with fixed positioning)
```

**After:**
```
Root Layout (Mantine only)
├── (app) Layout (with AppLayout) → Regular pages
│   ├── Home, Discover, Library, etc.
│   ├── Extensions, Search
│   └── Manga details
└── Reader pages ✅ (full viewport control)
    └── /read/[slug]/chapter/[number]
```

## Result
- ✅ Reader has full viewport control with `fixed inset-0`
- ✅ Regular app pages maintain sidebar/header layout
- ✅ No conflicts between layouts
- ✅ Clean separation of concerns

## Files Modified
1. `src/app/layout.tsx` - Removed AppLayout wrapper
2. `src/app/(app)/layout.tsx` - Created new app layout with AppLayout
3. `src/components/reader/hooks/use-touch-gestures.ts` - Fixed TypeScript type
4. Moved route directories into `(app)` route group

## Build Status
✅ All builds passing
✅ No TypeScript errors
✅ No ESLint warnings
