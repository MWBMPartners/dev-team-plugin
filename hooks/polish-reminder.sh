#!/usr/bin/env bash
# dev-team polish reminder (SessionStart). NETWORK-FREE and READ-ONLY: in a repo that looks like
# a web app or site, says when the dev-team-polish check is due. It is due when
# .dev-team/polish-last-run is missing or older than the interval (default 7 days). It runs
# nothing and changes nothing; it only prints a JSON notice that tells the user and the model.
# Silent when not due or not a web project. Fail-open: any internal error exits 0 with no output.
# Disable per session with DEV_TEAM_NO_POLISH_REMINDER, or per repo with
# `polish-reminder: off` in .dev-team/config.yml. Set the interval with
# `polish-interval-days: N` in .dev-team/config.yml.
set -u
[ -z "${DEV_TEAM_NO_POLISH_REMINDER:-}" ] || exit 0

cfg=".dev-team/config.yml"
if [ -f "$cfg" ] && grep -Eq '^[[:space:]]*polish-reminder:[[:space:]]*(off|false|no)([[:space:]]|$)' "$cfg" 2>/dev/null; then exit 0; fi

git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Web project? Any tracked page, template or front-end component file counts.
web_file="$(git ls-files -- '*.html' '*.php' '*.vue' '*.svelte' '*.astro' '*.jsx' '*.tsx' 2>/dev/null | head -n 1)"
[ -n "$web_file" ] || exit 0

interval=7
if [ -f "$cfg" ]; then
  v="$(sed -n 's/^[[:space:]]*polish-interval-days:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$cfg" 2>/dev/null | head -n 1)"
  case "$v" in ''|*[!0-9]*) ;; *) [ "$v" -gt 0 ] && interval="$v" ;; esac
fi

# Seconds since the epoch for a YYYY-MM-DD date: GNU date first, then BSD/macOS date.
to_epoch() {
  date -u -d "$1" +%s 2>/dev/null || date -u -j -f '%Y-%m-%d' "$1" +%s 2>/dev/null
}

last="never"
age=""
if [ -f .dev-team/polish-last-run ]; then
  d="$(head -n 1 .dev-team/polish-last-run 2>/dev/null | tr -d '[:space:]')"
  case "$d" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9])
      then_s="$(to_epoch "$d")"
      now_s="$(date -u +%s 2>/dev/null)"
      case "$then_s$now_s" in ''|*[!0-9]*) ;; *) age=$(( (now_s - then_s) / 86400 )); last="$d" ;; esac
      ;;
  esac
fi

if [ -n "$age" ] && [ "$age" -lt "$interval" ]; then exit 0; fi

if [ "$last" = "never" ]; then when="it has not been run in this repo"; else when="last run ${last}, ${age} days ago"; fi
user_msg="dev-team: a polish check is due (${when}; interval ${interval} days). Claude will run dev-team-polish after your current request. Turn this off with polish-reminder: off in .dev-team/config.yml."
model_msg="dev-team polish reminder: this repo is a web project and its polish check is due (${when}; interval ${interval} days). After the user's current request is handled, or straight away if the session has no other task, run the dev-team-polish skill in audit mode (fix mode if the user has asked for fixes) and report under Blocked on me / Changed / Found. Don't let it delay or widen the task the user asked for. Mention it once."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg u "$user_msg" --arg m "$model_msg" \
    '{systemMessage: $u, hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $m}}'
else
  ue="${user_msg//\"/\\\"}"
  me="${model_msg//\"/\\\"}"
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$ue" "$me"
fi
exit 0
