---
name: videospec-propose
description: Create a complete, review-ready VideoSpec production proposal and planning package from a topic, brief, URL, article, footage, product, or other video input. Use when the user asks to start, propose, plan, script, storyboard, or scope a new video production.
---

# Propose a production

Create the agreement before production work begins.

1. Ensure `videospec/config.json` exists. If this is the VideoSpec source checkout and the project is uninitialized, run `node bin/videospec.js init`. Otherwise use the initialized runtime at `node videospec/bin/videospec.js`.
2. Read `videospec/project.md` and every relevant durable spec under `videospec/specs/`.
3. Determine the subject and primary input. If neither exists, ask what the video is about before creating files.
4. Choose a focused kebab-case id. Run `node videospec/bin/videospec.js new <id> --title <title> --type <type> --duration <duration> --aspect <ratio>`.
5. Draft all planning artifacts in `<productionRoot>/<id>/`, where `productionRoot` is the relative path configured in `videospec/config.json` (new projects default to `productions/`):
   - `proposal.md`: why, audience, outcome, scope, success signals
   - `brief.md`: message, format, tone, must include/avoid, CTA
   - `script.md`: Volcengine TTS configuration, global performance direction, time-coded narration scenes, per-scene synthesis parameters, blockquoted spoken text, screen content, and evidence
   - `storyboard.md`: scene composition, motion, audio, acceptance checks
   - `materials.md`: one row per needed asset with source and rights status
   - `tasks.md`: adapt the checklist to the actual production
6. Treat the generated files as a versioned structure contract:
   - preserve YAML frontmatter, heading names, heading order, and fixed field names
   - do not add alternative sections or convert scene/asset blocks back into Markdown tables
   - use sequential scene ids `S001`, `S002`, ... and asset ids `MAT-001`, `MAT-002`, ...
   - keep the same scene ids across `script.md`, `storyboard.md`, and `materials.md`
   - write each v2 script scene as `## MM:SS–MM:SS｜title`; keep spoken words only under `**口播：**` and blockquote every narration paragraph
   - keep API controls machine-mappable: `speech_rate`, `loudness_rate`, `silence_duration_ms`, `post_process_pitch`, and `section_id`; never replace numeric values with prose
   - keep natural-language performance guidance in `演绎提示`; the unidirectional Seed TTS 2.0 adapter sends it through `additions.context_texts`
   - use `None`, `Unresolved`, or `Unassigned` when a fixed field has no confirmed value; never delete the field
7. Replace template TODOs with real content. Mark unresolved evidence or rights as unresolved; never invent them.
8. Keep the artifacts mutually consistent. Use specific, testable scene and delivery language.
9. Run `node videospec/bin/videospec.js lint <id> --json`, fix every structural error, then run status and summarize the proposed direction, risks, and files created. Warnings must be reported or resolved, not silently ignored.

Do not record an approval. Ask the human to review the brief first; an explicit approval is handled by `$videospec-approve`.
