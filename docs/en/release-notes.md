# Release Notes

## [1.2.1] - 2025-12-05

### Improvements
- **Enhanced nested bullet list functionality**: Improved to preserve ordered list metadata. This ensures that order information is correctly maintained even when ordered and unordered lists are mixed in nested lists.

## [1.2.0] - 2025-12-05

### New Features

#### Custom Font Configuration
You can now configure font families and variants in YAML frontmatter. Fonts can be set individually for headings (h1, h2), body text, bullet points, and code blocks.

**Key Features:**
- Custom font family configuration
- Individual settings for font variants (Regular, Bold, Italic, Bold Italic)
- Support for both shorthand notation and full configuration
- Automatic fallback when fonts are unavailable

**Example:**
```yaml
---
fonts:
  h1:
    family: "Roboto"
    style: "Medium"        # Base style
    bold: "Bold"           # Bold variant
    italic: "Italic"       # Italic variant
    boldItalic: "Bold Italic"  # Bold Italic variant
  h2: "Open Sans"          # Shorthand notation (uses "Regular")
  body:
    family: "Source Sans Pro"
    style: "Regular"
    bold: "Semibold"       # Custom bold variant
  bullets:
    family: "Inter"
    style: "Regular"
  code:
    family: "Fira Code"
    style: "Regular"
---
```

See `examples/fonts.md` for details.

#### Version Compatibility Check
Introduced protocol versioning for CLI-Plugin communication, enabling detection of version mismatches.

**Key Features:**
- Automatic version check on WebSocket connection
- Version mismatch warning display in Plugin UI
- CLI automatically reads version from `package.json`
- Ensures communication between compatible versions

**Behavior:**
- CLI and Plugin exchange version information on connection
- Warning displayed when major versions differ
- Minor and patch version differences are tolerated

#### Image Size Specification (Marp Style)
Added support for image size specifications. Supports individual width/height settings, fixed sizes, and percentage-based sizing.

**Supported Formats:**
- `![w:400](./image.png)` - Width 400px (height auto-calculated, maintains aspect ratio)
- `![h:300](./image.png)` - Height 300px (width auto-calculated, maintains aspect ratio)
- `![w:400 h:300](./image.png)` - Fixed size 400x300px
- `![w:50%](./image.png)` - 50% of slide width (slide width is 1920px)
- `![w:400 Logo](./image.png)` - Size specification + alt text

See `examples/images.md` for details.

#### Nested Bullet Lists
Added support for multi-level nested bullet lists. Different markers are used for each level to visually represent hierarchy.

**Key Features:**
- Support for up to 4 levels of nesting
- Different markers for each level (•, ◦, ▪, –)
- Support for mixing ordered and unordered lists
- Support for inline formatting (bold, italic, code, links)

**Markers:**
- Level 0: `•` (U+2022)
- Level 1: `◦` (U+25E6)
- Level 2: `▪` (U+25AA)
- Level 3+: `–` (U+2013)

**Example:**
```markdown
- Level 0 item
  - Level 1 item (indented with 2 spaces)
  - Another level 1 item
    - Level 2 item
    - Another level 2 item
      - Level 3 item
- Back to level 0
```

See `examples/bullets.md` for details.

### Improvements

#### Dependency Updates
- Updated esbuild to 0.27.1 for improved compatibility and performance

#### Build Configuration Optimization
- Adjusted Plugin build target to ES2016 to ensure compatibility with Figma Plugin sandbox environment
- Improved automatic transpilation of modern JavaScript syntax

### Documentation
- Added detailed documentation for custom font configuration (English and Japanese)
- Added usage examples and documentation for image size specifications
- Added specifications and usage examples for nested bullet lists
- Added explanations about version compatibility
- Added descriptions of new features to `CLAUDE.md`

### Tests
- Added comprehensive tests for custom font configuration
- Added tests for image size specifications
- Added tests for nested bullet lists
- Added tests for version compatibility checks
