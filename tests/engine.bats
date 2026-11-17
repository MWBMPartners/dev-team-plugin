#!/usr/bin/env bats
# Behaviour tests for scripts/engine.sh (the launcher) and the engine's exit codes. Run: bats tests/engine.bats
# Every test works in a scratch folder; none writes into the real repository.

setup() {
  REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  SCRATCH="$(mktemp -d)"
  export DEV_TEAM_DATA_DIR="$SCRATCH/data"
  unset CLAUDE_PLUGIN_DATA DEV_TEAM_NO_ENGINE DEV_TEAM_NODE
}
teardown() { rm -rf "$SCRATCH"; }

@test "engine.sh: no Node on the PATH exits 3 with a clear message and nothing on stdout" {
  mkdir "$SCRATCH/empty"
  run env PATH="$SCRATCH/empty" "$(command -v bash)" "$REPO_ROOT/scripts/engine.sh" doctor
  [ "$status" -eq 3 ]
  [[ "$output" == *"needs Node 22 or newer"* ]]
  out="$(env PATH="$SCRATCH/empty" "$(command -v bash)" "$REPO_ROOT/scripts/engine.sh" doctor 2>/dev/null)" || true
  [ -z "$out" ]
}

@test "engine.sh: a DEV_TEAM_NODE that is not runnable exits 3 and is not skipped quietly" {
  run env DEV_TEAM_NODE="$SCRATCH/nope" bash "$REPO_ROOT/scripts/engine.sh" doctor
  [ "$status" -eq 3 ]
  [[ "$output" == *"DEV_TEAM_NODE"* ]]
}

@test "engine.sh: a Node older than 22 exits 3 and names the version found" {
  mkdir "$SCRATCH/old"
  printf '#!/bin/sh\necho v18.0.0\n' > "$SCRATCH/old/node"; chmod +x "$SCRATCH/old/node"
  run env DEV_TEAM_NODE="$SCRATCH/old/node" bash "$REPO_ROOT/scripts/engine.sh" doctor
  [ "$status" -eq 3 ]
  [[ "$output" == *"v18.0.0"* ]]
}

@test "engine.sh: DEV_TEAM_NO_ENGINE=1 exits 3 and says the plugin carries on" {
  run env DEV_TEAM_NO_ENGINE=1 bash "$REPO_ROOT/scripts/engine.sh" doctor
  [ "$status" -eq 3 ]
  [[ "$output" == *"carries on"* ]]
}

@test "engine.sh: doctor prints one JSON answer, exit 0, and no account details" {
  run bash "$REPO_ROOT/scripts/engine.sh" doctor
  [ "$status" -eq 0 ]
  printf '%s' "$output" | jq -e '.ok == true and .result.tools.git.present' >/dev/null
}

@test "engine.sh: an unknown command exits 2" {
  run bash "$REPO_ROOT/scripts/engine.sh" nonsense
  [ "$status" -eq 2 ]
}

@test "engine.sh: with no data folder given it warns once and uses the fallback" {
  unset DEV_TEAM_DATA_DIR
  run env HOME="$SCRATCH/home" bash "$REPO_ROOT/scripts/engine.sh" doctor
  [ "$status" -eq 0 ]
  [[ "$output" == *"no data folder was given"* ]]
  [ -d "$SCRATCH/home/.dev-team/data" ]
}

@test "engine.sh: schema validate --all passes on the real manifest" {
  run bash "$REPO_ROOT/scripts/engine.sh" schema validate --all
  [ "$status" -eq 0 ]
}

@test "engine.sh: route picks a model and says why; an architect never gets Fable unasked" {
  printf '{"role":"architect","providers":["claude"]}' > "$SCRATCH/req.json"
  run bash "$REPO_ROOT/scripts/engine.sh" route --request-file "$SCRATCH/req.json"
  [ "$status" -eq 0 ]
  printf '%s' "$output" | jq -e '.result.decision.model == "opus" and (.result.heldBack | map(.model) | index("fable"))' >/dev/null
}

@test "engine.sh: route exits 1 with NEEDS_APPROVAL when only an ask-first model qualifies" {
  printf '{"role":"architect","providers":["gemini"]}' > "$SCRATCH/req.json"
  run bash "$REPO_ROOT/scripts/engine.sh" route --request-file "$SCRATCH/req.json"
  [ "$status" -eq 1 ]
  [[ "$output" == *"NEEDS_APPROVAL"* ]]
}

