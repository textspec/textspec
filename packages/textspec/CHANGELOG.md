# textspec

## 2.0.0

### Major Changes

- [#13](https://github.com/textspec/textspec/pull/13) [`8952604`](https://github.com/textspec/textspec/commit/8952604684a63c307e5648346dc5ee5015cfcde1) Thanks [@christianhg](https://github.com/christianhg)! - `textspec/notation` now uses `@textspec/notation` 2.0.0, which changes how empty text blocks and trailing spaces are written and parsed:
  - Empty text blocks serialize as `P:` instead of `P: `. Update expected strings that contain `P: ` with nothing after it.
  - In multiline output, a final space in block content is written as `\s`, so `P: foo ` becomes `P: foo\s`. Spaces before `|`, `^` or `]` stay literal, and single-line output is unchanged.
  - `P:` and `P attrs:` with nothing after them parse as an empty text block at any depth. `UL:` with no indented children now parses as an empty text block instead of throwing `STRUCT_EMPTY_CONTAINER`. `UL:{}` still throws.
  - `getRange` with an empty text block pattern such as `P:` returns `null` instead of throwing `STRUCT_EMPTY_CONTAINER`.

  See the [`@textspec/notation` 2.0.0 changelog](https://github.com/textspec/textspec/blob/main/packages/notation/CHANGELOG.md#200) for details.
