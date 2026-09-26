# Visual Standards

## Purpose

The current source of truth for layout, typography, color, and motion.

## Standards

### Standard: On-screen information is readable

The production SHALL keep essential text within safe areas and readable at the target resolution.

#### Check: Acceptance

- **WHEN** the production reaches final review
- **THEN** a human reviewer SHALL confirm this standard

### Standard: Captions are light, legible, and consistent

For productions with on-screen captions, the caption treatment SHALL favor clear text over large opaque cards or decorative backgrounds that obscure the picture. A subtle outline or shadow MAY improve contrast; selective keyword highlighting, word-by-word reveal, or current-word animation MAY be used when it helps comprehension. Caption position, base font size, and maximum line width SHALL remain stable across scenes. Important words MAY briefly change size or color, but emphasis and decoration SHALL not compete with the picture's subject or impair reading.

#### Check: Caption presentation

- **WHEN** the playable preview and final render are reviewed
- **THEN** the reviewer SHALL inspect representative captions at the target resolution and mobile size for legibility, picture occlusion, layout jumps, and distracting emphasis

### Standard: Information-bearing overlay text maintains contrast

The production SHALL design captions, labels, numbers, and other information-bearing overlay text for the least favorable background frames on which they appear. Normal-size text SHOULD reach a contrast ratio of at least 4.5:1 and large text at least 3:1, using a restrained outline, shadow, or local backing when the picture changes. These are production targets based on [WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum); text that is incidental within source footage is outside this overlay standard.

#### Check: Moving-background contrast

- **WHEN** the storyboard and composition are built and the playable preview and final render are reviewed
- **THEN** the agent SHALL inspect the least favorable frames for each overlay treatment at target and mobile sizes, record measured contrast where it can be determined, fix poor legibility, and record the reason if a numeric target remains unmet

### Standard: Color is not the only carrier of meaning

The production SHALL pair any meaning conveyed by color with a readable label, symbol, shape, position, or other non-color cue. This applies to charts, comparisons, status indicators, and caption highlights when the color change communicates information rather than decoration.

#### Check: Non-color comprehension

- **WHEN** the playable preview and final render are reviewed
- **THEN** the reviewer SHALL confirm that viewers can distinguish important information without relying on hue alone

### Standard: Data graphics preserve numeric context

When the production uses factual charts or data graphics, it SHALL preserve the measure, unit, time period, population or denominator when relevant, and source in the materials record. The viewer SHALL receive enough of that context in the graphic or narration to interpret the claim. Bars and filled areas SHALL start at zero; a line or scatter chart MAY use a cropped axis only when its scale is explicit. Comparable graphics across scenes SHALL use consistent scales or clearly call out a scale change. The production SHALL NOT alter axes or visual proportions to imply a comparison the data do not support. See the UK Office for National Statistics guidance on [chart text](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text) and [axes](https://service-manual.ons.gov.uk/data-visualisation/guidance/axes-and-gridlines).

#### Check: Data-graphic integrity

- **WHEN** a data graphic is designed and the playable preview and final render are reviewed
- **THEN** the agent SHALL trace its values and source through `materials.md`, check units, period, denominator, axes, and cross-scene scale, and confirm the visual takeaway matches the underlying data

### Standard: Flashing effects remain below safety thresholds

The production SHALL avoid repeated bright or red flashes. An effect that flashes more than three times in any one-second period SHALL be removed unless it is measured below the general-flash and red-flash thresholds in [WCAG 2.2 SC 2.3.1](https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold). The absence of an obvious problem during casual viewing is not evidence that a repeated flash is below those thresholds.

#### Check: Flash safety

- **WHEN** the playable preview and final render are reviewed
- **THEN** the reviewer SHALL inspect flashing sequences and record the measurement for any effect retained under the threshold exception; unmeasured effects above three flashes per second SHALL be removed

### Standard: Semantic visuals do not precede spoken anchors

Except for the deliberate opening tease defined below, every information-bearing visual, label, number, answer, result, media cue, match cut, emphasis animation, and semantic SFX in a narrated production SHALL begin at or after its corresponding spoken keyword in the human-corrected subtitle timeline. For captioned productions without speech, these elements SHALL follow the approved caption or beat timeline. A deliberate opening tease MAY precede its spoken anchor only when the storyboard identifies its purpose and the preview review confirms that it does not disclose an answer, result, or unsupported claim early. Neutral backgrounds, continuous ambience, non-semantic decoration, and BGM MAY span anchors only when they do not reveal upcoming information. A semantic element SHALL not remain visible after its content becomes misleading or unrelated.

#### Check: Anchor timing verification

- **WHEN** the agent prepares the playable preview and the final render for handoff
- **THEN** the agent SHALL inspect the frame before, at, and after each semantic anchor, record any mismatch or intentional opening tease and its resolution, and reach zero unapproved early-reveal violations

### Standard: Stock B-roll has traceable licensing and use restrictions

The production SHOULD use Pexels as a preferred source for suitable stock B-roll. For every Pexels asset, the materials plan SHALL retain the asset-page URL, creator when shown, download date, and the applicable Pexels License reference. Attribution is optional under that license, but recording the source is required for production traceability.

The production SHALL NOT describe an asset as "copyright-free" or treat attribution alone as clearance.

#### Check: Stock-media rights review

- **WHEN** the storyboard and materials plan are submitted for approval
- **THEN** a human reviewer SHALL confirm that each stock B-roll asset has a traceable source, license record, and intended-use restrictions review
