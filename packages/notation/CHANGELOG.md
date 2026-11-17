# @textspec/notation

## 2.0.0

### Major Changes

- [#10](https://github.com/textspec/textspec/pull/10) [`f67555a`](https://github.com/textspec/textspec/commit/f67555a83a0fa2134f99b41836d1c211ab1d30ef) Thanks [@christianhg](https://github.com/christianhg)! - Empty text blocks now serialize as `P:` instead of `P: ` (no trailing space), in both multiline and single-line output. Update expected strings that contain `P: ` with nothing after it.

  In multiline output, a text block whose content ends in a space now writes that last space as `\s`, so `P: foo ` becomes `P: foo\s`. Editors and formatters that trim trailing whitespace no longer change the content. Spaces before `|`, `^` or `]` stay literal, and single-line output is unchanged.

  `P:` and `P attrs:` with nothing after them now parse as an empty text block, at any depth. `P: ` still parses the same way. This also applies to container types: `UL:` with no indented children used to throw `STRUCT_EMPTY_CONTAINER` and now parses as an empty text block. `UL:{}` still throws.

  An empty text block pattern such as `P:` now makes `getRange` return `null` instead of throwing `STRUCT_EMPTY_CONTAINER`.

## 1.0.2

### Patch Changes

- [#8](https://github.com/textspec/textspec/pull/8) [`5a5499d`](https://github.com/textspec/textspec/commit/5a5499de58418c3d2199296099aeedd518e1c552) Thanks [@christianhg](https://github.com/christianhg)! - fix: escape `"` in serialized text content

  Literal `"` in block content now serializes as `\"` so it round-trips through `parse`. Previously the serializer emitted `"` literally, but the parser treats unescaped `"` as the start of an attribute string, silently consuming surrounding text or erroring on an unbalanced quote.

## 1.0.1

### Patch Changes

- [#6](https://github.com/textspec/textspec/pull/6) [`5977665`](https://github.com/textspec/textspec/commit/5977665b82c3bf24f42a476ad7a463b15101c012) Thanks [@christianhg](https://github.com/christianhg)! - fix: allow underscore as identifier start character

  Attribute names can now start with an underscore (e.g., `_key`, `_type`). Previously, identifiers could only start with letters. Underscores were already allowed in subsequent positions.
