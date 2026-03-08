/**
 * webhookStartup.ts
 * Registra webhooks na Evolution API para todas as instâncias ativas.
 * Chamado automaticamente no startup do servidor.
 */
import axios from 'axios';
import { WhatsAppInstance } from '../models';
import logger from './logger';

const getEvolutionUrl = () =>
  (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8081').replace('localhost', '127.0.0.1');
const getApiKey = () => process.env.EVOLUTION_API_KEY || '';
const getWebhookUrl = () =>
  process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhook/evolution';

const WEBHOOK_EVENTS = ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'CONTACTS_UPDATE', 'MESSAGES_UPSERT'];

export async function registerWebhookForInstance(instanceId: number): Promise<void> {
  const name = `instance_${instanceId}`;
  try {
    await axios.post(
      `${getEvolutionUrl()}/webhook/set/${name}`,
      { url: getWebhookUrl(), webhook_by_events: true, events: WEBHOOK_EVENTS },
      { headers: { apikey: getApiKey() }, timeout: 10000 }
    );
    logger.info(`✅ [WEBHOOK] Webhook registrado: ${name} → ${getWebhookUrl()}`);
  } catch (err: any) {
    logger.warn(`⚠️ [WEBHOOK] Falha ao registrar ${name}: ${err.message}`);
  }
}

export async function runWebhookStartup(): Promise<void> {
  logger.info('🚀 [WEBHOOK-STARTUP] Sincronizando instâncias com Evolution API...');

  try {
    // 1. Busca instâncias na Evolution
    const res = await axios.get(
      `${getEvolutionUrl()}/instance/fetchInstances`,
      { headers: { apikey: getApiKey() }, timeout: 15000 }
    );
    const evolutionList: any[] = res.data?.value || res.data || [];
    const evolutionMap = new Map<string, any>();
    for (const item of evolutionList) {
      const inst = item.instance || item;
      evolutionMap.set(inst.instanceName, inst);
    }
    logger.info(`📡 [WEBHOOK-STARTUP] ${evolutionMap.size} instâncias na Evolution`);

    // 2. Busca instâncias ativas no banco
    const dbInstances = await WhatsAppInstance.findAll({ where: { isActive: true } });
    logger.info(`📋 [WEBHOOK-STARTUP] ${dbInstances.length} instâncias no banco`);

    for (const instance of dbInstances) {
      const evolutionName = `instance_${instance.id}`;
      const evolutionInst = evolutionMap.get(evolutionName);

      if (!evolutionInst) {
        // Não existe na Evolution — marca desconectada
        if (instance.status !== 'disconnected') {
          await instance.update({ status: 'disconnected', qrCode: null });
          logger.warn(`🔴 [WEBHOOK-STARTUP] ${evolutionName} ausente na Evolution → desconectada`);
        }
        continue;
      }

      // Existe na Evolution — registra webhook
      await registerWebhookForInstance(instance.id);

      // Sincroniza status
      const evStatus = evolutionInst.status;
      if (evStatus === 'open') {
        const owner = evolutionInst.owner?.replace('@s.whatsapp.net', '') || instance.phoneNumber;
        await instance.update({
          status: 'connected',
          qrCode: null,
          ...(owner ? { phoneNumber: owner } : {})
        });
        logger.info(`✅ [WEBHOOK-STARTUP] ${evolutionName} conectada${owner ? ` (${owner})` : ''}`);
      } else if (instance.status === 'connected') {
        await instance.update({ status: 'disconnected', qrCode: null });
        logger.warn(`🔴 [WEBHOOK-STARTUP] ${evolutionName} fechada → desconectada`);
      }
    }

    logger.info('✅ [WEBHOOK-STARTUP] Sincronização concluída');
  } catch (err: any) {
    logger.error(`❌ [WEBHOOK-STARTUP] Erro: ${err.message}`);
  }
}