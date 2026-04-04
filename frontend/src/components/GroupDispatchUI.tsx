import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Send, CheckCircle2, Clock, Shield } from 'lucide-react';
import { fetchAPI } from '@/config/api';

interface Group {
  id: string;
  name: string;
  participantCount: number;
}

interface DispatchOptions {
  groupId: string;
  instanceId: string;
  message: string;
  useVariations: boolean;
  useDelays: boolean;
  useCommercialHours: boolean;
  excludeAdmins: boolean;
  excludeAlreadySent: boolean;
}

export const GroupDispatchUI: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [options, setOptions] = useState<DispatchOptions>({
    groupId: '',
    instanceId: '',
    message: '',
    useVariations: true,
    useDelays: true,
    useCommercialHours: false,
    excludeAdmins: true,
    excludeAlreadySent: false,
  });

  // Fetch instances on load
  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const response = await fetchAPI('/instances');
        // API retorna {data: [...], pagination: {...}} ou {instances: [...], pagination: {...}}
        const data = response?.data || response?.instances || response || [];
        setInstances(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao buscar instâncias:', error);
        setErrorMessage('Falha ao carregar instâncias');
      }
    };

    fetchInstances();
  }, []);

  // Fetch groups when instance is selected
  useEffect(() => {
    if (!options.instanceId) return;

    const fetchGroups = async () => {
      setLoading(true);
      try {
        const data = await fetchAPI(`/groups/sync/${options.instanceId}`);
        // API pode retornar {groups: [...]} ou array direto
        const groupsArray = data?.groups || data || [];
        setGroups(Array.isArray(groupsArray) ? groupsArray : []);
      } catch (error) {
        console.error('Erro ao buscar grupos:', error);
        setErrorMessage('Falha ao carregar grupos');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [options.instanceId]);

  const handleStartDispatch = async () => {
    if (!options.groupId || !options.message || !options.instanceId) {
      setErrorMessage('Preencha todos os campos obrigatórios');
      return;
    }

    setDispatching(true);
    setSuccessMessage('');
    setErrorMessage('');
    setDispatchProgress(0);

    try {
      const data = await fetchAPI(`/groups/${options.groupId}/dispatch`, {
        method: 'POST',
        body: {
          instanceId: options.instanceId,
          message: options.message,
          useVariations: options.useVariations,
          useDelays: options.useDelays,
          useCommercialHours: options.useCommercialHours,
          excludeAdmins: options.excludeAdmins,
          excludeAlreadySent: options.excludeAlreadySent,
        },
      });

      setSuccessMessage(`Disparo iniciado! ${data.messagesSent || 0} mensagens serão enviadas.`);
      setOptions({ ...options, message: '', groupId: '' });
    } catch (error: any) {
      setErrorMessage(error.message || 'Erro ao iniciar disparo');
    } finally {
      setDispatching(false);
    }
  };

  const selectedGroup = Array.isArray(groups) ? groups.find((g) => g.id === options.groupId) : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Card */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send size={24} className="text-blue-600" />
            Disparo em Grupo
          </CardTitle>
          <CardDescription>Envie mensagens para múltiplos contatos com sistema anti-ban integrado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instance Selection */}
          <div className="space-y-2">
            <Label htmlFor="instance">Selecione a Instância WhatsApp</Label>
            <Select value={options.instanceId} onValueChange={(value) => setOptions({ ...options, instanceId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma instância..." />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name} {inst.phoneNumber && `(${inst.phoneNumber})`} - {inst.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group Selection */}
          <div className="space-y-2">
            <Label htmlFor="group">Selecione o Grupo</Label>
            <Select value={options.groupId} onValueChange={(value) => setOptions({ ...options, groupId: value })} disabled={!options.instanceId || loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Carregando grupos...' : 'Escolha um grupo...'} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name} ({group.participantCount} membros)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem a Enviar</Label>
            <Textarea
              id="message"
              placeholder="Digite a mensagem. Use: {{nome}}, {{data}}, {{telefone}}, {{dia_semana}}"
              value={options.message}
              onChange={(e) => setOptions({ ...options, message: e.target.value })}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-600">
              Variáveis: {'{{nome}}, {{telefone}}, {{data}}, {{dia_semana}}'}
            </p>
          </div>

          {/* Anti-Ban Options */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Shield size={16} />
              Opções de Proteção Anti-Ban
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="variations"
                  checked={options.useVariations}
                  onCheckedChange={(checked) => setOptions({ ...options, useVariations: !!checked })}
                />
                <label htmlFor="variations" className="text-sm cursor-pointer">
                  Usar variações de mensagem (4 alternativas automáticas)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delays"
                  checked={options.useDelays}
                  onCheckedChange={(checked) => setOptions({ ...options, useDelays: !!checked })}
                />
                <label htmlFor="delays" className="text-sm cursor-pointer flex items-center gap-1">
                  <Clock size={14} />
                  Delays humanizados (3-45 segundos com variação)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="commercialHours"
                  checked={options.useCommercialHours}
                  onCheckedChange={(checked) => setOptions({ ...options, useCommercialHours: !!checked })}
                />
                <label htmlFor="commercialHours" className="text-sm cursor-pointer">
                  Respeitar horário comercial (9h-21h)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeAdmins"
                  checked={options.excludeAdmins}
                  onCheckedChange={(checked) => setOptions({ ...options, excludeAdmins: !!checked })}
                />
                <label htmlFor="excludeAdmins" className="text-sm cursor-pointer">
                  Excluir administradores do grupo
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeAlreadySent"
                  checked={options.excludeAlreadySent}
                  onCheckedChange={(checked) => setOptions({ ...options, excludeAlreadySent: !!checked })}
                />
                <label htmlFor="excludeAlreadySent" className="text-sm cursor-pointer">
                  Excluir contatos que já receberam (evitar duplicatas)
                </label>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle size={16} />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 size={16} className="text-green-600" />
              <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Dispatch Button */}
          <Button
            onClick={handleStartDispatch}
            disabled={!options.groupId || !options.message || dispatching}
            size="lg"
            className="w-full"
          >
            {dispatching ? 'Enviando...' : 'Iniciar Disparo'} {selectedGroup && `(${selectedGroup.participantCount} membros)`}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-1">Status da Instância</h4>
            {options.instanceId && Array.isArray(instances) && instances.find((i) => i.id === options.instanceId) ? (
              <div className="p-2 bg-blue-50 rounded text-blue-900">
                <p className="font-mono">
                  {instances.find((i) => i.id === options.instanceId)?.name}
                </p>
                <p className="text-xs">
                  Status: {instances.find((i) => i.id === options.instanceId)?.status}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">Selecione uma instância</p>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-1">Grupo Selecionado</h4>
            {selectedGroup ? (
              <div className="p-2 bg-green-50 rounded text-green-900">
                <p className="font-mono">{selectedGroup.name}</p>
                <p className="text-xs">{selectedGroup.participantCount} membros</p>
              </div>
            ) : (
              <p className="text-gray-500">Selecione um grupo</p>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Anti-Ban Ativo</h4>
            <ul className="space-y-1 text-xs">
              <li className={options.useVariations ? 'text-green-600' : 'text-gray-400'}>
                ✓ Variações de mensagem
              </li>
              <li className={options.useDelays ? 'text-green-600' : 'text-gray-400'}>
                ✓ Delays humanizados
              </li>
              <li className={options.useCommercialHours ? 'text-green-600' : 'text-gray-400'}>
                ✓ Horário comercial
              </li>
              <li className={options.excludeAdmins ? 'text-green-600' : 'text-gray-400'}>
                ✓ Excluir admins
              </li>
            </ul>
          </div>

          <div className="border-t pt-4 text-xs">
            <p className="text-gray-600">
              💡 Dica: Use as variáveis {`{{nome}}`} e {`{{data}}`} para personalizar cada mensagem automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupDispatchUI;
