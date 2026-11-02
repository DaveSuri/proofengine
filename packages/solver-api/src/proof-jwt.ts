import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const DEFAULT_PROOF_SECRET =
  process.env.PROOFENGINE_PROOF_SECRET ||
  'proofengine-dev-secret-change-in-production-32bytes!';

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

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function signProofJWT(payload: Omit<ProofPayload, 'sub' | 'iat' | 'jti' | 'nonce'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: ProofPayload = {
    ...payload,
    sub: 'proofengine.verification',
    iat: now,
    jti: 'proof_' + hashContent(payload.invariant + String(now)).slice(0, 24),
    nonce: hashContent(Math.random().toString() + payload.invariant).slice(0, 16),
  };
  return jwt.sign(fullPayload as unknown as Record<string, unknown>, DEFAULT_PROOF_SECRET, {
    algorithm: 'HS256',
  });
}

export function verifyProofJWT(token: string): ProofPayload | null {
  try {
    const decoded = jwt.verify(token, DEFAULT_PROOF_SECRET, { algorithms: ['HS256'] });
    return decoded as ProofPayload;
  } catch {
    return null;
  }
}