@test "engine.sh: a request that is not a JSON object, or not JSON at all, exits 2 with a fixed message" {
  printf 'null' > "$SCRATCH/req.json"
  run bash "$REPO_ROOT/scripts/engine.sh" route --request-file "$SCRATCH/req.json"
  [ "$status" -eq 2 ]
  printf 'sk-ant-api03-notreallyakey' > "$SCRATCH/req.json"
  run bash "$REPO_ROOT/scripts/engine.sh" route --request-file "$SCRATCH/req.json"
  [ "$status" -eq 2 ]
  [[ "$output" != *"sk-ant"* ]]
}

@test "engine.sh: Ollama written in capitals still counts as the local provider, and projectDir must be text" {
  printf '{"role":"builder","providers":["OLLAMA","claude"],"projectDir":123}' > "$SCRATCH/req.json"
  run bash "$REPO_ROOT/scripts/engine.sh" route --request-file "$SCRATCH/req.json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"projectDir must be text"* ]]
}

@test "engine.sh: a blank projectDir is refused instead of quietly skipping the project's settings" {
  printf '{"role":"architect","projectDir":""}' > "$SCRATCH/req.json"
  run bash "$REPO_ROOT/scripts/engine.sh" route --request-file "$SCRATCH/req.json"
  [ "$status" -eq 2 ]
}

@test "engine.sh: sim run --all passes the shipped scenarios; an unknown scenario exits 2" {
  run bash "$REPO_ROOT/scripts/engine.sh" sim run --all
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" sim run --scenario nonsense
  [ "$status" -eq 2 ]
}

@test "engine.sh: discover with no tools installed reports failures but exits 0 and writes no empty cache" {
  run env PATH="$(dirname "$(command -v node)"):/usr/bin:/bin" HOME="$SCRATCH/home" bash "$REPO_ROOT/scripts/engine.sh" discover --provider codex
  [ "$status" -eq 0 ]
  [ ! -e "$DEV_TEAM_DATA_DIR/catalogue/codex.json" ]
}

@test "engine.sh: route saves a decision and explain reads it back in three sentences; dry-run prints one row per phase" {
  printf '{"role":"reviewer","taskTypes":["CODE_REVIEW"],"risk":"NORMAL","providers":["claude"],"projectDir":"%s"}' "$SCRATCH" > "$SCRATCH/req.json"
  run bash "$REPO_ROOT/scripts/engine.sh" route --request-file "$SCRATCH/req.json"
  [ "$status" -eq 0 ]
  id="$(printf '%s' "$output" | jq -r .result.decisionId)"
  run bash "$REPO_ROOT/scripts/engine.sh" explain --decision "$id"
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq '.result.sentences | length')" -eq 3 ]
  run bash "$REPO_ROOT/scripts/engine.sh" explain --decision "../x"
  [ "$status" -eq 2 ]
  printf '{"phases":[{"name":"a","role":"scout","taskTypes":["REPOSITORY_DISCOVERY"]},{"name":"b","role":"builder","taskTypes":["ROUTINE_IMPLEMENTATION"]}],"projectDir":"%s"}' "$SCRATCH" > "$SCRATCH/p.json"
  run bash "$REPO_ROOT/scripts/engine.sh" dry-run --phases-file "$SCRATCH/p.json"
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq '.result.rows | length')" -eq 2 ]
}

@test "engine.sh: plan verify accepts this project's hand-locked plan; lock then edit is caught with exit 5; a second lock is exit 4" {
  run bash "$REPO_ROOT/scripts/engine.sh" plan verify --file "$REPO_ROOT/.claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json"
  [ "$status" -eq 0 ]
  printf '{"requirements":["R1"]}' > "$SCRATCH/c.json"
  run bash "$REPO_ROOT/scripts/engine.sh" plan draft --file "$SCRATCH/c.json" --id t --out "$SCRATCH/p.json"
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" plan lock --file "$SCRATCH/p.json" --approver tester
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" plan lock --file "$SCRATCH/p.json" --approver tester
  [ "$status" -eq 4 ]
  sed -i.bak 's/"R1"/"R9"/' "$SCRATCH/p.json"
  run bash "$REPO_ROOT/scripts/engine.sh" plan verify --file "$SCRATCH/p.json"
  [ "$status" -eq 5 ]
}

