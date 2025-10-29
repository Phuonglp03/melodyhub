import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9999/api';

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  try {
    // Basic client-side logging to help diagnose when requests don't fire
    // eslint-disable-next-line no-console
    console.log('[HTTP]', config.method?.toUpperCase(), config.baseURL + config.url, config.params || '', config.headers['Content-Type']);
  } catch {}
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error.message || 'Request error';
    return Promise.reject(new Error(message));
  }
);

export default http;


