#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export declare const server: Server<{
    method: string;
    params?: import("zod").objectOutputType<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{
            progressToken: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            progressToken: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            progressToken: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
        }, import("zod").ZodTypeAny, "passthrough">>>;
    }, import("zod").ZodTypeAny, "passthrough"> | undefined;
}, {
    method: string;
    params?: import("zod").objectOutputType<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, import("zod").ZodTypeAny, "passthrough"> | undefined;
}, import("zod").objectOutputType<{
    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
}, import("zod").ZodTypeAny, "passthrough">>;
export declare function toolVerifyInvariants(args: Record<string, unknown>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
}>;
export declare function toolPurchaseSubscription(args: Record<string, unknown>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
}>;
export declare function toolCheckQuota(args: Record<string, unknown>): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
export declare function toolScanFinancialCode(args: Record<string, unknown>): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
//# sourceMappingURL=index.d.ts.map