@test "engine.sh: drift and evidence and attempt exit 1 on the negative answers" {
  printf '{"taskFiles":["a.js"],"changedFiles":["b.js"]}' > "$SCRATCH/d.json"
  run bash "$REPO_ROOT/scripts/engine.sh" drift --input "$SCRATCH/d.json"
  [ "$status" -eq 1 ]
  printf '{"results":[{"name":"t","kind":"test","status":"FAIL"}]}' > "$SCRATCH/e.json"
  run bash "$REPO_ROOT/scripts/engine.sh" evidence check --input "$SCRATCH/e.json"
  [ "$status" -eq 1 ]
  for _ in 1 2; do bash "$REPO_ROOT/scripts/engine.sh" attempt record --state-file "$SCRATCH/s.json" --outcome FAIL --progress-made true >/dev/null; done
  run bash "$REPO_ROOT/scripts/engine.sh" attempt record --state-file "$SCRATCH/s.json" --outcome FAIL --progress-made true
  [ "$status" -eq 1 ]
  [[ "$output" == *"ATTEMPT_CAP_REACHED"* ]]
}

@test "engine.sh: job init, record, checkpoint create and verify, and the progress table work end to end in a temp repo" {
  git -C "$SCRATCH" init -q && printf 'x' > "$SCRATCH/f" && git -C "$SCRATCH" add f && git -C "$SCRATCH" -c user.email=t@t -c user.name=t commit -q -m one
  run bash "$REPO_ROOT/scripts/engine.sh" job init --template small-task --request "Add a thing" --project "$SCRATCH"
  [ "$status" -eq 0 ]
  id="$(printf '%s' "$output" | jq -r .result.jobId)"
  run bash "$REPO_ROOT/scripts/engine.sh" job record --job "$id" --phase build --status DONE --project "$SCRATCH"
  [ "$status" -eq 4 ]
  run bash "$REPO_ROOT/scripts/engine.sh" job record --job "$id" --phase build --status IN_PROGRESS --project "$SCRATCH"
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" checkpoint create --job "$id" --phase build --kind build --project "$SCRATCH"
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" checkpoint verify --job "$id" --project "$SCRATCH"
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" report --job "$id" --progress --project "$SCRATCH"
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq '.result.rows | length')" -eq 2 ]
  run bash "$REPO_ROOT/scripts/engine.sh" job status --job "../x" --project "$SCRATCH"
  [ "$status" -eq 2 ]
}

@test "engine.sh: the reclaim scenario - a stale lease and a dirty tree with an untracked file: reclaim snapshots first, the work survives a reset" {
  mkdir "$SCRATCH/repo" && git -C "$SCRATCH/repo" init -q && printf 'a' > "$SCRATCH/repo/f" && git -C "$SCRATCH/repo" add f && git -C "$SCRATCH/repo" -c user.email=t@t -c user.name=t commit -q -m one
  e() { bash "$REPO_ROOT/scripts/engine.sh" "$@" --project "$SCRATCH/repo"; }
  run e lease acquire --job j-aaaaaaaaaaaa --phase build --provider claude --model opus --runtime claude-code --role builder
  [ "$status" -eq 0 ]
  printf 'precious' > "$SCRATCH/repo/untracked.txt"
  # make the heartbeat old by editing the holder file the engine wrote
  holder="$(find "$DEV_TEAM_DATA_DIR" -name holder.json | head -1)"
  sed -i.bak 's/"heartbeatAt": "[^"]*"/"heartbeatAt": "2020-01-01T00:00:00.000Z"/' "$holder"
  run e lease acquire --job j-aaaaaaaaaaaa --phase build --provider claude --model opus --runtime claude-code --role builder
  [ "$status" -eq 4 ]
  [[ "$output" == *"STALE_LOCK"* ]]
  run e lease reclaim --job j-aaaaaaaaaaaa --phase build --provider claude --model sonnet --runtime claude-code --role builder
  [ "$status" -eq 0 ]
  ref="$(printf '%s' "$output" | jq -r .result.snapshot.snapshotRef)"
  [ "$ref" != "null" ]
  git -C "$SCRATCH/repo" ls-tree -r --name-only "$ref" | grep -q untracked.txt
  rm -f "$SCRATCH/repo/untracked.txt"
  run e snapshot restore --ref "$ref"
  [ "$status" -eq 0 ]
  [ "$(cat "$SCRATCH/repo/untracked.txt")" = "precious" ]
}

