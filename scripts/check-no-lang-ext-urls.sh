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
    BEGIN { ext = "(php|asp|aspx|jsp|cfm|cgi|pl)" }
    fence {
      # A code block opens with 3+ backticks (and no backtick after them, or it is inline code) or 3+ tildes, indented by at
      # most three spaces, and closes with the same kind at least as long.
      if (open == "") {
        if (match($0, /^ ? ? ?(```+)[^`]*$/) || match($0, /^ ? ? ?(~~~+)/)) { s = $0; sub(/^ */, "", s); match(s, /^(`+|~+)/); open = substr(s, 1, 1); openlen = RLENGTH; next }
      } else {
        s = $0
        if (match(s, /^ ? ? ?(`+|~+)[ \t]*$/)) { sub(/^ */, "", s) } else { next }
        if (substr(s, 1, 1) == open) { n = s; gsub(/[ \t]/, "", n); if (length(n) >= openlen) { open = ""; openlen = 0 } }
        next
      }
    }
    {
      line = $0; low = tolower($0); base = 0
      # an address ending in a language extension: an href/src/action value, a root-relative markdown link, or a full URL
      # whose path (after a slash following the host) names a file with such an extension. A bare country domain such as
      # example.pl has no path and is not reported.
      pat = "(href|src|action)[ ]*=[ ]*[\"'"'"'][^\"'"'"' ]*\\." ext "([?#/\"'"'"']|$)|https?://[^/ \"'"'"')<>]+/[^ \"'"'"')<>]*\\." ext "([?#/ )<>\"'"'"']|$)|\\]\\(/[^) ]*\\." ext "([)?#/])"
      while (match(low, pat)) {
        printf "%s:%d: %s\n", file, NR, substr(line, base + RSTART, RLENGTH); found = 1
        base += RSTART + RLENGTH - 1; low = substr(low, RSTART + RLENGTH)
      }
    }
    END { exit found ? 3 : 0 }
  ' "$f"
  rc=$?
  [ "$rc" -eq 3 ] && found=1
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 3 ]; then echo "check-no-lang-ext-urls: could not read $f" >&2; exit 2; fi
done < <(find "$root" \( -name .git -o -name node_modules -o -name vendor -o -name dist -o -name build \) -prune -o -type f \( -name '*.html' -o -name '*.htm' -o -name '*.md' -o -name '*.markdown' -o -name '*.twig' -o -name '*.blade.php' -o -name '*.vue' -o -name '*.svelte' -o -name '*.tpl' \) -print 2>/dev/null)
[ "$found" -eq 0 ]
