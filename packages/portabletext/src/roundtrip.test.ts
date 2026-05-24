import { compileSchema, defineSchema } from "@portabletext/schema";
import { describe, expect, test } from "vitest";
import { pteToTextspec } from "./pte-to-textspec";
import { textspecToPte } from "./textspec-to-pte";

const schema = compileSchema(
  defineSchema({
    decorators: [{ name: "strong" }, { name: "em" }, { name: "underline" }],
    annotations: [{ name: "link" }],
    styles: [
      { name: "normal" },
      { name: "h1" },
      { name: "h2" },
      { name: "h3" },
      { name: "h4" },
      { name: "h5" },
      { name: "h6" },
      { name: "blockquote" },
    ],
    lists: [{ name: "bullet" }, { name: "number" }],
    inlineObjects: [{ name: "emoji" }, { name: "mention" }],
    blockObjects: [{ name: "image" }, { name: "hr" }],
  }),
);

function createKeyGenerator() {
  let counter = 0;
  return () => `k${counter++}`;
}

/**
 * Round-trip: notation → PTE → notation
 *
 * Parse the notation into PTE value + selection, then serialize back.
 * The output should match the input.
 */
function roundTrip(notation: string): string {
  const keyGenerator = createKeyGenerator();
  const { value, selection } = textspecToPte(
    { keyGenerator, schema },
    notation,
  );
  return pteToTextspec({ schema }, value, selection);
}

describe("round-trip: notation → PTE → notation", () => {
  const cases = [
    // Plain text
    "P: foo|",
    "P: foo bar|",
    "P: |",

    // Styled blocks
    "H1: foo|",
    "H2: bar|",
    "H3: baz|",
    "BLOCKQUOTE: quoted|",

    // Marks
    "P: [strong:foo]|",
    "P: [em:foo]|",
    "P: foo [strong:bar] baz|",

    // Annotations
    'P: [@link href="https://example.com":click here]|',
    'P: foo [@link href="https://example.com":bar] baz|',

    // Inline objects
    'P: {emoji value="😄"}|',
    'P: foo {emoji value="😄"} bar|',

    // Block objects
    '{IMAGE src="photo.jpg"}',
    "{HR}",

    // Lists (attrs sorted alphabetically by textspec serializer)
    'P level=1 listItem="bullet": foo|',
    'P level=1 listItem="number": first|',

    // Selection variants
    "P: ^foo|",
    "P: |foo^",
    "P: foo ^bar| baz",

    // Multiple blocks
    "P: foo|\nP: bar",
    "H1: title\nP: content|",

    // No selection
    "P: foo",
    "H1: title",
    "P: [strong:bar]",
  ];

  for (const notation of cases) {
    test(notation.replace(/\n/g, "\\n"), () => {
      expect(roundTrip(notation)).toBe(notation);
    });
  }
});
