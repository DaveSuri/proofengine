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
exports.hashContent = hashContent;
exports.signProofJWT = signProofJWT;
exports.verifyProofJWT = verifyProofJWT;
const jwt = __importStar(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const DEFAULT_PROOF_SECRET = process.env.PROOFENGINE_PROOF_SECRET ||
    'proofengine-dev-secret-change-in-production-32bytes!';
function hashContent(content) {
    return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
}
function signProofJWT(payload) {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
        ...payload,
        sub: 'proofengine.verification',
        iat: now,
        jti: 'proof_' + hashContent(payload.invariant + String(now)).slice(0, 24),
        nonce: hashContent(Math.random().toString() + payload.invariant).slice(0, 16),
    };
    return jwt.sign(fullPayload, DEFAULT_PROOF_SECRET, {
        algorithm: 'HS256',
    });
}
function verifyProofJWT(token) {
    try {
        const decoded = jwt.verify(token, DEFAULT_PROOF_SECRET, { algorithms: ['HS256'] });
        return decoded;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=proof-jwt.js.map