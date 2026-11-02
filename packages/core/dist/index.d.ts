export * from './types';
export * from './invariant-parser';
export * from './ast-parser';
export * from './smt-generator';
import { parseFile } from './ast-parser';
import { generateAllSMTPrograms } from './smt-generator';
export interface ParseAndGenerateResult {
    parsed: ReturnType<typeof parseFile>;
    programs: ReturnType<typeof generateAllSMTPrograms>;
}
export declare function parseAndGenerate(filePath: string, source: string): ParseAndGenerateResult;
export declare const PAYMENT_KEYWORDS: string[];
export declare function scanForUntaggedFinancialCode(source: string): {
    hits: Array<{
        keyword: string;
        line: number;
    }>;
    hasProofEngineTags: boolean;
};
//# sourceMappingURL=index.d.ts.map