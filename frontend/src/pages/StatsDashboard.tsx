import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, BarChart3, Users, MessageSquare, TrendingUp, AlertTriangle, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OverviewStats {
  totalInstances: number;
  totalCampaigns: number;
  totalMessagesSent: number;
  successRate: number;
}

interface InstanceStats {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  messagesSent: number;
  messagesFailed: number;
  lastActivity: string;
  antiBanInfo?: {
    delaysBetweenMessages: boolean;
    messageVariations: boolean;
    commercialHours: boolean;
  };
}

interface AntiBanStatus {
  instanceId: string;
  instanceName: string;
  isBanned: boolean;
  banReason?: string;
  lastCheckTime: string;
}

export const StatsDashboard: React.FC = () => {
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [instanceStats, setInstanceStats] = useState<InstanceStats[]>([]);
  const [antiBanStatus, setAntiBanStatus] = useState<AntiBanStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  useEffect(() => {
    fetchAllStats();
    const interval = setInterval(fetchAllStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchAllStats = async () => {
    try {
      setError('');
      const [userStats, instancesResponse, antiBanResponse] = await Promise.all([
        fetch('/api/stats/user', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/stats/user', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/stats/antiban/status', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      if (!userStats.ok) throw new Error('Falha ao carregar estatísticas');

      const userData = await userStats.json();
      setOverviewStats(userData);

      if (instancesResponse.ok) {
        const response = await instancesResponse.json();
        // API retorna {data: [...], pagination: {...}} ou {instances: [...], pagination: {...}}
        const instances = response?.data || response?.instances || response || [];
        setInstanceStats(Array.isArray(instances) ? instances : []);
      }

      if (antiBanResponse.ok) {
        const antiBan = await antiBanResponse.json();
        setAntiBanStatus(antiBan);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const bannedInstances = antiBanStatus.filter((s) => s.isBanned);

  if (loading && !overviewStats) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-8">
            <div className="text-center text-gray-500">
              <div className="animate-pulse">Carregando estatísticas...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {bannedInstances.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle size={16} className="text-red-600" />
          <AlertDescription className="text-red-800">
            ⚠️ {bannedInstances.length} instância(s) pode(m) estar banida(s). Verifique antes de usar!
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Instâncias Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{overviewStats?.totalInstances || 0}</div>
              <Users className="text-blue-600" size={24} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Contas WhatsApp conectadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{overviewStats?.totalCampaigns || 0}</div>
              <BarChart3 className="text-purple-600" size={24} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Total de campanhas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Mensagens Enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{overviewStats?.totalMessagesSent || 0}</div>
              <MessageSquare className="text-green-600" size={24} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Total histórico</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{overviewStats?.successRate?.toFixed(1) || 0}%</div>
              <TrendingUp className="text-orange-600" size={24} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Mensagens entregues</p>
          </CardContent>
        </Card>
      </div>

      {/* Anti-Ban Status */}
      {antiBanStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye size={20} className="text-red-600" />
              Status Anti-Ban
            </CardTitle>
            <CardDescription>Verificação de segurança e limitações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {antiBanStatus.map((status) => (
                <div key={status.instanceId} className={`p-4 rounded-lg border ${status.isBanned ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{status.instanceName}</h4>
                      <p className={`text-xs mt-1 ${status.isBanned ? 'text-red-700' : 'text-green-700'}`}>
                        {status.isBanned ? '🔴 Possivelmente Banida' : '🟢 Status Normal'}
                      </p>
                      {status.banReason && (
                        <p className="text-xs text-red-600 mt-1">{status.banReason}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Última verificação: {new Date(status.lastCheckTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instances Detailed Stats */}
      {instanceStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas por Instância</CardTitle>
            <CardDescription>{instanceStats.length} instâncias ativas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Instância</th>
                    <th className="px-4 py-2 text-left">Telefone</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Enviadas</th>
                    <th className="px-4 py-2 text-center">Falhas</th>
                    <th className="px-4 py-2 text-left">Última Atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {instanceStats.map((instance) => (
                    <tr key={instance.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{instance.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{instance.phoneNumber || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${
                          instance.status === 'connected'
                            ? 'bg-green-100 text-green-800'
                            : instance.status === 'qr'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {instance.status === 'connected' ? '🟢 Conectada' : instance.status === 'qr' ? '🔵 QR Code' : '⚫ Desconectada'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{instance.messagesSent}</td>
                      <td className="px-4 py-3 text-center text-red-600">{instance.messagesFailed}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {instance.lastActivity ? new Date(instance.lastActivity).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-refresh Control */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Controle de Atualização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <button
              onClick={() => setRefreshInterval(10000)}
              className={`px-4 py-2 text-sm rounded border ${refreshInterval === 10000 ? 'bg-blue-600 text-white' : 'border-gray-300'}`}
            >
              10s
            </button>
            <button
              onClick={() => setRefreshInterval(30000)}
              className={`px-4 py-2 text-sm rounded border ${refreshInterval === 30000 ? 'bg-blue-600 text-white' : 'border-gray-300'}`}
            >
              30s
            </button>
            <button
              onClick={() => setRefreshInterval(60000)}
              className={`px-4 py-2 text-sm rounded border ${refreshInterval === 60000 ? 'bg-blue-600 text-white' : 'border-gray-300'}`}
            >
              1m
            </button>
            <button
              onClick={fetchAllStats}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Atualizar Agora
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {refreshInterval / 1000}s de atualização automática
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsDashboard;
