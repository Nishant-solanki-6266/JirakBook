import axios from './axiosInstance';

const salesInvoiceService = {
    getAll: (companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        return axios.get(`/sales-invoices${query}`);
    },
    getById: (id, companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        return axios.get(`/sales-invoices/${id}${query}`);
    },
    getPublicById: (id) => axios.get(`/sales-invoices/public/${id}`),
    create: (data) => axios.post('/sales-invoices', data),
    update: (id, data, companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        return axios.put(`/sales-invoices/${id}${query}`, data);
    },
    delete: (id, companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        return axios.delete(`/sales-invoices/${id}${query}`);
    },
    getNextNumber: (companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        return axios.get(`/sales-invoices/next-number${query}`);
    },
};

export default salesInvoiceService;
