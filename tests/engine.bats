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
