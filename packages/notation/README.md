# @textspec/notation

A human-readable notation for representing rich text editor state.

```
P: Hello [strong:world]|
```

This simple line describes a paragraph with "Hello ", bold "world", and a caret at the end.

## Why?

Rich text editors are hard to test. Selection state, mark boundaries, nested structures: they're all difficult to express in assertions. This notation makes editor state readable and diffable:

```gherkin
Scenario: Typing at end of bold extends it
  Given the text
    """
    P: foo [strong:bar|]
    """
  When " baz" is typed
  Then the text is
    """
    P: foo [strong:bar baz|]
    """
```

## Installation

```bash
npm install @textspec/notation
```

## Quick Start

```typescript
import { parse, serialize } from "@textspec/notation";

// Parse notation into an AST
const state = parse("P: Hello [strong:world]|");

// Serialize back to notation
const output = serialize(state);
// => "P: Hello [strong:world]|"
```

## API

### `parse(input: string): EditorState`

Parses notation into an editor state AST.

### `serialize(state: EditorState, options?: SerializeOptions): string`

Converts an editor state back to notation.

Options:

- `singleLine?: boolean`: output single-line format using `;;` separators

### `ParseError`

Thrown when parsing invalid input. Includes error code, message, and source location.

```typescript
import { parse, ParseError } from "@textspec/notation";

try {
  parse("invalid");
} catch (e) {
  if (e instanceof ParseError) {
    console.log(e.code); // e.g., "SEL_NONE"
    console.log(e.location); // { line, column, offset }
  }
}
```

### `getRange(document: EditorState, pattern: string): Selection | null`

Finds a pattern in the document and returns a selection spanning it.

```typescript
import { getRange, parse } from "@textspec/notation";

const doc = parse(`
H1: Welcome|
P: Read the [@link href="/docs":documentation] for more info.
P: Contact [strong:support] if you need help.
`);

// Find plain text
getRange(doc, "more info");
// => { anchor: { path: [1, 2], offset: 5 }, focus: { path: [1, 2], offset: 14 } }

// Find mark structure (matches marks with matching type and content prefix)
getRange(doc, "[strong:supp]");
// => { anchor: { path: [2, 0], offset: 8 }, focus: { path: [2, 2], offset: 0 } }

// Find annotation with attributes
getRange(doc, '[@link href="/docs":doc]');
// => { anchor: { path: [1, 0], offset: 9 }, focus: { path: [1, 2], offset: 0 } }

// Multi-block pattern (first block suffix + last block prefix)
getRange(doc, "Welcome;;P: Read");
// => { anchor: { path: [0, 0], offset: 0 }, focus: { path: [1, 0], offset: 4 } }
```

### `getPointBefore(document: EditorState, pattern: string): Point | null`

Finds a pattern and returns the point just before it.

```typescript
import { getPointBefore, parse } from "@textspec/notation";

const doc = parse("P: Hello [strong:world]|");

getPointBefore(doc, "world");
// => { path: [0, 1, 0], offset: 0 }

getPointBefore(doc, "[strong:wor]");
// => { path: [0, 0], offset: 6 }
```

### `getPointAfter(document: EditorState, pattern: string): Point | null`

Finds a pattern and returns the point just after it.

```typescript
import { getPointAfter, parse } from "@textspec/notation";

const doc = parse("P: Hello [strong:world]|");

getPointAfter(doc, "Hello");
// => { path: [0, 0], offset: 5 }

getPointAfter(doc, "[strong:wor]");
// => { path: [0, 2], offset: 0 }
```

### Types

```typescript
import type {
  Attributes,
  AttributeValue,
  Block,
  BlockObject,
  ContainerBlock,
  EditorState,
  InlineNode,
  InlineObject,
  JsonValue,
  Mark,
  MarkMode,
  Point,
  RawBlock,
  Selection,
  SerializeOptions,
  Text,
  TextBlock,
} from "@textspec/notation";
```

---

# Notation Reference

## Contents

