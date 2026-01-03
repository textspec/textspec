/**
 * Parse Error Types
 *
 * Error codes and classes for DSL parsing errors.
 */

/**
 * Error codes matching the validation rules from the spec.
 */
export const ErrorCode = {
  // Indentation errors
  TabsInIndentation: "INDENT_TABS",
  IndentationNotMultipleOfTwo: "INDENT_NOT_MULTIPLE",
  IndentationSkipsLevel: "INDENT_SKIPS_LEVEL",

  // Selection errors
  MultipleFocus: "SEL_MULTIPLE_FOCUS",
  MultipleAnchor: "SEL_MULTIPLE_ANCHOR",
  NoSelection: "SEL_NONE",

  // Delimiter errors
  UnbalancedBracket: "DELIM_UNBALANCED_BRACKET",
  UnbalancedBrace: "DELIM_UNBALANCED_BRACE",
  MissingColonInMark: "DELIM_MISSING_COLON",

  // Structure errors
  InvalidChildUnderTextBlock: "STRUCT_INVALID_CHILD",
  EmptyContainer: "STRUCT_EMPTY_CONTAINER",
  EmptyDocument: "STRUCT_EMPTY_DOCUMENT",
  MissingSpaceAfterColon: "STRUCT_MISSING_SPACE",

  // Attribute errors
  MalformedAttribute: "ATTR_MALFORMED",
  UnclosedQuote: "ATTR_UNCLOSED_QUOTE",
  InvalidJson: "ATTR_INVALID_JSON",

  // Identifier errors
  InvalidIdentifier: "IDENT_INVALID",

  // Additional errors
  InvalidEscapeSequence: "ESCAPE_INVALID",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Human-readable error messages for each error code.
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.TabsInIndentation]: "Tabs are not allowed in indentation",
  [ErrorCode.IndentationNotMultipleOfTwo]:
    "Indentation must be a multiple of 2 spaces",
  [ErrorCode.IndentationSkipsLevel]:
    "Indentation cannot skip levels (jumped more than one level)",
  [ErrorCode.MultipleFocus]: "Multiple focus markers (|) found",
  [ErrorCode.MultipleAnchor]: "Multiple anchor markers (^) found",
  [ErrorCode.NoSelection]:
    "No selection found (document must have exactly one caret or range)",
  [ErrorCode.UnbalancedBracket]: "Unbalanced bracket: [ without matching ]",
  [ErrorCode.UnbalancedBrace]: "Unbalanced brace: { without matching }",
  [ErrorCode.MissingColonInMark]:
    "Missing colon in mark (expected [type:content])",
  [ErrorCode.InvalidChildUnderTextBlock]:
    "Child blocks are not allowed under this text block",
  [ErrorCode.EmptyContainer]: "Container has no children",
  [ErrorCode.EmptyDocument]: "Document must contain at least one block",
  [ErrorCode.MissingSpaceAfterColon]: "Missing space after colon in text block",
  [ErrorCode.MalformedAttribute]: "Malformed attribute syntax",
  [ErrorCode.UnclosedQuote]: "Unclosed quoted attribute value",
  [ErrorCode.InvalidJson]: "Invalid JSON attribute value",
  [ErrorCode.InvalidIdentifier]: "Invalid identifier",
  [ErrorCode.InvalidEscapeSequence]: "Invalid escape sequence",
};

/**
 * Source location information for error reporting.
 */
export interface SourceLocation {
  line: number;
  column: number;
}

/**
 * A parse error with source location and error code.
 */
export class ParseError extends Error {
  public readonly code: ErrorCode;
  public readonly location: SourceLocation;

  constructor(code: ErrorCode, location: SourceLocation, details?: string) {
    const baseMessage = ErrorMessages[code];
    const message = details ? `${baseMessage}: ${details}` : baseMessage;
    const fullMessage = `${message} at line ${location.line}, column ${location.column}`;

    super(fullMessage);
    this.name = "ParseError";
    this.code = code;
    this.location = location;

    // Maintains proper stack trace for where error was thrown (V8)
    if ("captureStackTrace" in Error) {
      (
        Error as { captureStackTrace: (e: Error, c: unknown) => void }
      ).captureStackTrace(this, ParseError);
    }
  }
}

/**
 * Create a parse error at a given location.
 */
export function parseError(
  code: ErrorCode,
  line: number,
  column: number,
  details?: string,
): ParseError {
  return new ParseError(code, { line, column }, details);
}
