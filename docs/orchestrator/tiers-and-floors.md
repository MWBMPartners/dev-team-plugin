# Tiers and floors

A **tier** is how strong a model is: 1 utility, 2 engineer, 3 architect, 4 principal. Tier 0 means a script
does the job and no AI model is needed (test runs, static analysis, build checks only).

`engine/data/floors.json` says, for each of 31 kinds of task at each risk (LOW, NORMAL, HIGH, CRITICAL), the
**preferred** tier and the **minimum** tier. A job with several kinds of task takes the larger value of each.
A policy may raise a minimum, never lower it. Checking work (the reviewer role) is never below tier 3 at any risk,
whatever the table says (the table can only raise it). Tier 4 is never the default: a tier-4 model is chosen only when the job
prefers it and it has been approved (the ask-first list), or when nothing below it qualifies.

Among the models that meet the minimum, the engine orders them by: tier-4 last; for a check, a different
provider from the builder's; where work starts (local first or cloud first); closeness to the preferred tier;
price band; then name, so the same inputs always give the same answer.
