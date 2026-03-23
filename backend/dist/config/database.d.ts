import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    log: ("error" | "warn" | {
        emit: "event";
        level: "query";
    })[];
}, "query", import("@prisma/client/runtime/library").DefaultArgs>;
export declare function connectDB(): Promise<void>;
export declare function disconnectDB(): Promise<void>;
export default prisma;
//# sourceMappingURL=database.d.ts.map