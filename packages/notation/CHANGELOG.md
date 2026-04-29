# @textspec/notation

## 1.0.2

### Patch Changes

- [#8](https://github.com/textspec/textspec/pull/8) [`5a5499d`](https://github.com/textspec/textspec/commit/5a5499de58418c3d2199296099aeedd518e1c552) Thanks [@christianhg](https://github.com/christianhg)! - fix: escape `"` in serialized text content

  Literal `"` in block content now serializes as `\"` so it round-trips through `parse`. Previously the serializer emitted `"` literally, but the parser treats unescaped `"` as the start of an attribute string, silently consuming surrounding text or erroring on an unbalanced quote.

## 1.0.1

### Patch Changes

- [#6](https://github.com/textspec/textspec/pull/6) [`5977665`](https://github.com/textspec/textspec/commit/5977665b82c3bf24f42a476ad7a463b15101c012) Thanks [@christianhg](https://github.com/christianhg)! - fix: allow underscore as identifier start character

  Attribute names can now start with an underscore (e.g., `_key`, `_type`). Previously, identifiers could only start with letters. Underscores were already allowed in subsequent positions.
