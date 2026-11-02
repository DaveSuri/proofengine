export interface QuotaState {
    workspaceId: string;
    tier: 'free' | 'dev-pro' | 'enterprise';
    usedThisMonth: number;
    monthlyLimit: number;
    unverifiedCount: number;
    resetAt: number;
    priceUsd?: number;
}
export declare const FREE_QUOTA = 10;
export declare const DEV_PRO_PRICE = 49;
export declare function getWorkspaceId(): string;
export declare function getQuota(workspaceId?: string): QuotaState;
export declare function resetQuota(workspaceId?: string): QuotaState;
export interface PaymentRequiredError {
    status: 'PAYMENT_REQUIRED';
    tier: 'dev-pro';
    price_usd: number;
    approval_prompt: string;
    http_code: 402;
    message: string;
    workspace_id: string;
    remaining_attempts: number;
    unverified_edge_cases: number;
    upgrade_url: string;
}
export declare function checkQuotaAndConsume(workspaceId?: string, unverifiedEdgeCases?: number): {
    ok: true;
    quota: QuotaState;
} | {
    ok: false;
    error: PaymentRequiredError;
};
export declare function purchaseSubscription(tier: 'dev-pro' | 'enterprise', autoApprove?: boolean, workspaceId?: string): {
    success: boolean;
    tier: string;
    monthlyLimit: number;
    message: string;
    checkout_url?: string;
    transaction_id?: string;
};
//# sourceMappingURL=quota.d.ts.map