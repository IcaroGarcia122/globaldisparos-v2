import React, { useState, useEffect } from 'react';
import { getSocket } from '@/utils/socketClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface DispatchProgressData {
  sent: number;
  errors: number;
  total: number;
  percentage: number;
  currentNumber: string;
  status: 'idle' | 'sending' | 'done';
}

const DispatchProgress: React.FC = () => {
  const [progress, setProgress] = useState<DispatchProgressData>({
    sent: 0,
    errors: 0,
    total: 0,
    percentage: 0,
    currentNumber: '',
    status: 'idle'
  });

  useEffect(() => {
    const socket = getSocket();
    
    if (!socket) {
      console.warn('[DispatchProgress] Socket não inicializado');
      return;
    }

    // Listener para atualizações de progresso
    const handleProgress = (data: DispatchProgressData) => {
      console.log('[DispatchProgress] Atualização recebida:', data);
      setProgress(data);
    };

    socket.on('dispatch_progress', handleProgress);

    return () => {
      socket.off('dispatch_progress', handleProgress);
    };
  }, []);

  // Não mostrar nada se não estiver enviando
  if (progress.status === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 z-50 animate-in fade-in slide-in-from-bottom-4">
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {progress.status === 'done' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>Disparo Concluído ✅</span>
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span>Enviando Mensagens...</span>
              </>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Barra de progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Progresso</span>
              <span className="text-blue-700 font-bold">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-3" />
          </div>

          {/* Contadores */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {/* Enviadas */}
            <div className="bg-white rounded-lg p-2 border-2 border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {progress.sent}
              </div>
              <div className="text-xs text-gray-600">Enviadas</div>
            </div>

            {/* Total */}
            <div className="bg-white rounded-lg p-2 border-2 border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {progress.total}
              </div>
              <div className="text-xs text-gray-600">Total</div>
            </div>

            {/* Erros */}
            <div className={`bg-white rounded-lg p-2 border-2 ${progress.errors > 0 ? 'border-red-200' : 'border-gray-200'}`}>
              <div className={`text-2xl font-bold ${progress.errors > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {progress.errors}
              </div>
              <div className="text-xs text-gray-600">Erros</div>
            </div>
          </div>

          {/* Número atual sendo processado */}
          {progress.currentNumber && progress.status === 'sending' && (
            <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
              <div className="text-xs font-semibold text-gray-600 mb-1">
                📱 Enviando para:
              </div>
              <div className="text-sm font-mono text-blue-700 break-all">
                {progress.currentNumber}
              </div>
            </div>
          )}

          {/* Resumo final */}
          {progress.status === 'done' && (
            <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-green-900">
                    Disparo Finalizado!
                  </div>
                  <div className="text-sm text-green-700 mt-1">
                    ✅ {progress.sent} enviadas
                    {progress.errors > 0 && (
                      <span className="ml-2">
                        ❌ {progress.errors} falhas
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-green-600 mt-2">
                    Taxa de sucesso: {Math.round((progress.sent / progress.total) * 100)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Aviso de erros */}
          {progress.errors > 0 && progress.status === 'sending' && (
            <div className="bg-orange-50 rounded-lg p-2 border-l-4 border-orange-500 flex gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div className="text-xs text-orange-700">
                {progress.errors} erro{progress.errors !== 1 ? 's' : ''} encontrado{progress.errors !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DispatchProgress;
