# Delivery Standards

## Purpose

The current source of truth for formats, quality control, and release packaging.

## Standards

### Standard: Deliverables match the target platform

The production SHALL meet the approved aspect ratio, duration, codec, captions, and naming requirements.

#### Check: Acceptance

- **WHEN** the production reaches final review
- **THEN** a human reviewer SHALL confirm this standard

### Standard: Publication package follows the project profile

The publication package SHALL include the cover variants and number of distinct search-relevant tags in the profile below. Each cover SHALL be composed for its stated ratio and stored at its declared production-relative path. The JSON profile is the machine-readable authority for these requirements in this project.

#### Publication profile

```json
{
  "coverAssets": [
    { "ratio": "16:9", "path": "assets/covers/cover-16x9.png" },
    { "ratio": "4:3", "path": "assets/covers/cover-4x3.png" },
    { "ratio": "3:4", "path": "assets/covers/cover-3x4.png" }
  ],
  "tagCount": 10
}
```

#### Check: Publication package

- **WHEN** the package reaches final or publication review
- **THEN** the reviewer SHALL confirm that the covers match the current profile and the title, covers, description, tags, and final video make the same viewer promise
