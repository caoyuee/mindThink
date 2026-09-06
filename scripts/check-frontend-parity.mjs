#!/usr/bin/env node
/**
 * check-frontend-parity.mjs
 * --------------------------------------------
 * Guardrail for the two hand-synced front-end trees in this repo:
 *
 *   mindmap-vue3/src   (Web, browser / File System Access I/O)
 *   tauri-spike/src    (Tauri 2.x desktop, platform-routed I/O)
 *
 * They are kept in ONE git repo but maintained as two source trees. This
 * script verifies that every *shared* source file (present in both trees and
 * not deliberately platform-specific) is byte-identical after normalising
 * CRLF -> LF, so an accidental one-sided edit to a shared file is caught in
 * CI/verify.
 *
 * Files that are intentionally allowed to differ are recorded below under
 * EXCLUDED_PATHS (see the A1 notes in NEXT-PLAN.md for the per-file reasons).
 *
 * Exit code: 0 when every must-match file is identical, 1 otherwise (lists the
 * mismatches on stdout/stderr). Windows-path safe; Node built-ins only.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const WEB_SRC = join(REPO_ROOT, 'mindmap-vue3', 'src');
const TAURI_SRC = join(REPO_ROOT, 'tauri-spike', 'src');

/**
 * Relative-to-src (forward slash) paths that are allowed to differ between the
 * two trees, with the reason they were classified as a *reasonable* difference
 * during A1 rather than an accidental drift to converge.
 *   - App.vue                desktop shell / menu / MCP / autosave wiring
 *   - env.d.ts               Tauri declares __TAURI__ / __TAURI_INTERNALS__
 *   - core/file.ts           by design: Web = File System Access; Tauri = routing shell
 *   - components/layout/AppStatusBar.vue   Tauri currentFile / dirty indicator
 *   - components/panels/Toolbar.vue         Tauri recent-files / save-as controls
 *   - stores/config.ts       Tauri-only documentPath / recentFiles state
 *   - stores/mindmap.ts      Tauri-only save-at-path / backup / openRecent actions
 * Directories that may differ wholesale:
 *   - i18n/locales/          per-platform translation files (kept in sync manually)
 *   - tests/                 per-platform test suites
 */
const EXCLUDED_PATHS = new Set([
  'App.vue',
  'env.d.ts',
  'core/file.ts',
  'components/layout/AppStatusBar.vue',
  'components/panels/Toolbar.vue',
  'stores/config.ts',
  'stores/mindmap.ts',
]);

const EXCLUDED_DIR_PREFIXES = ['i18n/locales/', 'tests/'];

function isExcluded(rel) {
  if (EXCLUDED_PATHS.has(rel)) return true;
  return EXCLUDED_DIR_PREFIXES.some((p) => rel.startsWith(p));
}

function normalize(p) {
  return p.split(sep).join('/');
}

function collectFiles(root) {
  const out = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        out.add(normalize(relative(root, full)));
      }
    }
  };
  walk(root);
  return out;
}

function readNormalized(absPath) {
  return readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n');
}

const webFiles = collectFiles(WEB_SRC);
const tauriFiles = collectFiles(TAURI_SRC);

const shared = [...webFiles].filter((f) => tauriFiles.has(f));
const onlyWeb = [...webFiles].filter((f) => !tauriFiles.has(f)).sort();
const onlyTauri = [...tauriFiles].filter((f) => !webFiles.has(f)).sort();

const mismatches = [];

for (const rel of shared) {
  if (isExcluded(rel)) continue; // recorded reasonable difference
  const a = readNormalized(join(WEB_SRC, ...rel.split('/')));
  const b = readNormalized(join(TAURI_SRC, ...rel.split('/')));
  if (a !== b) {
    mismatches.push(rel);
  }
}

const line = '='.repeat(64);
console.log(line);
console.log('front-end tree parity check (CRLF-normalised)');
console.log(`  web src   : ${WEB_SRC}`);
console.log(`  tauri src : ${TAURI_SRC}`);
console.log(line);

const sharedChecked = shared.filter((f) => !isExcluded(f)).length;
console.log(`shared files compared      : ${sharedChecked}`);
console.log(`files allowed to differ    : ${shared.length - sharedChecked}`);
console.log(`mismatches found           : ${mismatches.length}`);

if (onlyWeb.length) {
  console.log(`\n[info] present only in WEB  (${onlyWeb.length}):`);
  for (const f of onlyWeb) console.log(`   + ${f}`);
}
if (onlyTauri.length) {
  console.log(`\n[info] present only in TAURI (${onlyTauri.length}):`);
  for (const f of onlyTauri) console.log(`   + ${f}`);
}

if (mismatches.length) {
  console.error(
    `\nPARITY FAILED: ${mismatches.length} shared file(s) drifted apart. ` +
      `If the change is an intentional platform difference, add it to ` +
      `EXCLUDED_PATHS in ${relative(process.cwd(), fileURLToPath(import.meta.url))} ` +
      `with a comment; otherwise copy the canonical version across both trees.`,
  );
  for (const f of mismatches.sort()) {
    console.error(`   ! ${f}`);
  }
  process.exit(1);
}

console.log('\nPARITY OK: every shared file is identical.');
process.exit(0);
