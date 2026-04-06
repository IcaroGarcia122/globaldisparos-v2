import React, { useEffect, useState } from 'react'
import { Campaign, CampaignMetrics, Contact } from '../types/campaign'
import { fetchAPI, API_URL } from '@/config/api'
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import './CampaignDashboard.css'

interface CampaignDashboardProps {
  campaignId: string
  onClose: () => void
}

const COLORS = {
  sent: '#3B82F6',
  delivered: '#10B981',
  read: '#8B5CF6',
  error: '#EF4444',
  pending: '#6B7280'
}

export function CampaignDashboard({ campaignId, onClose }: CampaignDashboardProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [metrics, setMetrics] = useState<CampaignMetrics>({
    total: 0,
    pending: 0,
    sending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    error: 0,
    successRate: 0,
    currentSpeed: 0,
    elapsedTime: 0,
    estimatedTime: 0
  })
  const [recentContacts, setRecentContacts] = useState<Contact[]>([])
  const [isEditingMessage, setIsEditingMessage] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [speedInput, setSpeedInput] = useState(10)
  const [loading, setLoading] = useState(true)
  const [timelineData, setTimelineData] = useState<any[]>([])

  // Polling para atualizar métricas em tempo real
  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        const data = await fetchAPI(`/campaigns/${campaignId}`, {
          method: 'GET'
        })

        if (data && !data._error && data.campaign && data.metrics) {
          setCampaign(data.campaign)
          setMetrics(data.metrics)
          setRecentContacts(Array.isArray(data.recentContacts) ? data.recentContacts : [])
          setTimelineData(Array.isArray(data.timeline) ? data.timeline : [])
          setNewMessage(data.campaign.message)
          setLoading(false)
        }
      } catch (error) {
        console.error('❌ Erro ao buscar dados da campanha:', error)
      }
    }

    // Buscar imediatamente
    fetchCampaignData()

    // Atualizar a cada 2 segundos APENAS se campanha estiver em execução
    let interval: NodeJS.Timeout | null = null
    if (campaign?.status === 'running') {
      interval = setInterval(fetchCampaignData, 2000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [campaignId, campaign?.status])

  // Funções de controle
  const handlePauseResume = async () => {
    try {
      const newStatus = campaign?.status === 'running' ? 'paused' : 'running'

      await fetchAPI(`/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })

      setCampaign(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (error) {
      console.error('❌ Erro ao pausar/retomar:', error)
      alert('Erro ao pausar/retomar campanha')
    }
  }

  const handleStop = async () => {
    if (!confirm('⚠️ Tem certeza que deseja PARAR esta campanha? Isso não pode ser desfeito.')) return

    try {
      await fetchAPI(`/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'stopped' })
      })

      setCampaign(prev => prev ? { ...prev, status: 'stopped' } : null)
    } catch (error) {
      console.error('❌ Erro ao parar campanha:', error)
      alert('Erro ao parar campanha')
    }
  }

  const handleUpdateMessage = async () => {
    if (!newMessage.trim()) {
      alert('⚠️ Mensagem não pode estar vazia')
      return
    }

    try {
      await fetchAPI(`/campaigns/${campaignId}/message`, {
        method: 'PATCH',
        body: JSON.stringify({ message: newMessage })
      })

      setCampaign(prev => prev ? { ...prev, message: newMessage } : null)
      setIsEditingMessage(false)
      alert('✅ Mensagem atualizada com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao atualizar mensagem:', error)
      alert('Erro ao atualizar mensagem')
    }
  }

  const handleUpdateSpeed = async () => {
    if (speedInput < 1 || speedInput > 60) {
      alert('⚠️ Velocidade deve estar entre 1 e 60 msgs/min')
      return
    }

    try {
      await fetchAPI(`/campaigns/${campaignId}/speed`, {
        method: 'PATCH',
        body: JSON.stringify({ speed: speedInput })
      })

      alert('✅ Velocidade atualizada!')
    } catch (error) {
      console.error('❌ Erro ao atualizar velocidade:', error)
      alert('Erro ao atualizar velocidade')
    }
  }

  const handleExportReport = async () => {
    try {
      const response = await fetch(`${API_URL}/campaigns/${campaignId}/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `campanha-${campaignId}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
    } catch (error) {
      console.error('❌ Erro ao exportar:', error)
      alert('Erro ao exportar relatório')
    }
  }

  // Dados para gráficos
  const pieData = [
    { name: 'Enviadas', value: metrics.sent, color: COLORS.sent },
    { name: 'Entregues', value: metrics.delivered, color: COLORS.delivered },
    { name: 'Lidas', value: metrics.read, color: COLORS.read },
    { name: 'Erros', value: metrics.error, color: COLORS.error },
  ].filter(item => item.value > 0)

  const progressPercentage = metrics.total > 0 ? (metrics.sent / metrics.total) * 100 : 0

  if (loading) {
    return (
      <div className="campaign-dashboard loading">
        <div className="spinner"></div>
        <p>Carregando campanha...</p>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="campaign-dashboard error">
        <p>❌ Campanha não encontrada</p>
        <button onClick={onClose}>Fechar</button>
      </div>
    )
  }

  return (
    <div className="campaign-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>{campaign.name}</h1>
          <span className={`status-badge status-${campaign.status}`}>
            {campaign.status === 'running' && '▶️ Em andamento'}
            {campaign.status === 'paused' && '⏸️ Pausada'}
            {campaign.status === 'stopped' && '⏹️ Parada'}
            {campaign.status === 'completed' && '✅ Concluída'}
          </span>
        </div>
        <button className="close-btn" onClick={onClose} title="Fechar">✕</button>
      </div>

      {/* Controles */}
      <div className="dashboard-controls">
        <button
          className="btn-control btn-pause"
          onClick={handlePauseResume}
          disabled={campaign.status === 'stopped' || campaign.status === 'completed'}
        >
          {campaign.status === 'running' ? '⏸️ Pausar' : '▶️ Retomar'}
        </button>

        <button
          className="btn-control btn-stop"
          onClick={handleStop}
          disabled={campaign.status === 'stopped' || campaign.status === 'completed'}
        >
          ⏹️ Parar
        </button>

        <button
          className="btn-control btn-edit"
          onClick={() => setIsEditingMessage(true)}
        >
          ✏️ Editar Mensagem
        </button>

        <button
          className="btn-control btn-export"
          onClick={handleExportReport}
        >
          📊 Exportar
        </button>

        <div className="speed-control">
          <label>⚡ Velocidade:</label>
          <input
            type="number"
            value={speedInput}
            onChange={(e) => setSpeedInput(Number(e.target.value))}
            min="1"
            max="60"
            disabled={campaign.status === 'stopped' || campaign.status === 'completed'}
          />
          <span>msgs/min</span>
          <button
            onClick={handleUpdateSpeed}
            disabled={campaign.status === 'stopped' || campaign.status === 'completed'}
          >
            Ajustar
          </button>
        </div>
      </div>

      {/* Modal de edição de mensagem */}
      {isEditingMessage && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>✏️ Editar Mensagem</h3>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nova mensagem..."
              rows={6}
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setIsEditingMessage(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleUpdateMessage}
              >
                ✅ Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Métricas Principais */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <span className="metric-label">Total</span>
            <span className="metric-value">{metrics.total}</span>
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-icon">⏳</div>
          <div className="metric-content">
            <span className="metric-label">Pendente</span>
            <span className="metric-value">{metrics.pending}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📤</div>
          <div className="metric-content">
            <span className="metric-label">Enviadas</span>
            <span className="metric-value">{metrics.sent}</span>
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-icon">✓✓</div>
          <div className="metric-content">
            <span className="metric-label">Entregues</span>
            <span className="metric-value">{metrics.delivered}</span>
          </div>
        </div>

        <div className="metric-card info">
          <div className="metric-icon">👁️</div>
          <div className="metric-content">
            <span className="metric-label">Lidas</span>
            <span className="metric-value">{metrics.read}</span>
          </div>
        </div>

        <div className="metric-card error">
          <div className="metric-icon">❌</div>
          <div className="metric-content">
            <span className="metric-label">Erros</span>
            <span className="metric-value">{metrics.error}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <span className="metric-label">Taxa de Sucesso</span>
            <span className="metric-value">{metrics.successRate.toFixed(1)}%</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚡</div>
          <div className="metric-content">
            <span className="metric-label">Velocidade</span>
            <span className="metric-value">{metrics.currentSpeed}/min</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <span className="metric-label">Tempo Restante</span>
            <span className="metric-value">{formatTime(metrics.estimatedTime)}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⌛</div>
          <div className="metric-content">
            <span className="metric-label">Tempo Decorrido</span>
            <span className="metric-value">{formatTime(metrics.elapsedTime)}</span>
          </div>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="progress-section">
        <div className="progress-header">
          <span>📊 Progresso Geral</span>
          <span className="progress-percent">{progressPercentage.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-info">
          {metrics.sent} de {metrics.total} mensagens enviadas
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid">
        {timelineData.length > 0 && (
          <div className="chart-card">
            <h3>📈 Evolução de Mensagens</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke={COLORS.sent} name="Enviadas" />
                <Line type="monotone" dataKey="delivered" stroke={COLORS.delivered} name="Entregues" />
                <Line type="monotone" dataKey="read" stroke={COLORS.read} name="Lidas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {pieData.length > 0 && (
          <div className="chart-card">
            <h3>📊 Status das Mensagens</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Últimas Mensagens */}
      {recentContacts.length > 0 && (
        <div className="recent-messages">
          <h3>📬 Últimas Mensagens Enviadas</h3>
          <div className="messages-list">
            {recentContacts.map(contact => (
              <div key={contact.id} className="message-item">
                <div className="message-contact">
                  <span className="contact-name">{contact.name || contact.phone}</span>
                  <span className="contact-phone">{contact.phone}</span>
                </div>
                <div className="message-status">
                  {contact.status === 'sent' && <span className="status-icon sent">✓</span>}
                  {contact.status === 'delivering' && <span className="status-icon delivering">↻</span>}
                  {contact.status === 'delivered' && <span className="status-icon delivered">✓✓</span>}
                  {contact.status === 'read' && <span className="status-icon read">✓✓</span>}
                  {contact.status === 'error' && <span className="status-icon error">❌</span>}
                  <span className="status-text">{getStatusText(contact.status)}</span>
                </div>
                {contact.error && (
                  <div className="message-error" title={contact.error}>
                    {contact.error.substring(0, 30)}...
                  </div>
                )}
                <div className="message-time">
                  {contact.sentAt && formatDateTime(new Date(contact.sentAt))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas */}
      {metrics.error > 0 && (metrics.error / metrics.total) > 0.1 && (
        <div className="alert alert-danger">
          ⚠️ Taxa de erro elevada ({((metrics.error / metrics.total) * 100).toFixed(1)}%) - Verifique a conexão da instância
        </div>
      )}

      {campaign.status === 'paused' && (
        <div className="alert alert-warning">
          ⏸️ Campanha pausada - Clique em "Retomar" para continuar
        </div>
      )}

      {campaign.status === 'completed' && (
        <div className="alert alert-success">
          ✅ Campanha concluída com {metrics.successRate.toFixed(1)}% de taxa de sucesso
        </div>
      )}
    </div>
  )
}

// Helper functions
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180)
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0s'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    pending: 'Pendente',
    sending: 'Enviando...',
    sent: 'Enviada',
    delivering: 'Entregando...',
    delivered: 'Entregue',
    read: 'Lida',
    error: 'Erro'
  }
  return texts[status] || status
}
