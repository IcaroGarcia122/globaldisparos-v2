import IORedis from 'ioredis';
export declare function getRedis(): IORedis | null;
export declare function connectRedis(): Promise<void>;
export declare const cache: {
    get(key: string): Promise<any>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    keys(pattern: string): Promise<string[]>;
};
//# sourceMappingURL=redis.d.ts.map