/**
 * Pattern Matcher for the Editor State DSL
 *
 * Finds notation patterns within a document AST and returns match locations.
 */

import { parse } from "./parser";
import type {
  Attributes,
  Block,
  EditorState,
  InlineNode,
  InlineObject,
  Mark,
  Point,
  Selection,
  Text,
  TextBlock,
} from "./types";

/**
 * Find a notation pattern within a document and return a selection spanning the match.
 * The pattern should be a slice of valid notation syntax.
 *
 * @param document - The document to search in
 * @param patternStr - The pattern to search for (notation syntax or plain text)
 * @returns Selection with anchor at start and focus at end of match, or null if not found
 *
 * @example
 * ```ts
 * // Find plain text
 * getRange(doc, "bar")
 *
 * // Find mark structure (positions outside the mark)
 * getRange(doc, "[strong:bar]")
 *
 * // Find with specific attributes
 * getRange(doc, '[@link href="https://example.com":click here]')
 *
 * // Find text spanning multiple blocks
 * getRange(doc, "foo;;P: bar")
 * ```
 */
export function getRange(
  document: EditorState,
  patternStr: string,
): Selection | null {
  const pattern = parsePattern(patternStr);

  if (pattern.blocks.length === 0) {
    return null;
  }

  if (pattern.blocks.length === 1) {
    const block = pattern.blocks[0];
    if (block) {
      return findSingleBlockPattern(document, block);
    }
    return null;
  }

  return findMultiBlockPattern(document, pattern.blocks);
}

/**
 * Find a notation pattern within a document and return the point before the match.
 *
 * @param document - The document to search in
 * @param patternStr - The pattern to search for (notation syntax or plain text)
 * @returns Point at the start of the match, or null if not found
 */
export function getPointBefore(
  document: EditorState,
  patternStr: string,
): Point | null {
  const range = getRange(document, patternStr);
  return range?.anchor ?? null;
}

/**
 * Find a notation pattern within a document and return the point after the match.
 *
 * @param document - The document to search in
 * @param patternStr - The pattern to search for (notation syntax or plain text)
 * @returns Point at the end of the match, or null if not found
 */
export function getPointAfter(
  document: EditorState,
  patternStr: string,
): Point | null {
  const range = getRange(document, patternStr);
  return range?.focus ?? null;
}

/**
 * Find a single-block pattern within the document.
 */