@test "engine.sh: quota observe reads a limit message, decides pause or block, and never invents a reset" {
  git -C "$SCRATCH" init -q
  printf 'You have hit your usage limit. Try again in 2 hours.' > "$SCRATCH/m.txt"
  run bash "$REPO_ROOT/scripts/engine.sh" quota observe --provider claude --file "$SCRATCH/m.txt" --project "$SCRATCH"
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq -r .result.decision.action)" = "PAUSE" ]
  printf 'You have hit your usage limit.' > "$SCRATCH/m2.txt"
  run bash "$REPO_ROOT/scripts/engine.sh" quota observe --provider claude --file "$SCRATCH/m2.txt" --project "$SCRATCH"
  [ "$(printf '%s' "$output" | jq -r .result.decision.action)" = "BLOCK" ]
  run bash "$REPO_ROOT/scripts/engine.sh" quota status --project "$SCRATCH"
  [ "$status" -eq 0 ]
}

@test "engine.sh: snapshot create refuses a planted secret with exit 5 and writes no reference" {
  mkdir "$SCRATCH/repo" && git -C "$SCRATCH/repo" init -q && printf 'a' > "$SCRATCH/repo/f" && git -C "$SCRATCH/repo" add f && git -C "$SCRATCH/repo" -c user.email=t@t -c user.name=t commit -q -m one
  printf 'k=sk_live_abcdefgh12345678' > "$SCRATCH/repo/s.txt"
  run bash "$REPO_ROOT/scripts/engine.sh" snapshot create --job j-aaaaaaaaaaaa --phase build --project "$SCRATCH/repo"
  [ "$status" -eq 5 ]
  [ -z "$(git -C "$SCRATCH/repo" for-each-ref refs/dev-team)" ]
}

@test "engine.sh: review plan picks a cross-provider reviewer, never an ask-first model unasked; findings follow the lifecycle" {
  printf '{"jobId":"j-aaaaaaaaaaaa","phase":"verify","risk":"NORMAL","files":["a.js"],"builtBy":{"provider":"claude","model":"opus"},"projectDir":"%s"}' "$SCRATCH" > "$SCRATCH/i.json"
  run bash "$REPO_ROOT/scripts/engine.sh" review plan --input "$SCRATCH/i.json"
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq -r .result.reviewer.independence)" = "CROSS_PROVIDER" ]
  [ "$(printf '%s' "$output" | jq '[.result.reviewer.skipped[] | select(.reason=="NEEDS_APPROVAL")] | length > 0')" = "true" ]
  f="$SCRATCH/findings.json"
  run bash "$REPO_ROOT/scripts/engine.sh" findings add --state-file "$f" --file a.js --rule R1 --summary "Missing check" --severity BLOCKING --reviewer codex
  [ "$status" -eq 0 ]
  id="$(printf '%s' "$output" | jq -r .result.id)"
  run bash "$REPO_ROOT/scripts/engine.sh" findings update --state-file "$f" --id "$id" --status FIXED --by lead
  [ "$status" -eq 2 ]
  run bash "$REPO_ROOT/scripts/engine.sh" findings update --state-file "$f" --id "$id" --status ACCEPTED --by lead
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" findings precision --state-file "$f"
  [ "$(printf '%s' "$output" | jq -r .result.codex.accepted)" = "1" ]
}

@test "check-no-lang-ext-urls.sh: finds /x.php addresses, ignores .php inside a code fence and ordinary text" {
  mkdir -p "$SCRATCH/site"
  printf '<a href="/login.php">Log in</a>\n<a href="/about">About</a>\n' > "$SCRATCH/site/index.html"
  run bash "$REPO_ROOT/scripts/check-no-lang-ext-urls.sh" "$SCRATCH/site"
  [ "$status" -eq 1 ]
  [[ "$output" == *"login.php"* ]]
  [[ "$output" != *"about"* ]]
  rm "$SCRATCH/site/index.html"
  # shellcheck disable=SC2016
  printf 'Example:\n\n```\n[x](/old.php)\n```\n\nThe file config.php is internal.\n' > "$SCRATCH/site/doc.md"
  run bash "$REPO_ROOT/scripts/check-no-lang-ext-urls.sh" "$SCRATCH/site"
  [ "$status" -eq 0 ]
  printf 'See [login](/login.php) and https://example.com/a/page.asp today.\n' > "$SCRATCH/site/doc.md"
  run bash "$REPO_ROOT/scripts/check-no-lang-ext-urls.sh" "$SCRATCH/site"
  [ "$status" -eq 1 ]
  [[ "$output" == *"page.asp"* ]]
}

