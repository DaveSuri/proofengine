#!/usr/bin/env node
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
exports.toolVerifyInvariants = toolVerifyInvariants;
exports.toolPurchaseSubscription = toolPurchaseSubscription;
exports.toolCheckQuota = toolCheckQuota;
exports.toolScanFinancialCode = toolScanFinancialCode;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const solver_api_1 = require("@proofengine/solver-api");
const core_1 = require("@proofengine/core");
const SERVER_NAME = 'proofengine-mcp-server';
const SERVER_VERSION = '0.1.0';
exports.server = new index_js_1.Server({ name: SERVER_NAME, version: SERVER_VERSION }, {
    capabilities: {
        tools: {},
    },
});
exports.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'verify_financial_invariants',
            description: 'Run symbolic verification on a TypeScript/JavaScript file containing @proofengine:invariant annotations. ' +
                'Parses billing/payment logic, converts financial invariants into SMT constraints, and returns either a signed ' +
                'proof JWT (PROVEN) or a concrete numeric counterexample (VIOLATION) that the calling agent can use to self-correct. ' +
                'Also detects quota exhaustion and returns structured 402 PAYMENT_REQUIRED with approval prompts.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute or cwd-relative path to the TS/JS file to verify.',
                    },
                    debugSmt: {
                        type: 'boolean',
                        description: 'Include raw SMT-LIB2 programs in response for debugging.',
                        default: false,
                    },
                    skipQuota: {
                        type: 'boolean',
                        description: 'Bypass freemium quota gate (dev-only).',
                        default: false,
                    },
                    workspaceId: {
                        type: 'string',
                        description: 'Optional workspace identifier for quota tracking.',
                    },
                },
                required: ['filePath'],
            },
        },
        {
            name: 'purchase_verification_subscription',
            description: 'Programmatically checkout a paid ProofEngine tier when free-tier verification quota is exhausted. ' +
                'Call this tool after receiving a PAYMENT_REQUIRED response from verify_financial_invariants. ' +
                'The calling AI agent should surface the approval_prompt text to the user before invoking with autoApprove=true.',
            inputSchema: {
                type: 'object',
                properties: {
                    tier: {
                        type: 'string',
                        description: 'Subscription tier to purchase. dev-pro: $49/mo, enterprise: $499/mo.',
                        enum: ['dev-pro', 'enterprise'],
                    },
                    autoApprove: {
                        type: 'boolean',
                        description: 'User has confirmed the purchase. If false, returns checkout URL only.',
                        default: false,
                    },
                    workspaceId: {
                        type: 'string',
                        description: 'Override the workspace ID tracked for quota.',
                    },
                },
                required: ['tier'],
            },
        },
        {
            name: 'check_quota',
            description: 'Return the current workspace tier, verification usage, remaining free quota, and pending unverified edge cases.',
            inputSchema: {
                type: 'object',
                properties: {
                    workspaceId: {
                        type: 'string',
                        description: 'Override the workspace ID.',
                    },
                },
            },
        },
        {
            name: 'scan_financial_code',
            description: 'Lint-scan files/directories for payment/billing keywords (@stripe/stripe-node, proration, tax_rate, ledger, subtotal, charge, etc.) ' +
                'that are missing @proofengine formal verification tags. Returns a fix list for the agent to add invariants.',
            inputSchema: {
                type: 'object',
                properties: {
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'File or directory paths to scan.',
                        default: ['.'],
                    },
                },
            },
        },
    ],
}));
exports.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case 'verify_financial_invariants':
            return toolVerifyInvariants(args || {});
        case 'purchase_verification_subscription':
            return toolPurchaseSubscription(args || {});
        case 'check_quota':
            return toolCheckQuota(args || {});
        case 'scan_financial_code':
            return toolScanFinancialCode(args || {});
        default:
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
                    },
                ],
                isError: true,
            };
    }
});
function textResult(text, isError = false) {
    return {
        content: [{ type: 'text', text }],
        isError,
    };
}
async function toolVerifyInvariants(args) {
    const filePathRaw = args.filePath;
    if (!filePathRaw) {
        return textResult(JSON.stringify({ status: 'ERROR', message: 'filePath is required.' }, null, 2), true);
    }
    const filePath = path.isAbsolute(filePathRaw)
        ? filePathRaw
        : path.resolve(process.cwd(), filePathRaw);
    if (!fs.existsSync(filePath)) {
        return textResult(JSON.stringify({ status: 'ERROR', http_code: 404, message: `File not found: ${filePath}` }, null, 2), true);
    }
    const source = fs.readFileSync(filePath, 'utf-8');
    const skipQuota = !!args.skipQuota;
    const workspaceId = args.workspaceId;
    const result = await (0, solver_api_1.verifyFile)({ filePath, source, skipQuota, workspaceId });
    if (result.overallStatus === 'QUOTA_EXCEEDED' && result.quotaError) {
        return textResult(JSON.stringify(result.quotaError, null, 2));
    }
    const payload = {
        file: filePath,
        overall_status: result.overallStatus,
        proven: result.provenCount,
        violations: result.violationCount,
        unknown: result.unknownCount,
        duration_ms: result.totalDurationMs,
        parsed: {
            invariants: result.parsed.invariants.map(i => ({
                line: i.line,
                expression: i.expression,
            })),
            boundaries: result.parsed.boundaries.map(b => ({
                line: b.line,
                expression: b.expression,
            })),
            branches: result.parsed.branches.length,
            arithmetic_nodes: result.parsed.arithmeticNodes.length,
            variables: result.parsed.variables.map(v => ({
                name: v.name,
                type: v.type,
                source: v.source,
            })),
        },
        invariant_results: result.results.map(r => serializeVerificationResult(r)),
        suggested_fixes: suggestAgentFixes(result.results),
    };
    if (args.debugSmt) {
        payload.smt_programs = result.programs.map(p => p.rawSmtLib);
    }
    return textResult(JSON.stringify(payload, null, 2));
}
function serializeVerificationResult(r) {
    const out = {
        invariant: r.invariant,
        status: r.status,
        status_label: r.statusLabel,
        duration_ms: r.durationMs,
        variables_count: r.variablesCount,
        constraints_count: r.constraintsCount,
    };
    if (r.status === 'PROVEN' && r.proofJwt) {
        out.proof_jwt = r.proofJwt;
        out.proof = { jwt: r.proofJwt, algorithm: 'HS256', verifiable: true };
    }
    if (r.status === 'VIOLATION' && r.counterexamples) {
        out.counterexample = r.counterexampleObject || {
            inputs: r.counterexamples.reduce((acc, c) => {
                acc[c.variable] = c.value;
                return acc;
            }, {}),
            drift: -0.01,
        };
        out.violation = {
            counterexample: out.counterexample,
            counterexample_summary: r.counterexampleSummary,
            failing_trace: r.counterexamples.map(c => ({
                variable: c.variable,
                value: c.value,
                type: c.type,
                implication: interpretCounterexample(c),
            })),
            recommended_action: 'Adjust the financial logic to respect the invariant, then re-run verify_financial_invariants.',
        };
    }
    if (r.errorMessage) {
        out.error = r.errorMessage;
    }
    return out;
}
function interpretCounterexample(c) {
    const val = c.value;
    if (typeof val === 'number') {
        if (val < 0) {
            return `Negative ${c.variable} triggers invariant violation. Expected >= 0.`;
        }
        if (val === 0) {
            return `${c.variable} = 0 may cause division or proration edge case.`;
        }
        if (!Number.isInteger(val) && val > 0) {
            return `Non-integer ${c.variable} = ${val.toFixed(4)} exposes fractional-cent drift.`;
        }
        return `${c.variable} = ${val} breaks the symbolic constraint.`;
    }
    return `${c.variable} = ${String(val)}`;
}
function suggestAgentFixes(results) {
    const fixes = [];
    for (const r of results) {
        if (r.status !== 'VIOLATION' || !r.counterexamples)
            continue;
        const hasNegativeAmount = r.counterexamples.some(c => (c.variable.toLowerCase().includes('amount') ||
            c.variable.toLowerCase().includes('charge') ||
            c.variable.toLowerCase().includes('balance')) &&
            typeof c.value === 'number' &&
            c.value < 0);
        if (hasNegativeAmount) {
            fixes.push('Negative balance/amount counterexample detected: add a Math.max(0, amount) guard before Stripe charge call, ' +
                'or tighten the boundary via `// @proofengine:boundary amount > 0`.');
        }
        const hasProrationDrift = r.counterexamples.some(c => c.variable.toLowerCase().includes('prorat') ||
            c.variable.toLowerCase().includes('day'));
        if (hasProrationDrift) {
            fixes.push('Proration boundary violation: clamp proration_days with `// @proofengine:boundary proration_days in [0, 30]` ' +
                'and floor on the aggregate total in integer cents to avoid per-seat rounding drift.');
        }
        const hasBalanceDrift = r.counterexamples.some(c => c.variable.toLowerCase().includes('drift') && typeof c.value === 'number' && c.value !== 0);
        if (hasBalanceDrift) {
            fixes.push('Balance drift detected: ensure sum(debits) === sum(credits) at every branch using integer-cents math, ' +
                'then verify with `// @proofengine:invariant sum(debits) == sum(credits)`.');
        }
    }
    return fixes;
}
async function toolPurchaseSubscription(args) {
    const tier = args.tier;
    const autoApprove = !!args.autoApprove;
    const workspaceId = args.workspaceId;
    if (!tier || !['dev-pro', 'enterprise'].includes(tier)) {
        return textResult(JSON.stringify({ status: 'ERROR', message: 'Invalid tier. Must be one of: dev-pro, enterprise.' }, null, 2), true);
    }
    const result = (0, solver_api_1.purchaseSubscription)(tier, autoApprove, workspaceId);
    if (!autoApprove) {
        return textResult(JSON.stringify({
            status: 'PAYMENT_REQUIRED',
            tier: result.tier,
            price_usd: tier === 'dev-pro' ? 49.0 : 499.0,
            checkout_url: result.checkout_url,
            approval_prompt: tier === 'dev-pro'
                ? 'ProofEngine detected unverified billing branches. Would you like me to authorize Developer Pro ($49/mo)?'
                : 'Approve ProofEngine Enterprise ($499/mo) for unlimited symbolic verification and audit proofs.',
            next_step: 'Present the approval_prompt to the end-user, then re-invoke with autoApprove=true once they confirm.',
        }, null, 2));
    }
    return textResult(JSON.stringify({
        status: 'SUBSCRIBED',
        tier: result.tier,
        monthlyLimit: result.monthlyLimit,
        transaction_id: result.transaction_id,
        message: result.message,
        remaining_verifications: result.monthlyLimit,
        quota_refreshed: true,
    }, null, 2));
}
function toolCheckQuota(args) {
    const quota = args.workspaceId
        ? (0, solver_api_1.getQuota)(args.workspaceId)
        : (0, solver_api_1.getQuota)();
    return textResult(JSON.stringify({
        status: quota.usedThisMonth < quota.monthlyLimit ? 'OK' : 'QUOTA_EXCEEDED',
        workspace_id: quota.workspaceId,
        tier: quota.tier,
        used: quota.usedThisMonth,
        monthly_limit: quota.monthlyLimit,
        free_quota: solver_api_1.FREE_QUOTA,
        remaining: Math.max(0, quota.monthlyLimit - quota.usedThisMonth),
        unverified_edge_cases: quota.unverifiedCount,
        reset_at: new Date(quota.resetAt).toISOString(),
        upgrade_tier: quota.tier === 'free'
            ? {
                tier: 'dev-pro',
                price_usd: 49,
                monthly_limit: 500,
                url: 'https://proofengine.ai/upgrade?workspace=' +
                    encodeURIComponent(quota.workspaceId),
            }
            : null,
    }, null, 2));
}
function toolScanFinancialCode(args) {
    const paths = args.paths || ['.'];
    const findings = [];
    for (const p of paths) {
        const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
        if (!fs.existsSync(resolved))
            continue;
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
            scanDir(resolved, findings);
        }
        else {
            scanFile(resolved, findings);
        }
    }
    const unvettedFiles = new Set(findings.filter(f => !f.hasProofengineTags).map(f => f.file));
    return textResult(JSON.stringify({
        scanned_paths: paths,
        total_findings: findings.length,
        unvetted_files_count: unvettedFiles.size,
        unvetted_files: Array.from(unvettedFiles),
        findings: findings.map(f => ({
            file: f.file,
            line: f.line,
            keyword: f.keyword,
            tagged: f.hasProofengineTags,
            suggested_invariant: suggestInvariantForKeyword(f.keyword),
        })),
    }, null, 2));
}
function scanDir(dir, findings) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        if (e.name.startsWith('node_modules') ||
            e.name.startsWith('.git') ||
            e.name === 'dist' ||
            e.name === 'build')
            continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory())
            scanDir(full, findings);
        else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name))
            scanFile(full, findings);
    }
}
function scanFile(filePath, findings) {
    try {
        const source = fs.readFileSync(filePath, 'utf-8');
        const { hits, hasProofEngineTags } = (0, core_1.scanForUntaggedFinancialCode)(source);
        for (const h of hits) {
            findings.push({
                file: filePath,
                line: h.line,
                keyword: h.keyword,
                hasProofengineTags: hasProofEngineTags,
            });
        }
    }
    catch {
        // skip
    }
}
function suggestInvariantForKeyword(kw) {
    switch (kw.toLowerCase()) {
        case 'charge':
        case 'payment':
        case 'amount':
        case '@stripe/stripe-node':
        case 'stripe':
            return '// @proofengine:invariant charge_amount >= 0';
        case 'proration':
        case 'prorate':
            return '// @proofengine:boundary proration_days in [0, 30]\n// @proofengine:invariant proration_pct >= 0 and proration_pct <= 1';
        case 'tax_rate':
        case 'taxrate':
            return '// @proofengine:boundary tax_rate in [0, 0.30]\n// @proofengine:invariant total_charge == subtotal - discount + tax';
        case 'subtotal':
        case 'invoice':
        case 'total_charge':
        case 'totalcharge':
            return '// @proofengine:invariant subtotal - discount + tax == total_charge';
        case 'refund':
            return '// @proofengine:invariant refund_amount <= original_charge';
        case 'credit':
        case 'debit':
        case 'balance':
        case 'ledger':
            return '// @proofengine:invariant sum(debits) == sum(credits)';
        case 'discount':
        case 'coupon':
            return '// @proofengine:boundary discount in [0, subtotal]';
        case 'subscription':
            return '// @proofengine:boundary seats > 0\n// @proofengine:invariant amount == seats * price_per_seat';
        case 'billing':
            return '// @proofengine:invariant next_charge_date >= today';
        default:
            return '// @proofengine:invariant amount >= 0';
    }
}
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await exports.server.connect(transport);
    process.stderr.write(`ProofEngine MCP server running (${SERVER_NAME} v${SERVER_VERSION})\n`);
}
if (require.main === module) {
    main().catch(err => {
        process.stderr.write('ProofEngine MCP Server fatal: ' + (err?.stack || err) + '\n');
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map