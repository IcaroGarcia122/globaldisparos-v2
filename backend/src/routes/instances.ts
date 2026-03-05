import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { WhatsAppInstance } from '../models';
import whatsappService from '../adapters/whatsapp.config';
import evolutionService from '../services/EvolutionService';
import { io } from '../server';
import { Op } from 'sequelize';
import crypto from 'crypto';

const router = Router();

// Cache simples para respostas
const instanceListCache = new Map<string, { data: any; hash: string; timestamp: number }>();
const CACHE_DURATION = 10000; // 10 segundos

// Mapear plano para limite de instâncias
const planInstanceLimits: Record<string, number> = {
  'free': 0,           // Sem instâncias no plano gratuito
  'basic': 1,          // 1 instância (mensal)
  'pro': 3,            // 3 instâncias (trimestral)
  'enterprise': 10     // 10 instâncias (anual)
};

function generateHash(data: any): string {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

/**
 * Iniciar polling contínuo do QR Code para uma instância
 * Atualiza via Socket.IO a cada 3 segundos
 */
function startQRPolling(
  instanceName: string,
  instanceId: number,
  userId: number,
  socketId?: string
): void {
  let attempts = 0;
  const maxAttempts = 40; // ~2 minutos de tentativas
  let pollingInterval: NodeJS.Timeout | null = null;
  let lastQRCode: string | null = null;
  let sameQRCount = 0; // Se mesmo QR por 3x, provavelmente está esperando scan

  async function poll() {
    attempts++;
    console.log(`[QR-POLLING] Tentativa ${attempts}/${maxAttempts} para ${instanceName}`);
    
    if (attempts > maxAttempts) {
      if (pollingInterval) clearInterval(pollingInterval);
      console.log(`[QR-POLLING] ⏰ Timeout após ${attempts} tentativas para ${instanceName}`);
      io.to(socketId || `user-${userId}`).emit('qr_timeout', { instanceName, instanceId });
      return;
    }

    try {
      // 1. Verificar se já está conectado
      const state = await evolutionService.getConnectionState(instanceName);
      console.log(`[QR-POLLING] Estado: ${state || 'unknown'}`);
      
      if (state === 'open' || state === 'connected' || state === 'CONNECTED') {
        if (pollingInterval) clearInterval(pollingInterval);
        console.log(`[QR-POLLING] ✅ Instância ${instanceName} conectada!`);
        
        // Atualizar banco
        await WhatsAppInstance.update(
          { status: 'connected', qrCode: null },
          { where: { id: instanceId } }
        );
        
        io.to(socketId || `user-${userId}`).emit('whatsapp_connected', {
          instanceName,
          instanceId,
          status: 'open'
        });
        return;
      }

      // 2. Obter QR Code atual
      const qrCode = await evolutionService.fetchQRCode(instanceName);
      console.log(`[QR-POLLING] QR válido? ${!!qrCode}`);
      
      if (qrCode) {
        // Verificar se é diferente do anterior
        if (qrCode === lastQRCode) {
          sameQRCount++;
          console.log(`[QR-POLLING] QR repetido: ${sameQRCount}x`);
        } else {
          sameQRCount = 0;
          lastQRCode = qrCode;
        }

        // Sempre emitir (pode ter sido atualizado)
        io.to(socketId || `user-${userId}`).emit('qr_update', {
          qrCode,
          instanceName,
          instanceId,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn(`[QR-POLLING] Sem QR retornado para ${instanceName}`);
      }
    } catch (err: any) {
      console.error(`[QR-POLLING] Erro:`, err.message);
    }
  }

  // Iniciar polling a cada 3 segundos
  pollingInterval = setInterval(poll, 3000);
  console.log(`[QR-POLLING] ✅ Polling iniciado para ${instanceName}`);
  
  // Executar primeira vez imediatamente
  poll();
}

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, accountAge } = req.body;
    const userId = req.user!.id;
    const userPlan = req.user!.plan;
    const userRole = req.user!.role;
    const socketId = req.headers['x-socket-id'] as string;
    
    console.log(`🔧 POST /instances - User ${userId} (${userRole}), plan: ${userPlan}, name: "${name}"`);
    
    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Nome da instância é obrigatório' });
    }

    if (accountAge !== undefined && (typeof accountAge !== 'number' || accountAge < 0)) {
      return res.status(400).json({ error: 'Idade da conta deve ser um número positivo' });
    }
    
    // Admin tem limite infinito
    if (userRole === 'admin') {
      console.log(`👑 Admin ${userId} criando instância - SEM LIMITE`);
    } else {
      // Obter limite de instâncias baseado no plano (apenas usuários normais)
      const instanceLimit = planInstanceLimits[userPlan] || 0;
      
      // Verificar limite de instâncias ativas por plano
      const activeCount = await WhatsAppInstance.count({
        where: {
          userId,
          isActive: true
        }
      });

      console.log(`📊 User plan "${userPlan}" has ${activeCount}/${instanceLimit} active instances`);

      if (activeCount >= instanceLimit) {
        const planNames: Record<string, string> = {
          'free': 'Gratuito (sem instâncias)',
          'basic': 'Básico (1 instância)',
          'pro': 'Profissional (3 instâncias)',
          'enterprise': 'Empresarial (10 instâncias)'
        };
        
        return res.status(409).json({ 
          error: `Você atingiu o limite de instâncias para seu plano ${planNames[userPlan] || userPlan}. Você tem ${activeCount}/${instanceLimit} instâncias ativas.` 
        });
      }
    }

    console.log(`✅ Criando instância: ${name.trim()}`);
    const instance = await WhatsAppInstance.create({
      userId,
      name: name.trim(),
      accountAge: accountAge || 0,
      isActive: true
    });
    
    console.log(`✅ Instância criada: ID ${instance.id}`);
    
    // Invalidar cache
    Array.from(instanceListCache.keys()).forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        instanceListCache.delete(key);
      }
    });
    console.log(`🔄 Cache invalidado para user ${userId}`);
    
    // Responder imediatamente
    res.status(201).json({
      id: instance.id,
      name: instance.name,
      userId: instance.userId,
      isActive: instance.isActive,
      status: 'pending',
      message: 'Instância criada. Aguardando QR Code...'
    });

    // IMPORTANTE: Iniciar processo de conexão em BACKGROUND
    setImmediate(async () => {
      try {
        // 1. Criar no Evolution API
        const instanceName = `instance_${instance.id}`;
        console.log(`🔗 Criando na Evolution API: ${instanceName}`);
        
        await evolutionService.createInstance(instanceName);
        console.log(`✅ Evolution API instância criada`);

        // 2. Aguardar um pouco para inicializar
        await new Promise(r => setTimeout(r, 2000));

        // 3. Iniciar polling do QR Code
        console.log(`🔄 Iniciando polling do QR Code para ${instanceName}`);
        startQRPolling(instanceName, instance.id, userId, socketId);

      } catch (error: any) {
        console.error(`❌ Erro no processo de conexão:`, error.message);
        io.to(socketId || `user-${userId}`).emit('instance_error', {
          instanceId: instance.id,
          error: error.message,
          status: 'failed'
        });
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar instância:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao criar instância' });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const includeInactive = req.query.all === 'true';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    
    // ============================================
    // AUTO-LIMPEZA: Remover instâncias inativas
    // ============================================
    try {
      const inactiveCount = await WhatsAppInstance.count({
        where: {
          userId,
          isActive: false
        }
      });
      
      if (inactiveCount > 0) {
        console.log(`🧹 Auto-limpeza: Removendo ${inactiveCount} instâncias inativas para user ${userId}`);
        await WhatsAppInstance.destroy({
          where: {
            userId,
            isActive: false
          }
        });
        
        // Invalidar cache após limpeza
        Array.from(instanceListCache.keys()).forEach(key => {
          if (key.startsWith(`${userId}:`)) {
            instanceListCache.delete(key);
          }
        });
      }
    } catch (cleanupError: any) {
      console.error('⚠️ Erro na auto-limpeza:', cleanupError.message);
      // Não falha a requisição se a limpeza falhar
    }
    
    // Cache key
    const cacheKey = `${userId}:${includeInactive}:${page}:${limit}`;
    const cached = instanceListCache.get(cacheKey);
    const now = Date.now();
    
    // Check if cache is still valid
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      res.set('X-Cache', 'HIT');
      res.set('ETag', cached.hash);
      return res.json(cached.data);
    }
    
    const where: any = {
      userId: userId,
    };
    
    if (!includeInactive) {
      where.isActive = true;
    }
    
    const { count, rows } = await WhatsAppInstance.findAndCountAll({ 
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });
    
    const response = {
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    };
    
    // Generate hash and cache
    const hash = generateHash(response);
    instanceListCache.set(cacheKey, { data: response, hash, timestamp: now });
    
    res.set('X-Cache', 'MISS');
    res.set('ETag', hash);
    res.set('Cache-Control', 'private, max-age=10');
    res.json(response);
  } catch (error: any) {
    console.error('❌ Erro ao listar instâncias:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET single instance details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const instanceId = Number(req.params.id);
    
    const instance = await WhatsAppInstance.findByPk(instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }
    
    // Log de verificação de proprietário (debug mode - remove em produção)
    if (instance.userId !== req.user!.id) {
      console.log(`⚠️  Instância ${instanceId} owned by ${instance.userId}, accessed by ${req.user!.id}`);
    }
    
    res.json({
      id: instance.id,
      name: instance.name,
      phoneNumber: instance.phoneNumber,
      status: instance.status,
      qrCode: instance.qrCode,
      connected: instance.status === 'connected',
      connectedAt: instance.connectedAt,
      lastMessageAt: instance.lastMessageAt,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar instância:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/qr', authenticate, async (req: AuthRequest, res) => {
  try {
    const instanceId = Number(req.params.id);
    const userId = req.user!.id;
    
    console.log(`[QR-ROUTE] 🔍 Busca de QR para instância ${instanceId}, usuário ${userId}`);
    
    const instance = await WhatsAppInstance.findByPk(instanceId);
    
    if (!instance) {
      console.log(`[QR-ROUTE] ❌ Instância ${instanceId} não encontrada no banco`);
      return res.status(404).json({ error: 'Instância não encontrada' });
    }
    
    // Log detalhado de verificação de proprietário
    console.log(`[QR-ROUTE] Verificação: instance.userId=${instance.userId}, req.user!.id=${userId}`);
    
    if (instance.userId !== userId) {
      console.log(`[QR-ROUTE] ⚠️ AVISO: Instância pertence a user ${instance.userId}, mas solicitação de ${userId}`);
      console.log(`[QR-ROUTE] Permitindo acesso mesmo assim para testes...`);
      // Temporariamente permitindo para debug - remover em produção!
      // return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // 1. Verifica se já tem conexão estabelecida
    if (instance.status === 'connected' && instance.connectedAt) {
      console.log(`[QR-ROUTE] ✅ WhatsApp já conectado com sucesso`);
      res.set('Cache-Control', 'public, max-age=60');
      return res.json({ 
        qrCode: null, 
        status: 'connected', 
        connectedAt: instance.connectedAt,
        message: 'WhatsApp conectado' 
      });
    }

    // 2. Tenta obter QR code do cache/banco
    let qrCode = whatsappService.getQRCode(instanceId);
    
    // 3. Se não tem QR code, tenta fazer refresh
    if (!qrCode) {
      console.log(`[QR-ROUTE] 🔄 QR Code não em cache, tentando refresh...`);
      try {
        qrCode = await whatsappService.refreshQRCode(instanceId);
        if (qrCode) {
          console.log(`[QR-ROUTE] ✅ QR Code obtido via refresh`);
        }
      } catch (error: any) {
        console.warn(`[QR-ROUTE] ⚠️ Erro ao fazer refresh:`, error.message);
      }
    }
    
    // 4. Se tem QR code agora, retorna
    if (qrCode) {
      console.log(`[QR-ROUTE] ✅ QR Code pronto para ${instanceId}`);
      res.set('Cache-Control', 'private, max-age=5');
      res.set('ETag', `"qr-${instanceId}-${Date.now()}"`);
      return res.json({ 
        qrCode, 
        status: 'pending', 
        message: 'QR Code pronto - escaneie com seu WhatsApp' 
      });
    }
    
    // 5. Se não conseguiu QR code, retorna status de aguardo
    console.log(`[QR-ROUTE] ⏳ Aguardando QR Code para ${instanceId}`);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({ 
      qrCode: null, 
      status: 'awaiting', 
      message: 'Aguardando geração do QR Code... Tente novamente em alguns segundos',
      retryAfter: 2 // segundos
    });
    
  } catch (error: any) {
    console.error(`[QR-ROUTE] ❌ Erro:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/connect', authenticate, async (req: AuthRequest, res) => {
  const instanceId = Number(req.params.id);
  
  try {
    console.log(`[CONNECT] Iniciando para instância ${instanceId}`);
    
    // Valida instância
    const instance = await WhatsAppInstance.findByPk(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }
    
    // Log de verificação de proprietário (debug mode - remove em produção)
    if (instance.userId !== req.user!.id) {
      console.log(`⚠️  Instância ${instanceId} owned by ${instance.userId}, accessed by ${req.user!.id}`);
    }
    
    console.log(`[CONNECT] Chamando whatsappService.connect(${instanceId})`);
    
    // Conecta
    await whatsappService.connect(instanceId);
    
    console.log(`[CONNECT] Sucesso para instância ${instanceId}`);
    res.json({ message: 'Conectando... Escaneie o QR Code' });
  } catch (error: any) {
    console.error(`[CONNECT] Erro:`, error.message);
    
    res.status(500).json({ 
      error: `Erro ao conectar: ${error.message}`
    });
  }
});

router.post('/cleanup/inactive', authenticate, async (req: AuthRequest, res) => {
  try {
    // Delete todas as instâncias inativas do usuário
    const result = await WhatsAppInstance.destroy({
      where: {
        userId: req.user!.id,
        isActive: false
      }
    });

    res.json({ 
      message: `${result} instância(s) inativa(s) removida(s)`,
      deletedCount: result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  console.log('\n========== DELETE ROUTE INICIADO ==========');
  try {
    const instanceId = req.params.id;
    const userId = req.user!.id;
    
    console.log(`[1] 🗑️ DELETE INICIADO`);
    console.log(`    Instância ID: ${instanceId}`);
    console.log(`    Usuário ID: ${userId}`);
    
    // Soft delete: apenas marca como inativo
    console.log(`[2] 🔍 Procurando instância no banco...`);
    const instance = await WhatsAppInstance.findOne({
      where: {
        id: instanceId,
        userId: userId
      }
    });

    if (!instance) {
      console.log(`[2] ❌ ERRO: Instância não encontrada`);
      console.log(`    ID procurado: ${instanceId}`);
      console.log(`    Usuário: ${userId}`);
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    console.log(`[3] ✅ Instância encontrada`);
    console.log(`    Nome: ${instance.name}`);
    console.log(`    Status atual: ${instance.status}`);
    
    console.log(`[4] 🔌 Removendo conexão da memória...`);
    try {
      await whatsappService.removeConnection(Number(instanceId));
      console.log(`[4] ✅ Conexão removida da memória`);
    } catch (removeError: any) {
      console.log(`[4] ⚠️ Erro ao remover conexão (continuando): ${removeError.message}`);
    }

    console.log(`[5] 🔌 Desconectando WebSocket...`);
    try {
      await whatsappService.disconnect(Number(instanceId));
      console.log(`[5] ✅ Disconnect realizado`);
    } catch (disconnectError: any) {
      console.log(`[5] ⚠️ Erro ao desconectar: ${disconnectError.message}`);
    }
    
    console.log(`[6] 💾 Atualizando banco - isActive = false...`);
    await instance.update({ isActive: false });
    console.log(`[6] ✅ Banco atualizado`);
    console.log(`    isActive agora é: ${instance.isActive}`);
    
    console.log(`[7] 📤 Enviando resposta 200 OK`);
    res.json({ message: 'Instância desconectada e removida' });
    
    console.log(`[8] ✅ DELETE COMPLETADO COM SUCESSO`);
    console.log('========== FIM DO DELETE ROUTE ==========\n');
    
  } catch (error: any) {
    console.log(`\n❌ ❌ ❌ ERRO NO DELETE ROUTE ❌ ❌ ❌`);
    console.log(`Tipo de erro: ${error.constructor.name}`);
    console.log(`Mensagem: ${error.message}`);
    console.log(`Stack:\n${error.stack}`);
    console.log(`Data: ${new Date().toISOString()}`);
    console.log('========== FIM DO ERRO ==========\n');
    
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LIMPEZA AUTOMÁTICA - Validar limite do plano
// ============================================
router.post('/cleanup/validate-plan-limit', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userPlan = req.user!.plan;
    const instanceLimit = planInstanceLimits[userPlan] || 0;
    
    console.log(`🔄 Validando limite de plano para user ${userId} (${userPlan})`);
    
    // Buscar todas as instâncias ativas
    const activeInstances = await WhatsAppInstance.findAll({
      where: {
        userId,
        isActive: true
      },
      order: [['createdAt', 'ASC']] // Antigas primeiro
    });
    
    console.log(`   Total de ativas: ${activeInstances.length}, Limite: ${instanceLimit}`);
    
    // Se tiver mais do que o limite permite, deletar as extras
    if (activeInstances.length > instanceLimit) {
      const instancesToDelete = activeInstances.slice(instanceLimit);
      const idsToDelete = instancesToDelete.map(i => i.id);
      
      console.log(`   ⚠️ Deletando ${instancesToDelete.length} instâncias excedentes: ${idsToDelete.join(', ')}`);
      
      await WhatsAppInstance.destroy({
        where: {
          id: {
            [Op.in]: idsToDelete
          }
        }
      });
      
      // Invalidar cache
      Array.from(instanceListCache.keys()).forEach(key => {
        if (key.startsWith(`${userId}:`)) {
          instanceListCache.delete(key);
        }
      });
    }
    
    // Contar de novo após limpeza
    const finalCount = await WhatsAppInstance.count({
      where: {
        userId,
        isActive: true
      }
    });
    
    console.log(`   ✅ Validação completa. Instâncias ativas finais: ${finalCount}/${instanceLimit}`);
    
    res.json({
      success: true,
      plan: userPlan,
      limit: instanceLimit,
      currentInstances: finalCount,
      cleaned: activeInstances.length > instanceLimit ? activeInstances.length - instanceLimit : 0
    });
  } catch (error: any) {
    console.error('❌ Erro na validação:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DEBUG ROUTE - Listar TODAS instâncias
// ============================================
router.get('/debug/all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // Buscar todas as instâncias (ativas e inativas)
    const allInstances = await WhatsAppInstance.findAll({
      where: { userId },
      raw: true
    });
    
    // Contar ativas vs inativas
    const activeCount = allInstances.filter(i => i.isActive === true).length;
    const inactiveCount = allInstances.filter(i => i.isActive === false).length;
    
    console.log(`\n🔍 DEBUG - User ${userId}:`);
    console.log(`   Plan: ${req.user!.plan}`);
    console.log(`   Ativas: ${activeCount}, Inativas: ${inactiveCount}, Total: ${allInstances.length}`);
    console.log(`   Instâncias:`, allInstances.map(i => ({ id: i.id, name: i.name, isActive: i.isActive })));
    
    res.json({
      userId,
      plan: req.user!.plan,
      summary: {
        active: activeCount,
        inactive: inactiveCount,
        total: allInstances.length
      },
      instances: allInstances.map(i => ({
        id: i.id,
        name: i.name,
        status: i.status,
        isActive: i.isActive,
        createdAt: i.createdAt,
        connectedAt: i.connectedAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CLEANUP ROUTE - Deletar instâncias inativas
// ============================================
router.delete('/debug/cleanup-inactive', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // Buscar e deletar instâncias inativas
    const deleted = await WhatsAppInstance.destroy({
      where: {
        userId,
        isActive: false
      }
    });
    
    console.log(`🧹 Deletadas ${deleted} instâncias inativas para user ${userId}`);
    
    res.json({ 
      message: `${deleted} instâncias inativas foram deletadas`,
      deletedCount: deleted
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FORCE CLEANUP - Deletar TODAS instâncias
// ============================================
router.delete('/debug/force-cleanup-all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // Buscar primeiro (para log)
    const instances = await WhatsAppInstance.findAll({ where: { userId } });
    console.log(`⚠️ FORCE CLEANUP - User ${userId}: Deletando ${instances.length} instâncias...`);
    
    // Deletar todas
    const deleted = await WhatsAppInstance.destroy({
      where: { userId }
    });
    
    console.log(`✅ DELETADAS ${deleted} instâncias`);
    
    res.json({ 
      message: `⚠️ ${deleted} instâncias foram PERMANENTEMENTE deletadas`,
      deletedCount: deleted,
      warning: 'Esta ação não pode ser desfeita!'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN-ONLY: Deletar TODAS as instâncias de TODOS os usuários
router.delete('/admin/delete-all-instances', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    // Verificar se é admin
    if (userRole !== 'admin') {
      console.log(`❌ Acesso negado: User ${userId} tentou deletar todas as instâncias (${userRole})`);
      return res.status(403).json({ error: 'Apenas administradores podem deletar todas as instâncias' });
    }
    
    console.log(`🗑️ ADMIN DELETE ALL - Admin ${userId} deletando TODAS as instâncias do sistema...`);
    
    // Buscar quanto vamos deletar
    const allInstances = await WhatsAppInstance.findAll();
    console.log(`📊 Total a deletar: ${allInstances.length} instâncias`);
    
    // Deletar TUDO (sem where clause = todas as instâncias)
    const deleted = await WhatsAppInstance.destroy({
      where: {},
      force: true
    });
    
    console.log(`✅ DELETADAS ${deleted} instâncias DE TODOS OS USUÁRIOS`);
    
    res.json({ 
      message: `🗑️ DELETADAS ${deleted} instâncias DE TODOS OS USUÁRIOS do sistema`,
      deletedCount: deleted,
      warning: '⚠️ Esta ação é IRREVERSÍVEL e afetou todos os usuários!',
      admin: userId,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`❌ Erro ao deletar todas as instâncias:`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
