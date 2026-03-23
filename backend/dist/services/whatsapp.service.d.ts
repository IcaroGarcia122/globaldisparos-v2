declare class WhatsAppService {
    private client;
    constructor();
    fetchInstances(): Promise<any[]>;
    createInstance(name: string): Promise<any>;
    connectInstance(name: string): Promise<any>;
    getInstanceState(name: string): Promise<string>;
    logoutInstance(name: string): Promise<void>;
    deleteInstance(name: string): Promise<void>;
    registerWebhook(name: string): Promise<void>;
    sendText(instanceName: string, number: string, text: string): Promise<any>;
    /**
     * Extrai grupos via /chat/findChats — rápido mas sem subject.
     * Depois tenta enriquecer nomes via /chat/findMessages de cada grupo.
     */
    fetchGroups(instanceName: string): Promise<any[]>;
    /**
     * Busca nomes de grupos via última mensagem de cada um.
     * O payload de mensagem contém o subject do grupo remetente.
     */
    enrichGroupNamesViaMessages(instanceName: string, instanceId: number, prismaClient: any): Promise<void>;
    /**
     * FASE 2 — background: enriquece nomes dos grupos que ficaram sem nome real.
     * Usa /group/findGroupInfos/{instance}/{jid} (path param, não query string).
     * Processa 5 por vez com 500ms de delay entre lotes.
     */
    enrichGroupNames(instanceName: string, instanceId: number, prismaClient: any): Promise<void>;
    /**
     * Busca participantes — compatível com v1 e v2
     */
    getGroupParticipants(instanceName: string, groupJid: string): Promise<any[]>;
    /** Busca TODOS os grupos com participantes de uma vez e salva no banco */
    syncAllGroupParticipants(instanceName: string): Promise<{
        synced: number;
        failed: number;
    }>;
    /** Retorna grupos onde a instância tem role de admin/superadmin */
    getGroupsWhereAdmin(instanceName: string, ownerPhoneFromDb?: string): Promise<Array<{
        groupId: string;
        name: string;
        participantsCount: number;
    }>>;
    /** Adiciona participantes a um grupo via Evolution API — com fallback por link de convite */
    addParticipants(instanceName: string, groupJid: string, participants: string[]): Promise<{
        success: string[];
        failed: string[];
    }>;
}
declare const whatsappServiceInstance: WhatsAppService;
export default whatsappServiceInstance;
//# sourceMappingURL=whatsapp.service.d.ts.map