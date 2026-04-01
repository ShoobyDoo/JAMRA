#!/usr/bin/env node

/**
 * Extension Scaffolding CLI
 *
 * Creates a new JAMRA extension with TypeScript or JavaScript template.
 * Usage: pnpm create-extension <extension-name>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}\n`),
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Extension templates
const templates = {
  typescript: {
    'manifest.json': (id, name) => JSON.stringify({
      id,
      name,
      version: '1.0.0',
      language: 'en',
      entry: 'src/index.ts',
      capabilities: {
        filters: {
          language: false,
          contentRating: false,
          status: false,
          includeTags: false,
          excludeTags: false,
        },
      },
    }, null, 2),

    'package.json': (id) => JSON.stringify({
      name: `@jamra-extension/${id}`,
      version: '1.0.0',
      private: true,
      type: 'module',
      dependencies: {
        '@jamra/extension-sdk': 'workspace:*',
      },
      devDependencies: {
        'typescript': '^5.7.3',
      },
    }, null, 2),

    'tsconfig.json': () => JSON.stringify({
      extends: '../../../tsconfig.base.json',
      compilerOptions: {
        outDir: './dist',
        rootDir: './src',
        module: 'ESNext',
        target: 'ES2022',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ['src/**/*'],
    }, null, 2),

    'src/index.ts': (name) => `import type {
  ExtensionModule,
  ExtensionContext,
  SearchPayload,
  MangaSearchResult,
  MangaDetailsPayload,
  MangaDetailsResult,
  ChapterPayload,
  Chapter,
  PagesResult,
} from '@jamra/extension-sdk';
import { defineExtensionManifest } from '@jamra/extension-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };

const manifest = defineExtensionManifest(manifestJson);

/**
 * ${name} Extension
 *
 * TODO: Implement the following methods:
 * - search: Search for manga by query and filters
 * - getMangaDetails: Get detailed information about a manga
 * - getChapters: Get list of chapters for a manga
 * - getPages: Get pages/images for a chapter
 */
const extension: ExtensionModule = {
  manifest,

  async search(
    payload: SearchPayload,
    context: ExtensionContext
  ): Promise<MangaSearchResult> {
    context.logger.info('Search called', { query: payload.query });

    // TODO: Implement search logic
    throw new Error('Not implemented');
  },

  async getMangaDetails(
    payload: MangaDetailsPayload,
    context: ExtensionContext
  ): Promise<MangaDetailsResult> {
    context.logger.info('Get manga details called', { mangaId: payload.mangaId });

    // TODO: Implement manga details logic
    throw new Error('Not implemented');
  },

  async getChapters(
    payload: MangaDetailsPayload,
    context: ExtensionContext
  ): Promise<Chapter[]> {
    context.logger.info('Get chapters called', { mangaId: payload.mangaId });

    // TODO: Implement chapters logic
    throw new Error('Not implemented');
  },

  async getPages(
    payload: ChapterPayload,
    context: ExtensionContext
  ): Promise<PagesResult> {
    context.logger.info('Get pages called', {
      mangaId: payload.mangaId,
      chapterId: payload.chapterId
    });

    // TODO: Implement pages logic
    throw new Error('Not implemented');
  },
};

export default extension;
`,

    '.gitignore': () => `# Dependencies
node_modules/

# Build output
dist/

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
`,
  },

  javascript: {
    'manifest.json': (id, name) => JSON.stringify({
      id,
      name,
      version: '1.0.0',
      language: 'en',
      entry: 'src/index.js',
      capabilities: {
        filters: {
          language: false,
          contentRating: false,
          status: false,
          includeTags: false,
          excludeTags: false,
        },
      },
    }, null, 2),

    'package.json': (id) => JSON.stringify({
      name: `@jamra-extension/${id}`,
      version: '1.0.0',
      private: true,
      type: 'module',
      dependencies: {
        '@jamra/extension-sdk': 'workspace:*',
      },
    }, null, 2),

    'src/index.js': (name) => `import { defineExtensionManifest } from '@jamra/extension-sdk';
import manifestJson from '../manifest.json' with { type: 'json' };

const manifest = defineExtensionManifest(manifestJson);

/**
 * ${name} Extension
 *
 * TODO: Implement the following methods:
 * - search: Search for manga by query and filters
 * - getMangaDetails: Get detailed information about a manga
 * - getChapters: Get list of chapters for a manga
 * - getPages: Get pages/images for a chapter
 */

/**
 * @param {import('@jamra/extension-sdk').SearchPayload} payload
 * @param {import('@jamra/extension-sdk').ExtensionContext} context
 * @returns {Promise<import('@jamra/extension-sdk').MangaSearchResult>}
 */
async function search(payload, context) {
  context.logger.info('Search called', { query: payload.query });

  // TODO: Implement search logic
  throw new Error('Not implemented');
}

/**
 * @param {import('@jamra/extension-sdk').MangaDetailsPayload} payload
 * @param {import('@jamra/extension-sdk').ExtensionContext} context
 * @returns {Promise<import('@jamra/extension-sdk').MangaDetailsResult>}
 */
async function getMangaDetails(payload, context) {
  context.logger.info('Get manga details called', { mangaId: payload.mangaId });

  // TODO: Implement manga details logic
  throw new Error('Not implemented');
}

/**
 * @param {import('@jamra/extension-sdk').MangaDetailsPayload} payload
 * @param {import('@jamra/extension-sdk').ExtensionContext} context
 * @returns {Promise<import('@jamra/extension-sdk').Chapter[]>}
 */
async function getChapters(payload, context) {
  context.logger.info('Get chapters called', { mangaId: payload.mangaId });

  // TODO: Implement chapters logic
  throw new Error('Not implemented');
}

/**
 * @param {import('@jamra/extension-sdk').ChapterPayload} payload
 * @param {import('@jamra/extension-sdk').ExtensionContext} context
 * @returns {Promise<import('@jamra/extension-sdk').PagesResult>}
 */
async function getPages(payload, context) {
  context.logger.info('Get pages called', {
    mangaId: payload.mangaId,
    chapterId: payload.chapterId
  });

  // TODO: Implement pages logic
  throw new Error('Not implemented');
}

const extension = {
  manifest,
  search,
  getMangaDetails,
  getChapters,
  getPages,
};

export default extension;
`,

    '.gitignore': () => `# Dependencies
node_modules/

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
`,
  },
};

