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
const commander_1 = require("commander");
const chalk = __importStar(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const solver_api_1 = require("@proofengine/solver-api");
const core_1 = require("@proofengine/core");
const program = new commander_1.Command();
program
    .name('proofengine')
    .description('Symbolic Verification Layer for Financial Code')
    .version('0.1.0');
program
    .command('verify <filePath>')
    .description('Symbolically verify financial invariants in a file')
    .option('--json', 'Output machine-readable JSON')
    .option('--remote', 'Use remote solver API (default: local Z3)', false)
    .option('--debug-smt', 'Print raw SMT-LIB2 program for debugging', false)
    .option('--no-quota', 'Skip freemium quota gate (local dev only)')
    .action(async (filePath, opts) => {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
        if (opts.json) {
            process.stdout.write(JSON.stringify({
                status: 'ERROR',
                error: `File not found: ${resolvedPath}`,
            }, null, 2) + '\n');
        }
        else {
            console.error(chalk.default.red(`✖ File not found: ${resolvedPath}`));
        }
        process.exit(1);
        return;
    }
    const source = fs.readFileSync(resolvedPath, 'utf-8');
    if (!opts.json) {
        console.log(chalk.default.cyan.bold('\n  ProofEngine  ') + chalk.default.dim('v0.1.0 — Symbolic Verification'));
        console.log(chalk.default.dim('  ─────────────────────────────────────────────────\n'));
        console.log('  ' + chalk.default.white.bold('Target:  ') + chalk.default.reset(resolvedPath));
    }
    const result = await (0, solver_api_1.verifyFile)({
        filePath: resolvedPath,
        source,
        skipQuota: opts.quota === false,
    });
    if (opts.json) {
        const jsonOutput = {
            file: resolvedPath,
            overall_status: result.overallStatus,
            proven: result.provenCount,
            violations: result.violationCount,
            unknown: result.unknownCount,
            duration_ms: result.totalDurationMs,
            invariants: result.results.map(r => ({
                invariant: r.invariant,
                status: r.status,
                status_label: r.statusLabel,
                proof_jwt: r.proofJwt,
                counterexample: r.counterexampleObject,
                counterexamples: r.counterexamples,
                counterexample_summary: r.counterexampleSummary,
                duration_ms: r.durationMs,
                constraints_count: r.constraintsCount,
                variables_count: r.variablesCount,
            })),
        };
        if (result.quotaError) {
            jsonOutput.quota_error = result.quotaError;
        }
        if (opts.debugSmt) {
            jsonOutput.smt_programs = result.programs.map(p => p.rawSmtLib);
        }
        process.stdout.write(JSON.stringify(jsonOutput, null, 2) + '\n');
        if (result.overallStatus === 'QUOTA_EXCEEDED' || result.overallStatus === 'SOME_VIOLATIONS') {
            process.exit(1);
        }
        return;
    }
    if (result.overallStatus === 'QUOTA_EXCEEDED' && result.quotaError) {
        const q = result.quotaError;
        console.log('  ' + chalk.default.yellow.bold('Status:  ') + chalk.default.yellow('PAYMENT REQUIRED (HTTP 402)'));
        console.log('');
        console.log('  ' + chalk.default.yellow(q.message));
        console.log('');
        console.log('  ' + chalk.default.white.bold('Tier:   ') + q.tier);
        console.log('  ' + chalk.default.white.bold('Price:  ') + `$${q.price_usd.toFixed(2)}/mo`);
        console.log('  ' + chalk.default.white.bold('URL:    ') + chalk.default.blue.underline(q.upgrade_url));
        console.log('');
        console.log('  ' + chalk.default.bgYellow.black.bold('  APPROVAL PROMPT  '));
        console.log('  ' + chalk.default.reset(q.approval_prompt));
        console.log('');
        process.exit(1);
        return;
    }
    console.log('  ' + chalk.default.white.bold('Parsed:  ') +
        chalk.default.green(result.parsed.invariants.length) + ' invariants · ' +
        chalk.default.blue(result.parsed.boundaries.length) + ' boundaries · ' +
        chalk.default.yellow(result.parsed.branches.length) + ' control branches · ' +
        chalk.default.magenta(result.parsed.arithmeticNodes.length) + ' arithmetic nodes');
    console.log('');
    if (result.overallStatus === 'NO_INVARIANTS') {
        console.log('  ' + chalk.default.yellow.bold('⚠  No @proofengine:invariant tags found.'));
        console.log('  ' + chalk.default.dim('   Add `// @proofengine:invariant expr` comments above financial logic.'));
        console.log('');
        process.exit(0);
        return;
    }
    console.log('  ' + chalk.default.white.bold('Results:\n'));
    let exitCode = 0;
    for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i];
        const prefix = '  ' + (i + 1).toString().padStart(2, ' ') + '. ';
        if (r.status === 'PROVEN') {
            console.log(prefix + chalk.default.green.bold('✔ PROVEN (UNSAT)  ') + chalk.default.reset(r.invariant));
            console.log(chalk.default.dim(`       vars:${r.variablesCount} · constraints:${r.constraintsCount} · ${r.durationMs}ms · proof:${(r.proofJwt || '').slice(0, 16)}...`));
        }
        else if (r.status === 'VIOLATION') {
            exitCode = 1;
            console.log(prefix + chalk.default.red.bold('✖ VIOLATION (SAT)  ') + chalk.default.reset(r.invariant));
            console.log(chalk.default.dim(`       vars:${r.variablesCount} · constraints:${r.constraintsCount} · ${r.durationMs}ms`));
            if (r.counterexamples && r.counterexamples.length > 0) {
                console.log('');
                console.log(chalk.default.red.bold('     Counterexample (satisfying assignment):'));
                const rows = r.counterexamples.map(c => {
                    const val = typeof c.value === 'number'
                        ? (Number.isInteger(c.value) ? c.value.toString() : c.value.toFixed(4))
                        : String(c.value);
                    const driftWarn = (typeof c.value === 'number' && c.value < 0)
                        ? chalk.default.red.bold(`  ⚠ drift=${c.value}`)
                        : '';
                    return `       ${chalk.default.white.bold(c.variable.padEnd(22))} ${chalk.default.red(val.padStart(12))}${driftWarn}`;
                });
                console.log(rows.join('\n'));
            }
            if (r.counterexampleSummary) {
                console.log('');
                console.log(chalk.default.red('     Counterexample JSON trace: ') + chalk.default.red(r.counterexampleSummary));
            }
        }
        else {
            console.log(prefix + chalk.default.gray.bold('? UNKNOWN  ') + chalk.default.reset(r.invariant));
            if (r.errorMessage) {
                console.log(chalk.default.dim('       ' + r.errorMessage));
            }
        }
        console.log('');
    }
    if (opts.debugSmt) {
        console.log(chalk.default.dim('  ── SMT-LIB2 Debug Dump ──'));
        for (let i = 0; i < result.programs.length; i++) {
            console.log(chalk.default.dim(`  \n--- Program ${i + 1} ---\n`));
            console.log(result.programs[i].rawSmtLib);
        }
    }
    const summary = chalk.default.green(`${result.provenCount} proven`) + ' · ' +
        (result.violationCount > 0
            ? chalk.default.red(`${result.violationCount} violation(s)`)
            : chalk.default.dim(`${result.violationCount} violations`)) +
        ' · ' + chalk.default.dim(`${result.totalDurationMs}ms`);
    console.log('  ' + chalk.default.dim('─────────────────────────────────────────────────'));
    console.log('  ' + chalk.default.white.bold('Summary: ') + summary);
    console.log('');
    process.exit(exitCode);
});
program
    .command('check [paths...]')
    .description('Lint-pass: scan for financial code lacking @proofengine verification tags')
    .option('--json', 'Output machine-readable JSON')
    .option('--recursive', 'Scan directories recursively', true)
    .option('--include', 'Glob pattern for files to include (default: **/*.{ts,tsx,js,jsx})')
    .action((paths, opts) => {
    const targetPaths = paths.length > 0 ? paths : [process.cwd()];
    const includePattern = opts.include || '**/*.{ts,tsx,js,jsx}';
    const findings = [];
    for (const p of targetPaths) {
        const resolved = path.resolve(process.cwd(), p);
        if (!fs.existsSync(resolved))
            continue;
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
            scanDirectory(resolved, includePattern, findings);
        }
        else {
            scanOneFile(resolved, findings);
        }
    }
    const filesWithoutTags = new Set(findings
        .filter(f => !f.hasProofengineTags)
        .map(f => f.file));
    if (opts.json) {
        process.stdout.write(JSON.stringify({
            scan_paths: targetPaths,
            total_findings: findings.length,
            files_without_tags: filesWithoutTags.size,
            findings: findings.map(f => ({
                file: f.file,
                line: f.line,
                keyword: f.keyword,
                has_proofengine_tags: f.hasProofengineTags,
            })),
            monitored_keywords: core_1.PAYMENT_KEYWORDS,
        }, null, 2) + '\n');
        process.exit(filesWithoutTags.size > 0 ? 1 : 0);
        return;
    }
    console.log(chalk.default.cyan.bold('\n  ProofEngine Check  ') + chalk.default.dim('v0.1.0 — Lint Pass'));
    console.log(chalk.default.dim('  ─────────────────────────────────────────────────\n'));
    console.log('  ' + chalk.default.white.bold('Scanning: ') + targetPaths.join(', '));
    console.log('  ' + chalk.default.white.bold('Pattern:  ') + includePattern);
    console.log('  ' + chalk.default.white.bold('Keywords: ') + core_1.PAYMENT_KEYWORDS.length + ' financial markers');
    console.log('');
    if (findings.length === 0) {
        console.log('  ' + chalk.default.green.bold('✔ Clean') + chalk.default.dim(' — No financial code markers detected.'));
        console.log('');
        process.exit(0);
        return;
    }
    const withTags = findings.filter(f => f.hasProofengineTags).length;
    const withoutTags = filesWithoutTags.size;
    console.log('  ' + chalk.default.white.bold('Findings:  ') +
        chalk.default.yellow(findings.length) + ' markers · ' +
        chalk.default.green(withTags) + ' verified · ' +
        (withoutTags > 0 ? chalk.default.red.bold(withoutTags) : chalk.default.dim(withoutTags)) + ' unvetted files');
    console.log('');
    let currentFile = '';
    const sorted = [...findings].sort((a, b) => {
        if (a.file < b.file)
            return -1;
        if (a.file > b.file)
            return 1;
        return a.line - b.line;
    });
    for (const f of sorted) {
        if (f.file !== currentFile) {
            currentFile = f.file;
            const marker = f.hasProofengineTags
                ? chalk.default.green('   ✔ ')
                : chalk.default.red.bold('   ✖ ');
            const status = f.hasProofengineTags
                ? chalk.default.green.dim('[VERIFIED]')
                : chalk.default.red.bold('[UNVETTED — missing @proofengine tags]');
            console.log('');
            console.log(marker + chalk.default.white.bold(currentFile) + ' ' + status);
        }
        console.log(chalk.default.dim('     line ' + String(f.line).padEnd(4)) +
            '  ' + chalk.default.magenta('@' + f.keyword));
    }
    console.log('');
    console.log('  ' + chalk.default.dim('─────────────────────────────────────────────────'));
    if (withoutTags > 0) {
        console.log('  ' + chalk.default.red.bold(`⚠  ${withoutTags} file(s) contain financial logic WITHOUT @proofengine invariants.`));
        console.log('  ' + chalk.default.dim('     Add // @proofengine:invariant <expr> above critical billing branches.'));
    }
    else {
        console.log('  ' + chalk.default.green.bold('✔ All financial code files are tagged for symbolic verification.'));
    }
    console.log('');
    process.exit(withoutTags > 0 ? 1 : 0);
});
program
    .command('quota')
    .description('Show current workspace quota and tier')
    .option('--json', 'Output machine-readable JSON')
    .option('--reset', 'Reset workspace quota counter')
    .action((opts) => {
    const quota = opts.reset ? (0, solver_api_1.resetQuota)() : (0, solver_api_1.getQuota)();
    if (opts.json) {
        process.stdout.write(JSON.stringify(quota, null, 2) + '\n');
        return;
    }
    console.log(chalk.default.cyan.bold('\n  ProofEngine Quota  ') + chalk.default.dim('v0.1.0'));
    console.log(chalk.default.dim('  ─────────────────────────────────────────────────\n'));
    console.log('  ' + chalk.default.white.bold('Workspace: ') + quota.workspaceId);
    console.log('  ' + chalk.default.white.bold('Tier:      ') +
        (quota.tier === 'free' ? chalk.default.yellow(quota.tier) : chalk.default.green(quota.tier)));
    console.log('  ' + chalk.default.white.bold('Usage:     ') +
        chalk.default.cyan(`${quota.usedThisMonth} / ${quota.monthlyLimit}`) +
        chalk.default.dim(' verifications this month'));
    const remaining = Math.max(0, quota.monthlyLimit - quota.usedThisMonth);
    console.log('  ' + chalk.default.white.bold('Remaining: ') +
        (remaining <= 1 ? chalk.default.red.bold(remaining) : chalk.default.green(remaining)) +
        chalk.default.dim(' free verifications'));
    if (quota.unverifiedCount > 0) {
        console.log('  ' + chalk.default.white.bold('Pending:   ') +
            chalk.default.red.bold(quota.unverifiedCount) +
            chalk.default.dim(' unverified edge cases'));
    }
    console.log('  ' + chalk.default.white.bold('Reset:     ') +
        new Date(quota.resetAt).toISOString().slice(0, 10));
    if (quota.tier === 'free') {
        console.log('');
        console.log('  ' + chalk.default.yellow.bold('Upgrade to Developer Pro: ') +
            chalk.default.white.bold(`$${(quota.priceUsd || 49).toFixed(2)}/mo`) +
            chalk.default.dim(' — 500 verifications/month'));
    }
    console.log('');
});
program
    .command('subscribe')
    .description('Programmatically purchase a verification subscription tier')
    .argument('<tier>', 'dev-pro or enterprise')
    .option('--auto-approve', 'Auto-approve the purchase without interactive prompt')
    .option('--json', 'Output machine-readable JSON')
    .action((tier, opts) => {
    const result = (0, solver_api_1.purchaseSubscription)(tier, opts.autoApprove || false);
    if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        process.exit(result.success ? 0 : 1);
        return;
    }
    console.log(chalk.default.cyan.bold('\n  ProofEngine Subscription  ') + chalk.default.dim('v0.1.0'));
    console.log(chalk.default.dim('  ─────────────────────────────────────────────────\n'));
    if (result.success) {
        console.log('  ' + chalk.default.green.bold('✔ PURCHASED  ') + chalk.default.white.bold(tier));
        console.log('  ' + chalk.default.white.bold('Limit:  ') + result.monthlyLimit + ' verifications / month');
        console.log('  ' + chalk.default.white.bold('TXN ID: ') + chalk.default.dim(result.transaction_id || '(local)'));
        console.log('  ' + chalk.default.white.bold('URL:    ') + chalk.default.blue.underline(result.checkout_url || ''));
        console.log('');
        console.log('  ' + chalk.default.reset(result.message));
    }
    else {
        console.log('  ' + chalk.default.red.bold('✖ FAILED'));
        console.log('  ' + result.message);
    }
    console.log('');
    process.exit(result.success ? 0 : 1);
});
function scanDirectory(dir, pattern, findings) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        if (e.name.startsWith('node_modules') || e.name.startsWith('.git') || e.name.startsWith('dist') || e.name === 'build')
            continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            scanDirectory(full, pattern, findings);
        }
        else {
            if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
                scanOneFile(full, findings);
            }
        }
    }
}
function createEmptyFindings() { return []; }
function scanOneFile(filePath, findings) {
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
        // skip unreadable files
    }
}
program.parseAsync(process.argv).catch(err => {
    console.error(chalk.default.red('Fatal CLI error:'), err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map