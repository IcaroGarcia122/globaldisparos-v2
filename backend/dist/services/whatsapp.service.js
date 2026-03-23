"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
class WhatsAppService {
    constructor() {
        const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081')
            .replace('localhost', '127.0.0.1');
        const apiKey = process.env.EVOLUTION_API_KEY || '';
        this.client = axios_1.default.create({
            baseURL,
            headers: { apikey: apiKey, 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        this.client.interceptors.response.use((r) => r, (err) => {
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            logger_1.default.warn(`[Evolution] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${err.response?.status}: ${msg}`);
            // Preservar err.response no erro rejeitado (não criar new Error que perde response)
            err._evMsg = msg;
            return Promise.reject(err);
        });
    }
    // ─── INSTÂNCIAS ──────────────────────────────────────────────────────────────
    async fetchInstances() {
        const res = await this.client.get('/instance/fetchInstances');
        const list = Array.isArray(res.data) ? res.data : (res.data?.value || []);
        return list.map((item) => {
            const inst = item.instance || item;
            return {
                instanceName: inst.instanceName || inst.name,
                status: inst.state || inst.status || inst.connectionStatus || 'close',
                ownerJid: inst.owner || inst.ownerJid || null,
                ...inst,
            };
        });
    }
    async createInstance(name) {
        const webhookUrl = process.env.WEBHOOK_URL || 'http://host.docker.internal:3001/api/webhook/evolution';
        const events = ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'GROUPS_UPSERT', 'GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE', 'MESSAGES_UPSERT'];
        // v2.3.6: webhook no create + QR retorna direto no qrcode.base64
        const res = await this.client.post('/instance/create', {
            instanceName: name,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            rejectCall: false,
            groupsIgnore: false,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false,
            syncFullHistory: true,
            webhook: {
                url: webhookUrl,
                byEvents: false,
                base64: false,
                events,
            },
        });
        return res.data;
    }
    async connectInstance(name) {
        const res = await this.client.get(`/instance/connect/${name}`);
        return res.data;
    }
    async getInstanceState(name) {
        try {
            const res = await this.client.get(`/instance/connectionState/${name}`);
            return res.data?.instance?.state || res.data?.state || 'close';
        }
        catch {
            return 'close';
        }
    }
    async logoutInstance(name) {
        try {
            await this.client.delete(`/instance/logout/${name}`);
        }
        catch { /* ignora */ }
    }
    async deleteInstance(name) {
        try {
            await this.client.delete(`/instance/delete/${name}`);
        }
        catch { /* ignora */ }
    }
    async registerWebhook(name) {
        const webhookUrl = process.env.WEBHOOK_URL || 'http://host.docker.internal:3001/api/webhook/evolution';
        const events = ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'GROUPS_UPSERT', 'GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE', 'MESSAGES_UPSERT'];
        // Evolution v2.3.x: corpo com campo "webhook" aninhado
        const body = {
            webhook: {
                enabled: true,
                url: webhookUrl,
                webhookByEvents: false,
                webhookBase64: false,
                events,
            }
        };
        try {
            await this.client.post(`/webhook/set/${name}`, body);
            logger_1.default.info(`[Evolution] Webhook registrado para ${name}`);
        }
        catch (err) {
            // Tentar formato alternativo (v1 / versões antigas)
            try {
                await this.client.post(`/webhook/set/${name}`, {
                    url: webhookUrl,
                    webhook_by_events: false,
                    events,
                });
                logger_1.default.info(`[Evolution] Webhook registrado para ${name} (formato v1)`);
            }
            catch (err2) {
                logger_1.default.warn(`[Evolution] Webhook registration failed for ${name}: ${err2.message}`);
            }
        }
    }
    // ─── MENSAGENS ───────────────────────────────────────────────────────────────
    async sendText(instanceName, number, text) {
        // Normaliza número para formato WhatsApp brasileiro
        let phone = number.replace(/\D/g, '');
        // Remove 55 do início se tiver para reprocessar
        if (phone.startsWith('55') && phone.length > 11)
            phone = phone.slice(2);
        // Adiciona 9 se for fixo (10 dígitos) 
        if (phone.length === 10)
            phone = phone.slice(0, 2) + '9' + phone.slice(2);
        // Adiciona 55 se não tiver
        if (phone.length === 11)
            phone = '55' + phone;
        const res = await this.client.post(`/message/sendText/${instanceName}`, {
            number: phone,
            text,
        });
        return res.data;
    }
    // ─── GRUPOS ──────────────────────────────────────────────────────────────────
    /**
     * Extrai grupos via /chat/findChats — rápido mas sem subject.
     * Depois tenta enriquecer nomes via /chat/findMessages de cada grupo.
     */
    async fetchGroups(instanceName) {
        // Verificar se sessão está ativa antes de tentar buscar grupos
        try {
            const state = await this.getInstanceState(instanceName);
            if (state !== 'open') {
                logger_1.default.warn(`[Evolution] ${instanceName} não está conectado (state=${state}) — não buscando grupos`);
                return [];
            }
        }
        catch {
            logger_1.default.warn(`[Evolution] ${instanceName} offline — não buscando grupos`);
            return [];
        }
        // Evolution v2: fetchAllGroups usa banco PostgreSQL — resposta instantânea
        try {
            logger_1.default.info(`[Evolution] fetchAllGroups (v2 via DB): ${instanceName}`);
            // v2.3.6: GET com timeout generoso (pode demorar 30-60s)
            const res = await this.client.get(`/group/fetchAllGroups/${instanceName}?getParticipants=false`, { timeout: 120000 });
            const raw = Array.isArray(res.data) ? res.data : (res.data?.groups || res.data?.value || []);
            const groups = raw.filter((g) => (g.id || g.jid || '').includes('@g.us'))
                .map((g) => ({
                id: g.id || g.jid,
                subject: g.subject || g.name || g.pushName || `Grupo ${(g.id || g.jid || '').slice(-8)}`,
                size: g.size || g.participants?.length || 0,
            }));
            logger_1.default.info(`[Evolution] ${groups.length} grupos via fetchAllGroups`);
            return groups;
        }
        catch (err) {
            logger_1.default.warn(`[Evolution] fetchAllGroups falhou (${err.message}) — tentando findChats`);
        }
        // Fallback v1: findChats (sem nome)
        try {
            const res = await this.client.get(`/chat/findChats/${instanceName}`, { timeout: 30000 });
            const raw = Array.isArray(res.data) ? res.data : (res.data?.value || []);
            const groups = raw
                .filter((c) => (c.id || '').includes('@g.us'))
                .map((c) => ({
                id: c.id,
                subject: c.subject || c.name || `Grupo ${c.id.slice(-8)}`,
                size: c.size || 0,
            }));
            logger_1.default.info(`[Evolution] ${groups.length} grupos via findChats (fallback)`);
            return groups;
        }
        catch (err) {
            logger_1.default.warn(`[Evolution] findChats falhou: ${err.message}`);
            return [];
        }
    }
    /**
     * Busca nomes de grupos via última mensagem de cada um.
     * O payload de mensagem contém o subject do grupo remetente.
     */
    async enrichGroupNamesViaMessages(instanceName, instanceId, prismaClient) {
        const semNome = await prismaClient.whatsAppGroup.findMany({
            where: { instanceId, name: { startsWith: 'Grupo ' } },
            select: { groupId: true },
            take: 200,
        });
        if (!semNome.length)
            return;
        logger_1.default.info(`[Evolution] Buscando nomes via mensagens para ${semNome.length} grupos...`);
        let updated = 0;
        const BATCH = 5;
        for (let i = 0; i < semNome.length; i += BATCH) {
            const batch = semNome.slice(i, i + BATCH);
            await Promise.all(batch.map(async (g) => {
                try {
                    const res = await this.client.post(`/chat/findMessages/${instanceName}`, { where: { key: { remoteJid: g.groupId } }, limit: 1 }, { timeout: 5000 });
                    const msgs = res.data?.messages?.records || res.data?.records || res.data || [];
                    const first = Array.isArray(msgs) ? msgs[0] : null;
                    // Tenta extrair nome do grupo do payload da mensagem
                    const name = first?.pushName || first?.participant?.pushName ||
                        first?.message?.extendedTextMessage?.contextInfo?.pushName ||
                        first?.key?.participant;
                    if (name && name.length > 1 && !name.includes('@')) {
                        await prismaClient.whatsAppGroup.updateMany({
                            where: { instanceId, groupId: g.groupId },
                            data: { name },
                        });
                        updated++;
                    }
                }
                catch { /* ignora */ }
            }));
            await new Promise(r => setTimeout(r, 300));
        }
        logger_1.default.info(`[Evolution] Nomes via mensagens: ${updated}/${semNome.length} atualizados`);
    }
    /**
     * FASE 2 — background: enriquece nomes dos grupos que ficaram sem nome real.
     * Usa /group/findGroupInfos/{instance}/{jid} (path param, não query string).
     * Processa 5 por vez com 500ms de delay entre lotes.
     */
    async enrichGroupNames(instanceName, instanceId, prismaClient) {
        const groups = await prismaClient.whatsAppGroup.findMany({
            where: { instanceId, name: { startsWith: 'Grupo ' } },
            select: { groupId: true },
        });
        if (!groups.length) {
            logger_1.default.info(`[Evolution] Todos os grupos já têm nome real — enriquecimento desnecessário`);
            return;
        }
        logger_1.default.info(`[Evolution] Enriquecendo ${groups.length} grupos sem nome para ${instanceName}`);
        let updated = 0;
        const BATCH = 5;
        const DELAY = 500;
        for (let i = 0; i < groups.length; i += BATCH) {
            const batch = groups.slice(i, i + BATCH);
            await Promise.all(batch.map(async (g) => {
                try {
                    // IMPORTANTE: path param, não query string
                    const r = await this.client.get(`/group/findGroupInfos/${instanceName}/${encodeURIComponent(g.groupId)}`, { timeout: 8000 });
                    const data = r.data;
                    if (data?.subject) {
                        await prismaClient.whatsAppGroup.updateMany({
                            where: { instanceId, groupId: g.groupId },
                            data: { name: data.subject, participantsCount: data.size || 0 },
                        });
                        updated++;
                    }
                }
                catch { /* ignora timeouts/404 — grupo será mantido com nome provisório */ }
            }));
            if (i + BATCH < groups.length) {
                await new Promise(r => setTimeout(r, DELAY));
            }
        }
        logger_1.default.info(`[Evolution] Enriquecimento: ${updated}/${groups.length} grupos atualizados`);
    }
    /**
     * Busca participantes — compatível com v1 e v2
     */
    async getGroupParticipants(instanceName, groupJid) {
        // Tentar endpoint direto por grupo primeiro (mais rápido)
        try {
            const res = await this.client.get(`/group/findParticipants/${instanceName}?groupJid=${groupJid}`, { timeout: 10000 });
            const data = res.data;
            const participants = data?.participants || data?.members || (Array.isArray(data) ? data : []);
            if (participants.length > 0) {
                logger_1.default.info(`[Evolution] ${participants.length} participantes via findParticipants`);
                return participants;
            }
        }
        catch { /* endpoint não existe nesta versão */ }
        // Fallback: fetchAllGroups com timeout maior (busca todos de uma vez)
        try {
            logger_1.default.info(`[Evolution] Buscando participantes via fetchAllGroups para ${groupJid}`);
            const res = await this.client.get(`/group/fetchAllGroups/${instanceName}?getParticipants=true`, { timeout: 180000 } // 3 minutos — busca todos os grupos de uma vez
            );
            const raw = Array.isArray(res.data) ? res.data : (res.data?.groups || []);
            const group = raw.find((g) => (g.id || g.jid) === groupJid);
            if (group?.participants?.length > 0) {
                logger_1.default.info(`[Evolution] ${group.participants.length} participantes via fetchAllGroups`);
                return group.participants;
            }
        }
        catch (err) {
            logger_1.default.warn(`[Evolution] fetchAllGroups falhou: ${err?.response?.status || err.message}`);
        }
        return [];
    }
    /** Busca TODOS os grupos com participantes de uma vez e salva no banco */
    async syncAllGroupParticipants(instanceName) {
        try {
            logger_1.default.info(`[Evolution] Sincronizando participantes de todos os grupos para ${instanceName}...`);
            const res = await this.client.get(`/group/fetchAllGroups/${instanceName}?getParticipants=true`, { timeout: 180000 });
            const raw = Array.isArray(res.data) ? res.data : (res.data?.groups || []);
            const withParticipants = raw.filter((g) => g.participants?.length > 0);
            logger_1.default.info(`[Evolution] ${withParticipants.length}/${raw.length} grupos com participantes`);
            return { synced: withParticipants.length, failed: raw.length - withParticipants.length };
        }
        catch (err) {
            logger_1.default.warn(`[Evolution] syncAllGroupParticipants falhou: ${err.message}`);
            return { synced: 0, failed: 0 };
        }
    }
    /** Retorna grupos onde a instância tem role de admin/superadmin */
    async getGroupsWhereAdmin(instanceName, ownerPhoneFromDb) {
        // Evolution v2.3.6: getParticipants=true retorna 404
        // Usar getParticipants=false (funciona) + filtrar pelo campo "owner" do grupo
        // owner = criador do grupo, sempre é admin/superadmin
        try {
            const ownerPhone = (ownerPhoneFromDb || '').replace(/[^0-9]/g, '');
            if (!ownerPhone) {
                logger_1.default.warn(`[AdminGroups] ownerPhone vazio para ${instanceName}`);
                return [];
            }
            const res = await this.client.get(`/group/fetchAllGroups/${instanceName}?getParticipants=false`, { timeout: 60000 });
            const raw = Array.isArray(res.data) ? res.data : (res.data?.groups || res.data?.value || []);
            logger_1.default.info(`[AdminGroups] ${raw.length} grupos obtidos para "${instanceName}" (phone: ${ownerPhone})`);
            if (!raw.length)
                return [];
            // Log diagnóstico na primeira chamada
            const first = raw.find((g) => (g.id || g.jid || '').includes('@g.us'));
            if (first)
                logger_1.default.info(`[AdminGroups] Campos disponíveis: ${Object.keys(first).join(', ')}`);
            const suffix = ownerPhone.slice(-8); // últimos 8 dígitos para comparar
            const adminGroups = [];
            for (const g of raw) {
                const gid = g.id || g.jid || '';
                if (!gid.includes('@g.us'))
                    continue;
                // Campo owner: "554299538607@s.whatsapp.net" ou "55429...@c.us"
                const ownerJid = (g.owner || g.ownerJid || '').replace(/[^0-9]/g, '');
                const isOwner = ownerJid.endsWith(suffix);
                // Criador = dono = sempre admin. Admins não-criadores não detectáveis sem participants.
                if (isOwner) {
                    adminGroups.push({
                        groupId: gid,
                        name: g.subject || g.name || gid.slice(-12),
                        participantsCount: g.size || 0,
                    });
                }
            }
            logger_1.default.info(`[AdminGroups] ${adminGroups.length} grupos onde ${ownerPhone} é owner/admin`);
            return adminGroups;
        }
        catch (err) {
            logger_1.default.error(`[AdminGroups] Erro: ${err?.response?.status || err.message}`);
            return [];
        }
    }
    /** Adiciona participantes a um grupo via Evolution API — com fallback por link de convite */
    async addParticipants(instanceName, groupJid, participants) {
        const baseURL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
        const apiKey = process.env.EVOLUTION_API_KEY || '';
        const headers = { 'Content-Type': 'application/json', 'apikey': apiKey };
        // ── Método 1: updateParticipant (direto) ─────────────────────────────────
        const directUrl = `${baseURL}/group/updateParticipant/${instanceName}?groupJid=${groupJid}`;
        const directBody = JSON.stringify({
            action: 'add',
            participants: participants.map(p => p.includes('@') ? p : `${p}@s.whatsapp.net`),
        });
        logger_1.default.info(`[AddParticipants] Tentando direto: POST ${directUrl}`);
        try {
            const res = await fetch(directUrl, { method: 'POST', headers, body: directBody });
            const text = await res.text();
            logger_1.default.info(`[AddParticipants] Direto HTTP ${res.status}: ${text.slice(0, 400)}`);
            if (res.ok) {
                let data = {};
                try {
                    data = JSON.parse(text);
                }
                catch { }
                const results = Array.isArray(data) ? data : (data?.updateParticipants || []);
                if (results.length > 0) {
                    const success = [];
                    const failed = [];
                    for (const r of results) {
                        const jid = r?.jid || '';
                        const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
                        const st = String(r?.status || r?.content?.attrs?.error || '');
                        const ok = st === '200' || st === '0';
                        (ok ? success : failed).push(phone || jid);
                    }
                    logger_1.default.info(`[AddParticipants] Direto: ${success.length} ok, ${failed.length} falhas`);
                    return { success, failed };
                }
                // Resposta vazia = sucesso
                return { success: participants, failed: [] };
            }
            logger_1.default.warn(`[AddParticipants] Direto retornou ${res.status} — tentando link de convite`);
        }
        catch (e) {
            logger_1.default.warn(`[AddParticipants] Direto falhou: ${e.message} — tentando link de convite`);
        }
        // ── Método 2: Buscar link de convite e enviar para cada número ────────────
        // Funciona mesmo quando updateParticipant não existe na versão
        logger_1.default.info(`[AddParticipants] Usando link de convite para ${groupJid}`);
        try {
            const inviteRes = await fetch(`${baseURL}/group/inviteCode/${instanceName}?groupJid=${groupJid}`, { headers });
            const inviteText = await inviteRes.text();
            logger_1.default.info(`[AddParticipants] InviteCode HTTP ${inviteRes.status}: ${inviteText.slice(0, 200)}`);
            if (!inviteRes.ok)
                throw new Error(`InviteCode HTTP ${inviteRes.status}`);
            let inviteData = {};
            try {
                inviteData = JSON.parse(inviteText);
            }
            catch { }
            const inviteCode = inviteData?.inviteCode || inviteData?.code || inviteData?.invite_code || '';
            if (!inviteCode)
                throw new Error('Link de convite não retornado');
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            logger_1.default.info(`[AddParticipants] Link: ${inviteLink}`);
            // Enviar o link para cada número
            const success = [];
            const failed = [];
            for (const phone of participants) {
                const number = phone.replace(/\D/g, '');
                try {
                    const msgBody = JSON.stringify({ number: `${number}@s.whatsapp.net`, text: `Você foi convidado para um grupo! Acesse: ${inviteLink}` });
                    const msgRes = await fetch(`${baseURL}/message/sendText/${instanceName}`, { method: 'POST', headers, body: msgBody });
                    if (msgRes.ok) {
                        success.push(number);
                        logger_1.default.info(`[AddParticipants] ✉️  Convite enviado para ${number}`);
                    }
                    else {
                        failed.push(number);
                    }
                }
                catch {
                    failed.push(number);
                }
            }
            logger_1.default.info(`[AddParticipants] Convite: ${success.length} enviados, ${failed.length} falhas`);
            return { success, failed };
        }
        catch (e) {
            logger_1.default.warn(`[AddParticipants] Link de convite falhou: ${e.message}`);
            return { success: [], failed: participants };
        }
    }
}
// Instância singleton
const whatsappServiceInstance = new WhatsAppService();
// Expor o cliente para uso interno nas rotas
whatsappServiceInstance.getEvolutionClient = function () {
    return this.client;
};
exports.default = whatsappServiceInstance;
//# sourceMappingURL=whatsapp.service.js.map