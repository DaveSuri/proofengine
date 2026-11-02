export * from './proof-jwt';
export * from './quota';
export * from './solver';

import {
  parseFile,
  generateAllSMTPrograms,
  ParsedFile,
  SMTProgram,
  VerificationResult,
} from '@proofengine/core';
import { runSolver } from './solver';
import { checkQuotaAndConsume, PaymentRequiredError } from './quota';
import { hashContent } from './proof-jwt';

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

export async function verifyFile(opts: VerifyFileOptions): Promise<VerifyFileOutput> {
  const start = Date.now();
  const { filePath, source, workspaceId, skipQuota } = opts;
  const parsed = parseFile(filePath, source);
  const programs = generateAllSMTPrograms(parsed);

  const tier = opts.tier || (workspaceId ? 'free' : 'free');
  const fileHash = hashContent(source);

  if (!skipQuota) {
    const estimatedUnverified = Math.max(0,
      parsed.invariants.length + parsed.branches.length - 1
    );
    const quotaCheck = checkQuotaAndConsume(workspaceId, estimatedUnverified);
    if (!quotaCheck.ok) {
      return {
        parsed,
        programs,
        results: [],
        overallStatus: 'QUOTA_EXCEEDED',
        provenCount: 0,
        violationCount: 0,
        unknownCount: 0,
        quotaError: quotaCheck.error,
        totalDurationMs: Date.now() - start,
      };
    }
  }

  const results: VerificationResult[] = [];
  for (const program of programs) {
    const result = await runSolver(program, {
      workspaceId,
      tier,
      fileHash,
    });
    results.push(result);
  }

  const provenCount = results.filter(r => r.status === 'PROVEN').length;
  const violationCount = results.filter(r => r.status === 'VIOLATION').length;
  const unknownCount = results.filter(r => r.status === 'UNKNOWN' || r.status === 'ERROR').length;

  let overallStatus: VerifyFileOutput['overallStatus'] = 'ALL_PROVEN';
  if (parsed.invariants.length === 0) overallStatus = 'NO_INVARIANTS';
  else if (violationCount > 0) overallStatus = 'SOME_VIOLATIONS';
  else if (unknownCount > 0 && provenCount === 0) overallStatus = 'NO_INVARIANTS';

  return {
    parsed,
    programs,
    results,
    overallStatus,
    provenCount,
    violationCount,
    unknownCount,
    totalDurationMs: Date.now() - start,
  };
}
