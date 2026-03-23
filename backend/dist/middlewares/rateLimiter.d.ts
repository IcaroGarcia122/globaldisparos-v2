/** Rate limit global — 500 req / 15min, polling isento */
export declare const globalLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** Rate limit de auth — 20 logins / 15min */
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** Rate limit de webhooks — muito permissivo */
export declare const webhookLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map