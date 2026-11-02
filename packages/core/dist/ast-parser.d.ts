import * as t from '@babel/types';
import { ParsedFile } from './types';
export declare function parseFile(filePath: string, source: string): ParsedFile;
export declare function expressionToString(node: t.Node | null | undefined): string;
export declare function extractVariablesFromExpression(expr: string): string[];
//# sourceMappingURL=ast-parser.d.ts.map