import axiosInstance from "../api/axiosInstance";

const posService = {
    createPOSInvoice: async (data) => {
        const response = await axiosInstance.post('/pos-invoices', data);
        return response.data;
    },
    getPOSInvoices: async (companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        const response = await axiosInstance.get(`/pos-invoices${query}`);
        return response.data;
    },
    getPOSInvoiceById: async (id, companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        const response = await axiosInstance.get(`/pos-invoices/${id}${query}`);
        return response.data;
    },
    getPublicPOSInvoiceById: async (id) => {
        const response = await axiosInstance.get(`/pos-invoices/public/${id}`);
        return response.data;
    },
    deletePOSInvoice: async (id, companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        const response = await axiosInstance.delete(`/pos-invoices/${id}${query}`);
        return response.data;
    },
    updatePOSInvoice: async (id, data, companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        const response = await axiosInstance.put(`/pos-invoices/${id}${query}`, data);
        return response.data;
    },
    recordPOSPayment: async (id, data, companyId) => {
        const query = companyId ? `?companyId=${companyId}` : '';
        const response = await axiosInstance.post(`/pos-invoices/${id}/payments${query}`, data);
        return response.data;
    }
};

export default posService;
