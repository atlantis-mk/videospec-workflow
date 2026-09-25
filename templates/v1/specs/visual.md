# Visual Standards

## Purpose

The current source of truth for layout, typography, color, and motion.

## Standards

### Standard: On-screen information is readable

The production SHALL keep essential text within safe areas and readable at the target resolution.

#### Check: Acceptance

- **WHEN** the production reaches final review
- **THEN** a human reviewer SHALL confirm this standard

### Standard: Semantic visuals do not precede spoken anchors

For narrated or captioned productions, every information-bearing visual, label, number, answer, result, media cue, match cut, emphasis animation, and semantic SFX SHALL begin at or after its corresponding keyword in the human-corrected subtitle timeline. Neutral backgrounds, continuous ambience, non-semantic decoration, and BGM MAY span anchors only when they do not reveal upcoming information. A semantic element SHALL not remain visible after its content becomes misleading or unrelated.

#### Check: Anchor timing verification

- **WHEN** the agent prepares the playable preview and the final render for handoff
- **THEN** the agent SHALL inspect the frame before, at, and after each semantic anchor, record any mismatch and its resolution, and reach zero early-reveal violations

### Standard: Stock B-roll has traceable licensing and use restrictions

The production SHOULD use Pexels as a preferred source for suitable stock B-roll. For every Pexels asset, the materials plan SHALL retain the asset-page URL, creator when shown, download date, and the applicable Pexels License reference. Attribution is optional under that license, but recording the source is required for production traceability.

The production SHALL NOT describe an asset as "copyright-free" or treat attribution alone as clearance.

#### Check: Stock-media rights review

- **WHEN** the storyboard and materials plan are submitted for approval
- **THEN** a human reviewer SHALL confirm that each stock B-roll asset has a traceable source, license record, and intended-use restrictions review
