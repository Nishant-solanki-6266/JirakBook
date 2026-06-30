import React, { useState, useEffect, useContext, useMemo } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useLocation, useNavigate } from 'react-router-dom';
import { CompanyContext } from '../../../../context/CompanyContext';
import { AuthContext } from '../../../../context/AuthContext';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Eye, Printer, FilePlus, Check, ArrowLeft
} from 'lucide-react';

import toast from 'react-hot-toast';
import '../Purchase.css';
import './PurchaseBill.css';
import './PurchaseBillInvoiceView.css';
import '../../Sales/Invoice/Invoice.css'; // Global template styles
import purchaseBillService from '../../../../services/purchaseBillService';
import axiosInstance from '../../../../api/axiosInstance';
import purchasePaymentService from '../../../../services/purchasePaymentService';
import vendorService from '../../../../services/vendorService';
import productService from '../../../../api/productService';
import warehouseService from '../../../../api/warehouseService';
import purchaseOrderService from '../../../../services/purchaseOrderService';
import goodsReceiptNoteService from '../../../../services/goodsReceiptNoteService';
import companyService from '../../../../api/companyService';
import uomService from '../../../../services/uomService';
import GetCompanyId from '../../../../api/GetCompanyId';

const PurchaseBill = () => {
    const { companySettings, formatCurrency, getTableHeader, getInvoiceLabel, getDocumentTitle } = useContext(CompanyContext);
    const { hasPermission } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const sourceData = location.state?.sourceData;

    const calculateDueDate = (dateStr, creditPeriod) => {
        if (!dateStr) return '';
        const days = parseInt(creditPeriod) || 0;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [exchangeRate, setExchangeRate] = useState(1.0);

    useEffect(() => {
        if (companySettings?.currency) {
            setSelectedCurrency(companySettings.currency);
        }
    }, [companySettings]);

    const formatDocCurrency = (amount, currencyCode) => {
        const docCurrency = currencyCode || selectedCurrency || companySettings?.currency || 'USD';
        
        const localeMap = {
            'INR': 'en-IN',
            'AED': 'ar-AE',
            'SAR': 'ar-SA',
            'EUR': 'de-DE',
            'GBP': 'en-GB',
            'JPY': 'ja-JP',
            'CNY': 'zh-CN',
            'RUB': 'ru-RU',
            'BRL': 'pt-BR',
            'CAD': 'en-CA',
            'AUD': 'en-AU',
            'PKR': 'en-PK',
            'BDT': 'en-BD'
        };

        const locale = localeMap[docCurrency] || 'en-US';

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: docCurrency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount || 0);
        } catch (e) {
            return `${docCurrency} ${(amount || 0).toFixed(2)}`;
        }
    };



    // --- State Management ---
    const [bills, setBills] = useState([]);
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
    const [loading, setLoading] = useState(true);
    const [vendors, setVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [viewBill, setViewBill] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    // Source Selection State
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [sourceStep, setSourceStep] = useState('type');
    const [selectedSourceType, setSelectedSourceType] = useState(null);
    const [sourceDocs, setSourceDocs] = useState([]);
    const [linkedSource, setLinkedSource] = useState(null);
    const [allUoms, setAllUoms] = useState([]);

    // Form State
    const [companyDetails, setCompanyDetails] = useState({
        name: '', address: '', email: '', phone: '', logo: '', notes: '', terms: ''
    });
    const [billMeta, setBillMeta] = useState({
        manualNo: '', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0]
    });
    const [vendorId, setVendorId] = useState('');
    const [selectedVendorCreditPeriod, setSelectedVendorCreditPeriod] = useState(0);

    const [items, setItems] = useState([
        { id: Date.now(), productId: '', warehouseId: '', qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }
    ]);
    const [notes, setNotes] = useState('');
    const [terms, setTerms] = useState('');
    const [overallDiscount, setOverallDiscount] = useState(0);
    const [overallDiscountType, setOverallDiscountType] = useState('percentage');
    const [bankDetails, setBankDetails] = useState({
        accountName: '', bankName: '', accountNo: '', branch: '', ifsc: ''
    });
    const [billingAddress, setBillingAddress] = useState({
        name: '', address: '', city: '', state: '', zipCode: '', country: '', phone: ''
    });
    const [shippingAddress, setShippingAddress] = useState({
        name: '', address: '', city: '', state: '', zipCode: '', country: '', phone: ''
    });
    const [vendorShippingAddresses, setVendorShippingAddresses] = useState([]);
    const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
    const [nextBillNumber, setNextBillNumber] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceSearchTerm, setSourceSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [billFilterVendorId, setBillFilterVendorId] = useState('');
    const [availablePayments, setAvailablePayments] = useState([]);
    const [adjustments, setAdjustments] = useState([]);

    // Attachments State & Refs
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const photoInputRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    const fetchNextBillNumber = async () => {
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await purchaseBillService.getNextNumber(companyId);
                if (res.success && res.nextNumber) {
                    setNextBillNumber(res.nextNumber);
                    return res.nextNumber;
                }
            }
        } catch (error) {
            console.error("Error generating next bill number:", error);
        }
        return '';
    };

    useEffect(() => {
        fetchInitialData();
        fetchBills();
    }, []);

    // Handle Deep Link from Navigation State
    useEffect(() => {
        const fetchTarget = async () => {
            if (location.state && location.state.targetBillId) {
                try {
                    const companyId = GetCompanyId();
                    const response = await purchaseBillService.getBillById(location.state.targetBillId, companyId);
                    if (response.success) {
                        setViewBill(response.data);
                        setIsViewMode(true);
                    }
                } catch (error) {
                    console.error("Error loading target purchase bill", error);
                }
            }
        };
        fetchTarget();
    }, [location.state]);

    // Handle vendor change to populate addresses
    useEffect(() => {
        if (vendorId && vendors.length > 0) {
            const v = vendors.find(v => v.id == vendorId);
            if (v) {
                setBillingAddress({
                    name: v.billingName || v.name || '',
                    address: v.billingAddress || '',
                    city: v.billingCity || '',
                    state: v.billingState || '',
                    zipCode: v.billingZipCode || '',
                    country: v.billingCountry || '',
                    phone: v.billingPhone || v.phone || ''
                });

                // Default shipping address
                setShippingAddress({
                    name: v.shippingName || v.name || '',
                    address: v.shippingAddress || '',
                    city: v.shippingCity || '',
                    state: v.shippingState || '',
                    zipCode: v.shippingZipCode || '',
                    country: v.shippingCountry || v.billingCountry || '',
                    phone: v.shippingPhone || v.phone || ''
                });

                setVendorShippingAddresses(v.shippingaddress || []);
            }
        } else {
            setBillingAddress({ name: '', address: '', city: '', state: '', zipCode: '', country: '', phone: '' });
            setShippingAddress({ name: '', address: '', city: '', state: '', zipCode: '', country: '', phone: '' });
            setVendorShippingAddresses([]);
        }
    }, [vendorId, vendors]);

    // Update shipping if same as billing
    useEffect(() => {
        if (shippingSameAsBilling) {
            setShippingAddress({ ...billingAddress });
        }
    }, [billingAddress, shippingSameAsBilling]);

    const handleShippingAddressSelect = (addrId) => {
        if (addrId === 'default') {
            const v = vendors.find(v => v.id == vendorId);
            if (v) {
                setShippingAddress({
                    name: v.shippingName || v.name || '',
                    address: v.shippingAddress || '',
                    city: v.shippingCity || '',
                    state: v.shippingState || '',
                    zipCode: v.shippingZipCode || '',
                    country: v.shippingCountry || v.billingCountry || '',
                    phone: v.shippingPhone || v.phone || ''
                });
                setShippingSameAsBilling(false);
            }
        } else if (addrId === 'billing') {
            setShippingSameAsBilling(true);
        } else {
            const addr = vendorShippingAddresses.find(a => a.id == addrId);
            if (addr) {
                setShippingAddress({
                    name: addr.name || '',
                    address: addr.address || '',
                    city: addr.city || '',
                    state: addr.state || '',
                    zipCode: addr.zipCode || '',
                    country: addr.country || '',
                    phone: addr.phone || ''
                });
                setShippingSameAsBilling(false);
            }
        }
    };

    useEffect(() => {
        if (sourceData && !editingId && vendors.length > 0) {
            setVendorId(sourceData.vendorId);
            setNotes(sourceData.notes || '');
            setTerms(sourceData.terms || '');

            if (sourceData.items) {
                const billItems = sourceData.items.map(item => {
                    let rate = item.rate || 0;
                    let tax = item.taxRate || item.tax || 0;
                    let discount = item.discount || 0;

                    // If we have a GRN source with PO items linked in sourceData (unlikely but safe)
                    if (sourceData.sourceType === 'grn' && sourceData.poItems) {
                        const poItem = sourceData.poItems.find(pi => pi.productId === item.productId);
                        if (poItem) {
                            rate = poItem.rate || 0;
                            tax = poItem.taxRate || 0;
                            discount = poItem.discount || 0;
                        }
                    }

                    return {
                        id: Date.now() + Math.random(),
                        productId: item.productId || item.product?.id || '',
                        warehouseId: item.warehouseId || item.warehouse?.id || '',
                        qty: item.receivedQty || item.quantity || item.qty || 1,
                        uomId: item.uomId || '',
                        rate,
                        tax,
                        discount,
                        total: 0,
                        description: item.description || ''
                    };
                });

                const calculatedItems = billItems.map(i => {
                    const sub = i.qty * i.rate;
                    const taxAmt = ((sub - i.discount) * i.tax) / 100;
                    return { ...i, total: (sub - i.discount) + taxAmt };
                });

                setItems(calculatedItems);
            }
            setShowAddModal(true);
        }
    }, [sourceData, editingId, vendors, warehouses]);

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
            const companyRes = companyId ? results[4] : null;

            setVendors(vendorRes.data || vendorRes || []);
            setProducts(productRes.data || productRes || []);
            setWarehouses(warehouseRes.data || warehouseRes || []);
            if (uomRes && uomRes.success) {
                setAllUoms(uomRes.data);
            }

            if (companyRes && companyRes.data) {
                const cData = companyRes.data;
                setCompanyDetails({
                    name: cData.name || '',
                    email: cData.email || '',
                    phone: cData.phone || '',
                    address: `${cData.address || ''}, ${cData.city || ''}`,
                    logo: cData.invoiceLogo || cData.logo || '',
                    template: cData.invoiceTemplate || 'New York',
                    color: cData.invoiceColor || '#004aad',
                    showQrCode: cData.showQrCode !== undefined ? cData.showQrCode : true,
                    accountHolder: cData.accountHolder || '',
                    bankName: cData.bankName || '',
                    accountNumber: cData.accountNumber || '',
                    ifsc: cData.ifsc || '',
                    notes: cData.notes || '',
                    terms: cData.terms || '',
                    termsPurchase: cData.termsPurchase || ''
                });
                setNotes(cData.notes || '');
                setTerms(cData.termsPurchase || cData.terms || '');
                setBankDetails({
                    accountName: cData.accountHolder || '',
                    bankName: cData.bankName || '',
                    accountNo: cData.accountNumber || '',
                    branch: '',
                    ifsc: cData.ifsc || ''
                });
                if (cData.notes) setNotes(cData.notes);
                if (cData.termsPurchase || cData.terms) setTerms(cData.termsPurchase || cData.terms);
            }

        } catch (error) {
            console.error(error);
            toast.error("Failed to load initial data");
        }
    };

    const filteredBills = useMemo(() => {
        return bills.filter(b => {
            const query = searchTerm.toLowerCase();
            const billNo = (b.billNumber || '').toLowerCase();
            const vendorName = (b.vendor?.name || '').toLowerCase();
            const poRef = (b.purchaseorder?.orderNumber || '').toLowerCase();

            const matchesSearch = !query ||
                billNo.includes(query) ||
                vendorName.includes(query) ||
                poRef.includes(query);

            const bDate = new Date(b.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || bDate >= start) && (!end || bDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [bills, searchTerm, startDate, endDate]);

    const filteredSourceDocs = useMemo(() => {
        return sourceDocs.filter(doc => {
            const query = sourceSearchTerm.toLowerCase();
            const docRef = (doc.poNumber || doc.grnNumber || doc.billNumber || doc.id || '').toString().toLowerCase();
            const vendorName = (doc.vendor?.name || '').toLowerCase();
            const amount = (doc.totalAmount || 0).toString();

            const matchesSearch = !query ||
                docRef.includes(query) ||
                vendorName.includes(query) ||
                amount.includes(query);

            const matchesVendor = !billFilterVendorId || doc.vendorId === parseInt(billFilterVendorId);

            return matchesSearch && matchesVendor;
        });
    }, [sourceDocs, sourceSearchTerm, billFilterVendorId]);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            const res = await purchaseBillService.getBills(companyId);
            if (res.success) {
                setBills(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setIsViewMode(false);
        setViewBill(null);
        setVendorId('');
        setSelectedVendorCreditPeriod(0);
        setSelectedCurrency(companyDetails.currency || companySettings?.currency || 'USD');
        setExchangeRate(1.0);
        setBillMeta({ manualNo: '', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0] });
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
        setCustomFieldValues({});
        setSelectedPhotos([]);
        setSelectedFiles([]);
        setShowAddModal(false);
        setShowSourceModal(false);
        setSourceStep('type');
        setSourceDocs([]);
        setLinkedSource(null);
        setSourceSearchTerm('');
        setBillFilterVendorId('');
        setOverallDiscount(0);
        setOverallDiscountType('percentage');
        setAvailablePayments([]);
        setAdjustments([]);
        fetchInitialData();
    };

    const fetchVendorPayments = async (vId) => {
        if (!vId) {
            setAvailablePayments([]);
            setAdjustments([]);
            return;
        }
        try {
            const companyId = GetCompanyId();
            const res = await purchasePaymentService.getPayments(companyId, { vendorId: vId });
            const payments = (res || []).map(p => {
                const allocatedAmount = p.allocations?.reduce((sum, a) => sum + a.amount, 0) || 0;
                const availableAdvance = p.amount - allocatedAmount;
                return {
                    ...p,
                    availableAdvance
                };
            }).filter(p => p.availableAdvance > 0.01);
            
            setAvailablePayments(payments);
            setAdjustments([]);
        } catch (error) {
            console.error("Error fetching vendor payments:", error);
        }
    };

    const loadVendorPaymentsForEdit = async (vId, billId) => {
        if (!vId) {
            setAvailablePayments([]);
            setAdjustments([]);
            return;
        }
        try {
            const companyId = GetCompanyId();
            const paymentsRes = await purchasePaymentService.getPayments(companyId, { vendorId: vId });
            const billRes = await purchaseBillService.getBillById(billId, companyId);
            const currentAllocations = billRes.data?.allocations || [];
            
            const payments = (paymentsRes || []).map(p => {
                const otherAllocations = p.allocations?.filter(a => a.purchaseBillId !== billId) || [];
                const otherAllocatedSum = otherAllocations.reduce((sum, a) => sum + a.amount, 0) || 0;
                const availableAdvance = p.amount - otherAllocatedSum;
                
                const currentAlloc = currentAllocations.find(a => a.paymentId === p.id);
                const currentAllocAmount = currentAlloc ? currentAlloc.amount : 0;
                
                return {
                    ...p,
                    availableAdvance,
                    currentAllocAmount
                };
            }).filter(p => p.availableAdvance > 0.01 || p.currentAllocAmount > 0);
            
            setAvailablePayments(payments);
            
            const initialAdjustments = currentAllocations.map(a => {
                const pObj = paymentsRes.find(p => p.id === a.paymentId);
                return {
                    paymentId: a.paymentId,
                    paymentNumber: pObj ? pObj.paymentNumber : `Payment #${a.paymentId}`,
                    amount: a.amount
                };
            });
            setAdjustments(initialAdjustments);
        } catch (error) {
            console.error("Error loading vendor payments for edit:", error);
        }
    };

    const handleAddNew = async () => {
        resetForm();
        setShowSourceModal(false);
        const nextNum = await fetchNextBillNumber();
        setBillMeta(prev => ({ ...prev, manualNo: nextNum }));
        setShowAddModal(true);
    };

    const handleSourceTypeSelect = async (type) => {
        setSelectedSourceType(type);
        if (type === 'manual') {
            setShowSourceModal(false);
            const nextNum = await fetchNextBillNumber();
            setBillMeta(prev => ({ ...prev, manualNo: nextNum }));
            setShowAddModal(true);
        } else if (type === 'po') {
            setLoading(true);
            try {
                const companyId = GetCompanyId();
                const res = await purchaseOrderService.getOrders(companyId);
                const orders = res.data || res || [];
                // Filter out POs that are already completed OR already have linked bills
                setSourceDocs(orders.filter(o => o.status !== 'COMPLETED' && (!o.purchaseBills || o.purchaseBills.length === 0)));
                setSourceStep('list');
            } catch (err) {
                toast.error('Failed to fetch Purchase Orders');
            } finally {
                setLoading(false);
            }
        } else if (type === 'grn') {
            setLoading(true);
            try {
                const companyId = GetCompanyId();
                const res = await goodsReceiptNoteService.getGRNs(companyId);
                const grns = res.data || res || [];
                // Filter out GRNs that are already invoiced OR already have linked bills
                setSourceDocs(grns.filter(g => g.status !== 'Invoiced' && (!g.purchaseBills || g.purchaseBills.length === 0)));
                setSourceStep('list');
            } catch (err) {
                toast.error('Failed to fetch GRNs');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSourceDocSelect = async (doc) => {
        setVendorId(doc.vendorId);
        const vendorObj = vendors.find(v => v.id == doc.vendorId);
        const creditDays = vendorObj?.creditPeriod || 0;
        setSelectedVendorCreditPeriod(creditDays);
        const newDueDate = calculateDueDate(billMeta.date, creditDays);
        setBillMeta(prev => ({ ...prev, dueDate: newDueDate }));
        setNotes(doc.notes || '');
        setTerms(doc.terms || '');

        let mappedItems = [];
        const itemsList = doc.purchaseorderitem || doc.goodsreceiptnoteitem || doc.items || [];
        if (itemsList.length > 0) {
            mappedItems = itemsList.map(item => {
                let rate = item.rate || 0;
                let tax = item.taxRate || item.tax || 0;
                let discount = item.discount || 0;

                // For GRN, pull rates/taxes from the linked Purchase Order
                if (selectedSourceType === 'grn' && doc.purchaseorder?.purchaseorderitem) {
                    const poItem = doc.purchaseorder.purchaseorderitem.find(pi => pi.productId === item.productId);
                    if (poItem) {
                        rate = poItem.rate || 0;
                        tax = poItem.taxRate || 0;
                        discount = poItem.discount || 0;
                    }
                }

                return {
                    id: Date.now() + Math.random(),
                    productId: item.productId || item.product?.id || '',
                    warehouseId: item.warehouseId || item.warehouse?.id || '',
                    qty: item.receivedQty || item.quantity || item.qty || 1,
                    uomId: item.uomId || '',
                    rate,
                    tax,
                    discount,
                    total: 0,
                    description: item.description || ''
                };
            });

            mappedItems = mappedItems.map(i => {
                const sub = i.qty * i.rate;
                const taxAmt = ((sub - i.discount) * i.tax) / 100;
                return { ...i, total: (sub - i.discount) + taxAmt };
            });
            setItems(mappedItems);
        }

        if (selectedSourceType === 'po') {
            setLinkedSource({ purchaseOrderId: doc.id });
            const nextNum = await fetchNextBillNumber();
            setBillMeta(prev => ({ ...prev, manualNo: nextNum || `BILL-PO-${doc.poNumber || doc.id}` }));
        } else if (selectedSourceType === 'grn') {
            setLinkedSource({ grnId: doc.id, purchaseOrderId: doc.purchaseOrderId });
            const nextNum = await fetchNextBillNumber();
            setBillMeta(prev => ({ ...prev, manualNo: nextNum || `BILL-GRN-${doc.grnNumber || doc.id}` }));
        }

        setShowSourceModal(false);
        setShowAddModal(true);
    };

    const handleView = async (bill) => {
        try {
            const companyId = GetCompanyId();
            const res = await purchaseBillService.getBillById(bill.id, companyId);
            if (res.success && res.data) {
                const billData = res.data;
                resetForm();
                setViewBill(billData);
                setEditingId(billData.id);
                setVendorId(billData.vendorId);
                setBillMeta({
                    manualNo: billData.billNumber,
                    date: billData.date.split('T')[0],
                    dueDate: billData.dueDate ? billData.dueDate.split('T')[0] : ''
                });
                setNotes(billData.notes || '');

                const itemsData = billData.purchasebillitem || billData.items;
                if (itemsData) {
                    const mappedItems = itemsData.map(i => ({
                        id: i.id || Date.now() + Math.random(),
                        productId: i.productId || '',
                        warehouseId: i.warehouseId || '',
                        qty: i.quantity,
                        uomId: i.uomId || '',
                        rate: i.rate,
                        tax: i.taxRate,
                        discount: i.discount,
                        total: i.amount,
                        description: i.description
                    }));
                    setItems(mappedItems);
                }
                let fieldValues = {};
                if (billData.customFields) {
                    try {
                        fieldValues = typeof billData.customFields === 'string'
                            ? JSON.parse(billData.customFields)
                            : billData.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on edit:', e);
                    }
                }
                setCustomFieldValues(fieldValues);
                setSelectedPhotos(fieldValues?._attachments?.photos || []);
                setSelectedFiles(fieldValues?._attachments?.files || []);
                setOverallDiscount(billData.overallDiscount || 0);
                setOverallDiscountType(billData.overallDiscountType || 'percentage');
                setSelectedCurrency(billData.currency || companySettings?.currency || 'USD');
                setExchangeRate(billData.exchangeRate || 1.0);

                // Set address details
                setBillingAddress({
                    name: billData.billingName || (billData.vendor?.billingName || billData.vendor?.name || ''),
                    address: billData.billingAddress || (billData.vendor?.billingAddress || ''),
                    city: billData.billingCity || (billData.vendor?.billingCity || ''),
                    state: billData.billingState || (billData.vendor?.billingState || ''),
                    zipCode: billData.billingZipCode || (billData.vendor?.billingZipCode || ''),
                    country: billData.billingCountry || (billData.vendor?.billingCountry || ''),
                    phone: billData.vendor?.billingPhone || billData.vendor?.phone || ''
                });

                setShippingAddress({
                    name: billData.shippingName || (billData.vendor?.shippingName || billData.vendor?.name || ''),
                    address: billData.shippingAddress || (billData.vendor?.shippingAddress || ''),
                    city: billData.shippingCity || (billData.vendor?.shippingCity || ''),
                    state: billData.shippingState || (billData.vendor?.shippingState || ''),
                    zipCode: billData.shippingZipCode || (billData.vendor?.shippingZipCode || ''),
                    country: billData.shippingCountry || (billData.vendor?.shippingCountry || ''),
                    phone: billData.vendor?.shippingPhone || billData.vendor?.phone || ''
                });

                setIsViewMode(true);
                // setShowAddModal(true);
            }
        } catch (error) {
            console.error("Error fetching bill details", error);
            toast.error("Failed to fetch bill details");
        }
    };

    const handleVendorView = (group) => {
        resetForm();
        const allPayments = [];
        group.bills.forEach(bill => {
            if (bill.payment && bill.payment.length > 0) {
                bill.payment.forEach(pay => {
                    allPayments.push(pay);
                });
            }
        });
        // Sort payments by date ascending
        allPayments.sort((a, b) => new Date(a.date) - new Date(b.date));

        setViewBill({
            ...group,
            isStatement: true,
            payment: allPayments,
            billingName: group.vendor?.billingName || group.vendor?.name || '',
            billingAddress: group.vendor?.billingAddress || '',
            billingCity: group.vendor?.billingCity || '',
            billingState: group.vendor?.billingState || '',
            billingZipCode: group.vendor?.billingZipCode || '',
            billingCountry: group.vendor?.billingCountry || '',
            shippingName: group.vendor?.shippingName || group.vendor?.name || '',
            shippingAddress: group.vendor?.shippingAddress || group.vendor?.billingAddress || '',
            shippingCity: group.vendor?.city || '',
            shippingState: group.vendor?.state || '',
            shippingZipCode: group.vendor?.zipCode || '',
            shippingCountry: group.vendor?.country || ''
        });
        setIsViewMode(true);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleEdit = async (id) => {
        try {
            const companyId = GetCompanyId();
            const res = await purchaseBillService.getBillById(id, companyId);
            if (res.success && res.data) {
                const billToEdit = res.data;
                resetForm();
                setEditingId(id);
                setVendorId(billToEdit.vendorId);
                const vendorObj = vendors.find(v => v.id == billToEdit.vendorId);
                setSelectedVendorCreditPeriod(vendorObj?.creditPeriod || 0);
                setBillMeta({
                    manualNo: billToEdit.billNumber,
                    date: billToEdit.date.split('T')[0],
                    dueDate: billToEdit.dueDate ? billToEdit.dueDate.split('T')[0] : ''
                });
                setNotes(billToEdit.notes || '');

                const itemsData = billToEdit.purchasebillitem || billToEdit.items;
                if (itemsData) {
                    const mappedItems = itemsData.map(i => ({
                        id: i.id || Date.now() + Math.random(),
                        productId: i.productId || '',
                        warehouseId: i.warehouseId || '',
                        qty: i.quantity,
                        uomId: i.uomId || '',
                        rate: i.rate,
                        tax: i.taxRate,
                        discount: i.discount,
                        total: i.amount,
                        description: i.description
                    }));
                    setItems(mappedItems);
                }
                let fieldValues = {};
                if (billToEdit.customFields) {
                    try {
                        fieldValues = typeof billToEdit.customFields === 'string'
                            ? JSON.parse(billToEdit.customFields)
                            : billToEdit.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on edit:', e);
                    }
                }
                setCustomFieldValues(fieldValues);
                setSelectedPhotos(fieldValues?._attachments?.photos || []);
                setSelectedFiles(fieldValues?._attachments?.files || []);
                setOverallDiscount(billToEdit.overallDiscount || 0);
                setOverallDiscountType(billToEdit.overallDiscountType || 'percentage');
                setSelectedCurrency(billToEdit.currency || companySettings?.currency || 'USD');
                setExchangeRate(billToEdit.exchangeRate || 1.0);

                // Set address details
                setBillingAddress({
                    name: billToEdit.billingName || (billToEdit.vendor?.billingName || billToEdit.vendor?.name || ''),
                    address: billToEdit.billingAddress || (billToEdit.vendor?.billingAddress || ''),
                    city: billToEdit.billingCity || (billToEdit.vendor?.billingCity || ''),
                    state: billToEdit.billingState || (billToEdit.vendor?.billingState || ''),
                    zipCode: billToEdit.billingZipCode || (billToEdit.vendor?.billingZipCode || ''),
                    country: billToEdit.billingCountry || (billToEdit.vendor?.billingCountry || ''),
                    phone: billToEdit.vendor?.billingPhone || billToEdit.vendor?.phone || ''
                });

                setShippingAddress({
                    name: billToEdit.shippingName || (billToEdit.vendor?.shippingName || billToEdit.vendor?.name || ''),
                    address: billToEdit.shippingAddress || (billToEdit.vendor?.shippingAddress || ''),
                    city: billToEdit.shippingCity || (billToEdit.vendor?.shippingCity || ''),
                    state: billToEdit.shippingState || (billToEdit.vendor?.shippingState || ''),
                    zipCode: billToEdit.shippingZipCode || (billToEdit.vendor?.shippingZipCode || ''),
                    country: billToEdit.shippingCountry || (billToEdit.vendor?.shippingCountry || ''),
                    phone: billToEdit.vendor?.shippingPhone || billToEdit.vendor?.phone || ''
                });

                setLinkedSource({
                    grnId: billToEdit.grnId || null,
                    purchaseOrderId: billToEdit.purchaseOrderId || null
                });
                await loadVendorPaymentsForEdit(billToEdit.vendorId, id);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error("Error fetching bill details", error);
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
            await purchaseBillService.deleteBill(deleteId, companyId);
            toast.success("Bill deleted");
            fetchBills();
        } catch (error) {
            console.error(error);
        }
        setShowDeleteConfirm(false);
        setDeleteId(null);
    };

    const handleStatusChange = async (billId, newStatus) => {
        try {
            const companyId = GetCompanyId();
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };
            const res = await purchaseBillService.updateBill(billId, payload, companyId);
            if (res?.success || res?.data?.success) {
                toast.success('Status updated');
                fetchBills();
            }
        } catch (error) {
            console.error('Error changing status:', error);
            toast.error('Failed to update status');
        }
    };

    const safeFloat = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    const handleSave = async () => {
        if (!vendorId) {
            toast.error("Please select a vendor");
            return;
        }

        const totals = calculateTotals();

        const companyId = GetCompanyId();
        const customFieldsPayload = {
            ...customFieldValues,
            _attachments: {
                photos: selectedPhotos,
                files: selectedFiles
            }
        };

        const payload = {
            customFields: JSON.stringify(customFieldsPayload),
            companyId,
            purchaseOrderId: sourceData?.purchaseOrderId || linkedSource?.purchaseOrderId || null,
            grnId: sourceData?.grnId || linkedSource?.grnId || null,
            vendorId: parseInt(vendorId),
            billNumber: billMeta.manualNo || `BILL-${Date.now()}`,
            date: billMeta.date,
            dueDate: billMeta.dueDate,
            totalAmount: safeFloat(totals.total),
            taxAmount: safeFloat(totals.tax),
            discountAmount: safeFloat(totals.discount),
            overallDiscount: safeFloat(overallDiscount),
            overallDiscountType: overallDiscountType,
            currency: selectedCurrency,
            exchangeRate: safeFloat(exchangeRate) || 1.0,
            adjustments: adjustments.filter(adj => adj.amount > 0).map(adj => ({
                paymentId: adj.paymentId,
                amount: adj.amount
            })),
            items: items.map(item => ({
                productId: parseInt(item.productId),
                warehouseId: item.warehouseId ? parseInt(item.warehouseId) : null,
                uomId: item.uomId ? parseInt(item.uomId) : null,
                description: item.description,
                quantity: safeFloat(item.qty),
                rate: safeFloat(item.rate),
                discount: safeFloat(item.discount),
                taxRate: safeFloat(item.tax),
                amount: safeFloat(item.total)
            })),
            notes,
            billingName: billingAddress.name,
            billingAddress: billingAddress.address,
            billingCity: billingAddress.city,
            billingState: billingAddress.state,
            billingZipCode: billingAddress.zipCode,
            billingCountry: billingAddress.country,
            shippingName: shippingAddress.name,
            shippingAddress: shippingAddress.address,
            shippingCity: shippingAddress.city,
            shippingState: shippingAddress.state,
            shippingZipCode: shippingAddress.zipCode,
            shippingCountry: shippingAddress.country
        };

        try {
            if (editingId) {
                await purchaseBillService.updateBill(editingId, payload);
                toast.success("Bill updated successfully");
                setEditingId(null);
                setShowAddModal(false);
                fetchBills();
            } else {
                await purchaseBillService.createBill(payload);
                toast.success("Bill created successfully");
                setShowAddModal(false);
                fetchBills();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to save bill");
        }
    };

    const handleAttachmentUpload = async (e, type) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const setUploading = type === 'photo' ? setUploadingPhotos : setUploadingFiles;
        const setSelected = type === 'photo' ? setSelectedPhotos : setSelectedFiles;

        setUploading(true);
        try {
            const uploadedUrls = [];
            for (const file of files) {
                const formDataUpload = new FormData();
                formDataUpload.append('file', file);
                const res = await axiosInstance.post('/upload?folder=purchase-bills', formDataUpload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data.success) {
                    uploadedUrls.push({
                        name: file.name,
                        url: res.data.url
                    });
                }
            }
            setSelected(prev => [...prev, ...uploadedUrls]);
            toast.success(`${files.length} file(s) uploaded successfully!`);
        } catch (err) {
            console.error(err);
            toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleMakePayment = (bill) => {
        navigate('/company/purchases/payment', {
            state: {
                sourceData: {
                    vendorId: bill.vendorId,
                    amount: bill.totalAmount,
                    billNumber: bill.billNumber,
                    billId: bill.id
                }
            }
        });
    };

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
                        updatedItem.uomId = prod.purchaseUomId || prod.uomId || '';
                        updatedItem.rate = prod.purchasePrice || 0;
                        updatedItem.description = prod.description || '';
                    }
                } else if (field === 'uomId') {
                    const newUomId = value ? parseInt(value) : '';
                    const prodId = item.productId ? parseInt(item.productId) : null;
                    const prod = prodId ? products.find(p => p.id === prodId) : null;
                    if (prod) {
                        const newUom = allUoms.find(u => u.id === newUomId) || prod.uom || prod.purchaseUom || prod.salesUom;
                        const basePrice = prod.purchasePrice || 0;
                        const multiplier = newUom?.uomType === 'Compound' ? parseFloat(newUom.conversionRate) || 1 : 1;
                        updatedItem = { 
                            ...item, 
                            uomId: newUomId,
                            rate: basePrice * multiplier
                        };
                    } else {
                        updatedItem = { ...item, uomId: newUomId };
                    }
                }

                if (['qty', 'rate', 'tax', 'discount'].includes(field) || field === 'productId') {
                    const qty = parseFloat(updatedItem.qty) || 0;
                    const rate = parseFloat(updatedItem.rate) || 0;
                    const tax = parseFloat(updatedItem.tax) || 0;
                    const discount = parseFloat(updatedItem.discount) || 0;

                    const subtotal = qty * rate;
                    const taxable = subtotal - discount;
                    const taxAmount = (taxable * tax) / 100;

                    const totalVal = taxable + taxAmount;
                    updatedItem.total = isNaN(totalVal) ? 0 : totalVal;
                }
                return updatedItem;
            }
            return item;
        }));
    };

    const calculateTotals = () => {
        const totalsObj = items.reduce((acc, item) => {
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const discount = parseFloat(item.discount) || 0;
            const subtotal = qty * rate;
            const tax = parseFloat(item.tax) || 0;
            const taxable = subtotal - discount;
            const taxAmount = (taxable * tax) / 100;

            acc.subTotal += subtotal;
            acc.discount += discount;
            acc.tax += taxAmount;
            acc.total += item.total;
            return acc;
        }, { subTotal: 0, tax: 0, discount: 0, total: 0 });

        let finalTotal = totalsObj.total;
        let ovDiscountAmt = 0;
        if (overallDiscount && overallDiscount > 0) {
            if (overallDiscountType === 'percentage') {
                ovDiscountAmt = (finalTotal * parseFloat(overallDiscount)) / 100;
                finalTotal -= ovDiscountAmt;
            } else {
                ovDiscountAmt = parseFloat(overallDiscount);
                finalTotal -= ovDiscountAmt;
            }
        }
        totalsObj.total = Math.max(0, finalTotal);
        totalsObj.ovDiscountAmt = ovDiscountAmt;
        return totalsObj;
    };

    const totals = calculateTotals();

    const purchaseProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'completed' },
        { id: 'purchase-order', label: 'Purchase Order', icon: ShoppingCart, status: 'completed' },
        { id: 'grn', label: 'Goods Receipt', icon: Truck, status: 'completed' },
        { id: 'bill', label: 'Bill', icon: Receipt, status: 'active' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'pending' },
    ];

    if (isViewMode && viewBill) {
        return (
            <div className="PBILL-page-full-view p-3">
                <div className="PBILL-view-header no-print">
                    <button className="PBILL-back-btn" onClick={() => {
                        if (location.state && location.state.targetBillId) {
                            navigate(-1);
                        } else {
                            setIsViewMode(false);
                            setViewBill(null);
                            navigate('/company/purchases/bill', { replace: true, state: {} });
                        }
                    }}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div className="PBILL-view-actions">
                        {viewBill.balanceAmount > 0 && hasPermission('create purchase payment') && !viewBill.isStatement && (
                            <button 
                                className="PBILL-btn-add" 
                                onClick={() => handleMakePayment(viewBill)}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px',
                                    backgroundColor: '#16a34a',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                <CreditCard size={18} /> Record Payment
                            </button>
                        )}
                        <button className="PBILL-btn-print" onClick={handlePrint}>
                            <Printer size={18} /> Print
                        </button>
                    </div>
                </div>

                <div className="PBILL-view-content-pane printable-area">
                        <div
                            className={`invoice-preview-container template-${(companySettings?.invoiceTemplate || companyDetails.template || 'New York').toLowerCase().replace(' ', '').replace('invoice-', '')}`}
                            id="invoice-print-content"
                            style={{ 
                                '--header-bg': companySettings?.invoiceColor || companyDetails.color || '#004aad',
                                '--header-text': (() => {
                                    const hex = (companySettings?.invoiceColor || companyDetails.color || '#004aad').replace('#', '');
                                    const r = parseInt(hex.substr(0, 2), 16);
                                    const g = parseInt(hex.substr(2, 2), 16);
                                    const b = parseInt(hex.substr(4, 2), 16);
                                    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                                    return (yiq >= 150) ? '#1e293b' : '#ffffff';
                                })()
                            }}
                        >
                            {/* Header Section */}
                            {getInvoiceLabel('showHeader') !== false && (
                                <div className="invoice-header-wrapper">
                                    <div className="invoice-preview-header">
                                        <div className="invoice-header-left">
                                            {companySettings?.invoiceLogo || companyDetails.logo ? (
                                                <img 
                                                    src={companySettings?.invoiceLogo || (companyDetails.logo.startsWith('http') ? companyDetails.logo : `${BASE_URL}/${companyDetails.logo.replace(/\\/g, '/')}`)} 
                                                    alt="Company Logo" 
                                                    className="invoice-logo-large" 
                                                />
                                            ) : (
                                                <h2 style={{ color: companySettings?.invoiceColor || companyDetails.color, margin: 0, textTransform: 'uppercase' }}>{companyDetails.name}</h2>
                                            )}

                                            <div className="invoice-company-details">
                                                <strong>{companyDetails.name}</strong><br />
                                                {companyDetails.email}<br />
                                                {companyDetails.phone}<br />
                                                {companyDetails.address}
                                            </div>
                                        </div>
                                         <div className="invoice-header-right">
                                            <div className="invoice-title-large">{viewBill.isStatement ? 'VENDOR STATEMENT' : getDocumentTitle('purchasebill')}</div>
                                            <div className="invoice-meta-info">
                                                {viewBill.isStatement ? (
                                                    <>
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">Vendor:</span> {viewBill.vendor?.name}
                                                        </div>
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">Total Bills:</span> {viewBill.bills.length}
                                                        </div>
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">As of:</span> {new Date().toLocaleDateString()}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">Bill No:</span> {viewBill.billNumber}
                                                        </div>
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">Date:</span> {new Date(viewBill.date).toLocaleDateString()}
                                                        </div>
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">{getInvoiceLabel('dueDate')}</span> {viewBill.dueDate ? new Date(viewBill.dueDate).toLocaleDateString() : 'N/A'}
                                                        </div>
                                                        {viewBill.currency && viewBill.currency !== (companySettings?.currency || 'INR') && (
                                                            <>
                                                                <div className="invoice-meta-row">
                                                                    <span className="invoice-label">Currency:</span> {viewBill.currency}
                                                                </div>
                                                                <div className="invoice-meta-row">
                                                                    <span className="invoice-label">Ex. Rate:</span> 1 {viewBill.currency} = {viewBill.exchangeRate || 1.0} {companySettings?.currency || 'INR'}
                                                                </div>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {companyDetails.showQrCode && (
                                                <div className="invoice-qr-box" style={{ 
                                                    marginTop: '15px', 
                                                    display: 'flex', 
                                                    justifyContent: 'flex-end',
                                                    visibility: 'visible',
                                                    opacity: 1
                                                }}>
                                                    <img 
                                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${window.location.origin}/view/bill/${viewBill.id}`)}`} 
                                                        alt="QR" 
                                                        style={{ width: '100px', height: '100px', display: 'block' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                             {/* Addresses Section */}
                            <div className="invoice-addresses">
                                <div className="invoice-bill-to">
                                    <div className="invoice-section-header">{getInvoiceLabel('billTo')}</div>
                                    <div className="font-bold">{viewBill.billingName || viewBill.vendor?.name || 'N/A'}</div>
                                    <div className="invoice-company-details">
                                        {viewBill.billingAddress || viewBill.vendor?.billingAddress || 'N/A'}<br />
                                        {[viewBill.billingCity || viewBill.vendor?.city, viewBill.billingState || viewBill.vendor?.state, viewBill.billingZipCode || viewBill.vendor?.zipCode].filter(Boolean).join(', ')}
                                    </div>
                                </div>
                                <div className="invoice-ship-to" style={{ textAlign: 'right' }}>
                                    <div className="invoice-section-header">{getInvoiceLabel('shipTo')}</div>
                                    <div className="font-bold">{viewBill.shippingName || viewBill.vendor?.name || 'N/A'}</div>
                                    <div className="invoice-company-details">
                                        {viewBill.shippingAddress || viewBill.vendor?.shippingAddress || viewBill.vendor?.billingAddress}<br />
                                        {[viewBill.shippingCity || viewBill.vendor?.city, viewBill.shippingState || viewBill.vendor?.state, viewBill.shippingZipCode || viewBill.vendor?.zipCode].filter(Boolean).join(', ')}
                                    </div>
                                </div>
                            </div>

                            {/* Custom Fields Print View */}
                            {(() => {
                                let customFieldVals = {};
                                if (viewBill?.customFields) {
                                    try {
                                        customFieldVals = typeof viewBill.customFields === 'string'
                                            ? JSON.parse(viewBill.customFields)
                                            : viewBill.customFields;
                                    } catch (e) {
                                        console.error('Error parsing bill custom fields for view:', e);
                                    }
                                }
                                const fieldsList = getCustomFieldsForType('purchasebill');
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

                             {/* Items Table / Bills Table */}
                            {viewBill.isStatement ? (
                                <table className="invoice-table-preview">
                                    <thead>
                                        <tr>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>Bill No</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>Date</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('item', 'Item').toUpperCase()}</th>
                                            {getInvoiceLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                            {getInvoiceLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>Bill Total</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>Paid</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>Due</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewBill.bills.map((bill, bIdx) => {
                                            const items = bill.purchasebillitem || bill.items || [];
                                            return items.map((item, iIdx) => (
                                                <tr key={`${bIdx}-${iIdx}`}>
                                                    <td style={{ fontWeight: iIdx === 0 ? 600 : 400, color: iIdx === 0 ? 'inherit' : '#94a3b8' }}>
                                                        {iIdx === 0 ? bill.billNumber : ''}
                                                    </td>
                                                    <td style={{ color: iIdx === 0 ? 'inherit' : '#94a3b8' }}>
                                                        {iIdx === 0 ? new Date(bill.date).toLocaleDateString() : ''}
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>{item.product?.name || 'N/A'}</td>
                                                    {getInvoiceLabel('showWarehouse') !== false && <td>{item.warehouse?.name || 'N/A'}</td>}
                                                    {getInvoiceLabel('showQty') !== false && <td style={{ textAlign: 'center' }}>{item.quantity}</td>}
                                                    <td style={{ textAlign: 'right' }}>
                                                        {iIdx === 0 ? formatCurrency(bill.totalAmount) : ''}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {iIdx === 0 ? formatCurrency(bill.totalAmount - bill.balanceAmount) : ''}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: iIdx === 0 ? 600 : 400 }}>
                                                        {iIdx === 0 ? formatCurrency(bill.balanceAmount) : ''}
                                                    </td>
                                                </tr>
                                            ));
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="invoice-table-preview">
                                    <thead>
                                        <tr>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('item', 'Item Description').toUpperCase()}</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>HSN/SKU</th>
                                            {getInvoiceLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                            {getInvoiceLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                            {getInvoiceLabel('showUom') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center' }}>UOM</th>}
                                            {getInvoiceLabel('showRate') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>{getTableHeader('rate', 'Rate').toUpperCase()}</th>}
                                            {getInvoiceLabel('showTax') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>{getTableHeader('tax', 'Tax %').toUpperCase()}</th>}
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>{getTableHeader('price', 'Amount').toUpperCase()}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(viewBill.purchasebillitem || viewBill.items || []).map((item, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{item.product?.name || 'Unknown Product'}</div>
                                                    {item.description && <div style={{ fontSize: '11px', color: '#64748b' }}>{item.description}</div>}
                                                </td>
                                                <td>{item.product?.hsnCode || item.product?.sku || '-'}</td>
                                                {getInvoiceLabel('showWarehouse') !== false && <td>{item.warehouse?.name || '-'}</td>}
                                                {getInvoiceLabel('showQty') !== false && <td style={{ textAlign: 'center' }}>{item.quantity}</td>}
                                                {getInvoiceLabel('showUom') !== false && <td style={{ textAlign: 'center' }}>{item.uom?.unitName || allUoms.find(u => u.id === item.uomId)?.unitName || ''}</td>}
                                                {getInvoiceLabel('showRate') !== false && <td style={{ textAlign: 'right' }}>{formatDocCurrency(item.rate, viewBill.currency)}</td>}
                                                {getInvoiceLabel('showTax') !== false && <td style={{ textAlign: 'right' }}>{item.taxRate}%</td>}
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatDocCurrency(item.amount, viewBill.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                             {/* Totals Section */}
                            <div className="invoice-total-section">
                                <div className="invoice-totals">
                                    {viewBill.isStatement ? (
                                        <>
                                            <div className="invoice-total-row">
                                                <span className="invoice-label">Total Bill Amount:</span>
                                                <span>{formatCurrency(viewBill.totalBillAmount)}</span>
                                            </div>
                                            <div className="invoice-final-total">
                                                <span>Total Amount Paid:</span>
                                                <span style={{ color: '#16a34a' }}>{formatCurrency(viewBill.totalBillAmount - viewBill.balanceAmount)}</span>
                                            </div>
                                            <div className="invoice-final-total" style={{ borderTop: '1px solid #ef4444', marginTop: '5px', paddingTop: '5px', color: '#ef4444' }}>
                                                <span>Total Balance Due:</span>
                                                <span>{formatCurrency(viewBill.balanceAmount)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="invoice-total-row">
                                                <span className="invoice-label">{getInvoiceLabel('subTotal')}:</span>
                                                <span>{formatDocCurrency(viewBill.totalAmount - (viewBill.taxAmount || 0) + (viewBill.discountAmount || 0), viewBill.currency)}</span>
                                            </div>
                                            <div className="invoice-total-row">
                                                <span className="invoice-label">Discount:</span>
                                                <span style={{ color: '#ef4444' }}>- {formatDocCurrency(viewBill.discountAmount || 0, viewBill.currency)}</span>
                                            </div>
                                            <div className="invoice-total-row">
                                                <span className="invoice-label">{getInvoiceLabel('tax')}:</span>
                                                <span>+ {formatDocCurrency(viewBill.taxAmount || 0, viewBill.currency)}</span>
                                            </div>
                                            <div className="invoice-final-total">
                                                <span>{getInvoiceLabel('total')}:</span>
                                                <span>{formatDocCurrency(viewBill.totalAmount, viewBill.currency)}</span>
                                            </div>
                                            <div className="invoice-total-row" style={{ marginTop: '5px', fontWeight: '600', color: '#16a34a' }}>
                                                <span className="invoice-label">Amount Paid:</span>
                                                <span>{formatDocCurrency(viewBill.paidAmount || 0, viewBill.currency)}</span>
                                            </div>
                                            <div className="invoice-total-row" style={{ borderTop: '1px solid #e2e8f0', marginTop: '5px', paddingTop: '5px', fontWeight: '700', color: '#ef4444' }}>
                                                <span className="invoice-label">Balance Due:</span>
                                                <span>{formatDocCurrency(viewBill.balanceAmount, viewBill.currency)}</span>
                                            </div>
                                            {viewBill.currency && viewBill.currency !== (companySettings?.currency || 'INR') && (
                                                <div className="invoice-total-row" style={{ borderTop: '1px dashed #cbd5e1', marginTop: '8px', paddingTop: '8px', fontWeight: '700', color: '#475569' }}>
                                                    <span className="invoice-label">Base Total ({companySettings?.currency || 'INR'}):</span>
                                                    <span>{formatDocCurrency((viewBill.totalAmount || 0) * (viewBill.exchangeRate || 1.0), companySettings?.currency || 'INR')}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Bank Details & Signature Section */}
                            {/* <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div className="invoice-section-header">Bank Details:</div>
                                    <div style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                                        <strong>Account Name:</strong> {companyDetails.accountHolder || 'N/A'}<br />
                                        <strong>Bank Name:</strong> {companyDetails.bankName || 'N/A'}<br />
                                        <strong>Account No:</strong> {companyDetails.accountNumber || 'N/A'}<br />
                                        <strong>IFSC Code:</strong> {companyDetails.ifsc || 'N/A'}
                                    </div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                                    <div style={{ width: '200px', borderTop: '1px solid #1e293b', marginTop: '3rem', paddingTop: '0.5rem', textAlign: 'center', fontWeight: '700' }}>
                                        Authorized Signatory
                                    </div>
                                </div>
                            </div> */}

                            {/* Payment Details Section */}
                            {viewBill?.payment && viewBill.payment.length > 0 && (
                                <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                    <h3 className="invoice-section-header" style={{ marginBottom: '0.75rem', fontWeight: 'bold' }}>Payment Details:</h3>
                                    <table className="invoice-table-preview" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Date</th>
                                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Vch Type</th>
                                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Reference No.</th>
                                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Paid From</th>
                                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'right' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewBill.payment.map((pay, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                                                    <td style={{ padding: '8px' }}>{new Date(pay.date).toLocaleDateString()}</td>
                                                    <td style={{ padding: '8px' }}>Payment</td>
                                                    <td style={{ padding: '8px' }}>{pay.paymentNumber || '-'}</td>
                                                    <td style={{ padding: '8px' }}>{pay.bankLedger?.name || '-'}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatDocCurrency(pay.amount, viewBill?.currency)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Notes Section */}
                            {viewBill.notes && (
                                <div style={{ marginTop: '2rem' }}>
                                    <h3 className="invoice-section-header">Notes</h3>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{viewBill.notes}</p>
                                </div>
                            )}

                            {/* Attachments Section in View Mode */}
                            {(() => {
                                let customFieldVals = {};
                                if (viewBill?.customFields) {
                                    try {
                                        customFieldVals = typeof viewBill.customFields === 'string'
                                            ? JSON.parse(viewBill.customFields)
                                            : viewBill.customFields;
                                    } catch (e) {
                                        console.error('Error parsing bill custom fields for view:', e);
                                    }
                                }
                                const atts = customFieldVals?._attachments;
                                const photos = atts?.photos || [];
                                const files = atts?.files || [];
                                if (photos.length === 0 && files.length === 0) return null;
                                return (
                                    <div className="PBILL-no-print no-print" style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', textAlign: 'left' }}>
                                        <h3 className="invoice-section-header" style={{ marginBottom: '0.75rem', fontWeight: 'bold' }}>Attachments</h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                            {photos.map((item, idx) => (
                                                <a key={`p-${idx}`} href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>
                                                    <span>🖼️</span> {item.name}
                                                </a>
                                            ))}
                                            {files.map((item, idx) => (
                                                <a key={`f-${idx}`} href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>
                                                    <span>📎</span> {item.name}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {getInvoiceLabel('showFooter') !== false && (
                                <div className="invoice-thank-you" style={{ textAlign: 'center', marginTop: '3rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', fontStyle: 'italic', color: '#64748b' }}>
                                    Thank you for your business!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

    return (
        <div className="PBILL-page">
            <div className="PBILL-header">
                <div>
                    <h1 className="PBILL-title">Purchase Bill</h1>
                    <p className="PBILL-subtitle">Record vendor bills and invoices</p>
                </div>
                {hasPermission('create purchase bill') && (
                    <button className="PBILL-btn-add" onClick={handleAddNew}>
                        <Plus size={18} /> Create Bill
                    </button>
                )}
            </div>

            <div className="PBILL-tracker-card">
                <div className="PBILL-tracker-wrapper">
                    {purchaseProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`PBILL-tracker-step ${step.status}`}>
                                <div className="PBILL-step-icon-box">
                                    <step.icon size={20} />
                                </div>
                                <span className="PBILL-step-label">{step.label}</span>
                            </div>
                            {index < purchaseProcess.length - 1 && (
                                <div className={`PBILL-tracker-divider ${purchaseProcess[index + 1].status !== 'pending' ? 'active' : ''}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="PBILL-table-card">
                <div className="PBILL-table-controls">
                    <div className="PBILL-search-wrapper">
                        <Search className="PBILL-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by ID, PO or Vendor..."
                            className="PBILL-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="PBILL-date-filters">
                        <div className="PBILL-filter-group">
                            <label>From:</label>
                            <input
                                type="date"
                                className="PBILL-date-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="PBILL-filter-group">
                            <label>To:</label>
                            <input
                                type="date"
                                className="PBILL-date-input"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        {(searchTerm || startDate || endDate) && (
                            <button
                                className="PBILL-clear-btn"
                                onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                </div>
                <div className="PBILL-table-container">
                    <table className="PBILL-table">
                        <thead>
                            <tr>
                                <th>BILL ID</th>
                                <th>PO REF</th>
                                <th>VENDOR</th>
                                <th>DATE</th>
                                <th>DUE DATE</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const groupedMap = {};
                                
                                bills.filter(b => {
                                    const query = searchTerm.toLowerCase();
                                    const billNo = (b.billNumber || '').toLowerCase();
                                    const vendorName = (b.vendor?.name || '').toLowerCase();
                                    const matchesSearch = !query || billNo.includes(query) || vendorName.includes(query);
                                    
                                    const bDate = new Date(b.date);
                                    const start = startDate ? new Date(startDate) : null;
                                    const end = endDate ? new Date(endDate) : null;
                                    if (start) start.setHours(0, 0, 0, 0);
                                    if (end) end.setHours(23, 59, 59, 999);
                                    const matchesDate = (!start || bDate >= start) && (!end || bDate <= end);
                                    
                                    return matchesSearch && matchesDate;
                                }).forEach(b => {
                                    const key = `VENDOR-${b.vendorId}`;
                                    if (!groupedMap[key]) {
                                        groupedMap[key] = {
                                            id: key,
                                            vendor: b.vendor,
                                            bills: [],
                                            returns: [],
                                            totalBillAmount: 0,
                                            totalReturnAmount: 0,
                                            balanceAmount: 0,
                                            earliestDate: b.date,
                                            latestDueDate: b.dueDate
                                        };
                                    }
                                    groupedMap[key].bills.push(b);
                                    groupedMap[key].totalBillAmount += b.totalAmount;
                                    groupedMap[key].balanceAmount += b.balanceAmount;
                                    
                                    if (b.purchasereturn) {
                                        b.purchasereturn.forEach(ret => {
                                            groupedMap[key].returns.push(ret);
                                            groupedMap[key].totalReturnAmount += ret.totalAmount || 0;
                                        });
                                    }

                                    if (new Date(b.date) < new Date(groupedMap[key].earliestDate)) groupedMap[key].earliestDate = b.date;
                                    if (b.dueDate && (!groupedMap[key].latestDueDate || new Date(b.dueDate) > new Date(groupedMap[key].latestDueDate))) {
                                        groupedMap[key].latestDueDate = b.dueDate;
                                    }
                                });

                                if (Object.keys(groupedMap).length === 0) {
                                    return <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>No records found</td></tr>;
                                }

                                return Object.values(groupedMap).map(group => (
                                    <React.Fragment key={group.id}>
                                        <tr className="PBILL-group-row">
                                            <td className="px-4 py-3">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button 
                                                        className={`PBILL-toggle-btn ${expandedGroups[group.id] ? 'expanded' : ''}`}
                                                        onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', transition: 'transform 0.2s', transform: expandedGroups[group.id] ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                                    >
                                                        <ChevronDown size={14} />
                                                    </button>
                                                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                                        <span className="font-bold text-blue-600">
                                                            {group.vendor?.name}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                                                            ({group.bills.length} Total Bills)
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>-</td>
                                            <td>{group.vendor?.name}</td>
                                            <td>{new Date(group.earliestDate).toLocaleDateString()}</td>
                                            <td> {group.latestDueDate ? new Date(group.latestDueDate).toLocaleDateString() : 'N/A'}</td>
                                            <td className="font-bold">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span>{formatCurrency(group.balanceAmount)}</span>
                                                    {group.totalReturnAmount > 0 && (
                                                        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                            Return Impact: -{formatCurrency(group.totalReturnAmount)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                {group.bills.length === 1 ? (
                                                    <select
                                                        value={group.bills[0].manualStatus ? group.bills[0].status : 'AUTO'}
                                                        onChange={(e) => handleStatusChange(group.bills[0].id, e.target.value)}
                                                        className="PBILL-status-pill"
                                                        style={getStatusStyle(group.bills[0].manualStatus ? group.bills[0].status : 'AUTO')}
                                                    >
                                                        <option value="AUTO">Auto ({group.bills[0].status})</option>
                                                        <option value="UNPAID">UNPAID</option>
                                                        <option value="PARTIAL">PARTIAL</option>
                                                        <option value="PAID">PAID</option>
                                                        <option value="OVERDUE">OVERDUE</option>
                                                        <option value="CANCELLED">CANCELLED</option>
                                                    </select>
                                                ) : (
                                                    <span className={`PBILL-status-pill ${group.balanceAmount === 0 ? 'paid' : 'pending'}`}>
                                                        {group.balanceAmount === 0 ? 'Paid' : 'Vendor Account'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="PBILL-action-group">
                                                    <button className="PBILL-btn-icon view" onClick={() => handleVendorView(group)} title="View Vendor Statement"><Eye size={16} /></button>
                                                    {hasPermission('edit purchase bill') && (
                                                        <button className="PBILL-btn-icon edit" onClick={() => handleEdit(group.bills[0].id)} title="Quick Edit First"><Pencil size={16} /></button>
                                                    )}
                                                    {hasPermission('delete purchase bill') && (
                                                        <button className="PBILL-btn-icon delete" onClick={() => handleDelete(group.bills[0].id)} title="Quick Delete First"><Trash2 size={16} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {expandedGroups[group.id] && (
                                            <tr>
                                                <td colSpan="9" style={{ padding: '0', backgroundColor: '#ffffff' }}>
                                                    <div style={{ padding: '20px 30px'}}>
                                                        <div className="PBILL-sub-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                <thead style={{ background: '#f8fafc' }}>
                                                                    <tr>
                                                                        <th style={{ padding: '10px', fontSize: '0.75rem', textAlign: 'left' }}>TYPE</th>
                                                                        <th style={{ padding: '10px', fontSize: '0.75rem', textAlign: 'left' }}>DOC #</th>
                                                                        <th style={{ padding: '10px', fontSize: '0.75rem', textAlign: 'left' }}>DATE</th>
                                                                        <th style={{ padding: '10px', fontSize: '0.75rem', textAlign: 'left' }}>TOTAL</th>
                                                                        <th style={{ padding: '10px', fontSize: '0.75rem', textAlign: 'left' }}>DUE</th>
                                                                        <th style={{ padding: '10px', fontSize: '0.75rem', textAlign: 'left' }}>STATUS</th>
                                                                        <th style={{ padding: '10px', fontSize: '0.75rem', textAlign: 'right' }}>ACTION</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.bills.map(pb => (
                                                                        <tr key={`pb-${pb.id}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#64748b' }}>BILL</td>
                                                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{pb.billNumber}</td>
                                                                            <td style={{ padding: '10px' }}>{new Date(pb.date).toLocaleDateString()}</td>
                                                                            <td style={{ padding: '10px' }}>{formatDocCurrency(pb.totalAmount, pb.currency)}</td>
                                                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{formatDocCurrency(pb.balanceAmount, pb.currency)}</td>
                                                                            <td style={{ padding: '10px' }}>
                                                                                <select
                                                                                    value={pb.manualStatus ? pb.status : 'AUTO'}
                                                                                    onChange={(e) => handleStatusChange(pb.id, e.target.value)}
                                                                                    className="PBILL-status-pill"
                                                                                    style={getStatusStyle(pb.manualStatus ? pb.status : 'AUTO')}
                                                                                >
                                                                                    <option value="AUTO">Auto ({pb.status})</option>
                                                                                    <option value="UNPAID">UNPAID</option>
                                                                                    <option value="PARTIAL">PARTIAL</option>
                                                                                    <option value="PAID">PAID</option>
                                                                                    <option value="OVERDUE">OVERDUE</option>
                                                                                    <option value="CANCELLED">CANCELLED</option>
                                                                                </select>
                                                                            </td>
                                                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                                                <div className="PBILL-action-group" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                                                                                    {pb.balanceAmount > 0 && hasPermission('create purchase payment') && (
                                                                                        <button 
                                                                                            className="PBILL-btn-icon" 
                                                                                            style={{ 
                                                                                                display: 'inline-flex',
                                                                                                alignItems: 'center',
                                                                                                justifyContent: 'center',
                                                                                                width: '28px',
                                                                                                height: '28px',
                                                                                                borderRadius: '6px',
                                                                                                border: '1px solid #16a34a',
                                                                                                color: '#16a34a',
                                                                                                background: 'transparent',
                                                                                                cursor: 'pointer',
                                                                                                transition: 'all 0.2s'
                                                                                            }} 
                                                                                            onClick={() => handleMakePayment(pb)} 
                                                                                            title="Record Payment"
                                                                                        >
                                                                                            <CreditCard size={14} />
                                                                                        </button>
                                                                                    )}
                                                                                    <button className="PBILL-btn-icon view" onClick={() => handleView(pb)}><Eye size={14} /></button>
                                                                                    {hasPermission('edit purchase bill') && (
                                                                                        <button className="PBILL-btn-icon edit" onClick={() => handleEdit(pb.id)}><Pencil size={14} /></button>
                                                                                    )}
                                                                                    {hasPermission('delete purchase bill') && (
                                                                                        <button className="PBILL-btn-icon delete" onClick={() => handleDelete(pb.id)}><Trash2 size={14} /></button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                    {group.returns.map(pr => (
                                                                        <tr key={`pr-${pr.id}`} style={{ borderTop: '1px solid #f1f5f9', background: '#fff1f2' }}>
                                                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#be123c' }}>RETURN</td>
                                                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{pr.returnNumber}</td>
                                                                            <td style={{ padding: '10px' }}>{new Date(pr.date).toLocaleDateString()}</td>
                                                                            <td style={{ padding: '10px', color: '#ef4444', fontWeight: 'bold' }}>-{formatCurrency(pr.totalAmount)}</td>
                                                                            <td style={{ padding: '10px' }}>-</td>
                                                                            <td style={{ padding: '10px' }}><span className="PBILL-status-pill" style={{ background: '#be123c', color: 'white' }}>Credited</span></td>
                                                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                                                <button className="PBILL-btn-icon view" onClick={() => handleView(pr)}><Eye size={14} /></button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ));
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal - ONLY FOR ADD/EDIT NOW */}
            {showAddModal && !isViewMode && (
                <div className="PBILL-modal-overlay">
                    <div className="PBILL-form-modal PBILL-invoice-form-modal">
                        <div className="PBILL-modal-header-simple">
                            <div className="PBILL-modal-header-left">
                                {companyDetails.logo && (
                                    <img src={companyDetails.logo} alt="Company Logo" className="PBILL-modal-logo-img" />
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">{editingId ? 'Edit Bill' : 'New Purchase Bill'}</h2>
                                    <p className="text-xs text-gray-500">{companyDetails.name} • {companyDetails.phone} • {companyDetails.email}</p>
                                </div>
                            </div>
                            <button className="PBILL-close-btn-simple" onClick={() => { setShowAddModal(false); resetForm(); setEditingId(null); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="PBILL-modal-body-scrollable">
                            {/* Horizontal Metadata Grid */}
                            <div className="PBILL-meta-horizontal-grid">
                                <div className="PBILL-meta-col">
                                    <label>Bill Number</label>
                                    <input type="text"
                                        value={billMeta.manualNo || nextBillNumber}
                                        onChange={(e) => setBillMeta({ ...billMeta, manualNo: e.target.value })}
                                        placeholder="Auto-Generated"
                                        className="PBILL-compact-input" />
                                </div>
                                <div className="PBILL-meta-col">
                                    <label>Date</label>
                                    <input type="date"
                                        value={billMeta.date} onChange={(e) => {
                                            const newDate = e.target.value;
                                            const newDueDate = calculateDueDate(newDate, selectedVendorCreditPeriod);
                                            setBillMeta({ ...billMeta, date: newDate, dueDate: newDueDate });
                                        }}
                                        className="PBILL-compact-input" />
                                </div>
                                <div className="PBILL-meta-col">
                                    <label>Due Date</label>
                                    <input type="date"
                                        value={billMeta.dueDate} onChange={(e) => setBillMeta({ ...billMeta, dueDate: e.target.value })}
                                        className="PBILL-compact-input" />
                                </div>
                                <div className="PBILL-meta-col">
                                    <label>Currency</label>
                                    <select
                                        value={selectedCurrency}
                                        onChange={(e) => {
                                            const cur = e.target.value;
                                            setSelectedCurrency(cur);
                                            if (cur === (companySettings?.currency || 'INR')) {
                                                setExchangeRate(1.0);
                                            }
                                        }}
                                        className="PBILL-compact-select"
                                    >
                                        <option value="INR">INR (₹)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="GBP">GBP (£)</option>
                                        <option value="AED">AED (د.إ)</option>
                                        <option value="SAR">SAR (ر.س)</option>
                                        <option value="JPY">JPY (¥)</option>
                                        <option value="CNY">CNY (¥)</option>
                                        <option value="AUD">AUD ($)</option>
                                        <option value="CAD">CAD ($)</option>
                                    </select>
                                </div>
                                {selectedCurrency !== (companySettings?.currency || 'INR') && (
                                    <div className="PBILL-meta-col">
                                        <label>Exchange Rate</label>
                                        <input type="number"
                                            step="0.0001"
                                            value={exchangeRate}
                                            onChange={(e) => setExchangeRate(e.target.value)}
                                            className="PBILL-compact-input" />
                                    </div>
                                )}
                            </div>

                            {/* Vendor & Address Grid */}
                            <div className="PBILL-address-horizontal-grid">
                                <div className="PBILL-vendor-select-col PBILL-address-card">
                                    <div className="PBILL-address-card-header">
                                        <label className="PBILL-compact-label">Bill To Vendor</label>
                                    </div>
                                    <div className="PBILL-address-card-body">
                                        <select className="PBILL-compact-select-large" value={vendorId} onChange={async (e) => {
                                            const vId = e.target.value;
                                            setVendorId(vId);
                                            if (!vId) {
                                                setSelectedVendorCreditPeriod(0);
                                                setAvailablePayments([]);
                                                setAdjustments([]);
                                                return;
                                            }
                                            const vendorObj = vendors.find(v => v.id == vId);
                                            const creditDays = vendorObj?.creditPeriod || 0;
                                            setSelectedVendorCreditPeriod(creditDays);
                                            
                                            const newDueDate = calculateDueDate(billMeta.date, creditDays);
                                            setBillMeta(prev => ({ ...prev, dueDate: newDueDate }));
                                            await fetchVendorPayments(vId);
                                        }} disabled={!!sourceData}>
                                            <option value="">Choose a Vendor...</option>
                                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>

                                        {/* Compact Billing Card */}
                                        {vendorId ? (
                                            <div className="PBILL-info-card flex-1">
                                                <div className="PBILL-info-card-header">Billing Details</div>
                                                <div className="PBILL-info-card-body">
                                                    <strong>{billingAddress.name}</strong>
                                                    <p>{billingAddress.address}</p>
                                                    <p>{[billingAddress.city, billingAddress.state, billingAddress.zipCode, billingAddress.country].filter(Boolean).join(', ')}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="PBILL-info-card-placeholder flex-1">
                                                Select a vendor to display billing details.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="PBILL-shipping-col PBILL-address-card">
                                    <div className="PBILL-address-card-header">
                                        <label className="PBILL-compact-label">Shipping Details</label>
                                        <label className="PBILL-shipping-checkbox-label">
                                            <input type="checkbox" checked={shippingSameAsBilling} onChange={(e) => {
                                                const checked = e.target.checked;
                                                setShippingSameAsBilling(checked);
                                                if (checked) {
                                                    setShippingAddress({ ...billingAddress });
                                                }
                                            }} />
                                            Same as Billing
                                        </label>
                                    </div>
                                    <div className="PBILL-address-card-body">
                                        {shippingSameAsBilling ? (
                                            <div className="PBILL-info-card PBILL-same-billing-badge flex-1">
                                                <span className="text-green-600 font-semibold flex items-center gap-1">
                                                    ✓ Shipping address is same as billing address
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="PBILL-shipping-inputs-card flex-1">
                                                {vendorShippingAddresses.length > 0 && (
                                                    <div className="PBILL-shipping-alt-row mb-2">
                                                        <span className="text-xs text-gray-500 font-bold">Select Alternate Address:</span>
                                                        <select
                                                            className="PBILL-mini-select"
                                                            onChange={(e) => {
                                                                const addrId = e.target.value;
                                                                if (!addrId) return;
                                                                const addr = vendorShippingAddresses.find(a => a.id === parseInt(addrId));
                                                                if (addr) {
                                                                    setShippingAddress({
                                                                        name: addr.name || '',
                                                                        address: addr.address || '',
                                                                        city: addr.city || '',
                                                                        state: addr.state || '',
                                                                        zipCode: addr.zipCode || '',
                                                                        country: addr.country || ''
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <option value="">Choose Address...</option>
                                                            {vendorShippingAddresses.map(addr => (
                                                                <option key={addr.id} value={addr.id}>
                                                                    {addr.name} {addr.city ? `- ${addr.city}` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <input type="text" placeholder="Shipping Name" className="PBILL-compact-input mb-1"
                                                    disabled={true} readOnly
                                                    value={shippingAddress.name} />
                                                <textarea placeholder="Shipping Address" className="PBILL-compact-textarea mb-1"
                                                    rows={1}
                                                    value={shippingAddress.address} onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })} />
                                                <div className="PBILL-compact-inputs-row">
                                                    <input type="text" placeholder="City" className="PBILL-compact-input"
                                                        value={shippingAddress.city} onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })} />
                                                    <input type="text" placeholder="State" className="PBILL-compact-input"
                                                        value={shippingAddress.state} onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })} />
                                                    <input type="text" placeholder="Zip" className="PBILL-compact-input"
                                                        value={shippingAddress.zipCode} onChange={(e) => setShippingAddress({ ...shippingAddress, zipCode: e.target.value })} />
                                                    <input type="text" placeholder="Country" className="PBILL-compact-input"
                                                        value={shippingAddress.country} onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Vendor Quick Info Row if vendor is selected */}
                            {vendorId && (
                                <div className="PBILL-vendor-quick-meta-compact mt-2 no-print" style={{ display: 'flex', gap: '15px', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#475569', fontWeight: '500', width: 'fit-content' }}>
                                    <div><strong>Email:</strong> {vendors.find(v => v.id == vendorId)?.email || 'N/A'}</div>
                                    <div style={{ width: '1px', background: '#cbd5e1' }} />
                                    <div><strong>Phone:</strong> {vendors.find(v => v.id == vendorId)?.phone || 'N/A'}</div>
                                </div>
                            )}

                            {/* Custom Fields Section */}
                            {getCustomFieldsForType('purchasebill').length > 0 && (
                                <div className="PBILL-custom-fields-section-compact">
                                    <h4 className="PBILL-compact-section-header">Custom Fields</h4>
                                    <div className="PBILL-custom-fields-grid-compact">
                                        {getCustomFieldsForType('purchasebill').map(field => (
                                            <div key={field.id} className="flex flex-col gap-0.5">
                                                <label className="PBILL-mini-label">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                {field.type === 'select' ? (
                                                    <select
                                                        value={customFieldValues[field.label] || ''}
                                                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                                                        className="PBILL-compact-select"
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
                                                        className="PBILL-compact-input"
                                                        required={field.required}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Items Table */}
                            <div className="PBILL-items-section-compact">
                                <div className="PBILL-items-header-compact">
                                    <h4 className="PBILL-compact-section-header m-0">Line Items</h4>
                                    <button className="PBILL-btn-add-row-compact" onClick={addItem}>
                                        <Plus size={12} /> Add Item
                                    </button>
                                </div>
                                <div className="PBILL-table-responsive-compact">
                                    <table className="PBILL-compact-items-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '34%' }}>{getTableHeader('item', 'Item Details').toUpperCase()}</th>
                                                {getInvoiceLabel('showWarehouse') !== false && <th style={{ width: '13%' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                                {getInvoiceLabel('showQty') !== false && <th style={{ width: '8%', textAlign: 'center' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                                {getInvoiceLabel('showQty') !== false && <th style={{ width: '8%' }}>{getTableHeader('uom', 'UoM').toUpperCase()}</th>}
                                                {getInvoiceLabel('showRate') !== false && <th style={{ width: '9%', textAlign: 'right' }}>{getTableHeader('rate', 'Rate').toUpperCase()}</th>}
                                                {getInvoiceLabel('showTax') !== false && <th style={{ width: '7%', textAlign: 'center' }}>{getTableHeader('tax', 'Tax %').toUpperCase()}</th>}
                                                {getInvoiceLabel('showDiscount') !== false && <th style={{ width: '7%', textAlign: 'right' }}>{getTableHeader('discount', 'Disc.').toUpperCase()}</th>}
                                                <th style={{ width: '11%', textAlign: 'right' }}>{getTableHeader('price', 'Amount').toUpperCase()}</th>
                                                <th style={{ width: '3%' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map(item => (
                                                <tr key={item.id}>
                                                    <td>
                                                        <select
                                                            className="PBILL-compact-select"
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
                                                                className="PBILL-compact-select"
                                                                value={item.warehouseId || ''}
                                                                disabled={!!linkedSource?.grnId}
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
                                                            <input type="number" className="PBILL-compact-input text-center" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showQty') !== false && (
                                                        <td>
                                                            {item.productId ? (
                                                                <select disabled className="PBILL-compact-select" value={item.uomId} onChange={(e) => updateItem(item.id, 'uomId', e.target.value)}>
                                                                    <option value="">Select UOM...</option>
                                                                    {allUoms
                                                                        .filter(u => {
                                                                            const prod = products.find(p => p.id === parseInt(item.productId));
                                                                            return u.category === prod?.uom?.category || u.baseUnitId === prod?.uomId;
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
                                                            <input type="number" className="PBILL-compact-input text-right" value={item.rate} onChange={(e) => updateItem(item.id, 'rate', e.target.value)} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showTax') !== false && (
                                                        <td>
                                                            <input type="number" className="PBILL-compact-input text-center" value={item.tax} onChange={(e) => updateItem(item.id, 'tax', e.target.value)} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showDiscount') !== false && (
                                                        <td>
                                                            <input type="number" className="PBILL-compact-input text-right" value={item.discount} onChange={(e) => updateItem(item.id, 'discount', e.target.value)} />
                                                        </td>
                                                    )}
                                                    <td>
                                                        <input type="text" className="PBILL-compact-input PBILL-disabled text-right" value={formatDocCurrency(item.total, selectedCurrency)} readOnly />
                                                    </td>
                                                    <td className="text-center">
                                                        <button className="PBILL-btn-delete-row-compact" onClick={() => removeItem(item.id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Available Vendor Advance Adjustments */}
                            {/* {vendorId && availablePayments.length > 0 && (
                                <div className="PBILL-advance-adjustments-compact">
                                    <h4 className="PBILL-compact-section-header">Adjust Available Credits / Advance Payment</h4>
                                    <div className="PBILL-advance-grid-compact">
                                        {availablePayments.map(pay => {
                                            const adj = adjustments.find(a => a.paymentId === pay.id);
                                            const adjValue = adj ? adj.amount : '';
                                            const maxAdvance = pay.availableAdvance + (pay.currentAllocAmount || 0);
                                            return (
                                                <div key={pay.id} className="PBILL-advance-row-compact">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-xs text-gray-800">{pay.paymentNumber}</span>
                                                        <span className="text-[10px] text-gray-500 font-semibold">Available: {formatDocCurrency(maxAdvance, selectedCurrency)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[10px] text-gray-500">Adjust Amount:</span>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            max={maxAdvance}
                                                            value={adjValue}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                let finalVal = Math.min(val, maxAdvance);

                                                                const otherAdjustedSum = adjustments
                                                                    .filter(a => a.paymentId !== pay.id)
                                                                    .reduce((sum, a) => sum + a.amount, 0);
                                                                const remainingGrandTotal = Math.max(0, totals.total - otherAdjustedSum);
                                                                finalVal = Math.min(finalVal, remainingGrandTotal);

                                                                setAdjustments(prev => {
                                                                    const existing = prev.find(a => a.paymentId === pay.id);
                                                                    if (existing) {
                                                                        if (finalVal <= 0) {
                                                                            return prev.filter(a => a.paymentId !== pay.id);
                                                                        }
                                                                        return prev.map(a => a.paymentId === pay.id ? { ...a, amount: finalVal } : a);
                                                                    } else {
                                                                        if (finalVal <= 0) return prev;
                                                                        return [...prev, {
                                                                            paymentId: pay.id,
                                                                            paymentNumber: pay.paymentNumber,
                                                                            amount: finalVal
                                                                        }];
                                                                    }
                                                                });
                                                            }}
                                                            className="PBILL-compact-input"
                                                            style={{ width: '100px', height: '24px', padding: '2px 6px', textAlign: 'right' }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )} */}

                            {/* Footer Grid containing Bank Details, Notes & Totals side-by-side */}
                            <div className="PBILL-compact-footer-grid">
                                <div className="PBILL-compact-footer-col">
                                    <h4 className="PBILL-compact-section-header">Bank Details &amp; Attachments</h4>
                                    <div className="PBILL-compact-bank-details">
                                        <input type="text" className="PBILL-compact-input mb-1" placeholder="Bank Name" value={bankDetails.bankName} onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })} />
                                        <input type="text" className="PBILL-compact-input mb-1" placeholder="Account No" value={bankDetails.accountNo} onChange={(e) => setBankDetails({ ...bankDetails, accountNo: e.target.value })} />
                                        <input type="text" className="PBILL-compact-input mb-1" placeholder="Account Holder" value={bankDetails.accountName} onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })} />
                                        <input type="text" className="PBILL-compact-input" placeholder="IFSC / Swift" value={bankDetails.ifsc} onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value })} />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <input
                                            type="file"
                                            ref={photoInputRef}
                                            accept="image/*"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleAttachmentUpload(e, 'photo')}
                                        />
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleAttachmentUpload(e, 'file')}
                                        />
                                        <button
                                            type="button"
                                            className="PBILL-btn-upload-small-compact flex-1"
                                            onClick={() => photoInputRef.current?.click()}
                                            disabled={uploadingPhotos}
                                        >
                                            <span>📷</span> {uploadingPhotos ? 'Uploading...' : 'Photos'}
                                        </button>
                                        <button
                                            type="button"
                                            className="PBILL-btn-upload-small-compact flex-1"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingFiles}
                                        >
                                            <span>📎</span> {uploadingFiles ? 'Uploading...' : 'Files'}
                                        </button>
                                    </div>
                                    {/* Uploaded attachments list */}
                                    {(selectedPhotos.length > 0 || selectedFiles.length > 0) && (
                                        <div className="PBILL-attachments-list mt-2 flex flex-col gap-1" style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px', background: '#f8fafc' }}>
                                            {selectedPhotos.map((item, idx) => (
                                                <div key={`photo-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '2px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: '10px' }}>🖼️</span>
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: '500' }} title={item.name}>{item.name}</a>
                                                    </div>
                                                    <button type="button" onClick={() => setSelectedPhotos(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', padding: 0 }}>×</button>
                                                </div>
                                            ))}
                                            {selectedFiles.map((item, idx) => (
                                                <div key={`file-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '2px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: '10px' }}>📎</span>
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: '500' }} title={item.name}>{item.name}</a>
                                                    </div>
                                                    <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', padding: 0 }}>×</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="PBILL-compact-footer-col">
                                    <h4 className="PBILL-compact-section-header">Notes &amp; Conditions</h4>
                                    <div className="PBILL-notes-terms-stack">
                                        <div>
                                            <label className="PBILL-mini-label mb-0.5">Notes</label>
                                            <textarea className="PBILL-compact-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter notes..."></textarea>
                                        </div>
                                        <div>
                                            <label className="PBILL-mini-label mb-0.5">Terms &amp; Conditions</label>
                                            <textarea className="PBILL-compact-textarea" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Enter terms & conditions..." />
                                        </div>
                                    </div>
                                </div>

                                <div className="PBILL-compact-totals-box">
                                    <div className="PBILL-compact-totals-top">
                                        <div className="PBILL-compact-t-row">
                                            <span>Sub Total:</span>
                                            <span>{formatDocCurrency(totals.subTotal, selectedCurrency)}</span>
                                        </div>
                                        <div className="PBILL-compact-t-row text-red-500">
                                            <span>Total Discount:</span>
                                            <span>-{formatDocCurrency(totals.discount, selectedCurrency)}</span>
                                        </div>
                                        <div className="PBILL-compact-t-row">
                                            <span>Tax Amount:</span>
                                            <span>{formatDocCurrency(totals.tax, selectedCurrency)}</span>
                                        </div>
                                        <div className="PBILL-compact-t-row PBILL-totals-discount-row">
                                            <div className="PBILL-totals-discount-label-row">
                                                <span>Overall Disc:</span>
                                                <div className="PBILL-compact-discount-input-group">
                                                    <input
                                                        type="number"
                                                        className="PBILL-compact-discount-number-input"
                                                        value={overallDiscount}
                                                        onChange={(e) => setOverallDiscount(e.target.value)}
                                                    />
                                                    <select
                                                        className="PBILL-compact-discount-type-select"
                                                        value={overallDiscountType}
                                                        onChange={(e) => setOverallDiscountType(e.target.value)}
                                                    >
                                                        <option value="percentage">%</option>
                                                        <option value="fixed">Amt</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <span className="text-red-500">-{formatDocCurrency(totals.ovDiscountAmt || 0, selectedCurrency)}</span>
                                        </div>
                                        {adjustments.reduce((sum, a) => sum + a.amount, 0) > 0 && (
                                            <div className="PBILL-compact-t-row text-green-600 font-semibold">
                                                <span>Credits Adjusted:</span>
                                                <span>-{formatDocCurrency(adjustments.reduce((sum, a) => sum + a.amount, 0), selectedCurrency)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="PBILL-compact-t-row PBILL-compact-total font-bold text-gray-800 border-t border-gray-200 pt-1 mt-1 text-sm">
                                        <span>Grand Total:</span>
                                        <span>{formatDocCurrency(totals.total, selectedCurrency)}</span>
                                    </div>
                                    {adjustments.reduce((sum, a) => sum + a.amount, 0) > 0 && (
                                        <div className="PBILL-compact-t-row PBILL-compact-total font-bold text-red-500 border-t border-gray-200 pt-1 mt-1 text-sm">
                                            <span>Balance Due:</span>
                                            <span>{formatDocCurrency(Math.max(0, totals.total - adjustments.reduce((sum, a) => sum + a.amount, 0)), selectedCurrency)}</span>
                                        </div>
                                    )}
                                    {selectedCurrency !== (companySettings?.currency || 'INR') && (
                                        <div className="PBILL-compact-t-row text-xs text-gray-500 font-medium border-t border-gray-100">
                                            <span>Base Total ({companySettings?.currency || 'INR'}):</span>
                                            <span>{formatDocCurrency(totals.total * (parseFloat(exchangeRate) || 1.0), companySettings?.currency || 'INR')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="PBILL-form-actions">
                                <button className="PBILL-btn-cancel" onClick={() => setShowAddModal(false)}>Discard changes</button>
                                <button className="PBILL-btn-primary" onClick={handleSave}>
                                    {editingId ? 'Update Bill' : 'Confirm & Save Bill'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Source Selection Modal */}
            {
                showSourceModal && (
                    <div className="PBILL-modal-overlay">
                        <div className="PBILL-source-modal">
                            <div className="PBILL-source-header">
                                <h2 className="PBILL-source-title">{sourceStep === 'type' ? 'Select Invoice Source' : (selectedSourceType === 'po' ? 'Pick a Purchase Order' : 'Pick a Goods Receipt')}</h2>
                                <button className="PBILL-close-btn" onClick={() => setShowSourceModal(false)}><X size={18} /></button>
                            </div>
                            <div className="PBILL-source-body">
                                {sourceStep === 'type' ? (
                                    <div className="PBILL-source-grid">
                                        <div className="PBILL-src-card PBILL-manual" onClick={() => handleSourceTypeSelect('manual')}>
                                            <div className="PBILL-src-icon"><FilePlus size={24} /></div>
                                            <div className="PBILL-src-text">
                                                <h4>Direct Billing</h4>
                                                <p>Create a bill from scratch manually</p>
                                            </div>
                                        </div>
                                        <div className="PBILL-src-card PBILL-po" onClick={() => handleSourceTypeSelect('po')}>
                                            <div className="PBILL-src-icon"><ShoppingCart size={24} /></div>
                                            <div className="PBILL-src-text">
                                                <h4>From Purchase Order</h4>
                                                <p>Pull details from an existing PO</p>
                                            </div>
                                        </div>
                                        <div className="PBILL-src-card PBILL-grn" onClick={() => handleSourceTypeSelect('grn')}>
                                            <div className="PBILL-src-icon"><Truck size={24} /></div>
                                            <div className="PBILL-src-text">
                                                <h4>From Goods Receipt</h4>
                                                <p>Pull details from received goods</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="PBILL-doc-list-wrapper">
                                        <div className="PBILL-source-filters flex gap-3 mb-4">
                                            <div className="PBILL-doc-search-mini flex-grow">
                                                <select
                                                    className="PBILL-vendor-filter-select w-full"
                                                    value={billFilterVendorId}
                                                    onChange={(e) => setBillFilterVendorId(e.target.value)}
                                                >
                                                    <option value="">All Vendors</option>
                                                    {vendors.map(v => {
                                                        const count = sourceDocs.filter(d => d.vendorId === v.id).length;
                                                        return (
                                                            <option key={v.id} value={v.id}>
                                                                {v.name} ({count} {selectedSourceType === 'po' ? 'Orders' : 'Receipts'})
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                            <div className="PBILL-doc-search-mini flex-grow">
                                                <Search size={14} className="PBILL-doc-search-icon" />
                                                <input
                                                    type="text"
                                                    placeholder="Search by vendor, reference..."
                                                    value={sourceSearchTerm}
                                                    onChange={(e) => setSourceSearchTerm(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        {filteredSourceDocs.length === 0 ? (
                                            <div className="PBILL-empty-state">
                                                {sourceSearchTerm ? `No documents matching "${sourceSearchTerm}"` : 'No available documents found.'}
                                            </div>
                                        ) : (
                                            <div className="PBILL-doc-scroll">
                                                {filteredSourceDocs.map(doc => (
                                                    <div key={doc.id} className="PBILL-doc-item" onClick={() => handleSourceDocSelect(doc)}>
                                                        <div className="PBILL-doc-main">
                                                            <span className="PBILL-doc-ref">{doc.poNumber || doc.grnNumber || doc.billNumber || doc.id}</span>
                                                            <span className="PBILL-doc-date">{new Date(doc.createdAt || doc.date).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="PBILL-doc-sub">
                                                            <span>{doc.vendor?.name || 'Unknown Vendor'}</span>
                                                            <span className="PBILL-doc-price">{formatCurrency(doc.totalAmount || 0)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <button className="PBILL-back-link" onClick={() => {
                                            setSourceStep('type');
                                            setSourceSearchTerm('');
                                        }}>
                                            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Selection
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {
                showDeleteConfirm && (
                    <div className="PBILL-modal-overlay">
                        <div className="PBILL-delete-card">
                            <div className="PBILL-delete-icon"><Trash2 size={32} /></div>
                            <h3>Permanently Delete Bill?</h3>
                            <p>This action will remove the record and cannot be reversed. Linked ledger entries will be updated accordingly.</p>
                            <div className="PBILL-delete-actions">
                                <button className="PBILL-btn-alt" onClick={() => setShowDeleteConfirm(false)}>Keep it</button>
                                <button className="PBILL-btn-danger" onClick={confirmDelete}>Yes, Delete Bill</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PurchaseBill;
