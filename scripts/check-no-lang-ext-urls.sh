#!/usr/bin/env bash
# File:    scripts/check-no-lang-ext-urls.sh
# Purpose: One of the owner's standard rules (policy pack mwbm-standard): web addresses people see should not end in the
#          name of the programming language behind them (/login.php, /page.asp). This script lists any such address
#          found in a project's markup, templates and docs, so it can be fixed. It is read-only.
# Usage:   bash scripts/check-no-lang-ext-urls.sh [folder]      (default: the current folder)
# Output:  one line per hit, "file:line: text"; exit 1 if there are any, 0 if none.
# Notes:   Text inside a fenced code block (``` or ~~~) in a markdown file is ignored: an example is not a link.
#          Works with the old bash 3.2 that macOS ships.
set -u
root="${1:-.}"
[ -d "$root" ] || { echo "not a folder: $root" >&2; exit 2; }
found=0
# Files to look at: markup, templates and docs; never dependency or build folders.
while IFS= read -r f; do
  case "$f" in
    *.md|*.markdown) fence=1 ;;
    *) fence=0 ;;
  esac
  awk -v file="$f" -v fence="$fence" '
    fence && /^[[:space:]]*(```|~~~)/ { infence = !infence; next }
    infence { next }
    {
      line = $0
      # an address (href, src, action, a full URL, or a root-relative path) ending in a language extension
      while (match(line, /(href|src|action)=["'"'"'][^"'"'"' ]*\.(php|asp|aspx|jsp|cfm|cgi|pl)([?#"'"'"'])|https?:\/\/[^ "'"'"')<>]*\.(php|asp|aspx|jsp|cfm|cgi|pl)([?#" )<>]|$)|\]\(\/[^) ]*\.(php|asp|aspx|jsp|cfm|cgi|pl)[)?#]/)) {
        printf "%s:%d: %s\n", file, NR, substr(line, RSTART, RLENGTH); found = 1
        line = substr(line, RSTART + RLENGTH)
      }
    }
    END { exit found ? 3 : 0 }
  ' "$f" || { [ "$?" -eq 3 ] && found=1; }
done < <(find "$root" \( -name .git -o -name node_modules -o -name vendor -o -name dist -o -name build \) -prune -o -type f \( -name '*.html' -o -name '*.htm' -o -name '*.md' -o -name '*.markdown' -o -name '*.twig' -o -name '*.blade.php' -o -name '*.vue' -o -name '*.svelte' -o -name '*.tpl' \) -print 2>/dev/null)
[ "$found" -eq 0 ]
