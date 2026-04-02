import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Download, Eye, Loader2 } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  isAdmin: boolean;
  alreadySent?: boolean;
}

interface ExcelExportPreviewProps {
  groupId?: string;
}

export const ExcelExportPreview: React.FC<ExcelExportPreviewProps> = ({ groupId }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [excludeAdmins, setExcludeAdmins] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fileName, setFileName] = useState('contatos');

  useEffect(() => {
    if (groupId) {
      fetchContacts();
    }
  }, [groupId]);

  const fetchContacts = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/participants`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar participantes');
      }

      const data = await response.json();
      setContacts(data);
      setErrorMessage('');
    } catch (error: any) {
      setErrorMessage(error.message || 'Erro ao carregar participantes');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = excludeAdmins ? contacts.filter((c) => !c.isAdmin) : contacts;

  const handleDownloadXLSX = async () => {
    if (!groupId) {
      setErrorMessage('Selecione um grupo primeiro');
      return;
    }

    setDownloading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/export-xlsx`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao baixar arquivo');
      }

      // Get the blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccessMessage('Arquivo baixado com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Erro ao baixar arquivo');
    } finally {
      setDownloading(false);
    }
  };

  if (!groupId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye size={24} className="text-purple-600" />
            Preview e Download XLSX
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle size={16} />
            <AlertDescription>Selecione um grupo para visualizar os participantes</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye size={24} className="text-purple-600" />
          Preview e Download XLSX
        </CardTitle>
        <CardDescription>
          {filteredContacts.length} contatos {excludeAdmins ? '(sem admins)' : '(incluindo admins)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome do Arquivo</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="contatos"
              className="flex-1 px-3 py-2 border round-md text-sm"
            />
            <span className="text-sm text-gray-500">_{new Date().toISOString().split('T')[0]}.xlsx</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="excludeAdmins"
            checked={excludeAdmins}
            onCheckedChange={(checked) => setExcludeAdmins(!!checked)}
          />
          <label htmlFor="excludeAdmins" className="text-sm cursor-pointer">
            Excluir administradores
          </label>
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

        {/* Preview Table */}
        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-center">Admin</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    Carregando contactos...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Nenhum contato encontrado
                  </td>
                </tr>
              ) : (
                filteredContacts.slice(0, 50).map((contact) => (
                  <tr key={contact.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{contact.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{contact.phone}</td>
                    <td className="px-4 py-2 text-center">
                      {contact.isAdmin && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Sim</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          Mostrando {Math.min(50, filteredContacts.length)} de {filteredContacts.length} contatos. O arquivo XLSX incluirá todos.
        </p>

        {/* Download Button */}
        <Button
          onClick={handleDownloadXLSX}
          disabled={loading || downloading || filteredContacts.length === 0}
          size="lg"
          className="w-full"
        >
          {downloading ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Baixando...
            </>
          ) : (
            <>
              <Download size={16} className="mr-2" />
              Baixar XLSX ({filteredContacts.length} contatos)
            </>
          )}
        </Button>

        {/* Info */}
        <div className="bg-blue-50 p-3 rounded text-xs text-blue-900">
          <p className="font-semibold mb-1">📊 Informações</p>
          <ul className="space-y-0.5">
            <li>✓ Total de contatos: {contacts.length}</li>
            <li>✓ Administradores: {contacts.filter((c) => c.isAdmin).length}</li>
            <li>✓ A exportar: {filteredContacts.length} contatos</li>
            <li>✓ Formato: Excel (.xlsx)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExcelExportPreview;
