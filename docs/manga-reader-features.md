# Manga Reader - Feature Documentation

## Overview
A fully-featured, modern manga reader with support for multiple reading modes, intelligent preloading, and comprehensive customization options.

## Features Implemented

### Reading Modes
- **Paged LTR**: Traditional left-to-right pagination (like Western comics)
- **Paged RTL**: Right-to-left pagination (traditional manga style)
- **Dual Page**: Side-by-side page display for desktop reading
- **Vertical Scroll**: Continuous vertical scrolling for webtoons/manhwa (gap-free)

### Navigation

#### Keyboard Controls
- `Arrow Left/Right`: Navigate pages (respects RTL mode)
- `Arrow Up/Down`: Navigate pages (in paged modes) or scroll (in vertical mode)
- `Space`: Next page
- `Shift + Space`: Previous page
- `Home`: Jump to first page
- `End`: Jump to last page
- `M`: Cycle through reading modes
- `F`: Toggle fullscreen/Zen mode
- `S`: Open settings panel
- `Esc`: Exit reader

#### Touch Gestures
- **Swipe Left/Right**: Navigate pages (direction-aware based on reading mode)
- **Double Tap**: Toggle between fit-width and fit-height
- **Long Press**: Open settings panel

#### Mouse Controls
- **Click Left/Right Side**: Navigate to previous/next page
- **Slider**: Jump to specific page

### Display Options

#### Page Fit Modes
- **Auto**: Smart fitting based on image aspect ratio
- **Fit Width**: Scale to container width
- **Fit Height**: Scale to container height
- **Original Size**: Display at original dimensions

#### Background Colors
- Black (default for manga)
- Dark Gray
- White (for light mode readers)
- Sepia (easy on eyes)

### Performance Features

#### Intelligent Image Preloading
- Preloads 5 pages ahead by default (configurable 1-10)
- Preloads 2 pages behind for quick back navigation
- Memory-aware caching
- Automatic cleanup on chapter/mode change

#### Vertical Mode Optimizations
- Custom scroll speed control (1-10 scale)
- Intersection Observer for page tracking
- Lazy loading for off-screen images
- Smooth momentum scrolling

### UI/UX Features

#### Zen Mode
- Fullscreen reading experience
- Auto-hide controls (configurable delay: 0.5s - 10s)
- Minimal distraction overlay
- Show controls on mouse move/keyboard/touch

#### Progress Tracking
- Auto-save current page position
- Persist to localStorage
- Resume from last read position
- Chapter completion detection
- Progress bar with visual indicator

#### Reader Controls
- **Top Bar**: Back button, manga/chapter title, mode indicator, fullscreen toggle, settings
- **Bottom Bar**: Page navigation, progress slider, page counter
- **Settings Panel**: Slide-out panel with all customization options

### Customization Settings

#### Reading Preferences
- Reading mode selection
- Page fit mode
- Background color
- Preload count

#### Mode-Specific Settings
- **Vertical Mode**: Scroll speed, gap between pages
- **Dual Page Mode**: Gap between pages

#### UI Behavior
- Auto-hide controls toggle
- Auto-hide delay (customizable)
- Reset to defaults option

### State Management

#### Zustand Stores
- **reader-settings**: User preferences (persisted)
  - Reading mode, page fit, colors
  - Performance settings
  - UI preferences

- **reading-progress**: Session & history (persisted)
  - Current page per manga/chapter
  - Reading history
  - Last read timestamps
  - Preloaded images cache

### Technical Implementation

#### Component Structure
```
src/components/reader/
├── manga-reader.tsx              # Main orchestrator
├── reader-controls.tsx           # UI overlay controls
├── reader-settings-panel.tsx     # Settings drawer
├── reading-modes/
│   ├── paged-mode.tsx           # LTR/RTL pagination
│   ├── dual-page-mode.tsx       # Side-by-side display
│   └── vertical-mode.tsx        # Webtoon scroll
└── hooks/
    ├── use-reader-navigation.ts  # Keyboard shortcuts
    ├── use-image-preloader.ts    # Intelligent prefetch
    ├── use-reader-progress.ts    # Progress tracking
    └── use-touch-gestures.ts     # Touch interactions
```

#### State Flow
1. Server Component fetches chapter pages
2. MangaReader client component orchestrates
3. Settings/progress from Zustand stores
4. Hooks handle navigation/preloading/gestures
5. Mode components render pages based on settings

## Usage

### Basic Integration
```tsx
import { MangaReader } from "@/components/reader/manga-reader";

<MangaReader
  mangaId="manga-slug"
  mangaTitle="Manga Title"
  chapterId="chapter-1"
  chapterTitle="Chapter 1: Beginning"
  pages={[
    { index: 0, url: "...", width: 1080, height: 1920 },
    // ...
  ]}
/>
```

### Accessing Reader Settings
```tsx
import { useReaderSettings } from "@/store/reader-settings";

const { readingMode, setReadingMode } = useReaderSettings();
```

### Accessing Reading Progress
```tsx
import { useReadingProgress } from "@/store/reading-progress";

const { progress, getProgress } = useReadingProgress();
const chapterProgress = getProgress(mangaId, chapterId);
```

## Future Enhancements
- [ ] Chapter auto-advance (load next chapter at end)
- [ ] Page bookmarks/annotations
- [ ] Reading statistics (speed, time spent)
- [ ] Offline page cache (service worker)
- [ ] Screen brightness control
- [ ] Page transition effects
- [ ] High contrast/accessibility modes
- [ ] Multi-language UI

## Testing Checklist
- [x] All reading modes work correctly
- [x] Keyboard navigation (all shortcuts)
- [x] Touch gestures (swipe, double-tap, long-press)
- [x] Page preloading performance
- [x] Progress persistence across sessions
- [x] Settings persistence
- [x] Fullscreen/Zen mode
- [x] Auto-hide controls
- [x] RTL mode navigation
- [ ] Mobile responsiveness (iOS/Android)
- [ ] Cross-browser testing (Safari, Firefox, Chrome)
- [ ] Performance with large chapters (100+ pages)
