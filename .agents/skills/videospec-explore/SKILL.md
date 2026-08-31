---
name: videospec-explore
description: Explore a video idea within the current conversation and select one final, proposal-ready direction without creating production artifacts. Use to determine the video's goal, audience, platform, final topic, core viewpoint, supporting sources or material leads, feasibility, risks, and recommended production approach before starting a VideoSpec proposal.
---

# Select a final video direction

Keep this action read-only and finish within the current conversation. Do not create an exploration workspace or preserve discarded options.

1. If present, read `videospec/project.md`, relevant `videospec/specs/*/spec.md`, and active production context.
2. Establish the target: subject area, target viewer, desired viewer change, platform, duration, available inputs, deadline, non-negotiables, and measurable success signal. Infer low-risk defaults and disclose them. Ask only when the subject itself is missing or a missing fact would fundamentally change the outcome.
3. Generate and compare candidate topics internally. Judge audience value, distinctiveness, evidence availability, visual potential, production effort, and risk. Do not make the user choose among options unless a decisive preference cannot be inferred.
4. Collect enough reliable information to support the choice. Search current or uncertain facts when needed. Capture key facts with sources, useful cases, visual or media leads, unresolved verification items, and rights or privacy concerns. Never invent evidence or clearance.
5. Select one final topic and one primary viewpoint. Prefer a focused, producible direction over a broad theme. Include HyperFrames when reproducible HTML motion, batch variants, or deterministic rendering materially help.
6. Deliver exactly one final exploration package using these headings:
   - `## 确定目标`: audience, platform, purpose, desired viewer change, duration, success signal
   - `## 最终选题`: working title, core question, primary viewpoint, selection rationale, differentiated angle
   - `## 资料与素材`: sourced facts, cases, visual/media leads, verification gaps, rights/privacy risks
   - `## 制作建议`: production type, treatment, HyperFrames fit, proposed kebab-case production id
   - `## 提案输入`: a compact self-contained brief that `$videospec-propose` can use directly

Do not stop at a candidate list or end with unresolved creative choices when reasonable assumptions can produce a sound result. Do not run `videospec new`, edit project files, or imply approval. Hand the final package to `$videospec-propose` as the next action.
