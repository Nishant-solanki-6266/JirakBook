import axios from 'axios';
import { loaderService } from '../services/loaderService';
import toast from 'react-hot-toast';

const BASE_URL = 'http://localhost:8080';
// const BASE_URL = 'https://zirakbook-accounting-production.up.railway.app';

const axiosInstance = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

export { BASE_URL };

// Request interceptor to add the access token to headers
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); // Assuming token is stored as 'token'
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (!config.headers['X-No-Loader']) {
            loaderService.show(); // Show loader on request
        }
        return config;
    },
    (error) => {
        if (!error.config || !error.config.headers || !error.config.headers['X-No-Loader']) {
            loaderService.hide(); // Hide loader on request error
        }
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
axiosInstance.interceptors.response.use(
    (response) => {
        if (!response.config.headers || !response.config.headers['X-No-Loader']) {
            loaderService.hide(); // Hide loader on successful response
        }
        return response;
    },
    (error) => {
        if (!error.config || !error.config.headers || !error.config.headers['X-No-Loader']) {
            loaderService.hide(); // Hide loader on response error
        }

        const isLoginPage = window.location.pathname === '/login';
        const isLoginRequest = error.config && error.config.url && error.config.url.includes('/auth/login');

        const isExpired = error.response && error.response.status === 403 && error.response.data && error.response.data.isExpired;

        if (!isLoginPage && !isLoginRequest) {
            if ((error.response && error.response.status === 401) || isExpired) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            } else if (error.response && error.response.data && error.response.data.message) {
                // Show backend error message as toast notification
                toast.error(error.response.data.message, {
                    duration: 5000,
                    style: {
                        maxWidth: '500px',
                    },
                });
            }
        }
        return Promise.reject(error);
    }

);

export default axiosInstance;