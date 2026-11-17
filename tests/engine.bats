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
