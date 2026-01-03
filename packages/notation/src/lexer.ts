/**
 * Lexer for the Editor State DSL
 *
 * Converts a character stream into tokens with escape handling and indentation tracking.
 */

import { ErrorCode, parseError } from "./errors";
import type { SourceLocation } from "./errors";

// =============================================================================
// Token Types
// =============================================================================

export const TokenType = {
  // Structure
  NEWLINE: "NEWLINE",
  INDENT: "INDENT",
  DEDENT: "DEDENT",
  BLOCK_SEP: "BLOCK_SEP", // ;; for single-line block separation
  EOF: "EOF",

  // Delimiters
  COLON: "COLON",
  BANG: "BANG",
  LBRACKET: "LBRACKET",
  RBRACKET: "RBRACKET",
  LBRACE: "LBRACE",
  RBRACE: "RBRACE",

  // Selection markers
  FOCUS: "FOCUS",
  ANCHOR: "ANCHOR",

  // Mark mode prefixes
  AT: "AT",
  TILDE: "TILDE",

  // Values
  IDENT: "IDENT",
  EQUALS: "EQUALS",
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  JSON: "JSON",

  // Content
  TEXT: "TEXT",
  SPACE: "SPACE",
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export interface Token {
  type: TokenType;
  value: string;
  location: SourceLocation;
}

// =============================================================================
// Lexer State
// =============================================================================

/**
 * The lexer uses context flags to handle ambiguous syntax. Without context,
 * the lexer cannot distinguish between:
 *
 * - `strong` as an identifier (mark type) vs text content
 * - `{` as inline object start vs JSON attribute value
 * - `[` as mark start vs JSON array attribute value
 *
 * The parser controls these flags to tell the lexer what to expect next.
 * This avoids the need for unbounded lookahead or backtracking.
 */
interface LexerState {
  input: string;
  pos: number;
  line: number;
  column: number;
  /**
   * Stack of indentation levels (in spaces). Used to emit INDENT/DEDENT tokens.
   * Starts with [0] representing the base level. When indentation increases by
   * 2 spaces, we push the new level; when it decreases, we pop and emit DEDENT
   * tokens for each level closed.
   */
  indentStack: Array<number>;
  /**
   * When dedenting multiple levels at once (e.g., from 4 spaces to 0), we need
   * to emit multiple DEDENT tokens. This counter tracks how many are pending.
   */
  pendingDedents: number;
  atLineStart: boolean;
  /**
   * Raw mode is used for CODE!/MATH!/HTML! blocks where `[]{}` are literal text.
   * Only selection markers (`|`, `^`) and their escapes (`\|`, `\^`) are special.
   */
  inRawMode: boolean;
  /**
   * When true, the next alphanumeric sequence is tokenized as IDENT (or BOOLEAN
   * for true/false). When false, it's tokenized as TEXT. Set by parser after
   * seeing `[`, `{`, `@`, `~`, `=`, or at line/block start.
   */
  expectIdent: boolean;
  /**
   * When true, `{` or `[` starts a JSON value (object/array) rather than
   * inline object or mark. Set after `=` in attribute parsing.
   */
  expectAttrValue: boolean;
}

// =============================================================================
// Lexer Class
// =============================================================================

export class Lexer {
  private state: LexerState;

  constructor(input: string) {
    // Normalize line endings to LF
    const normalized = input.replace(/\r\n/g, "\n");

    this.state = {
      input: normalized,
      pos: 0,
      line: 1,
      column: 1,
      indentStack: [0],
      pendingDedents: 0,
      atLineStart: true,
      inRawMode: false,
      expectIdent: true, // Start expecting an identifier (block type)
      expectAttrValue: false,
    };
  }

  /**
   * Tell the lexer to expect an identifier for the next token.
   */
  setExpectIdent(expect: boolean): void {
    this.state.expectIdent = expect;
  }

  /**
   * Enable raw mode for code blocks ([] and {} are literal).
   */
  setRawMode(enabled: boolean): void {
    this.state.inRawMode = enabled;
  }

  /**
   * Get current source location.
   */
  get location(): SourceLocation {
    return {
      line: this.state.line,
      column: this.state.column,
    };
  }

  /**
   * Peek at current character without consuming.
   */
  peek(offset = 0): string {
    return this.state.input[this.state.pos + offset] ?? "";
  }

  /**
   * Check if we've reached end of input.
   */
  isEOF(): boolean {
    return this.state.pos >= this.state.input.length;
  }

  /**
   * Consume and return the current character.
   */
  advance(): string {
    const char = this.state.input[this.state.pos];
    if (char === undefined) {
      return "";
    }

    this.state.pos++;
    if (char === "\n") {
      this.state.line++;
      this.state.column = 1;
      this.state.atLineStart = true;
    } else {
      this.state.column++;
    }

    return char;
  }

  /**
   * Get the next token.
   */
  nextToken(): Token {
    // Handle pending dedents first
    if (this.state.pendingDedents > 0) {
      this.state.pendingDedents--;
      return this.makeToken(TokenType.DEDENT, "");
    }

    // Handle line start (indentation)
    if (this.state.atLineStart && !this.isEOF()) {
      const indentToken = this.handleLineStart();
      if (indentToken) {
        return indentToken;
      }
    }

    // EOF
    if (this.isEOF()) {
      // Emit dedents for remaining indent levels (one at a time)
      if (this.state.indentStack.length > 1) {
        this.state.indentStack.pop();
        return this.makeToken(TokenType.DEDENT, "");
      }
      return this.makeToken(TokenType.EOF, "");
    }

    const char = this.peek();

    // Newline
    if (char === "\n") {
      const loc = this.location;
      this.advance();
      return { type: TokenType.NEWLINE, value: "\n", location: loc };
    }

    // Skip blank lines at the start of processing
    // (handled by handleLineStart for subsequent lines)

    // Block separator ;; (when not in raw mode)
    if (!this.state.inRawMode && char === ";" && this.peek(1) === ";") {
      const loc = this.location;
      this.advance(); // consume first ;
      this.advance(); // consume second ;
      this.state.expectIdent = true; // Expect block type after ;;
      return { type: TokenType.BLOCK_SEP, value: ";;", location: loc };
    }

    // Single-character tokens (when not in raw mode)
    if (!this.state.inRawMode) {
      switch (char) {
        case ":":
          return this.singleChar(TokenType.COLON);
        case "!":
          return this.singleChar(TokenType.BANG);
        case "[":
          if (this.state.expectAttrValue) {
            this.state.expectAttrValue = false;
            return this.readJsonValue();
          }
          this.state.expectIdent = true; // Expect mark type after [
          return this.singleChar(TokenType.LBRACKET);
        case "]":
          return this.singleChar(TokenType.RBRACKET);
        case "{":
          if (this.state.expectAttrValue) {
            this.state.expectAttrValue = false;
            return this.readJsonValue();
          }
          this.state.expectIdent = true; // Expect object type after {
          return this.singleChar(TokenType.LBRACE);
        case "}":
          return this.singleChar(TokenType.RBRACE);
        case "=":
          this.state.expectIdent = true; // Expect value (could be boolean identifier)
          this.state.expectAttrValue = true; // May be JSON value
          return this.singleChar(TokenType.EQUALS);
        case "@":
          this.state.expectIdent = true; // Expect mark type after @
          return this.singleChar(TokenType.AT);
        case "~":
          this.state.expectIdent = true; // Expect mark type after ~
          return this.singleChar(TokenType.TILDE);
      }
    }

    // Selection markers (always recognized, even in raw mode)
    if (char === "|" && this.peek(-1) !== "\\") {
      return this.singleChar(TokenType.FOCUS);
    }
    if (char === "^" && this.peek(-1) !== "\\") {
      return this.singleChar(TokenType.ANCHOR);
    }

    // Escape sequences (not in raw mode, except for \| and \^)
    if (char === "\\") {
      if (this.state.inRawMode) {
        // In raw mode, only \| and \^ are escapes, everything else is literal
        const next = this.peek(1);
        if (next === "|" || next === "^") {
          return this.readEscape();
        }
        // Treat backslash as literal text
        return this.singleChar(TokenType.TEXT);
      }
      return this.readEscape();
    }

    // Quoted string
    if (char === '"') {
      this.state.expectAttrValue = false;
      return this.readString();
    }

    // Space
    if (char === " ") {
      return this.singleChar(TokenType.SPACE);
    }

    // Check for identifier/keyword at word boundary (only when expecting one, not in raw mode)
    if (
      !this.state.inRawMode &&
      this.state.expectIdent &&
      this.isIdentStart(char)
    ) {
      this.state.expectIdent = false; // Reset after reading
      this.state.expectAttrValue = false;
      return this.readIdentOrKeyword();
    }

    // Number
    if (this.isDigit(char)) {
      this.state.expectAttrValue = false;
      return this.readNumber();
    }

    // Everything else is text
    return this.readText();
  }

  /**
   * Handle the start of a line (indentation and blank line detection).
   *
   * Indentation rules:
   * - Only spaces allowed (tabs rejected immediately)
   * - Must be multiple of 2 spaces
   * - Can only increase by one level (2 spaces) at a time
   * - Can decrease by multiple levels at once (emits multiple DEDENT tokens)
   * - Dedent must land on a previously established indent level
   */
  private handleLineStart(): Token | null {
    this.state.atLineStart = false;
    this.state.expectIdent = true; // Expect block type at start of line

    // Skip blank lines
    if (this.peek() === "\n") {
      return null;
    }

    // Count leading spaces
    const startLoc = this.location;
    let spaces = 0;

    while (this.peek() === " " || this.peek() === "\t") {
      if (this.peek() === "\t") {
        throw parseError(
          ErrorCode.TabsInIndentation,
          this.state.line,
          this.state.column,
        );
      }
      this.advance();
      spaces++;
    }

    // Skip blank lines (line with only whitespace)
    if (this.peek() === "\n" || this.isEOF()) {
      return null;
    }

    // Validate indent is multiple of 2
    if (spaces % 2 !== 0) {
      throw parseError(
        ErrorCode.IndentationNotMultipleOfTwo,
        startLoc.line,
        startLoc.column,
      );
    }

    const currentIndent =
      this.state.indentStack[this.state.indentStack.length - 1] ?? 0;

    if (spaces > currentIndent) {
      // Indent - must be exactly one level (2 spaces more)
      if (spaces !== currentIndent + 2) {
        throw parseError(
          ErrorCode.IndentationSkipsLevel,
          startLoc.line,
          startLoc.column,
        );
      }
      this.state.indentStack.push(spaces);
      return { type: TokenType.INDENT, value: "", location: startLoc };
    }

    if (spaces < currentIndent) {
      // Dedent - may be multiple levels
      let dedentCount = 0;
      while (
        this.state.indentStack.length > 1 &&
        (this.state.indentStack[this.state.indentStack.length - 1] ?? 0) >
          spaces
      ) {
        this.state.indentStack.pop();
        dedentCount++;
      }

      // Verify we landed on a valid indent level
      if (
        (this.state.indentStack[this.state.indentStack.length - 1] ?? 0) !==
        spaces
      ) {
        throw parseError(
          ErrorCode.IndentationNotMultipleOfTwo,
          startLoc.line,
          startLoc.column,
          "dedent to invalid level",
        );
      }

      // Return first dedent, queue the rest
      this.state.pendingDedents = dedentCount - 1;
      return { type: TokenType.DEDENT, value: "", location: startLoc };
    }

    // Same indent level - no token
    return null;
  }

  /**
   * Read an escape sequence.
   */
  private readEscape(): Token {
    const loc = this.location;
    this.advance(); // consume backslash

    const next = this.peek();

    // Unicode escape \uXXXX
    if (next === "u") {
      this.advance();
      let hex = "";
      for (let i = 0; i < 4; i++) {
        const h = this.peek();
        if (!this.isHexDigit(h)) {
          throw parseError(
            ErrorCode.InvalidEscapeSequence,
            loc.line,
            loc.column,
            `invalid unicode escape: \\u${hex}${h}`,
          );
        }
        hex += this.advance();
      }
      const codePoint = parseInt(hex, 16);
      return {
        type: TokenType.TEXT,
        value: String.fromCharCode(codePoint),
        location: loc,
      };
    }

    // Simple escapes
    const escapeMap: Record<string, string> = {
      s: " ",
      t: "\t",
      n: "\n",
      r: "\r",
      "[": "[",
      "]": "]",
      "{": "{",
      "}": "}",
      "|": "|",
      "^": "^",
      "\\": "\\",
      '"': '"',
      ";": ";", // For escaping ;; as \;\;
    };

    const escaped = escapeMap[next];
    if (escaped !== undefined) {
      this.advance();
      return { type: TokenType.TEXT, value: escaped, location: loc };
    }

    // Unknown escape
    throw parseError(
      ErrorCode.InvalidEscapeSequence,
      loc.line,
      loc.column,
      `unknown escape: \\${next}`,
    );
  }

  /**
   * Read a quoted string.
   */
  private readString(): Token {
    const loc = this.location;
    this.advance(); // consume opening quote

    let value = "";
    while (!this.isEOF()) {
      const char = this.peek();

      if (char === '"') {
        this.advance(); // consume closing quote
        return { type: TokenType.STRING, value, location: loc };
      }

      if (char === "\\") {
        this.advance();
        const next = this.peek();

        if (next === '"') {
          value += '"';
          this.advance();
        } else if (next === "\\") {
          value += "\\";
          this.advance();
        } else if (next === "n") {
          value += "\n";
          this.advance();
        } else if (next === "t") {
          value += "\t";
          this.advance();
        } else if (next === "r") {
          value += "\r";
          this.advance();
        } else if (next === "u") {
          this.advance();
          let hex = "";
          for (let i = 0; i < 4; i++) {
            const h = this.peek();
            if (!this.isHexDigit(h)) {
              throw parseError(
                ErrorCode.InvalidEscapeSequence,
                loc.line,
                loc.column,
                `invalid unicode escape in string`,
              );
            }
            hex += this.advance();
          }
          value += String.fromCharCode(parseInt(hex, 16));
        } else {
          value += next;
          this.advance();
        }
      } else if (char === "\n") {
        throw parseError(ErrorCode.UnclosedQuote, loc.line, loc.column);
      } else {
        value += this.advance();
      }
    }

    throw parseError(ErrorCode.UnclosedQuote, loc.line, loc.column);
  }

  /**
   * Read a JSON value (object or array).
   *
   * We can't just scan for balanced braces because JSON strings can contain
   * braces: `{"key": "value with { and } inside"}`. So we track whether we're
   * inside a string and handle escape sequences within strings.
   */
  private readJsonValue(): Token {
    const loc = this.location;
    const startChar = this.peek();
    const isObject = startChar === "{";
    const openChar = isObject ? "{" : "[";
    const closeChar = isObject ? "}" : "]";

    let depth = 0;
    let value = "";
    let inString = false;

    while (!this.isEOF()) {
      const char = this.peek();

      // Handle strings (to avoid counting braces inside strings)
      if (inString) {
        if (char === "\\") {
          value += this.advance();
          if (!this.isEOF()) {
            value += this.advance();
          }
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        value += this.advance();
        continue;
      }

      // Track string boundaries
      if (char === '"') {
        inString = true;
        value += this.advance();
        continue;
      }

      // Track nesting depth
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
      }

      value += this.advance();

      // Done when we've closed the outermost structure
      if (depth === 0) {
        break;
      }
    }

    if (depth !== 0) {
      throw parseError(
        ErrorCode.UnbalancedBrace,
        loc.line,
        loc.column,
        "unclosed JSON value",
      );
    }

    return { type: TokenType.JSON, value, location: loc };
  }

  /**
   * Read an identifier or keyword (true/false).
   */
  private readIdentOrKeyword(): Token {
    const loc = this.location;
    let value = "";

    while (this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    // Check for boolean keywords
    if (value === "true" || value === "false") {
      return { type: TokenType.BOOLEAN, value, location: loc };
    }

    return { type: TokenType.IDENT, value, location: loc };
  }

  /**
   * Read a number.
   */
  private readNumber(): Token {
    const loc = this.location;
    let value = "";

    while (this.isDigit(this.peek())) {
      value += this.advance();
    }

    return { type: TokenType.NUMBER, value, location: loc };
  }

  /**
   * Read text content (everything that's not a special token).
   */
  private readText(): Token {
    const loc = this.location;
    let value = "";

    // In raw mode, consume until newline or selection markers
    if (this.state.inRawMode) {
      while (!this.isEOF()) {
        const char = this.peek();
        if (
          char === "\n" ||
          (char === "|" && this.peek(-1) !== "\\") ||
          (char === "^" && this.peek(-1) !== "\\") ||
          char === "\\"
        ) {
          break;
        }
        value += this.advance();
      }
    } else {
      // In normal mode, consume until any special character
      while (!this.isEOF()) {
        const char = this.peek();
        if (
          char === "\n" ||
          char === ":" ||
          char === "[" ||
          char === "]" ||
          char === "{" ||
          char === "}" ||
          char === "|" ||
          char === "^" ||
          char === "\\" ||
          char === " " ||
          char === "=" ||
          char === '"' ||
          (char === ";" && this.peek(1) === ";") // Stop only for ;;
        ) {
          break;
        }
        value += this.advance();
      }
    }

    return { type: TokenType.TEXT, value, location: loc };
  }

  /**
   * Create a single-character token.
   */
  private singleChar(type: TokenType): Token {
    const loc = this.location;
    const value = this.advance();
    return { type, value, location: loc };
  }

  /**
   * Create a token at current location.
   */
  private makeToken(type: TokenType, value: string): Token {
    return { type, value, location: this.location };
  }

  // Character classification helpers (optimized with char codes)
  private isIdentStart(char: string): boolean {
    if (char.length !== 1) {
      return false;
    }
    const code = char.charCodeAt(0);
    // a-z: 97-122, A-Z: 65-90
    return (code >= 97 && code <= 122) || (code >= 65 && code <= 90);
  }

  private isIdentChar(char: string): boolean {
    if (char.length !== 1) {
      return false;
    }
    const code = char.charCodeAt(0);
    // a-z: 97-122, A-Z: 65-90, 0-9: 48-57, _: 95, -: 45
    return (
      (code >= 97 && code <= 122) ||
      (code >= 65 && code <= 90) ||
      (code >= 48 && code <= 57) ||
      code === 95 ||
      code === 45
    );
  }

  private isDigit(char: string): boolean {
    if (char.length !== 1) {
      return false;
    }
    const code = char.charCodeAt(0);
    // 0-9: 48-57
    return code >= 48 && code <= 57;
  }

  private isHexDigit(char: string): boolean {
    if (char.length !== 1) {
      return false;
    }
    const code = char.charCodeAt(0);
    // 0-9: 48-57, a-f: 97-102, A-F: 65-70
    return (
      (code >= 48 && code <= 57) ||
      (code >= 97 && code <= 102) ||
      (code >= 65 && code <= 70)
    );
  }
}
