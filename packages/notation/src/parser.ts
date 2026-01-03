/**
 * Parser for the Editor State DSL
 *
 * Recursive descent parser that converts tokens into an AST.
 */

import { ErrorCode, parseError } from "./errors";
import { Lexer, TokenType } from "./lexer";
import type { Token } from "./lexer";
import type {
  Attributes,
  AttributeValue,
  Block,
  BlockObject,
  ContainerBlock,
  EditorState,
  InlineNode,
  InlineObject,
  Mark,
  MarkMode,
  RawBlock,
  Selection,
  TextBlock,
} from "./types";

// =============================================================================
// Parser State
// =============================================================================

/**
 * Selection markers (`^` and `|`) can appear anywhere in the document. As we
 * parse, we track our position in the tree via `currentPath` (array of indices
 * from root to current node) and `currentOffset` (character position within
 * text nodes, or 0/1 for objects). When we encounter a marker, we snapshot
 * these values into SelectionState.
 *
 * At parse end:
 * - No focus (`|`) → selection is null
 * - Focus only → collapsed selection (anchor = focus)
 * - Both anchor and focus → range selection
 */
interface SelectionState {
  anchor: { path: Array<number>; offset: number } | null;
  focus: { path: Array<number>; offset: number } | null;
}

// =============================================================================
// Parser Class
// =============================================================================

