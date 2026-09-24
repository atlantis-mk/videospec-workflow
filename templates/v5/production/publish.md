---
template: videospec/publish
templateVersion: 5
productionId: {{production.id}}
---

# Publication package: {{production.title}}

## Platform and schedule

- Platform: <!-- TODO -->
- Planned publish time: Unresolved
- Owner: Unassigned
- Draft status: <!-- TODO: prepared for final-master review; final publication still requires human approval -->

## Title variants and selected title

<!-- TODO: Preserve alternatives, selection rationale, selected title, confidence, and its match to the approved viewer promise. -->

## Cover / thumbnail

Create all three native-ratio variants with `$imagegen` before final-master approval. Generate each ratio separately, inspect it, and store the accepted output in `assets/covers/`; adapt composition and copy placement for each canvas rather than merely cropping one version.

| Ratio | Asset or path | Imagegen prompt / generation record | On-cover copy | Composition notes | Review status |
|---|---|---|---|---|---|
| 16:9 | assets/covers/cover-16x9.png | <!-- TODO: imagegen prompt or generation reference --> | Unresolved | <!-- TODO --> | Unreviewed |
| 4:3 | assets/covers/cover-4x3.png | <!-- TODO: imagegen prompt or generation reference --> | Unresolved | <!-- TODO --> | Unreviewed |
| 3:4 | assets/covers/cover-3x4.png | <!-- TODO: imagegen prompt or generation reference --> | Unresolved | <!-- TODO --> | Unreviewed |

- Shared concept and selection rationale: <!-- TODO -->
- Master-promise check: <!-- TODO: explain why title/cover promise matches the review render -->
- A/B variant notes: <!-- TODO -->

## Description and metadata

<!-- TODO: Description, links, disclosures, chapters, accessibility text, and platform-draft settings. -->

## Ten publication tags

Use exactly ten distinct, search-relevant tags. Do not pad the list with generic or duplicate variants.

1. <!-- TODO -->
2. <!-- TODO -->
3. <!-- TODO -->
4. <!-- TODO -->
5. <!-- TODO -->
6. <!-- TODO -->
7. <!-- TODO -->
8. <!-- TODO -->
9. <!-- TODO -->
10. <!-- TODO -->

## Publication checklist

- [ ] Candidate deliverable selected and promise checked against the review render
- [ ] Metadata, links, disclosures, and accessibility checked
- [ ] Exactly ten distinct, search-relevant publication tags selected
- [ ] Platform-specific settings and visibility checked
