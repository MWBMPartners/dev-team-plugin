# Reasoning effort

How hard a model should think is one of six levels: MINIMAL, LOW, MEDIUM, HIGH, VERY_HIGH, MAXIMUM.
`engine/data/effort-defaults.json` gives a level for each kind of task at low or normal risk and another at
high or critical risk. MAXIMUM is allowed only at CRITICAL risk (or after a tier-3 failure); anywhere else it
is stepped down to VERY_HIGH.

Tools name their levels differently, so the engine picks the closest level the chosen model accepts and says
when it is not an exact match (for example "wanted MAXIMUM; the closest level offered is xhigh"). If the tool
does not say which levels it accepts, no level is set. In Claude Code the level is part of the agent's own
file, not something a spawn can change.
