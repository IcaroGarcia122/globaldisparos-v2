export declare function saveGroupsFromWebhook(instanceId: number, rawGroups: any[]): Promise<number>;
export declare function getGroups(instanceId: number): Promise<{
    groups: any[];
    source: string;
}>;
export declare function syncGroupsBackground(instanceId: number, delayMs?: number): Promise<void>;
/**
 * Sincroniza participantes de todos os grupos via fetchAllGroups?getParticipants=true.
 * Prioriza p.phoneNumber (campo explícito) antes do JID — Evolution v2 pode retornar
 * @lid como p.id mas ainda incluir o número real em p.phoneNumber.
 * Ignora grupos cujo bulk retornou muito menos participantes do que o tamanho esperado
 * (indica que a maioria era @lid) para não sobrescrever dados bons com dados degradados.
 */
export declare function syncAllParticipants(instanceId: number, instanceName: string): Promise<void>;
export declare function isSyncing(instanceId: number): boolean;
export declare function getSyncProgress(instanceId: number): string | null;
/**
 * Busca participantes de um grupo.
 * ESTRATÉGIA: sempre tenta Evolution primeiro (dados frescos e corretos),
 * só usa banco como fallback se Evolution falhar/timeout.
 * Isso evita retornar dados sujos/desatualizados do cache.
 */
export declare function getParticipants(instanceId: number, groupJid: string): Promise<{
    participants: string[];
    admins: string[];
    total: number;
    source: string;
}>;
//# sourceMappingURL=groups.service.d.ts.map