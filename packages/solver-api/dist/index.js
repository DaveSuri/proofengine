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
exports.verifyFile = verifyFile;
__exportStar(require("./proof-jwt"), exports);
__exportStar(require("./quota"), exports);
__exportStar(require("./solver"), exports);
const core_1 = require("@proofengine/core");
const solver_1 = require("./solver");
const quota_1 = require("./quota");
const proof_jwt_1 = require("./proof-jwt");
async function verifyFile(opts) {
    const start = Date.now();
    const { filePath, source, workspaceId, skipQuota } = opts;
    const parsed = (0, core_1.parseFile)(filePath, source);
    const programs = (0, core_1.generateAllSMTPrograms)(parsed);
    const tier = opts.tier || (workspaceId ? 'free' : 'free');
    const fileHash = (0, proof_jwt_1.hashContent)(source);
    if (!skipQuota) {
        const estimatedUnverified = Math.max(0, parsed.invariants.length + parsed.branches.length - 1);
        const quotaCheck = (0, quota_1.checkQuotaAndConsume)(workspaceId, estimatedUnverified);
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
    const results = [];
    for (const program of programs) {
        const result = await (0, solver_1.runSolver)(program, {
            workspaceId,
            tier,
            fileHash,
        });
        results.push(result);
    }
    const provenCount = results.filter(r => r.status === 'PROVEN').length;
    const violationCount = results.filter(r => r.status === 'VIOLATION').length;
    const unknownCount = results.filter(r => r.status === 'UNKNOWN' || r.status === 'ERROR').length;
    let overallStatus = 'ALL_PROVEN';
    if (parsed.invariants.length === 0)
        overallStatus = 'NO_INVARIANTS';
    else if (violationCount > 0)
        overallStatus = 'SOME_VIOLATIONS';
    else if (unknownCount > 0 && provenCount === 0)
        overallStatus = 'NO_INVARIANTS';
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
//# sourceMappingURL=index.js.map