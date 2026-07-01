import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Download, Send, Printer,
    FileSearch, Eye
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './SalesOrder.css';
import '../Invoice/Invoice.css';
import salesOrderService from '../../../../api/salesOrderService';
import salesQuotationService from '../../../../api/salesQuotationService';
import customerService from '../../../../api/customerService';
import productService from '../../../../api/productService';
import warehouseService from '../../../../api/warehouseService';
import servicesService from '../../../../api/servicesService';
import companyService from '../../../../api/companyService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import uomService from '../../../../services/uomService';

const SalesOrder = () => {
    // --- State Management ---
    const { formatCurrency, getTableHeader, getInvoiceLabel, companySettings, getDocumentTitle } = useContext(CompanyContext);
    const { hasPermission } = useContext(AuthContext);
    const [salesOrders, setSalesOrders] = useState([]);
    const [activeQuotations, setActiveQuotations] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [allWarehouses, setAllWarehouses] = useState([]);
    const [allServices, setAllServices] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [creationMode, setCreationMode] = useState('direct'); // 'direct' or 'linked'
    const [showQuotationSelect, setShowQuotationSelect] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [quotationSearchTerm, setQuotationSearchTerm] = useState('');
    const [quotationFilterCustomerId, setQuotationFilterCustomerId] = useState('');

    // Form State
    const [companyDetails, setCompanyDetails] = useState({
        name: 'Zirak Books', address: '123 Business Avenue, Suite 404', email: 'info@zirakbooks.com', phone: '123-456-7890', notes: '', terms: ''
    });
    const [orderMeta, setOrderMeta] = useState({
        manualNo: '', date: new Date().toISOString().split('T')[0], deliveryDate: ''
    });
    const [orderNumber, setOrderNumber] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [customerDetails, setCustomerDetails] = useState({
        billingName: '', billingAddress: '', billingCity: '', billingState: '', billingZipCode: '', billingCountry: '',
        email: '', phone: '',
        shippingName: '', shippingAddress: '', shippingCity: '', shippingState: '', shippingZipCode: '', shippingCountry: ''
    });
    const [items, setItems] = useState([
        { id: Date.now(), productId: '', serviceId: '', warehouseId: '', qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }
    ]);
    const [allUoms, setAllUoms] = useState([]);
    const [notes, setNotes] = useState('');
    const [terms, setTerms] = useState('');
    const [overallDiscount, setOverallDiscount] = useState(0);
    const [overallDiscountType, setOverallDiscountType] = useState('percentage');
    const [customerShippingAddresses, setCustomerShippingAddresses] = useState([]);
    const [bankDetails, setBankDetails] = useState({
        bankName: '', accNo: '', holderName: '', ifsc: ''
    });
    const [customFieldValues, setCustomFieldValues] = useState({});
    const [manualStatus, setManualStatus] = useState(false);
    const [overrideStatus, setOverrideStatus] = useState('PENDING');
    const getCustomFieldsForType = (type) => {
        if (!companySettings?.customFieldsConfig) return [];
        try {
            const parsed = typeof companySettings.customFieldsConfig === 'string'
                ? JSON.parse(companySettings.customFieldsConfig)
                : companySettings.customFieldsConfig;
            if (Array.isArray(parsed)) {
                const config = parsed.find(c => c.transactionType === type);
                return config ? (config.fields || []) : [];
            }
        } catch (e) {
            console.error("Error parsing customFieldsConfig:", e);
        }
        return [];
    };

    const location = useLocation();
    const navigate = useNavigate();

    // Fetch Initial Data
    useEffect(() => {
        fetchData();
        fetchDropdowns();
        fetchCompanyDetails();
    }, []);

    const fetchCompanyDetails = async () => {
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getById(companyId);
                const data = res.data;
                setCompanyDetails({
                    name: data.name || 'Zirak Books',
                    address: data.address || '123 Business Avenue, Suite 404',
                    email: data.email || 'info@zirakbooks.com',
                    phone: data.phone || '123-456-7890',
                    logo: data.logo || null,
                    notes: data.notes || '',
                    terms: data.terms || '',
                    termsSalesOrder: data.termsSalesOrder || ''
                });
                setBankDetails({
                    bankName: data.bankName || 'HDFC Bank',
                    accNo: data.accountNumber || '50200012345678',
                    holderName: data.accountHolder || 'ABC Accounting Solutions Pvt. Ltd.',
                    ifsc: data.ifsc || 'HDFC0000456'
                });
                setNotes(data.notes || '');
                setTerms(data.termsSalesOrder || data.terms || '');
            }
        } catch (error) {
            console.error('Error fetching company details:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            const response = await salesOrderService.getAll(companyId);
            if (response.data.success) {
                setSalesOrders(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching sales orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const companyId = GetCompanyId();
            const [custRes, prodRes, whRes, servRes, quoRes, uomRes] = await Promise.all([
                customerService.getAll(companyId),
                productService.getAll(companyId),
                warehouseService.getAll(companyId),
                servicesService.getAll(companyId),
                salesQuotationService.getAll(companyId),
                uomService.getUOMs(companyId)
            ]);
            if (custRes.data.success) setCustomers(custRes.data.data);
            if (prodRes.data.success) setAllProducts(prodRes.data.data);
            if (whRes.data.success) setAllWarehouses(whRes.data.data);
            if (servRes.data.success) setAllServices(servRes.data.data);
            if (quoRes.data.success) {
                // Only show quotations that are ACTIVE or SENT (not yet Order/Invoice)
                setActiveQuotations(quoRes.data.data.filter(q => q.status !== 'ACCEPTED'));
            }
            if (uomRes.data) setAllUoms(uomRes.data);
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    const salesProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'completed' },
        { id: 'sales-order', label: 'Sales Order', icon: ShoppingCart, status: 'active' },
        { id: 'delivery', label: 'Delivery', icon: Truck, status: 'pending' },
        { id: 'invoice', label: 'Invoice', icon: Receipt, status: 'pending' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'pending' },
    ];

    const sampleQuotations = [
        {
            id: 'QUO-2024-001', customer: 'Acme Corp', date: '2024-01-10', items: [
                { id: 101, name: 'Web Dev Package', warehouse: 'Main', qty: 1, rate: 3000, tax: 18, discount: 0, total: 3540 },
                { id: 102, name: 'SEO Setup', warehouse: 'Service', qty: 1, rate: 1000, tax: 18, discount: 0, total: 1180 }
            ]
        }
    ];

    // --- Actions ---
    const resetForm = () => {
        setEditingId(null);
        setIsViewMode(false);
        setSelectedQuotation(null);
        setCustomerId('');
        setCustomerDetails({
            billingName: '', billingAddress: '', billingCity: '', billingState: '', billingZipCode: '', billingCountry: '',
            email: '', phone: '',
            shippingName: '', shippingAddress: '', shippingCity: '', shippingState: '', shippingZipCode: '', shippingCountry: ''
        });
        let defWarehouseId = '';
        if (companySettings?.inventoryConfig) {
            try {
                const parsed = typeof companySettings.inventoryConfig === 'string'
                    ? JSON.parse(companySettings.inventoryConfig)
                    : companySettings.inventoryConfig;
                if (parsed.defaultSalesWarehouseId) {
                    defWarehouseId = parseInt(parsed.defaultSalesWarehouseId);
                }
            } catch (e) {
                console.error(e);
            }
        }
        setItems([{ id: Date.now(), productId: '', serviceId: '', warehouseId: defWarehouseId, qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }]);
        setOrderMeta({ manualNo: '', date: new Date().toISOString().split('T')[0], deliveryDate: '' });
        setNotes(companyDetails.notes || '');
        setTerms(companyDetails.termsSalesOrder || companyDetails.terms || '');
        setCreationMode('direct');
        setQuotationSearchTerm('');
        setQuotationFilterCustomerId('');
        setOverallDiscount(0);
        setOverallDiscountType('percentage');
        setManualStatus(false);
        setOverrideStatus('PENDING');
        setOrderNumber('');
        setCustomerShippingAddresses([]);
        setCustomFieldValues({});
        setShowAddModal(false);
    };

    const handleAddNew = async () => {
        resetForm();
        setIsViewMode(false);
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getNextNumber(companyId, 'salesorder');
                if (res.data.success) {
                    setOrderNumber(res.data.nextNumber);
                }
            }
        } catch (error) {
            console.error('Error fetching next order number:', error);
        }
        
        if (hasPermission('bypass strict conversion')) {
            setCreationMode('direct');
        } else {
            setCreationMode('linked');
            setShowQuotationSelect(true);
        }
        setShowAddModal(true);
    };

    const handleEdit = async (id) => {
        await populateOrder(id, false);
    };

    const handleView = async (id) => {
        await populateOrder(id, true);
    };

    const populateOrder = async (id, viewOnly) => {
        try {
            const companyId = GetCompanyId();
            const response = await salesOrderService.getById(id, companyId);
            if (response.data.success) {
                const orderToEdit = response.data.data;
                resetForm();
                setEditingId(id);
                setIsViewMode(viewOnly);
                setCustomerId(orderToEdit.customerId);
                setCustomerDetails({
                    billingName: orderToEdit.billingName || '',
                    billingAddress: orderToEdit.billingAddress || '',
                    billingCity: orderToEdit.billingCity || '',
                    billingState: orderToEdit.billingState || '',
                    billingZipCode: orderToEdit.billingZipCode || '',
                    billingCountry: orderToEdit.billingCountry || '',
                    email: orderToEdit.customer?.email || '',
                    phone: orderToEdit.customer?.phone || '',
                    shippingName: orderToEdit.shippingName || '',
                    shippingAddress: orderToEdit.shippingAddress || '',
                    shippingCity: orderToEdit.shippingCity || '',
                    shippingState: orderToEdit.shippingState || '',
                    shippingZipCode: orderToEdit.shippingZipCode || '',
                    shippingCountry: orderToEdit.shippingCountry || ''
                });
                setCustomerShippingAddresses(orderToEdit.customer?.shippingaddress || []);
                setOrderMeta({
                    manualNo: orderToEdit.manualReference || '',
                    date: orderToEdit.date.split('T')[0],
                    deliveryDate: orderToEdit.expectedDate ? orderToEdit.expectedDate.split('T')[0] : ''
                });
                setManualStatus(orderToEdit.manualStatus || false);
                setOverrideStatus(orderToEdit.status || 'PENDING');
                setOrderNumber(orderToEdit.orderNumber || '');
                setItems((orderToEdit.salesorderitem || orderToEdit.items || []).map(item => ({
                    id: item.id,
                    productId: item.productId || '',
                    serviceId: item.serviceId || '',
                    warehouseId: item.warehouseId || '',
                    description: item.description,
                    qty: item.quantity,
                    uomId: item.uomId || '',
                    rate: item.rate,
                    tax: item.taxRate,
                    discount: item.discount || 0,
                    total: item.amount
                })));
                setCreationMode(orderToEdit.quotationId ? 'linked' : 'direct');
                setOverallDiscount(orderToEdit.overallDiscount || 0);
                setOverallDiscountType(orderToEdit.overallDiscountType || 'percentage');
                setNotes(orderToEdit.notes || '');
                setTerms(orderToEdit.terms || '');
                let fieldValues = {};
                if (orderToEdit.customFields) {
                    try {
                        fieldValues = typeof orderToEdit.customFields === 'string'
                            ? JSON.parse(orderToEdit.customFields)
                            : orderToEdit.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on edit:', e);
                    }
                }
                setCustomFieldValues(fieldValues);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error('Error loading order:', error);
        }
    };

    const handleDelete = (id) => {
        setDeleteId(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        try {
            const companyId = GetCompanyId();
            const response = await salesOrderService.delete(deleteId, companyId);
            if (response.data.success) {
                fetchData();
                setShowDeleteConfirm(false);
                setDeleteId(null);
            }
        } catch (error) {
            console.error('Error deleting order:', error);
        }
    };

    const handleConvert = async (id) => {
        try {
            const companyId = GetCompanyId();
            const response = await salesOrderService.convert(id, companyId);
            if (response.data.success) {
                toast.success('Converted to Delivery Challan successfully');
                setShowAddModal(false);
                navigate('/company/sales/challan', { state: { targetChallanId: response.data.data.id } });
            } else {
                toast.error(response.data.message || 'Conversion failed');
            }
        } catch (error) {
            console.error('Error converting order:', error);
            toast.error(error.response?.data?.message || 'Error converting order');
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        try {
            const companyId = GetCompanyId();
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };
            const response = await salesOrderService.update(orderId, payload, companyId);
            if (response.data?.success || response.success) {
                fetchData();
            }
        } catch (error) {
            console.error('Error changing status:', error);
        }
    };

    // --- Filter Logic ---
    const filteredOrders = React.useMemo(() => {
        return salesOrders.filter(o => {
            const query = searchTerm.toLowerCase();
            const matchesSearch = !query ||
                o.orderNumber?.toLowerCase().includes(query) ||
                o.customer?.name?.toLowerCase().includes(query);

            const oDate = new Date(o.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || oDate >= start) && (!end || oDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [salesOrders, searchTerm, startDate, endDate]);

    const filteredQuotationList = React.useMemo(() => {
        return activeQuotations.filter(q => {
            const query = quotationSearchTerm.toLowerCase();
            const matchesSearch = !query ||
                q.quotationNumber?.toLowerCase().includes(query) ||
                q.customer?.name?.toLowerCase().includes(query);

            const matchesCustomer = !quotationFilterCustomerId || q.customerId === parseInt(quotationFilterCustomerId);

            return matchesSearch && matchesCustomer;
        });
    }, [activeQuotations, quotationSearchTerm, quotationFilterCustomerId]);

    const handleSave = async (allowDuplicate = false) => {
        try {
            const companyId = GetCompanyId();
            const data = {
                orderNumber: editingId ? (salesOrders.find(o => o.id === editingId)?.orderNumber) : (orderNumber || `SO-${Date.now()}`),
                manualReference: orderMeta.manualNo,
                date: orderMeta.date,
                expectedDate: orderMeta.deliveryDate,
                customerId: parseInt(customerId),
                companyId: companyId,
                quotationId: selectedQuotation ? parseInt(selectedQuotation.id) : null,
                customFields: JSON.stringify(customFieldValues),
                manualStatus,
                status: manualStatus ? overrideStatus : undefined,
                overallDiscount: overallDiscount,
                overallDiscountType: overallDiscountType,
                notes: notes,
                terms: terms,
                billingName: customerDetails.billingName,
                billingAddress: customerDetails.billingAddress,
                billingCity: customerDetails.billingCity,
                billingState: customerDetails.billingState,
                billingZipCode: customerDetails.billingZipCode,
                billingCountry: customerDetails.billingCountry,
                shippingName: customerDetails.shippingName,
                shippingAddress: customerDetails.shippingAddress,
                shippingCity: customerDetails.shippingCity,
                shippingState: customerDetails.shippingState,
                shippingZipCode: customerDetails.shippingZipCode,
                shippingCountry: customerDetails.shippingCountry,
                items: items.map(item => ({
                    productId: item.productId ? parseInt(item.productId) : null,
                    serviceId: item.serviceId ? parseInt(item.serviceId) : null,
                    warehouseId: item.warehouseId ? parseInt(item.warehouseId) : null,
                    description: item.description || (item.productId ? allProducts.find(p => p.id === parseInt(item.productId))?.name : ''),
                    quantity: parseFloat(item.qty),
                    rate: parseFloat(item.rate),
                    discount: parseFloat(item.discount) || 0,
                    taxRate: parseFloat(item.tax),
                    uomId: item.uomId ? parseInt(item.uomId) : null
                })),
                allowDuplicateManualNo: allowDuplicate === true
            };

            let response;
            try {
                if (editingId) {
                    response = await salesOrderService.update(editingId, data, companyId);
                } else {
                    response = await salesOrderService.create(data);
                }

                if (response.data.success) {
                    toast.success(editingId ? 'Sales Order updated successfully' : 'Sales Order created successfully');
                    fetchData();
                    setShowAddModal(false);
                }
            } catch (err) {
                if (err.response?.data?.isDuplicateWarning) {
                    const confirmUse = window.confirm(err.response.data.message);
                    if (confirmUse) {
                        await handleSave(true);
                    }
                } else {
                    toast.error(err.response?.data?.message || 'Error saving sales order');
                    console.error('Error saving sales order:', err);
                }
            }
        } catch (error) {
            console.error('Error in handleSave:', error);
        }
    };


    const handleCreationModeToggle = (mode) => {
        setCreationMode(mode);
        if (mode === 'linked') {
            setShowQuotationSelect(true);
        } else {
            // Reset items but keep customer info if already filled manually? 
            // Ideally reset to clean slate for direct
            if (!editingId) resetForm();
            setCreationMode('direct');
        }
    };

    const handleSelectQuotation = (quo) => {
        setSelectedQuotation(quo);
        setCustomerId(quo.customerId);
        if (quo.notes) setNotes(quo.notes);
        setCustomerDetails({
            billingName: quo.billingName || quo.customer?.billingName || quo.customer?.name || '',
            billingAddress: quo.billingAddress || quo.customer?.billingAddress || '',
            billingCity: quo.billingCity || quo.customer?.billingCity || '',
            billingState: quo.billingState || quo.customer?.billingState || '',
            billingZipCode: quo.billingZipCode || quo.customer?.billingZipCode || '',
            billingCountry: quo.billingCountry || quo.customer?.billingCountry || '',
            email: quo.customer?.email || '',
            phone: quo.customer?.phone || '',
            shippingName: quo.shippingName || quo.customer?.shippingName || '',
            shippingAddress: quo.shippingAddress || quo.customer?.shippingAddress || '',
            shippingCity: quo.shippingCity || quo.customer?.shippingCity || '',
            shippingState: quo.shippingState || quo.customer?.shippingState || '',
            shippingZipCode: quo.shippingZipCode || quo.customer?.shippingZipCode || '',
            shippingCountry: quo.shippingCountry || quo.customer?.shippingCountry || ''
        });
        setCustomerShippingAddresses(quo.customer?.shippingaddress || []);
        setOverallDiscount(quo.overallDiscount || 0);
        setOverallDiscountType(quo.overallDiscountType || 'percentage');
        const sourceItems = quo.salesquotationitem || quo.items || [];
        setItems(sourceItems.map(item => ({
            id: Date.now() + Math.random(),
            productId: item.productId || '',
            serviceId: item.serviceId || '',
            warehouseId: item.warehouseId || '',
            description: item.description,
            qty: item.quantity,
            uomId: item.uomId || '',
            rate: item.rate,
            tax: item.taxRate,
            total: item.amount
        })));
        setShowQuotationSelect(false);
    };

    const addItem = () => {
        let defWarehouseId = '';
        if (companySettings?.inventoryConfig) {
            try {
                const parsed = typeof companySettings.inventoryConfig === 'string'
                    ? JSON.parse(companySettings.inventoryConfig)
                    : companySettings.inventoryConfig;
                if (parsed.defaultSalesWarehouseId) {
                    defWarehouseId = parseInt(parsed.defaultSalesWarehouseId);
                }
            } catch (e) {
                console.error(e);
            }
        }
        setItems([...items, { id: Date.now(), productId: '', serviceId: '', description: '', warehouseId: defWarehouseId, qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0 }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id, field, value) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === id) {
                let updatedItem;
                if (typeof field === 'object') {
                    updatedItem = { ...item, ...field };
                } else {
                    updatedItem = { ...item, [field]: value };
                }

                const qty = parseFloat(updatedItem.qty) || 0;
                const rate = parseFloat(updatedItem.rate) || 0;
                const tax = parseFloat(updatedItem.tax) || 0;
                const discount = parseFloat(updatedItem.discount) || 0;

                const subtotal = qty * rate;
                const discountAmount = discount;
                const taxable = subtotal - discountAmount;
                const taxAmount = (taxable * tax) / 100;

                updatedItem.total = taxable + taxAmount;
                return updatedItem;
            }
            return item;
        }));
    };
    const calculateTotals = () => {
        const totals = items.reduce((acc, item) => {
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const discount = parseFloat(item.discount) || 0;
            const subtotal = qty * rate;

            acc.subTotal += subtotal;
            acc.discount += discount;
            acc.total += item.total;
            acc.tax += (item.total - (subtotal - discount));
            return acc;
        }, { subTotal: 0, tax: 0, discount: 0, total: 0 });

        const baseTotal = (totals.subTotal - totals.discount) + totals.tax;
        let finalTotal = baseTotal;
        let ovDiscountAmt = 0;

        if (overallDiscount && overallDiscountType === 'percentage') {
            ovDiscountAmt = (baseTotal * overallDiscount / 100);
            finalTotal = baseTotal - ovDiscountAmt;
        } else if (overallDiscount) {
            ovDiscountAmt = parseFloat(overallDiscount);
            finalTotal = baseTotal - ovDiscountAmt;
        }

        return { ...totals, ovDiscountAmt, finalTotal };
    };

    const totalsData = calculateTotals();
    const printRef = useRef();
    const modalBodyRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `SalesOrder_${orderMeta.manualNo || 'New'}`,
    });

    // Scroll modal to top whenever it opens
    useEffect(() => {
        if (showAddModal && modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    }, [showAddModal]);

    // Handle Deep Link from Navigation State
    useEffect(() => {
        if (location.state && location.state.targetOrderId) {
            handleView(location.state.targetOrderId);
            // Clear location state after handling to prevent re-opening on re-renders
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, fetchData, navigate]);

    return (
        <div className="SalesOrder-wrapper SalesOrder-quotation-page">
            <div className="SalesOrder-page-header">
                <div>
                    <h1 className="SalesOrder-page-title">Sales Order</h1>
                    <p className="SalesOrder-page-subtitle">Track and confirm customer orders</p>
                </div>
                {hasPermission('create sales order') && (
                    <button className="SalesOrder-btn-add" onClick={handleAddNew}>
                        <Plus size={18} className="SalesOrder-mr-2" /> New Sales Order
                    </button>
                )}
            </div>

            <div className="SalesOrder-process-tracker-card">
                <div className="SalesOrder-tracker-wrapper">
                    {salesProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`SalesOrder-tracker-step SalesOrder-${step.status}`}>
                                <div className="SalesOrder-step-icon-wrapper">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="SalesOrder-status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="SalesOrder-status-badge" size={14} />}
                                </div>
                                <span className="SalesOrder-step-label">{step.label}</span>
                            </div>
                            {index < salesProcess.length - 1 && (
                                <div className={`SalesOrder-tracker-divider ${salesProcess[index + 1].status !== 'pending' ? 'SalesOrder-active' : ''}`}>
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div >

            <div className="SalesOrder-table-card mt-6">
                <div className="SalesOrder-table-controls p-4 border-b flex justify-between items-center gap-4 flex-wrap">
                    <div className="SalesOrder-search-wrapper">
                        <Search className="SalesOrder-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Order ID or Customer..."
                            className="SalesOrder-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="SalesOrder-date-filters flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">From:</span>
                            <input
                                type="date"
                                className="SalesOrder-date-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">To:</span>
                            <input
                                type="date"
                                className="SalesOrder-date-input"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        {(searchTerm || startDate || endDate) && (
                            <button
                                className="text-sm text-red-500 hover:text-red-700 font-medium"
                                onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                </div>
                <div className="SalesOrder-table-container">
                    <table className="SalesOrder-quotation-table">
                        <thead>
                            <tr>
                                <th>ORDER ID</th>
                                <th>CUSTOMER</th>
                                <th>DATE</th>
                                <th>DELIVERY DATE</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th className="text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(order => (
                                <tr key={order.id}>
                                    <td className="SalesOrder-font-bold SalesOrder-text-blue-600">{order.orderNumber}</td>
                                    <td>{order.customer?.name}</td>
                                    <td>{new Date(order.date).toLocaleDateString()}</td>
                                    <td>{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'N/A'}</td>
                                    <td className="SalesOrder-font-bold">{formatCurrency(order.totalAmount)}</td>
                                    <td>
                                        <select
                                            value={order.manualStatus ? order.status : 'AUTO'}
                                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                             className="SalesOrder-sales-order-status-pill"
                                             style={getStatusStyle(order.manualStatus ? order.status : 'AUTO')}
                                        >
                                            <option value="AUTO">Auto ({order.status || 'Pending'})</option>
                                            <option value="PENDING">PENDING</option>
                                            <option value="PARTIAL">PARTIAL</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                            <option value="CANCELLED">CANCELLED</option>
                                        </select>
                                    </td>
                                    <td>
                                        <div className="SalesOrder-sales-action-buttons">
                                            <button className="SalesOrder-sales-order-action-btn SalesOrder-view" onClick={() => handleView(order.id)} title="View"><Eye size={16} /></button>
                                            {order.status !== 'CONVERTED' ? (
                                                <button className="SalesOrder-sales-order-action-btn SalesOrder-convert" onClick={() => handleConvert(order.id)} title="Convert to Delivery Challan" style={{ backgroundColor: '#4f46e5', color: 'white' }}><Truck size={16} /></button>
                                            ) : (
                                                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-500 rounded" style={{ alignSelf: 'center' }}>Converted</span>
                                            )}
                                            {hasPermission('edit sales order') && (
                                                <button className="SalesOrder-sales-order-action-btn SalesOrder-edit" onClick={() => handleEdit(order.id)} title="Edit"><Pencil size={16} /></button>
                                            )}
                                            {hasPermission('delete sales order') && (
                                                <button className="SalesOrder-sales-order-action-btn SalesOrder-delete" onClick={() => handleDelete(order.id)} title="Delete"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Premium Create/Edit Modal */}
            {
                showAddModal && (
                    <div className="SalesOrder-modal-overlay">
                        <div className="SalesOrder-modal-content SalesOrder-quotation-form-modal">
                            <div className="SalesOrder-modal-header-simple">
                                <h2 className="SalesOrder-text-xl SalesOrder-font-bold SalesOrder-text-gray-800">
                                    {isViewMode ? 'View Sales Order' : editingId ? 'Edit Sales Order' : 'New Sales Order'}
                                </h2>
                                <div className="flex items-center gap-4">
                                    {isViewMode && (
                                        <button className="SalesOrder-btn-print-header" onClick={handlePrint}>
                                            <Printer size={20} />
                                        </button>
                                    )}
                                    <button className="SalesOrder-close-btn-simple" onClick={() => setShowAddModal(false)}>
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            <div className="SalesOrder-modal-body-scrollable" ref={(el) => { printRef.current = el; modalBodyRef.current = el; }}>
                                {isViewMode ? (
                                    <div className="SalesOrder-view-document">
                                        <div
                                            className={`invoice-preview-container template-${(companySettings?.invoiceTemplate || 'New York').toLowerCase().replace(' ', '').replace('invoice-', '')}`}
                                            style={{
                                                '--header-bg': companySettings?.invoiceColor || '#004aad',
                                                '--header-text': (() => {
                                                    const hex = (companySettings?.invoiceColor || '#004aad').replace('#', '');
                                                    const r = parseInt(hex.substr(0, 2), 16);
                                                    const g = parseInt(hex.substr(2, 2), 16);
                                                    const b = parseInt(hex.substr(4, 2), 16);
                                                    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                                                    return (yiq >= 150) ? '#1e293b' : '#ffffff';
                                                })()
                                            }}
                                        >
                                            {getInvoiceLabel('showHeader') !== false && (
                                                <div className="invoice-header-wrapper" style={{ border: 'none', padding: '0', margin: '0' }}>
                                                    <div className="invoice-preview-header" style={{ marginBottom: '10px' }}>
                                                        <div className="invoice-header-left">
                                                            {(companySettings?.invoiceLogo || companyDetails.logo) && (
                                                                <img src={companySettings?.invoiceLogo || companyDetails.logo} alt="Company Logo" className="invoice-logo-large" style={{ margin: '0' }} />
                                                            )}
                                                        </div>
                                                        <div className="invoice-header-right">
                                                            <div className="invoice-title-large" style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0' }}>{getDocumentTitle('salesorder')}</div>
                                                        </div>
                                                    </div>

                                                    <div className="invoice-preview-header" style={{ alignItems: 'flex-start' }}>
                                                        <div className="invoice-header-left">
                                                            <div className="invoice-company-details">
                                                                <h2 style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0 0 5px 0', fontSize: '1.6rem', fontWeight: '900' }}>
                                                                    {companyDetails.name}
                                                                </h2>
                                                                <p>{companyDetails.address}</p>
                                                                <p>{companyDetails.email} | {companyDetails.phone}</p>
                                                            </div>
                                                        </div>
                                                        <div className="invoice-header-right">
                                                            <div className="invoice-meta-info">
                                                                <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                    <span className="invoice-label">Order No:</span>
                                                                    <span>#{editingId ? salesOrders.find(o => o.id === editingId)?.orderNumber : ""}</span>
                                                                </div>
                                                                <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                    <span className="invoice-label">Manual Ref:</span>
                                                                    <span>{orderMeta.manualNo || 'N/A'}</span>
                                                                </div>
                                                                <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                    <span className="invoice-label">Order Date:</span>
                                                                    <span>{orderMeta.date}</span>
                                                                </div>
                                                                <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                    <span className="invoice-label">Delivery Due:</span>
                                                                    <span>{orderMeta.deliveryDate || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="invoice-addresses" style={{ display: 'flex', justifyContent: 'space-between', width: '100% !important', marginTop: '2.5rem', gap: '3rem' }}>
                                                <div className="invoice-bill-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                    <div className="invoice-section-header">BILL TO</div>
                                                    <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                                        {customerDetails.billingName || customers.find(c => c.id === parseInt(customerId))?.name || 'N/A'}
                                                    </div>
                                                    <div style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                                        {customerDetails.billingAddress || 'N/A'}
                                                    </div>
                                                    <div style={{ color: '#475569', fontWeight: '500', fontSize: '0.95rem' }}>
                                                        {customerDetails.email} | {customerDetails.phone}
                                                    </div>
                                                </div>

                                                <div className="invoice-ship-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                    <div className="invoice-section-header">SHIP TO</div>
                                                    <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                                        {customerDetails.shippingName || 'N/A'}
                                                    </div>
                                                    <div style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                                        {customerDetails.shippingAddress || 'N/A'}
                                                    </div>
                                                    {(customerDetails.shippingCity || customerDetails.shippingState || customerDetails.shippingZipCode || customerDetails.shippingCountry) && (
                                                        <div style={{ color: '#475569', fontWeight: '500', fontSize: '0.95rem' }}>
                                                            {customerDetails.shippingCity && `${customerDetails.shippingCity}, `}
                                                            {customerDetails.shippingState && `${customerDetails.shippingState} - `}
                                                            {customerDetails.shippingZipCode && `${customerDetails.shippingZipCode}, `}
                                                            {customerDetails.shippingCountry && `${customerDetails.shippingCountry}`}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Custom Fields Print View */}
                                            {(() => {
                                                const order = salesOrders.find(o => o.id === editingId);
                                                let customFieldVals = {};
                                                if (order?.customFields) {
                                                    try {
                                                        customFieldVals = typeof order.customFields === 'string'
                                                            ? JSON.parse(order.customFields)
                                                            : order.customFields;
                                                    } catch (e) {
                                                        console.error('Error parsing sales order custom fields for view:', e);
                                                    }
                                                }
                                                const fieldsList = getCustomFieldsForType('salesorder');
                                                const activeCustomFields = fieldsList.filter(f => customFieldVals[f.label]);
                                                if (activeCustomFields.length === 0) return null;
                                                return (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', margin: '20px 0', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', textAlign: 'left' }}>
                                                        {activeCustomFields.map(field => (
                                                            <div key={field.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{field.label}</span>
                                                                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1e293b', marginTop: '2px' }}>{customFieldVals[field.label]}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}

                                            <table className="invoice-table-preview" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('item', 'Item Detail').toUpperCase()}</th>
                                                        {getInvoiceLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showUom') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>UOM</th>}
                                                        {getInvoiceLabel('showRate') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('rate', 'Rate').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showTax') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('tax', 'Tax %').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showDiscount') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('discount', 'Discount').toUpperCase()}</th>}
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>{getTableHeader('price', 'Amount').toUpperCase()}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item, idx) => (
                                                        <tr key={item.id}>
                                                            <td style={{ width: '35%' }}>
                                                                <span className="font-bold text-sm text-gray-800 block">
                                                                    {item.productId ? allProducts.find(p => p.id === parseInt(item.productId))?.name : 
                                                                     item.serviceId ? allServices.find(s => s.id === parseInt(item.serviceId))?.name : 
                                                                     'N/A'}
                                                                </span>
                                                                {item.description && <span className="text-xs text-gray-500 block mt-0.5">{item.description}</span>}
                                                            </td>
                                                            {getInvoiceLabel('showWarehouse') !== false && <td>{allWarehouses.find(w => w.id === parseInt(item.warehouseId))?.name || 'N/A'}</td>}
                                                            {getInvoiceLabel('showQty') !== false && <td>{item.qty}</td>}
                                                            {getInvoiceLabel('showUom') !== false && <td>{allUoms.find(u => u.id === parseInt(item.uomId))?.unitName || ''}</td>}
                                                            {getInvoiceLabel('showRate') !== false && <td>{formatCurrency(item.rate)}</td>}
                                                            {getInvoiceLabel('showTax') !== false && <td>{item.tax}%</td>}
                                                            {getInvoiceLabel('showDiscount') !== false && <td>{formatCurrency(item.discount)}</td>}
                                                            <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.total || 0)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <div className="invoice-total-section">
                                                <div className="invoice-totals">
                                                    <div className="invoice-total-row">
                                                        <span>Sub Total</span>
                                                        <span>{formatCurrency(totalsData.subTotal)}</span>
                                                    </div>
                                                    <div className="invoice-total-row text-red-600">
                                                        <span>Discount</span>
                                                        <span>-{formatCurrency(totalsData.discount + totalsData.ovDiscountAmt)}</span>
                                                    </div>
                                                    {getInvoiceLabel('showTax') !== false && (
                                                        <div className="invoice-total-row">
                                                            <span>Tax Total</span>
                                                            <span>{formatCurrency(totalsData.tax)}</span>
                                                        </div>
                                                    )}
                                                    <div className="invoice-final-total">
                                                        <span>Grand Total</span>
                                                        <span>{formatCurrency(totalsData.finalTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bank Details Section - View Mode Only */}
                                            {isViewMode && (bankDetails.bankName || bankDetails.accNo) && (
                                                <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                                    <h3 className="invoice-section-header" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Details</h3>
                                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {bankDetails.bankName && <span style={{ color: '#0ea5e9', fontWeight: '600', fontSize: '0.95rem' }}>{bankDetails.bankName}</span>}
                                                        {bankDetails.accNo && <span style={{ color: '#334155', fontSize: '0.9rem' }}>{bankDetails.accNo}</span>}
                                                        {bankDetails.holderName && <span style={{ color: '#0ea5e9', fontWeight: '600', fontSize: '0.9rem' }}>{bankDetails.holderName}</span>}
                                                        {bankDetails.ifsc && <span style={{ color: '#0ea5e9', fontWeight: '600', fontSize: '0.9rem' }}>{bankDetails.ifsc}</span>}
                                                    </div>
                                                </div>
                                            )}

                                            {getInvoiceLabel('showFooter') !== false && (notes || terms) && (
                                                <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                                    <h3 className="invoice-section-header">Notes &amp; Terms</h3>
                                                    {notes && <p style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'pre-line', marginBottom: '8px' }}>{notes}</p>}
                                                    {terms && (
                                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                            <strong>Terms &amp; Conditions:</strong> {terms}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="SalesOrder-create-edit-form">
                                        {hasPermission('bypass strict conversion') && !editingId && (
                                            <div className="SalesOrder-mode-toggle mb-4 flex gap-2">
                                                <button 
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${creationMode === 'direct' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                                    onClick={() => handleCreationModeToggle('direct')}
                                                >
                                                    Direct Order
                                                </button>
                                                <button 
                                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${creationMode === 'linked' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                                    onClick={() => handleCreationModeToggle('linked')}
                                                >
                                                    From Quotation
                                                </button>
                                            </div>
                                        )}

                                        {/* Quotation Selection List (Conditional) */}
                                        {creationMode === 'linked' && showQuotationSelect && !selectedQuotation && (
                                            <div className="SalesOrder-quotation-link-container">
                                                <div className="SalesOrder-quotation-controls-row">
                                                    <div className="SalesOrder-form-group">
                                                        <label className="SalesOrder-form-label-sm">Select Customer First</label>
                                                        <select
                                                            className="SalesOrder-form-select-compact"
                                                            value={quotationFilterCustomerId}
                                                            onChange={(e) => setQuotationFilterCustomerId(e.target.value)}
                                                        >
                                                            <option value="">Choose Customer...</option>
                                                            {customers.map(c => {
                                                                const quoteCount = activeQuotations.filter(q => q.customerId === c.id).length;
                                                                return (
                                                                    <option key={c.id} value={c.id}>
                                                                        {c.name} ({quoteCount} Quotations)
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>

                                                    <div className="SalesOrder-form-group">
                                                        <label className="SalesOrder-form-label-sm">Search Quotations</label>
                                                        <div className="SalesOrder-quotation-search-mini">
                                                            <Search size={14} className="SalesOrder-q-search-icon-mini" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search quotes..."
                                                                className="SalesOrder-q-search-input-mini"
                                                                value={quotationSearchTerm}
                                                                onChange={(e) => setQuotationSearchTerm(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <h4 className="SalesOrder-form-label-sm SalesOrder-mb-2">
                                                    {quotationFilterCustomerId
                                                        ? `Available Quotations (${filteredQuotationList.length})`
                                                        : 'All Available Quotations'}
                                                </h4>
                                                <div className="SalesOrder-quote-grid">
                                                    {filteredQuotationList.length === 0 ? (
                                                        <div className="SalesOrder-text-center SalesOrder-py-8 SalesOrder-text-gray-400 SalesOrder-col-span-full">
                                                            No matching quotations found
                                                        </div>
                                                    ) : (
                                                        filteredQuotationList.map(quo => (
                                                            <div key={quo.id} className="SalesOrder-quote-link-card" onClick={() => handleSelectQuotation(quo)}>
                                                                <div className="SalesOrder-q-card-header">
                                                                    <span className="SalesOrder-q-id SalesOrder-text-blue-600 SalesOrder-font-bold">{quo.quotationNumber}</span>
                                                                    <span className="SalesOrder-q-date SalesOrder-text-gray-400 SalesOrder-text-xs">{new Date(quo.date).toLocaleDateString()}</span>
                                                                </div>
                                                                <div className="SalesOrder-q-card-body SalesOrder-mt-2">
                                                                    <span className="SalesOrder-q-customer SalesOrder-font-semibold">{quo.customer?.name}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Top Section: Meta Details in Row */}
                                        <div className="SalesOrder-meta-header-row">
                                            <div className="SalesOrder-meta-item">
                                                <label>Order No.</label>
                                                <input
                                                    type="text"
                                                    value={orderNumber}
                                                    onChange={(e) => setOrderNumber(e.target.value)}
                                                    disabled={isViewMode || !!editingId}
                                                    className={`SalesOrder-meta-input ${isViewMode || editingId ? 'SalesOrder-disabled' : ''}`}
                                                />
                                            </div>
                                            <div className="SalesOrder-meta-item">
                                                <label>Manual Ref</label>
                                                <input type="text" placeholder="e.g. PO-REF-001"
                                                    value={orderMeta.manualNo} onChange={(e) => setOrderMeta({ ...orderMeta, manualNo: e.target.value })}
                                                    className="SalesOrder-meta-input" />
                                            </div>
                                            <div className="SalesOrder-meta-item">
                                                <label>Order Date</label>
                                                <input type="date"
                                                    value={orderMeta.date} onChange={(e) => setOrderMeta({ ...orderMeta, date: e.target.value })}
                                                    className="SalesOrder-meta-input" />
                                            </div>
                                            <div className="SalesOrder-meta-item">
                                                <label>Delivery Due</label>
                                                <input type="date"
                                                    value={orderMeta.deliveryDate} onChange={(e) => setOrderMeta({ ...orderMeta, deliveryDate: e.target.value })}
                                                    className="SalesOrder-meta-input" />
                                            </div>
                                        </div>

                                        <hr className="SalesOrder-divider" />

                                        {/* Customer Selection Row & Address Grid */}
                                        <div className="SalesOrder-customer-section-compact">
                                            <div className="SalesOrder-customer-header-row">
                                                <div className="SalesOrder-form-group">
                                                    <label className="SalesOrder-form-label-sm">Select Customer</label>
                                                    <select
                                                        className="SalesOrder-form-select-compact"
                                                        value={customerId}
                                                        onChange={(e) => {
                                                            const id = e.target.value;
                                                            setCustomerId(id);
                                                            const c = customers.find(cust => cust.id === parseInt(id));
                                                            if (c) {
                                                                setCustomerDetails({
                                                                    billingName: c.billingName || c.name || '',
                                                                    billingAddress: c.billingAddress || '',
                                                                    billingCity: c.billingCity || '',
                                                                    billingState: c.billingState || '',
                                                                    billingZipCode: c.billingZipCode || '',
                                                                    billingCountry: c.billingCountry || '',
                                                                    email: c.email || '',
                                                                    phone: c.phone || '',
                                                                    shippingName: c.shippingName || '',
                                                                    shippingAddress: c.shippingAddress || '',
                                                                    shippingCity: c.shippingCity || '',
                                                                    shippingState: c.shippingState || '',
                                                                    shippingZipCode: c.shippingZipCode || '',
                                                                    shippingCountry: c.shippingCountry || ''
                                                                });
                                                                setCustomerShippingAddresses(c.shippingaddress || []);
                                                            }
                                                        }}
                                                        disabled={creationMode === 'linked'}
                                                    >
                                                        <option value="">Select Customer...</option>
                                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>

                                                {customerId && !isViewMode && (
                                                    <div className="SalesOrder-form-group">
                                                        <label className="SalesOrder-form-label-sm">Shipping Address Selector</label>
                                                        <select
                                                            className="SalesOrder-form-select-compact"
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === 'primary') {
                                                                    const c = customers.find(cust => cust.id === parseInt(customerId));
                                                                    if (c) {
                                                                        setCustomerDetails({
                                                                            ...customerDetails,
                                                                            shippingName: c.shippingName || '',
                                                                            shippingAddress: c.shippingAddress || '',
                                                                            shippingCity: c.shippingCity || '',
                                                                            shippingState: c.shippingState || '',
                                                                            shippingZipCode: c.shippingZipCode || '',
                                                                            shippingCountry: c.shippingCountry || ''
                                                                        });
                                                                    }
                                                                } else {
                                                                    const addr = customerShippingAddresses.find(a => a.id === parseInt(val));
                                                                    if (addr) {
                                                                        setCustomerDetails({
                                                                            ...customerDetails,
                                                                            shippingName: addr.name || '',
                                                                            shippingAddress: addr.address || '',
                                                                            shippingCity: addr.city || '',
                                                                            shippingState: addr.state || '',
                                                                            shippingZipCode: addr.zipCode || '',
                                                                            shippingCountry: addr.country || ''
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <option value="">Choose Shipping Address...</option>
                                                            <option value="primary">Primary Address</option>
                                                            {customerShippingAddresses.map(addr => (
                                                                <option key={addr.id} value={addr.id}>
                                                                    {addr.name} - {addr.city}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="SalesOrder-address-container-grid mt-4">
                                                <div className="SalesOrder-address-box">
                                                    <div className="SalesOrder-address-header">
                                                        <label className="SalesOrder-form-label-sm">Bill To</label>
                                                    </div>
                                                    <input type="text" placeholder="Billing Name" className="SalesOrder-detail-input SalesOrder-mb-2"
                                                        disabled={true} readOnly
                                                        value={customerDetails.billingName} />
                                                    <textarea placeholder="Billing Address" className="SalesOrder-detail-textarea"
                                                        disabled={true} readOnly rows="3"
                                                        value={customerDetails.billingAddress} />
                                                    <div className="SalesOrder-customer-contact-grid SalesOrder-mt-2">
                                                        <input type="email" placeholder="Email Address" className="SalesOrder-detail-input"
                                                            disabled={true} readOnly
                                                            value={customerDetails.email} />
                                                        <input type="tel" placeholder="Phone Number" className="SalesOrder-detail-input"
                                                            disabled={true} readOnly
                                                            value={customerDetails.phone} />
                                                    </div>
                                                </div>

                                                <div className="SalesOrder-address-box">
                                                    <div className="SalesOrder-address-header">
                                                        <label className="SalesOrder-form-label-sm">Ship To</label>
                                                    </div>
                                                    <input type="text" placeholder="Shipping Name" className="SalesOrder-detail-input SalesOrder-mb-2"
                                                        disabled={true} readOnly
                                                        value={customerDetails.shippingName} />
                                                    <textarea placeholder="Shipping Address" className="SalesOrder-detail-textarea SalesOrder-mb-2"
                                                        disabled={true} readOnly rows="2"
                                                        value={customerDetails.shippingAddress} />
                                                    <div className="SalesOrder-shipping-grid SalesOrder-mb-2">
                                                        <input type="text" placeholder="City" className="SalesOrder-detail-input"
                                                            disabled={true} readOnly value={customerDetails.shippingCity} />
                                                        <input type="text" placeholder="State" className="SalesOrder-detail-input"
                                                            disabled={true} readOnly value={customerDetails.shippingState} />
                                                    </div>
                                                    <div className="SalesOrder-shipping-grid">
                                                        <input type="text" placeholder="Zip Code" className="SalesOrder-detail-input"
                                                            disabled={true} readOnly value={customerDetails.shippingZipCode} />
                                                        <input type="text" placeholder="Country" className="SalesOrder-detail-input"
                                                            disabled={true} readOnly value={customerDetails.shippingCountry} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Custom Fields Section */}
                                        {getCustomFieldsForType('salesorder').length > 0 && (
                                            <div className="SalesOrder-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Custom Fields
                                                </h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                                    {getCustomFieldsForType('salesorder').map(field => (
                                                        <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', textAlign: 'left' }}>
                                                                {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                                                            </label>
                                                            {field.type === 'select' ? (
                                                                <select
                                                                    value={customFieldValues[field.label] || ''}
                                                                    onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                                                                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', backgroundColor: 'white' }}
                                                                    required={field.required}
                                                                >
                                                                    <option value="">Select...</option>
                                                                    {(field.options || '').split(',').map(opt => opt.trim()).filter(Boolean).map(opt => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    placeholder={`Enter ${field.label}`}
                                                                    value={customFieldValues[field.label] || ''}
                                                                    onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                                                                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%' }}
                                                                    required={field.required}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {creationMode === 'linked' && selectedQuotation && (
                                            <div className="SalesOrder-linked-indicator mb-6">
                                                <FileSearch size={14} /> Linked to Quotation: <strong>{selectedQuotation.quotationNumber || selectedQuotation.id}</strong>
                                                <button className="SalesOrder-change-link-btn" onClick={() => setShowQuotationSelect(true)}>Change</button>
                                            </div>
                                        )}

                                        {/* Items Table */}
                                        <div className="SalesOrder-items-section-new">
                                            {creationMode === 'direct' && (
                                                <button className="SalesOrder-btn-add-row" onClick={addItem}>
                                                    <Plus size={14} /> Add Line Item
                                                </button>
                                            )}
                                            <div className="SalesOrder-table-responsive">
                                                <table className="SalesOrder-new-items-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '20%' }}>{getTableHeader('item', 'Item Name').toUpperCase()}</th>
                                                            {getInvoiceLabel('showWarehouse') !== false && <th style={{ width: '12%' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                                            {getInvoiceLabel('showQty') !== false && <th style={{ width: '8%' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                                            {getInvoiceLabel('showUom') !== false && <th style={{ width: '10%' }}>UOM</th>}
                                                            {getInvoiceLabel('showRate') !== false && <th style={{ width: '12%' }}>{getTableHeader('rate', 'Rate').toUpperCase()}</th>}
                                                            {getInvoiceLabel('showTax') !== false && <th style={{ width: '10%' }}>{getTableHeader('tax', 'Tax %').toUpperCase()}</th>}
                                                            {getInvoiceLabel('showDiscount') !== false && <th style={{ width: '10%' }}>{getTableHeader('discount', 'Discount').toUpperCase()}</th>}
                                                            <th style={{ width: '12%' }}>{getTableHeader('price', 'Amount').toUpperCase()}</th>
                                                            <th style={{ width: '6%' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.map(item => (
                                                            <tr key={item.id}>
                                                                <td>
                                                                    <select className="SalesOrder-full-width-input"
                                                                        value={item.productId ? `p-${item.productId}` : item.serviceId ? `s-${item.serviceId}` : ''}
                                                                        disabled={isViewMode || creationMode === 'linked'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (val.startsWith('p-')) {
                                                                                const pId = val.split('-')[1];
                                                                                const p = allProducts.find(x => x.id === parseInt(pId));
                                                                                if (p) {
                                                                                    updateItem(item.id, {
                                                                                        productId: pId,
                                                                                        serviceId: '',
                                                                                        rate: p.salePrice || 0,
                                                                                        tax: p.taxRate || 0,
                                                                                        description: item.description || p.name,
                                                                                        uomId: p.salesUomId || p.uomId || ''
                                                                                    });
                                                                                }
                                                                            } else if (val.startsWith('s-')) {
                                                                                const sId = val.split('-')[1];
                                                                                const s = allServices.find(x => x.id === parseInt(sId));
                                                                                if (s) {
                                                                                    updateItem(item.id, {
                                                                                        serviceId: sId,
                                                                                        productId: '',
                                                                                        rate: s.price || 0,
                                                                                        tax: s.taxRate || 0,
                                                                                        description: item.description || s.name,
                                                                                        uomId: s.uomId || ''
                                                                                    });
                                                                                }
                                                                            }
                                                                        }}>
                                                                        <option value="">Select Product/Service...</option>
                                                                        <optgroup label="Products">
                                                                            {allProducts.map(p => <option key={`p-${p.id}`} value={`p-${p.id}`}>{p.name} ({p.totalQuantity ?? 0})</option>)}
                                                                        </optgroup>
                                                                        <optgroup label="Services">
                                                                            {allServices.map(s => <option key={`s-${s.id}`} value={`s-${s.id}`}>{s.name}</option>)}
                                                                        </optgroup>
                                                                    </select>
                                                                </td>
                                                                {getInvoiceLabel('showWarehouse') !== false && (
                                                                    <td>
                                                                        <select className="SalesOrder-full-width-input" value={item.warehouseId} onChange={(e) => updateItem(item.id, 'warehouseId', e.target.value)}>
                                                                            <option value="">Select Warehouse...</option>
                                                                            {allWarehouses.map(w => {
                                                                                const prodId = item.productId ? (String(item.productId).startsWith('p-') ? parseInt(String(item.productId).replace('p-', '')) : parseInt(item.productId)) : null;
                                                                                const prod = prodId ? allProducts.find(p => p.id === prodId) : null;
                                                                                const stockItem = prod?.stock?.find(s => Number(s.warehouseId) === Number(w.id));
                                                                                const count = stockItem ? stockItem.quantity : 0;
                                                                                return <option key={w.id} value={w.id}>{w.name} ({count})</option>;
                                                                            })}
                                                                        </select>
                                                                    </td>
                                                                )}
                                                                {getInvoiceLabel('showQty') !== false && (
                                                                    <td>
                                                                        <input type="number" value={item.qty} disabled={creationMode === 'linked'}
                                                                            onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                                                                            className="SalesOrder-qty-input" />
                                                                    </td>
                                                                )}
                                                                {getInvoiceLabel('showUom') !== false && (
                                                                    <td>
                                                                        {item.productId || item.serviceId ? (
                                                                            <select className="SalesOrder-full-width-input" value={item.uomId}
                                                                                disabled={isViewMode}
                                                                                onChange={(e) => updateItem(item.id, 'uomId', e.target.value)}>
                                                                                <option value="">Select UOM...</option>
                                                                                {allUoms
                                                                                    .filter(u => {
                                                                                        const prod = allProducts.find(p => p.id === (String(item.productId).startsWith('p-') ? parseInt(String(item.productId).replace('p-', '')) : parseInt(item.productId)));
                                                                                        const serv = allServices.find(s => s.id === (String(item.serviceId).startsWith('s-') ? parseInt(String(item.serviceId).replace('s-', '')) : parseInt(item.serviceId)));
                                                                                        const category = prod?.uom?.category || prod?.salesUom?.category || serv?.uom?.category;
                                                                                        const baseUnitId = prod?.uomId || prod?.salesUomId || serv?.uomId;
                                                                                        return u.category === category || u.baseUnitId === baseUnitId || u.id === baseUnitId;
                                                                                    })
                                                                                    .map(u => (
                                                                                        <option key={u.id} value={u.id}>
                                                                                            {u.unitName}
                                                                                        </option>
                                                                                    ))
                                                                                }
                                                                            </select>
                                                                        ) : (
                                                                            <span className="text-gray-400 text-xs flex justify-center items-center h-full">N/A</span>
                                                                        )}
                                                                    </td>
                                                                )}
                                                                {getInvoiceLabel('showRate') !== false && (
                                                                    <td>
                                                                        <input type="number" value={item.rate} disabled={creationMode === 'linked'}
                                                                            onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                                                                            className="SalesOrder-rate-input" />
                                                                    </td>
                                                                )}
                                                                {getInvoiceLabel('showTax') !== false && (
                                                                    <td>
                                                                        <input type="number" value={item.tax} disabled={creationMode === 'linked'}
                                                                            onChange={(e) => updateItem(item.id, 'tax', e.target.value)}
                                                                            className="SalesOrder-tax-input" />
                                                                    </td>
                                                                )}
                                                                {getInvoiceLabel('showDiscount') !== false && (
                                                                    <td>
                                                                        <input type="number" value={item.discount} disabled={creationMode === 'linked'}
                                                                            onChange={(e) => updateItem(item.id, 'discount', e.target.value)}
                                                                            className="SalesOrder-discount-input" />
                                                                    </td>
                                                                )}
                                                                <td>
                                                                    <input type="text" value={formatCurrency(item.total || 0)} disabled className="SalesOrder-amount-input SalesOrder-disabled" />
                                                                </td>
                                                                <td className="SalesOrder-text-center">
                                                                    {creationMode === 'direct' && !isViewMode && (
                                                                        <button className="SalesOrder-btn-delete-row" onClick={() => removeItem(item.id)}>
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Totals Section */}
                                        <div className="SalesOrder-totals-layout">
                                            <div className="SalesOrder-totals-spacer"></div>
                                            <div className="SalesOrder-totals-box">
                                                <div className="SalesOrder-t-row">
                                                    <span>Sub Total:</span>
                                                    <span>{formatCurrency(totalsData.subTotal)}</span>
                                                </div>
                                                <div className="SalesOrder-t-row">
                                                    <span>Discount:</span>
                                                    <span className="SalesOrder-text-red-500">-{formatCurrency(totalsData.discount)}</span>
                                                </div>
                                                <div className="SalesOrder-t-row">
                                                    <span>Tax Total:</span>
                                                    <span>{formatCurrency(totalsData.tax)}</span>
                                                </div>

                                                <div className="SalesOrder-t-row items-center gap-2 mt-4 pt-4 border-t border-dashed">
                                                    <span className="flex-1">Overall Discount:</span>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            className="SalesOrder-rate-input w-20 text-xs"
                                                            value={overallDiscount}
                                                            onChange={(e) => setOverallDiscount(e.target.value)}
                                                        />
                                                        <select
                                                            className="SalesOrder-shipping-selector text-xs p-1"
                                                            value={overallDiscountType}
                                                            onChange={(e) => setOverallDiscountType(e.target.value)}
                                                        >
                                                            <option value="percentage">%</option>
                                                            <option value="fixed">Fixed</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="SalesOrder-t-row SalesOrder-total">
                                                    <span>Grand Total:</span>
                                                    <span>{formatCurrency(totalsData.finalTotal)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes & Terms at bottom */}
                                        <div className="SalesOrder-bottom-textareas-row">
                                            <div className="SalesOrder-notes-section my-4">
                                                <label className="SalesOrder-section-label">Notes</label>
                                                <textarea className="SalesOrder-notes-area"
                                                    value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
                                            </div>

                                            <div className="SalesOrder-terms-section my-4">
                                                <label className="SalesOrder-section-label">Terms & Conditions</label>
                                                <textarea className="SalesOrder-terms-area"
                                                    value={terms} onChange={(e) => setTerms(e.target.value)}></textarea>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="SalesOrder-modal-footer-simple">
                                <button className="SalesOrder-btn-plain" onClick={() => setShowAddModal(false)}>Close</button>
                                {isViewMode && (
                                    <>
                                        {salesOrders.find(o => o.id === editingId)?.status !== 'CONVERTED' ? (
                                            <button className="SalesOrder-btn-primary-green" onClick={() => handleConvert(editingId)} style={{ backgroundColor: '#4f46e5' }}>
                                                <Truck size={18} className="mr-2" /> Convert to Delivery Challan
                                            </button>
                                        ) : (
                                            <span className="text-sm font-semibold px-3 py-2 bg-gray-100 text-gray-500 rounded mr-2">Already Converted</span>
                                        )}
                                        <button className="SalesOrder-btn-primary-green" onClick={handlePrint}>
                                            <Printer size={18} className="mr-2" /> Print Order
                                        </button>
                                    </>
                                )}
                                {!isViewMode && (
                                    <button className="SalesOrder-btn-primary-green" onClick={handleSave}>
                                        {editingId ? 'Update Order' : 'Confirm Order'}
                                    </button>
                                )}
                            </div >
                        </div >
                    </div >
                )
            }

            {/* Delete Confirmation Modal - User Design Match */}
            {
                showDeleteConfirm && (
                    <div className="SalesOrder-modal-overlay">
                        <div className="SalesOrder-delete-confirmation-box">
                            <div className="SalesOrder-delete-modal-header">
                                <h3 className="SalesOrder-delete-modal-title">Delete Order?</h3>
                                <button className="SalesOrder-delete-close-btn" onClick={() => setShowDeleteConfirm(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="SalesOrder-delete-modal-body">
                                <p>Are you sure you want to delete this sales order? This action cannot be undone.</p>
                            </div>
                            <div className="SalesOrder-delete-modal-footer">
                                <button className="SalesOrder-btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                                <button className="SalesOrder-btn-delete-confirm" onClick={confirmDelete}>Delete</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default SalesOrder;
