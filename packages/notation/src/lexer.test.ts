import { describe, expect, test } from "vitest";
import { Lexer, TokenType, type Token } from "./lexer";

function tokenize(input: string): Array<Token> {
  const lexer = new Lexer(input);
  const tokens: Array<Token> = [];
  while (true) {
    const token = lexer.nextToken();
    tokens.push(token);
    if (token.type === TokenType.EOF) {
      break;
    }
  }
  return tokens;
}

describe(Lexer.name, () => {
  describe("basic tokens", () => {
    test("simple text block", () => {
      expect(tokenize("P: foo|")).toEqual([
        { type: TokenType.IDENT, value: "P", location: { line: 1, column: 1 } },
        { type: TokenType.COLON, value: ":", location: { line: 1, column: 2 } },
        { type: TokenType.SPACE, value: " ", location: { line: 1, column: 3 } },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 4 },
        },
        { type: TokenType.FOCUS, value: "|", location: { line: 1, column: 7 } },
        { type: TokenType.EOF, value: "", location: { line: 1, column: 8 } },
      ]);
    });

    test("heading identifier", () => {
      expect(tokenize("H1: foo|")).toEqual([
        {
          type: TokenType.IDENT,
          value: "H1",
          location: { line: 1, column: 1 },
        },
        { type: TokenType.COLON, value: ":", location: { line: 1, column: 3 } },
        { type: TokenType.SPACE, value: " ", location: { line: 1, column: 4 } },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 5 },
        },
        { type: TokenType.FOCUS, value: "|", location: { line: 1, column: 8 } },
        { type: TokenType.EOF, value: "", location: { line: 1, column: 9 } },
      ]);
    });

    test("selection markers", () => {
      expect(tokenize("P: ^foo|")).toEqual([
        { type: TokenType.IDENT, value: "P", location: { line: 1, column: 1 } },
        { type: TokenType.COLON, value: ":", location: { line: 1, column: 2 } },
        { type: TokenType.SPACE, value: " ", location: { line: 1, column: 3 } },
        {
          type: TokenType.ANCHOR,
          value: "^",
          location: { line: 1, column: 4 },
        },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 5 },
        },
        { type: TokenType.FOCUS, value: "|", location: { line: 1, column: 8 } },
        { type: TokenType.EOF, value: "", location: { line: 1, column: 9 } },
      ]);
    });
  });

  describe("brackets and braces", () => {
    test("mark brackets", () => {
      expect(tokenize("P: [strong:foo]|")).toEqual([
        { type: TokenType.IDENT, value: "P", location: { line: 1, column: 1 } },
        { type: TokenType.COLON, value: ":", location: { line: 1, column: 2 } },
        { type: TokenType.SPACE, value: " ", location: { line: 1, column: 3 } },
        {
          type: TokenType.LBRACKET,
          value: "[",
          location: { line: 1, column: 4 },
        },
        {
          type: TokenType.IDENT,
          value: "strong",
          location: { line: 1, column: 5 },
        },
        {
          type: TokenType.COLON,
          value: ":",
          location: { line: 1, column: 11 },
        },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 12 },
        },
        {
          type: TokenType.RBRACKET,
          value: "]",
          location: { line: 1, column: 15 },
        },
        {
          type: TokenType.FOCUS,
          value: "|",
          location: { line: 1, column: 16 },
        },
        { type: TokenType.EOF, value: "", location: { line: 1, column: 17 } },
      ]);
    });

    test("object braces", () => {
      expect(tokenize("P: {emoji}|")).toEqual([
        { type: TokenType.IDENT, value: "P", location: { line: 1, column: 1 } },
        { type: TokenType.COLON, value: ":", location: { line: 1, column: 2 } },
        { type: TokenType.SPACE, value: " ", location: { line: 1, column: 3 } },
        {
          type: TokenType.LBRACE,
          value: "{",
          location: { line: 1, column: 4 },
        },
        {
          type: TokenType.IDENT,
          value: "emoji",
          location: { line: 1, column: 5 },
        },
        {
          type: TokenType.RBRACE,
          value: "}",
          location: { line: 1, column: 10 },
        },
        {
          type: TokenType.FOCUS,
          value: "|",
          location: { line: 1, column: 11 },
        },
        { type: TokenType.EOF, value: "", location: { line: 1, column: 12 } },
      ]);
    });
  });

  describe("mark prefixes", () => {
    test("@ for annotations", () => {
      expect(tokenize("P: [@link:foo]|")).toEqual([
        { type: TokenType.IDENT, value: "P", location: { line: 1, column: 1 } },
        { type: TokenType.COLON, value: ":", location: { line: 1, column: 2 } },
        { type: TokenType.SPACE, value: " ", location: { line: 1, column: 3 } },
        {
          type: TokenType.LBRACKET,
          value: "[",
          location: { line: 1, column: 4 },
        },
        { type: TokenType.AT, value: "@", location: { line: 1, column: 5 } },
        {
          type: TokenType.IDENT,
          value: "link",
          location: { line: 1, column: 6 },
        },
        {
          type: TokenType.COLON,
          value: ":",
          location: { line: 1, column: 10 },
        },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 11 },
        },
        {
          type: TokenType.RBRACKET,
          value: "]",
          location: { line: 1, column: 14 },
        },
        {
          type: TokenType.FOCUS,
          value: "|",
          location: { line: 1, column: 15 },
        },
        { type: TokenType.EOF, value: "", location: { line: 1, column: 16 } },
      ]);
    });

    test("~ for overlays", () => {
      expect(tokenize("P: [~highlight:foo]|")).toEqual([
        { type: TokenType.IDENT, value: "P", location: { line: 1, column: 1 } },
        { type: TokenType.COLON, value: ":", location: { line: 1, column: 2 } },
        { type: TokenType.SPACE, value: " ", location: { line: 1, column: 3 } },
        {
          type: TokenType.LBRACKET,
          value: "[",
          location: { line: 1, column: 4 },
        },
        { type: TokenType.TILDE, value: "~", location: { line: 1, column: 5 } },
        {
          type: TokenType.IDENT,
          value: "highlight",
          location: { line: 1, column: 6 },
        },
        {
          type: TokenType.COLON,
          value: ":",
          location: { line: 1, column: 15 },
        },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 16 },
        },
        {
          type: TokenType.RBRACKET,
          value: "]",
          location: { line: 1, column: 19 },
        },
        {
          type: TokenType.FOCUS,
          value: "|",
          location: { line: 1, column: 20 },
        },
        { type: TokenType.EOF, value: "", location: { line: 1, column: 21 } },
      ]);
    });
  });

  describe("escape sequences", () => {
    test("\\s for space", () => {
      expect(
        tokenize("P: foo\\s|").filter((t) => t.type === TokenType.TEXT),
      ).toEqual([
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 4 },
        },
        { type: TokenType.TEXT, value: " ", location: { line: 1, column: 7 } },
      ]);
    });

    test("\\t for tab", () => {
      expect(
        tokenize("P: foo\\tbar|").filter((t) => t.type === TokenType.TEXT),
      ).toEqual([
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 4 },
        },
        { type: TokenType.TEXT, value: "\t", location: { line: 1, column: 7 } },
        {
          type: TokenType.TEXT,
          value: "bar",
          location: { line: 1, column: 9 },
        },
      ]);
    });

    test("\\n for newline", () => {
      expect(
        tokenize("P: foo\\nbar|").filter((t) => t.type === TokenType.TEXT),
      ).toEqual([
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 4 },
        },
        { type: TokenType.TEXT, value: "\n", location: { line: 1, column: 7 } },
        {
          type: TokenType.TEXT,
          value: "bar",
          location: { line: 1, column: 9 },
        },
      ]);
    });

    test("\\uXXXX for unicode", () => {
      expect(
        tokenize("P: foo\\u0041bar|").filter((t) => t.type === TokenType.TEXT),
      ).toEqual([
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 4 },
        },
        { type: TokenType.TEXT, value: "A", location: { line: 1, column: 7 } },
        {
          type: TokenType.TEXT,
          value: "bar",
          location: { line: 1, column: 13 },
        },
      ]);
    });

    test("escaped brackets", () => {
      expect(
        tokenize("P: \\[foo\\]|").filter((t) => t.type === TokenType.TEXT),
      ).toEqual([
        { type: TokenType.TEXT, value: "[", location: { line: 1, column: 4 } },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 6 },
        },
        { type: TokenType.TEXT, value: "]", location: { line: 1, column: 9 } },
      ]);
    });

    test("escaped selection markers", () => {
      expect(
        tokenize("P: \\|foo\\^bar|").filter((t) => t.type === TokenType.TEXT),
      ).toEqual([
        { type: TokenType.TEXT, value: "|", location: { line: 1, column: 4 } },
        {
          type: TokenType.TEXT,
          value: "foo",
          location: { line: 1, column: 6 },
        },
        { type: TokenType.TEXT, value: "^", location: { line: 1, column: 9 } },
        {
          type: TokenType.TEXT,
          value: "bar",
          location: { line: 1, column: 11 },
        },
      ]);
    });
  });

  describe("quoted strings", () => {
    test("attribute value", () => {
      const stringToken = tokenize('P: {img src="foo.jpg"}|').find(
        (t) => t.type === TokenType.STRING,
      );
      expect(stringToken).toEqual({
        type: TokenType.STRING,
        value: "foo.jpg",
        location: { line: 1, column: 13 },
      });
    });

    test("escaped quotes in string", () => {
      const stringToken = tokenize('P: {img alt="He said \\"hello\\""}|').find(
        (t) => t.type === TokenType.STRING,
      );
      expect(stringToken).toEqual({
        type: TokenType.STRING,
        value: 'He said "hello"',
        location: { line: 1, column: 13 },
      });
    });
  });

  describe("indentation", () => {
    test("INDENT token", () => {
      expect(tokenize("UL:\n  LI: foo|").map((t) => t.type)).toEqual([
        TokenType.IDENT,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.IDENT,
        TokenType.COLON,
        TokenType.SPACE,
        TokenType.TEXT,
        TokenType.FOCUS,
        TokenType.DEDENT,
        TokenType.EOF,
      ]);
    });

    test("DEDENT token", () => {
      expect(tokenize("UL:\n  LI: foo\nP: bar|").map((t) => t.type)).toEqual([
        TokenType.IDENT,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.IDENT,
        TokenType.COLON,
        TokenType.SPACE,
        TokenType.TEXT,
        TokenType.NEWLINE,
        TokenType.DEDENT,
        TokenType.IDENT,
        TokenType.COLON,
        TokenType.SPACE,
        TokenType.TEXT,
        TokenType.FOCUS,
        TokenType.EOF,
      ]);
    });

    test("tabs in indentation throws", () => {
      expect(() => tokenize("UL:\n\tLI: foo|")).toThrow();
    });

    test("odd spaces throws", () => {
      expect(() => tokenize("UL:\n   LI: foo|")).toThrow();
    });

    test("skipping indent level throws", () => {
      expect(() => tokenize("UL:\n    LI: foo|")).toThrow();
    });
  });

  describe("numbers and booleans", () => {
    test("number", () => {
      const numToken = tokenize("P: {img width=100}|").find(
        (t) => t.type === TokenType.NUMBER,
      );
      expect(numToken).toEqual({
        type: TokenType.NUMBER,
        value: "100",
        location: { line: 1, column: 15 },
      });
    });

    test("boolean true", () => {
      const boolToken = tokenize("P: {img disabled=true}|").find(
        (t) => t.type === TokenType.BOOLEAN,
      );
      expect(boolToken).toEqual({
        type: TokenType.BOOLEAN,
        value: "true",
        location: { line: 1, column: 18 },
      });
    });

    test("boolean false", () => {
      const boolToken = tokenize("P: {img disabled=false}|").find(
        (t) => t.type === TokenType.BOOLEAN,
      );
      expect(boolToken).toEqual({
        type: TokenType.BOOLEAN,
        value: "false",
        location: { line: 1, column: 18 },
      });
    });
  });

  describe("raw mode", () => {
    test("brackets as literal text", () => {
      const lexer = new Lexer("[foo]");
      lexer.setRawMode(true);
      expect(lexer.nextToken()).toEqual({
        type: TokenType.TEXT,
        value: "[foo]",
        location: { line: 1, column: 1 },
      });
    });

    test("selection markers still recognized", () => {
      const lexer = new Lexer("foo|bar");
      lexer.setRawMode(true);
      expect(lexer.nextToken()).toEqual({
        type: TokenType.TEXT,
        value: "foo",
        location: { line: 1, column: 1 },
      });
      expect(lexer.nextToken()).toEqual({
        type: TokenType.FOCUS,
        value: "|",
        location: { line: 1, column: 4 },
      });
    });
  });
});
