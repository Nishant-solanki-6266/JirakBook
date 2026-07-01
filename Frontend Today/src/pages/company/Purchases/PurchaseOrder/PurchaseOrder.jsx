import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useReactToPrint } from 'react-to-print';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Printer, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './PurchaseOrder.css';
import '../../Sales/Invoice/Invoice.css';
import purchaseOrderService from '../../../../services/purchaseOrderService';
import vendorService from '../../../../services/vendorService';
import productService from '../../../../api/productService';
import warehouseService from '../../../../api/warehouseService';
import companyService from '../../../../api/companyService';
import purchaseQuotationService from '../../../../services/purchaseQuotationService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { BASE_URL } from '../../../../api/axiosInstance';
import uomService from '../../../../services/uomService';

const PurchaseOrder = () => {
    const { hasPermission } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const targetOrderId = location.state?.targetOrderId;
    const sourceData = location.state?.sourceData; // content from Quotation if applicable
    const { formatCurrency, getTableHeader, getInvoiceLabel, companySettings, getDocumentTitle } = useContext(CompanyContext);

    // --- State Management ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vendors, setVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [quotations, setQuotations] = useState([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Form State
    const [companyDetails, setCompanyDetails] = useState({
        name: '', address: '', email: '', phone: '', logo: '', notes: '', terms: ''
    });
    const [orderMeta, setOrderMeta] = useState({
        orderNumber: '', date: new Date().toISOString().split('T')[0], deliveryDate: ''
    });
    const [vendorId, setVendorId] = useState('');
    const [items, setItems] = useState([
        { id: Date.now(), productId: '', warehouseId: '', qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }
    ]);
    const [allUoms, setAllUoms] = useState([]);
    const [notes, setNotes] = useState('');
    const [terms, setTerms] = useState('');
    const [overallDiscount, setOverallDiscount] = useState(0);
    const [overallDiscountType, setOverallDiscountType] = useState('percentage');
    const [customFieldValues, setCustomFieldValues] = useState({});
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

    // Toggle State
    const [orderType, setOrderType] = useState('direct'); // 'direct' | 'quotation'
    const [selectedQuotationId, setSelectedQuotationId] = useState('');
    const [quotationSearchTerm, setQuotationSearchTerm] = useState('');
    const [isQuotationDropdownOpen, setIsQuotationDropdownOpen] = useState(false);
    const quotationDropdownRef = useRef(null);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const printRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `PurchaseOrder_${orderMeta.orderNumber || 'New'}`,
    });

    useEffect(() => {
        fetchInitialData();
        fetchOrders();
    }, []);

    useEffect(() => {
        if (targetOrderId && orders.length > 0) {
            handleView(targetOrderId);
            // Clear navigation state to prevent re-opening on refresh
            navigate(location.pathname, { replace: true, state: { ...location.state, targetOrderId: undefined } });
        }
    }, [targetOrderId, orders]);

    // Handle Source Data (Auto-fill from Quotation)
    useEffect(() => {
        if (sourceData && !editingId && vendors.length > 0) {
            setVendorId(sourceData.vendorId); // ensuring vendorId is passed
            setNotes(sourceData.notes || '');
            if (sourceData.items) {
                const mappedItems = sourceData.items.map(i => ({
                    id: Date.now() + Math.random(),
                    productId: i.productId || '',
                    warehouseId: i.warehouseId || '',
                    qty: i.quantity,
                    uomId: i.uomId || '',
                    rate: i.rate,
                    discount: i.discount,
                    tax: i.taxRate,
                    total: i.amount,
                    description: i.description
                }));
                setItems(mappedItems);
            }
            setShowAddModal(true);
        }
    }, [sourceData, editingId, vendors]);

    // Fetch next PO number when modal opens
    useEffect(() => {
        const loadNextNo = async () => {
            if (showAddModal && !editingId) {
                try {
                    const companyId = GetCompanyId();
                    if (companyId) {
                        const res = await companyService.getNextNumber(companyId, 'purchaseorder');
                        if (res.data.success) {
                            setOrderMeta(prev => ({ ...prev, orderNumber: res.data.nextNumber }));
                        }
                    }
                } catch (error) {
                    console.error('Error fetching next PO number:', error);
                }
            }
        };
        loadNextNo();
    }, [showAddModal, editingId]);

    const fetchInitialData = async () => {
        try {
            const companyId = GetCompanyId();

            const promises = [
                vendorService.getAllVendors(companyId),
                productService.getProducts(companyId),
                warehouseService.getWarehouses(companyId),
                uomService.getUOMs(companyId)
            ];
            if (companyId) {
                promises.push(companyService.getById(companyId));
            }

            const results = await Promise.all(promises);
            const vendorRes = results[0];
            const productRes = results[1];
            const warehouseRes = results[2];
            const uomRes = results[3];
            const companyRes = results[4];

            // Handle Vendors
            if (vendorRes.success && Array.isArray(vendorRes.data)) {
                setVendors(vendorRes.data);
            } else if (Array.isArray(vendorRes)) {
                setVendors(vendorRes);
            } else if (vendorRes.data && Array.isArray(vendorRes.data)) {
                setVendors(vendorRes.data);
            }

            // Handle Products
            if (productRes.success && Array.isArray(productRes.data)) {
                setProducts(productRes.data);
            } else if (Array.isArray(productRes)) {
                setProducts(productRes);
            } else if (productRes.data && Array.isArray(productRes.data)) {
                setProducts(productRes.data);
            }

            // Handle Warehouses
            if (warehouseRes.success && Array.isArray(warehouseRes.data)) {
                setWarehouses(warehouseRes.data);
            }

            // Handle UOMs
            if (uomRes?.data) setAllUoms(uomRes.data);

            // Click outside to close dropdown
            const handleClickOutside = (event) => {
                if (quotationDropdownRef.current && !quotationDropdownRef.current.contains(event.target)) {
                    setIsQuotationDropdownOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);

            // Handle Company Details
            if (companyRes && (companyRes.data || companyRes.success)) {
                const data = companyRes.data?.data || companyRes.data || companyRes;
                setCompanyDetails({
                    name: data.companyName || data.name || '',
                    address: data.address || '',
                    email: data.companyEmail || data.email || '',
                    phone: data.phone || '',
                    logo: data.logo || null,
                    notes: data.notes || '',
                    terms: data.terms || '',
                    termsPurchase: data.termsPurchase || ''
                });

                setTerms(data.termsPurchase || data.terms || '');
                // Only set notes if not already populated from source data
                if (data.notes && !sourceData) setNotes(data.notes);
            }

        } catch (error) {
            console.error("Error fetching dropdowns", error);
            // toast.error("Failed to load dropdown data");
        }
    };

    const fetchQuotations = async () => {
        try {
            const companyId = GetCompanyId();
            const res = await purchaseQuotationService.getQuotations(companyId);
            if (res.success || Array.isArray(res)) {
                const allQuotes = res.data || res;
                // Only show quotations that are still pending/sent
                setQuotations(allQuotes.filter(q => q.status !== 'ACCEPTED' && q.status !== 'CONVERTED'));
            }
        } catch (error) {
            console.error("Error fetching quotations", error);
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const query = searchTerm.toLowerCase();
            const orderNo = o.orderNumber || `PO-${o.id}`;
            const vendorName = o.vendor?.name || '';

            const matchesSearch = !query ||
                orderNo.toLowerCase().includes(query) ||
                vendorName.toLowerCase().includes(query);

            const oDate = new Date(o.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || oDate >= start) && (!end || oDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [orders, searchTerm, startDate, endDate]);

    const filteredQuotationList = useMemo(() => {
        return quotations.filter(q => {
            const isUsed = orders.some(o => o.quotationId === q.id || o.quotationId === q._id);
            if (isUsed) return false;

            const query = quotationSearchTerm.toLowerCase();
            const qAmount = q.totalAmount?.toString() || '';
            const qNo = q.quotationNumber?.toLowerCase() || '';
            const vName = q.vendor?.name?.toLowerCase() || '';

            return !query ||
                qNo.includes(query) ||
                vName.includes(query) ||
                qAmount.includes(query);
        });
    }, [quotations, orders, quotationSearchTerm]);

    const handleSelectQuotation = (quote) => {
        setSelectedQuotationId(quote.id);
        setVendorId(quote.vendorId);
        setNotes(quote.notes || '');
        if (quote.terms) setTerms(quote.terms);

        const sourceItems = quote.purchasequotationitem || quote.items || [];
        const mappedItems = sourceItems.map(i => ({
            id: Date.now() + Math.random(),
            productId: i.productId,
            warehouseId: i.warehouseId || '',
            qty: i.quantity,
            uomId: i.uomId || '',
            rate: i.rate,
            discount: i.discount,
            tax: i.taxRate,
            total: i.amount,
            description: i.description
        }));
        setItems(mappedItems);
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            const res = await purchaseOrderService.getOrders(companyId);
            if (res.success) {
                setOrders(res.data);
            }
        } catch (error) {
            console.error("Error fetching orders", error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setVendorId('');
        // Auto-generate PO Number: PO-8digitRandom
        const autoPO = `PO-${Math.floor(10000000 + Math.random() * 90000000)}`;
        setOrderMeta({ orderNumber: autoPO, date: new Date().toISOString().split('T')[0], deliveryDate: '' });
        let defWarehouseId = '';
        if (companySettings?.inventoryConfig) {
            try {
                const parsed = typeof companySettings.inventoryConfig === 'string'
                    ? JSON.parse(companySettings.inventoryConfig)
                    : companySettings.inventoryConfig;
                if (parsed.defaultPurchaseWarehouseId) {
                    defWarehouseId = parseInt(parsed.defaultPurchaseWarehouseId);
                }
            } catch (e) {
                console.error(e);
            }
        }
        setItems([{ id: Date.now(), productId: '', warehouseId: defWarehouseId, qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }]);
        setNotes(companyDetails.notes || '');
        setTerms(companyDetails.termsPurchase || companyDetails.terms || '');
        setOrderType('direct');
        setSelectedQuotationId('');
        setQuotationSearchTerm('');
        setIsQuotationDropdownOpen(false);
        setOverallDiscount(0);
        setOverallDiscountType('percentage');
        setCustomFieldValues({});
        setIsViewMode(false);
        setShowAddModal(false);
    };

    const handleView = async (id) => {
        try {
            const companyId = GetCompanyId();
            const res = await purchaseOrderService.getOrderById(id, companyId);
            if (res.success && res.data) {
                const order = res.data;
                setEditingId(id);
                setVendorId(order.vendorId);
                setOrderMeta({
                    orderNumber: order.orderNumber,
                    date: order.date.split('T')[0],
                    deliveryDate: order.expectedDate ? order.expectedDate.split('T')[0] : ''
                });
                setNotes(order.notes || '');
                const itemsData = order.purchaseorderitem || order.items;
                if (itemsData) {
                    const mappedItems = itemsData.map(i => ({
                        id: i.id || Date.now() + Math.random(),
                        productId: i.productId || '',
                        warehouseId: i.warehouseId || '',
                        qty: i.quantity,
                        uomId: i.uomId || '',
                        rate: i.rate,
                        discount: i.discount,
                        tax: i.taxRate,
                        total: i.amount,
                        description: i.description
                    }));
                    setItems(mappedItems);
                }
                setOverallDiscount(order.overallDiscount || 0);
                setOverallDiscountType(order.overallDiscountType || 'percentage');
                let fieldValues = {};
                if (order.customFields) {
                    try {
                        fieldValues = typeof order.customFields === 'string'
                            ? JSON.parse(order.customFields)
                            : order.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on view:', e);
                    }
                }
                setCustomFieldValues(fieldValues);
                setIsViewMode(true);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error("Error fetching order details", error);
            toast.error("Failed to fetch order details");
        }
    };

    const handleAddNew = () => {
        resetForm();
        setEditingId(null);
        setIsViewMode(false);
        fetchInitialData();
        setShowAddModal(true);
    };

    const handleOrderTypeChange = (type) => {
        setOrderType(type);
        if (type === 'quotation') {
            fetchQuotations();
        } else {
            setSelectedQuotationId('');
            setQuotationSearchTerm('');
        }
    };

    const handleQuotationSelect = (qId) => {
        setSelectedQuotationId(qId);
        if (!qId) return;

        const quote = quotations.find(q => q.id === parseInt(qId));
        if (quote) {
            setVendorId(quote.vendorId);
            setNotes(quote.notes || '');
            if (quote.terms) setTerms(quote.terms);

            const sourceItems = quote.purchasequotationitem || quote.items || [];
            const mappedItems = sourceItems.map(i => ({
                id: Date.now() + Math.random(),
                productId: i.productId,
                warehouseId: i.warehouseId || '',
                qty: i.quantity,
                rate: i.rate,
                discount: i.discount,
                tax: i.taxRate,
                total: i.amount,
                description: i.description
            }));
            setItems(mappedItems);
        }
    };

    const handleEdit = async (id) => {
        try {
            const companyId = GetCompanyId();
            const res = await purchaseOrderService.getOrderById(id, companyId);
            if (res.success && res.data) {
                const orderToEdit = res.data;
                setEditingId(id);
                setIsViewMode(false);
                setVendorId(orderToEdit.vendorId);
                setOrderMeta({
                    orderNumber: orderToEdit.orderNumber,
                    date: orderToEdit.date.split('T')[0],
                    deliveryDate: orderToEdit.expectedDate ? orderToEdit.expectedDate.split('T')[0] : ''
                });
                setNotes(orderToEdit.notes || '');

                const itemsData = orderToEdit.purchaseorderitem || orderToEdit.items;
                if (itemsData) {
                    const mappedItems = itemsData.map(i => ({
                        id: i.id || Date.now() + Math.random(),
                        productId: i.productId || '',
                        warehouseId: i.warehouseId || '',
                        qty: i.quantity,
                        uomId: i.uomId || '',
                        rate: i.rate,
                        discount: i.discount,
                        tax: i.taxRate,
                        total: i.amount,
                        description: i.description
                    }));
                    setItems(mappedItems);
                }
                setOverallDiscount(orderToEdit.overallDiscount || 0);
                setOverallDiscountType(orderToEdit.overallDiscountType || 'percentage');
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
            console.error("Error fetching order details", error);
            toast.error("Failed to fetch details for editing");
        }
    };

    const handleDelete = (id) => {
        setDeleteId(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        try {
            const companyId = GetCompanyId();
            await purchaseOrderService.deleteOrder(deleteId, companyId);
            toast.success("Order deleted");
            fetchOrders();
        } catch (error) {
            toast.error(error.message || "Failed to delete");
        } finally {
            setShowDeleteConfirm(false);
            setDeleteId(null);
        }
    };

    const handleConvert = async (id) => {
        try {
            const companyId = GetCompanyId();
            const response = await purchaseOrderService.convertOrder(id, companyId);
            if (response.success) {
                toast.success('Converted to GRN successfully');
                setShowAddModal(false);
                navigate('/company/purchases/receipt', { state: { targetGrnId: response.data.id } });
            } else {
                toast.error(response.message || 'Conversion failed');
            }
        } catch (error) {
            console.error('Error converting order:', error);
            toast.error(error.response?.data?.message || error.message || 'Error converting order');
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
            const response = await purchaseOrderService.updateOrder(orderId, payload, companyId);
            if (response?.success || response?.data?.success) {
                fetchOrders();
            }
        } catch (error) {
            console.error('Error changing status:', error);
        }
    };

    const handleCreateGRN = (order) => {
        navigate('/company/purchases/goods-receipt', {
            state: {
                sourceData: {
                    vendorId: order.vendorId,
                    purchaseOrderId: order.id,
                    items: order.purchaseorderitem || order.items,
                    notes: order.notes
                }
            }
        });
    };

    const handleCreateBill = (order) => {
        navigate('/company/purchases/bill', {
            state: {
                sourceData: {
                    sourceType: 'po',
                    vendorId: order.vendorId,
                    purchaseOrderId: order.id,
                    items: order.purchaseorderitem || order.items || [],
                    notes: order.notes,
                    terms: order.terms,
                    totalAmount: order.totalAmount
                }
            }
        });
    };

    const handleSave = async () => {
        const totals = calculateTotals();

        if (!vendorId) {
            toast.error("Please select a vendor");
            return;
        }

        if (!orderMeta.orderNumber) {
            toast.error("Purchase Order Number is required (PO No.)");
            return;
        }

        const companyId = GetCompanyId();
        const payload = {
            companyId,
            orderNumber: orderMeta.orderNumber,
            date: orderMeta.date,
            expectedDate: orderMeta.deliveryDate,
            vendorId: parseInt(vendorId),
            customFields: JSON.stringify(customFieldValues),
            items: items.map(item => ({
                productId: parseInt(item.productId),
                warehouseId: item.warehouseId ? parseInt(item.warehouseId) : null,
                description: item.description,
                quantity: parseFloat(item.qty),
                rate: parseFloat(item.rate),
                discount: parseFloat(item.discount),
                taxRate: parseFloat(item.tax),
                uomId: item.uomId ? parseInt(item.uomId) : null
            })),
            notes,
            terms,
            overallDiscount: overallDiscount,
            overallDiscountType: overallDiscountType,
            quotationId: selectedQuotationId || sourceData?.quotationId // Link if from quotation
        };

        try {
            if (editingId) {
                await purchaseOrderService.updateOrder(editingId, { ...payload, status: 'OPEN' });
                toast.success("Order updated");
            } else {
                await purchaseOrderService.createOrder(payload);
                toast.success("Order created");
            }
            setShowAddModal(false);
            fetchOrders();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to save");
        }
    };

    // --- Calculation Helpers ---
    const addItem = () => {
        let defWarehouseId = '';
        if (companySettings?.inventoryConfig) {
            try {
                const parsed = typeof companySettings.inventoryConfig === 'string'
                    ? JSON.parse(companySettings.inventoryConfig)
                    : companySettings.inventoryConfig;
                if (parsed.defaultPurchaseWarehouseId) {
                    defWarehouseId = parseInt(parsed.defaultPurchaseWarehouseId);
                }
            } catch (e) {
                console.error(e);
            }
        }
        setItems([...items, { id: Date.now(), productId: '', warehouseId: defWarehouseId, qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(item => {
            if (item.id === id) {
                let updatedItem = { ...item, [field]: value };

                if (field === 'productId') {
                    const prod = products.find(p => p.id === parseInt(value));
                    if (prod) {
                        updatedItem.rate = prod.purchasePrice || 0;
                        updatedItem.tax = 0;
                        updatedItem.description = prod.description || '';
                        updatedItem.uomId = prod.purchaseUomId || prod.uomId || '';
                    }
                }

                if (['qty', 'rate', 'tax', 'discount'].includes(field) || field === 'productId') {
                    const qty = parseFloat(updatedItem.qty) || 0;
                    const rate = parseFloat(updatedItem.rate) || 0;
                    const tax = parseFloat(updatedItem.tax) || 0;
                    const discount = parseFloat(updatedItem.discount) || 0;

                    const subtotal = qty * rate;
                    const discountAmount = discount;
                    const taxable = subtotal - discountAmount;
                    const taxAmount = (taxable * tax) / 100;

                    updatedItem.total = taxable + taxAmount;
                }
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
            const tax = parseFloat(item.tax) || 0;
            const taxable = subtotal - discount;
            const taxAmount = (taxable * tax) / 100;

            acc.subTotal += subtotal;
            acc.discount += discount;
            acc.total += item.total;
            acc.tax += taxAmount;
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

    const purchaseProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'completed' },
        { id: 'purchase-order', label: 'Purchase Order', icon: ShoppingCart, status: 'active' },
        { id: 'grn', label: 'Goods Receipt', icon: Truck, status: 'pending' },
        { id: 'bill', label: 'Bill', icon: Receipt, status: 'pending' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'pending' },
    ];

    return (
        <div className="PurchaseOrder-page">
            <div className="PurchaseOrder-header">
                <div>
                    <h1 className="PurchaseOrder-title">Purchase Order</h1>
                    <p className="PurchaseOrder-subtitle">Manage purchase orders to vendors</p>
                </div>
                {hasPermission('create purchase order') && (
                    <button className="PurchaseOrder-btn-add" onClick={handleAddNew}>
                        <Plus size={18} className="mr-2" /> Create Order
                    </button>
                )}
            </div>

            <div className="PurchaseOrder-tracker-card">
                <div className="PurchaseOrder-tracker-wrapper">
                    {purchaseProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`purchase-module-tracker-step ${step.status}`}>
                                <div className="PurchaseOrder-step-icon">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="PurchaseOrder-status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="PurchaseOrder-status-badge" size={14} />}
                                </div>
                                <span className="PurchaseOrder-step-label">{step.label}</span>
                            </div>
                            {index < purchaseProcess.length - 1 && (
                                <div className={`purchase-module-tracker-divider ${purchaseProcess[index + 1].status !== 'pending' ? 'active' : ''}`}>
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="PurchaseOrder-table-card mt-6">
                <div className="PurchaseOrder-table-controls p-4 border-b flex justify-between items-center gap-4 flex-wrap">
                    <div className="PurchaseOrder-search-wrapper">
                        <Search className="PurchaseOrder-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by ID or Vendor..."
                            className="PurchaseOrder-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="PurchaseOrder-date-filters flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">From:</span>
                            <input
                                type="date"
                                className="PurchaseOrder-date-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">To:</span>
                            <input
                                type="date"
                                className="PurchaseOrder-date-input"
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
                <div className="table-container">
                    <table className="PurchaseOrder-table">
                        <thead>
                            <tr>
                                <th>ORDER ID</th>
                                <th>QUO REF</th>
                                <th>VENDOR</th>
                                <th>DATE</th>
                                <th>DELIVERY DATE</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th className="text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9" className="text-center p-4">Loading...</td></tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr><td colSpan="9" className="text-center p-4">No orders found</td></tr>
                            ) : (
                                filteredOrders.map(o => (
                                    <tr key={o.id}>
                                        <td className="font-bold text-blue-600">{o.orderNumber || `PO-${o.id}`}</td>
                                        <td>{o.purchasequotation?.quotationNumber || '-'}</td>
                                        <td>{o.vendor?.name || 'Unknown'}</td>
                                        <td>{new Date(o.date).toLocaleDateString()}</td>
                                        <td>{o.expectedDate ? new Date(o.expectedDate).toLocaleDateString() : '-'}</td>
                                        <td>{formatCurrency(o.totalAmount || 0)}</td>
                                        <td>
                                            <select
                                                value={o.manualStatus ? o.status : 'AUTO'}
                                                onChange={(e) => handleStatusChange(o.id, e.target.value)}
                                                className="purchase-module-status-pill"
                                                style={getStatusStyle(o.manualStatus ? o.status : 'AUTO')}
                                            >
                                                <option value="AUTO">Auto ({o.status})</option>
                                                <option value="PENDING">PENDING</option>
                                                <option value="PARTIAL">PARTIAL</option>
                                                <option value="COMPLETED">COMPLETED</option>
                                                <option value="CANCELLED">CANCELLED</option>
                                            </select>
                                        </td>
                                        <td className="">
                                            <div className="po-action-buttons">
                                                <button className="PurchaseOrder-action-btn view" onClick={() => handleView(o.id)} title="View"><Eye size={16} /></button>
                                                {o.status !== 'CONVERTED' && o.status !== 'COMPLETED' ? (
                                                    <button className="PurchaseOrder-action-btn convert" onClick={() => handleConvert(o.id)} title="Convert to GRN" style={{ backgroundColor: '#4f46e5', color: 'white', padding: '6px', borderRadius: '4px' }}><Truck size={16} /></button>
                                                ) : (
                                                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-500 rounded" style={{ alignSelf: 'center' }}>Converted</span>
                                                )}
                                                {hasPermission('edit purchase order') && (
                                                    <button className="PurchaseOrder-action-btn edit" onClick={() => handleEdit(o.id)} title="Edit"><Pencil size={16} /></button>
                                                )}
                                                {hasPermission('delete purchase order') && (
                                                    <button className="PurchaseOrder-action-btn delete" onClick={() => handleDelete(o.id)} title="Delete"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Premium Create/Edit Modal */}
            {showAddModal && (
                <div className="PurchaseOrder-modal-overlay">
                    <div className="PurchaseOrder-form-modal">
                        <div className="PurchaseOrder-header-simple">
                            <h2 className="text-xl font-bold text-gray-800">
                                {isViewMode ? 'Purchase Order Details' : (editingId ? 'Edit Purchase Order' : 'New Purchase Order')}
                            </h2>
                            <div className="flex items-center gap-3">
                                {isViewMode && (
                                    <button className="PurchaseOrder-btn-print-header" onClick={handlePrint}>
                                        <Printer size={20} />
                                    </button>
                                )}
                                <button className="PurchaseOrder-close-btn" onClick={() => setShowAddModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="PurchaseOrder-body-scrollable" ref={printRef}>
                            {isViewMode ? (
                                <div className="PurchaseOrder-view-document">
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
                                                            <img
                                                                src={companySettings?.invoiceLogo || (companyDetails.logo.startsWith('http') ? companyDetails.logo : `${BASE_URL}/${companyDetails.logo.replace(/\\/g, '/')}`)}
                                                                alt="Company Logo"
                                                                className="invoice-logo-large"
                                                                style={{ margin: '0' }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="invoice-header-right">
                                                        <div className="invoice-title-large" style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0' }}>{getDocumentTitle('purchaseorder')}</div>
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
                                                                <span>#{orderMeta.orderNumber}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Date:</span>
                                                                <span>{orderMeta.date}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Expected Date:</span>
                                                                <span>{orderMeta.deliveryDate || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Vendor Details Row */}
                                        <div className="invoice-addresses" style={{ display: 'flex', justifyContent: 'space-between', width: '100% !important', marginTop: '2.5rem', gap: '3rem' }}>
                                            <div className="invoice-bill-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                <div className="invoice-section-header">{getInvoiceLabel('billTo')}</div>
                                                <div className="font-bold text-gray-800" style={{ fontSize: '1.1rem', marginBottom: '5px' }}>{vendors.find(v => v.id === parseInt(vendorId))?.name || 'N/A'}</div>
                                                <div className="invoice-company-details">
                                                    <p style={{ margin: '2px 0' }}><strong>Address:</strong> {vendors.find(v => v.id === parseInt(vendorId))?.billingAddress || 'N/A'}</p>
                                                    <p style={{ margin: '2px 0' }}><strong>Email:</strong> {vendors.find(v => v.id === parseInt(vendorId))?.email || 'N/A'}</p>
                                                    <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {vendors.find(v => v.id === parseInt(vendorId))?.phone || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Custom Fields Print View */}
                                        {(() => {
                                            const order = orders.find(o => o.id === editingId);
                                            let customFieldVals = {};
                                            if (order?.customFields) {
                                                try {
                                                    customFieldVals = typeof order.customFields === 'string'
                                                        ? JSON.parse(order.customFields)
                                                        : order.customFields;
                                                } catch (e) {
                                                    console.error('Error parsing purchase order custom fields for view:', e);
                                                }
                                            }
                                            const fieldsList = getCustomFieldsForType('purchaseorder');
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

                                        {/* Line Items Table */}
                                        <div className="invoice-table-container" style={{ marginTop: '2rem' }}>
                                            <table className="invoice-table-preview" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid var(--header-bg, #004aad)' }}>
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', width: '5%' }}>#</th>
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', width: '35%' }}>{getTableHeader('item', 'Item Detail').toUpperCase()}</th>
                                                        {getInvoiceLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', width: '12%' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right', width: '8%' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showUom') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right', width: '8%' }}>UOM</th>}
                                                        {getInvoiceLabel('showRate') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right', width: '12%' }}>{getTableHeader('rate', 'Rate').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showTax') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right', width: '10%' }}>{getTableHeader('tax', 'Tax %').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showDiscount') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right', width: '10%' }}>{getTableHeader('discount', 'Discount').toUpperCase()}</th>}
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right', width: '12%' }}>{getTableHeader('price', 'Amount').toUpperCase()}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item, idx) => (
                                                        <tr key={item.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                                            <td>{idx + 1}</td>
                                                            <td>
                                                                <span className="font-bold text-sm text-gray-800 block">
                                                                    {item.productId ? products.find(p => p.id === parseInt(item.productId))?.name : 'N/A'}
                                                                </span>
                                                                {item.description && <span className="text-xs text-gray-500 block mt-0.5">{item.description}</span>}
                                                            </td>
                                                            {getInvoiceLabel('showWarehouse') !== false && <td>{warehouses.find(w => w.id === parseInt(item.warehouseId))?.name || 'N/A'}</td>}
                                                            {getInvoiceLabel('showQty') !== false && <td style={{ textAlign: 'right' }}>{item.qty}</td>}
                                                            {getInvoiceLabel('showUom') !== false && <td style={{ textAlign: 'right' }}>{allUoms.find(u => u.id === parseInt(item.uomId))?.unitName || ''}</td>}
                                                            {getInvoiceLabel('showRate') !== false && <td style={{ textAlign: 'right' }}>{formatCurrency(item.rate)}</td>}
                                                            {getInvoiceLabel('showTax') !== false && <td style={{ textAlign: 'right' }}>{item.tax}%</td>}
                                                            {getInvoiceLabel('showDiscount') !== false && <td style={{ textAlign: 'right' }}>{formatCurrency(item.discount)}</td>}
                                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.total || 0)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Bottom section (Bank Details, Notes & Totals) */}
                                        <div className="invoice-total-section" style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', marginTop: '2rem' }}>
                                            <div className="invoice-notes-bank" style={{ flex: 1 }}>
                                                <div className="invoice-bank-details" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#1e293b' }}>
                                                    <div className="invoice-section-header" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Bank Details</div>
                                                    {vendorId ? (
                                                        <>
                                                            <p style={{ margin: '2px 0' }}><strong>Bank Name:</strong> {vendors.find(v => v.id === parseInt(vendorId))?.bankNameBranch || 'N/A'}</p>
                                                            <p style={{ margin: '2px 0' }}><strong>Account No:</strong> {vendors.find(v => v.id === parseInt(vendorId))?.bankAccountNumber || 'N/A'}</p>
                                                            <p style={{ margin: '2px 0' }}><strong>IFSC / Swift:</strong> {vendors.find(v => v.id === parseInt(vendorId))?.bankIFSC || 'N/A'}</p>
                                                            <p style={{ margin: '2px 0' }}><strong>Account Holder:</strong> {vendors.find(v => v.id === parseInt(vendorId))?.accountName || 'N/A'}</p>
                                                        </>
                                                    ) : (
                                                        <p style={{ color: '#64748b', fontStyle: 'italic' }}>No vendor selected</p>
                                                    )}
                                                </div>

                                                {notes && (
                                                    <div className="invoice-notes" style={{ marginBottom: '1.5rem' }}>
                                                        <div className="invoice-section-header" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Notes</div>
                                                        <p style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{notes}</p>
                                                    </div>
                                                )}

                                                {terms && (
                                                    <div className="invoice-terms">
                                                        <div className="invoice-section-header" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Terms & Conditions</div>
                                                        <p style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{terms}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="invoice-totals" style={{ width: '320px', minWidth: '320px' }}>
                                                <div className="invoice-total-row">
                                                    <span className="invoice-label">Sub Total:</span>
                                                    <span>{formatCurrency(totalsData.subTotal)}</span>
                                                </div>
                                                <div className="invoice-total-row" style={{ color: '#ef4444' }}>
                                                    <span className="invoice-label">Discount:</span>
                                                    <span>-{formatCurrency(totalsData.discount + totalsData.ovDiscountAmt)}</span>
                                                </div>
                                                <div className="invoice-total-row">
                                                    <span className="invoice-label">Tax Total:</span>
                                                    <span>{formatCurrency(totalsData.tax)}</span>
                                                </div>
                                                <div className="invoice-final-total">
                                                    <span>Grand Total:</span>
                                                    <span>{formatCurrency(totalsData.finalTotal)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {getInvoiceLabel('showFooter') !== false && (
                                            <div className="invoice-thank-you" style={{ textAlign: 'center', marginTop: '3rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', fontStyle: 'italic', color: '#64748b' }}>
                                                Thank you for your business!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="PurchaseOrder-create-edit-form">
                                    {/* Order Type Toggle hidden for strict source workflow */}

                                    {orderType === 'quotation' && !selectedQuotationId && (
                                        <div className="PurchaseOrder-searchable-dropdown-container" ref={quotationDropdownRef}>
                                            <div
                                                className={`PurchaseOrder-dropdown-selector ${isQuotationDropdownOpen ? 'active' : ''}`}
                                                onClick={() => setIsQuotationDropdownOpen(!isQuotationDropdownOpen)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <FileText size={16} className="text-gray-400" />
                                                    <span className="text-gray-600">Select Quotation...</span>
                                                </div>
                                                <ChevronDown size={18} className={`transition-transform ${isQuotationDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {isQuotationDropdownOpen && (
                                                <div className="PurchaseOrder-dropdown-menu">
                                                    <div className="PurchaseOrder-dropdown-search-wrapper">
                                                        <Search size={14} className="PurchaseOrder-dropdown-search-icon" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search by vendor, ID or amount..."
                                                            className="PurchaseOrder-dropdown-search-input"
                                                            value={quotationSearchTerm}
                                                            autoFocus
                                                            onChange={(e) => setQuotationSearchTerm(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="PurchaseOrder-dropdown-options-list">
                                                        {filteredQuotationList.length === 0 ? (
                                                            <div className="PurchaseOrder-dropdown-empty">
                                                                No matching quotations found
                                                            </div>
                                                        ) : (
                                                            filteredQuotationList.map(q => (
                                                                <div
                                                                    key={q.id}
                                                                    className="PurchaseOrder-dropdown-option-card"
                                                                    onClick={() => {
                                                                        handleSelectQuotation(q);
                                                                        setIsQuotationDropdownOpen(false);
                                                                    }}
                                                                >
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <div className="text-sm font-bold text-blue-600">{q.quotationNumber}</div>
                                                                            <div className="text-xs font-semibold text-gray-800">{q.vendor?.name}</div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-sm font-bold text-green-600">{formatCurrency(q.totalAmount)}</div>
                                                                            <div className="text-[10px] text-gray-400">{new Date(q.date).toLocaleDateString()}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedQuotationId && orderType === 'quotation' && (
                                        <div className="PurchaseOrder-selected-quote-badge mb-4">
                                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                        <FileText size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-green-800">Linked to {quotations.find(q => q.id === parseInt(selectedQuotationId))?.quotationNumber || 'linked'}</div>
                                                        <div className="text-xs text-green-600">{quotations.find(q => q.id === parseInt(selectedQuotationId))?.vendor?.name}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                    onClick={() => {
                                                        setSelectedQuotationId('');
                                                        setVendorId('');
                                                        setQuotationSearchTerm('');
                                                        setItems([{ id: Date.now(), productId: '', warehouseId: '', qty: 1, rate: 0, tax: 0, discount: 0, total: 0, description: '' }]);
                                                    }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                            {/* Top Section: Meta Details in Row */}
                            <div className="PurchaseOrder-meta-header-row">
                                <div className="PurchaseOrder-meta-item">
                                    <label>PO No.</label>
                                    <input
                                        type="text"
                                        value={orderMeta.orderNumber || ''}
                                        onChange={(e) => setOrderMeta({ ...orderMeta, orderNumber: e.target.value })}
                                        disabled={isViewMode}
                                        className={`PurchaseOrder-meta-input ${isViewMode ? 'PurchaseOrder-disabled' : ''}`}
                                    />
                                </div>
                                <div className="PurchaseOrder-meta-item">
                                    <label>Date</label>
                                    <input type="date"
                                        value={orderMeta.date} onChange={(e) => setOrderMeta({ ...orderMeta, date: e.target.value })}
                                        className="PurchaseOrder-meta-input" />
                                </div>
                                <div className="PurchaseOrder-meta-item">
                                    <label>Delivery Date</label>
                                    <input type="date"
                                        value={orderMeta.deliveryDate} onChange={(e) => setOrderMeta({ ...orderMeta, deliveryDate: e.target.value })}
                                        className="PurchaseOrder-meta-input" />
                                </div>
                            </div>

                            {/* Vendor Selection & Address Grid (Single Row) */}
                            <div className="PurchaseOrder-vendor-section-compact">
                                <div className="PurchaseOrder-vendor-single-row">
                                    <div className="PurchaseOrder-form-group">
                                        <label className="PurchaseOrder-form-label-sm">Select Vendor</label>
                                        <select className="PurchaseOrder-form-select-compact" value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={!!sourceData}>
                                            <option value="">Select Vendor...</option>
                                            {vendors.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="PurchaseOrder-form-group">
                                        <label className="PurchaseOrder-form-label-sm">Billing Address</label>
                                        <input type="text" disabled className="PurchaseOrder-detail-input PurchaseOrder-disabled" placeholder="Billing Address" value={vendors.find(v => v.id === parseInt(vendorId))?.billingAddress || ''} />
                                    </div>
                                    <div className="PurchaseOrder-form-group">
                                        <label className="PurchaseOrder-form-label-sm">Email Address</label>
                                        <input type="text" disabled className="PurchaseOrder-detail-input PurchaseOrder-disabled" placeholder="Email Address" value={vendors.find(v => v.id === parseInt(vendorId))?.email || ''} />
                                    </div>
                                    <div className="PurchaseOrder-form-group">
                                        <label className="PurchaseOrder-form-label-sm">Phone Number</label>
                                        <input type="text" disabled className="PurchaseOrder-detail-input PurchaseOrder-disabled" placeholder="Phone Number" value={vendors.find(v => v.id === parseInt(vendorId))?.phone || ''} />
                                    </div>
                                </div>
                            </div>

                            {/* Custom Fields Section */}
                            {getCustomFieldsForType('purchaseorder').length > 0 && (
                                <div className="PurchaseOrder-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Custom Fields
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                        {getCustomFieldsForType('purchaseorder').map(field => (
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

                            {/* Items Table */}
                            <div className="PurchaseOrder-items-section-new">
                                <button className="PurchaseOrder-btn-add-row" onClick={addItem}>
                                    <Plus size={14} /> Add Line Item
                                </button>
                                <div className="PurchaseOrder-table-responsive">
                                    <table className="PurchaseOrder-new-items-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '20%' }}>{getTableHeader('item', 'Item Name').toUpperCase()}</th>
                                                {getInvoiceLabel('showWarehouse') !== false && <th style={{ width: '12%' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                                {getInvoiceLabel('showQty') !== false && <th style={{ width: '8%' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                                {getInvoiceLabel('showUom') !== false && <th style={{ width: '10%' }}>UOM</th>}
                                                {getInvoiceLabel('showRate') !== false && <th style={{ width: '12%' }}>{getTableHeader('rate', 'Rate').toUpperCase()}</th>}
                                                {getInvoiceLabel('showTax') !== false && <th style={{ width: '10%' }}>{getTableHeader('tax', 'Tax %').toUpperCase()}</th>}
                                                {getInvoiceLabel('showDiscount') !== false && <th style={{ width: '10%' }}>{getTableHeader('discount', 'Disc.').toUpperCase()}</th>}
                                                <th style={{ width: '12%' }}>{getTableHeader('price', 'Amount').toUpperCase()}</th>
                                                <th style={{ width: '6%' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map(item => (
                                                <tr key={item.id}>
                                                    <td>
                                                        <select
                                                            className="PurchaseOrder-full-width-input"
                                                            value={item.productId || ''}
                                                            onChange={(e) => updateItem(item.id, 'productId', e.target.value)}
                                                        >
                                                            <option value="">Select Product...</option>
                                                            {products.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name} ({p.totalQuantity ?? 0})</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    {getInvoiceLabel('showWarehouse') !== false && (
                                                        <td>
                                                            <select
                                                                className="PurchaseOrder-full-width-input"
                                                                value={item.warehouseId || ''}
                                                                onChange={(e) => updateItem(item.id, 'warehouseId', e.target.value)}
                                                            >
                                                                <option value="">Select Warehouse...</option>
                                                                {warehouses.map(w => {
                                                                    const prod = products.find(p => p.id === parseInt(item.productId));
                                                                    const stockItem = prod?.stock?.find(s => Number(s.warehouseId) === Number(w.id));
                                                                    const count = stockItem ? stockItem.quantity : 0;
                                                                    return <option key={w.id} value={w.id}>{w.name} ({count})</option>;
                                                                })}
                                                            </select>
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showQty') !== false && (
                                                        <td>
                                                            <input type="number" className="PurchaseOrder-qty-input" value={item.qty}
                                                                onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showUom') !== false && (
                                                        <td>
                                                            {item.productId ? (
                                                                <select className="PurchaseOrder-full-width-input" value={item.uomId}
                                                                    disabled={isViewMode}
                                                                    onChange={(e) => updateItem(item.id, 'uomId', e.target.value)}>
                                                                    <option value="">UOM...</option>
                                                                    {allUoms
                                                                        .filter(u => {
                                                                            const prod = products.find(p => p.id === parseInt(item.productId));
                                                                            return u.category === prod?.uom?.category || u.category === prod?.purchaseUom?.category || u.id === prod?.uomId || u.id === prod?.purchaseUomId;
                                                                        })
                                                                        .map(u => (
                                                                            <option key={u.id} value={u.id}>{u.unitName}</option>
                                                                        ))
                                                                    }
                                                                </select>
                                                            ) : (
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N/A</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showRate') !== false && (
                                                        <td>
                                                            <input type="number" className="PurchaseOrder-rate-input" value={item.rate}
                                                                onChange={(e) => updateItem(item.id, 'rate', e.target.value)} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showTax') !== false && (
                                                        <td>
                                                            <input type="number" className="PurchaseOrder-tax-input" value={item.tax}
                                                                onChange={(e) => updateItem(item.id, 'tax', e.target.value)} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showDiscount') !== false && (
                                                        <td>
                                                            <input type="number" className="PurchaseOrder-discount-input" value={item.discount}
                                                                onChange={(e) => updateItem(item.id, 'discount', e.target.value)} />
                                                        </td>
                                                    )}
                                                    <td>
                                                        <input type="text" className="PurchaseOrder-amount-input PurchaseOrder-disabled" value={formatCurrency(item.total)} disabled />
                                                    </td>
                                                    <td className="PurchaseOrder-text-center">
                                                        <button className="PurchaseOrder-btn-delete-row" onClick={() => removeItem(item.id)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Footer Section containing Bank Details & Totals side-by-side */}
                            <div className="PurchaseOrder-footer-grid">
                                <div className="PurchaseOrder-bank-details-box">
                                    <h4 className="PurchaseOrder-section-label">Bank Details</h4>
                                    {vendorId ? (
                                        <div className="PurchaseOrder-bank-info-content">
                                            <p className="PurchaseOrder-bank-row">
                                                <span className="font-semibold">Bank Name:</span>
                                                <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.bankNameBranch || 'N/A'}</span>
                                            </p>
                                            <p className="PurchaseOrder-bank-row">
                                                <span className="font-semibold">Account No:</span>
                                                <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.bankAccountNumber || 'N/A'}</span>
                                            </p>
                                            <p className="PurchaseOrder-bank-row">
                                                <span className="font-semibold">IFSC / Swift:</span>
                                                <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.bankIFSC || 'N/A'}</span>
                                            </p>
                                            <p className="PurchaseOrder-bank-row">
                                                <span className="font-semibold">Account Holder:</span>
                                                <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.accountName || 'N/A'}</span>
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No vendor selected</p>
                                    )}
                                </div>
                                <div className="PurchaseOrder-totals-box">
                                    <div className="PurchaseOrder-t-row">
                                        <span>Sub Total:</span>
                                        <span>{formatCurrency(totalsData.subTotal)}</span>
                                    </div>
                                    <div className="PurchaseOrder-t-row">
                                        <span>Discount:</span>
                                        <span className="PurchaseOrder-text-red-500">-{formatCurrency(totalsData.discount)}</span>
                                    </div>
                                    <div className="PurchaseOrder-t-row">
                                        <span>Tax Total:</span>
                                        <span>{formatCurrency(totalsData.tax)}</span>
                                    </div>

                                    <div className="PurchaseOrder-t-row PurchaseOrder-overall-discount-row">
                                        <span>Overall Discount:</span>
                                        <div className="PurchaseOrder-discount-group">
                                            <input
                                                type="number"
                                                value={overallDiscount}
                                                onChange={(e) => setOverallDiscount(e.target.value)}
                                            />
                                            <select
                                                value={overallDiscountType}
                                                onChange={(e) => setOverallDiscountType(e.target.value)}
                                            >
                                                <option value="percentage">%</option>
                                                <option value="fixed">Fixed</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="PurchaseOrder-t-row PurchaseOrder-total">
                                        <span>Grand Total:</span>
                                        <span>{formatCurrency(totalsData.finalTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes & Terms at bottom */}
                            <div className="PurchaseOrder-bottom-textareas-row">
                                <div className="PurchaseOrder-notes-section">
                                    <label className="PurchaseOrder-section-label">Notes</label>
                                    <textarea className="PurchaseOrder-notes-area" placeholder="Enter notes..."
                                        value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
                                </div>

                                <div className="PurchaseOrder-terms-section">
                                    <label className="PurchaseOrder-section-label">Terms & Conditions</label>
                                    <textarea className="PurchaseOrder-terms-area" placeholder="Enter terms..."
                                        value={terms} onChange={(e) => setTerms(e.target.value)}></textarea>
                                </div>
                            </div>
                        </div>
                            )}
                    </div>

                    <div className="PurchaseOrder-footer-simple">

                        <button className="PurchaseOrder-btn-plain" onClick={() => setShowAddModal(false)}>
                            {isViewMode ? 'Close' : 'Cancel'}
                        </button>
                        {isViewMode && (
                            <>
                                {orders.find(o => o.id === editingId)?.status !== 'CONVERTED' && orders.find(o => o.id === editingId)?.status !== 'COMPLETED' ? (
                                    <button className="PurchaseOrder-btn-primary-green" onClick={() => handleConvert(editingId)} style={{ backgroundColor: '#4f46e5' }}>
                                        <Truck size={18} className="mr-2" /> Convert to GRN
                                    </button>
                                ) : (
                                    <span className="text-sm font-semibold px-3 py-2 bg-gray-100 text-gray-500 rounded mr-2">Already Converted</span>
                                )}
                                <button className="PurchaseOrder-btn-primary-green" onClick={handlePrint}>
                                    <Printer size={18} className="mr-2" /> Print Order
                                </button>
                            </>
                        )}
                        {!isViewMode && (
                            <button className="PurchaseOrder-btn-primary-green" onClick={handleSave}>
                                {editingId ? 'Update Order' : 'Save Order'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* Unique Delete Confirmation Modal */}
{
    showDeleteConfirm && (
        <div className="PO-unique-delete-overlay">
            <div className="PO-unique-delete-modal">
                <div className="PO-unique-delete-header">
                    <h2 className="PO-unique-delete-title">Delete Order?</h2>
                    <button className="PO-unique-delete-close" onClick={() => setShowDeleteConfirm(false)}>
                        <X size={20} />
                    </button>
                </div>
                <div className="PO-unique-delete-body">
                    <p className="PO-unique-delete-message">
                        Are you sure you want to delete this purchase order? This action cannot be undone and will permanently remove the record from your system.
                    </p>
                </div>
                <div className="PO-unique-delete-footer">
                    <button className="PO-unique-delete-btn PO-unique-delete-cancel" onClick={() => setShowDeleteConfirm(false)}>
                        Cancel
                    </button>
                    <button className="PO-unique-delete-btn PO-unique-delete-confirm" onClick={confirmDelete}>
                        <Trash2 size={18} /> Delete
                    </button>
                </div>
            </div>
        </div>
    )
}
        </div >
    );
};

export default PurchaseOrder;
