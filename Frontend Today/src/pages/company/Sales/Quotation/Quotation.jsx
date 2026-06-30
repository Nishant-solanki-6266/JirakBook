import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Download, Send, Printer, Eye
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './Quotation.css';
import '../Invoice/Invoice.css';
import salesQuotationService from '../../../../api/salesQuotationService';
import customerService from '../../../../api/customerService';
import productService from '../../../../api/productService';
import warehouseService from '../../../../api/warehouseService';
import servicesService from '../../../../api/servicesService';
import companyService from '../../../../api/companyService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { useReactToPrint } from 'react-to-print';
import { CompanyContext } from '../../../../context/CompanyContext';
import uomService from '../../../../services/uomService';

const Quotation = () => {
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
    const [customers, setCustomers] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [allWarehouses, setAllWarehouses] = useState([]);
    const [allServices, setAllServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const printRef = useRef();

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Form State
    const [companyDetails, setCompanyDetails] = useState({
        name: 'Zirak Books', address: '123 Business Avenue, Suite 404', email: 'info@zirakbooks.com', phone: '123-456-7890', notes: '', terms: ''
    });
    const [quotationMeta, setQuotationMeta] = useState({
        manualNo: '', date: new Date().toISOString().split('T')[0], validTill: ''
    });
    const [quotationNumber, setQuotationNumber] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [customerDetails, setCustomerDetails] = useState({ address: '', email: '', phone: '' });
    const [items, setItems] = useState([
        { id: Date.now(), productId: '', serviceId: '', warehouseId: '', qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }
    ]);
    const [allUoms, setAllUoms] = useState([]);
    const location = useLocation();
    const navigate = useNavigate();
    const [bankDetails, setBankDetails] = useState({
        bankName: 'HDFC Bank', accNo: '50200012345678', holderName: 'ABC Accounting Solutions Pvt. Ltd.', ifsc: 'HDFC0000456'
    });
    const [notes, setNotes] = useState('Thank you for your business!');
    const [terms, setTerms] = useState('"Payment is due within 15 days.",\n"Goods once sold will not be taken back."');
    const [attachments, setAttachments] = useState([]);
    const [overallDiscount, setOverallDiscount] = useState(0);
    const [overallDiscountType, setOverallDiscountType] = useState('amount'); // 'amount' | 'percent'
    const [manualStatus, setManualStatus] = useState(false);
    const [overrideStatus, setOverrideStatus] = useState('DRAFT');
    const fileInputRef = useRef(null);

    // Initial Fetch
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
                    termsQuotation: data.termsQuotation || ''
                });
                setBankDetails({
                    bankName: data.bankName || 'HDFC Bank',
                    accNo: data.accountNumber || '50200012345678',
                    holderName: data.accountHolder || 'ABC Accounting Solutions Pvt. Ltd.',
                    ifsc: data.ifsc || 'HDFC0000456'
                });
                setNotes(data.notes || 'Thank you for your business!');
                setTerms(data.termsQuotation || data.terms || '"Payment is due within 15 days.",\n"Goods once sold will not be taken back."');
            }
        } catch (error) {
            console.error('Error fetching company details:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            const response = await salesQuotationService.getAll(companyId);
            if (response.data.success) {
                setQuotations(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching quotations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const companyId = GetCompanyId();
            const [custRes, prodRes, whRes, servRes, uomRes] = await Promise.all([
                customerService.getAll(companyId),
                productService.getAll(companyId),
                warehouseService.getAll(companyId),
                servicesService.getAll(companyId),
                uomService.getUOMs(companyId)
            ]);
            if (custRes.data.success) setCustomers(custRes.data.data);
            if (prodRes.data.success) setAllProducts(prodRes.data.data);
            if (whRes.data.success) setAllWarehouses(whRes.data.data);
            if (servRes.data.success) setAllServices(servRes.data.data);
            if (uomRes.data) setAllUoms(uomRes.data);
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    // --- Actions ---
    const resetForm = () => {
        setEditingId(null);
        setCustomerId('');
        setCustomerDetails({ address: '', email: '', phone: '' });
        setQuotationMeta({ manualNo: '', date: new Date().toISOString().split('T')[0], validTill: '' });
        
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
        setNotes(companyDetails.notes || 'Thank you for your business!');
        setTerms(companyDetails.termsQuotation || companyDetails.terms || '"Payment is due within 15 days.",\n"Goods once sold will not be taken back."');
        setAttachments([]);
        setOverallDiscount(0);
        setOverallDiscountType('amount');
        setManualStatus(false);
        setOverrideStatus('DRAFT');
        setQuotationNumber('');
        setCustomFieldValues({});
        setShowAddModal(false);
    };

    const handleAddNew = async () => {
        resetForm();
        setEditingId(null);
        setIsViewMode(false);
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getNextNumber(companyId, 'salesquotation');
                if (res.data.success) {
                    setQuotationNumber(res.data.nextNumber);
                }
            }
        } catch (error) {
            console.error('Error fetching next quotation number:', error);
        }
        setShowAddModal(true);
    };

    const handleEdit = async (id) => {
        await populateQuotation(id, false);
    };

    const handleView = async (id) => {
        await populateQuotation(id, true);
    };

    const populateQuotation = async (id, viewOnly) => {
        try {
            const companyId = GetCompanyId();
            const response = await salesQuotationService.getById(id, companyId);
            if (response.data.success) {
                const quoteToEdit = response.data.data;
                resetForm();
                setEditingId(id);
                setIsViewMode(viewOnly);
                setCustomerId(quoteToEdit.customerId);
                setCustomerDetails({
                    address: quoteToEdit.customer?.billingAddress || '',
                    email: quoteToEdit.customer?.email || '',
                    phone: quoteToEdit.customer?.phone || ''
                });
                setQuotationMeta({
                    manualNo: quoteToEdit.manualReference || '',
                    date: quoteToEdit.date.split('T')[0],
                    validTill: quoteToEdit.expiryDate ? quoteToEdit.expiryDate.split('T')[0] : ''
                });
                setManualStatus(quoteToEdit.manualStatus || false);
                setOverrideStatus(quoteToEdit.status || 'DRAFT');
                setQuotationNumber(quoteToEdit.quotationNumber || '');
                setItems((quoteToEdit.salesquotationitem || quoteToEdit.items || []).map(item => ({
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
                setNotes(quoteToEdit.notes || '');
                setTerms(quoteToEdit.terms || '');
                setOverallDiscount(quoteToEdit.overallDiscount || 0);
                setOverallDiscountType(quoteToEdit.overallDiscountType || 'amount');

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
            console.error('Error loading quotation:', error);
        }
    };

    const handleDelete = (id) => {
        setDeleteId(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        try {
            const companyId = GetCompanyId();
            const response = await salesQuotationService.delete(deleteId, companyId);
            if (response.data.success) {
                fetchData();
                setShowDeleteConfirm(false);
                setDeleteId(null);
            }
        } catch (error) {
            console.error('Error deleting quotation:', error);
        }
    };

    const handleConvert = async (id) => {
        try {
            const companyId = GetCompanyId();
            const response = await salesQuotationService.convert(id, companyId);
            if (response.data.success) {
                toast.success('Converted to Sales Order successfully');
                setShowAddModal(false);
                navigate('/company/sales/order', { state: { targetOrderId: response.data.data.id } });
            } else {
                toast.error(response.data.message || 'Conversion failed');
            }
        } catch (error) {
            console.error('Error converting quotation:', error);
            toast.error(error.response?.data?.message || 'Error converting quotation');
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
            const response = await salesQuotationService.update(quotationId, payload, companyId);
            if (response.data?.success || response.success) {
                fetchData();
            }
        } catch (error) {
            console.error('Error changing status:', error);
        }
    };

    // --- Filter Logic ---
    const filteredQuotations = React.useMemo(() => {
        return quotations.filter(q => {
            const query = searchTerm.toLowerCase();
            const matchesSearch = !query ||
                q.quotationNumber?.toLowerCase().includes(query) ||
                q.customer?.name?.toLowerCase().includes(query);

            const qDate = new Date(q.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || qDate >= start) && (!end || qDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [quotations, searchTerm, startDate, endDate]);

    const handleSave = async (allowDuplicate = false) => {
        try {
            const companyId = GetCompanyId();
            const data = {
                quotationNumber: editingId ? (quotations.find(q => q.id === editingId)?.quotationNumber) : (quotationNumber || `QUO-${Date.now()}`),
                manualReference: quotationMeta.manualNo,
                date: quotationMeta.date,
                expiryDate: quotationMeta.validTill,
                customerId: parseInt(customerId),
                companyId: companyId,
                notes: notes,
                terms: terms,
                overallDiscount: overallDiscount,
                overallDiscountType: overallDiscountType,
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
                customFields: JSON.stringify(customFieldValues),
                manualStatus,
                status: manualStatus ? overrideStatus : undefined,
                allowDuplicateManualNo: allowDuplicate === true
            };

            let response;
            try {
                if (editingId) {
                    response = await salesQuotationService.update(editingId, data, companyId);
                } else {
                    response = await salesQuotationService.create(data);
                }

                if (response.data.success) {
                    toast.success(editingId ? 'Quotation updated successfully' : 'Quotation created successfully');
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
                    toast.error(err.response?.data?.message || 'Error saving quotation');
                    console.error('Error saving quotation:', err);
                }
            }
        } catch (error) {
            console.error('Error in handleSave:', error);
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
                if (parsed.defaultSalesWarehouseId) {
                    defWarehouseId = parseInt(parsed.defaultSalesWarehouseId);
                }
            } catch (e) {
                console.error(e);
            }
        }
        setItems([...items, { id: Date.now(), productId: '', serviceId: '', warehouseId: defWarehouseId, qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }]);
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

    // --- Attachment Helpers ---
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setAttachments([...attachments, ...newFiles]);
        }
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const removeAttachment = (indexToRemove) => {
        setAttachments(attachments.filter((_, index) => index !== indexToRemove));
    };

    const calculateTotals = () => {
        const itemTotals = items.reduce((acc, item) => {
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const discount = parseFloat(item.discount) || 0;
            const subtotal = qty * rate;

            acc.subTotal += subtotal;
            acc.itemDiscount += discount;
            acc.total += item.total;
            acc.tax += (item.total - (subtotal - discount));
            return acc;
        }, { subTotal: 0, tax: 0, itemDiscount: 0, total: 0 });

        // Apply overall discount
        const odVal = parseFloat(overallDiscount) || 0;
        const overallDiscountAmount = overallDiscountType === 'percent'
            ? (itemTotals.subTotal - itemTotals.itemDiscount) * odVal / 100
            : odVal;

        const grandTotal = itemTotals.total - overallDiscountAmount;

        return {
            subTotal: itemTotals.subTotal,
            discount: itemTotals.itemDiscount,
            overallDiscountAmount,
            tax: itemTotals.tax,
            total: grandTotal
        };
    };

    const totals = calculateTotals();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Quotation_${quotationMeta.manualNo || 'New'}`,
    });

    // Handle Deep Link from Navigation State


    const salesProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'active' },
        { id: 'sales-order', label: 'Sales Order', icon: ShoppingCart, status: 'pending' },
        { id: 'delivery', label: 'Delivery', icon: Truck, status: 'pending' },
        { id: 'invoice', label: 'Invoice', icon: Receipt, status: 'pending' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'pending' },
    ];

    // Handle Deep Link from Navigation State
    useEffect(() => {
        if (location.state && location.state.targetQuotationId) {
            handleView(location.state.targetQuotationId);
            // Clear location state after handling to prevent re-opening on re-renders
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, fetchData, navigate]);

    return (
        <div className="Quotation-quotation-page">
            <div className="Quotation-page-header">
                <div>
                    <h1 className="Quotation-page-title">Quotation</h1>
                    <p className="Quotation-page-subtitle">Create and manage customer quotations</p>
                </div>
                {hasPermission('create sales quotation') && (
                    <button className="Quotation-btn-add" onClick={handleAddNew}>
                        <Plus size={18} className="mr-2" /> Create Quotation
                    </button>
                )}
            </div>

            <div className="Quotation-process-tracker-card">
                <div className="Quotation-tracker-wrapper">
                    {salesProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`Quotation-tracker-step ${step.status}`}>
                                <div className="Quotation-step-icon-wrapper">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="Quotation-status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="Quotation-status-badge" size={14} />}
                                </div>
                                <span className="Quotation-step-label">{step.label}</span>
                            </div>
                            {index < salesProcess.length - 1 && (
                                <div className={`Quotation-tracker-divider ${salesProcess[index + 1].status !== 'pending' ? 'Quotation-active' : ''}`}>
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="Quotation-table-card mt-6">
                <div className="Quotation-table-controls p-4 border-b flex justify-between items-center gap-4 flex-wrap">
                    <div className="Quotation-search-wrapper">
                        <Search className="Quotation-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by ID or Customer..."
                            className="Quotation-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="Quotation-date-filters flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">From:</span>
                            <input
                                type="date"
                                className="Quotation-date-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">To:</span>
                            <input
                                type="date"
                                className="Quotation-date-input"
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
                <div className="Quotation-table-container">
                    <table className="Quotation-quotation-table">
                        <thead>
                            <tr>
                                <th>QUOTATION ID</th>
                                <th>CUSTOMER</th>
                                <th>DATE</th>
                                <th>VALID TILL</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th className="text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredQuotations.map(q => (
                                <tr key={q.id}>
                                    <td className="font-bold text-blue-600">{q.quotationNumber}</td>
                                    <td>{q.customer?.name}</td>
                                    <td>{new Date(q.date).toLocaleDateString()}</td>
                                    <td>{q.expiryDate ? new Date(q.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                    <td>{formatCurrency(q.totalAmount)}</td>
                                    <td>
                                        <select
                                            value={q.manualStatus ? q.status : 'AUTO'}
                                            onChange={(e) => handleStatusChange(q.id, e.target.value)}
                                             className="Quotation-quotation-status-pill"
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
                                        <div className="Quotation-quotation-action-buttons">
                                            <button className="Quotation-quotation-action-btn Quotation-view" onClick={() => handleView(q.id)} title="View"><Eye size={16} /></button>
                                            {q.status !== 'CONVERTED' ? (
                                                <button className="Quotation-quotation-action-btn Quotation-convert" onClick={() => handleConvert(q.id)} title="Convert to Sales Order" style={{ backgroundColor: '#4f46e5', color: 'white' }}><ShoppingCart size={16} /></button>
                                            ) : (
                                                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-500 rounded" style={{ alignSelf: 'center' }}>Converted</span>
                                            )}
                                            {hasPermission('edit sales quotation') && (
                                                <button className="Quotation-quotation-action-btn Quotation-edit" onClick={() => handleEdit(q.id)} title="Edit"><Pencil size={16} /></button>
                                            )}
                                            {hasPermission('delete sales quotation') && (
                                                <button className="Quotation-quotation-action-btn Quotation-delete" onClick={() => handleDelete(q.id)} title="Delete"><Trash2 size={16} /></button>
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
            {showAddModal && (
                <div className="Quotation-modal-overlay">
                    <div className="Quotation-modal-content Quotation-quotation-form-modal">
                        <div className="Quotation-modal-header-simple">
                            <h2 className="text-xl font-bold text-gray-800">
                                {isViewMode ? 'View Quotation' : editingId ? 'Edit Quotation' : 'New Quotation'}
                            </h2>
                            <div className="flex items-center gap-4">
                                {isViewMode && (
                                    <button className="Quotation-btn-print-header" onClick={handlePrint}>
                                        <Printer size={20} />
                                    </button>
                                )}
                                <button className="Quotation-close-btn-simple" onClick={() => setShowAddModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="Quotation-modal-body-scrollable" ref={printRef}>
                            {isViewMode ? (
                                <div className="Quotation-view-document">
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
                                                        <div className="invoice-title-large" style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0' }}>{getDocumentTitle('quotation')}</div>
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
                                                                <span className="invoice-label">{getInvoiceLabel('number')}</span>
                                                                <span>#{editingId ? quotations.find(q => q.id === editingId)?.quotationNumber : ""}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Manual Ref:</span>
                                                                <span>{quotationMeta.manualNo || 'N/A'}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">{getInvoiceLabel('issue')}</span>
                                                                <span>{quotationMeta.date}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Valid Till:</span>
                                                                <span>{quotationMeta.validTill || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="invoice-addresses" style={{ display: 'flex', justifyContent: 'space-between', width: '100% !important', marginTop: '2.5rem', gap: '3rem' }}>
                                            <div className="invoice-bill-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                <div className="invoice-section-header">{getInvoiceLabel('billTo')}</div>
                                                <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                                    {customers.find(c => c.id === parseInt(customerId))?.name || 'N/A'}
                                                </div>
                                                <div style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                                    {customerDetails.address || 'N/A'}
                                                </div>
                                                <div style={{ color: '#475569', fontWeight: '500', fontSize: '0.95rem' }}>
                                                    {customerDetails.email} | {customerDetails.phone}
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
                                                    console.error('Error parsing sales quotation custom fields for view:', e);
                                                }
                                            }
                                            const fieldsList = getCustomFieldsForType('salesquotation');
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
                                                    <span>{getInvoiceLabel('subTotal')}</span>
                                                    <span>{formatCurrency(totals.subTotal)}</span>
                                                </div>
                                                <div className="invoice-total-row text-red-600">
                                                    <span>Discount</span>
                                                    <span>-{formatCurrency(totals.discount + totals.overallDiscountAmount)}</span>
                                                </div>
                                                {getInvoiceLabel('showTax') !== false && (
                                                    <div className="invoice-total-row">
                                                        <span>{getInvoiceLabel('tax')}</span>
                                                        <span>{formatCurrency(totals.tax)}</span>
                                                    </div>
                                                )}
                                                <div className="invoice-final-total">
                                                    <span>{getInvoiceLabel('total')}</span>
                                                    <span>{formatCurrency(totals.total)}</span>
                                                </div>
                                            </div>
                                        </div>

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
                                <div className="Quotation-create-edit-form">
                                    <div className="Quotation-meta-header-row">
                                        <div className="Quotation-meta-item">
                                            <label>Quotation No.</label>
                                            <input
                                                type="text"
                                                value={quotationNumber}
                                                onChange={(e) => setQuotationNumber(e.target.value)}
                                                disabled={isViewMode || !!editingId}
                                                className={`Quotation-meta-input ${isViewMode || editingId ? 'Quotation-disabled' : ''}`}
                                            />
                                        </div>
                                        <div className="Quotation-meta-item">
                                            <label>Manual Ref</label>
                                            <input type="text" placeholder="e.g. REF-001"
                                                disabled={isViewMode}
                                                value={quotationMeta.manualNo} onChange={(e) => setQuotationMeta({ ...quotationMeta, manualNo: e.target.value })}
                                                className="Quotation-meta-input" />
                                        </div>
                                        <div className="Quotation-meta-item">
                                            <label>Date</label>
                                            <input type="date"
                                                disabled={isViewMode}
                                                value={quotationMeta.date} onChange={(e) => setQuotationMeta({ ...quotationMeta, date: e.target.value })}
                                                className="Quotation-meta-input" />
                                        </div>
                                        <div className="Quotation-meta-item">
                                            <label>Valid Till</label>
                                            <input type="date"
                                                disabled={isViewMode}
                                                value={quotationMeta.validTill} onChange={(e) => setQuotationMeta({ ...quotationMeta, validTill: e.target.value })}
                                                className="Quotation-meta-input" />
                                        </div>
                                    </div>

                                    <hr className="Quotation-divider" />

                                    <div className="Quotation-customer-section-compact">
                                        <div className="Quotation-customer-field">
                                            <label className="Quotation-form-label-sm">Quotation To</label>
                                            <select className="Quotation-form-select-compact"
                                                disabled={isViewMode}
                                                value={customerId} onChange={(e) => {
                                                    const id = e.target.value;
                                                    setCustomerId(id);
                                                    const c = customers.find(cust => cust.id === parseInt(id));
                                                    if (c) {
                                                        setCustomerDetails({
                                                            address: c.billingAddress || '',
                                                            email: c.email || '',
                                                            phone: c.phone || ''
                                                        });
                                                    }
                                                }}>
                                                <option value="">Select Customer...</option>
                                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="Quotation-customer-field">
                                            <label className="Quotation-form-label-sm">Billing Address</label>
                                            <input type="text" placeholder="Billing Address" className="Quotation-detail-input-compact"
                                                disabled={isViewMode}
                                                value={customerDetails.address} onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value })} />
                                        </div>
                                        <div className="Quotation-customer-field">
                                            <label className="Quotation-form-label-sm">Email Address</label>
                                            <input type="email" placeholder="Email Address" className="Quotation-detail-input-compact"
                                                disabled={isViewMode}
                                                value={customerDetails.email} onChange={(e) => setCustomerDetails({ ...customerDetails, email: e.target.value })} />
                                        </div>
                                        <div className="Quotation-customer-field">
                                            <label className="Quotation-form-label-sm">Phone Number</label>
                                            <input type="tel" placeholder="Phone Number" className="Quotation-detail-input-compact"
                                                disabled={isViewMode}
                                                value={customerDetails.phone} onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })} />
                                        </div>
                                    </div>

                                    {/* Custom Fields Section */}
                                    {getCustomFieldsForType('salesquotation').length > 0 && (
                                        <div className="Quotation-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>
                                                Custom Fields
                                            </h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                                {getCustomFieldsForType('salesquotation').map(field => (
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

                                    <div className="Quotation-items-section-new">
                                        {!isViewMode && (
                                            <button className="Quotation-btn-add-row" onClick={addItem}>
                                                <Plus size={14} /> Add Line Item
                                            </button>
                                        )}
                                        <div className="Quotation-table-responsive">
                                            <table className="Quotation-new-items-table">
                                                <thead>
                                                     <tr>
                                                        <th style={{ width: '20%' }}>{getTableHeader('item', 'Item Detail').toUpperCase()}</th>
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
                                                                <select className="Quotation-full-width-input"
                                                                    disabled={isViewMode}
                                                                    value={item.productId ? `p-${item.productId}` : item.serviceId ? `s-${item.serviceId}` : ''}
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
                                                                    <select className="Quotation-full-width-input"
                                                                        disabled={isViewMode}
                                                                        value={item.warehouseId} onChange={(e) => updateItem(item.id, 'warehouseId', e.target.value)}>
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
                                                                    <input type="number" className="Quotation-qty-input" value={item.qty}
                                                                        disabled={isViewMode}
                                                                        onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
                                                                </td>
                                                            )}
                                                            {getInvoiceLabel('showUom') !== false && (
                                                                <td>
                                                                    {item.productId || item.serviceId ? (
                                                                        <select className="Quotation-full-width-input" value={item.uomId}
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
                                                                    <input type="number" className="Quotation-rate-input" value={item.rate}
                                                                        disabled={isViewMode}
                                                                        onChange={(e) => updateItem(item.id, 'rate', e.target.value)} />
                                                                </td>
                                                            )}
                                                            {getInvoiceLabel('showTax') !== false && (
                                                                <td>
                                                                    <input type="number" className="Quotation-tax-input" value={item.tax}
                                                                        disabled={isViewMode}
                                                                        onChange={(e) => updateItem(item.id, 'tax', e.target.value)} />
                                                                </td>
                                                            )}
                                                            {getInvoiceLabel('showDiscount') !== false && (
                                                                <td>
                                                                    <input type="number" className="Quotation-discount-input" value={item.discount}
                                                                        disabled={isViewMode}
                                                                        onChange={(e) => updateItem(item.id, 'discount', e.target.value)} />
                                                                </td>
                                                            )}
                                                            <td>
                                                                <input type="text" className="Quotation-amount-input Quotation-disabled" value={formatCurrency(item.total || 0)} disabled />
                                                            </td>
                                                            <td className="text-center">
                                                                <button className="Quotation-btn-delete-row" onClick={() => removeItem(item.id)}>
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="Quotation-bottom-layout-grid">
                                        <div className="Quotation-bottom-left-col">
                                            <div className="Quotation-bank-section">
                                                <label className="Quotation-section-label">Bank Details</label>
                                                <div className="Quotation-bank-details-box">
                                                    <input type="text" className="Quotation-bank-input" placeholder="Bank Name" value={bankDetails.bankName} onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })} />
                                                    <input type="text" className="Quotation-bank-input" placeholder="Account No" value={bankDetails.accNo} onChange={(e) => setBankDetails({ ...bankDetails, accNo: e.target.value })} />
                                                    <input type="text" className="Quotation-bank-input" placeholder="Account Holder" value={bankDetails.holderName} onChange={(e) => setBankDetails({ ...bankDetails, holderName: e.target.value })} />
                                                    <input type="text" className="Quotation-bank-input" placeholder="IFSC / Swift" value={bankDetails.ifsc} onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value })} />
                                                </div>
                                                <div className="Quotation-attachments-section mt-4">
                                                    <label className="Quotation-section-label">Attachments</label>
                                                    <div className="Quotation-attachments-row">
                                                        <input
                                                            type="file"
                                                            multiple
                                                            ref={fileInputRef}
                                                            style={{ display: 'none' }}
                                                            onChange={handleFileChange}
                                                        />
                                                        <button className="Quotation-btn-upload-small" onClick={triggerFileInput}>
                                                            <span className="Quotation-icon">📎</span> Attach Files
                                                        </button>
                                                    </div>
                                                    {attachments.length > 0 && (
                                                        <div className="Quotation-attachment-list">
                                                            {attachments.map((file, index) => (
                                                                <div key={index} className="Quotation-attachment-item">
                                                                    <span className="Quotation-attachment-name">{file.name}</span>
                                                                    <button onClick={() => removeAttachment(index)} className="Quotation-btn-remove-file">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="Quotation-bottom-right-col">
                                            <div className="Quotation-totals-box-container">
                                                <div className="Quotation-totals-box">
                                                    <div className="Quotation-t-row">
                                                        <span>Sub Total:</span>
                                                        <span>{formatCurrency(totals.subTotal)}</span>
                                                    </div>
                                                    <div className="Quotation-t-row">
                                                        <span>Item Discount:</span>
                                                        <span className="text-red-500">-{formatCurrency(totals.discount)}</span>
                                                    </div>
                                                    {/* Overall Discount row */}
                                                    <div className="Quotation-t-row" style={{ alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ whiteSpace: 'nowrap' }}>Overall Discount:</span>
                                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: 'auto' }}>
                                                            <select
                                                                disabled={isViewMode}
                                                                value={overallDiscountType}
                                                                onChange={(e) => setOverallDiscountType(e.target.value)}
                                                                style={{ padding: '2px 4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px', background: '#f8fafc', cursor: 'pointer' }}
                                                            >
                                                                <option value="amount">£</option>
                                                                <option value="percent">%</option>
                                                            </select>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                disabled={isViewMode}
                                                                value={overallDiscount}
                                                                onChange={(e) => setOverallDiscount(e.target.value)}
                                                                style={{ width: '80px', padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                                                            />
                                                            <span className="text-red-500" style={{ minWidth: '70px', textAlign: 'right', fontSize: '13px' }}>
                                                                -{formatCurrency(totals.overallDiscountAmount)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="Quotation-t-row">
                                                        <span>Tax Total:</span>
                                                        <span>{formatCurrency(totals.tax)}</span>
                                                    </div>
                                                    <div className="Quotation-t-row Quotation-total">
                                                        <span>Grand Total:</span>
                                                        <span>{formatCurrency(totals.total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="Quotation-bottom-textareas-row">
                                        <div className="Quotation-notes-section my-4">
                                            <label className="Quotation-section-label">Notes</label>
                                            <textarea className="Quotation-notes-area"
                                                disabled={isViewMode}
                                                value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
                                        </div>

                                        <div className="Quotation-terms-section my-4">
                                            <label className="Quotation-section-label">Terms & Conditions</label>
                                            <textarea className="Quotation-terms-area"
                                                disabled={isViewMode}
                                                value={terms} onChange={(e) => setTerms(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="Quotation-thank-you-note">
                                        <p>Thank you for your business!</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="Quotation-modal-footer-simple">
                            <button className="Quotation-btn-plain" onClick={() => setShowAddModal(false)}>Close</button>
                            {isViewMode && (
                                <>
                                    {quotations.find(q => q.id === editingId)?.status !== 'CONVERTED' ? (
                                        <button className="Quotation-btn-primary-green" onClick={() => handleConvert(editingId)} style={{ backgroundColor: '#4f46e5' }}>
                                            <ShoppingCart size={18} className="mr-2" /> Convert to Sales Order
                                        </button>
                                    ) : (
                                        <span className="text-sm font-semibold px-3 py-2 bg-gray-100 text-gray-500 rounded mr-2">Already Converted</span>
                                    )}
                                    <button className="Quotation-btn-primary-green" onClick={handlePrint}>
                                        <Printer size={18} className="mr-2" /> Print Quotation
                                    </button>
                                </>
                            )}
                            {!isViewMode && (
                                <button className="Quotation-btn-primary-green" onClick={handleSave}>
                                    {editingId ? 'Update Quotation' : 'Save Quotation'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal - User Design Match */}
            {showDeleteConfirm && (
                <div className="Quotation-modal-overlay">
                    <div className="Quotation-delete-confirmation-box">
                        <div className="Quotation-delete-modal-header">
                            <h3 className="Quotation-delete-modal-title">Delete Quotation?</h3>
                            <button className="Quotation-delete-close-btn" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="Quotation-delete-modal-body">
                            <p>Are you sure you want to delete this quotation? This action cannot be undone.</p>
                        </div>
                        <div className="Quotation-delete-modal-footer">
                            <button className="Quotation-btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button className="Quotation-btn-delete-confirm" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Quotation;
