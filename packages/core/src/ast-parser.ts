import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { Project } from 'ts-morph';
import {
  ParsedFile,
  SymbolicVariable,
  ControlFlowBranch,
  ArithmeticNode,
  BranchAssignment,
} from './types';
import { parseAnnotations } from './invariant-parser';

let branchIdCounter = 0;
let arithmeticIdCounter = 0;

const traverseFn: typeof traverse =
  typeof (traverse as any).default === 'function' ? (traverse as any).default : traverse;

export function parseFile(filePath: string, source: string): ParsedFile {
  branchIdCounter = 0;
  arithmeticIdCounter = 0;

  const { invariants, boundaries } = parseAnnotations(source);
  const variables: SymbolicVariable[] = [];
  const branches: ControlFlowBranch[] = [];
  const arithmeticNodes: ArithmeticNode[] = [];
  const seenVariables = new Set<string>();

  function addVariable(
    name: string,
    type: SymbolicVariable['type'],
    varSource: SymbolicVariable['source'],
  ) {
    if (!name || ['Math', 'Number', 'Stripe', 'Promise', 'Object', 'Array', 'JSON', 'console'].includes(name)) {
      return;
    }
    const existingIdx = variables.findIndex(v => v.name === name);
    if (existingIdx === -1) {
      seenVariables.add(name);
      variables.push({ name, type, source: varSource });
    } else if (variables[existingIdx].source === 'annotation' && varSource !== 'annotation') {
      variables[existingIdx].source = varSource;
    }
  }

  // Use ts-morph to extract TypeScript function parameters and variable declarations first
  try {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile(filePath || 'virtual.ts', source, { overwrite: true });
    for (const fn of sf.getFunctions()) {
      for (const param of fn.getParameters()) {
        const paramName = param.getName();
        const typeText = param.getTypeNode()?.getText() || 'number';
        if (typeText.includes('boolean')) {
          addVariable(paramName, 'Bool', 'code');
        } else if (typeText.includes('number')) {
          addVariable(paramName, 'Real', 'code');
        }
      }
    }
  } catch {
    // Fallback to Babel traversal below
  }

  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    for (const inv of invariants) {
      extractVariablesFromExpression(inv.expression).forEach(v => addVariable(v, 'Real', 'annotation'));
    }
    for (const b of boundaries) {
      extractVariablesFromExpression(b.expression).forEach(v => addVariable(v, 'Real', 'annotation'));
    }
    return {
      filePath,
      source,
      invariants,
      boundaries,
      variables,
      branches,
      arithmeticNodes,
    };
  }

  function extractFunctionParams(params: Array<t.Node>) {
    for (const p of params) {
      if (t.isIdentifier(p)) {
        const typeAnn = t.isTSTypeAnnotation(p.typeAnnotation) ? p.typeAnnotation.typeAnnotation : null;
        if (typeAnn && t.isTSStringKeyword(typeAnn)) continue;
        const symType: SymbolicVariable['type'] =
          typeAnn && t.isTSBooleanKeyword(typeAnn) ? 'Bool' : 'Real';
        addVariable(p.name, symType, 'code');
      } else if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) {
        if (t.isStringLiteral(p.right)) continue;
        const symType: SymbolicVariable['type'] = t.isBooleanLiteral(p.right) ? 'Bool' : 'Real';
        addVariable(p.left.name, symType, 'code');
      }
    }
  }

  function recordVariableInit(varName: string, init: t.Expression, line: number) {
    addVariable(varName, 'derived' === 'derived' ? 'Real' : 'Real', 'derived');

    if (t.isNumericLiteral(init)) {
      arithmeticNodes.push({
        id: `arith_const_${++arithmeticIdCounter}`,
        operation: 'raw',
        operands: [String(init.value)],
        result: varName,
        line,
        rawExpression: String(init.value),
      });
      return;
    }

    if (t.isUnaryExpression(init) && init.operator === '-' && t.isNumericLiteral(init.argument)) {
      const valStr = `-${init.argument.value}`;
      arithmeticNodes.push({
        id: `arith_const_${++arithmeticIdCounter}`,
        operation: 'raw',
        operands: [valStr],
        result: varName,
        line,
        rawExpression: valStr,
      });
      return;
    }

    if (t.isIdentifier(init)) {
      addVariable(init.name, 'Real', 'code');
      arithmeticNodes.push({
        id: `arith_copy_${++arithmeticIdCounter}`,
        operation: 'raw',
        operands: [init.name],
        result: varName,
        line,
        rawExpression: init.name,
      });
      return;
    }

    if (t.isConditionalExpression(init)) {
      const condStr = expressionToString(init.test);
      const trueStr = expressionToString(init.consequent);
      const falseStr = expressionToString(init.alternate);
      const allVars = [
        ...extractVariablesFromExpression(condStr),
        ...extractVariablesFromExpression(trueStr),
        ...extractVariablesFromExpression(falseStr),
      ];
      allVars.forEach(v => addVariable(v, 'Real', 'code'));
      arithmeticNodes.push({
        id: `arith_ite_${++arithmeticIdCounter}`,
        operation: 'ite',
        operands: [trueStr, falseStr],
        condition: condStr,
        result: varName,
        line,
        rawExpression: `(${condStr} ? ${trueStr} : ${falseStr})`,
      });
      return;
    }

    if (t.isCallExpression(init)) {
      // Handle Math.floor / Math.round / Math.ceil / Math.abs / Math.max / Math.min
      if (
        t.isMemberExpression(init.callee) &&
        t.isIdentifier(init.callee.object, { name: 'Math' }) &&
        t.isIdentifier(init.callee.property)
      ) {
        const fnName = init.callee.property.name;
        const args = init.arguments.map(a => expressionToString(a));
        args.forEach(a =>
          extractVariablesFromExpression(a).forEach(v => addVariable(v, 'Real', 'code')),
        );
        if (['max', 'min'].includes(fnName) && args.length >= 2) {
          arithmeticNodes.push({
            id: `arith_assign_${++arithmeticIdCounter}`,
            operation: fnName as 'max' | 'min',
            operands: args,
            result: varName,
            line,
            rawExpression: `Math.${fnName}(${args.join(', ')})`,
          });
          return;
        }
        if (['floor', 'round', 'ceil', 'abs'].includes(fnName) && args.length >= 1) {
          arithmeticNodes.push({
            id: `arith_assign_${++arithmeticIdCounter}`,
            operation: fnName as 'floor' | 'round' | 'ceil' | 'abs',
            operands: [args[0]],
            result: varName,
            line,
            rawExpression: `Math.${fnName}(${args[0]})`,
          });
          return;
        }
      }

      // Handle arr.reduce((a, b) => a + b, 0) -> sum(arr)
      if (
        t.isMemberExpression(init.callee) &&
        t.isIdentifier(init.callee.object) &&
        t.isIdentifier(init.callee.property, { name: 'reduce' })
      ) {
        const arrName = init.callee.object.name;
        addVariable(arrName, 'Real', 'code');
        arithmeticNodes.push({
          id: `arith_reduce_${++arithmeticIdCounter}`,
          operation: 'raw',
          operands: [arrName],
          result: varName,
          line,
          rawExpression: arrName,
        });
        return;
      }
    }

    if (t.isBinaryExpression(init) && ['+', '-', '*', '/', '%'].includes(init.operator)) {
      const leftSimple =
        t.isIdentifier(init.left)
          ? init.left.name
          : t.isNumericLiteral(init.left)
            ? String(init.left.value)
            : null;
      const rightSimple =
        t.isIdentifier(init.right)
          ? init.right.name
          : t.isNumericLiteral(init.right)
            ? String(init.right.value)
            : null;

      const rawExpr = expressionToString(init);
      const exprVars = extractVariablesFromExpression(rawExpr);
      exprVars.forEach(v => addVariable(v, 'Real', 'code'));

      if (leftSimple !== null && rightSimple !== null) {
        arithmeticNodes.push({
          id: `arith_assign_${++arithmeticIdCounter}`,
          operation: init.operator as ArithmeticNode['operation'],
          operands: [leftSimple, rightSimple],
          result: varName,
          line,
          rawExpression: rawExpr,
        });
      } else {
        arithmeticNodes.push({
          id: `arith_assign_${++arithmeticIdCounter}`,
          operation: 'raw',
          operands: exprVars,
          result: varName,
          line,
          rawExpression: rawExpr,
        });
      }
    }
  }

  function extractBlockAssignments(block: t.Statement | null | undefined): Map<string, string> {
    const map = new Map<string, string>();
    if (!block) return map;
    const stmts = t.isBlockStatement(block) ? block.body : [block];
    for (const stmt of stmts) {
      if (t.isVariableDeclaration(stmt)) {
        for (const d of stmt.declarations) {
          if (t.isIdentifier(d.id) && d.init) {
            const expr = expressionToString(d.init);
            if (expr && expr !== '__expr__') {
              map.set(d.id.name, expr);
            }
          }
        }
      } else if (
        t.isExpressionStatement(stmt) &&
        t.isAssignmentExpression(stmt.expression) &&
        t.isIdentifier(stmt.expression.left)
      ) {
        const varName = stmt.expression.left.name;
        const rightExpr = expressionToString(stmt.expression.right);
        if (rightExpr && rightExpr !== '__expr__') {
          if (stmt.expression.operator === '=') {
            map.set(varName, rightExpr);
          } else {
            const op = stmt.expression.operator.slice(0, -1);
            map.set(varName, `(${varName} ${op} ${rightExpr})`);
          }
        }
      } else if (t.isReturnStatement(stmt) && stmt.argument) {
        const retExpr = expressionToString(stmt.argument);
        if (retExpr && retExpr !== '__expr__') {
          map.set('__return__', retExpr);
        }
      }
    }
    return map;
  }

  const branchAssignedVariables = new Set<string>();

  traverseFn(ast, {
    FunctionDeclaration(path) {
      extractFunctionParams(path.node.params);
    },
    FunctionExpression(path) {
      extractFunctionParams(path.node.params);
    },
    ArrowFunctionExpression(path) {
      extractFunctionParams(path.node.params);
    },
    IfStatement(path) {
      const condition = expressionToString(path.node.test);
      const line = path.node.loc?.start.line ?? 0;
      const branchId = `branch_${++branchIdCounter}`;

      const trueMap = extractBlockAssignments(path.node.consequent);
      const falseMap = extractBlockAssignments(path.node.alternate);
      const truePath = Array.from(trueMap.keys()).filter(k => k !== '__return__');
      const falsePath = Array.from(falseMap.keys()).filter(k => k !== '__return__');

      const allAssignedVars = new Set<string>([...truePath, ...falsePath]);
      const assignments: BranchAssignment[] = [];
      for (const v of allAssignedVars) {
        branchAssignedVariables.add(v);
        addVariable(v, 'Real', 'derived');
        const tExpr = trueMap.get(v);
        const fExpr = falseMap.get(v);
        if (tExpr) extractVariablesFromExpression(tExpr).forEach(x => addVariable(x, 'Real', 'code'));
        if (fExpr) extractVariablesFromExpression(fExpr).forEach(x => addVariable(x, 'Real', 'code'));
        assignments.push({
          variable: v,
          trueExpr: tExpr,
          falseExpr: fExpr,
        });
      }

      branches.push({
        id: branchId,
        condition,
        line,
        truePath,
        falsePath,
        assignments,
      });

      const condVars = extractVariablesFromExpression(condition);
      condVars.forEach(v => addVariable(v, 'Real', 'code'));
    },

    ConditionalExpression(path) {
      const condition = expressionToString(path.node.test);
      const line = path.node.loc?.start.line ?? 0;
      const branchId = `ternary_${++branchIdCounter}`;
      const trueExpr = expressionToString(path.node.consequent);
      const falseExpr = expressionToString(path.node.alternate);
      branches.push({
        id: branchId,
        condition,
        line,
        truePath: trueExpr ? [trueExpr] : [],
        falsePath: falseExpr ? [falseExpr] : [],
      });
      const condVars = extractVariablesFromExpression(condition);
      condVars.forEach(v => addVariable(v, 'Real', 'code'));
    },

    WhileStatement(path) {
      const condition = expressionToString(path.node.test);
      const line = path.node.loc?.start.line ?? 0;
      const branchId = `while_${++branchIdCounter}`;
      const bodyMap = extractBlockAssignments(path.node.body);
      const truePath = Array.from(bodyMap.keys()).filter(k => k !== '__return__');

      branches.push({
        id: branchId,
        condition,
        line,
        truePath,
        falsePath: [],
      });

      const condVars = extractVariablesFromExpression(condition);
      condVars.forEach(v => addVariable(v, 'Real', 'code'));

      for (const [varName, rhsExpr] of bodyMap.entries()) {
        if (varName === '__return__') continue;
        const rhsVars = extractVariablesFromExpression(rhsExpr);
        rhsVars.forEach(v => addVariable(v, 'Real', 'code'));
        // If self-referencing loop update (e.g. balance = balance - debt), record as next_<var>
        if (rhsVars.includes(varName)) {
          const nextVarName = `next_${varName}`;
          addVariable(nextVarName, 'Real', 'derived');
          arithmeticNodes.push({
            id: `arith_loop_${++arithmeticIdCounter}`,
            operation: 'raw',
            operands: rhsVars,
            result: nextVarName,
            line,
            rawExpression: rhsExpr,
          });
        }
      }
    },

    BinaryExpression(path) {
      if (['+', '-', '*', '/', '%'].includes(path.node.operator)) {
        // Avoid duplicating top-level variable declarator binary expressions that are already recorded with a result
        if (t.isVariableDeclarator(path.parent) || t.isAssignmentExpression(path.parent)) {
          return;
        }
        const operands: string[] = [];
        if (t.isIdentifier(path.node.left)) operands.push(path.node.left.name);
        else if (t.isNumericLiteral(path.node.left)) operands.push(String(path.node.left.value));
        if (t.isIdentifier(path.node.right)) operands.push(path.node.right.name);
        else if (t.isNumericLiteral(path.node.right)) operands.push(String(path.node.right.value));

        if (operands.length >= 2) {
          const line = path.node.loc?.start.line ?? 0;
          arithmeticNodes.push({
            id: `arith_${++arithmeticIdCounter}`,
            operation: path.node.operator as ArithmeticNode['operation'],
            operands,
            line,
          });
        }
      }
    },

    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && path.node.init) {
        // Skip NewExpression like `const stripe = new Stripe(...)`
        if (t.isNewExpression(path.node.init)) {
          return;
        }
        // Check if inside an IfStatement block (already handled by branch assignments)
        const inIfBranch = path.findParent(p => p.isIfStatement());
        const varName = path.node.id.name;
        const line = path.node.loc?.start.line ?? 0;
        if (!inIfBranch) {
          recordVariableInit(varName, path.node.init, line);
        } else {
          addVariable(varName, 'Real', 'derived');
        }
      }
    },

    AssignmentExpression(path) {
      if (t.isIdentifier(path.node.left)) {
        const inIfBranch = path.findParent(p => p.isIfStatement());
        const inWhileLoop = path.findParent(p => p.isWhileStatement());
        const varName = path.node.left.name;
        const line = path.node.loc?.start.line ?? 0;
        if (!inIfBranch && !inWhileLoop && path.node.operator === '=') {
          recordVariableInit(varName, path.node.right, line);
        } else {
          addVariable(varName, 'Real', 'derived');
        }
      }
    },
  });

  for (const inv of invariants) {
    const vars = extractVariablesFromExpression(inv.expression);
    vars.forEach(v => addVariable(v, 'Real', 'annotation'));
  }
  for (const b of boundaries) {
    const vars = extractVariablesFromExpression(b.expression);
    vars.forEach(v => addVariable(v, 'Real', 'annotation'));
  }

  return {
    filePath,
    source,
    invariants,
    boundaries,
    variables,
    branches,
    arithmeticNodes,
  };
}

