import axios from 'axios';

const isProd = import.meta.env.PROD;
const currentHost = window.location.origin;

export const API_BASE_URL = isProd ? `${currentHost}/api` : 'http://localhost:5000/api';
export const WS_URL = isProd ? `${currentHost.replace(/^http/, 'ws')}/ws` : 'ws://localhost:9080';

// Create an Axios instance pointing to the REST API Core Backend
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to attach the JWT token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
