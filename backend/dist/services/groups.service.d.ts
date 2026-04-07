export declare function saveGroupsFromWebhook(instanceId: number, rawGroups: any[]): Promise<number>;
export declare function getGroups(instanceId: number): Promise<{
    groups: any[];
    source: string;
}>;
export declare function syncGroupsBackground(instanceId: number, delayMs?: number): Promise<void>;
/**
 * Sincroniza participantes de todos os grupos via UMA única chamada fetchAllGroups?getParticipants=true.
 * Muito mais rápido que chamar grupo por grupo.
 */
export declare function syncAllParticipants(instanceId: number, instanceName: string): Promise<void>;
export declare function isSyncing(instanceId: number): boolean;
export declare function getSyncProgress(instanceId: number): string | null;
export declare function getParticipants(instanceId: number, groupJid: string): Promise<{
    participants: string[];
    admins: string[];
    total: number;
    source: string;
    cachedAt: any;
} | {
    participants: string[];
    admins: string[];
    total: number;
    source: string;
    cachedAt?: undefined;
}>;
//# sourceMappingURL=groups.service.d.ts.map