export function expressionToString(node: t.Node | null | undefined): string {
  if (!node) return '';
  if (t.isIdentifier(node)) return node.name;
  if (t.isNumericLiteral(node)) return String(node.value);
  if (t.isStringLiteral(node)) return JSON.stringify(node.value);
  if (t.isBooleanLiteral(node)) return String(node.value);
  if (t.isBinaryExpression(node)) {
    const left = expressionToString(node.left);
    const right = expressionToString(node.right);
    const op = node.operator === '===' ? '==' : node.operator === '!==' ? '!=' : node.operator;
    return `(${left} ${op} ${right})`;
  }
  if (t.isUnaryExpression(node)) {
    const arg = expressionToString(node.argument);
    if (node.operator === '-' && t.isNumericLiteral(node.argument)) {
      return `-${arg}`;
    }
    return `(${node.operator}${arg})`;
  }
  if (t.isLogicalExpression(node)) {
    const left = expressionToString(node.left);
    const right = expressionToString(node.right);
    return `(${left} ${node.operator} ${right})`;
  }
  if (t.isConditionalExpression(node)) {
    const cond = expressionToString(node.test);
    const cons = expressionToString(node.consequent);
    const alt = expressionToString(node.alternate);
    return `(${cond} ? ${cons} : ${alt})`;
  }
  if (t.isMemberExpression(node) && t.isIdentifier(node.property)) {
    return expressionToString(node.object) + '.' + node.property.name;
  }
  if (t.isCallExpression(node)) {
    const args = node.arguments.map(a => expressionToString(a)).join(', ');
    if (t.isIdentifier(node.callee)) {
      return `${node.callee.name}(${args})`;
    }
    if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
      const obj = expressionToString(node.callee.object);
      const prop = node.callee.property.name;
      if (obj === 'Math') {
        return `${prop}(${args})`;
      }
      return `${obj}.${prop}(${args})`;
    }
  }
  if (t.isTSAsExpression(node) || t.isTSTypeAssertion(node)) {
    return expressionToString(node.expression);
  }
  if (t.isParenthesizedExpression(node)) {
    return `(${expressionToString(node.expression)})`;
  }
  return '__expr__';
}

