/**
 * 🚀 DISPARADOR ELITE - Componente React para disparo em massa via WhatsApp
 * 
 * Funcionalidades:
 * - Seleção de instâncias WhatsApp
 * - Listagem de grupos e seleção múltipla
 * - Editor de mensagem com variáveis {nome}, {numero}
 * - Controle de velocidade de disparo
 * - Dashboard em tempo real com Socket.IO
 * - Pausar, retomar e parar campaña
 * - Métricas de sucesso e erro
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '@/config/api';
import { io, Socket } from 'socket.io-client';

interface Instance {
  id: number;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  phoneNumber?: string;
}

interface Group {
  id: string;
  name: string;
  participants?: number;
}

interface CampaignMetrics {
  campaignId: number;
  sent: number;
  failed: number;
  remaining: number;
  percentual: string;
  elapsedSeconds: number;
  remainingSeconds: number;
  estimatedTotal: number;
  velocidade: string;
}

interface CampaignResult {
  campaignId: number;
  totalSent: number;
  totalFailed: number;
  successRate: string;
  duration: string;
}

export default function Disparador() {
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Estados - Seleção
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Estados - Formulário
  const [message, setMessage] = useState('');
  const [interval, setInterval] = useState(3000);
  const [campaignName, setCampaignName] = useState('');

  // Estados - Execução
  const [loading, setLoading] = useState(false);
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [result, setResult] = useState<CampaignResult | null>(null);

  // Conectar ao servidor
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ Conectado ao servidor Socket.IO');
    });

    newSocket.on('campanha:progresso', (data: CampaignMetrics) => {
      console.log('📊 Progresso:', data);
      setMetrics(data);
    });

    newSocket.on('campanha:concluida', (data: CampaignResult) => {
      console.log('✅ Campanha concluída:', data);
      setResult(data);
      setCampaignRunning(false);
    });

    newSocket.on('campanha:erro', (data: { error: string }) => {
      console.error('❌ Erro na campanha:', data.error);
      alert('Erro na campanha: ' + data.error);
      setCampaignRunning(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Carregar instâncias
  useEffect(() => {
    carregarInstancias();
  }, []);

  // Carregar grupos quando instância é selecionada
  useEffect(() => {
    if (selectedInstance) {
      carregarGrupos();
    }
  }, [selectedInstance]);

  const carregarInstancias = async () => {
    try {
      const response = await fetchAPI('/instances');
      const instanciasConectadas = response.data.filter(
        (inst: Instance) => inst.status === 'connected'
      );

      if (instanciasConectadas.length === 0) {
        alert('⚠️  Nenhuma instância WhatsApp conectada. Conecte uma instância primeiro!');
        navigate('/instances');
        return;
      }

      setInstances(instanciasConectadas);
      setSelectedInstance(instanciasConectadas[0].id);
    } catch (error: any) {
      alert('Erro ao carregar instâncias: ' + error.message);
    }
  };

  const carregarGrupos = async () => {
    if (!selectedInstance) return;

    setLoading(true);
    try {
      const response = await fetchAPI(`/groups?instanceId=${selectedInstance}`, {
        method: 'GET'
      });

      const gruposData = response || [];
      setGroups(gruposData);

      if (gruposData.length === 0) {
        alert('⚠️  Nenhum grupo encontrado. Crie ou participe de grupos no WhatsApp.');
      }
    } catch (error: any) {
      alert('Erro ao carregar grupos: ' + error.message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const iniciarCampanha = async () => {
    // Validações
    if (!selectedInstance) {
      alert('Selecione uma instância WhatsApp');
      return;
    }

    if (selectedGroups.size === 0) {
      alert('Selecione pelo menos um grupo');
      return;
    }

    if (!message.trim()) {
      alert('Digite uma mensagem');
      return;
    }

    if (interval < 2000 || interval > 30000) {
      alert('Intervalo deve estar entre 2000-30000 ms (2-30 segundos)');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchAPI('/disparador/iniciar', {
        method: 'POST',
        body: {
          instanceId: selectedInstance,
          groupIds: Array.from(selectedGroups),
          message,
          interval,
          campaignName: campaignName || `Campanha de ${new Date().toLocaleString()}`
        }
      });

      console.log('✅ Campanha iniciada:', response.data);

      setCampaignId(response.data.campaignId);
      setCampaignRunning(true);
      setMetrics(null);
      setResult(null);

      // Subscrever aos eventos da campanha
      if (socket) {
        socket.emit('join', `campaign:${response.data.campaignId}`);
      }

      // Desabilitar formulário
      document.querySelectorAll('input, select, textarea, button.iniciar').forEach(el => {
        (el as HTMLInputElement).disabled = true;
      });
    } catch (error: any) {
      alert('Erro ao iniciar campanha: ' + error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const pausarCampanha = async () => {
    if (!campaignId) return;

    try {
      await fetchAPI(`/disparador/${campaignId}/pausar`, {
        method: 'POST'
      });
      console.log('⏸️  Campanha pausada');
      // Atualizar UI
    } catch (error: any) {
      alert('Erro ao pausar: ' + error.message);
    }
  };

  const retomarCampanha = async () => {
    if (!campaignId) return;

    try {
      await fetchAPI(`/disparador/${campaignId}/retomar`, {
        method: 'POST'
      });
      console.log('▶️  Campanha retomada');
      // Atualizar UI
    } catch (error: any) {
      alert('Erro ao retomar: ' + error.message);
    }
  };

  const pararCampanha = async () => {
    if (!campaignId) return;

    if (!confirm('Tem certeza que deseja parar a campanha?')) return;

    try {
      await fetchAPI(`/disparador/${campaignId}/parar`, {
        method: 'POST'
      });
      console.log('⏹️  Campanha parada');
      setCampaignRunning(false);

      // Reabilitar formulário
      document.querySelectorAll('input, select, textarea, button.iniciar').forEach(el => {
        (el as HTMLInputElement).disabled = false;
      });
    } catch (error: any) {
      alert('Erro ao parar: ' + error.message);
    }
  };

  const percentuoCompleto = metrics
    ? Math.round(parseFloat(metrics.percentual))
    : 0;

  return (
    <div className="disparador-container" style={styles.container}>
      <h1>🚀 Disparador Elite</h1>
      <p className="subtitle">Envie mensagens em massa para membros dos grupos selecionados</p>

      <div className="disparador-content" style={styles.content}>
        {/* ===== PAINEL DE CONFIGURAÇÃO ===== */}
        {!campaignRunning ? (
          <div className="config-panel" style={styles.panel}>
            <h2>⚙️ Configurar Campanha</h2>

            {/* Seleção de Instância */}
            <div className="form-group" style={styles.formGroup}>
              <label htmlFor="instance">
                📱 Selecione a Instância WhatsApp:
              </label>
              <select
                id="instance"
                value={selectedInstance || ''}
                onChange={(e) => setSelectedInstance(Number(e.target.value))}
                disabled={loading}
                style={styles.select}
              >
                <option value="">Selecione uma instância...</option>
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} {inst.phoneNumber && `(${inst.phoneNumber})`} ✅
                  </option>
                ))}
              </select>
            </div>

            {/* Seleção de Grupos */}
            {selectedInstance && (
              <div className="form-group" style={styles.formGroup}>
                <label>📋 Selecione os Grupos:</label>
                <button
                  onClick={carregarGrupos}
                  disabled={loading}
                  className="refresh-btn"
                  style={styles.refreshBtn}
                >
                  {loading ? '⏳ Carregando...' : '🔄 Atualizar Grupos'}
                </button>

                <div className="groups-list" style={styles.groupsList}>
                  {groups.length === 0 ? (
                    <p style={{ color: '#999' }}>Nenhum grupo encontrado</p>
                  ) : (
                    groups.map(group => (
                      <label key={group.id} className="group-item" style={styles.groupItem}>
                        <input
                          type="checkbox"
                          checked={selectedGroups.has(group.id)}
                          onChange={() => toggleGroupSelection(group.id)}
                          disabled={loading || campaignRunning}
                        />
                        <span>
                          {group.name}
                          {group.participants && ` (${group.participants} membros)`}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Mensagem */}
            <div className="form-group" style={styles.formGroup}>
              <label htmlFor="message">💬 Mensagem:</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá {nome}, tudo bem?"
                disabled={loading || campaignRunning}
                style={styles.textarea}
                rows={4}
              />
              <small style={{ color: '#666' }}>
                Use {'{nome}'} para nome e {'{numero}'} para número
              </small>
            </div>

            {/* Nome da Campanha */}
            <div className="form-group" style={styles.formGroup}>
              <label htmlFor="campaignName">📝 Nome da Campanha (opcional):</label>
              <input
                id="campaignName"
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="ex: Campanha Black Friday"
                disabled={loading || campaignRunning}
                style={styles.input}
              />
            </div>

            {/* Intervalo */}
            <div className="form-group" style={styles.formGroup}>
              <label htmlFor="interval">
                ⏱️ Intervalo entre mensagens: <strong>{(interval / 1000).toFixed(1)}s</strong>
              </label>
              <input
                id="interval"
                type="range"
                min="2000"
                max="30000"
                step="500"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                disabled={loading || campaignRunning}
                style={styles.slider}
              />
              <small style={{ color: '#666' }}>
                Mínimo: 2s | Máximo: 30s | Atual: {(interval / 1000).toFixed(1)}s
              </small>
            </div>

            {/* Botões */}
            <div className="button-group" style={styles.buttonGroup}>
              <button
                onClick={iniciarCampanha}
                disabled={loading || campaignRunning || selectedGroups.size === 0 || !message.trim()}
                className="iniciar"
                style={{
                  ...styles.buttonStart,
                  opacity: loading || campaignRunning ? 0.6 : 1
                }}
              >
                {loading ? '⏳ Iniciando...' : '🚀 Iniciar Campanha'}
              </button>
            </div>
          </div>
        ) : null}

        {/* ===== DASHBOARD DE CAMPANHA ===== */}
        {campaignRunning && (
          <div className="campaign-dashboard" style={styles.dashboard}>
            <h2>📊 Dashboard da Campanha</h2>

            {metrics && (
              <>
                {/* Métricas Principais */}
                <div className="metrics-grid" style={styles.metricsGrid}>
                  <div className="metric-card" style={styles.metricCard}>
                    <div className="metric-value">{metrics.sent}</div>
                    <div className="metric-label">Enviadas ✅</div>
                  </div>
                  <div className="metric-card" style={styles.metricCard}>
                    <div className="metric-value">{metrics.failed}</div>
                    <div className="metric-label">Erros ❌</div>
                  </div>
                  <div className="metric-card" style={styles.metricCard}>
                    <div className="metric-value">{metrics.remaining}</div>
                    <div className="metric-label">Pendentes ⏳</div>
                  </div>
                  <div className="metric-card" style={styles.metricCard}>
                    <div className="metric-value">{metrics.velocidade}</div>
                    <div className="metric-label">Velocidade 📈</div>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="progress-section" style={styles.progressSection}>
                  <div className="progress-label" style={styles.progressLabel}>
                    Progresso: {metrics.percentual}%
                  </div>
                  <div className="progress-bar" style={styles.progressBar}>
                    <div
                      className="progress-fill"
                      style={{
                        ...styles.progressFill,
                        width: `${percentuoCompleto}%`
                      }}
                    />
                  </div>
                  <div className="progress-time" style={styles.progressTime}>
                    ⏱️ Decorrido: {metrics.elapsedSeconds}s | Restante: {metrics.remainingSeconds}s | Total: {metrics.estimatedTotal}s
                  </div>
                </div>

                {/* Botões de Controle */}
                <div className="control-buttons" style={styles.controlButtons}>
                  <button onClick={pausarCampanha} style={styles.buttonControl}>
                    ⏸️ Pausar
                  </button>
                  <button onClick={retomarCampanha} style={styles.buttonControl}>
                    ▶️ Retomar
                  </button>
                  <button onClick={pararCampanha} style={styles.buttonControlStop}>
                    ⏹️ Parar
                  </button>
                </div>
              </>
            )}

            {/* Resultado Final */}
            {result && (
              <div className="result-section" style={styles.resultSection}>
                <h3>✅ Campanha Concluída!</h3>
                <p><strong>Total Enviadas:</strong> {result.totalSent}</p>
                <p><strong>Falhas:</strong> {result.totalFailed}</p>
                <p><strong>Taxa de Sucesso:</strong> {result.successRate}</p>
                <p><strong>Duração:</strong> {result.duration}</p>
                <button
                  onClick={() => {
                    setCampaignRunning(false);
                    window.location.reload();
                  }}
                  style={styles.buttonSuccess}
                >
                  ✅ Finalizar e Voltar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  } as React.CSSProperties,

  content: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '20px',
    marginTop: '20px'
  } as React.CSSProperties,

  panel: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  formGroup: {
    marginBottom: '20px'
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '10px',
    marginTop: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px',
    marginTop: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box' as const
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    padding: '10px',
    marginTop: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Arial',
    boxSizing: 'border-box' as const
  } as React.CSSProperties,

  slider: {
    width: '100%',
    marginTop: '8px'
  } as React.CSSProperties,

  groupsList: {
    marginTop: '10px',
    maxHeight: '250px',
    overflowY: 'auto',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px'
  } as React.CSSProperties,

  groupItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.2s'
  } as React.CSSProperties,

  refreshBtn: {
    padding: '8px 16px',
    marginTop: '8px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px'
  } as React.CSSProperties,

  buttonStart: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  } as React.CSSProperties,

  dashboard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '15px',
    marginTop: '20px'
  } as React.CSSProperties,

  metricCard: {
    backgroundColor: '#f9f9f9',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    padding: '15px',
    textAlign: 'center'
  } as React.CSSProperties,

  progressSection: {
    marginTop: '30px'
  } as React.CSSProperties,

  progressLabel: {
    marginBottom: '10px',
    fontWeight: 'bold'
  } as React.CSSProperties,

  progressBar: {
    height: '30px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  } as React.CSSProperties,

  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold'
  } as React.CSSProperties,

  progressTime: {
    marginTop: '10px',
    fontSize: '14px',
    color: '#666'
  } as React.CSSProperties,

  controlButtons: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px'
  } as React.CSSProperties,

  buttonControl: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  } as React.CSSProperties,

  buttonControlStop: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  } as React.CSSProperties,

  resultSection: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#e8f5e9',
    borderRadius: '8px',
    border: '2px solid #4CAF50'
  } as React.CSSProperties,

  buttonSuccess: {
    marginTop: '15px',
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  } as React.CSSProperties
};
