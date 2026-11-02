import { SMTProgram, VerificationResult } from '@proofengine/core';
export declare function parseZ3Value(raw: string): number | boolean | string;
export declare function runSolver(program: SMTProgram, opts?: {
    workspaceId?: string;
    tier?: 'free' | 'dev-pro' | 'enterprise';
    fileHash?: string;
    timeoutMs?: number;
}): Promise<VerificationResult>;
//# sourceMappingURL=solver.d.ts.map