export class Parser {
  private lexer: Lexer;
  private currentToken: Token;
  private selection: SelectionState = { anchor: null, focus: null };
  /**
   * Path from document root to current parse position. Updated before parsing
   * each block/node so selection markers record the correct location. For example,
   * when parsing the second child of the first block, path is [0, 1].
   */
  private currentPath: Array<number> = [];
  /**
   * Character offset within current text accumulation. For text nodes, this is
   * the position within the text string. For objects, 0 means "before" and 1
   * means "after" the object.
   */
  private currentOffset = 0;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.currentToken = this.lexer.nextToken();
  }

  /**
   * Parse the input and return an EditorState.
   */
  parse(): EditorState {
    const blocks = this.parseDocument();

    // If no focus, selection is null
    if (!this.selection.focus) {
      return { blocks, selection: null };
    }

    // If no anchor, it's a collapsed selection (anchor = focus)
    const selection: Selection = {
      anchor: this.selection.anchor ?? this.selection.focus,
      focus: this.selection.focus,
    };

    return { blocks, selection };
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  private advance(): Token {
    const prev = this.currentToken;
    this.currentToken = this.lexer.nextToken();
    return prev;
  }

  private is(type: TokenType): boolean {
    return this.currentToken.type === type;
  }

  private expect(
    type: TokenType,
    errorCode: ErrorCode,
    details?: string,
  ): Token {
    if (!this.is(type)) {
      throw parseError(
        errorCode,
        this.currentToken.location.line,
        this.currentToken.location.column,
        details ?? `expected ${type}, got ${this.currentToken.type}`,
      );
    }
    return this.advance();
  }

  private skipNewlines(): void {
    while (this.is(TokenType.NEWLINE)) {
      this.advance();
    }
  }

  private skipBlockSeparators(): void {
    while (this.is(TokenType.NEWLINE) || this.is(TokenType.BLOCK_SEP)) {
      this.advance();
    }
  }

  // ===========================================================================
  // Document Parsing
  // ===========================================================================

  private parseDocument(): Array<Block> {
    const blocks: Array<Block> = [];

    this.skipBlockSeparators();

    while (!this.is(TokenType.EOF)) {
      this.currentPath = [blocks.length]; // Set path BEFORE parsing block
      const block = this.parseBlock();
      blocks.push(block);
      this.skipBlockSeparators();
    }

    if (blocks.length === 0) {
      throw parseError(
        ErrorCode.EmptyDocument,
        this.currentToken.location.line,
        this.currentToken.location.column,
      );
    }

    return blocks;
  }

  // ===========================================================================
  // Block Parsing
  // ===========================================================================

  private parseBlock(): Block {
    // Handle selection markers before block object (e.g., ^{IMAGE}| or |{IMAGE}^)
    if (this.is(TokenType.ANCHOR)) {
      this.currentOffset = 0;
      this.recordAnchor();
      this.advance();
    }
    if (this.is(TokenType.FOCUS)) {
      this.currentOffset = 0;
      this.recordFocus();
      this.advance();
    }

    // Block object: {TYPE attrs}
    if (this.is(TokenType.LBRACE)) {
      return this.parseBlockObject();
    }

    // Regular block: TYPE: content or TYPE: + children
    return this.parseNamedBlock();
  }

  private parseBlockObject(): BlockObject {
    const _loc = this.currentToken.location;
    this.expect(TokenType.LBRACE, ErrorCode.UnbalancedBrace);

    // Handle selection before object
    if (this.is(TokenType.ANCHOR)) {
      this.currentOffset = 0;
      this.recordAnchor();
      this.advance();
    }

    const typeToken = this.expect(TokenType.IDENT, ErrorCode.InvalidIdentifier);
    const attrs = this.parseAttributes();

    this.expect(TokenType.RBRACE, ErrorCode.UnbalancedBrace);

    // Handle selection after object
    if (this.is(TokenType.FOCUS)) {
      this.currentOffset = 1; // After the object
      this.recordFocus();
      this.advance();
    }

    return {
      kind: "blockObject",
      type: typeToken.value,
      attrs,
    };
  }

  private parseNamedBlock(): Block {
    const typeToken = this.expect(TokenType.IDENT, ErrorCode.InvalidIdentifier);
    const blockType = typeToken.value;

    // Check for raw block syntax: TYPE!:
    if (this.is(TokenType.BANG)) {
      this.advance(); // consume !
      const attrs = this.parseAttributes();
      this.expect(TokenType.COLON, ErrorCode.MissingColonInMark);
      return this.parseRawBlock(blockType, attrs);
    }

    // Parse attributes for regular blocks (TYPE attrs:)
    const attrs = this.parseAttributes();

    this.expect(TokenType.COLON, ErrorCode.MissingColonInMark);

    // Check what follows the colon
    if (this.is(TokenType.NEWLINE) || this.is(TokenType.EOF)) {
      // Container: TYPE: + children on next lines
      this.skipNewlines();
      return this.parseContainer(blockType, attrs);
    }

    // Inline children: TYPE:{...}
    if (this.is(TokenType.LBRACE)) {
      return this.parseInlineContainer(blockType, attrs);
    }

    // Text block: TYPE: content
    // Must have space after colon
    if (!this.is(TokenType.SPACE)) {
      throw parseError(
        ErrorCode.MissingSpaceAfterColon,
        this.currentToken.location.line,
        this.currentToken.location.column,
      );
    }
    this.advance(); // consume space

    const textBlock = this.parseTextBlock(blockType, attrs);

    // Check if indented children follow - this is an error for text blocks
    if (this.is(TokenType.NEWLINE)) {
      this.skipNewlines();

      if (this.is(TokenType.INDENT)) {
        throw parseError(
          ErrorCode.InvalidChildUnderTextBlock,
          this.currentToken.location.line,
          this.currentToken.location.column,
        );
      }
    }

    return textBlock;
  }

  private parseRawBlock(blockType: string, attrs: Attributes): RawBlock {
    // Skip to next line
    this.skipNewlines();

    // Enable raw mode in lexer
    this.lexer.setRawMode(true);

    const lines: Array<string> = [];
    const basePath = [...this.currentPath];

    // Expect indent
    if (!this.is(TokenType.INDENT)) {
      this.lexer.setRawMode(false);
      // Empty raw block is valid
      const block: RawBlock = {
        kind: "rawBlock",
        type: blockType,
        lines: [],
      };
      if (Object.keys(attrs).length > 0) {
        block.attrs = attrs;
      }
      return block;
    }
    this.advance(); // consume INDENT

    // Parse raw lines
    while (!this.is(TokenType.DEDENT) && !this.is(TokenType.EOF)) {
      let lineContent = "";
      const lineIndex = lines.length;
      this.currentPath = [...basePath, lineIndex];

      // Handle selection in raw content
      while (
        !this.is(TokenType.NEWLINE) &&
        !this.is(TokenType.DEDENT) &&
        !this.is(TokenType.EOF)
      ) {
        if (this.is(TokenType.ANCHOR)) {
          this.currentOffset = lineContent.length;
          this.recordAnchor();
          this.advance();
        } else if (this.is(TokenType.FOCUS)) {
          this.currentOffset = lineContent.length;
          this.recordFocus();
          this.advance();
        } else {
          lineContent += this.currentToken.value;
          this.advance();
        }
      }

      lines.push(lineContent);

      if (this.is(TokenType.NEWLINE)) {
        this.advance();
      }
    }

    if (this.is(TokenType.DEDENT)) {
      this.advance();
    }

    this.lexer.setRawMode(false);

    const block: RawBlock = {
      kind: "rawBlock",
      type: blockType,
      lines,
    };
    if (Object.keys(attrs).length > 0) {
      block.attrs = attrs;
    }
    return block;
  }

  private parseContainer(blockType: string, attrs: Attributes): ContainerBlock {
    // Must have children (INDENT expected)
    if (!this.is(TokenType.INDENT)) {
      throw parseError(
        ErrorCode.EmptyContainer,
        this.currentToken.location.line,
        this.currentToken.location.column,
      );
    }
    this.advance(); // consume INDENT

    const children: Array<Block> = [];
    const basePath = [...this.currentPath];

    while (!this.is(TokenType.DEDENT) && !this.is(TokenType.EOF)) {
      this.currentPath = [...basePath, children.length]; // Set path BEFORE parsing
      const child = this.parseBlock();
      children.push(child);
      this.skipNewlines();
    }

    if (this.is(TokenType.DEDENT)) {
      this.advance();
    }

    if (children.length === 0) {
      throw parseError(
        ErrorCode.EmptyContainer,
        this.currentToken.location.line,
        this.currentToken.location.column,
      );
    }

    const container: ContainerBlock = {
      kind: "containerBlock",
      type: blockType,
      children,
    };
    if (Object.keys(attrs).length > 0) {
      container.attrs = attrs;
    }
    return container;
  }

  /**
   * Parse inline container syntax: TYPE:{child1;;child2;;...}
   */
  private parseInlineContainer(
    blockType: string,
    attrs: Attributes,
  ): ContainerBlock {
    const loc = this.currentToken.location;
    this.advance(); // consume {

    const children: Array<Block> = [];
    const basePath = [...this.currentPath];

    // Parse children separated by ;;
    while (!this.is(TokenType.RBRACE) && !this.is(TokenType.EOF)) {
      this.currentPath = [...basePath, children.length];
      const child = this.parseBlock();
      children.push(child);

      // After a child, expect either ;; or }
      if (this.is(TokenType.BLOCK_SEP)) {
        this.advance(); // consume ;;
      } else if (!this.is(TokenType.RBRACE)) {
        // Not ;; and not }, this is an error
        throw parseError(
          ErrorCode.UnbalancedBrace,
          loc.line,
          loc.column,
          "expected ;; or } after child block",
        );
      }
    }

    if (!this.is(TokenType.RBRACE)) {
      throw parseError(ErrorCode.UnbalancedBrace, loc.line, loc.column);
    }
    this.advance(); // consume }

    if (children.length === 0) {
      throw parseError(ErrorCode.EmptyContainer, loc.line, loc.column);
    }

    const container: ContainerBlock = {
      kind: "containerBlock",
      type: blockType,
      children,
    };
    if (Object.keys(attrs).length > 0) {
      container.attrs = attrs;
    }
    return container;
  }

  private parseTextBlock(blockType: string, attrs: Attributes): TextBlock {
    this.currentPath = [...this.currentPath];
    this.currentOffset = 0;

    const children = this.parseInlineContent();

    const textBlock: TextBlock = {
      kind: "textBlock",
      type: blockType,
      children,
    };
    if (Object.keys(attrs).length > 0) {
      textBlock.attrs = attrs;
    }
    return textBlock;
  }

  // ===========================================================================
  // Inline Content Parsing
  // ===========================================================================

  /**
   * Parse inline content (text, marks, inline objects) until we hit a boundary
   * token (newline, `]`, `}`, etc.).
   *
   * Text is accumulated into `currentText` and flushed as a text node when we
   * encounter a mark or object. This is necessary because selection markers can
   * appear mid-text, so we need to track the offset within the accumulated text
   * to record selection positions correctly.
   */
  private parseInlineContent(): Array<InlineNode> {
    const nodes: Array<InlineNode> = [];
    let currentText = "";
    const startPath = [...this.currentPath];

    const flushText = () => {
      if (currentText.length > 0) {
        nodes.push({ kind: "text", text: currentText });
        currentText = "";
      }
    };

    while (
      !this.is(TokenType.NEWLINE) &&
      !this.is(TokenType.EOF) &&
      !this.is(TokenType.RBRACKET) &&
      !this.is(TokenType.RBRACE) && // Stop for inline container closing
      !this.is(TokenType.DEDENT) &&
      !this.is(TokenType.BLOCK_SEP)
    ) {
      if (this.is(TokenType.ANCHOR)) {
        this.currentOffset = this.calculateOffset(currentText);
        this.currentPath = [...startPath, nodes.length];
        this.recordAnchor();
        this.advance();
      } else if (this.is(TokenType.FOCUS)) {
        this.currentOffset = this.calculateOffset(currentText);
        this.currentPath = [...startPath, nodes.length];
        this.recordFocus();
        this.advance();
      } else if (this.is(TokenType.LBRACKET)) {
        flushText();
        this.currentPath = [...startPath, nodes.length];
        nodes.push(this.parseMark());
      } else if (this.is(TokenType.LBRACE)) {
        flushText();
        this.currentPath = [...startPath, nodes.length];
        nodes.push(this.parseInlineObject());
      } else {
        // Accumulate text (including spaces, colons, etc.)
        currentText += this.currentToken.value;
        this.advance();
      }
    }

    flushText();

    // Trim leading/trailing whitespace from the combined text
    // (but preserve explicit \s escapes - those are already processed)
    return this.normalizeInlineNodes(nodes);
  }

  private calculateOffset(pendingText: string): number {
    // Calculate offset within current text span
    return pendingText.length;
  }

  private parseMark(): Mark {
    const loc = this.currentToken.location;
    this.advance(); // consume [

    // Check for mode prefix
    let mode: MarkMode = "decorator";
    if (this.is(TokenType.AT)) {
      mode = "annotation";
      this.advance();
    } else if (this.is(TokenType.TILDE)) {
      mode = "overlay";
      this.advance();
    }

    // Mark type
    const typeToken = this.expect(TokenType.IDENT, ErrorCode.InvalidIdentifier);

    // Optional attributes
    const attrs = this.parseAttributes();

    // Colon separator
    this.expect(TokenType.COLON, ErrorCode.MissingColonInMark);

    // Content
    const children = this.parseInlineContent();

    // Closing bracket
    if (!this.is(TokenType.RBRACKET)) {
      throw parseError(ErrorCode.UnbalancedBracket, loc.line, loc.column);
    }
    this.advance();

    const mark: Mark = {
      kind: "mark",
      type: typeToken.value,
      mode,
      children,
    };

    if (Object.keys(attrs).length > 0) {
      mark.attrs = attrs;
    }

    return mark;
  }

  private parseInlineObject(): InlineObject {
    const loc = this.currentToken.location;
    this.advance(); // consume {

    // Note: Selection markers around inline objects are handled by parseInlineContent,
    // not here. Selection inside braces (e.g., {^emoji}) is invalid syntax.

    const typeToken = this.expect(TokenType.IDENT, ErrorCode.InvalidIdentifier);
    const attrs = this.parseAttributes();

    if (!this.is(TokenType.RBRACE)) {
      throw parseError(ErrorCode.UnbalancedBrace, loc.line, loc.column);
    }
    this.advance();

    return {
      kind: "inlineObject",
      type: typeToken.value,
      attrs,
    };
  }

  // ===========================================================================
  // Attribute Parsing
  // ===========================================================================

  private parseAttributes(): Attributes {
    const attrs: Attributes = {};

    while (this.is(TokenType.SPACE)) {
      this.lexer.setExpectIdent(true); // Expect attribute key BEFORE advancing
      this.advance(); // skip space

      if (!this.is(TokenType.IDENT)) {
        break;
      }

      const keyToken = this.advance();
      const key = keyToken.value;

      if (!this.is(TokenType.EQUALS)) {
        // Just a key without value - not supported per spec
        throw parseError(
          ErrorCode.MalformedAttribute,
          keyToken.location.line,
          keyToken.location.column,
          "attribute must have a value",
        );
      }
      this.advance(); // consume =

      const value = this.parseAttributeValue();
      attrs[key] = value;
    }

    return attrs;
  }

  private parseAttributeValue(): AttributeValue {
    // JSON object or array
    if (this.is(TokenType.JSON)) {
      const token = this.advance();
      try {
        return JSON.parse(token.value) as AttributeValue;
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw parseError(
            ErrorCode.InvalidJson,
            token.location.line,
            token.location.column,
            e.message,
          );
        }
        throw e;
      }
    }

    if (this.is(TokenType.STRING)) {
      const token = this.advance();
      return token.value;
    }

    if (this.is(TokenType.NUMBER)) {
      const token = this.advance();
      return parseInt(token.value, 10);
    }

    if (this.is(TokenType.BOOLEAN)) {
      const token = this.advance();
      return token.value === "true";
    }

    // Unquoted string (identifier-like)
    if (this.is(TokenType.IDENT)) {
      const token = this.advance();
      return token.value;
    }

    throw parseError(
      ErrorCode.MalformedAttribute,
      this.currentToken.location.line,
      this.currentToken.location.column,
      "expected attribute value",
    );
  }

  // ===========================================================================
  // Selection Recording
  // ===========================================================================

  private recordAnchor(): void {
    if (this.selection.anchor !== null) {
      throw parseError(
        ErrorCode.MultipleAnchor,
        this.currentToken.location.line,
        this.currentToken.location.column,
      );
    }

    this.selection.anchor = {
      path: [...this.currentPath],
      offset: this.currentOffset,
    };
  }

  private recordFocus(): void {
    if (this.selection.focus !== null) {
      throw parseError(
        ErrorCode.MultipleFocus,
        this.currentToken.location.line,
        this.currentToken.location.column,
      );
    }

    this.selection.focus = {
      path: [...this.currentPath],
      offset: this.currentOffset,
    };
  }

  // ===========================================================================
  // Normalization
  // ===========================================================================

  private normalizeInlineNodes(nodes: Array<InlineNode>): Array<InlineNode> {
    if (nodes.length === 0) {
      return nodes;
    }

    // Merge adjacent text nodes
    const merged: Array<InlineNode> = [];
    for (const node of nodes) {
      const prev = merged[merged.length - 1];
      if (node.kind === "text" && prev && prev.kind === "text") {
        prev.text += node.text;
      } else {
        merged.push(node);
      }
    }

    return merged;
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse a DSL string into an EditorState.
 * Throws ParseError on invalid input.
 *
 * @param input - The DSL string to parse
 * @returns The parsed EditorState
 * @throws ParseError if the input is invalid
 *
 * @example
 * ```ts
 * const state = parse("P: Hello |world");
 * console.log(state.blocks[0]); // TextBlock
 * ```
 */
export function parse(input: string): EditorState {
  const parser = new Parser(input);
  return parser.parse();
}
