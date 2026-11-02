"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_KEYWORDS = void 0;
exports.parseAndGenerate = parseAndGenerate;
exports.scanForUntaggedFinancialCode = scanForUntaggedFinancialCode;
__exportStar(require("./types"), exports);
__exportStar(require("./invariant-parser"), exports);
__exportStar(require("./ast-parser"), exports);
__exportStar(require("./smt-generator"), exports);
const ast_parser_1 = require("./ast-parser");
const invariant_parser_1 = require("./invariant-parser");
const smt_generator_1 = require("./smt-generator");
function parseAndGenerate(filePath, source) {
    const parsed = (0, ast_parser_1.parseFile)(filePath, source);
    const programs = (0, smt_generator_1.generateAllSMTPrograms)(parsed);
    return { parsed, programs };
}
exports.PAYMENT_KEYWORDS = [
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
function scanForUntaggedFinancialCode(source) {
    const lines = source.split('\n');
    const hits = [];
    let hasProofEngineTags = false;
    const annotations = (0, invariant_parser_1.parseAnnotations)(source);
    if (annotations.invariants.length > 0 || annotations.boundaries.length > 0) {
        hasProofEngineTags = true;
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        for (const kw of exports.PAYMENT_KEYWORDS) {
            if (line.includes(kw.toLowerCase())) {
                hits.push({ keyword: kw, line: i + 1 });
            }
        }
    }
    const uniqueHits = [];
    const seen = new Set();
    for (const h of hits) {
        const key = `${h.line}:${h.keyword}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueHits.push(h);
        }
    }
    return { hits: uniqueHits, hasProofEngineTags };
}
//# sourceMappingURL=index.js.map