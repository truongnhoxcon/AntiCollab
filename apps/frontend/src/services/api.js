import axios from 'axios';

// In production the ALB routes /api/* to core-backend, so a relative base URL
// is all that's needed.  The localhost fallback is only active during local
// development (when .env.production is not loaded by Vite).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Empty string tells socket.io-client to connect to the current page origin.
// The ALB /ws/* rule forwards those connections to realtime-backend.
// Locally, point to the docker-compose realtime service port.
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

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
