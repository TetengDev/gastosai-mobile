#!/usr/bin/env bash
# Bumps package.json's version and app.json's expo.version together — the two must
# never drift, since app.json is what the build reads and what X-App-Version reports
# to the backend (see CLAUDE.md, ai/skills/shared/pre-pr-checklist.md §5).
set -euo pipefail

cd "$(dirname "$0")/.."

bump="${1:-patch}"
case "$bump" in
  patch|minor|major) ;;
  *)
    echo "Usage: $0 [patch|minor|major]" >&2
    exit 1
    ;;
esac

node - "$bump" <<'EOF'
const fs = require('fs');

const bump = process.argv[2];
const pkgPath = 'package.json';
const appPath = 'app.json';

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

if (pkg.version !== app.expo.version) {
  console.error(
    `version drift: package.json is ${pkg.version}, app.json is ${app.expo.version} — fix by hand before bumping`
  );
  process.exit(1);
}

const [major, minor, patch] = pkg.version.split('.').map(Number);
const next =
  bump === 'major' ? `${major + 1}.0.0` :
  bump === 'minor' ? `${major}.${minor + 1}.0` :
  `${major}.${minor}.${patch + 1}`;

const previous = pkg.version;
pkg.version = next;
app.expo.version = next;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

console.log(`${previous} -> ${next} (package.json, app.json)`);
EOF
