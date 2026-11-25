# Budgets, reserves and cost estimates

**Reserves.** When a provider's remaining allowance is *known* and gets low, its strongest models (tier 4 keeps the last
25%, tier 3 the last 15%) are kept for planning, deep analysis, security review, hard debugging and the final audit.
Routine work cannot take them and is moved to a cheaper model. If the allowance is not known (Claude Code does not
report one) no reserve is applied and no percentage is invented.

**Phase budgets.** A phase may have a limit in tokens, credits or money. At 80% a warning; at the limit the phase
stops (`budget check` exits 1). A limit with no spend figure is an error, never a pass.

**Estimates.** `estimate` gives LOW, LIKELY and HIGH in relative cost units: the job's size in work units
(`engine/data/cost-bands.json`) times the chosen model's price band. It is never a bill. After 10 local records for a
kind of task, those records replace the built-in guess.
