#!/usr/bin/env bash
# 本地检查：前端语法 + 后端编译 + 假模型冒烟
set -euo pipefail
cd "$(dirname "$0")/.."
node --check assets/app.js
node --check sw.js
node tests/frontend_import.cjs
python -m py_compile server/main.py tests/smoke.py
python tests/smoke.py
echo "all checks passed"
