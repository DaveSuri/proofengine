"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expressionToSMT = expressionToSMT;
exports.generateSMTProgram = generateSMTProgram;
exports.generateAllSMTPrograms = generateAllSMTPrograms;
const ast_parser_1 = require("./ast-parser");
function sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
}
function canonicalName(name) {
    const withUnderscores = name
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s_]+/g, '_')
        .toLowerCase();
    const words = withUnderscores.split('_').filter(Boolean).sort();
    return words.join('');
}
function resolveAlias(name, aliasMap) {
    const canon = canonicalName(name);
    if (aliasMap.has(canon)) {
        return aliasMap.get(canon);
    }
    return name;
}
function expressionToSMT(expr, aliasMap) {
    let smt = expr.trim();
    // Normalize Math.fn(...) -> fn(...)
    smt = smt.replace(/\bMath\.(floor|ceil|round|abs|min|max)\b/g, '$1');
    // Normalize idempotency functional notation: f(f(state, event_id), event_id) -> f_twice, f(state, event_id) -> f_once
    smt = smt.replace(/\bf\s*\(\s*f\s*\(\s*[a-zA-Z0-9_]+\s*,\s*[a-zA-Z0-9_]+\s*\)\s*,\s*[a-zA-Z0-9_]+\s*\)/g, 'f_twice');
    smt = smt.replace(/\bf\s*\(\s*[a-zA-Z0-9_]+\s*,\s*[a-zA-Z0-9_]+\s*\)/g, 'f_once');
    // Normalize `<consequent> when <condition>` -> `(<condition>) => (<consequent>)`
    const whenMatch = smt.match(/^(.+?)\s+when\s+(.+)$/i);
    if (whenMatch) {
        smt = `(${whenMatch[2].trim()}) => (${whenMatch[1].trim()})`;
    }
    // Normalize operators
    smt = smt.replace(/===/g, '=');
    smt = smt.replace(/!==/g, 'distinct');
    smt = smt.replace(/==/g, '=');
    smt = smt.replace(/!=/g, 'distinct');
    smt = smt.replace(/&&/g, ' and ');
    smt = smt.replace(/\|\|/g, ' or ');
    smt = smt.replace(/!(?!=)/g, 'not ');
    smt = expandChainedComparisons(smt);
    // Expand sum(...)
    smt = smt.replace(/sum\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g, (_m, a, b) => {
        const ra = aliasMap ? resolveAlias(a, aliasMap) : a;
        const rb = aliasMap ? resolveAlias(b, aliasMap) : b;
        return `(${sanitizeName(ra)} + ${sanitizeName(rb)})`;
    });
    smt = smt.replace(/sum\s*\(\s*([^)]+)\s*\)/g, (_m, inner) => {
        const parts = splitArgs(inner);
        if (parts.length === 0)
            return '0.0';
        if (parts.length === 1) {
            const p0 = parts[0].trim();
            const resolved = aliasMap ? resolveAlias(p0, aliasMap) : p0;
            return sanitizeName(resolved);
        }
        return '(' + parts.join(' + ') + ')';
    });
    // Resolve variable aliases before converting to prefix
    const varMap = new Map();
    const vars = (0, ast_parser_1.extractVariablesFromExpression)(smt);
    vars.forEach(v => {
        const resolved = aliasMap ? resolveAlias(v, aliasMap) : v;
        varMap.set(v, sanitizeName(resolved));
    });
    varMap.forEach((sanitized, original) => {
        const regex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        smt = smt.replace(regex, sanitized);
    });
    return convertToPrefix(smt);
}
function expandChainedComparisons(expr) {
    const cmpOps = ['>=', '<=', '!=', '==', '=', '>', '<'];
    let result = expr;
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
        changed = false;
        iterations++;
        for (const op1 of cmpOps) {
            for (const op2 of cmpOps) {
                const pattern = new RegExp(`([^\\s()]+)\\s+${op1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([^\\s()]+)\\s+${op2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([^\\s()]+)`, 'g');
                const newResult = result.replace(pattern, (_, a, b, c) => {
                    changed = true;
                    return `(${a} ${op1} ${b}) and (${b} ${op2} ${c})`;
                });
                if (newResult !== result) {
                    result = newResult;
                }
            }
        }
    }
    return result;
}
function splitArgs(s) {
    const args = [];
    let depth = 0;
    let current = '';
    for (const ch of s) {
        if (ch === '(')
            depth++;
        else if (ch === ')')
            depth--;
        if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
        }
        else {
            current += ch;
        }
    }
    if (current.trim())
        args.push(current.trim());
    return args;
}
function isFullyParenthesized(s) {
    if (!s.startsWith('(') || !s.endsWith(')'))
        return false;
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(')
            depth++;
        else if (s[i] === ')')
            depth--;
        if (i < s.length - 1 && depth === 0)
            return false;
    }
    return depth === 0;
}
function convertToPrefix(expr) {
    let s = expr.trim().replace(/\s+/g, ' ');
    while (isFullyParenthesized(s)) {
        const inner = s.slice(1, -1).trim();
        // Don't strip outer parens if already a prefix S-expression like `(+ a b)` or `(to_real ...)`
        if (/^(?:and|or|not|distinct|ite|to_real|to_int|>=|<=|>|<|=|\+|-|\*|\/|mod)\s/.test(inner)) {
            return s;
        }
        s = inner;
    }
    // Handle `x in [low, high]`
    s = s.replace(/\bin\s+(\[[^\]]+\])/g, (_m, range) => {
        const rangeMatch = range.match(/\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/);
        if (rangeMatch) {
            return `_IN_[${rangeMatch[1].trim()},${rangeMatch[2].trim()}]`;
        }
        return range;
    });
    // Handle ternary `cond ? trueExpr : falseExpr` at top level
    let qPos = -1;
    let cPos = -1;
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(' || s[i] === '[')
            depth++;
        else if (s[i] === ')' || s[i] === ']')
            depth--;
        else if (depth === 0) {
            if (s[i] === '?' && qPos === -1)
                qPos = i;
            else if (s[i] === ':' && qPos !== -1 && cPos === -1)
                cPos = i;
        }
    }
    if (qPos !== -1 && cPos !== -1) {
        const cond = convertToPrefix(s.slice(0, qPos).trim());
        const tBranch = convertToPrefix(s.slice(qPos + 1, cPos).trim());
        const fBranch = convertToPrefix(s.slice(cPos + 1).trim());
        return `(ite ${cond} ${tBranch} ${fBranch})`;
    }
    // Handle function call at top-level: floor(x), round(x), ceil(x), abs(x), max(a, b), min(a, b)
    const fnMatch = s.match(/^(floor|round|ceil|abs|max|min)\s*\((.*)\)$/);
    if (fnMatch && isFullyParenthesized(s.slice(fnMatch[1].length).trim())) {
        const fn = fnMatch[1];
        const args = splitArgs(fnMatch[2]).map(a => convertToPrefix(a));
        if (fn === 'floor' && args.length === 1) {
            return `(to_real (to_int ${args[0]}))`;
        }
        if (fn === 'round' && args.length === 1) {
            return `(to_real (to_int (+ ${args[0]} 0.5)))`;
        }
        if (fn === 'ceil' && args.length === 1) {
            return `(- 0.0 (to_real (to_int (- 0.0 ${args[0]}))))`;
        }
        if (fn === 'abs' && args.length === 1) {
            return `(ite (>= ${args[0]} 0.0) ${args[0]} (- 0.0 ${args[0]}))`;
        }
        if (fn === 'max' && args.length >= 2) {
            return `(ite (>= ${args[0]} ${args[1]}) ${args[0]} ${args[1]})`;
        }
        if (fn === 'min' && args.length >= 2) {
            return `(ite (<= ${args[0]} ${args[1]}) ${args[0]} ${args[1]})`;
        }
    }
    const opsByPrecedence = [
        { op: '=>', re: /=>/g },
        { op: 'or', re: /\bor\b/g },
        { op: 'and', re: /\band\b/g },
        { op: '=', re: /(?<![!<>=])=(?!=)/g },
        { op: 'distinct', re: /\bdistinct\b/g },
        { op: '<=', re: /<=/g },
        { op: '>=', re: />=/g },
        { op: '<', re: /(?<![<>=])<(?!=)/g },
        { op: '>', re: /(?<![<>=])>(?!=)/g },
        { op: '+', re: /\+/g },
        { op: '-', re: /(?<![(+\-*/<>=])\s+-\s+/g },
        { op: '*', re: /\*/g },
        { op: '/', re: /\//g },
        { op: '%', re: /%/g },
    ];
    for (const { op, re } of opsByPrecedence) {
        const positions = [];
        let match;
        const gRe = new RegExp(re.source, 'g');
        while ((match = gRe.exec(s)) !== null) {
            let d = 0;
            for (let i = 0; i < match.index; i++) {
                if (s[i] === '(' || s[i] === '[')
                    d++;
                else if (s[i] === ')' || s[i] === ']')
                    d--;
            }
            if (d === 0) {
                positions.push({ index: match.index, length: match[0].length });
            }
        }
        if (positions.length > 0) {
            const last = positions[positions.length - 1];
            const left = s.slice(0, last.index).trim();
            const right = s.slice(last.index + last.length).trim();
            if (left && right) {
                if (op === 'distinct') {
                    return `(not (= ${convertToPrefix(left)} ${convertToPrefix(right)}))`;
                }
                const smtOp = op === '%' ? 'mod' : op;
                return `(${smtOp} ${convertToPrefix(left)} ${convertToPrefix(right)})`;
            }
        }
    }
    const notMatch = s.match(/^not\s+(.+)$/i);
    if (notMatch) {
        return `(not ${convertToPrefix(notMatch[1])})`;
    }
    // Unary minus: `-x` or `-0.01`
    if (s.startsWith('-') && s.length > 1) {
        const rest = s.slice(1).trim();
        if (/^\d+(\.\d+)?$/.test(rest)) {
            return `(- ${rest})`;
        }
        return `(- 0.0 ${convertToPrefix(rest)})`;
    }
    const inMatch = s.match(/^(.+?)_IN_\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]$/);
    if (inMatch) {
        const varName = convertToPrefix(inMatch[1].trim());
        const lower = convertToPrefix(inMatch[2].trim());
        const upper = convertToPrefix(inMatch[3].trim());
        return `(and (>= ${varName} ${lower}) (<= ${varName} ${upper}))`;
    }
    return s;
}
function parseBoundary(expr, _varList, aliasMap) {
    const rangeMatch = expr.match(/(\w+)\s+in\s+\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/);
    if (rangeMatch) {
        const varName = sanitizeName(aliasMap ? resolveAlias(rangeMatch[1], aliasMap) : rangeMatch[1]);
        const lowerRaw = rangeMatch[2].trim();
        const upperRaw = rangeMatch[3].trim();
        const lowerSmt = expressionToSMT(lowerRaw, aliasMap);
        const upperSmt = expressionToSMT(upperRaw, aliasMap);
        return `(and (>= ${varName} ${lowerSmt}) (<= ${varName} ${upperSmt}))`;
    }
    return expressionToSMT(expr, aliasMap);
}
function negateInvariant(smtInvariant) {
    if (smtInvariant.startsWith('(not ') && smtInvariant.endsWith(')')) {
        return smtInvariant.slice(5, -1);
    }
    return `(not ${smtInvariant})`;
}
function generateSMTProgram(parsed, invariantIndex = 0, options = { useNegation: true }) {
    const declarations = [];
    const assertions = [];
    const aliasMap = new Map();
    // Build alias map from code and derived variables first
    for (const v of parsed.variables) {
        if (v.source !== 'annotation') {
            const canon = canonicalName(v.name);
            if (!aliasMap.has(canon)) {
                aliasMap.set(canon, v.name);
            }
        }
    }
    for (const arith of parsed.arithmeticNodes) {
        if (arith.result) {
            const canon = canonicalName(arith.result);
            if (!aliasMap.has(canon)) {
                aliasMap.set(canon, arith.result);
            }
        }
        for (const op of arith.operands) {
            for (const v of (0, ast_parser_1.extractVariablesFromExpression)(op)) {
                const canon = canonicalName(v);
                if (!aliasMap.has(canon)) {
                    aliasMap.set(canon, v);
                }
            }
        }
    }
    // Also map plural/singular or common aliases like `debits` <-> `debitSum`, `credits` <-> `creditSum`, `starting` <-> `startingBalance`, `final_charge` <-> `finalPrice`
    const codeVarNames = Array.from(aliasMap.values());
    for (const cv of codeVarNames) {
        if (cv === 'debitSum' && !aliasMap.has(canonicalName('debits'))) {
            aliasMap.set(canonicalName('debits'), 'debitSum');
        }
        if (cv === 'creditSum' && !aliasMap.has(canonicalName('credits'))) {
            aliasMap.set(canonicalName('credits'), 'creditSum');
        }
        if (cv === 'startingBalance' && !aliasMap.has(canonicalName('starting'))) {
            aliasMap.set(canonicalName('starting'), 'startingBalance');
        }
        if (cv === 'finalPrice' && !aliasMap.has(canonicalName('final_charge'))) {
            aliasMap.set(canonicalName('final_charge'), 'finalPrice');
        }
        if (cv === 'stateAfterOnce' && !aliasMap.has(canonicalName('f_once'))) {
            aliasMap.set(canonicalName('f_once'), 'stateAfterOnce');
        }
        if (cv === 'stateAfterRetry' && !aliasMap.has(canonicalName('f_twice'))) {
            aliasMap.set(canonicalName('f_twice'), 'stateAfterRetry');
        }
    }
    const allVariables = [];
    const seenVarNames = new Set();
    function registerVar(name, type, source) {
        const resolved = resolveAlias(name, aliasMap);
        const sanitized = sanitizeName(resolved);
        if (!sanitized || ['Math', 'Stripe', 'true', 'false'].includes(sanitized))
            return;
        if (!seenVarNames.has(sanitized)) {
            seenVarNames.add(sanitized);
            allVariables.push({ name: resolved, type, source });
            aliasMap.set(canonicalName(resolved), resolved);
        }
    }
    for (const v of parsed.variables) {
        if (v.source !== 'annotation') {
            registerVar(v.name, v.type, v.source);
        }
    }
    for (const arith of parsed.arithmeticNodes) {
        if (arith.condition) {
            (0, ast_parser_1.extractVariablesFromExpression)(arith.condition).forEach(v => registerVar(v, 'Real', 'code'));
        }
        for (const op of arith.operands) {
            (0, ast_parser_1.extractVariablesFromExpression)(op).forEach(v => registerVar(v, 'Real', 'code'));
        }
        if (arith.result) {
            registerVar(arith.result, 'Real', 'derived');
        }
    }
    for (const branch of parsed.branches) {
        (0, ast_parser_1.extractVariablesFromExpression)(branch.condition).forEach(v => registerVar(v, 'Real', 'code'));
        if (branch.assignments) {
            for (const a of branch.assignments) {
                registerVar(a.variable, 'Real', 'derived');
                if (a.trueExpr)
                    (0, ast_parser_1.extractVariablesFromExpression)(a.trueExpr).forEach(v => registerVar(v, 'Real', 'code'));
                if (a.falseExpr)
                    (0, ast_parser_1.extractVariablesFromExpression)(a.falseExpr).forEach(v => registerVar(v, 'Real', 'code'));
            }
        }
    }
    for (const inv of parsed.invariants) {
        (0, ast_parser_1.extractVariablesFromExpression)(inv.expression).forEach(v => registerVar(v, 'Real', 'annotation'));
    }
    for (const b of parsed.boundaries) {
        (0, ast_parser_1.extractVariablesFromExpression)(b.expression).forEach(v => registerVar(v, 'Real', 'annotation'));
    }
    for (const v of allVariables) {
        const name = sanitizeName(v.name);
        declarations.push(`(declare-const ${name} ${v.type})`);
        if (v.type === 'Real' &&
            (/(?:^|_)(?:days|seats|count|units|months|years)(?:$|_)/i.test(name) ||
                /(?:Days|Seats|Count|Units|Months|Years)$/.test(name))) {
            assertions.push({
                statement: `(assert (= ${name} (to_real (to_int ${name}))))`,
                source: 'boundary',
            });
        }
    }
    // 1. Boundary assertions
    for (const boundary of parsed.boundaries) {
        try {
            const smt = parseBoundary(boundary.expression, allVariables, aliasMap);
            if (smt) {
                assertions.push({
                    statement: `(assert ${smt})`,
                    source: 'boundary',
                    line: boundary.line,
                });
            }
        }
        catch {
            // skip malformed boundaries
        }
    }
    // 2. Code arithmetic & assignment assertions
    for (const arith of parsed.arithmeticNodes) {
        if (arith.result) {
            const resultName = sanitizeName(resolveAlias(arith.result, aliasMap));
            if (arith.operation === 'ite' && arith.condition && arith.operands.length >= 2) {
                const condSmt = expressionToSMT(arith.condition, aliasMap);
                const trueSmt = expressionToSMT(arith.operands[0], aliasMap);
                const falseSmt = expressionToSMT(arith.operands[1], aliasMap);
                assertions.push({
                    statement: `(assert (= ${resultName} (ite ${condSmt} ${trueSmt} ${falseSmt})))`,
                    source: 'branch',
                    line: arith.line,
                });
                continue;
            }
            if (['floor', 'round', 'ceil', 'abs'].includes(arith.operation) && arith.operands.length >= 1) {
                const argSmt = expressionToSMT(arith.operands[0], aliasMap);
                let rhsSmt = argSmt;
                if (arith.operation === 'floor') {
                    rhsSmt = `(to_real (to_int ${argSmt}))`;
                }
                else if (arith.operation === 'round') {
                    rhsSmt = `(to_real (to_int (+ ${argSmt} 0.5)))`;
                }
                else if (arith.operation === 'ceil') {
                    rhsSmt = `(- 0.0 (to_real (to_int (- 0.0 ${argSmt}))))`;
                }
                else if (arith.operation === 'abs') {
                    rhsSmt = `(ite (>= ${argSmt} 0.0) ${argSmt} (- 0.0 ${argSmt}))`;
                }
                assertions.push({
                    statement: `(assert (= ${resultName} ${rhsSmt}))`,
                    source: 'code',
                    line: arith.line,
                });
                continue;
            }
            if (arith.operation === 'raw' && arith.rawExpression) {
                const smtExpr = expressionToSMT(arith.rawExpression, aliasMap);
                if (smtExpr !== resultName) {
                    assertions.push({
                        statement: `(assert (= ${resultName} ${smtExpr}))`,
                        source: 'code',
                        line: arith.line,
                    });
                }
                continue;
            }
            const operands = arith.operands.map(op => {
                if (/^[a-zA-Z_]/.test(op))
                    return sanitizeName(resolveAlias(op, aliasMap));
                return op;
            });
            if (operands.length >= 2) {
                if (arith.operation === 'max') {
                    const a = expressionToSMT(arith.operands[0], aliasMap);
                    const b = expressionToSMT(arith.operands[1], aliasMap);
                    const smt = `(assert (= ${resultName} (ite (>= ${a} ${b}) ${a} ${b})))`;
                    assertions.push({ statement: smt, source: 'code', line: arith.line });
                }
                else if (arith.operation === 'min') {
                    const a = expressionToSMT(arith.operands[0], aliasMap);
                    const b = expressionToSMT(arith.operands[1], aliasMap);
                    const smt = `(assert (= ${resultName} (ite (<= ${a} ${b}) ${a} ${b})))`;
                    assertions.push({ statement: smt, source: 'code', line: arith.line });
                }
                else {
                    let opSmt = arith.operation;
                    if (opSmt === 'assign')
                        opSmt = '+';
                    if (opSmt === '%')
                        opSmt = 'mod';
                    const smt = `(assert (= ${resultName} (${opSmt} ${operands[0]} ${operands[1]})))`;
                    assertions.push({ statement: smt, source: 'code', line: arith.line });
                }
            }
        }
    }
    // 3. Control-flow branch (if/else and while loop guard) assertions
    for (const branch of parsed.branches) {
        if (branch.id.startsWith('while_') && branch.condition) {
            const condSmt = expressionToSMT(branch.condition, aliasMap);
            assertions.push({
                statement: `(assert ${condSmt})`,
                source: 'branch',
                line: branch.line,
            });
        }
        if (!branch.assignments || branch.assignments.length === 0)
            continue;
        const condSmt = expressionToSMT(branch.condition, aliasMap);
        for (const a of branch.assignments) {
            const varName = sanitizeName(resolveAlias(a.variable, aliasMap));
            if (a.trueExpr && a.falseExpr) {
                const tSmt = expressionToSMT(a.trueExpr, aliasMap);
                const fSmt = expressionToSMT(a.falseExpr, aliasMap);
                assertions.push({
                    statement: `(assert (= ${varName} (ite ${condSmt} ${tSmt} ${fSmt})))`,
                    source: 'branch',
                    line: branch.line,
                });
            }
            else if (a.trueExpr) {
                const tSmt = expressionToSMT(a.trueExpr, aliasMap);
                assertions.push({
                    statement: `(assert (=> ${condSmt} (= ${varName} ${tSmt})))`,
                    source: 'branch',
                    line: branch.line,
                });
            }
            else if (a.falseExpr) {
                const fSmt = expressionToSMT(a.falseExpr, aliasMap);
                assertions.push({
                    statement: `(assert (=> (not ${condSmt}) (= ${varName} ${fSmt})))`,
                    source: 'branch',
                    line: branch.line,
                });
            }
        }
    }
    // 4. Target invariant assertion (negated for refutation proof)
    const targetInvariant = parsed.invariants[invariantIndex];
    let invariantSMT = '';
    if (targetInvariant) {
        try {
            const positive = expressionToSMT(targetInvariant.expression, aliasMap);
            invariantSMT = options.useNegation ? negateInvariant(positive) : positive;
            assertions.push({
                statement: `(assert ${invariantSMT})`,
                source: 'invariant',
                line: targetInvariant.line,
            });
        }
        catch {
            // skip
        }
    }
    const declarationsStr = declarations.join('\n');
    const assertionsStr = assertions.map(a => a.statement).join('\n');
    const checkSat = '(check-sat)\n(get-model)';
    const rawSmtLib = `; ProofEngine SMT-LIB2 Generated Program\n; Target invariant: ${targetInvariant?.expression || '(none)'}\n; Strategy: ${options.useNegation ? 'Negate invariant, prove UNSAT for correctness' : 'Direct satisfiability check'}\n\n${declarationsStr}\n\n${assertionsStr}\n\n${checkSat}\n`;
    return {
        declarations,
        assertions: assertions.map(a => a.statement),
        checkSat,
        variables: allVariables,
        constraints: assertions,
        rawSmtLib,
        targetInvariant: targetInvariant?.expression,
    };
}
function generateAllSMTPrograms(parsed) {
    if (parsed.invariants.length === 0) {
        return [generateSMTProgram(parsed, 0)];
    }
    return parsed.invariants.map((_, i) => generateSMTProgram(parsed, i));
}
//# sourceMappingURL=smt-generator.js.map