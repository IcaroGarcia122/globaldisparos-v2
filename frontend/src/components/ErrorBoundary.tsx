import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack?: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="bg-red-100">
              <CardTitle className="flex items-center gap-2 text-red-900">
                <AlertCircle size={20} />
                Erro ao Carregar Componente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-red-800 text-sm font-bold">
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
              <p className="text-red-700 text-xs mt-2 mb-3">
                Tente recarregar a página ou verifique se o backend está rodando.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-1 mb-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition-colors"
              >
                Recarregar Página
              </button>
              {this.state.componentStack && (
                <details className="mt-2">
                  <summary className="text-red-600 text-xs cursor-pointer font-bold">Ver detalhes técnicos</summary>
                  <pre className="text-red-700 text-[10px] mt-2 overflow-auto max-h-40 bg-red-100 p-2 rounded whitespace-pre-wrap break-all">
                    {this.state.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        )
      );
    }

    return this.props.children;
  }
}
