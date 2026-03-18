// src/config/api.ts
export const API_URL = '/api';

export interface FetchOptions extends RequestInit {
  body?: any;
}

export async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  console.log('%c📡 fetchAPI INICIADO', 'color: cyan; font-weight: bold;');
  console.log(`%c  Endpoint: ${endpoint}`, 'color: cyan;');
  console.log(`%c  Método: ${options.method || 'GET'}`, 'color: cyan;');
  
  const token = localStorage.getItem('token');
  console.log(`%c  Token presente: ${!!token}`, 'color: cyan;');
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const fullUrl = `${API_URL}${endpoint}`;
  console.log(`%c  URL completa: ${fullUrl}`, 'color: cyan;');
  console.log(`%c  Headers:`, 'color: cyan;', config.headers);

  console.log('%c📡 Enviando requisição fetch...', 'color: cyan;');
  
  // Passa signal de AbortController se fornecido
  if (options.signal) config.signal = options.signal;

  let response: Response;
  try {
    response = await fetch(fullUrl, config);
    console.log(`%c✅ Resposta recebida - Status: ${response.status}`, 'color: cyan;');
  } catch (fetchError: any) {
    console.log('%c❌ ERRO NO FETCH:', 'color: red; font-weight: bold;');
    console.log(`%c  Erro: ${fetchError.message}`, 'color: red;');
    throw fetchError;
  }

  let data: any;
  try {
    const text = await response.text();
    console.log(`%c📄 Body recebido (primeiros 200 chars): ${text.substring(0, 200)}`, 'color: cyan;');
    data = text ? JSON.parse(text) : {};
  } catch (parseError: any) {
    console.log('%c❌ ERRO AO FAZER PARSE DO JSON:', 'color: red;');
    console.log(`%c  Erro: ${parseError.message}`, 'color: red;');
    throw parseError;
  }

  console.log(`%c✅ Status OK? ${response.ok}`, 'color: cyan;');
  
  if (!response.ok) {
    const errorMsg = data.error || `Erro HTTP ${response.status}`;
    console.log(`%c❌ Requisição falhou: ${errorMsg}`, 'color: red;');
    // Para send-single: retornar dados mesmo em erro para o caller decidir
    // O caller verifica result?.success para saber se deu certo
    if (data && typeof data === 'object') {
      return { ...data, _httpStatus: response.status, _error: errorMsg };
    }
    throw new Error(errorMsg);
  }

  console.log('%c✅ fetchAPI COMPLETADO COM SUCESSO', 'color: green; font-weight: bold;');
  return data;
}