---
"@textspec/notation": major
---

Empty text blocks now serialize as `P:` instead of `P: ` (no trailing space), in both multiline and single-line output. Update expected strings that contain `P: ` with nothing after it.

In multiline output, a text block whose content ends in a space now writes that last space as `\s`, so `P: foo ` becomes `P: foo\s`. Editors and formatters that trim trailing whitespace no longer change the content. Spaces before `|`, `^` or `]` stay literal, and single-line output is unchanged.

`P:` and `P attrs:` with nothing after them now parse as an empty text block, at any depth. `P: ` still parses the same way. This also applies to container types: `UL:` with no indented children used to throw `STRUCT_EMPTY_CONTAINER` and now parses as an empty text block. `UL:{}` still throws.

An empty text block pattern such as `P:` now makes `getRange` return `null` instead of throwing `STRUCT_EMPTY_CONTAINER`.
