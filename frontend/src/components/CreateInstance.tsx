import React, { useState, useEffect } from 'react';
import { fetchAPI } from '@/config/api';
import { Plus, Loader2, AlertCircle, QrCode } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface CreateInstanceProps {
  onSuccess?: () => void;
}

interface QRData {
  qr: string;
  timeout?: boolean;
}

const CreateInstance: React.FC<CreateInstanceProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [accountAge, setAccountAge] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQRCode] = useState<string | null>(null);
  const [qrLoading, setQRLoading] = useState(false);
  const [connectedMessage, setConnectedMessage] = useState('');
  const [qrAttempts, setQrAttempts] = useState(0);

  // Conectar ao Socket.IO
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket.IO conectado:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });

    newSocket.on('qr_update', (data: any) => {
      console.log('📱 QR Code recebido (completo):', JSON.stringify(data, null, 2));
      console.log('📱 data.qrCode type:', typeof data.qrCode);
      setQrAttempts(prev => prev + 1);
      
      // Extrair a string base64 em qualquer formato que chegue
      let qrString: string | null = null;
      
      if (typeof data.qrCode === 'string') {
        qrString = data.qrCode;
      } else if (typeof data.qrCode === 'object' && data.qrCode !== null) {
        // Tenta extrair em qualquer estrutura possível
        qrString = 
          data.qrCode.base64 ||
          data.qrCode.qr ||
          data.qrCode.code ||
          data.qrCode.qrcode?.base64 ||
          null;
      } else if (typeof data.qr === 'string') {
        qrString = data.qr;
      }
      
      if (qrString) {
        const finalQR = qrString.startsWith('data:image') 
          ? qrString 
          : `data:image/png;base64,${qrString}`;
        console.log('✅ QR Code extraído e formatado');
        setQRCode(finalQR);
        setError('');
      } else {
        console.error('❌ Não foi possível extrair o base64 do objeto:', data.qrCode);
        setError('⚠️ QR Code recebido mas em formato inválido. Tente novamente.');
      }
      
      if (data.timeout) {
        setError('⏰ Timeout ao aguardar QR Code. Tente novamente.');
        setQRLoading(false);
      }
    });

    newSocket.on('whatsapp_connected', (data: any) => {
      console.log('🎉 WhatsApp conectado!', data);
      setConnectedMessage(`✅ Instância conectada! (ID: ${data.instanceId || data.instanceName})`);
      setQRCode(null);
      setQRLoading(false);
      
      // Aguardar 2 segundos e chamar onSuccess
      setTimeout(() => {
        setSuccess(true);
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      }, 2000);
    });

    newSocket.on('qr_timeout', (data: any) => {
      console.warn('⏰ QR Code expirou:', data);
      setError('⏰ QR Code expirou. Clique em "Cancelar" e tente novamente.');
      setQRLoading(false);
    });

    newSocket.on('instance_error', (data: any) => {
      console.error('❌ Erro na instância:', data);
      setError(`Erro: ${data.error}`);
      setQRLoading(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    setQRCode(null);
    setQRLoading(true);
    setConnectedMessage('');
    setQrAttempts(0);

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Você precisa fazer login primeiro');
        setLoading(false);
        setQRLoading(false);
        return;
      }

      // Enviar socket ID no header
      const socketId = socket?.id || '';
      const instance = await fetchAPI('/instances', {
        method: 'POST',
        body: { name, accountAge },
        headers: {
          'x-socket-id': socketId
        }
      });

      console.log('✅ Instância criada, aguardando QR Code...', instance);
      
      // Não chamar onSuccess aqui - aguardar evento Socket.IO 'whatsapp_connected'
      
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      
      // Melhorar mensagem de erro para limite de instâncias
      if (error.message && error.message.includes('Máximo')) {
        setError('Você atingiu o limite de instâncias ativas. Delete uma instância para adicionar uma nova.');
      } else {
        setError(error.message || 'Erro ao criar instância. Tente novamente.');
      }
      
      setQRLoading(false);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-[#1c2433] border border-emerald-500/30 p-6 rounded-2xl text-center">
        <h2 className="text-xl font-black text-emerald-400 mb-4 uppercase">✅ Sucesso!</h2>
        <p className="text-slate-400 text-sm">Instância conectada com sucesso. Atualizando...</p>
      </div>
    );
  }

  // Se está carregando QR Code, mostrar o QR
  if (qrLoading && !connectedMessage) {
    return (
      <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
        <h2 className="text-xl font-black text-white mb-4 uppercase flex items-center gap-2">
          <QrCode size={20} />
          Escaneie o QR Code
        </h2>
        
        <div className="space-y-4">
          {/* QR Code */}
          {qrCode ? (
            <div className="flex justify-center">
              <img 
                src={qrCode} 
                alt="WhatsApp QR Code" 
                className="w-64 h-64 border-2 border-emerald-500/50 rounded-lg p-3 bg-white"
              />
            </div>
          ) : (
            <div className="w-64 h-64 mx-auto bg-[#060b16] border-2 border-emerald-500/20 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-emerald-500 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Gerando QR Code...</p>
              </div>
            </div>
          )}
          
          {/* Instruções */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm font-medium">📱 Como conectar:</p>
            <ol className="text-blue-400/80 text-xs mt-2 space-y-1 ml-4">
              <li>1. Abra o WhatsApp no seu telefone</li>
              <li>2. Vá para Configurações → Dispositivos Conectados</li>
              <li>3. Clique em "Conectar um dispositivo"</li>
              <li>4. Escaneie este QR Code com a câmera</li>
            </ol>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3">
              <AlertCircle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
              <p className="text-rose-500 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={() => {
              setQRLoading(false);
              setQRCode(null);
              setName('');
              setAccountAge(30);
              setQrAttempts(0);
              setError('');
            }}
            className="w-full bg-slate-600 hover:bg-slate-500 text-white py-2 rounded-lg font-medium text-xs uppercase transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Se está exibindo mensagem de sucesso com WhatsApp conectado
  if (connectedMessage) {
    return (
      <div className="bg-[#1c2433] border border-emerald-500/30 p-6 rounded-2xl">
        <h2 className="text-xl font-black text-emerald-400 mb-4 uppercase">🎉 {connectedMessage}</h2>
        <p className="text-slate-400 text-sm">Instância pronta para disparar mensagens!</p>
        <button
          onClick={() => {
            setConnectedMessage('');
            setQRLoading(false);
            setQRCode(null);
            if (onSuccess) onSuccess();
          }}
          className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium text-xs uppercase transition-all"
        >
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
      <h2 className="text-xl font-black text-white mb-4 uppercase">Nova Instância WhatsApp</h2>

      <form onSubmit={handleCreateInstance} className="space-y-4">
        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Nome da Instância
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Meu WhatsApp Principal"
            className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Idade da Conta (dias)
          </label>
          <input
            type="number"
            value={accountAge}
            onChange={(e) => setAccountAge(parseInt(e.target.value) || 30)}
            min="0"
            max="365"
            className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all"
            disabled={loading}
          />
          <p className="text-xs text-slate-600 mt-1">
            Usado para calcular limites anti-ban (0 = conta nova)
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3">
            <AlertCircle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="text-rose-500 text-sm font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Criando Instância...
            </>
          ) : (
            <>
              <Plus size={16} />
              Criar Instância
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateInstance;