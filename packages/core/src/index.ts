export * from './types';
export * from './invariant-parser';
export * from './ast-parser';
export * from './smt-generator';

import { parseFile } from './ast-parser';
import { parseAnnotations } from './invariant-parser';
import { generateAllSMTPrograms } from './smt-generator';

export interface ParseAndGenerateResult {
  parsed: ReturnType<typeof parseFile>;
  programs: ReturnType<typeof generateAllSMTPrograms>;
}

export function parseAndGenerate(filePath: string, source: string): ParseAndGenerateResult {
  const parsed = parseFile(filePath, source);
  const programs = generateAllSMTPrograms(parsed);
  return { parsed, programs };
}

export const PAYMENT_KEYWORDS = [
  '@stripe/stripe-node',
  'stripe',
  'proration',
  'prorate',
  'tax_rate',
  'taxRate',
  'ledger',
  'subtotal',
  'invoice',
  'charge',
  'payment',
  'refund',
  'credit',
  'debit',
  'balance',
  'billing',
  'discount',
  'coupon',
  'subscription',
  'amount',
  'total_charge',
  'totalCharge',
];

export function scanForUntaggedFinancialCode(source: string): {
  hits: Array<{ keyword: string; line: number }>;
  hasProofEngineTags: boolean;
} {
  const lines = source.split('\n');
  const hits: Array<{ keyword: string; line: number }> = [];
  let hasProofEngineTags = false;

  const annotations = parseAnnotations(source);
  if (annotations.invariants.length > 0 || annotations.boundaries.length > 0) {
    hasProofEngineTags = true;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    for (const kw of PAYMENT_KEYWORDS) {
      if (line.includes(kw.toLowerCase())) {
        hits.push({ keyword: kw, line: i + 1 });
      }
    }
  }

  const uniqueHits: typeof hits = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.line}:${h.keyword}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueHits.push(h);
    }
  }

  return { hits: uniqueHits, hasProofEngineTags };
}
