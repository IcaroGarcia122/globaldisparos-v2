import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';

const ImportCSV: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [listId, setListId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [imported, setImported] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSuccess(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('listId', listId);

      const token = localStorage.getItem('token');

      const response = await fetch('/api/contacts/import-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setImported(data.imported);
      setSuccess(true);
      setFile(null);
      setListId('');
      
      // Resetar input file
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      alert(error.message || 'Erro ao importar CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
      <h2 className="text-xl font-black text-white mb-4 uppercase flex items-center gap-2">
        <Upload size={24} />
        Importar Contatos (CSV)
      </h2>

      <form onSubmit={handleImportCSV} className="space-y-4">
        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            ID da Lista de Contatos
          </label>
          <input
            type="number"
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            placeholder="Ex: 1"
            className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all"
            required
          />
        </div>

        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Arquivo CSV
          </label>
          <div className="relative">
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="csv-file"
              className="w-full bg-[#060b16] border border-white/5 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer hover:border-brand-500 transition-all flex flex-col items-center gap-3"
            >
              {file ? (
                <>
                  <FileText size={32} className="text-brand-500" />
                  <div>
                    <p className="text-white font-bold text-sm">{file.name}</p>
                    <p className="text-slate-600 text-xs mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-slate-600" />
                  <div>
                    <p className="text-white font-bold text-sm">Clique para selecionar</p>
                    <p className="text-slate-600 text-xs mt-1">
                      Formato: nome, telefone, variáveis...
                    </p>
                  </div>
                </>
              )}
            </label>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Formato esperado: nome,telefone,empresa,cargo
          </p>
        </div>

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-500" />
            <div>
              <p className="text-emerald-500 font-bold text-sm">
                Importação concluída!
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {imported} contatos importados com sucesso
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file || !listId}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-brand-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload size={20} />
              Importar Contatos
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ImportCSV;