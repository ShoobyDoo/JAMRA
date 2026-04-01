#!/usr/bin/env node

/**
 * Extension Validation Script
 *
 * Validates extension manifests, code structure, and SDK usage.
 * Usage: pnpm test:extensions
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}`),
  detail: (msg) => console.log(`  ${colors.gray}${msg}${colors.reset}`),
};

// Required manifest fields
const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'language', 'entry'];

// Required extension exports
const REQUIRED_EXPORTS = [
  'search',
  'getMangaDetails',
  'getChapters',
  'getPages',
];

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.details = details;
  }
}

/**
 * Validates an extension manifest.json
 */
async function validateManifest(extensionPath, extensionId) {
  const manifestPath = path.join(extensionPath, 'manifest.json');

  if (!(await fs.pathExists(manifestPath))) {
    throw new ValidationError('manifest.json not found');
  }

  let manifest;
  try {
    manifest = await fs.readJson(manifestPath);
  } catch (error) {
    throw new ValidationError('Invalid JSON in manifest.json', [
      error.message,
    ]);
  }

  const errors = [];

  // Check required fields
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate ID matches directory name
  if (manifest.id && manifest.id !== extensionId) {
    errors.push(
      `Manifest ID "${manifest.id}" doesn't match directory name "${extensionId}"`
    );
  }

  // Validate version format (semver-like)
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push(`Invalid version format: ${manifest.version} (expected: X.Y.Z)`);
  }

  // Validate entry file exists
  if (manifest.entry) {
    const entryPath = path.join(extensionPath, manifest.entry);
    if (!(await fs.pathExists(entryPath))) {
      errors.push(`Entry file not found: ${manifest.entry}`);
    }
  }

  // Validate capabilities (if present)
  if (manifest.capabilities && typeof manifest.capabilities !== 'object') {
    errors.push('capabilities must be an object');
  }

  if (errors.length > 0) {
    throw new ValidationError('Manifest validation failed', errors);
  }

  return manifest;
}

/**
 * Validates extension code by attempting to compile with esbuild
 */
async function validateCode(extensionPath, manifest) {
  const entryPath = path.join(extensionPath, manifest.entry);
  const errors = [];

  try {
    // Attempt to build the extension
    const result = await build({
      entryPoints: [entryPath],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'node',
      target: ['node18', 'node20'],
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.js': 'js',
        '.jsx': 'jsx',
      },
      external: ['@jamra/extension-sdk', '@jamra/contracts'],
      logLevel: 'silent',
      minify: false,
    });

    // Check if build produced output
    if (!result.outputFiles || result.outputFiles.length === 0) {
      errors.push('Build produced no output');
    }

    // Get the compiled code
    const compiledCode = result.outputFiles[0]?.text;

    if (compiledCode) {
      // Basic check for default export
      if (!compiledCode.includes('exports') && !compiledCode.includes('module.exports')) {
        errors.push('No exports found in compiled code (missing default export?)');
      }

      // Check for required method names in output
      const missingMethods = [];
      for (const method of REQUIRED_EXPORTS) {
        // Look for the method name in the compiled output
        const methodRegex = new RegExp(`\\b${method}\\b`);
        if (!methodRegex.test(compiledCode)) {
          missingMethods.push(method);
        }
      }

      if (missingMethods.length > 0) {
        errors.push(
          `Potentially missing required methods: ${missingMethods.join(', ')}`
        );
        errors.push(
          '  Note: This is a heuristic check. Ensure your extension exports these methods.'
        );
      }
    }
  } catch (error) {
    errors.push('Compilation failed:');
    errors.push(error.message);

    if (error.errors && error.errors.length > 0) {
      errors.push('Build errors:');
      error.errors.forEach((err) => {
        errors.push(
          `  ${err.location?.file || ''}:${err.location?.line || '?'} - ${err.text}`
        );
      });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Code validation failed', errors);
  }
}

/**
 * Validates package.json for correct SDK dependency
 */
