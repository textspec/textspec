---
"@textspec/notation": patch
---

fix: allow underscore as identifier start character

Attribute names can now start with an underscore (e.g., `_key`, `_type`). Previously, identifiers could only start with letters. Underscores were already allowed in subsequent positions.
