# Building JAMRA for Distribution

This guide explains how to build distributable packages for Windows, macOS, and Linux.

## Prerequisites

### All Platforms
- **Node.js 24+** (required for building)
- **pnpm 8+** (package manager)
- **Python & C++ build tools** (for native modules like better-sqlite3)

### Platform-Specific Requirements

#### macOS
- **Xcode Command Line Tools**: `xcode-select --install`
- **For code signing** (optional but recommended for distribution):
  - Apple Developer account
  - Developer ID Application certificate
  - Set environment variables:
    ```bash
    export CSC_LINK="/path/to/certificate.p12"
    export CSC_KEY_PASSWORD="your-certificate-password"
    ```

#### Windows
- **Visual Studio Build Tools** or **Visual Studio 2019+**
  - Install "Desktop development with C++" workload
  - Or use: `npm install --global windows-build-tools` (requires admin)

#### Linux
- **Build essentials**:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install build-essential libsqlite3-dev

  # Fedora/RHEL
  sudo dnf install @development-tools sqlite-devel

  # Arch
  sudo pacman -S base-devel sqlite
  ```

## Icons

Before building, you need to create application icons:

1. Create a high-resolution PNG (1024x1024 recommended)
2. Follow the instructions in [`build/README.md`](./build/README.md) to generate platform-specific icons
3. Place icons in the `build/` directory:
   - `build/icon.icns` (macOS)
   - `build/icon.ico` (Windows)
   - `build/icons/*.png` (Linux - multiple sizes)

## Build Commands

### Install Dependencies
```bash
pnpm install
```

### Build for Current Platform
```bash
# Builds for the platform you're currently on
pnpm run dist
```

### Build for Specific Platforms
```bash
# macOS (DMG + ZIP for both Intel and Apple Silicon)
pnpm run dist:mac

# Windows (NSIS installer + portable executable)
pnpm run dist:win

# Linux (AppImage, DEB, and RPM packages)
pnpm run dist:linux
```

### Build for All Platforms
```bash
# Builds for macOS, Windows, and Linux
pnpm run dist:all
```

**Note**: Cross-platform building has limitations:
- **macOS builds** typically require macOS (or use electron-builder's remote build service)
- **Windows & Linux** can be built from any platform

## Output

Built packages will be in the `dist-electron/` directory:

```
dist-electron/
├── JAMRA-0.1.0.dmg              # macOS installer (universal)
├── JAMRA-0.1.0-mac.zip          # macOS portable
├── JAMRA Setup 0.1.0.exe        # Windows installer
├── JAMRA 0.1.0.exe              # Windows portable
├── JAMRA-0.1.0.AppImage         # Linux universal
├── jamra_0.1.0_amd64.deb        # Debian/Ubuntu package
└── jamra-0.1.0.x86_64.rpm       # Fedora/RHEL package
```

## Platform-Specific Notes

### macOS

#### Universal Binaries
The build creates universal binaries supporting both Intel (x64) and Apple Silicon (arm64).

#### Code Signing
For distribution outside the App Store:
1. Get a Developer ID certificate from Apple
2. Set environment variables (see Prerequisites)
3. Build will automatically sign and notarize

Without signing, users will see "unidentified developer" warnings.

### Windows

#### Installer Types
- **NSIS**: Traditional Windows installer with install wizard
- **Portable**: Single executable, no installation required

#### SmartScreen
Without code signing, Windows SmartScreen may show warnings. To avoid:
1. Get a code signing certificate from a trusted CA
2. Set environment variables:
   ```bash
   export CSC_LINK="/path/to/certificate.pfx"
   export CSC_KEY_PASSWORD="your-certificate-password"
   ```

### Linux

#### Package Formats
- **AppImage**: Universal format, works on most distributions
- **DEB**: Debian, Ubuntu, Linux Mint, etc.
- **RPM**: Fedora, RHEL, CentOS, openSUSE, etc.

#### Permissions
Some distributions may require setting the executable bit on AppImage:
```bash
chmod +x JAMRA-0.1.0.AppImage
```

## Native Modules

### better-sqlite3
The app uses `better-sqlite3` which requires native compilation. electron-builder handles this automatically:

1. **During build**: Native modules are rebuilt for each target platform
2. **asarUnpack**: better-sqlite3 is unpacked from the ASAR archive for proper loading
3. **afterPack hook**: Cleans up unnecessary build artifacts

If you encounter issues:
```bash
# Rebuild native modules for Electron
pnpm exec electron-rebuild

# Or use the project's refresh script
pnpm run desktop:refresh
```

## CI/CD

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - uses: pnpm/action-setup@v4
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm run dist

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-build
          path: dist-electron/*
```

## Troubleshooting

### Build fails with "Cannot find module 'better-sqlite3'"
```bash
pnpm install
pnpm run desktop:refresh
```

### macOS: "App is damaged and can't be opened"
The app needs to be code-signed. Either:
1. Sign the app properly with a Developer ID certificate
2. For development, run: `xattr -cr /path/to/JAMRA.app`

### Windows: "Windows protected your PC"
This is SmartScreen. Users can click "More info" → "Run anyway", or you can code-sign the app.

### Linux: "Permission denied"
```bash
chmod +x JAMRA-0.1.0.AppImage
```

## File Size Optimization

Built apps include the full Next.js build, backend packages, and node_modules. To reduce size:

1. The build already excludes:
   - Source maps (`*.map`)
   - TypeScript files (`*.ts`)
   - pnpm cache (`.pnpm`)

2. For further optimization, audit node_modules:
   ```bash
   npx npkill
   ```

3. Consider using `--compress` flag (increases build time):
   ```bash
   pnpm run dist -- --compress
   ```

## Environment Variables

You can customize builds with environment variables:

```bash
# Skip code signing
export CSC_IDENTITY_AUTO_DISCOVERY=false

# Change output directory
export ELECTRON_BUILDER_OUTPUT_DIR=custom-dist

# Enable verbose logging
export DEBUG=electron-builder
```

## Support

For issues with electron-builder, check:
- [electron-builder documentation](https://www.electron.build/)
- [better-sqlite3 documentation](https://github.com/WiseLibs/better-sqlite3)
