# Visual Standards

## Purpose

The current source of truth for layout, typography, color, and motion.

## Standards

### Standard: On-screen information is readable

The production SHALL keep essential text within safe areas and readable at the target resolution.

#### Check: Acceptance

- **WHEN** the production reaches final review
- **THEN** a human reviewer SHALL confirm this standard

### Standard: Caption-linked visuals are timeline-synchronized

When timed captions or narration-to-caption references are used, each semantic visual element—such as an effect, label, card, illustrative image, or footage—SHALL be mapped to the relevant caption or narration segment in the storyboard timeline. The element SHALL first appear no earlier than the start of that corresponding spoken or captioned content, and SHALL not remain visible after the content becomes misleading or unrelated.

#### Check: Agent caption-to-visual timing verification

- **WHEN** the agent prepares the final render for handoff
- **THEN** the agent SHALL compare the timed captions or narration against the rendered timeline, verify every semantic visual element has a corresponding timeline entry and begins at or after its related content begins, and record any mismatch and its resolution in the review artifact

### Standard: Stock B-roll has traceable licensing and use restrictions

The production SHOULD use Pexels as a preferred source for suitable stock B-roll. For every Pexels asset, the materials plan SHALL retain the asset-page URL, creator when shown, download date, and the applicable Pexels License reference. Attribution is optional under that license, but recording the source is required for production traceability.

The production SHALL NOT describe an asset as "copyright-free" or treat attribution alone as clearance.

#### Check: Stock-media rights review

- **WHEN** the storyboard and materials plan are submitted for approval
- **THEN** a human reviewer SHALL confirm that each stock B-roll asset has a traceable source, license record, and intended-use restrictions review