- [Overview](#overview)
- [Blocks](#blocks)
  - [Text blocks](#text-block)
  - [Containers](#container)
  - [Code blocks](#code)
  - [Block objects](#block-object)
- [Inline content](#inline-content)
  - [Text](#text)
  - [Marks](#marks)
  - [Inline objects](#inline-object)
- [Selection](#selection)
- [Attributes](#attributes)
- [Escaping](#escaping)
- [Syntax details](#syntax-details)
- [Single-line format](#single-line-format)
- [Validation](#validation)
- [Examples](#examples)

---

## Overview

A document represents:

1. **Blocks**: text blocks, containers, code, and block objects
2. **Inline content**: text, marks, and inline objects
3. **Selection**: collapsed caret (`|`) or range with anchor (`^`) and focus (`|`)

```
H1: Welcome|
P: This is [strong:bold] and [em:italic].
UL:
  LI: First item
  LI: Second item
```

### Design goals

- **Readable**: easy to scan in diffs and pull requests
- **Explicit**: no implicit behavior or inference
- **Unambiguous**: one representation per state
- **Editor-agnostic**: not tied to any specific implementation

### Indentation

Hierarchy is expressed through indentation:

- Use exactly **2 spaces** per nesting level
- Tabs are not allowed
- Indentation must not skip levels

---

## Blocks

Blocks are the top-level structural units. Text blocks, containers, and raw blocks can have optional attributes.

| Type       | Contains         | Syntax                            |
| ---------- | ---------------- | --------------------------------- |
| Text block | Inline content   | `TYPE attrs: content`             |
| Container  | Child blocks     | `TYPE attrs:` + indented children |
| Raw block  | Raw text lines   | `TYPE! attrs:` + indented         |
| Object     | Nothing (atomic) | `{TYPE attrs}`                    |

### Text block

Text blocks contain inline content: text, marks, and inline objects.

```
P: foo bar|
H1: [strong:foo] bar
P: foo {emoji value="😄"} bar|
```

With attributes:

```
P align="center": centered text|
H1 id="intro": Introduction|
LI checked=true: task item|
```

Common types: `P`, `H1`, `H2`, `H3`

### Container

Containers hold child blocks.

```
UL:
  LI: foo
  LI: bar
```

With attributes:

```
OL start=5:
  LI: fifth|
  LI: sixth

UL style="disc":
  LI: item|
```

Common types: `UL`, `OL`, `BLOCKQUOTE`

Containers can nest:

```
BLOCKQUOTE:
  P: foo
  UL:
    LI: bar
    LI: baz|
```

To have both text and nested blocks in an `LI`, use an explicit `P`:

```
UL:
  LI:
    P: foo
    UL:
      LI:
        P: nested|
```

### Raw blocks

Raw blocks use raw parsing: inline syntax is not interpreted.

Use `TYPE!:` syntax for raw content:

```
CODE!:
  const arr = [1, 2, 3]
  const obj = {a: 1}|

MATH!:
  \frac{1}{2} + \sum_{i=0}\^{n}|

HTML!:
  <div class="foo">content</div>|
```

With attributes:

```
CODE! lang="typescript":
  const x: number = 1|

CODE! lang="python" highlight="1,3":
  def foo():
      pass|
```

Brackets, braces, and backslashes are literal. Selection markers (`|`, `^`) still work.

### Block object

Block objects are atomic: no content, no children.

```
{IMAGE src="photo.jpg" alt="A photo"}
{HR}
```

Block objects can be selected:

```
^{IMAGE src="photo.jpg"}|
```

---

## Inline content

Text blocks contain inline content:

| Type          | Description     | Syntax             |
| ------------- | --------------- | ------------------ |
| Text          | Character data  | literal characters |
| Mark          | Formatting span | `[TYPE:content]`   |
| Inline object | Atomic element  | `{TYPE attrs}`     |

### Text

Plain character content. In the tree, text nodes are leaves.

```
P: foo bar|
```

### Marks

Marks wrap content. Three modes, distinguished by prefix:

| Mode       | Prefix | Purpose          | Examples                    |
| ---------- | ------ | ---------------- | --------------------------- |
| Decorator  | (none) | Formatting       | `strong`, `em`, `underline` |
| Annotation | `@`    | References/links | `link`, `mention`           |
| Overlay    | `~`    | Editorial marks  | `highlight`, `comment`      |

**Decorators**: no prefix:

```
[strong:bold text]
[em:italic text]
```

**Annotations**: `@` prefix:

```
[@link href="https://example.com":click here]
[@mention id="u1":Alice]
```

**Overlays**: `~` prefix:

```
[~highlight color="yellow":important]
[~comment id="c1":needs review]
```

Marks can nest:

```
P: [strong:[em:bold and italic]]|
P: [@link href="x":foo [strong:bar] baz]|
```

### Inline object

Inline objects are atomic elements.

```
P: Hello {emoji value="😄"} world|
P: Contact {mention id="u1" label="Alice"} for help|
```

Selected inline object:

```
P: foo ^{emoji value="😄"}| bar
```

---

## Selection

Two markers represent selection:

| Marker | Meaning                     |
| ------ | --------------------------- |
| `\|`   | **Focus**: cursor position  |
| `^`    | **Anchor**: selection start |

### Collapsed selection (caret)

Single focus marker:

```
P: foo|
```

### Range selection

Both anchor and focus:

```
P: foo ^bar| baz
```

### Direction

```
P: ^foo|        forward selection (left-to-right)
P: |foo^        backward selection (right-to-left)
```

### Multi-block selection

```
P: foo ^bar
P: baz| qux
```

### Selection in marks

```
P: [strong:^foo bar|]
P: [strong:fo^o] bar [em:ba|z]
```

### Rules

A document must have exactly one of:

- Collapsed: one `|`
- Range: one `^` and one `|`

---

## Attributes

Space-separated key/value pairs:

```
href="https://example.com"
width=100
disabled=true
data={"key": "value"}
tags=["a", "b", "c"]
```

Value types:

- **Strings**: `"quoted text"`
- **Numbers**: `100`
- **Booleans**: `true`, `false`
- **JSON objects**: `{"key": "value"}`
- **JSON arrays**: `["a", "b"]`

JSON values support full nesting:

```
P data={"author": "john", "meta": {"id": 1}}: text|
P tags=["draft", "review"]: content|
```

---

## Escaping

### Reserved characters

```
\[  \]    brackets
\{  \}    braces
\|  \^    selection markers (as literals)
\;        semicolon (to escape ;;)
\\        backslash
```

### Whitespace

```
\s    space (for boundary whitespace)
\t    tab
\n    newline
```

### Unicode

```
\u00A0    non-breaking space
\u2019    curly apostrophe
```

---

## Syntax details

### Space after colon

Required for text blocks (separator, not content):

```
P: foo|       content is "foo"
P:  foo|      content is " foo"
P:foo|        parse error
```

### Marks vs blocks

Marks don't have this separator space:

```
[strong:foo]      content is "foo"
[strong: foo]     content is " foo"
```

### Empty content

```
P: |              empty paragraph with caret
[strong:^|]       empty mark with selection
```

### Colons in content

Only the first colon is a delimiter:

```
P: foo: bar: baz|     content is "foo: bar: baz"
```

### Case sensitivity

Types are case-sensitive. Convention: blocks uppercase, marks lowercase.

```
P: foo|           paragraph
[strong:bar]      bold mark
```

---

## Single-line format

For contexts that require single-line values (like Gherkin Scenario Outline Examples tables), use `;;` as a block separator and `{...}` for inline container children.

### Block separator `;;`

Use `;;` instead of newlines to separate blocks:

```
# Multiline
P: foo|
H1: bar

# Single-line
P: foo|;;H1: bar
```

Both forms parse to the same AST.

### Inline container children

Use `TYPE:{...}` for containers in single-line format:

```
# Multiline
UL:
  LI: foo
  LI: bar|

# Single-line
UL:{LI: foo;;LI: bar|}
```

Nested containers:

```
UL:{LI:{P: foo|;;UL:{LI: nested}}}
```

### Escaping semicolons

Use `\;` to include literal semicolons in text:

```
P: foo\;\;bar|    → text contains "foo;;bar"
```

Single semicolons don't need escaping:

```
P: foo;bar|       → text contains "foo;bar"
```

### Gherkin Scenario Outline example

```gherkin
Scenario Outline: Selection behavior
  Given the text "<before>"
  When "<action>" is performed
  Then the text is "<after>"

  Examples:
    | before                 | action      | after                      |
    | P: ^foo\|              | type "x"    | P: x\|                     |
    | UL:{LI: foo\|;;LI: bar}| backspace   | UL:{LI: fo\|;;LI: bar}     |
```

### Serializing single-line

Use the `singleLine` option:

```typescript
import { serialize } from "@textspec/notation";

serialize(state, { singleLine: true });
// => "P: foo|;;H1: bar"
```

---

## Validation

A parser must reject:

- **Indentation**: tabs, non-multiple-of-2, level skips
- **Selection**: multiple `|`, multiple `^`, `^` without `|`, no selection
- **Delimiters**: unbalanced `[]` or `{}`
- **Structure**: empty containers, empty document, missing space after colon

---

## Examples

### Rich formatting

```
P: This is [strong:bold], [em:italic], and [strong:[em:both]].|
P: Here is a [@link href="https://example.com":link with [strong:bold] text].
```

### Nested lists

```
UL:
  LI:
    P: Fruits
    UL:
      LI:
        P: Apples
      LI:
        P: Bananas|
  LI:
    P: Vegetables
```

### Mixed content

```
H1: My Post|
P: Here is a photo:
{IMAGE src="photo.jpg" alt="A photo"}
P: And an emoji {emoji value="😄"} inline.
```

### Raw blocks

```
CODE!:
  function foo() {
    return ^bar;
  }|

MATH!:
  E = mc\^2|
```

---

## License

MIT
