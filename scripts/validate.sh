#!/usr/bin/env bash
set -euo pipefail
for file in *.js; do node --check "$file"; done
node scripts/check.mjs
node scripts/sync-plan-mirrors.mjs --check
node scripts/privacy-check.mjs
node --test scripts/*test.mjs
python -m pytest -q server/banya-sync/test_*.py scripts/test_ecs_release.py
for file in server/banya-sync/*.sh; do bash -n "$file"; done
python scripts/ecs_package.py build /tmp/banya-validated-site.tgz
