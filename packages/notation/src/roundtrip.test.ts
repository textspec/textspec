import { describe, expect, test } from "vitest";
import { parse } from "./parser";
import { serialize } from "./serializer";

describe("Round-trip", () => {
  const testCases = [
    // Simple text blocks
    "P: foo|",
    "P: foo bar|",
    "H1: foo|",
    "H2: bar baz|",

    // Selection variants
    "P: ^foo|",
    "P: |foo^",
    "P: foo ^bar| baz",
    "P: foo|",

    // Marks - decorators
    "P: [strong:foo]|",
    "P: [em:foo]|",
    "P: [strong:[em:foo]]|",
    "P: foo [strong:bar] baz|",

    // Marks - annotations
    'P: [@link href="https://example.com":foo]|',
    'P: foo [@link href="https://example.com":bar] baz|',

    // Marks - overlays
    'P: [~highlight id="h1":foo]|',
    'P: [~highlight id="h1" color="yellow":foo]|',

    // Inline objects
    'P: {emoji value="😄"}|',
    'P: foo {emoji value="😄"} bar|',
    'P: {mention id="u1"}|',

    // Block objects
    '{IMAGE src="https://example.com/foo.jpg"}|',
    "{HR}|",

    // Containers
    "UL:\n  LI: foo|",
    "UL:\n  LI: foo\n  LI: bar|",
    "OL:\n  LI: foo\n  LI: bar\n  LI: baz|",

    // Nested containers
    "UL:\n  LI:\n    P: foo\n    UL:\n      LI:\n        P: bar|",
    "UL:\n  LI:\n    P: foo\n    UL:\n      LI:\n        P: bar\n      LI:\n        P: baz|",
    "OL:\n  LI:\n    P: first\n    UL:\n      LI:\n        P: nested|",
    "BLOCKQUOTE:\n  P: foo|",
    "BLOCKQUOTE:\n  UL:\n    LI: quoted list|",

    // Multiple blocks
    "P: foo|\nP: bar",
    "H1: title\nP: content|",

    // Raw blocks
    "CODE!:\n  const x = 1|",
    "CODE!:\n  line1\n  line2|",
    "CODE!:\n  ^line1\n  line2|",
    "CODE!:\n  line1^\n  line2|",
    "CODE!:\n  const arr = [1, 2, 3]|",

    // Explicit raw blocks
    "MATH!:\n  \\frac{1}{2}|",
    "HTML!:\n  <div>content</div>|",
    "LATEX!:\n  \\begin{equation}\n  x = y|",

    // Complex combinations
    "P: foo [strong:bar] baz|\nP: qux",
    "UL:\n  LI: [strong:foo]|\n  LI: bar",

    // Block attributes
    'P align="center": foo|',
    'H1 id="intro" class="main": title|',
    "P level=2: foo|",
    "LI checked=true: task|",
    "OL start=5:\n  LI: item|",
    'UL style="disc":\n  LI: foo|',
    'CODE! lang="typescript":\n  const x = 1|',

    // JSON attributes
    'P: {node data={"key":"value"}}|',
    'P: {node tags=["a","b","c"]}|',
    'P: {node meta={"nested":{"x":1}}}|',
    "P: {node value=null}|",
    'P data={"author":"john"}: text|',
  ];

  for (const input of testCases) {
    test(`${input.replace(/\n/g, "\\n")}`, () => {
      const parsed = parse(input);
      const roundTripped = parse(serialize(parsed));
      expect(roundTripped).toEqual(parsed);
    });
  }

  const noSelectionCases = [
    "P: foo",
    "P: foo bar",
    "H1: title",
    "P: [strong:foo]",
    "P: foo [em:bar] baz",
    'P: [@link href="url":text]',
    'P: {emoji value="x"}',
    "{HR}",
    "UL:\n  LI: foo\n  LI: bar",
    "CODE!:\n  const x = 1",
    'P align="center": text',
  ];

  for (const input of noSelectionCases) {
    test(`no selection: ${input.replace(/\n/g, "\\n")}`, () => {
      const parsed = parse(input);
      const roundTripped = parse(serialize(parsed));
      expect(roundTripped).toEqual(parsed);
    });
  }
});
