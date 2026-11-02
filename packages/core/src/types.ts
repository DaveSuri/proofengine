export interface InvariantAnnotation {
  type: 'invariant' | 'boundary';
  expression: string;
  raw: string;
  line: number;
  column: number;
}

export interface BoundaryConstraint {
  variable: string;
  lower?: number;
  upper?: number;
  greaterThan?: number;
  lessThan?: number;
  notEqual?: number;
  raw: string;
}

export interface SymbolicVariable {
  name: string;
  type: 'Real' | 'Int' | 'Bool';
  source: 'annotation' | 'code' | 'derived';
}

export interface BranchAssignment {
  variable: string;
  trueExpr?: string;
  falseExpr?: string;
}

export interface ControlFlowBranch {
  id: string;
  condition: string;
  line: number;
  truePath: string[];
  falsePath: string[];
  assignments?: BranchAssignment[];
}

export interface ParsedFile {
  filePath: string;
  source: string;
  invariants: InvariantAnnotation[];
  boundaries: InvariantAnnotation[];
  variables: SymbolicVariable[];
  branches: ControlFlowBranch[];
  arithmeticNodes: ArithmeticNode[];
}

export interface ArithmeticNode {
  id: string;
  operation:
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | 'assign'
    | 'max'
    | 'min'
    | 'floor'
    | 'round'
    | 'ceil'
    | 'abs'
    | 'ite'
    | 'raw';
  operands: string[];
  result?: string;
  line: number;
  rawExpression?: string;
  condition?: string;
}

export interface SMTConstraint {
  statement: string;
  source: 'invariant' | 'boundary' | 'code' | 'branch';
  line?: number;
}

export interface SMTProgram {
  declarations: string[];
  assertions: string[];
  checkSat: string;
  variables: SymbolicVariable[];
  constraints: SMTConstraint[];
  rawSmtLib: string;
  targetInvariant?: string;
}

export type SolverResultStatus = 'PROVEN' | 'VIOLATION' | 'UNKNOWN' | 'ERROR';

export interface Counterexample {
  variable: string;
  value: number | boolean | string;
  type: string;
}

export interface StructuredCounterexample {
  inputs: Record<string, number | boolean | string>;
  computed?: Record<string, number | boolean | string>;
  drift: number;
}

export interface VerificationResult {
  status: SolverResultStatus;
  statusLabel?: string;
  invariant?: string;
  proofJwt?: string;
  counterexamples?: Counterexample[];
  counterexampleObject?: StructuredCounterexample;
  counterexampleSummary?: string;
  constraintsCount: number;
  variablesCount: number;
  durationMs: number;
  errorMessage?: string;
  smtDebug?: string;
}