@test "engine.sh: gate check exits 1 for a prohibited action even with every approval, and a pack can only raise a gate" {
  run bash "$REPO_ROOT/scripts/engine.sh" gate check --action PUSH_DEFAULT_BRANCH --confident --deterministic-pass --review-verified --human-approved
  [ "$status" -eq 1 ]
  run bash "$REPO_ROOT/scripts/engine.sh" gate check --action DEPLOY
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq -r .result.allowed)" = "false" ]
  run bash "$REPO_ROOT/scripts/engine.sh" gate check --action DELETE_FILES --pack nope
  [ "$status" -eq 2 ]
}

@test "check-no-lang-ext-urls.sh: country domains and fences are not false alarms; capitals, spaces around = and a trailing slash are caught" {
  mkdir -p "$SCRATCH/site2"
  # shellcheck disable=SC2016
  printf 'Shop: [x](https://allegro.pl) and https://example.pl today.\n\n~~~\n```\n[a](/in-fence.php)\n```\n~~~\n\nReal: [after](/after.php)\n' > "$SCRATCH/site2/a.md"
  run bash "$REPO_ROOT/scripts/check-no-lang-ext-urls.sh" "$SCRATCH/site2"
  [ "$status" -eq 1 ]
  [[ "$output" == *"after.php"* ]]
  [[ "$output" != *"allegro"* ]]
  [[ "$output" != *"in-fence"* ]]
  printf '<a href = "/LOGIN.PHP">x</a> <a href="https://x.com/index.php/users">y</a>\n' > "$SCRATCH/site2/b.html"
  run bash "$REPO_ROOT/scripts/check-no-lang-ext-urls.sh" "$SCRATCH/site2"
  [[ "$output" == *"LOGIN.PHP"* ]]
  [[ "$output" == *"index.php"* ]]
}

@test "engine.sh: budget check stops at the limit with exit 1 and protects the reserve; estimate always carries its caveat" {
  printf '{"limit":{"tokens":100},"spent":{"tokens":100}}' > "$SCRATCH/b.json"
  run bash "$REPO_ROOT/scripts/engine.sh" budget check --input "$SCRATCH/b.json"
  [ "$status" -eq 1 ]
  printf '{"remainingPercent":10,"tier":4,"taskTypes":["DOCUMENTATION"]}' > "$SCRATCH/r.json"
  run bash "$REPO_ROOT/scripts/engine.sh" budget check --input "$SCRATCH/r.json"
  [ "$status" -eq 1 ]
  printf '{"remainingPercent":null,"tier":4,"taskTypes":["DOCUMENTATION"]}' > "$SCRATCH/r2.json"
  run bash "$REPO_ROOT/scripts/engine.sh" budget check --input "$SCRATCH/r2.json"
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq -r .result.state)" = "UNKNOWN" ]
  printf '{"taskTypes":["DEEP_PLANNING"],"costBand":5}' > "$SCRATCH/e.json"
  run bash "$REPO_ROOT/scripts/engine.sh" estimate --input "$SCRATCH/e.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"not a bill"* ]]
}

@test "check-no-lang-ext-urls.sh: inline triple-backtick code does not hide the rest; a longer fence needs a longer closer" {
  mkdir -p "$SCRATCH/site3"
  # shellcheck disable=SC2016
  printf '```npm test``` runs the tests.\n<a href="/real.php">x</a>\n\n````\n```\n[a](/in-block.php)\n````\n\n[b](/after.php)\n' > "$SCRATCH/site3/a.md"
  run bash "$REPO_ROOT/scripts/check-no-lang-ext-urls.sh" "$SCRATCH/site3"
  [ "$status" -eq 1 ]
  [[ "$output" != *"in-block"* ]]
  [[ "$output" == *"after.php"* ]]
}

