import { InvariantAnnotation } from './types';

const INVARIANT_PATTERN = /@proofengine:invariant\s+(.+)$/;
const BOUNDARY_PATTERN = /@proofengine:boundary\s+(.+)$/;

export function parseAnnotations(source: string): {
  invariants: InvariantAnnotation[];
  boundaries: InvariantAnnotation[];
} {
  const invariants: InvariantAnnotation[] = [];
  const boundaries: InvariantAnnotation[] = [];
  const lines = source.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const commentMatch = line.match(/^\s*\/\/\s*(.*)$/) || line.match(/^\s*\*\s*(.*)$/) || line.match(/\/\*\s*(.*?)\s*\*\//);

    if (!commentMatch) continue;

    const commentContent = commentMatch[1];

    const invariantMatch = commentContent.match(INVARIANT_PATTERN);
    if (invariantMatch) {
      invariants.push({
        type: 'invariant',
        expression: invariantMatch[1].trim(),
        raw: invariantMatch[0],
        line: lineNum + 1,
        column: (line.indexOf('//') >= 0 ? line.indexOf('//') : line.indexOf('/*')) + 1,
      });
      continue;
    }

    const boundaryMatch = commentContent.match(BOUNDARY_PATTERN);
    if (boundaryMatch) {
      boundaries.push({
        type: 'boundary',
        expression: boundaryMatch[1].trim(),
        raw: boundaryMatch[0],
        line: lineNum + 1,
        column: (line.indexOf('//') >= 0 ? line.indexOf('//') : line.indexOf('/*')) + 1,
      });
    }
  }

  return { invariants, boundaries };
}

export function normalizeExpression(expr: string): string {
  return expr
    .replace(/\s+/g, ' ')
    .replace(/==/g, '==')
    .replace(/!=/g, '!=')
    .replace(/>=/g, '>=')
    .replace(/<=/g, '<=')
    .trim();
}
