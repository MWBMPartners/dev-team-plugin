# Signed remote catalogue: the contract for the future service

The plugin can read a catalogue of model hints from a web address, but only if it is **signed**. This page is the contract
for the service the owner will build later (MWBM-intAppsAPI). The plugin side is built; the service is not.

**Envelope** (`schemas/catalogue.schema.json`): `{payload, signature, keyId, issuedAt, expiresAt}`. The payload may carry
only `catalogueVersion` and `models` (each with `provider`, `id`, `tierHint` 1 to 4 and optional `notes`). It has **no**
fields for floors, gates, approvals or destructive-action levels, so a catalogue cannot weaken any of them; any other key
makes the file invalid, even with a valid signature.

**Signing.** Ed25519 over the canonical JSON of `{payload, keyId, issuedAt, expiresAt}` (keys sorted by code point, no
spaces). `keyId` is the first 16 hex digits of the SHA-256 of the public key in DER form. The plugin trusts only the key
pinned in `engine/data/catalogue-public-key.pem`. **That key in this repository is a placeholder: nobody holds its private
half, so today nothing verifies.** The owner replaces the file with the service's real public key (a plugin release).
No private key is ever committed; the tests make a new key pair each run.

**Behaviour.** `engine.sh catalogue fetch --url https://...` (or `DEV_TEAM_CATALOGUE_URL`) fetches, verifies and keeps a
copy for 24 hours. Without an address it does nothing. An unreachable service is not an error. A file that fails
verification (bad signature, wrong key, expired, dated in the future, wrong shape) is ignored with a warning and is never
used unsigned. A verified hint only fills a field that is still UNKNOWN; verified runtime data and the plugin's maintained
tables always win. `engine.sh catalogue verify --file F [--key K]` checks a file by hand (exit 5 on failure).

**Checking by hand** with OpenSSL: write the canonical JSON of the signed part to `payload.canonical.json`, decode the
signature to `sig.bin`, then
`openssl pkeyutl -verify -pubin -inkey key.pem -rawin -in payload.canonical.json -sigfile sig.bin`.
