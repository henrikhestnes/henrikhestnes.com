#!/bin/sh
# Regenerate cv.pdf from cv.html with headless Chrome. Run after any edit to cv.html.
set -eu
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=3000 \
  --print-to-pdf="$PWD/cv.pdf" "file://$PWD/cv.html" 2>/dev/null
pages=$(strings cv.pdf | grep -o '/Count [0-9]*' | head -1 | cut -d' ' -f2)
echo "cv.pdf: $(wc -c < cv.pdf | tr -d ' ') bytes, $pages page(s)"
[ "$pages" = 1 ] || { echo "cv.pdf is not one page; tighten the print styles in cv.html" >&2; exit 1; }