@test "engine.sh: catalogue verify accepts a freshly signed file (keys made now), rejects tampering with exit 5, and the pinned placeholder key accepts nothing" {
  node --input-type=module -e "
    import { generateKeyPairSync } from 'node:crypto'; import { writeFileSync } from 'node:fs';
    import { signEnvelope } from '$REPO_ROOT/engine/lib/signature.mjs';
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pub = publicKey.export({ type: 'spki', format: 'pem' }), priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const now = Date.now(); const iso = (d) => new Date(d).toISOString().replace(/\\.\\d+Z/, 'Z');
    const env = signEnvelope({ catalogueVersion: 1, models: [{ provider: 'x', id: 'y', tierHint: 2 }] }, priv, { publicKeyPem: pub, issuedAt: iso(now - 3600000), expiresAt: iso(now + 86400000) });
    writeFileSync('$SCRATCH/good.json', JSON.stringify(env)); writeFileSync('$SCRATCH/pub.pem', pub);
    env.payload.models[0].tierHint = 4; writeFileSync('$SCRATCH/bad.json', JSON.stringify(env));"
  run bash "$REPO_ROOT/scripts/engine.sh" catalogue verify --file "$SCRATCH/good.json" --key "$SCRATCH/pub.pem"
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" catalogue verify --file "$SCRATCH/bad.json" --key "$SCRATCH/pub.pem"
  [ "$status" -eq 5 ]
  run bash "$REPO_ROOT/scripts/engine.sh" catalogue verify --file "$SCRATCH/good.json"
  [ "$status" -eq 5 ]
  run bash "$REPO_ROOT/scripts/engine.sh" catalogue fetch
  [ "$status" -eq 0 ]
  [[ "$output" == *"NOT_CONFIGURED"* ]]
}

@test "check-no-lang-ext-urls.sh: a closing fence indented four spaces is not a closer" {
  mkdir -p "$SCRATCH/site4"
  # shellcheck disable=SC2016
  printf '```\nin\n    ```\nhttps://a.b/IN4.php\n```\nhttps://a.b/OUT5.php\n' > "$SCRATCH/site4/a.md"
  run bash "$REPO_ROOT/scripts/check-no-lang-ext-urls.sh" "$SCRATCH/site4"
  [ "$status" -eq 1 ]
  [[ "$output" == *"OUT5"* ]]
  [[ "$output" != *"IN4"* ]]
}

@test "engine.sh: push check says no by default and for the default branch even when on, and yes only for a cleared run-branch commit when on" {
  mkdir -p "$SCRATCH/p/.dev-team"
  run bash "$REPO_ROOT/scripts/engine.sh" push check --branch autopilot/x --checker-cleared --confident --deterministic-pass --project "$SCRATCH/p"
  [ "$status" -eq 1 ]
  printf 'git:\n  push-after-task: on\n' > "$SCRATCH/p/.dev-team/config.yml"
  run bash "$REPO_ROOT/scripts/engine.sh" push check --branch autopilot/x --checker-cleared --confident --deterministic-pass --project "$SCRATCH/p"
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/engine.sh" push check --branch main --checker-cleared --confident --deterministic-pass --project "$SCRATCH/p"
  [ "$status" -eq 1 ]
  run bash "$REPO_ROOT/scripts/engine.sh" push check --branch autopilot/x --confident --deterministic-pass --project "$SCRATCH/p"
  [ "$status" -eq 1 ]
}

@test "engine.sh: learn record refuses code and paths, query gives no score with too few results, purge empties it, and DEV_TEAM_NO_LEARNING switches it off" {
  printf '{"taskType":"ROUTINE_IMPLEMENTATION","provider":"claude","model":"sonnet","tier":2,"risk":"NORMAL","accepted":true,"at":"2026-11-17T10:00:00Z"}' > "$SCRATCH/r.json"
  run bash "$REPO_ROOT/scripts/engine.sh" learn record --input "$SCRATCH/r.json"
  [ "$status" -eq 0 ]
  [ "$(printf '%s' "$output" | jq -r .result.recorded)" = "true" ]
  printf '{"taskType":"ROUTINE_IMPLEMENTATION","provider":"claude","model":"sonnet","tier":2,"risk":"NORMAL","accepted":true,"at":"2026-11-17T10:00:00Z","code":"x=1"}' > "$SCRATCH/bad.json"
  run bash "$REPO_ROOT/scripts/engine.sh" learn record --input "$SCRATCH/bad.json"
  [ "$status" -eq 2 ]
  run bash "$REPO_ROOT/scripts/engine.sh" learn query --provider claude --model sonnet --task-type ROUTINE_IMPLEMENTATION
  [ "$(printf '%s' "$output" | jq -r .result.score)" = "null" ]
  run env DEV_TEAM_NO_LEARNING=1 bash "$REPO_ROOT/scripts/engine.sh" learn record --input "$SCRATCH/r.json"
  [ "$(printf '%s' "$output" | jq -r .result.recorded)" = "false" ]
  run bash "$REPO_ROOT/scripts/engine.sh" learn purge
  [ "$status" -eq 0 ]
  [ ! -d "$DEV_TEAM_DATA_DIR/learning" ]
}
