export * from './proof-jwt';
export * from './quota';
export * from './solver';
import { ParsedFile, SMTProgram, VerificationResult } from '@proofengine/core';
import { PaymentRequiredError } from './quota';
export interface VerifyFileOptions {
    filePath: string;
    source: string;
    workspaceId?: string;
    tier?: 'free' | 'dev-pro' | 'enterprise';
    skipQuota?: boolean;
}
export interface VerifyFileOutput {
    parsed: ParsedFile;
    programs: SMTProgram[];
    results: VerificationResult[];
    overallStatus: 'ALL_PROVEN' | 'SOME_VIOLATIONS' | 'NO_INVARIANTS' | 'QUOTA_EXCEEDED';
    provenCount: number;
    violationCount: number;
    unknownCount: number;
    quotaError?: PaymentRequiredError;
    totalDurationMs: number;
}
export declare function verifyFile(opts: VerifyFileOptions): Promise<VerifyFileOutput>;
//# sourceMappingURL=index.d.ts.map