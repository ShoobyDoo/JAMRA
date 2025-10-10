# Notifications Audit

## Current Notification Usage

### ✅ Implemented
1. **Settings Page** - Data nuke operation
   - Success: "Data cleared" (2500ms delay before reload)
   - Error: "Failed to clear data"

## Opportunities for Notifications

### 🔴 High Priority (User-Facing Actions)

#### 1. **Extensions Manager** (`src/components/extensions/extensions-manager.tsx`)

**Enable Extension** (line 255-267)
- Current: Sets error state only
- Should add: Success notification "Extension enabled successfully"
- Error handling: Already shows error

**Disable Extension** (line 269-283)
- Current: Sets error state only
- Should add: Success notification "Extension disabled successfully"
- Error handling: Already shows error

**Install Extension from Path** (line 231-253)
- Current: Sets error state, clears form
- Should add: Success notification "Extension installed successfully"
- Error handling: Already shows error

**Install from Marketplace** (line 463-488)
- Current: Sets error state, switches tab
- Should add: Success notification "{Extension name} installed successfully"
- Error handling: Already shows error

**Uninstall Extension** (line 291-307)
- Current: Silent success, removes from list
- Should add: Success notification "Extension uninstalled successfully"
- Error handling: Already shows error

**Apply Update** (line 353-379)
- Current: Silent success
- Should add: Success notification "Extension updated to v{version}"
- Error handling: Already shows error

**Save Settings** (line 392-433)
- Current: Closes modal on success, shows error in modal
- Should add: Success notification "Settings saved successfully"
- Error handling: Already shows error in modal

**Check for Updates** (line 309-333)
- Current: Silent success (updates UI state)
- Could add: Info notification if update found, or success if no update
- Error handling: Already shows error

**Acknowledge Update** (line 335-351)
- Current: Silent success
- Could add: Success notification "Update marked as read"
- Error handling: Already shows error

**Copy to Clipboard** (line 135-143)
- Current: Shows check icon for 2 seconds
- Could add: Success toast "Copied to clipboard" (subtle, auto-close fast)
- Error handling: Console.error only - should show error notification

---

#### 2. **Clear Chapters Button** (`src/components/manga/clear-chapters-button.tsx`)

**Clear Chapter Cache** (line 15-30)
- Current: Uses native `confirm()` and `alert()`
- Should replace:
  - `confirm()` → Mantine modal
  - Success → Notification "Chapter cache cleared" (before reload)
  - `alert()` → Error notification

---

### 🟡 Medium Priority (Background/Async Actions)

#### 3. **App Warmup** (`src/components/system/app-warmup.tsx`)
**Health Check**
- Could add: Error notification if API is down
- Info notification: "Connecting to API server..."

#### 4. **Chapter List** (`src/components/manga/chapter-list.tsx`)
**Load More Chapters**
- Could add: Error notification if load fails
- Current: Likely silent failure

---

### 🟢 Nice to Have

#### 5. **Search Bar** (`src/components/topbar/search-bar.tsx`)
**Search Errors**
- Could add: Error notification if search API fails
- Currently: Silent failure?

#### 6. **Reader** (`src/components/reader/manga-reader.tsx`)
**Save Reading Progress**
- Could add: Subtle success notification "Progress saved" (very subtle, bottom-left)
- Error: "Failed to save progress"

---

## Recommendations

### Phase 1: Critical User Actions
1. **Extensions Manager** - Add success notifications for all actions (enable, disable, install, uninstall, update)
2. **Clear Chapters Button** - Replace native alerts with Mantine notifications

### Phase 2: Error Handling
1. Add error notifications for all network failures
2. Replace `console.error` with user-facing error notifications

### Phase 3: Polish
1. Add subtle success notifications for background operations
2. Add "undo" functionality where appropriate (e.g., uninstall extension)

---

## Implementation Pattern

```typescript
import { notifications } from "@mantine/notifications";

// Success notification
notifications.show({
  title: "Success",
  message: "Operation completed successfully",
  color: "green",
  autoClose: 3000, // 3 seconds
});

// Error notification
notifications.show({
  title: "Error",
  message: error instanceof Error ? error.message : "Unknown error",
  color: "red",
  autoClose: 5000, // 5 seconds for errors
});

// Info notification
notifications.show({
  title: "Info",
  message: "Something you should know",
  color: "blue",
  autoClose: 4000,
});

// Warning notification
notifications.show({
  title: "Warning",
  message: "Be careful with this",
  color: "yellow",
  autoClose: 4000,
});
```

---

## Notes

- Notification delay in settings page: **Line 82** (`setTimeout(..., 2500)`)
- All notifications use Mantine's notification system (already installed)
- Notifications appear at `position="top-right"` with `zIndex={10000}` (set in layout.tsx)
- Don't over-notify: Keep success messages brief and auto-close quickly
- Error messages can stay longer (5s) so users can read them
- Consider adding icons to notifications for better UX