function findSingleBlockPattern(
  document: EditorState,
  patternBlock: Block,
): Selection | null {
  if (patternBlock.kind !== "textBlock") {
    return null;
  }

  const patternNodes = patternBlock.children;
  if (patternNodes.length === 0) {
    return null;
  }

  for (let blockIndex = 0; blockIndex < document.blocks.length; blockIndex++) {
    const block = document.blocks[blockIndex];
    if (block?.kind === "textBlock") {
      const result = searchInChildren(block.children, patternNodes, [
        blockIndex,
      ]);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Find a multi-block pattern within the document.
 * First pattern block matches as suffix, last as prefix, middle blocks match entirely.
 */
function findMultiBlockPattern(
  document: EditorState,
  patternBlocks: Array<Block>,
): Selection | null {
  const firstPattern = patternBlocks[0];
  const lastPattern = patternBlocks[patternBlocks.length - 1];

  if (firstPattern?.kind !== "textBlock" || lastPattern?.kind !== "textBlock") {
    return null;
  }

  const firstPatternText = extractText(firstPattern.children);
  const lastPatternText = extractText(lastPattern.children);

  for (let startIdx = 0; startIdx < document.blocks.length; startIdx++) {
    const startBlock = document.blocks[startIdx];
    if (startBlock?.kind !== "textBlock") {
      continue;
    }

    const startBlockText = extractText(startBlock.children);
    if (!startBlockText.endsWith(firstPatternText)) {
      continue;
    }

    const endIdx = startIdx + patternBlocks.length - 1;
    if (endIdx >= document.blocks.length) {
      continue;
    }

    const endBlock = document.blocks[endIdx];
    if (endBlock?.kind !== "textBlock") {
      continue;
    }

    const endBlockText = extractText(endBlock.children);
    if (!endBlockText.startsWith(lastPatternText)) {
      continue;
    }

    let middleMatch = true;
    for (let i = 1; i < patternBlocks.length - 1; i++) {
      const patternBlock = patternBlocks[i];
      const docBlock = document.blocks[startIdx + i];

      if (!blocksMatch(docBlock, patternBlock)) {
        middleMatch = false;
        break;
      }
    }

    if (!middleMatch) {
      continue;
    }

    const anchorPoint = findTextOffsetInBlock(
      startBlock,
      startBlockText.length - firstPatternText.length,
      [startIdx],
    );

    const focusPoint = findTextOffsetInBlock(endBlock, lastPatternText.length, [
      endIdx,
    ]);

    if (anchorPoint && focusPoint) {
      return { anchor: anchorPoint, focus: focusPoint };
    }
  }

  return null;
}

/**
 * Check if a document block matches a pattern block entirely.
 */
function blocksMatch(
  docBlock: Block | undefined,
  patternBlock: Block | undefined,
): boolean {
  if (!docBlock || !patternBlock) {
    return false;
  }
  if (docBlock.kind !== patternBlock.kind) {
    return false;
  }
  if (docBlock.kind !== "textBlock" || patternBlock.kind !== "textBlock") {
    return false;
  }

  const docText = extractText(docBlock.children);
  const patternText = extractText(patternBlock.children);

  return docText === patternText;
}

/**
 * Find the path and offset for a given text offset within a block.
 */
function findTextOffsetInBlock(
  block: TextBlock,
  targetOffset: number,
  basePath: Array<number>,
): Point | null {
  let currentOffset = 0;

  function search(nodes: Array<InlineNode>, path: Array<number>): Point | null {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) {
        continue;
      }

      const nodePath = [...path, i];

      if (node.kind === "text") {
        const nodeLen = node.text.length;
        if (currentOffset + nodeLen >= targetOffset) {
          return { path: nodePath, offset: targetOffset - currentOffset };
        }
        currentOffset += nodeLen;
      } else if (node.kind === "mark") {
        const result = search(node.children, nodePath);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  return search(block.children, basePath);
}

/**
 * Parse a pattern string into an EditorState.
 * Plain text is wrapped as "P: text", notation is parsed as-is.
 */
function parsePattern(patternStr: string): EditorState {
  if (looksLikeNotation(patternStr)) {
    return parse(patternStr);
  }

  const wrappedPattern = `P: ${patternStr}`;
  return parse(wrappedPattern);
}

/**
 * Check if a string looks like block-level notation syntax.
 * Inline elements like [mark:...] or {object} need to be wrapped.
 */
function looksLikeNotation(str: string): boolean {
  const trimmed = str.trim();
  if (/^[A-Z][A-Z0-9]*\s*(!)?:/.test(trimmed)) {
    return true;
  }
  if (/^\{[A-Z]/.test(trimmed) && !trimmed.includes(":")) {
    return true;
  }
  return false;
}

/**
 * Search for pattern nodes within children, returning match positions.
 */
function searchInChildren(
  children: Array<InlineNode>,
  patternNodes: Array<InlineNode>,
  basePath: Array<number>,
): Selection | null {
  const isPlainTextPattern = isSingleTextPattern(patternNodes);

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) {
      continue;
    }

    const currentPath = [...basePath, i];

    if (isPlainTextPattern) {
      const patternText = (patternNodes[0] as Text).text;

      if (child.kind === "text") {
        const idx = child.text.indexOf(patternText);
        if (idx >= 0) {
          return {
            anchor: { path: currentPath, offset: idx },
            focus: { path: currentPath, offset: idx + patternText.length },
          };
        }
      }

      if (child.kind === "mark") {
        const result = searchInChildren(
          child.children,
          patternNodes,
          currentPath,
        );
        if (result) {
          return result;
        }
      }
    } else {
      const firstPatternNode = patternNodes[0];

      if (firstPatternNode?.kind === "mark" && child.kind === "mark") {
        if (matchesMark(child, firstPatternNode)) {
          return computeMarkMatchPositions(children, i, basePath);
        }
      }

      if (
        firstPatternNode?.kind === "inlineObject" &&
        child.kind === "inlineObject"
      ) {
        if (matchesInlineObject(child, firstPatternNode)) {
          return computeInlineObjectMatchPositions(children, i, basePath);
        }
      }

      if (child.kind === "mark") {
        const result = searchInChildren(
          child.children,
          patternNodes,
          currentPath,
        );
        if (result) {
          return result;
        }
      }
    }
  }

  return null;
}

/**
 * Check if pattern is a single text node.
 */
function isSingleTextPattern(nodes: Array<InlineNode>): boolean {
  return nodes.length === 1 && nodes[0]?.kind === "text";
}

/**
 * Check if a document mark matches a pattern mark.
 */
function matchesMark(docMark: Mark, patternMark: Mark): boolean {
  if (docMark.type !== patternMark.type) {
    return false;
  }
  if (docMark.mode !== patternMark.mode) {
    return false;
  }
  if (!attrsMatch(docMark.attrs, patternMark.attrs)) {
    return false;
  }

  return childrenMatchAsPrefix(docMark.children, patternMark.children);
}

/**
 * Check if a document inline object matches a pattern inline object.
 */
function matchesInlineObject(
  docObj: InlineObject,
  patternObj: InlineObject,
): boolean {
  if (docObj.type !== patternObj.type) {
    return false;
  }
  return attrsMatch(docObj.attrs, patternObj.attrs);
}

/**
 * Check if pattern attributes are a subset of document attributes.
 */
function attrsMatch(
  docAttrs: Attributes | undefined,
  patternAttrs: Attributes | undefined,
): boolean {
  if (!patternAttrs) {
    return true;
  }
  if (!docAttrs) {
    return Object.keys(patternAttrs).length === 0;
  }

  for (const [key, value] of Object.entries(patternAttrs)) {
    if (!deepEqual(docAttrs[key], value)) {
      return false;
    }
  }

  return true;
}

/**
 * Deep equality check for attribute values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (a === null || b === null) {
    return a === b;
  }
  if (typeof a !== "object") {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
}

/**
 * Check if document children match pattern children as a prefix.
 */
function childrenMatchAsPrefix(
  docChildren: Array<InlineNode>,
  patternChildren: Array<InlineNode>,
): boolean {
  const docText = extractText(docChildren);
  const patternText = extractText(patternChildren);

  return docText.startsWith(patternText);
}

/**
 * Extract plain text from inline nodes.
 */
function extractText(nodes: Array<InlineNode>): string {
  let result = "";

  for (const node of nodes) {
    if (node.kind === "text") {
      result += node.text;
    } else if (node.kind === "mark") {
      result += extractText(node.children);
    }
  }

  return result;
}

/**
 * Compute anchor/focus positions for a mark match.
 * "anchor" = end of previous sibling or start of parent content
 * "focus" = start of next sibling or end of parent content
 */
function computeMarkMatchPositions(
  siblings: Array<InlineNode>,
  matchIndex: number,
  basePath: Array<number>,
): Selection {
  let anchor: Point;
  let focus: Point;

  if (matchIndex > 0) {
    const prevSibling = siblings[matchIndex - 1];
    if (prevSibling?.kind === "text") {
      anchor = {
        path: [...basePath, matchIndex - 1],
        offset: prevSibling.text.length,
      };
    } else {
      anchor = { path: [...basePath, matchIndex], offset: 0 };
    }
  } else {
    anchor = { path: [...basePath, matchIndex], offset: 0 };
  }

  if (matchIndex < siblings.length - 1) {
    focus = { path: [...basePath, matchIndex + 1], offset: 0 };
  } else {
    focus = { path: [...basePath, siblings.length], offset: 0 };
  }

  return { anchor, focus };
}

/**
 * Compute anchor/focus positions for an inline object match.
 */
function computeInlineObjectMatchPositions(
  _siblings: Array<InlineNode>,
  matchIndex: number,
  basePath: Array<number>,
): Selection {
  return {
    anchor: { path: [...basePath, matchIndex], offset: 0 },
    focus: { path: [...basePath, matchIndex], offset: 1 },
  };
}
