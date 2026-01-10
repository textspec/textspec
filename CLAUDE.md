# Bash commands

- pnpm build - Build package
- pnpm check:lint - Lint package
- pnpm check:types - Typecheck package
- pnpm test:unit - Run package unit tests
- pnpm test:browser - Run package browser tests
- pnpm test:browser:chromium - Run specific browser tests

# Code style

- Avoid code comments unless they explain **why** a piece of code is needed
- Comments for an if statement go inside the if statement, not above it
- Place helper functions below main functions
- Only use type casting as a last resort
- Use backticks when referencing code in comments and other text
- Don't use one-character variable names
- Use full, easily-understood variable names

# Test conventions

- Use `function.name` for top-level describe blocks
- Simple test names: "simple paragraph" not "parses simple paragraph"
- Never use "should" in test names
- Use `toEqual` for exact comparisons - no `toMatchObject`, `.not.toBeNull()`, or conditional guards
- Test exact expected values, not substrings or partial matches

```ts
// BAD:
describe("Parser", () => {
  test("should parse simple paragraph", () => {
    expect(result.foo).toBe("x");
    expect(result.bar).toBe("y");
  });
});

// GOOD:
describe(parse.name, () => {
  test("simple paragraph", () => {
    expect(parse("P: foo|")).toEqual({
      blocks: [
        {
          kind: "textBlock",
          type: "P",
          children: [{ kind: "text", text: "foo" }],
        },
      ],
      selection: {
        anchor: { path: [0, 0], offset: 3 },
        focus: { path: [0, 0], offset: 3 },
      },
    });
  });
});
```