async function validatePackageJson(extensionPath) {
  const packageJsonPath = path.join(extensionPath, 'package.json');

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new ValidationError('package.json not found', [
      'Run "pnpm install" in the extension directory',
    ]);
  }

  let packageJson;
  try {
    packageJson = await fs.readJson(packageJsonPath);
  } catch (error) {
    throw new ValidationError('Invalid JSON in package.json', [error.message]);
  }

  const errors = [];

  // Check for SDK dependency
  const hasSdkDep =
    packageJson.dependencies?.['@jamra/extension-sdk'] ||
    packageJson.devDependencies?.['@jamra/extension-sdk'];

  if (!hasSdkDep) {
    errors.push('Missing dependency: @jamra/extension-sdk');
    errors.push('  Add: "dependencies": { "@jamra/extension-sdk": "workspace:*" }');
  }

  if (errors.length > 0) {
    throw new ValidationError('package.json validation failed', errors);
  }

  return packageJson;
}

/**
 * Validates a single extension
 */
async function validateExtension(extensionPath, extensionId) {
  const results = {
    id: extensionId,
    path: extensionPath,
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    // Validate manifest
    const manifest = await validateManifest(extensionPath, extensionId);
    log.success(`Manifest valid`);

    // Validate package.json
    await validatePackageJson(extensionPath);
    log.success(`package.json valid`);

    // Validate code
    await validateCode(extensionPath, manifest);
    log.success(`Code compiles successfully`);

    // Check for TypeScript
    const isTypeScript = manifest.entry?.endsWith('.ts') || manifest.entry?.endsWith('.tsx');
    if (isTypeScript) {
      const tsconfigPath = path.join(extensionPath, 'tsconfig.json');
      if (!(await fs.pathExists(tsconfigPath))) {
        results.warnings.push('TypeScript project missing tsconfig.json');
      }
    }
  } catch (error) {
    results.valid = false;

    if (error instanceof ValidationError) {
      results.errors.push(error.message);
      if (error.details.length > 0) {
        results.errors.push(...error.details.map((d) => `  ${d}`));
      }
    } else {
      results.errors.push(error.message);
    }
  }

  return results;
}

/**
 * Main validation function
 */
async function validateAllExtensions() {
  log.title('🔍 JAMRA Extension Validator');

  const projectRoot = path.resolve(__dirname, '..');
  const extensionsDir = path.join(projectRoot, 'resources', 'extensions');

  // Check if extensions directory exists
  if (!(await fs.pathExists(extensionsDir))) {
    log.warning('Extensions directory not found');
    log.info('Run "pnpm create-extension <name>" to create your first extension');
    return;
  }

  // Get all extension directories
  const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
  const extensionDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (extensionDirs.length === 0) {
    log.warning('No extensions found');
    log.info('Run "pnpm create-extension <name>" to create an extension');
    return;
  }

  log.info(`Found ${extensionDirs.length} extension(s)\n`);

  const results = [];
  let validCount = 0;
  let invalidCount = 0;

  // Validate each extension
  for (const extensionId of extensionDirs) {
    const extensionPath = path.join(extensionsDir, extensionId);

    log.title(`📦 Validating: ${extensionId}`);
    log.detail(`Path: ${extensionPath}`);

    const result = await validateExtension(extensionPath, extensionId);
    results.push(result);

    if (result.valid) {
      validCount++;
      log.success(`${extensionId} is valid\n`);
    } else {
      invalidCount++;
      log.error(`${extensionId} validation failed:`);
      result.errors.forEach((err) => log.error(`  ${err}`));
      console.log('');
    }

    // Display warnings
    if (result.warnings.length > 0) {
      result.warnings.forEach((warn) => log.warning(warn));
      console.log('');
    }
  }

  // Summary
  log.title('📊 Validation Summary');
  console.log(`Total extensions: ${colors.cyan}${extensionDirs.length}${colors.reset}`);
  console.log(
    `Valid: ${colors.green}${validCount}${colors.reset} | Invalid: ${colors.red}${invalidCount}${colors.reset}`
  );

  if (invalidCount > 0) {
    console.log(
      `\n${colors.yellow}Fix the errors above before publishing your extensions.${colors.reset}`
    );
    process.exit(1);
  } else {
    console.log(`\n${colors.green}All extensions are valid! 🎉${colors.reset}`);
  }
}

// Run validation
validateAllExtensions().catch((error) => {
  log.error(`Validation failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
