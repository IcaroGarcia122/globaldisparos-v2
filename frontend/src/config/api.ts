// src/config/api.ts
export const API_URL = '/api';

export interface FetchOptions extends RequestInit {
  body?: any;
}

export async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  const token = localStorage.getItem('token');

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

  if (options.signal) config.signal = options.signal;

  const response = await fetch(`${API_URL}${endpoint}`, config);

  let data: any;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const errorMsg = data.error || `Erro HTTP ${response.status}`;
    if (data && typeof data === 'object') {
      return { ...data, _httpStatus: response.status, _error: errorMsg };
    }
    throw new Error(errorMsg);
  }

  return data;
}