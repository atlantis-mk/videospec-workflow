# Immutable review history

`V000` is the initial scaffold. Before an AI modifies any production artifact, it must run `videospec snapshot <id> --note "before: ..."`; after the coherent modification and its `context.md` or `activity.md` entry are complete, it must run `videospec snapshot <id> --note "after: ..."`. If recording the returned snapshot ID changes a ledger, take one final snapshot so that entry is also retained.

Each `V###` directory is an immutable copy of every reviewable artifact at that point, and `index.json` records the timestamp, human-readable reason, and source hashes. Never overwrite, rename, or delete a snapshot. The difference between the pre-change and post-change snapshots is the audit trail for what was previously reviewed and what is now proposed.
