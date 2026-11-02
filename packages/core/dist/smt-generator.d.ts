import { ParsedFile, SMTProgram } from './types';
export declare function expressionToSMT(expr: string, aliasMap?: Map<string, string>): string;
export declare function generateSMTProgram(parsed: ParsedFile, invariantIndex?: number, options?: {
    useNegation: boolean;
}): SMTProgram;
export declare function generateAllSMTPrograms(parsed: ParsedFile): SMTProgram[];
//# sourceMappingURL=smt-generator.d.ts.map