const RESERVED_TOKENS = new Set([
  'sum',
  'in',
  'and',
  'or',
  'not',
  'true',
  'false',
  'null',
  'undefined',
  'abs',
  'min',
  'max',
  'floor',
  'ceil',
  'round',
  'math',
  'ite',
  'to_real',
  'to_int',
  'distinct',
  'when',
  'f',
]);

export function extractVariablesFromExpression(expr: string): string[] {
  const cleaned = expr
    .replace(/\bMath\.(floor|ceil|round|abs|min|max)\b/g, '$1')
    .replace(
      /\bf\s*\(\s*f\s*\(\s*[a-zA-Z0-9_]+\s*,\s*[a-zA-Z0-9_]+\s*\)\s*,\s*[a-zA-Z0-9_]+\s*\)/g,
      'f_twice',
    )
    .replace(/\bf\s*\(\s*[a-zA-Z0-9_]+\s*,\s*[a-zA-Z0-9_]+\s*\)/g, 'f_once');
  const matches = cleaned.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
  const variables: string[] = [];
  const seen = new Set<string>();
  for (const token of matches) {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token)) {
      if (!RESERVED_TOKENS.has(token.toLowerCase())) {
        if (!seen.has(token)) {
          seen.add(token);
          variables.push(token);
        }
      }
    }
  }
  return variables;
}
