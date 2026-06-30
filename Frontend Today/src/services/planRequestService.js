import axiosInstance from '../api/axiosInstance';

const planRequestService = {
    getPlanRequests: async () => {
        const response = await axiosInstance.get('/plan-requests');
        return response.data;
    },

    getPlanRequestById: async (id) => {
        const response = await axiosInstance.get(`/plan-requests/${id}`);
        return response.data;
    },

    createPlanRequest: async (data) => {
        const response = await axiosInstance.post('/plan-requests', data);
        return response.data;
    },

    updatePlanRequest: async (id, data) => {
        const response = await axiosInstance.put(`/plan-requests/${id}`, data);
        return response.data;
    },

    deletePlanRequest: async (id) => {
        const response = await axiosInstance.delete(`/plan-requests/${id}`);
        return response.data;
    },

    approvePlanRequest: async (id, data) => {
        const response = await axiosInstance.put(`/plan-requests/${id}/approve`, data);
        return response.data;
    },

    rejectPlanRequest: async (id) => {
        const response = await axiosInstance.put(`/plan-requests/${id}/reject`);
        return response.data;
    }
};

export default planRequestService;
