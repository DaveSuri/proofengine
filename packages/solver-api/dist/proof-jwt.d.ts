export interface ProofPayload {
    sub: 'proofengine.verification';
    jti: string;
    iat: number;
    exp: number;
    file_hash: string;
    invariant_hash: string;
    invariant: string;
    variables_count: number;
    constraints_count: number;
    solver: 'z3';
    solver_version: string;
    status: 'PROVEN';
    workspace_id: string;
    tier: 'free' | 'dev-pro' | 'enterprise';
    nonce: string;
}
export declare function hashContent(content: string): string;
export declare function signProofJWT(payload: Omit<ProofPayload, 'sub' | 'iat' | 'jti' | 'nonce'>): string;
export declare function verifyProofJWT(token: string): ProofPayload | null;
//# sourceMappingURL=proof-jwt.d.ts.map