# @textspec/notation

## 1.0.1

### Patch Changes

- [#6](https://github.com/textspec/textspec/pull/6) [`5977665`](https://github.com/textspec/textspec/commit/5977665b82c3bf24f42a476ad7a463b15101c012) Thanks [@christianhg](https://github.com/christianhg)! - fix: allow underscore as identifier start character

  Attribute names can now start with an underscore (e.g., `_key`, `_type`). Previously, identifiers could only start with letters. Underscores were already allowed in subsequent positions.