async function createExtension() {
  try {
    log.title('🚀 JAMRA Extension Generator');

    // Get extension name from args or prompt
    let extensionName = process.argv[2];

    if (!extensionName) {
      extensionName = await question('Extension name (e.g., my-manga-source): ');
    }

    if (!extensionName || extensionName.trim() === '') {
      log.error('Extension name is required');
      process.exit(1);
    }

    // Sanitize extension ID (lowercase, no spaces, alphanumeric + hyphens only)
    const extensionId = extensionName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (extensionId !== extensionName.toLowerCase().trim()) {
      log.warning(`Extension ID sanitized to: ${extensionId}`);
    }

    // Check if extension already exists
    const projectRoot = path.resolve(__dirname, '..');
    const extensionsDir = path.join(projectRoot, 'resources', 'extensions');
    const extensionPath = path.join(extensionsDir, extensionId);

    if (fs.existsSync(extensionPath)) {
      log.error(`Extension "${extensionId}" already exists at ${extensionPath}`);
      process.exit(1);
    }

    // Ask for template preference
    console.log('\nChoose template:');
    console.log('  1) TypeScript (recommended)');
    console.log('  2) JavaScript');

    const templateChoice = await question('\nYour choice (1 or 2): ');
    const useTypeScript = templateChoice === '1' || templateChoice.toLowerCase().includes('t');
    const templateType = useTypeScript ? 'typescript' : 'javascript';

    log.info(`Using ${useTypeScript ? 'TypeScript' : 'JavaScript'} template`);

    // Create extension directory
    log.info(`Creating extension at: ${extensionPath}`);
    fs.mkdirSync(extensionPath, { recursive: true });
    fs.mkdirSync(path.join(extensionPath, 'src'), { recursive: true });

    // Generate files from template
    const template = templates[templateType];
    const displayName = extensionName
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    for (const [filePath, contentFn] of Object.entries(template)) {
      const fullPath = path.join(extensionPath, filePath);
      const content = contentFn(extensionId, displayName);
      fs.writeFileSync(fullPath, content, 'utf8');
      log.success(`Created ${filePath}`);
    }

    // Install dependencies
    log.info('Installing dependencies...');
    try {
      execSync('pnpm install', {
        cwd: projectRoot,
        stdio: 'inherit',
      });
      log.success('Dependencies installed');
    } catch (error) {
      log.warning('Failed to install dependencies. Run "pnpm install" manually.');
    }

    // Success message
    log.title('✨ Extension created successfully!');
    console.log(`${colors.cyan}Extension ID:${colors.reset} ${extensionId}`);
    console.log(`${colors.cyan}Location:${colors.reset} resources/extensions/${extensionId}`);
    console.log(`${colors.cyan}Template:${colors.reset} ${templateType}`);

    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(`  1. Edit ${colors.cyan}resources/extensions/${extensionId}/src/index.${useTypeScript ? 'ts' : 'js'}${colors.reset}`);
    console.log(`  2. Implement the required methods (search, getMangaDetails, getChapters, getPages)`);
    console.log(`  3. Run ${colors.cyan}pnpm dev${colors.reset} to test your extension`);
    console.log(`  4. Run ${colors.cyan}pnpm test:extensions${colors.reset} to validate`);

    console.log(`\n${colors.bright}Publishing:${colors.reset}`);
    console.log(`  When ready to publish, create a PR against your desired extensions repository.`);
    console.log(`  ${colors.yellow}Note: Local extensions are for development only and won't be bundled with the app.${colors.reset}`);

    console.log(`\n${colors.bright}Documentation:${colors.reset}`);
    console.log(`  See docs/EXTENSION_DEVELOPMENT.md for the complete guide.`);
    console.log('');

  } catch (error) {
    log.error(`Failed to create extension: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the CLI
createExtension();
