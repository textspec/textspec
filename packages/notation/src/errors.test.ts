import { describe, expect, test } from "vitest";
import { ErrorCode, ErrorMessages, ParseError, parseError } from "./errors";
import { parse } from "./parser";

describe("Errors", () => {
  describe("ParseError", () => {
    test("includes error code", () => {
      const error = new ParseError(
        ErrorCode.InvalidIdentifier,
        { line: 1, column: 1 },
        "test",
      );
      expect(error.code).toBe(ErrorCode.InvalidIdentifier);
    });

    test("includes location", () => {
      const error = new ParseError(ErrorCode.InvalidIdentifier, {
        line: 5,
        column: 10,
      });
      expect(error.location.line).toBe(5);
      expect(error.location.column).toBe(10);
    });

    test("formats message with location", () => {
      const error = new ParseError(ErrorCode.InvalidIdentifier, {
        line: 1,
        column: 5,
      });
      expect(error.message).toContain("line 1");
      expect(error.message).toContain("column 5");
    });

    test("includes details when provided", () => {
      const error = new ParseError(
        ErrorCode.InvalidIdentifier,
        { line: 1, column: 1 },
        "custom details",
      );
      expect(error.message).toContain("custom details");
    });

    test("has correct name", () => {
      const error = new ParseError(ErrorCode.InvalidIdentifier, {
        line: 1,
        column: 1,
      });
      expect(error.name).toBe("ParseError");
    });
  });

  describe("parseError factory", () => {
    test("creates ParseError with location", () => {
      const error = parseError(ErrorCode.MultipleFocus, 2, 3, "extra info");
      expect(error).toBeInstanceOf(ParseError);
      expect(error.code).toBe(ErrorCode.MultipleFocus);
      expect(error.location.line).toBe(2);
      expect(error.location.column).toBe(3);
    });
  });

  describe("ErrorMessages", () => {
    test("has message for every error code", () => {
      for (const code of Object.values(ErrorCode)) {
        expect(ErrorMessages[code as ErrorCode]).toBeDefined();
        expect(typeof ErrorMessages[code as ErrorCode]).toBe("string");
      }
    });
  });

  describe("error codes in parsing", () => {
    test("TabsInIndentation", () => {
      expect(() => parse("UL:\n\tLI: foo|")).toThrow(ParseError);
      try {
        parse("UL:\n\tLI: foo|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.TabsInIndentation);
      }
    });

    test("IndentationNotMultipleOfTwo", () => {
      expect(() => parse("UL:\n   LI: foo|")).toThrow(ParseError);
      try {
        parse("UL:\n   LI: foo|");
      } catch (e) {
        expect((e as ParseError).code).toBe(
          ErrorCode.IndentationNotMultipleOfTwo,
        );
      }
    });

    test("IndentationSkipsLevel", () => {
      expect(() => parse("UL:\n    LI: foo|")).toThrow(ParseError);
      try {
        parse("UL:\n    LI: foo|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.IndentationSkipsLevel);
      }
    });

    test("MultipleFocus", () => {
      expect(() => parse("P: foo|bar|")).toThrow(ParseError);
      try {
        parse("P: foo|bar|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.MultipleFocus);
      }
    });

    test("MultipleAnchor", () => {
      expect(() => parse("P: ^foo^bar|")).toThrow(ParseError);
      try {
        parse("P: ^foo^bar|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.MultipleAnchor);
      }
    });

    test("NoSelection", () => {
      // NoSelection is no longer an error - documents without selection return null selection
      const result = parse("P: foo bar");
      expect(result.selection).toBeNull();
    });

    test("UnbalancedBracket", () => {
      expect(() => parse("P: [strong:foo|")).toThrow(ParseError);
      try {
        parse("P: [strong:foo|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.UnbalancedBracket);
      }
    });

    test("UnbalancedBrace", () => {
      expect(() => parse("P: {emoji|")).toThrow(ParseError);
      try {
        parse("P: {emoji|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.UnbalancedBrace);
      }
    });

    test("MissingColonInMark", () => {
      // Mark without colon - [strong] instead of [strong:]
      expect(() => parse("P: [strong]|")).toThrow(ParseError);
      try {
        parse("P: [strong]|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.MissingColonInMark);
      }
    });

    test("EmptyContainer", () => {
      // UL: with newline but no children
      expect(() => parse("UL:\nP: after|")).toThrow(ParseError);
      try {
        parse("UL:\nP: after|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.EmptyContainer);
      }
    });

    test("EmptyDocument", () => {
      expect(() => parse("")).toThrow(ParseError);
      try {
        parse("");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.EmptyDocument);
      }
    });

    test("MissingSpaceAfterColon", () => {
      expect(() => parse("P:foo|")).toThrow(ParseError);
      try {
        parse("P:foo|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.MissingSpaceAfterColon);
      }
    });

    test("MalformedAttribute", () => {
      expect(() => parse("P: {img src}|")).toThrow(ParseError);
      try {
        parse("P: {img src}|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.MalformedAttribute);
      }
    });

    test("UnclosedQuote", () => {
      expect(() => parse('P: {img src="foo}|')).toThrow(ParseError);
      try {
        parse('P: {img src="foo}|');
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.UnclosedQuote);
      }
    });

    test("InvalidEscapeSequence", () => {
      expect(() => parse("P: \\x|")).toThrow(ParseError);
      try {
        parse("P: \\x|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.InvalidEscapeSequence);
      }
    });

    test("InvalidJson", () => {
      expect(() => parse("P: {node data={invalid json}}|")).toThrow(ParseError);
      try {
        parse("P: {node data={invalid json}}|");
      } catch (e) {
        expect((e as ParseError).code).toBe(ErrorCode.InvalidJson);
      }
    });
  });
});
