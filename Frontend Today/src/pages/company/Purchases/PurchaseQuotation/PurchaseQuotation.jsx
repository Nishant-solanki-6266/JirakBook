import React, { useState, useEffect, useRef } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useReactToPrint } from 'react-to-print';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Download, Send, Printer, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './PurchaseQuotation.css';
import '../../Sales/Invoice/Invoice.css';
import purchaseQuotationService from '../../../../services/purchaseQuotationService';
import vendorService from '../../../../services/vendorService';
import productService from '../../../../api/productService'; // Adjust path if needed
import warehouseService from '../../../../api/warehouseService'; // Adjust path if needed
import companyService from '../../../../api/companyService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { BASE_URL } from '../../../../api/axiosInstance';
import uomService from '../../../../services/uomService';

const PurchaseQuotation = () => {
    // --- State Management ---
    const { formatCurrency, getTableHeader, getInvoiceLabel, companySettings, getDocumentTitle } = useContext(CompanyContext);
    const { hasPermission } = useContext(AuthContext);
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
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vendors, setVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const location = useLocation();
    const targetQuotationId = location.state?.targetQuotationId;
    const navigate = useNavigate();

    // Form State
    const [companyDetails, setCompanyDetails] = useState({
        name: '', address: '', email: '', phone: '', logo: '', notes: '', terms: '', termsPurchase: ''
    });
    const [quotationMeta, setQuotationMeta] = useState({
        quotationNumber: '', manualReference: '', date: new Date().toISOString().split('T')[0], expiryDate: ''
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
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);
    const printRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `PurchaseQuotation_${quotationMeta.quotationNumber || 'New'}`,
    });

    useEffect(() => {
        fetchInitialData();
        fetchQuotations();
    }, []);

    useEffect(() => {
        if (targetQuotationId && quotations.length > 0) {
            handleView(targetQuotationId);
            // Clear navigation state
            navigate(location.pathname, { replace: true, state: { ...location.state, targetQuotationId: undefined } });
        }
    }, [targetQuotationId, quotations]);

    // Fetch next PQ number when modal opens
    useEffect(() => {
        const loadNextNo = async () => {
            if (showAddModal && !editingId) {
                try {
                    const companyId = GetCompanyId();
                    if (companyId) {
                        const res = await companyService.getNextNumber(companyId, 'purchasequotation');
                        if (res.data.success) {
                            setQuotationMeta(prev => ({ ...prev, quotationNumber: res.data.nextNumber }));
                        }
                    }
                } catch (error) {
                    console.error('Error fetching next PQ number:', error);
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
            } else if (vendorRes.data && Array.isArray(vendorRes.data)) { // Handle axios response styled if mixed
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
            } else if (Array.isArray(warehouseRes)) {
                setWarehouses(warehouseRes);
            } else if (warehouseRes.data && Array.isArray(warehouseRes.data)) {
                setWarehouses(warehouseRes.data);
            }

            // Handle UOMs
            if (uomRes?.data) setAllUoms(uomRes.data);

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

                // Set default terms and notes from company details
                setTerms(data.termsPurchase || data.terms || '');
                if (data.notes) setNotes(data.notes);
            }

        } catch (error) {
            console.error("Error fetching dropdowns", error);
            toast.error("Failed to load dropdown data");
        }
    };

    const fetchQuotations = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            const res = await purchaseQuotationService.getQuotations(companyId);
            if (res.success) {
                setQuotations(res.data);
            }
        } catch (error) {
            console.error("Error fetching quotations", error);
            toast.error("Failed to fetch quotations");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setVendorId('');
        setQuotationMeta({ quotationNumber: '', manualReference: '', date: new Date().toISOString().split('T')[0], expiryDate: '' });
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
        setOverallDiscount(0);
        setOverallDiscountType('percentage');
        setCustomFieldValues({});
        setIsViewMode(false);
        setShowAddModal(false);
    };

    const handleView = async (id) => {
        try {
            const companyId = GetCompanyId();
            const res = await purchaseQuotationService.getQuotationById(id, companyId);
            if (res.success && res.data) {
                const quote = res.data;
                setEditingId(id);
                setVendorId(quote.vendorId);
                setQuotationMeta({
                    quotationNumber: quote.quotationNumber,
                    manualReference: quote.manualReference || '',
                    date: quote.date.split('T')[0],
                    expiryDate: quote.expiryDate ? quote.expiryDate.split('T')[0] : ''
                });
                setNotes(quote.notes || '');
                setTerms(quote.terms || '');
                setOverallDiscount(quote.overallDiscount || 0);
                setOverallDiscountType(quote.overallDiscountType || 'percentage');

                const itemsData = quote.purchasequotationitem || quote.items;
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

                let fieldValues = {};
                if (quote.customFields) {
                    try {
                        fieldValues = typeof quote.customFields === 'string'
                            ? JSON.parse(quote.customFields)
                            : quote.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on view:', e);
                    }
                }
                setCustomFieldValues(fieldValues);

                setIsViewMode(true);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error("Error fetching quotation details", error);
            toast.error("Failed to fetch quotation details");
        }
    };

    const handleAddNew = () => {
        resetForm();
        setEditingId(null);
        setIsViewMode(false);
        setShowAddModal(true);
    };

    const handleEdit = async (id) => {
        try {
            const companyId = GetCompanyId();
            const res = await purchaseQuotationService.getQuotationById(id, companyId);
            if (res.success && res.data) {
                const quoteToEdit = res.data;
                setEditingId(id);
                setIsViewMode(false);
                setVendorId(quoteToEdit.vendorId);
                setQuotationMeta({
                    quotationNumber: quoteToEdit.quotationNumber,
                    manualReference: quoteToEdit.manualReference || '',
                    date: quoteToEdit.date.split('T')[0],
                    expiryDate: quoteToEdit.expiryDate ? quoteToEdit.expiryDate.split('T')[0] : ''
                });
                setNotes(quoteToEdit.notes || '');
                setTerms(quoteToEdit.terms || '');
                setOverallDiscount(quoteToEdit.overallDiscount || 0);
                setOverallDiscountType(quoteToEdit.overallDiscountType || 'percentage');

                const itemsData = quoteToEdit.purchasequotationitem || quoteToEdit.items;
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

                let fieldValues = {};
                if (quoteToEdit.customFields) {
                    try {
                        fieldValues = typeof quoteToEdit.customFields === 'string'
                            ? JSON.parse(quoteToEdit.customFields)
                            : quoteToEdit.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on edit:', e);
                    }
                }
                setCustomFieldValues(fieldValues);

                setShowAddModal(true);
            }
        } catch (error) {
            console.error("Error fetching quotation details", error);
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
            await purchaseQuotationService.deleteQuotation(deleteId, companyId);
            toast.success("Quotation deleted");
            fetchQuotations();
        } catch (error) {
            toast.error(error.message || "Failed to delete");
        } finally {
            setShowDeleteConfirm(false);
            setDeleteId(null);
        }
    };

    const handleStatusChange = async (quotationId, newStatus) => {
        try {
            const companyId = GetCompanyId();
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };
            const response = await purchaseQuotationService.updateQuotation(quotationId, payload, companyId);
            if (response?.success || response?.data?.success) {
                fetchQuotations();
            }
        } catch (error) {
            console.error('Error changing status:', error);
        }
    };

    

    const handleConvert = async (id) => {
        try {
            const companyId = GetCompanyId();
            const response = await purchaseQuotationService.convertQuotation(id, companyId);
            if (response.success) {
                toast.success('Converted to Purchase Order successfully');
                setShowAddModal(false);
                navigate('/company/purchases/order', { state: { targetOrderId: response.data.id } });
            } else {
                toast.error(response.message || 'Conversion failed');
            }
        } catch (error) {
            console.error('Error converting quotation:', error);
            toast.error(error.response?.data?.message || error.message || 'Error converting quotation');
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    // --- Filter Logic ---
    const filteredQuotations = React.useMemo(() => {
        return quotations.filter(q => {
            const query = searchTerm.toLowerCase();
            const matchesSearch = !query ||
                q.quotationNumber?.toLowerCase().includes(query) ||
                q.vendor?.name?.toLowerCase().includes(query);

            const qDate = new Date(q.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || qDate >= start) && (!end || qDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [quotations, searchTerm, startDate, endDate]);

    const handleSave = async () => {
        const totals = calculateTotals();

        if (!vendorId) {
            toast.error("Please select a vendor");
            return;
        }

        const companyId = GetCompanyId();
        const payload = {
            companyId,
            quotationNumber: quotationMeta.quotationNumber || `PQ-${Date.now()}`,
            manualReference: quotationMeta.manualReference,
            date: quotationMeta.date,
            expiryDate: quotationMeta.expiryDate,
            vendorId: parseInt(vendorId),
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
            attachments: '', // Placeholder for attachments string if implemented
            customFields: JSON.stringify(customFieldValues)
        };

        try {
            if (editingId) {
                await purchaseQuotationService.updateQuotation(editingId, { ...payload, status: 'DRAFT' }); // Pass status if needed
                toast.success("Quotation updated");
            } else {
                await purchaseQuotationService.createQuotation(payload);
                toast.success("Quotation created");
            }
            setShowAddModal(false);
            fetchQuotations();
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
                    const discountAmount = discount; // assuming fixed discount, not percentage. logic can vary.
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
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'active' },
        { id: 'purchase-order', label: 'Purchase Order', icon: ShoppingCart, status: 'pending' },
        { id: 'grn', label: 'Goods Receipt', icon: Truck, status: 'pending' },
        { id: 'bill', label: 'Bill', icon: Receipt, status: 'pending' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'pending' },
    ];

    return (
        <div className="PurchaseQuotation-page">
            <div className="PurchaseQuotation-header">
                <div>
                    <h1 className="PurchaseQuotation-title">Purchase Quotation</h1>
                    <p className="PurchaseQuotation-subtitle">Manage purchase quotations from vendors</p>
                </div>
                {hasPermission('create purchase quotation') && (
                    <button className="PurchaseQuotation-btn-add" onClick={handleAddNew}>
                        <Plus size={18} className="mr-2" /> Create Quotation
                    </button>
                )}
            </div>

            <div className="PurchaseQuotation-tracker-card">
                <div className="PurchaseQuotation-tracker-wrapper">
                    {purchaseProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`purchase-module-tracker-step ${step.status}`}>
                                <div className="PurchaseQuotation-step-icon">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="PurchaseQuotation-status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="PurchaseQuotation-status-badge" size={14} />}
                                </div>
                                <span className="PurchaseQuotation-step-label">{step.label}</span>
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

            <div className="PurchaseQuotation-table-card mt-6">
                <div className="PurchaseQuotation-table-controls p-4 border-b flex justify-between items-center gap-4 flex-wrap">
                    <div className="PurchaseQuotation-search-wrapper">
                        <Search className="PurchaseQuotation-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by ID or Vendor..."
                            className="PurchaseQuotation-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="PurchaseQuotation-date-filters flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">From:</span>
                            <input
                                type="date"
                                className="PurchaseQuotation-date-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">To:</span>
                            <input
                                type="date"
                                className="PurchaseQuotation-date-input"
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
                    <table className="PurchaseQuotation-table">
                        <thead>
                            <tr>
                                <th>QUOTATION ID</th>
                                <th>VENDOR</th>
                                <th>DATE</th>
                                <th>EXPIRY DATE</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th className="text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center p-4">Loading...</td></tr>
                            ) : filteredQuotations.length === 0 ? (
                                <tr><td colSpan="7" className="text-center p-4">No quotations found</td></tr>
                            ) : (
                                filteredQuotations.map(q => (
                                    <tr key={q.id}>
                                        <td className="font-bold text-blue-600">{q.quotationNumber}</td>
                                        <td>{q.vendor?.name}</td>
                                        <td>{new Date(q.date).toLocaleDateString()}</td>
                                        <td>{q.expiryDate ? new Date(q.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                        <td>{formatCurrency(q.totalAmount)}</td>
                                        <td>
                                            <select
                                                value={q.manualStatus ? q.status : 'AUTO'}
                                                onChange={(e) => handleStatusChange(q.id, e.target.value)}
                                                className="PurchaseQuotation-status-pill"
                                                style={getStatusStyle(q.manualStatus ? q.status : 'AUTO')}
                                            >
                                                <option value="AUTO">Auto ({q.status || 'Pending'})</option>
                                                <option value="DRAFT">DRAFT</option>
                                                <option value="SENT">SENT</option>
                                                <option value="ACCEPTED">ACCEPTED</option>
                                                <option value="DECLINED">DECLINED</option>
                                                <option value="EXPIRED">EXPIRED</option>
                                            </select>
                                        </td>
                                        <td>
                                            <div className="pq-action-buttons">
                                                <button className="PurchaseQuotation-action-btn view" onClick={() => handleView(q.id)} title="View"><Eye size={16} /></button>
                                                {q.status !== 'CONVERTED' ? (
                                                    <button className="PurchaseQuotation-action-btn convert" onClick={() => handleConvert(q.id)} title="Convert to Purchase Order" style={{ backgroundColor: '#4f46e5', color: 'white', padding: '6px', borderRadius: '4px' }}><ShoppingCart size={16} /></button>
                                                ) : (
                                                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-500 rounded" style={{ alignSelf: 'center' }}>Converted</span>
                                                )}
                                                {hasPermission('edit purchase quotation') && (
                                                    <button className="PurchaseQuotation-action-btn edit" onClick={() => handleEdit(q.id)}><Pencil size={16} /></button>
                                                )}
                                                {hasPermission('delete purchase quotation') && (
                                                    <button className="PurchaseQuotation-action-btn delete" onClick={() => handleDelete(q.id)}><Trash2 size={16} /></button>
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
                <div className="PurchaseQuotation-modal-overlay">
                    <div className="PurchaseQuotation-form-modal">
                        <div className="PurchaseQuotation-header-simple">
                            <h2 className="text-xl font-bold text-gray-800">
                                {isViewMode ? 'Quotation Details' : (editingId ? 'Edit Purchase Quotation' : 'New Quotation')}
                            </h2>
                            <div className="flex items-center gap-3">
                                {isViewMode && (
                                    <button className="PurchaseQuotation-btn-print-header" onClick={handlePrint}>
                                        <Printer size={20} />
                                    </button>
                                )}
                                <button className="PurchaseQuotation-close-btn" onClick={() => setShowAddModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="PurchaseQuotation-body-scrollable" ref={printRef}>
                            {isViewMode ? (
                                <div className="PurchaseQuotation-view-document">
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
                                                        <div className="invoice-title-large" style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0' }}>{getDocumentTitle('purchasequotation')}</div>
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
                                                                <span className="invoice-label">Quotation No:</span>
                                                                <span>#{quotationMeta.quotationNumber}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Manual Ref:</span>
                                                                <span>{quotationMeta.manualReference || 'N/A'}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Date:</span>
                                                                <span>{quotationMeta.date}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Valid Till:</span>
                                                                <span>{quotationMeta.expiryDate || 'N/A'}</span>
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
                                            const quoteToView = editingId ? quotations.find(q => q.id === editingId) : null;
                                            let customFieldVals = {};
                                            if (quoteToView?.customFields) {
                                                try {
                                                    customFieldVals = typeof quoteToView.customFields === 'string'
                                                        ? JSON.parse(quoteToView.customFields)
                                                        : quoteToView.customFields;
                                                } catch (e) {
                                                    console.error('Error parsing purchase quotation custom fields for view:', e);
                                                }
                                            }
                                            const fieldsList = getCustomFieldsForType('purchasequotation');
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
                                <div className="PurchaseQuotation-create-edit-form">
                                    {/* Top Section: Meta Details in Row */}
                                    <div className="PurchaseQuotation-meta-header-row">
                                        <div className="PurchaseQuotation-meta-item">
                                            <label>Quotation No.</label>
                                            <input
                                                type="text"
                                                value={quotationMeta.quotationNumber || ''}
                                                onChange={(e) => setQuotationMeta({ ...quotationMeta, quotationNumber: e.target.value })}
                                                disabled={isViewMode || !!editingId}
                                                className={`PurchaseQuotation-meta-input ${isViewMode || editingId ? 'PurchaseQuotation-disabled' : ''}`}
                                            />
                                        </div>
                                        <div className="PurchaseQuotation-meta-item">
                                            <label>Manual Ref</label>
                                            <input type="text" value={quotationMeta.manualReference} placeholder="e.g. REF-001"
                                                onChange={(e) => setQuotationMeta({ ...quotationMeta, manualReference: e.target.value })}
                                                className="PurchaseQuotation-meta-input" />
                                        </div>
                                        <div className="PurchaseQuotation-meta-item">
                                            <label>Date</label>
                                            <input type="date"
                                                value={quotationMeta.date} onChange={(e) => setQuotationMeta({ ...quotationMeta, date: e.target.value })}
                                                className="PurchaseQuotation-meta-input" />
                                        </div>
                                        <div className="PurchaseQuotation-meta-item">
                                            <label>Valid Till</label>
                                            <input type="date"
                                                value={quotationMeta.expiryDate} onChange={(e) => setQuotationMeta({ ...quotationMeta, expiryDate: e.target.value })}
                                                className="PurchaseQuotation-meta-input" />
                                        </div>
                                    </div>

                                     {/* Vendor Selection & Address Grid (Single Row) */}
                                     <div className="PurchaseQuotation-vendor-section-compact">
                                         <div className="PurchaseQuotation-vendor-single-row">
                                             <div className="PurchaseQuotation-form-group">
                                                 <label className="PurchaseQuotation-form-label-sm">Select Vendor</label>
                                                 <select className="PurchaseQuotation-form-select-compact" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                                                     <option value="">Select Vendor...</option>
                                                     {vendors.map(v => (
                                                         <option key={v.id} value={v.id}>{v.name}</option>
                                                     ))}
                                                 </select>
                                             </div>
                                             <div className="PurchaseQuotation-form-group">
                                                 <label className="PurchaseQuotation-form-label-sm">Billing Address</label>
                                                 <input type="text" disabled className="PurchaseQuotation-detail-input PurchaseQuotation-disabled" placeholder="Billing Address" value={vendors.find(v => v.id === parseInt(vendorId))?.billingAddress || ''} />
                                             </div>
                                             <div className="PurchaseQuotation-form-group">
                                                 <label className="PurchaseQuotation-form-label-sm">Email Address</label>
                                                 <input type="text" disabled className="PurchaseQuotation-detail-input PurchaseQuotation-disabled" placeholder="Email Address" value={vendors.find(v => v.id === parseInt(vendorId))?.email || ''} />
                                             </div>
                                             <div className="PurchaseQuotation-form-group">
                                                 <label className="PurchaseQuotation-form-label-sm">Phone Number</label>
                                                 <input type="text" disabled className="PurchaseQuotation-detail-input PurchaseQuotation-disabled" placeholder="Phone Number" value={vendors.find(v => v.id === parseInt(vendorId))?.phone || ''} />
                                             </div>
                                         </div>
                                     </div>

                                      {/* Custom Fields Section */}
                                      {getCustomFieldsForType('purchasequotation').length > 0 && (
                                        <div className="PurchaseQuotation-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>
                                                Custom Fields
                                            </h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                                {getCustomFieldsForType('purchasequotation').map(field => (
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
                                     <div className="PurchaseQuotation-items-section-new">
                                         <button className="PurchaseQuotation-btn-add-row" onClick={addItem}>
                                             <Plus size={14} /> Add Line Item
                                         </button>
                                         <div className="PurchaseQuotation-table-responsive">
                                             <table className="PurchaseQuotation-new-items-table">
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
                                                                     className="PurchaseQuotation-full-width-input"
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
                                                                         className="PurchaseQuotation-full-width-input"
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
                                                                     <input type="number" className="PurchaseQuotation-qty-input" value={item.qty}
                                                                         onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
                                                                 </td>
                                                             )}
                                                             {getInvoiceLabel('showUom') !== false && (
                                                                 <td>
                                                                     {item.productId ? (
                                                                         <select className="PurchaseQuotation-full-width-input" value={item.uomId}
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
                                                                     <input type="number" className="PurchaseQuotation-rate-input" value={item.rate}
                                                                         onChange={(e) => updateItem(item.id, 'rate', e.target.value)} />
                                                                 </td>
                                                             )}
                                                             {getInvoiceLabel('showTax') !== false && (
                                                                 <td>
                                                                     <input type="number" className="PurchaseQuotation-tax-input" value={item.tax}
                                                                         onChange={(e) => updateItem(item.id, 'tax', e.target.value)} />
                                                                 </td>
                                                             )}
                                                             {getInvoiceLabel('showDiscount') !== false && (
                                                                 <td>
                                                                     <input type="number" className="PurchaseQuotation-discount-input" value={item.discount}
                                                                         onChange={(e) => updateItem(item.id, 'discount', e.target.value)} />
                                                                 </td>
                                                             )}
                                                             <td>
                                                                 <input type="text" className="PurchaseQuotation-amount-input PurchaseQuotation-disabled" value={formatCurrency(item.total)} disabled />
                                                             </td>
                                                             <td className="PurchaseQuotation-text-center">
                                                                 <button className="PurchaseQuotation-btn-delete-row" onClick={() => removeItem(item.id)}>
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
                                     <div className="PurchaseQuotation-footer-grid">
                                         <div className="PurchaseQuotation-bank-details-box">
                                             <h4 className="PurchaseQuotation-section-label">Bank Details</h4>
                                             {vendorId ? (
                                                 <div className="PurchaseQuotation-bank-info-content">
                                                     <p className="PurchaseQuotation-bank-row">
                                                         <span className="font-semibold">Bank Name:</span>
                                                         <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.bankNameBranch || 'N/A'}</span>
                                                     </p>
                                                     <p className="PurchaseQuotation-bank-row">
                                                         <span className="font-semibold">Account No:</span>
                                                         <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.bankAccountNumber || 'N/A'}</span>
                                                     </p>
                                                     <p className="PurchaseQuotation-bank-row">
                                                         <span className="font-semibold">IFSC / Swift:</span>
                                                         <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.bankIFSC || 'N/A'}</span>
                                                     </p>
                                                     <p className="PurchaseQuotation-bank-row">
                                                         <span className="font-semibold">Account Holder:</span>
                                                         <span className="value">{vendors.find(v => v.id === parseInt(vendorId))?.accountName || 'N/A'}</span>
                                                     </p>
                                                 </div>
                                             ) : (
                                                 <p className="text-sm text-gray-500 italic">No vendor selected</p>
                                             )}
                                         </div>
                                         <div className="PurchaseQuotation-totals-box">
                                             <div className="PurchaseQuotation-t-row">
                                                 <span>Sub Total:</span>
                                                 <span>{formatCurrency(totalsData.subTotal)}</span>
                                             </div>
                                             <div className="PurchaseQuotation-t-row">
                                                 <span>Discount:</span>
                                                 <span className="PurchaseQuotation-text-red-500">-{formatCurrency(totalsData.discount)}</span>
                                             </div>
                                             <div className="PurchaseQuotation-t-row">
                                                 <span>Tax Total:</span>
                                                 <span>{formatCurrency(totalsData.tax)}</span>
                                             </div>

                                             <div className="PurchaseQuotation-t-row PurchaseQuotation-overall-discount-row">
                                                 <span>Overall Discount:</span>
                                                 <div className="PurchaseQuotation-discount-group">
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

                                             <div className="PurchaseQuotation-t-row PurchaseQuotation-total">
                                                 <span>Grand Total:</span>
                                                 <span>{formatCurrency(totalsData.finalTotal)}</span>
                                             </div>
                                         </div>
                                     </div>

                                    {/* Notes & Terms at bottom */}
                                    <div className="PurchaseQuotation-bottom-textareas-row">
                                        <div className="PurchaseQuotation-notes-section my-4">
                                            <label className="PurchaseQuotation-section-label">Notes</label>
                                            <textarea className="PurchaseQuotation-notes-area" placeholder="Enter notes..."
                                                value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
                                        </div>

                                        <div className="PurchaseQuotation-terms-section my-4">
                                            <label className="PurchaseQuotation-section-label">Terms & Conditions</label>
                                            <textarea className="PurchaseQuotation-terms-area" placeholder="Enter terms..."
                                                value={terms} onChange={(e) => setTerms(e.target.value)}></textarea>
                                        </div>
                                    </div>

                                    {/* Attachments Section */}
                                    <div className="PurchaseQuotation-attachments-section my-4">
                                        <label className="PurchaseQuotation-section-label">Attachments</label>
                                        <input
                                            type="file"
                                            multiple
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleFileChange}
                                        />
                                        <button className="PurchaseQuotation-btn-upload-small" onClick={() => fileInputRef.current.click()}>
                                            <FileText size={14} /> Attach Files
                                        </button>

                                        {files.length > 0 && (
                                            <div className="PurchaseQuotation-attachment-list">
                                                {files.map((file, index) => (
                                                    <div key={index} className="PurchaseQuotation-attachment-item">
                                                        <span className="PurchaseQuotation-attachment-name">{file.name}</span>
                                                        <button onClick={() => removeFile(index)} className="PurchaseQuotation-btn-remove-file">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        <div className="PurchaseQuotation-footer-simple">
                            <button className="PurchaseQuotation-btn-plain" onClick={() => setShowAddModal(false)}>
                                {isViewMode ? 'Close' : 'Cancel'}
                            </button>
                            {isViewMode && (
                                <>
                                    {quotations.find(q => q.id === editingId)?.status !== 'CONVERTED' ? (
                                        <button className="PurchaseQuotation-btn-primary-green" onClick={() => handleConvert(editingId)} style={{ backgroundColor: '#4f46e5' }}>
                                            <ShoppingCart size={18} className="mr-2" /> Convert to Purchase Order
                                        </button>
                                    ) : (
                                        <span className="text-sm font-semibold px-3 py-2 bg-gray-100 text-gray-500 rounded mr-2">Already Converted</span>
                                    )}
                                    <button className="PurchaseQuotation-btn-primary-green" onClick={handlePrint}>
                                        <Printer size={18} className="mr-2" /> Print Quotation
                                    </button>
                                </>
                            )}
                            {!isViewMode && (
                                <button className="PurchaseQuotation-btn-primary-green" onClick={handleSave}>
                                    {editingId ? 'Update Quotation' : 'Save Quotation'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Unique Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="PQ-unique-delete-overlay">
                    <div className="PQ-unique-delete-modal">
                        <div className="PQ-unique-delete-header">
                            <h2 className="PQ-unique-delete-title">Delete Quotation?</h2>
                            <button className="PQ-unique-delete-close" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="PQ-unique-delete-body">
                            <p className="PQ-unique-delete-message">
                                Are you sure you want to delete this Purchase Quotation? This action cannot be undone and will permanently remove the record.
                            </p>
                        </div>
                        <div className="PQ-unique-delete-footer">
                            <button className="PQ-unique-delete-btn PQ-unique-delete-cancel" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="PQ-unique-delete-btn PQ-unique-delete-confirm" onClick={confirmDelete}>
                                <Trash2 size={18} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseQuotation;
