import { SourceMapConsumer, type RawSourceMap } from "source-map-js";

/** Internal type - not exported, used only within this module */
interface SourceMapInfo {
  sources: string[];
  sourcesContent: string[] | null;
  variableNames: Map<string, string>;
}

export interface SourceMapResult {
  hasSourceMap: boolean;
  originalSources?: Array<{ file: string; content: string }>;
  variableHints?: Record<string, string>;
  externalSourceMapUrl?: string;
}

/**
 * Detect sourceMappingURL comment in code
 * Returns the URL/data-uri or null if not found
 */
export function detectSourceMapUrl(code: string): string | null {
  // Match JS-style (//# sourceMappingURL=...) and CSS-style (/*# sourceMappingURL=... */)
  // CSS pattern uses negative lookahead to exclude closing */ while allowing * in URLs
  const regex = /(?:\/\/[#@] ?sourceMappingURL=([^\s'"]+)|\/\*[#@] ?sourceMappingURL=((?:[^\s'"*]|\*(?!\/))+) ?\*\/)\s*$/gm;
  let match: RegExpExecArray | null;
  let lastMatch: string | null = null;

  while ((match = regex.exec(code)) !== null) {
    lastMatch = match[1] || match[2];
  }

  return lastMatch;
}

/**
 * Parse inline source map from data URI
 * Handles data:application/json;base64,... and data:application/json;charset=utf-8;base64,... formats
 */
export function parseInlineSourceMap(dataUri: string): RawSourceMap | null {
  try {
    // Handle optional charset parameter: data:application/json;charset=utf-8;base64,...
    const dataUriRegex = /^data:application\/json(?:;charset=[^;]+)?;base64,/;
    const match = dataUri.match(dataUriRegex);
    if (!match) {
      return null;
    }

    const base64 = dataUri.slice(match[0].length);
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(json);

    // Validate required RawSourceMap fields
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.version !== "number" ||
      !Array.isArray(parsed.sources) ||
      typeof parsed.mappings !== "string"
    ) {
      return null;
    }

    return parsed as RawSourceMap;
  } catch {
    return null;
  }
}

/**
 * Extract source map information including original sources and variable name mappings
 */
export function extractSourceMapInfo(map: RawSourceMap): SourceMapInfo | null {
  try {
    const variableNames = new Map<string, string>();

    const consumer = new SourceMapConsumer(map);

    consumer.eachMapping((mapping) => {
      if (mapping.name) {
        const generatedKey = `${mapping.generatedLine}:${mapping.generatedColumn}`;
        variableNames.set(generatedKey, mapping.name);
      }
    });

    return {
      sources: map.sources,
      sourcesContent: map.sourcesContent || null,
      variableNames,
    };
  } catch {
    return null;
  }
}

/**
 * Main entry point: process code with source map
 * Detects, parses, and extracts all source map information in one call
 */
export function processCodeWithSourceMap(code: string): SourceMapResult {
  const sourceMapUrl = detectSourceMapUrl(code);

  if (!sourceMapUrl) {
    return { hasSourceMap: false };
  }

  const map = parseInlineSourceMap(sourceMapUrl);

  if (!map) {
    // URL was detected but not inline base64 - it's an external file reference
    return { hasSourceMap: true, externalSourceMapUrl: sourceMapUrl };
  }

  const info = extractSourceMapInfo(map);

  if (!info) {
    return { hasSourceMap: true };
  }

  // Build originalSources array pairing filenames with content
  const originalSources = info.sourcesContent
    ? info.sources
        .map((file, i) => ({ file, content: info.sourcesContent![i] }))
        .filter((source): source is { file: string; content: string } => !!source.content)
    : [];

  const variableHints: Record<string, string> = Object.fromEntries(info.variableNames);

  return {
    hasSourceMap: true,
    originalSources: originalSources.length > 0 ? originalSources : undefined,
    variableHints: Object.keys(variableHints).length > 0 ? variableHints : undefined,
  };
}
