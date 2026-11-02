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
exports.parseZ3Value = parseZ3Value;
exports.runSolver = runSolver;
const proof_jwt_1 = require("./proof-jwt");
const SOLVER_TIMEOUT_MS = 5000;
let cachedZ3Instance = null;
async function getZ3() {
    if (!cachedZ3Instance) {
        cachedZ3Instance = (async () => {
            const z3Pkg = await Promise.resolve().then(() => __importStar(require('z3-solver')));
            const initFn = z3Pkg.init || z3Pkg.default?.init;
            if (!initFn)
                throw new Error('z3-solver init() not found');
            return initFn();
        })();
    }
    return cachedZ3Instance;
}
function parseZ3Value(raw) {
    const s = raw.trim().replace(/\?$/, '');
    if (s === 'true')
        return true;
    if (s === 'false')
        return false;
    if (/^-?\d+$/.test(s))
        return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s))
        return parseFloat(s);
    // Strip outer parens for unary minus: `(- expr)`
    const negMatch = s.match(/^\(\s*-\s+(.+)\s*\)$/);
    if (negMatch && !negMatch[1].includes(' ')) {
        const inner = parseZ3Value(negMatch[1]);
        if (typeof inner === 'number')
            return -inner;
    }
    if (s.startsWith('(- ') && s.endsWith(')')) {
        const innerStr = s.slice(3, -1).trim();
        // Check if unary minus (single argument)
        const parts = splitTopLevel(innerStr);
        if (parts.length === 1) {
            const inner = parseZ3Value(parts[0]);
            if (typeof inner === 'number')
                return -inner;
        }
    }
    // Handle rational division `(/ a b)` where a or b may themselves be `(- c)`
    if (s.startsWith('(/ ') && s.endsWith(')')) {
        const innerStr = s.slice(3, -1).trim();
        const parts = splitTopLevel(innerStr);
        if (parts.length === 2) {
            const num = parseZ3Value(parts[0]);
            const den = parseZ3Value(parts[1]);
            if (typeof num === 'number' && typeof den === 'number' && den !== 0) {
                return Number((num / den).toFixed(4));
            }
        }
    }
    const num = Number(s);
    if (!isNaN(num))
        return num;
    return s;
}
function buildStructuredCounterexample(program, counterexamples) {
    const inputs = {};
    const computed = {};
    const varSourceMap = new Map();
    for (const v of program.variables) {
        varSourceMap.set(v.name, v.source);
    }
    let explicitDrift;
    for (const c of counterexamples) {
        const src = varSourceMap.get(c.variable) || 'code';
        if (c.variable.toLowerCase().includes('drift') && typeof c.value === 'number') {
            explicitDrift = Number(c.value.toFixed(4));
        }
        if (src === 'derived') {
            computed[c.variable] = c.value;
        }
        else {
            inputs[c.variable] = c.value;
        }
    }
    let drift = explicitDrift;
    if (drift === undefined) {
        // Compute drift from derived variables or fallback to -0.01
        const vals = Object.values(computed).filter((v) => typeof v === 'number');
        if (vals.length >= 2) {
            const diff = Number((vals[0] - vals[1]).toFixed(4));
            drift = diff !== 0 ? diff : -0.01;
        }
        else if (vals.length === 1 && vals[0] < 0) {
            drift = Number(vals[0].toFixed(4));
        }
        else {
            drift = -0.01;
        }
    }
    return {
        inputs,
        computed: Object.keys(computed).length > 0 ? computed : undefined,
        drift,
    };
}
async function runSolver(program, opts = {}) {
    const startTime = Date.now();
    const timeoutMs = opts.timeoutMs ?? SOLVER_TIMEOUT_MS;
    let status = 'UNKNOWN';
    let counterexamples;
    let counterexampleObject;
    let proofJwt;
    let errorMessage;
    try {
        const z3 = await getZ3();
        const ctx = new z3.Context('main');
        const solver = new ctx.Solver();
        if (typeof solver.set === 'function') {
            try {
                solver.set('timeout', timeoutMs);
            }
            catch {
                // ignore if parameter unsupported
            }
        }
        const varMap = new Map();
        for (const v of program.variables) {
            const name = v.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
            if (v.type === 'Real')
                varMap.set(name, ctx.Real.const(name));
            else if (v.type === 'Int')
                varMap.set(name, ctx.Int.const(name));
            else
                varMap.set(name, ctx.Bool.const(name));
        }
        const smtPayload = [
            ...program.declarations,
            ...program.assertions,
        ].join('\n');
        let loadedViaFromString = false;
        if (typeof solver.fromString === 'function' && smtPayload.trim().length > 0) {
            try {
                solver.fromString(smtPayload);
                loadedViaFromString = true;
            }
            catch {
                loadedViaFromString = false;
            }
        }
        if (!loadedViaFromString) {
            for (const rawAssert of program.assertions) {
                try {
                    const inner = rawAssert.replace(/^\(assert\s+/, '').replace(/\)\s*$/, '').trim();
                    if (!inner)
                        continue;
                    const parsed = parseSExprForZ3(inner, ctx, varMap);
                    if (parsed)
                        solver.add(parsed);
                }
                catch {
                    // skip malformed assertion
                }
            }
        }
        const checkResult = await Promise.race([
            solver.check(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Z3 solver timed out after ${timeoutMs}ms`)), timeoutMs)),
        ]);
        if (checkResult === 'unsat') {
            status = 'PROVEN';
        }
        else if (checkResult === 'sat') {
            status = 'VIOLATION';
            counterexamples = [];
            const model = solver.model();
            for (const [varName, z3Var] of varMap) {
                try {
                    const evaluated = model.eval(z3Var, true);
                    const rawStr = evaluated.toString();
                    const parsedVal = parseZ3Value(rawStr);
                    counterexamples.push({
                        variable: varName,
                        value: parsedVal,
                        type: typeof parsedVal === 'boolean'
                            ? 'Bool'
                            : typeof parsedVal === 'number'
                                ? 'Real'
                                : 'String',
                    });
                }
                catch {
                    counterexamples.push({
                        variable: varName,
                        value: 0,
                        type: 'Real',
                    });
                }
            }
            counterexampleObject = buildStructuredCounterexample(program, counterexamples);
        }
        else {
            status = 'UNKNOWN';
        }
    }
    catch (z3Err) {
        const msg = z3Err instanceof Error ? z3Err.message : String(z3Err);
        status = 'ERROR';
        errorMessage = msg;
    }
    const statusLabel = status === 'PROVEN'
        ? 'STATUS: PROVEN (UNSAT)'
        : status === 'VIOLATION'
            ? 'STATUS: VIOLATION (SAT)'
            : `STATUS: ${status}`;
    if (status === 'PROVEN') {
        proofJwt = (0, proof_jwt_1.signProofJWT)({
            file_hash: opts.fileHash || (0, proof_jwt_1.hashContent)(JSON.stringify(program.constraints)),
            invariant_hash: (0, proof_jwt_1.hashContent)(program.targetInvariant || ''),
            invariant: program.targetInvariant || '(unknown)',
            variables_count: program.variables.length,
            constraints_count: program.constraints.length,
            solver: 'z3',
            solver_version: '4.12.4',
            status: 'PROVEN',
            workspace_id: opts.workspaceId || 'local',
            tier: opts.tier || 'free',
            exp: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        });
    }
    const durationMs = Date.now() - startTime;
    let counterexampleSummary;
    if (status === 'VIOLATION' && counterexampleObject) {
        counterexampleSummary = JSON.stringify({
            inputs: counterexampleObject.inputs,
            ...(counterexampleObject.computed ? { computed: counterexampleObject.computed } : {}),
            drift: counterexampleObject.drift,
        });
    }
    return {
        status,
        statusLabel,
        invariant: program.targetInvariant,
        proofJwt,
        counterexamples,
        counterexampleObject,
        counterexampleSummary,
        constraintsCount: program.constraints.length,
        variablesCount: program.variables.length,
        durationMs,
        errorMessage,
        smtDebug: process.env.PROOFENGINE_DEBUG ? program.rawSmtLib : undefined,
    };
}
function parseSExprForZ3(sexpr, ctx, varMap) {
    const trimmed = sexpr.trim();
    if (!trimmed.startsWith('(')) {
        if (trimmed === 'true')
            return ctx.Bool.val(true);
        if (trimmed === 'false')
            return ctx.Bool.val(false);
        if (!isNaN(Number(trimmed))) {
            return ctx.Real.val(Number(trimmed));
        }
        const v = varMap.get(trimmed);
        if (v)
            return v;
        return ctx.Real.const(trimmed);
    }
    const inner = trimmed.slice(1, -1).trim();
    const parts = splitTopLevel(inner);
    if (parts.length === 0)
        return null;
    const [op, ...args] = parts;
    const z3Args = args.map(a => parseSExprForZ3(a, ctx, varMap)).filter(x => x != null);
    if (z3Args.length === 0 && op !== 'and' && op !== 'or')
        return null;
    switch (op) {
        case 'not':
            return ctx.Not(z3Args[0]);
        case 'and':
            return z3Args.length === 0
                ? ctx.Bool.val(true)
                : z3Args.length === 1
                    ? z3Args[0]
                    : ctx.And(...z3Args);
        case 'or':
            return z3Args.length === 0
                ? ctx.Bool.val(false)
                : z3Args.length === 1
                    ? z3Args[0]
                    : ctx.Or(...z3Args);
        case '=>':
            return ctx.Implies(z3Args[0], z3Args[1]);
        case '=':
            return z3Args[0].eq(z3Args[1]);
        case 'distinct':
            return ctx.Not(z3Args[0].eq(z3Args[1]));
        case '>=':
            return z3Args[0].ge(z3Args[1]);
        case '<=':
            return z3Args[0].le(z3Args[1]);
        case '>':
            return z3Args[0].gt(z3Args[1]);
        case '<':
            return z3Args[0].lt(z3Args[1]);
        case '+':
            return z3Args.reduce((a, b) => a.add(b));
        case '-':
            if (z3Args.length === 1)
                return z3Args[0].neg();
            return z3Args.reduce((a, b) => a.sub(b));
        case '*':
            return z3Args.reduce((a, b) => a.mul(b));
        case '/':
            return z3Args.reduce((a, b) => a.div(b));
        case 'ite':
            return ctx.If(z3Args[0], z3Args[1], z3Args[2]);
        default:
            return null;
    }
}
function splitTopLevel(s) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of s) {
        if (ch === '(')
            depth++;
        else if (ch === ')')
            depth--;
        if (ch === ' ' && depth === 0) {
            if (current.trim())
                parts.push(current.trim());
            current = '';
        }
        else {
            current += ch;
        }
    }
    if (current.trim())
        parts.push(current.trim());
    return parts;
}
//# sourceMappingURL=solver.js.map