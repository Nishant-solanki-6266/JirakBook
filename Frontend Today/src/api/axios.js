import axios from 'axios';
import { loaderService } from '../services/loaderService';
import { BASE_URL } from './axiosInstance';

const api = axios.create({
    baseURL: `${BASE_URL}/api`,

    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to inject the token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user')); // Keep for user info if needed

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        } else if (user && user.token) {
            // Fallback for older sessions or if token is inside user
            config.headers.Authorization = `Bearer ${user.token}`;
        }
        loaderService.show(); // Show loader on request
        return config;
    },
    (error) => {
        loaderService.hide(); // Hide loader on request error
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle errors (like 401)
api.interceptors.response.use(
    (response) => {
        loaderService.hide(); // Hide loader on successful response
        return response;
    },
    (error) => {
        loaderService.hide(); // Hide loader on error response
        const isLoginPage = window.location.pathname === '/login';
        const isLoginRequest = error.config && error.config.url && error.config.url.includes('/auth/login');
        const isExpired = error.response && error.response.status === 403 && error.response.data && error.response.data.isExpired;

        if (!isLoginPage && !isLoginRequest) {
            if ((error.response && error.response.status === 401) || isExpired) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login'; 
            }
        }
        return Promise.reject(error);
    }
);

export default api;
