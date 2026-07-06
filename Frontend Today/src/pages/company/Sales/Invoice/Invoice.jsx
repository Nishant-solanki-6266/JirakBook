import React, { useState, useEffect, useContext, useRef } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useLocation, useNavigate } from 'react-router-dom';
import { CompanyContext } from '../../../../context/CompanyContext';
import { AuthContext } from '../../../../context/AuthContext';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Download, Send, Printer,
    Eye, Copy, ArrowLeft, AlertTriangle
} from 'lucide-react';
import './Invoice.css';
import salesInvoiceService from '../../../../api/salesInvoiceService';
import axiosInstance from '../../../../api/axiosInstance';
import salesOrderService from '../../../../api/salesOrderService';
import customerService from '../../../../api/customerService';
import salesReceiptService from '../../../../api/salesReceiptService';
import productService from '../../../../api/productService';
import warehouseService from '../../../../api/warehouseService';
import servicesService from '../../../../api/servicesService';
import companyService from '../../../../api/companyService';
import deliveryChallanService from '../../../../api/deliveryChallanService';
import posService from '../../../../services/posService';
import uomService from '../../../../services/uomService';
import salespersonService from '../../../../services/salespersonService';
import GetCompanyId from '../../../../api/GetCompanyId';
import chartOfAccountsService from '../../../../services/chartOfAccountsService';
import { toast } from 'react-hot-toast';
import '../../Customers/Customers.css';
import '../../Inventory/ProductInventory/Inventory.css';
import '../../Inventory/UOM/UOM.css';
import customerServiceFromServices from '../../../../services/customerService';
import productServiceFromServices from '../../../../services/productService';
import categoryService from '../../../../services/categoryService';
import { uploadToCloudinary } from '../../../../utils/cloudinaryUpload';
import { Upload, Loader2 } from 'lucide-react';

const Invoice = () => {
    const { companySettings, formatCurrency, getInvoiceLabel, getTableHeader, getDocumentTitle, getExchangeRateFor, getSyncRate } = useContext(CompanyContext);
    const { hasPermission } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    const calculateDueDate = (dateStr, creditPeriod) => {
        if (!dateStr) return '';
        const days = parseInt(creditPeriod) || 0;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };
    // --- State Management ---
    const [invoices, setInvoices] = useState([]);
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [exchangeRate, setExchangeRate] = useState(1.0);
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

    useEffect(() => {
        if (companySettings?.currency) {
            setSelectedCurrency(companySettings.currency);
        }
    }, [companySettings]);

    const handleCurrencyChange = async (cur) => {
        setSelectedCurrency(cur);
        let rateVal = 1.0;
        if (cur !== (companySettings?.currency || 'USD')) {
            try {
                rateVal = await getExchangeRateFor(cur, companySettings?.currency || 'USD');
            } catch (e) {
                rateVal = 1.0;
            }
        }
        setExchangeRate(rateVal.toFixed(6));

        // Convert existing items rates to the new currency
        setItems(prevItems => prevItems.map(item => {
            let basePrice = 0;
            if (item.productId) {
                const prodId = String(item.productId).startsWith('p-') ? parseInt(String(item.productId).replace('p-', '')) : parseInt(item.productId);
                const prod = allProducts.find(p => p.id === prodId);
                if (prod) {
                    basePrice = prod.salePrice || 0;
                    // Apply UOM multiplier if any
                    const uom = allUoms.find(u => u.id === item.uomId) || prod.uom || prod.salesUom || prod.purchaseUom;
                    const multiplier = uom?.uomType === 'Compound' ? parseFloat(uom.conversionRate) || 1 : 1;
                    basePrice = basePrice * multiplier;
                }
            } else if (item.serviceId) {
                const sId = String(item.serviceId).startsWith('s-') ? parseInt(String(item.serviceId).replace('s-', '')) : parseInt(item.serviceId);
                const s = allServices.find(x => x.id === sId);
                if (s) {
                    basePrice = s.price || 0;
                }
            } else {
                // If it's a custom line item with no product/service, convert the current rate directly
                const prevRate = parseFloat(item.rate) || 0;
                const prevConversionRate = getSyncRate(selectedCurrency, companySettings?.currency || 'INR') || 1.0;
                const priceInBase = prevRate * prevConversionRate;
                const converted = priceInBase / rateVal;
                
                const qty = parseFloat(item.qty) || 0;
                const rate = Number(converted.toFixed(2)) || 0;
                const tax = parseFloat(item.tax) || 0;
                const discount = parseFloat(item.discount) || 0;
                const subtotal = qty * rate;
                const taxable = subtotal - discount;
                const taxAmount = (taxable * tax) / 100;
                return {
                    ...item,
                    rate: rate,
                    total: taxable + taxAmount
                };
            }

            const conversionRate = rateVal;
            const converted = basePrice / conversionRate;
            const qty = parseFloat(item.qty) || 0;
            const rate = Number(converted.toFixed(2)) || 0;
            const tax = parseFloat(item.tax) || 0;
            const discount = parseFloat(item.discount) || 0;
            const subtotal = qty * rate;
            const taxable = subtotal - discount;
            const taxAmount = (taxable * tax) / 100;

            return {
                ...item,
                rate: rate,
                total: taxable + taxAmount
            };
        }));
    };

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
    const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');
    const [activeOrders, setActiveOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [allWarehouses, setAllWarehouses] = useState([]);
    const [allServices, setAllServices] = useState([]);
    const [allUoms, setAllUoms] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sourceSearchTerm, setSourceSearchTerm] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);

    // Inline Modals States
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [customerFormData, setCustomerFormData] = useState({
        name: '',
        nameArabic: '',
        companyName: '',
        companyLocation: '',
        profileImage: '',
        anyFile: '',
        accountType: 'Credit',
        balanceType: 'Debit',
        accountBalance: 0,
        creationDate: new Date().toISOString().split('T')[0],
        bankAccountNumber: '',
        bankIFSC: '',
        bankNameBranch: '',
        phone: '',
        email: '',
        creditPeriod: '',
        gstNumber: '',
        gstEnabled: false,
        billingName: '',
        billingPhone: '',
        billingAddress: '',
        billingCity: '',
        billingState: '',
        billingCountry: '',
        billingZipCode: '',
        shippingSameAsBilling: false,
        shippingName: '',
        shippingPhone: '',
        shippingAddress: '',
        shippingCity: '',
        shippingState: '',
        shippingCountry: '',
        shippingZipCode: '',
        shippingAddresses: []
    });
    const [uploadingAnyFile, setUploadingAnyFile] = useState(false);
    const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
    const [customerSubmitting, setCustomerSubmitting] = useState(false);
    const profileImageRef = useRef();
    const anyFileRef = useRef();

    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [productFormData, setProductFormData] = useState({
        name: '', sku: '', hsn: '', barcode: '', categoryId: '',
        uomId: '', purchaseUomId: '', salesUomId: '', unit: '', description: '', asOfDate: new Date().toISOString().split('T')[0],
        taxAccount: '', initialCost: 0, salePrice: 0, purchasePrice: 0,
        discount: 0, remarks: '', image: null
    });
    const [productWarehouseRows, setProductWarehouseRows] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);

    // UOM Modal States
    const [showUomModal, setShowUomModal] = useState(false);
    const [uomFormData, setUomFormData] = useState({
        category: '', unitName: '', weightPerUnit: '', uomType: 'Simple', baseUnitId: '', conversionRate: ''
    });
    const measurementCategories = ['Weight', 'Area', 'Volume', 'Length', 'Count'];
    const unitsByCategory = {
        'Weight': ['Microgram', 'Milligram', 'Gram', 'Kilogram (KG)', 'Metric Ton (Tonne)', 'Quintal', 'Pound (lb)', 'Ounce (oz)', 'Stone', 'Carat'],
        'Area': ['Square Millimeter', 'Square Centimeter', 'Square Meter', 'Square Kilometer', 'Square Inch', 'Square Foot', 'Square Yard', 'Acre', 'Hectare', 'Bigha', 'Kanal', 'Cent'],
        'Volume': ['Millilitre (mL)', 'Litre (L)', 'Cubic Centimeter (cc)', 'Cubic Meter', 'Cubic Inch', 'Cubic Foot', 'Gallon', 'Barrel', 'Pint', 'Quart', 'Fluid Ounce'],
        'Length': ['Nanometer', 'Micrometer', 'Millimeter', 'Centimeter', 'Meter', 'Kilometer', 'Inch', 'Foot', 'Yard', 'Mile'],
        'Count': ['Piece', 'Unit', 'Dozen', 'Pair', 'Set', 'Box', 'Packet', 'Carton', 'Bundle', 'Roll', 'Strip', 'Bottle', 'Bag', 'Can', 'Jar', 'Tube']
    };
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // View Request State
    const [viewMode, setViewMode] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const viewRate = getSyncRate(selectedInvoice?.currency || 'USD', companySettings?.currency || 'USD');
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [invoiceFilterCustomerId, setInvoiceFilterCustomerId] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({});

    // POS Payment States
    const [accounts, setAccounts] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('CASH');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const [creationMode, setCreationMode] = useState('direct');
    const [overallDiscount, setOverallDiscount] = useState(0);
    const [overallDiscountType, setOverallDiscountType] = useState('percentage');
    const [customerShippingAddresses, setCustomerShippingAddresses] = useState([]);
    const [availableReceipts, setAvailableReceipts] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [manualStatus, setManualStatus] = useState(false);
    const [overrideStatus, setOverrideStatus] = useState('UNPAID');
    const [salespersonsList, setSalespersonsList] = useState([]);
    const [salespersonId, setSalespersonId] = useState('');
    const [carNumber, setCarNumber] = useState('');
    const [manualReference, setManualReference] = useState('');
    const [numberingMode, setNumberingMode] = useState('auto');
    const [shouldAutoOpenNext, setShouldAutoOpenNext] = useState(false);
    const [showAddSalespersonModal, setShowAddSalespersonModal] = useState(false);
    const [salespersonFormData, setSalespersonFormData] = useState({ name: '', phone: '', email: '' });
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateRefToRetry, setDuplicateRefToRetry] = useState('');

    // Attachments State & Refs
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const photoInputRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    const handleEdit = async (invoice) => {
        try {
            const companyId = GetCompanyId();
            const response = await salesInvoiceService.getById(invoice.id, companyId);
            if (response.data.success) {
                const inv = response.data.data;
                setEditingId(inv.id);
                setCustomerId(inv.customerId);
                if (inv.customerId) {
                    const custRes = await customerService.getById(inv.customerId, companyId);
                    if (custRes.data.success) {
                        setSelectedCustomerCreditPeriod(custRes.data.data.creditPeriod || 0);
                    }
                }
                setBillingDetails({
                    name: inv.billingName || inv.customer?.billingName || inv.customer?.name || '',
                    address: inv.billingAddress || inv.customer?.billingAddress || '',
                    city: inv.billingCity || inv.customer?.billingCity || '',
                    state: inv.billingState || inv.customer?.billingState || '',
                    zipCode: inv.billingZipCode || inv.customer?.billingZipCode || '',
                    country: inv.billingCountry || inv.customer?.billingCountry || ''
                });
                setShippingDetails({
                    name: inv.shippingName || inv.customer?.shippingName || inv.customer?.name || '',
                    address: inv.shippingAddress || inv.customer?.shippingAddress || '',
                    city: inv.shippingCity || inv.customer?.shippingCity || '',
                    state: inv.shippingState || inv.customer?.shippingState || '',
                    zipCode: inv.shippingZipCode || inv.customer?.shippingZipCode || '',
                    country: inv.shippingCountry || inv.customer?.shippingCountry || ''
                });
                setOverallDiscount(inv.overallDiscount || 0);
                setOverallDiscountType(inv.overallDiscountType || 'percentage');
                setSelectedCurrency(inv.currency || companySettings?.currency || 'USD');
                setExchangeRate(inv.exchangeRate || 1.0);
                setManualStatus(inv.manualStatus || false);
                setOverrideStatus(inv.status || 'UNPAID');
                setCustomerShippingAddresses(inv.customer?.shippingaddress || []);
                let fieldValues = {};
                if (inv.customFields) {
                    try {
                        fieldValues = typeof inv.customFields === 'string'
                            ? JSON.parse(inv.customFields)
                            : inv.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on edit:', e);
                    }
                }
                setCustomFieldValues(fieldValues);

                setSalespersonId(inv.salespersonId || '');
                setCarNumber(inv.carNumber || '');
                setManualReference(inv.manualReference || '');
                setNumberingMode('manual');
                setInvoiceMeta({
                    manualNo: inv.invoiceNumber,
                    date: new Date(inv.date).toISOString().split('T')[0],
                    dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
                    deliveryPersonName: fieldValues.deliveryPersonName || '',
                    deliveryPersonMobile: fieldValues.deliveryPersonMobile || '',
                    deliveryPersonEmail: fieldValues.deliveryPersonEmail || ''
                });
                setNotes(inv.notes || '');
                setSelectedChallan(inv.deliveryChallanId ? { id: inv.deliveryChallanId } : null);
                setSelectedOrder(inv.salesOrderId ? { id: inv.salesOrderId } : null);
                setItems((inv.invoiceitem || inv.items || []).map(i => ({
                    id: i.id,
                    productId: i.productId,
                    serviceId: i.serviceId,
                    warehouseId: i.warehouseId,
                    uomId: i.uomId || '',
                    description: i.description,
                    qty: i.quantity,
                    rate: i.rate,
                    tax: i.taxRate,
                    discount: i.discount,
                    total: i.amount
                })));
                setSelectedPhotos(fieldValues?._attachments?.photos || []);
                setSelectedFiles(fieldValues?._attachments?.files || []);
                await loadCustomerReceiptsForEdit(inv.customerId, inv.id);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error('Error fetching invoice for edit:', error);
        }
    };

    const handleUpdate = async () => {
        try {
            if (!editingId) return;

            const companyId = GetCompanyId();
            const customFieldsPayload = {
                ...customFieldValues,
                deliveryPersonName: invoiceMeta.deliveryPersonName,
                deliveryPersonMobile: invoiceMeta.deliveryPersonMobile,
                deliveryPersonEmail: invoiceMeta.deliveryPersonEmail,
                _attachments: {
                    photos: selectedPhotos,
                    files: selectedFiles
                }
            };

            const data = {
                customFields: JSON.stringify(customFieldsPayload),
                invoiceNumber: invoiceMeta.manualNo,
                date: invoiceMeta.date,
                dueDate: invoiceMeta.dueDate,
                customerId: parseInt(customerId),
                companyId: parseInt(companyId),
                notes: notes,
                manualStatus,
                status: manualStatus ? overrideStatus : undefined,
                billingName: billingDetails.name,
                billingAddress: billingDetails.address,
                billingCity: billingDetails.city,
                billingState: billingDetails.state,
                billingZipCode: billingDetails.zipCode,
                billingCountry: billingDetails.country,
                shippingName: shippingDetails.name,
                shippingAddress: shippingDetails.address,
                shippingCity: shippingDetails.city,
                shippingState: shippingDetails.state,
                shippingZipCode: shippingDetails.zipCode,
                shippingCountry: shippingDetails.country,
                overallDiscount: parseFloat(overallDiscount) || 0,
                overallDiscountType: overallDiscountType,
                currency: selectedCurrency,
                exchangeRate: parseFloat(exchangeRate) || 1.0,
                adjustments: adjustments.filter(adj => adj.amount > 0).map(adj => ({
                    receiptId: adj.receiptId,
                    amount: adj.amount
                })),
                items: items.map(item => ({
                    productId: item.productId ? parseInt(item.productId) : null,
                    serviceId: item.serviceId ? parseInt(item.serviceId) : null,
                    warehouseId: item.warehouseId ? parseInt(item.warehouseId) : null,
                    uomId: item.uomId ? parseInt(item.uomId) : null,
                    description: item.description,
                    quantity: parseFloat(item.qty),
                    rate: parseFloat(item.rate),
                    discount: parseFloat(item.discount) || 0,
                    taxRate: parseFloat(item.tax)
                }))
            };

            const response = await salesInvoiceService.update(editingId, data, companyId);
            if (response.data.success) {
                fetchData();
                resetForm();
                setEditingId(null);
            }
        } catch (error) {
            console.error('Error updating invoice:', error);
        }
    };
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedChallan, setSelectedChallan] = useState(null);
    const [activeChallans, setActiveChallans] = useState([]);
    const [showSelectionModal, setShowSelectionModal] = useState(false);

    // Form State
    const [companyDetails, setCompanyDetails] = useState({
        name: 'Zirak Books', address: '123 Business Avenue, Suite 404', email: 'info@zirakbooks.com', phone: '123-456-7890', logo: null, notes: '', terms: '', showQr: true
    });
    const [invoiceMeta, setInvoiceMeta] = useState({
        manualNo: '', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0],
        deliveryPersonName: '', deliveryPersonMobile: '', deliveryPersonEmail: ''
    });
    const [customerId, setCustomerId] = useState('');
    const [selectedCustomerCreditPeriod, setSelectedCustomerCreditPeriod] = useState(0);
    const [items, setItems] = useState([
        { id: Date.now(), productId: '', serviceId: '', warehouseId: '', qty: 1, uomId: '', rate: 0, tax: 0, discount: 0, total: 0, description: '' }
    ]);

    const [billingDetails, setBillingDetails] = useState({
        name: '', address: '', city: '', state: '', zipCode: '', country: ''
    });
    const [shippingDetails, setShippingDetails] = useState({
        name: '', address: '', city: '', state: '', zipCode: '', country: ''
    });
    const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);

    // Sync shipping when billing changes if "Same as Billing" is checked
    useEffect(() => {
        if (shippingSameAsBilling) {
            setShippingDetails({ ...billingDetails });
        }
    }, [billingDetails, shippingSameAsBilling]);

    // Initial Fetch
    useEffect(() => {
        fetchData();
        fetchDropdowns();
        fetchCompanyDetails();
        fetchAccounts();
    }, []);

    // Handle Deep Link from Navigation State
    useEffect(() => {
        if (location.state && location.state.targetInvoiceId) {
            const fetchTarget = async () => {
                try {
                    const companyId = GetCompanyId();
                    let response;

                    if (location.state.type === 'POS_INVOICE') {
                        response = await posService.getPOSInvoiceById(location.state.targetInvoiceId, companyId);
                        if (response && response.success) {
                            setSelectedInvoice({ ...response.data, type: 'POS_INVOICE' });
                            setViewMode(true);
                        }
                    } else {
                        response = await salesInvoiceService.getById(location.state.targetInvoiceId, companyId);
                        if (response.data && response.data.success) {
                            setSelectedInvoice({ ...response.data.data, type: 'TAX_INVOICE' });
                            setViewMode(true);
                        }
                    }
                } catch (error) {
                    console.error("Error loading target invoice", error);
                }
            };
            fetchTarget();
            // Clear location state after handling to prevent re-opening on re-renders
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

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
                    termsInvoice: data.termsInvoice || '',
                    showQr: data.showQrCode !== undefined ? data.showQrCode : true,
                    template: data.invoiceTemplate || 'New York',
                    color: data.invoiceColor || '#004aad'
                });
                setNotes(data.notes || '');
                setTerms(data.termsInvoice || data.terms || '');
            }
        } catch (error) {
            console.error('Error fetching company details:', error);
        }
    };

    const fetchAccounts = async () => {
        try {
            const companyId = GetCompanyId();
            console.log("🔍 fetchAccounts - CompanyId:", companyId);
            if (companyId) {
                const res = await chartOfAccountsService.getAllLedgers(companyId);
                console.log("🔍 fetchAccounts - getAllLedgers Response:", res);
                if (res && res.success) {
                    const assetAccounts = res.data.filter(a =>
                        a.accountgroup?.type === 'ASSETS' ||
                        a.group?.type === 'ASSETS' ||
                        a.name.toLowerCase().includes('cash') ||
                        a.name.toLowerCase().includes('bank')
                    );
                    console.log("🔍 fetchAccounts - Filtered Asset Accounts:", assetAccounts);
                    setAccounts(assetAccounts);
                }
            }
        } catch (error) {
            console.error('🔍 fetchAccounts - Error fetching accounts:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            const response = await salesInvoiceService.getAll(companyId);

            if (response.data.success) {
                setInvoices(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const companyId = GetCompanyId();
            const [custRes, prodRes, whRes, servRes, orderRes, challanRes, uomRes] = await Promise.all([
                customerService.getAll(companyId),
                productService.getAll(companyId),
                warehouseService.getAll(companyId),
                servicesService.getAll(companyId),
                salesOrderService.getAll(companyId),
                deliveryChallanService.getAll(companyId),
                uomService.getUOMs(companyId)
            ]);
            if (custRes.data.success) setCustomers(custRes.data.data);
            if (prodRes.data.success) setAllProducts(prodRes.data.data);
            if (whRes.data.success) setAllWarehouses(whRes.data.data);
            if (servRes.data.success) setAllServices(servRes.data.data);
            if (orderRes.data.success) {
                setActiveOrders(orderRes.data.data.filter(o => o.status !== 'COMPLETED'));
            }
            if (challanRes.data.success) {
                setActiveChallans(challanRes.data.data.filter(c => c.status !== 'COMPLETED'));
            }
            if (uomRes.success) {
                setAllUoms(uomRes.data);
            }
            try {
                const salespersonsRes = await salespersonService.getAll(companyId);
                if (salespersonsRes.success) {
                    setSalespersonsList(salespersonsRes.data);
                }
            } catch (err) {
                console.error("Error fetching salespersons dropdown:", err);
            }
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    useEffect(() => {
        if (showAddProductModal) {
            const companyId = GetCompanyId();
            categoryService.getCategories(companyId).then(res => {
                if (res.success) setCategories(res.data);
            });
        }
    }, [showAddProductModal]);

    // Inline Customer Handlers
    const handleCustomerInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        setCustomerFormData(prev => {
            let processedValue = type === 'checkbox' ? checked : value;

            if (type !== 'checkbox' && typeof processedValue === 'string') {
                if (name === 'phone' || name === 'billingPhone' || name === 'shippingPhone') {
                    processedValue = processedValue.replace(/\D/g, '');
                } else if (name === 'accountBalance') {
                    processedValue = processedValue.replace(/-/g, '');
                    if (processedValue !== '') {
                        const parsed = parseFloat(processedValue);
                        if (!isNaN(parsed) && parsed < 0) {
                            processedValue = '0';
                        }
                    }
                }
            }

            const newData = {
                ...prev,
                [name]: processedValue
            };

            if (name === 'shippingSameAsBilling' && checked) {
                newData.shippingName = prev.billingName;
                newData.shippingPhone = prev.billingPhone;
                newData.shippingAddress = prev.billingAddress;
                newData.shippingCity = prev.billingCity;
                newData.shippingState = prev.billingState;
                newData.shippingCountry = prev.billingCountry;
                newData.shippingZipCode = prev.billingZipCode;
            }

            return newData;
        });
    };

    const handleCustomerShippingAddressChange = (index, field, value) => {
        setCustomerFormData(prev => {
            const newAddresses = [...prev.shippingAddresses];
            let processedValue = value;
            if (field === 'phone' && typeof value === 'string') {
                processedValue = value.replace(/\D/g, '');
            }
            newAddresses[index] = { ...newAddresses[index], [field]: processedValue };
            return { ...prev, shippingAddresses: newAddresses };
        });
    };

    const addCustomerShippingAddress = () => {
        setCustomerFormData(prev => ({
            ...prev,
            shippingAddresses: [
                ...prev.shippingAddresses,
                { name: '', phone: '', address: '', city: '', state: '', country: '', zipCode: '', isDefault: false }
            ]
        }));
    };

    const removeCustomerShippingAddress = (index) => {
        setCustomerFormData(prev => ({
            ...prev,
            shippingAddresses: prev.shippingAddresses.filter((_, i) => i !== index)
        }));
    };

    const handleCustomerFileUpload = async (file, field, folder) => {
        if (!file) return;
        const setUploading = field === 'profileImage' ? setUploadingProfileImage : setUploadingAnyFile;
        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            const res = await axiosInstance.post(`/upload?folder=${folder}`, formDataUpload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setCustomerFormData(prev => ({ ...prev, [field]: res.data.url }));
                toast.success(`${field === 'profileImage' ? 'Profile image' : 'File'} uploaded!`);
            }
        } catch (err) {
            toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleCustomerSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!customerFormData.name || !customerFormData.email) {
            toast.error('Please fill in required fields (Name and Email)');
            return;
        }

        setCustomerSubmitting(true);

        const payload = { ...customerFormData };
        let shippingAddresses = [...customerFormData.shippingAddresses];

        if (customerFormData.shippingSameAsBilling) {
            const billingAsShipping = {
                name: customerFormData.billingName || customerFormData.name,
                phone: customerFormData.billingPhone || customerFormData.phone,
                address: customerFormData.billingAddress,
                city: customerFormData.billingCity,
                state: customerFormData.billingState,
                country: customerFormData.billingCountry,
                zipCode: customerFormData.billingZipCode,
                isDefault: true
            };
            shippingAddresses = [billingAsShipping, ...customerFormData.shippingAddresses];
        }

        payload.shippingAddresses = shippingAddresses;
        const companyId = GetCompanyId();
        payload.companyId = parseInt(companyId);

        try {
            const response = await customerServiceFromServices.createCustomer(payload);
            const success = response.success || (response.data && response.success !== false);
            
            if (success) {
                toast.success('Customer added successfully!');
                const c = response.data?.customer || response.data || response;
                
                // Pre-select newly created customer
                if (c && c.id) {
                    const cId = c.id.toString();
                    setCustomerId(cId);
                    setCustomerDetails({
                        billingName: c.billingName || c.name || '',
                        billingAddress: c.billingAddress || '',
                        billingCity: c.billingCity || '',
                        billingState: c.billingState || '',
                        billingZip: c.billingZipCode || c.billingZip || '',
                        billingCountry: c.billingCountry || 'India',
                        shippingName: c.shippingName || c.name || '',
                        shippingAddress: c.shippingAddress || '',
                        shippingCity: c.shippingCity || '',
                        shippingState: c.shippingState || '',
                        shippingZip: c.shippingZipCode || c.shippingZip || '',
                        shippingCountry: c.shippingCountry || 'India',
                        email: c.email || '',
                        phone: c.phone || '',
                        gstin: c.gstNumber || c.gstin || '',
                        creditPeriod: c.creditPeriod || 0
                    });
                }

                // Reload list of customers
                const custRes = await customerService.getAll(companyId);
                if (custRes.data?.success) {
                    setCustomers(custRes.data.data);
                } else if (custRes.data) {
                    setCustomers(custRes.data);
                }

                setShowAddCustomerModal(false);

                // Reset customer form
                setCustomerFormData({
                    name: '',
                    nameArabic: '',
                    companyName: '',
                    companyLocation: '',
                    profileImage: '',
                    anyFile: '',
                    accountType: 'Credit',
                    balanceType: 'Debit',
                    accountBalance: 0,
                    creationDate: new Date().toISOString().split('T')[0],
                    bankAccountNumber: '',
                    bankIFSC: '',
                    bankNameBranch: '',
                    phone: '',
                    email: '',
                    creditPeriod: '',
                    gstNumber: '',
                    gstEnabled: false,
                    billingName: '',
                    billingPhone: '',
                    billingAddress: '',
                    billingCity: '',
                    billingState: '',
                    billingCountry: '',
                    billingZipCode: '',
                    shippingSameAsBilling: false,
                    shippingName: '',
                    shippingPhone: '',
                    shippingAddress: '',
                    shippingCity: '',
                    shippingState: '',
                    shippingCountry: '',
                    shippingZipCode: '',
                    shippingAddresses: []
                });
            } else {
                toast.error(response.message || 'Failed to create customer');
            }
        } catch (error) {
            console.error('Error saving customer:', error);
            toast.error(error.message || 'Failed to save customer');
        } finally {
            setCustomerSubmitting(false);
        }
    };

    // Inline Product Handlers
    const handleProductInputChange = (e) => {
        const { name, value } = e.target;
        setProductFormData(prev => ({ ...prev, [name]: value }));
    };

    const addProductWarehouseRow = () => {
        const firstWhId = allWarehouses.length > 0 ? allWarehouses[0].id : '';
        setProductWarehouseRows([...productWarehouseRows, {
            id: Date.now(),
            warehouseId: firstWhId,
            quantity: 0,
            minOrderQty: 0,
            initialQty: 0
        }]);
    };

    const removeProductWarehouseRow = (id) => {
        setProductWarehouseRows(productWarehouseRows.filter(row => row.id !== id));
    };

    const handleProductWhRowChange = (id, field, value) => {
        setProductWarehouseRows(productWarehouseRows.map(row =>
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    const handleProductImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                setUploadingImage(true);
                toast.loading('Uploading image...', { id: 'prod-image-upload' });
                const imageUrl = await uploadToCloudinary(file);
                setProductFormData(prev => ({ ...prev, image: imageUrl }));
                toast.success('Image uploaded successfully', { id: 'prod-image-upload' });
            } catch (error) {
                console.error(error);
                toast.error('Failed to upload image', { id: 'prod-image-upload' });
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const handleProductAddCategorySubmit = async () => {
        if (!newCategoryName.trim()) return toast.error('Category name is required');
        try {
            const companyId = GetCompanyId();
            const res = await categoryService.createCategory({ name: newCategoryName, companyId });
            if (res.success) {
                toast.success('Category added');
                setShowCategoryModal(false);
                setNewCategoryName('');
                const catRes = await categoryService.getCategories(companyId);
                if (catRes.success) setCategories(catRes.data);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add category');
        }
    };

    const getUniqueCategories = () => {
        return [...new Set(allUoms.map(u => u.category))];
    };

    const getAvailableBaseUnitsForCategory = (category) => {
        return allUoms.filter(u => u.category === category && u.uomType === 'Simple');
    };

    const handleUomInputChange = (e) => {
        const { name, value } = e.target;
        setUomFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUomSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            const companyId = GetCompanyId();
            const payload = {
                category: uomFormData.category,
                unitName: uomFormData.unitName,
                weightPerUnit: uomFormData.weightPerUnit,
                uomType: uomFormData.uomType,
                baseUnitId: uomFormData.uomType === 'Compound' && uomFormData.baseUnitId
                    ? (isNaN(uomFormData.baseUnitId) ? uomFormData.baseUnitId : parseInt(uomFormData.baseUnitId))
                    : null,
                conversionRate: uomFormData.uomType === 'Compound' && uomFormData.conversionRate ? parseFloat(uomFormData.conversionRate) : null,
                companyId: parseInt(companyId)
            };

            const res = await uomService.createUOM(payload);
            if (res.success) {
                toast.success('Unit added successfully');
                const uomsRes = await uomService.getUOMs(companyId);
                if (uomsRes.success) {
                    setAllUoms(uomsRes.data || []);
                }
                setProductFormData(prev => ({
                    ...prev,
                    uomId: res.data?.id || prev.uomId,
                    purchaseUomId: res.data?.id || prev.purchaseUomId,
                    salesUomId: res.data?.id || prev.salesUomId
                }));
                setShowUomModal(false);
                setUomFormData({
                    category: '', unitName: '', weightPerUnit: '', uomType: 'Simple', baseUnitId: '', conversionRate: ''
                });
            }
        } catch (error) {
            console.error('Error saving UOM:', error);
            toast.error(error.response?.data?.message || 'Failed to save UOM');
        }
    };

    const handleFullProductSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!productFormData.name) {
            toast.error('Item Name is required');
            return;
        }
        try {
            const companyId = GetCompanyId();
            const payload = {
                ...productFormData,
                companyId: parseInt(companyId),
                warehouseInfo: productWarehouseRows.map(row => ({
                    warehouseId: parseInt(row.warehouseId),
                    quantity: parseFloat(row.quantity) || 0,
                    minOrderQty: parseFloat(row.minOrderQty) || 0,
                    initialQty: parseFloat(row.initialQty) || 0
                }))
            };
            await productServiceFromServices.createProduct(payload);
            toast.success('Product created successfully!');
            setShowAddProductModal(false);

            // Refresh products
            const prodRes = await productService.getAll(companyId);
            if (prodRes?.data?.success) {
                setAllProducts(prodRes.data.data);
            } else if (prodRes?.data) {
                setAllProducts(prodRes.data);
            } else if (Array.isArray(prodRes)) {
                setAllProducts(prodRes);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to create product');
        }
    };

    // Footer
    const [bankDetails, setBankDetails] = useState({
        bankName: 'HDFC Bank',
        accNo: '50200012345678',
        holderName: 'Zirak Trading Pvt Ltd',
        ifsc: 'HDFC0000456'
    });

    const [notes, setNotes] = useState('');
    const [terms, setTerms] = useState('"Payment is due within 15 days.",\n"Late payments are subject to interest."');

    const resetForm = () => {
        setCustomerId('');
        setSelectedCustomerCreditPeriod(0);
        setSelectedCurrency(companyDetails.currency || 'USD');
        setExchangeRate(1.0);
        setBillingDetails({ name: '', address: '', city: '', state: '', zipCode: '', country: '' });
        setShippingDetails({ name: '', address: '', city: '', state: '', zipCode: '', country: '' });
        setOverallDiscount(0);
        setOverallDiscountType('percentage');
        setCustomerShippingAddresses([]);
        setShippingSameAsBilling(true);
        setInvoiceMeta({
            manualNo: '',
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            deliveryPersonName: '',
            deliveryPersonMobile: '',
            deliveryPersonEmail: ''
        });
        setSalespersonId('');
        setCarNumber('');
        setManualReference('');
        setNumberingMode('auto');
        setNotes(companyDetails.notes || '');
        setTerms(companyDetails.termsInvoice || companyDetails.terms || '');
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
        setNotes(companyDetails.notes || '');
        setTerms(companyDetails.termsInvoice || companyDetails.terms || '');
        setAvailableReceipts([]);
        setAdjustments([]);
        setManualStatus(false);
        setOverrideStatus('UNPAID');
        setCustomFieldValues({});
        setSelectedPhotos([]);
        setSelectedFiles([]);
        setUploadingPhotos(false);
        setUploadingFiles(false);
        setCreationMode('direct');
        setSelectedOrder(null);
        setSelectedChallan(null);
        setSourceSearchTerm('');
        setInvoiceFilterCustomerId('');
        setShowSelectionModal(false);
        setShowAddModal(false);
    };

    const fetchCustomerReceipts = async (custId) => {
        if (!custId) {
            setAvailableReceipts([]);
            setAdjustments([]);
            return;
        }
        try {
            const companyId = GetCompanyId();
            const res = await salesReceiptService.getAll(companyId, { customerId: custId });
            if (res.data.success) {
                const receipts = res.data.data.map(r => {
                    const allocatedAmount = r.allocations?.reduce((sum, a) => sum + a.amount, 0) || 0;
                    const availableAdvance = r.amount - allocatedAmount;
                    return {
                        ...r,
                        availableAdvance
                    };
                }).filter(r => r.availableAdvance > 0.01);

                setAvailableReceipts(receipts);
                setAdjustments([]);
            }
        } catch (error) {
            console.error("Error fetching customer receipts:", error);
        }
    };

    const loadCustomerReceiptsForEdit = async (custId, invId) => {
        if (!custId) {
            setAvailableReceipts([]);
            setAdjustments([]);
            return;
        }
        try {
            const companyId = GetCompanyId();
            const receiptsRes = await salesReceiptService.getAll(companyId, { customerId: custId });
            if (receiptsRes.data.success) {
                const invRes = await salesInvoiceService.getById(invId, companyId);
                const currentAllocations = invRes.data.data.allocations || [];

                const receipts = receiptsRes.data.data.map(r => {
                    const otherAllocations = r.allocations?.filter(a => a.invoiceId !== invId) || [];
                    const otherAllocatedSum = otherAllocations.reduce((sum, a) => sum + a.amount, 0) || 0;
                    const availableAdvance = r.amount - otherAllocatedSum;

                    const currentAlloc = currentAllocations.find(a => a.receiptId === r.id);
                    const currentAllocAmount = currentAlloc ? currentAlloc.amount : 0;

                    return {
                        ...r,
                        availableAdvance,
                        currentAllocAmount
                    };
                }).filter(r => r.availableAdvance > 0.01 || r.currentAllocAmount > 0);

                setAvailableReceipts(receipts);

                const initialAdjustments = currentAllocations.map(a => {
                    const rObj = receiptsRes.data.data.find(r => r.id === a.receiptId);
                    return {
                        receiptId: a.receiptId,
                        receiptNumber: rObj ? rObj.receiptNumber : `Receipt #${a.receiptId}`,
                        amount: a.amount
                    };
                });
                setAdjustments(initialAdjustments);
            }
        } catch (error) {
            console.error("Error loading receipts for edit:", error);
        }
    };

    const handleAddNew = async () => {
        resetForm();
        setCreationMode('direct');
        setShowSelectionModal(false);
        setShowAddModal(true);
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await salesInvoiceService.getNextNumber(companyId);
                if (res.data.success) {
                    setNextInvoiceNumber(res.data.nextNumber);
                    // Also set manualNo as fallback if needed, or just let backend handle if empty
                    setInvoiceMeta(prev => ({ ...prev, manualNo: res.data.nextNumber }));
                }
            }
        } catch (error) {
            console.error('Error fetching next invoice number:', error);
        }
    };

    const salesProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'completed' },
        { id: 'sales-order', label: 'Sales Order', icon: ShoppingCart, status: 'completed' },
        { id: 'delivery', label: 'Delivery', icon: Truck, status: 'completed' },
        { id: 'invoice', label: 'Invoice', icon: Receipt, status: 'active' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'pending' },
    ];

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
                } else if (field === 'uomId') {
                    const newUomId = value ? parseInt(value) : '';
                    const prodId = item.productId ? (String(item.productId).startsWith('p-') ? parseInt(String(item.productId).replace('p-', '')) : parseInt(item.productId)) : null;
                    const prod = prodId ? allProducts.find(p => p.id === prodId) : null;
                    if (prod) {
                        const newUom = allUoms.find(u => u.id === newUomId) || prod.uom || prod.salesUom || prod.purchaseUom;
                        const conversionRate = getSyncRate(selectedCurrency, companySettings?.currency || 'INR') || 1.0;
                        const basePrice = prod.salePrice ? (prod.salePrice / conversionRate) : 0;
                        const multiplier = newUom?.uomType === 'Compound' ? parseFloat(newUom.conversionRate) || 1 : 1;
                        updatedItem = {
                            ...item,
                            uomId: newUomId,
                            rate: Number((basePrice * multiplier).toFixed(2))
                        };
                    } else {
                        updatedItem = { ...item, uomId: newUomId };
                    }
                } else {
                    updatedItem = { ...item, [field]: value };
                }

                const qty = parseFloat(updatedItem.qty) || 0;
                const rate = parseFloat(updatedItem.rate) || 0;
                const tax = parseFloat(updatedItem.tax) || 0;
                const discount = parseFloat(updatedItem.discount) || 0;

                const subtotal = qty * rate;
                const taxable = subtotal - discount;
                const taxAmount = (taxable * tax) / 100;

                updatedItem.total = taxable + taxAmount;
                return updatedItem;
            }
            return item;
        }));
    };

    const calculateTotals = () => {
        const totalsData = items.reduce((acc, item) => {
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const itemDiscount = parseFloat(item.discount) || 0;
            const taxRate = parseFloat(item.tax) || 0;

            const lineGross = qty * rate;
            const lineTaxable = lineGross - itemDiscount;
            const lineTax = (lineTaxable * taxRate) / 100;
            const lineTotal = lineTaxable + lineTax;

            acc.subTotal += lineGross;
            acc.discount += itemDiscount;
            acc.tax += lineTax;
            acc.total += lineTotal;
            return acc;
        }, { subTotal: 0, tax: 0, discount: 0, total: 0 });

        const baseTotal = (totalsData.subTotal - totalsData.discount) + totalsData.tax;
        let ovDiscountAmt = 0;
        const ovVal = parseFloat(overallDiscount) || 0;
        if (overallDiscountType === 'percentage') {
            ovDiscountAmt = (baseTotal * ovVal) / 100;
        } else {
            ovDiscountAmt = ovVal;
        }

        totalsData.ovDiscountAmt = ovDiscountAmt;
        totalsData.finalTotal = Math.max(0, baseTotal - ovDiscountAmt);
        return totalsData;
    };

    const totals = calculateTotals();

    // Helper to get status class
    const getStatusClass = (status) => {
        if (!status) return 'Invoice-pending';
        const s = status.toLowerCase();
        if (s.includes('paid')) {
            if (s.includes('partial') || s.includes('partially')) return 'Invoice-partial';
            if (s.includes('fully') || s === 'paid') return 'Invoice-paid';
        }
        if (s.includes('linked')) return 'Invoice-sent';
        if (s.includes('return')) return 'Invoice-overdue';
        if (s.includes('sent')) return 'Invoice-sent';
        if (s.includes('overdue')) return 'Invoice-overdue';
        if (s.includes('unpaid')) return 'Invoice-overdue';
        return 'Invoice-pending';
    };

    // --- Actions Handlers ---

    const handleView = async (invoice) => {
        try {
            // POS invoices already have all data from the list fetch
            if (invoice.type === 'POS_INVOICE') {
                setSelectedInvoice(invoice);
                setViewMode(true);
                return;
            }
            const companyId = GetCompanyId();
            const response = await salesInvoiceService.getById(invoice.id, companyId);
            if (response.data.success) {
                setSelectedInvoice(response.data.data);
                setViewMode(true);
            } else {
                // Fallback to invoice data if fetch fails
                setSelectedInvoice(invoice);
                setViewMode(true);
            }
        } catch (error) {
            console.error('Error fetching invoice details:', error);
            // Fallback to invoice data
            setSelectedInvoice(invoice);
            setViewMode(true);
        }
    };

    const handleCombinedView = (group) => {
        const allItems = [];
        const allReceipts = [];

        group.invoices.forEach(inv => {
            const items = inv.invoiceitem || inv.posinvoiceitem || inv.items || [];
            items.forEach(item => {
                allItems.push({
                    ...item,
                    docPaidAmount: inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAmount - (inv.balanceAmount || 0)),
                    docNumber: inv.invoiceNumber
                });
            });

            if (inv.receipt && inv.receipt.length > 0) {
                inv.receipt.forEach(rec => {
                    allReceipts.push(rec);
                });
            }
        });

        // Sort receipts by date ascending
        allReceipts.sort((a, b) => new Date(a.date) - new Date(b.date));

        const combinedInvoice = {
            id: `combined-${group.id}`,
            invoiceNumber: `COMBINED-${group.id}`,
            date: group.earliestDate,
            dueDate: group.latestDueDate,
            type: 'COMBINED',
            customer: group.customer,
            billingName: group.customer?.name,
            billingAddress: group.customer?.billingAddress,
            billingCity: group.customer?.billingCity,
            billingState: group.customer?.billingState,
            billingZipCode: group.customer?.billingZipCode,
            billingCountry: group.customer?.billingCountry,
            shippingName: group.customer?.name,
            shippingAddress: group.customer?.billingAddress,
            shippingCity: group.customer?.billingCity,
            shippingState: group.customer?.billingState,
            shippingZipCode: group.customer?.billingZipCode,
            shippingCountry: group.customer?.billingCountry,
            items: allItems,
            receipt: allReceipts,
            subtotal: group.totalInvoiceAmount - (group.invoices.reduce((acc, inv) => acc + (inv.taxAmount || 0), 0)),
            taxAmount: group.invoices.reduce((acc, inv) => acc + (inv.taxAmount || 0), 0),
            totalAmount: group.totalInvoiceAmount,
            paidAmount: group.totalPaidAmount,
            balanceAmount: group.balanceAmount,
            notes: `Overall summary for ${group.customer?.name} - includes ${group.invoices.length} invoices.`,
            status: 'Partial'
        };
        setSelectedInvoice(combinedInvoice);
        setViewMode(true);
    };

    const incrementString = (str) => {
        if (!str) return '1';
        const match = str.match(/(\d+)$/);
        if (match) {
            const numStr = match[1];
            const nextNum = parseInt(numStr, 10) + 1;
            const paddedNum = String(nextNum).padStart(numStr.length, '0');
            return str.substring(0, str.length - numStr.length) + paddedNum;
        } else {
            return str + '1';
        }
    };

    const handleSave = async (forceAllowDuplicate = false, overrideManualRef = null) => {
        const isForce = forceAllowDuplicate === true;
        try {
            if (!invoiceMeta.deliveryPersonName?.trim()) {
                toast.warning("Delivery Person Name is required.");
                return;
            }
            if (!invoiceMeta.deliveryPersonMobile?.trim()) {
                toast.warning("Delivery Person Mobile is required.");
                return;
            }
            if (!invoiceMeta.deliveryPersonEmail?.trim()) {
                toast.warning("Delivery Person Email is required.");
                return;
            }
            const companyId = GetCompanyId();
            const customFieldsPayload = {
                ...customFieldValues,
                deliveryPersonName: invoiceMeta.deliveryPersonName,
                deliveryPersonMobile: invoiceMeta.deliveryPersonMobile,
                deliveryPersonEmail: invoiceMeta.deliveryPersonEmail,
                _attachments: {
                    photos: selectedPhotos,
                    files: selectedFiles
                }
            };

            const data = {
                customFields: JSON.stringify(customFieldsPayload),
                invoiceNumber: invoiceMeta.manualNo || `INV-${Date.now()}`,
                manualReference: overrideManualRef !== null ? overrideManualRef : (manualReference || null),
                salespersonId: salespersonId ? parseInt(salespersonId) : null,
                carNumber: carNumber || null,
                date: invoiceMeta.date,
                dueDate: invoiceMeta.dueDate,
                customerId: parseInt(customerId),
                companyId: parseInt(companyId),
                salesOrderId: selectedOrder ? parseInt(selectedOrder.id) : null,
                deliveryChallanId: selectedChallan ? parseInt(selectedChallan.id) : null,
                notes: notes,
                manualStatus,
                status: manualStatus ? overrideStatus : undefined,
                billingName: billingDetails.name,
                billingAddress: billingDetails.address,
                billingCity: billingDetails.city,
                billingState: billingDetails.state,
                billingZipCode: billingDetails.zipCode,
                billingCountry: billingDetails.country,
                shippingName: shippingDetails.name,
                shippingAddress: shippingDetails.address,
                shippingCity: shippingDetails.city,
                shippingState: shippingDetails.state,
                shippingZipCode: shippingDetails.zipCode,
                shippingCountry: shippingDetails.country,
                overallDiscount: parseFloat(overallDiscount) || 0,
                overallDiscountType: overallDiscountType,
                currency: selectedCurrency,
                exchangeRate: parseFloat(exchangeRate) || 1.0,
                adjustments: adjustments.filter(adj => adj.amount > 0).map(adj => ({
                    receiptId: adj.receiptId,
                    amount: adj.amount
                })),
                items: items.map(item => ({
                    productId: item.productId ? parseInt(item.productId) : null,
                    serviceId: item.serviceId ? parseInt(item.serviceId) : null,
                    warehouseId: item.warehouseId ? parseInt(item.warehouseId) : null,
                    uomId: item.uomId ? parseInt(item.uomId) : null,
                    description: item.description || (item.productId ? allProducts.find(p => p.id === parseInt(item.productId))?.name : ''),
                    quantity: parseFloat(item.qty),
                    rate: parseFloat(item.rate),
                    discount: parseFloat(item.discount) || 0,
                    taxRate: parseFloat(item.tax)
                }))
            };

            let response;
            if (editingId) {
                response = await salesInvoiceService.update(editingId, data, companyId);
            } else {
                response = await salesInvoiceService.create(data, isForce);
            }

            if (response.data.success) {
                toast.success(editingId ? 'Invoice updated successfully!' : 'Invoice created successfully!');
                fetchData();
                fetchDropdowns();

                if (!editingId) {
                    const invId = response.data.data?.id || response.data.id;
                    if (invId) {
                        const fullInvRes = await salesInvoiceService.getById(invId, companyId);
                        if (fullInvRes.data.success) {
                            setSelectedInvoice(fullInvRes.data.data);
                            setViewMode(true);
                            setShouldAutoOpenNext(true);
                        }
                    }
                }
                resetForm();
            }
        } catch (error) {
            console.error('Error saving invoice:', error);
            if (error.response?.data?.isDuplicate) {
                const currentRef = overrideManualRef !== null ? overrideManualRef : (manualReference || '');
                setDuplicateRefToRetry(currentRef);
                setShowDuplicateModal(true);
            } else {
                toast.error(error.response?.data?.message || 'Error saving invoice');
            }
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
                const res = await axiosInstance.post('/upload?folder=invoices', formDataUpload, {
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

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setCustomerId(order.customerId);
        setSelectedCustomerCreditPeriod(order.customer?.creditPeriod || 0);
        const newDueDate = calculateDueDate(invoiceMeta.date, order.customer?.creditPeriod || 0);
        setInvoiceMeta(prev => ({ ...prev, dueDate: newDueDate }));
        setBillingDetails({
            name: order.customer?.billingName || order.customer?.name || '',
            address: order.customer?.billingAddress || '',
            city: order.customer?.billingCity || '',
            state: order.customer?.billingState || '',
            zipCode: order.customer?.billingZipCode || '',
            country: order.customer?.billingCountry || ''
        });
        setCustomerShippingAddresses(order.customer?.shippingaddress || []);
        setShippingDetails({
            name: order.customer?.shippingName || order.customer?.name || '',
            address: order.customer?.shippingAddress || order.customer?.billingAddress || '',
            city: order.customer?.shippingCity || order.customer?.billingCity || '',
            state: order.customer?.shippingState || order.customer?.billingState || '',
            zipCode: order.customer?.shippingZipCode || order.customer?.billingZipCode || '',
            country: order.customer?.shippingCountry || order.customer?.billingCountry || ''
        });
        setShippingSameAsBilling(false); // If coming from order, we might want to preserve their specific shipping
        const sourceItems = order.salesorderitem || order.items || [];
        setItems(sourceItems.map(item => ({
            id: Date.now() + Math.random(),
            productId: item.productId || '',
            serviceId: item.serviceId || '',
            warehouseId: item.warehouseId || '',
            description: item.description,
            qty: item.quantity,
            rate: item.rate,
            tax: item.taxRate,
            discount: item.discount || 0,
            total: item.amount,
            uomId: item.uomId || ''
        })));
        setCreationMode('salesorder');
        setShowSelectionModal(false);
    };

    const handleSelectChallan = (challan) => {
        setSelectedChallan(challan);
        setSelectedOrder(null);
        setCustomerId(challan.customerId);
        setSelectedCustomerCreditPeriod(challan.customer?.creditPeriod || 0);
        const newDueDate = calculateDueDate(invoiceMeta.date, challan.customer?.creditPeriod || 0);
        setInvoiceMeta(prev => ({ ...prev, dueDate: newDueDate }));
        setBillingDetails({
            name: challan.customer?.billingName || challan.customer?.name || '',
            address: challan.customer?.billingAddress || '',
            city: challan.customer?.billingCity || '',
            state: challan.customer?.billingState || '',
            zipCode: challan.customer?.billingZipCode || ''
        });
        setShippingDetails({
            name: challan.customer?.shippingName || challan.customer?.name || '',
            address: challan.shippingAddress || challan.customer?.shippingAddress || challan.customer?.billingAddress || '',
            city: challan.shippingCity || challan.customer?.shippingCity || challan.customer?.billingCity || '',
            state: challan.shippingState || challan.customer?.shippingState || challan.customer?.billingState || '',
            zipCode: challan.shippingZipCode || challan.customer?.shippingZipCode || challan.customer?.billingZipCode || '',
            country: challan.shippingCountry || challan.customer?.shippingCountry || challan.customer?.billingCountry || ''
        });
        setCustomerShippingAddresses(challan.customer?.shippingaddress || []);
        setShippingSameAsBilling(false); // Challan usually has specific shipping info

        // Match items with Sales Order to get rates/tax
        const soItems = challan.salesorder?.salesorderitem || [];

        const sourceChallanItems = challan.deliverychallanitem || challan.items || [];
        setItems(sourceChallanItems.map(item => {
            const matchedSOItem = soItems.find(soi => soi.productId === item.productId);
            const rate = matchedSOItem?.rate || 0;
            const tax = matchedSOItem?.taxRate || 0;
            const disc = matchedSOItem?.discount || 0;
            const qty = item.quantity;

            const taxable = (rate * qty) - disc;
            const total = taxable + (taxable * tax / 100);

            return {
                id: Date.now() + Math.random(),
                productId: item.productId || '',
                serviceId: '',
                warehouseId: item.warehouseId || '',
                description: item.description || matchedSOItem?.description || '',
                qty: qty,
                rate: rate,
                tax: tax,
                discount: disc,
                total: total,
                uomId: item.uomId || matchedSOItem?.uomId || ''
            };
        }));
        setCreationMode('challan');
        setShowSelectionModal(false);
    };

    const handleCollectPaymentClick = (inv, e) => {
        if (e) e.stopPropagation();
        console.log("💰 handleCollectPaymentClick - Inv:", inv);
        try {
            setSelectedInvoice(inv);
            const balance = parseFloat(inv.balanceAmount) || 0;
            setPaymentAmount(balance.toFixed(2));
            setPaymentMode(inv.paymentMode || 'CASH');

            const modeName = (inv.paymentMode || 'CASH') === 'CASH' ? 'cash' : 'bank';
            const defaultAcc = accounts?.find(a => a.name?.toLowerCase().includes(modeName)) || accounts?.[0];
            setSelectedAccountId(defaultAcc ? defaultAcc.id.toString() : '');

            setPaymentDate(new Date().toISOString().split('T')[0]);
            setPaymentNotes(`Payment received for POS ${inv.invoiceNumber || ''}`);
            setShowPaymentModal(true);
            console.log("💰 handleCollectPaymentClick - Modal opened successfully");
        } catch (err) {
            console.error("💰 handleCollectPaymentClick - Error:", err);
            toast.error("Failed to open payment modal: " + err.message);
        }
    };

    const handleConfirmPayment = async () => {
        if (!selectedInvoice) return;
        const amt = parseFloat(paymentAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }
        const balance = parseFloat(selectedInvoice.balanceAmount) || 0;
        if (amt > balance + 0.01) {
            toast.error(`Amount cannot exceed the balance due of ${formatCurrency(balance)}`);
            return;
        }

        try {
            setPaymentSubmitting(true);
            const companyId = GetCompanyId();
            const payload = {
                amount: amt,
                paymentMode,
                accountId: selectedAccountId ? parseInt(selectedAccountId) : null,
                date: paymentDate,
                notes: paymentNotes
            };
            console.log("💰 Sending POS Payment Payload:", payload);
            const res = await posService.recordPOSPayment(selectedInvoice.id, payload, companyId);
            console.log("💰 POS Payment Response:", res);
            if (res && res.success) {
                toast.success('Payment recorded successfully');
                setShowPaymentModal(false);
                await fetchData(); // Refresh main list
                if (viewMode) {
                    await refreshSelectedInvoice(selectedInvoice.id); // Refresh preview
                }
            } else {
                toast.error(res?.message || 'Failed to record payment');
            }
        } catch (error) {
            console.error("💰 POS Payment Error:", error);
            toast.error(error.response?.data?.message || error.message || 'Failed to record payment');
        } finally {
            setPaymentSubmitting(false);
        }
    };

    const refreshSelectedInvoice = async (invoiceId) => {
        try {
            const companyId = GetCompanyId();
            const res = await posService.getPOSInvoiceById(invoiceId, companyId);
            if (res && res.success) {
                setSelectedInvoice({
                    ...res.data,
                    type: 'POS_INVOICE',
                    invoiceitem: res.data.posinvoiceitem || [],
                    items: res.data.posinvoiceitem || []
                });
            }
        } catch (error) {
            console.error('Error refreshing selected invoice:', error);
        }
    };

    const handleDelete = (invoice) => {
        setInvoiceToDelete(invoice);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (invoiceToDelete) {
            try {
                const companyId = GetCompanyId();
                if (invoiceToDelete.type === 'POS_INVOICE') {
                    await posService.deletePOSInvoice(invoiceToDelete.id);
                } else {
                    await salesInvoiceService.delete(invoiceToDelete.id, companyId);
                }
                setInvoices(invoices.filter(inv => !(inv.id === invoiceToDelete.id && inv.type === invoiceToDelete.type)));
                setShowDeleteModal(false);
                setInvoiceToDelete(null);
                if (viewMode) setViewMode(false);
            } catch (error) {
                console.error('Error deleting invoice:', error);
            }
        }
    };

    const handleStatusChange = async (invoiceId, isPos, newStatus) => {
        try {
            const companyId = GetCompanyId();
            let response;
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };

            if (isPos) {
                response = await posService.updatePOSInvoice(invoiceId, payload, companyId);
            } else {
                response = await salesInvoiceService.update(invoiceId, payload, companyId);
            }

            if (response.data?.success || response.success) {
                toast.success('Status updated successfully');
                fetchData();
            } else {
                toast.error('Failed to update status');
            }
        } catch (error) {
            console.error('Error changing status:', error);
            toast.error(error.response?.data?.message || 'Error updating status');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // --- RENDER FULL PAGE VIEW IF IN VIEW MODE ---
    if (viewMode && selectedInvoice) {
        return (
            <div className="Invoice-invoice-full-page-view">
                <div className="Invoice-view-page-header Invoice-no-print">
                    <button className="Invoice-btn-back" onClick={async () => {
                        setViewMode(false);
                        if (shouldAutoOpenNext) {
                            setShouldAutoOpenNext(false);
                            resetForm();
                            setEditingId(null);
                            try {
                                const companyId = GetCompanyId();
                                if (companyId) {
                                    const res = await salesInvoiceService.getNextNumber(companyId);
                                    if (res.data.success) {
                                        setNextInvoiceNumber(res.data.nextNumber);
                                        setInvoiceMeta(prev => ({ ...prev, manualNo: res.data.nextNumber }));
                                    }
                                }
                            } catch (error) {
                                console.error('Error fetching next invoice number:', error);
                            }
                            setCreationMode('direct');
                            setShowSelectionModal(false);
                            setShowAddModal(true);
                        }
                    }}>
                        <ArrowLeft size={18} /> Back to Invoices
                    </button>
                    <div className="Invoice-view-actions" style={{ display: 'flex', gap: '8px' }}>
                        {selectedInvoice.type !== 'POS_INVOICE' && selectedInvoice.balanceAmount > 0 && hasPermission('create sales payment') && (
                            <button
                                className="Invoice-btn-payment"
                                onClick={() => navigate('/company/sales/payment', { state: { targetInvoiceId: selectedInvoice.id, customerId: selectedInvoice.customerId } })}
                                style={{
                                    background: '#10b981',
                                    color: 'white',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '700',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <CreditCard size={18} /> Receive Payment
                            </button>
                        )}
                        {selectedInvoice.type === 'POS_INVOICE' && selectedInvoice.balanceAmount > 0 && hasPermission('create sales payment') && (
                            <button
                                className="Invoice-btn-payment"
                                onClick={() => navigate('/company/sales/payment', { state: { targetInvoiceId: selectedInvoice.id, invoiceType: 'POS_INVOICE', customerId: selectedInvoice.customerId } })}
                                style={{
                                    background: '#10b981',
                                    color: 'white',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '700',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <CreditCard size={18} /> Receive Payment
                            </button>
                        )}
                        <button className="Invoice-btn-print" onClick={handlePrint}>
                            <Printer size={18} /> Print
                        </button>
                    </div>
                </div>

                <div className="Invoice-view-content-wrapper Invoice-printable-area">
                    <div
                        className={`invoice-preview-container template-${(companyDetails.template || 'Invoice-newyork').toLowerCase().replace(/\s+/g, '').replace('invoice-', '')}`}
                        id="invoice-print-content"
                        style={{
                            '--header-bg': companyDetails.color || '#004aad',
                            '--header-text': (() => {
                                const hex = (companyDetails.color || '#004aad').replace('#', '');
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
                                {/* Row 1: Logo and Title */}
                                <div className="invoice-preview-header" style={{ marginBottom: '10px' }}>
                                    <div className="invoice-header-left">
                                        {companyDetails.logo && (
                                            <img src={companyDetails.logo} alt="Company Logo" className="invoice-logo-large" style={{ margin: '0' }} />
                                        )}
                                    </div>
                                    <div className="invoice-header-right">
                                        <div className="invoice-title-large" style={{ color: companyDetails.color, margin: '0' }}>{getDocumentTitle('invoice')}</div>
                                    </div>
                                </div>

                                {/* Row 2: Company Details and Meta Info */}
                                <div className="invoice-preview-header" style={{ alignItems: 'flex-start' }}>
                                    <div className="invoice-header-left">
                                        <div className="invoice-company-details">
                                            <h2 style={{ color: companyDetails.color, margin: '0 0 5px 0', fontSize: '1.6rem', fontWeight: '900' }}>
                                                {(() => {
                                                    const name = companyDetails.name || '';
                                                    const arabicRegex = /[\u0600-\u06FF]/;
                                                    const match = name.match(arabicRegex);
                                                    if (match) return name.substring(0, match.index).trim();
                                                    return name;
                                                })()}
                                            </h2>
                                            {(() => {
                                                const name = companyDetails.name || '';
                                                const arabicRegex = /[\u0600-\u06FF]/;
                                                const match = name.match(arabicRegex);
                                                if (match) {
                                                    return (
                                                        <div style={{ color: companyDetails.color, fontSize: '1.3rem', fontWeight: '700', marginBottom: '8px' }}>
                                                            {name.substring(match.index).trim()}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            <p>{companyDetails.address}</p>
                                            <p>{companyDetails.email} | {companyDetails.phone}</p>
                                        </div>
                                    </div>
                                    <div className="invoice-header-right">
                                        <div className="invoice-meta-info">
                                            <div className="invoice-meta-row">
                                                <span className="invoice-label">{getInvoiceLabel('number')}</span> <span>#{selectedInvoice?.invoiceNumber || 'N/A'}</span>
                                            </div>
                                            {selectedInvoice?.manualReference && (
                                                <div className="invoice-meta-row">
                                                    <span className="invoice-label">Manual Ref:</span> <span>{selectedInvoice.manualReference}</span>
                                                </div>
                                            )}
                                            <div className="invoice-meta-row">
                                                <span className="invoice-label">{getInvoiceLabel('issue')}</span> <span>{selectedInvoice?.date ? new Date(selectedInvoice.date).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                            <div className="invoice-meta-row">
                                                <span className="invoice-label">{getInvoiceLabel('dueDate')}</span> <span>{selectedInvoice?.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                            {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'INR') && (
                                                <>
                                                    <div className="invoice-meta-row">
                                                        <span className="invoice-label">Currency:</span> <span>{selectedInvoice.currency}</span>
                                                    </div>
                                                    <div className="invoice-meta-row">
                                                        <span className="invoice-label">Ex. Rate:</span> <span>1 {selectedInvoice.currency} = {Number(viewRate).toFixed(4)} {companySettings?.currency || 'INR'}</span>
                                                    </div>
                                                </>
                                            )}
                                            {selectedInvoice?.salesperson && (
                                                <>
                                                    <div className="invoice-meta-row">
                                                        <span className="invoice-label">Salesperson:</span> <span>{selectedInvoice.salesperson.name}</span>
                                                    </div>
                                                    {selectedInvoice.salesperson.phone && (
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">Salesperson Phone:</span> <span>{selectedInvoice.salesperson.phone}</span>
                                                        </div>
                                                    )}
                                                    {selectedInvoice.salesperson.email && (
                                                        <div className="invoice-meta-row">
                                                            <span className="invoice-label">Salesperson Email:</span> <span>{selectedInvoice.salesperson.email}</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {selectedInvoice?.carNumber && (
                                                <div className="invoice-meta-row">
                                                    <span className="invoice-label">Car Number:</span> <span>{selectedInvoice.carNumber}</span>
                                                </div>
                                            )}
                                            {(() => {
                                                if (!selectedInvoice?.customFields) return null;
                                                try {
                                                    const cf = typeof selectedInvoice.customFields === 'string'
                                                        ? JSON.parse(selectedInvoice.customFields)
                                                        : selectedInvoice.customFields;
                                                    return (
                                                        <>
                                                            {cf.deliveryPersonName && (
                                                                <div className="invoice-meta-row">
                                                                    <span className="invoice-label">Del. Person:</span> <span>{cf.deliveryPersonName}</span>
                                                                </div>
                                                            )}
                                                            {cf.deliveryPersonMobile && (
                                                                <div className="invoice-meta-row">
                                                                    <span className="invoice-label">Del. Mobile:</span> <span>{cf.deliveryPersonMobile}</span>
                                                                </div>
                                                            )}
                                                            {cf.deliveryPersonEmail && (
                                                                <div className="invoice-meta-row">
                                                                    <span className="invoice-label">Del. Email:</span> <span>{cf.deliveryPersonEmail}</span>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                } catch (e) {
                                                    return null;
                                                }
                                            })()}
                                        </div>
                                        {companyDetails.showQr && selectedInvoice?.id && (
                                            <div className="invoice-qr-box" style={{ marginTop: '1rem' }}>
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/view/invoice/${selectedInvoice.id}`)}`}
                                                    alt="QR"
                                                    className="invoice-qr-code"
                                                    style={{ width: '80px', height: '80px', margin: '0' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Custom Fields Print View */}
                        {(() => {
                            let customFieldVals = {};
                            if (selectedInvoice?.customFields) {
                                try {
                                    customFieldVals = typeof selectedInvoice.customFields === 'string'
                                        ? JSON.parse(selectedInvoice.customFields)
                                        : selectedInvoice.customFields;
                                } catch (e) {
                                    console.error('Error parsing invoice custom fields for view:', e);
                                }
                            }
                            const fieldsList = getCustomFieldsForType('invoice');
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

                        <div className="invoice-addresses" style={{ display: 'flex', justifyContent: 'space-between', width: '100% !important', marginTop: '2.5rem', gap: '3rem' }}>
                            <div className="invoice-bill-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                <div className="invoice-section-header">{getInvoiceLabel('billTo')}</div>
                                <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                    {(() => {
                                        const name = selectedInvoice?.billingName || selectedInvoice?.customer?.name || 'N/A';
                                        const arabicRegex = /[\u0600-\u06FF]/;
                                        const match = name.match(arabicRegex);
                                        if (match) {
                                            const eng = name.replace(/[\u0600-\u06FF\s]+/g, ' ').trim();
                                            return eng || name;
                                        }
                                        return name;
                                    })()}
                                </div>
                                {(() => {
                                    const name = selectedInvoice?.billingName || selectedInvoice?.customer?.name || '';
                                    const arabicRegex = /[\u0600-\u06FF]/;
                                    const match = name.match(arabicRegex);
                                    const explicitArabic = selectedInvoice?.customer?.nameArabic;

                                    if (explicitArabic) return <div className="invoice-arabic-name" style={{ fontSize: '1.1rem', marginTop: '2px', color: '#475569', fontWeight: '600' }}>{explicitArabic}</div>;

                                    if (match) {
                                        const arb = name.match(/[\u0600-\u06FF\s]+/g)?.join('').trim();
                                        if (arb) return <div className="invoice-arabic-name" style={{ fontSize: '1.1rem', marginTop: '2px', color: '#475569', fontWeight: '600' }}>{arb}</div>;
                                    }
                                    return null;
                                })()}
                                <div style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                    {selectedInvoice?.billingAddress || selectedInvoice?.customer?.billingAddress}
                                </div>
                                <div style={{ color: '#475569', fontWeight: '500', fontSize: '0.95rem' }}>
                                    {[selectedInvoice?.billingCity, selectedInvoice?.billingState, selectedInvoice?.billingZipCode].filter(Boolean).join(', ')}
                                </div>
                            </div>
                            <div className="invoice-ship-to" style={{ flex: 1, textAlign: 'right', minWidth: '0' }}>
                                <div className="invoice-section-header">{getInvoiceLabel('shipTo')}</div>
                                <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                    {(() => {
                                        const name = selectedInvoice?.shippingName || selectedInvoice?.customer?.name || 'N/A';
                                        const arabicRegex = /[\u0600-\u06FF]/;
                                        const match = name.match(arabicRegex);
                                        if (match) {
                                            const eng = name.replace(/[\u0600-\u06FF\s]+/g, ' ').trim();
                                            return eng || name;
                                        }
                                        return name;
                                    })()}
                                </div>
                                {(() => {
                                    const name = selectedInvoice?.shippingName || selectedInvoice?.customer?.name || '';
                                    const arabicRegex = /[\u0600-\u06FF]/;
                                    const match = name.match(arabicRegex);
                                    const explicitArabic = selectedInvoice?.customer?.nameArabic;

                                    if (explicitArabic) return <div className="invoice-arabic-name" style={{ fontSize: '1.1rem', marginTop: '2px', color: '#475569', fontWeight: '600' }}>{explicitArabic}</div>;

                                    if (match) {
                                        const arb = name.match(/[\u0600-\u06FF\s]+/g)?.join('').trim();
                                        if (arb) return <div className="invoice-arabic-name" style={{ fontSize: '1.1rem', marginTop: '2px', color: '#475569', fontWeight: '600' }}>{arb}</div>;
                                    }
                                    return null;
                                })()}
                                <div style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                    {selectedInvoice?.shippingAddress || selectedInvoice?.shippingAddress || selectedInvoice?.customer?.billingAddress}
                                </div>
                                <div style={{ color: '#475569', fontWeight: '500', fontSize: '0.95rem' }}>
                                    {[selectedInvoice?.shippingCity, selectedInvoice?.shippingState, selectedInvoice?.shippingZipCode, selectedInvoice?.shippingCountry].filter(Boolean).join(', ')}
                                </div>
                            </div>
                        </div>

                        <table className="invoice-table-preview">
                            <thead>
                                <tr>
                                    <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('item', 'ITEM').toUpperCase()}</th>
                                    {getInvoiceLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('warehouse', 'WAREHOUSE').toUpperCase()}</th>}
                                    {getInvoiceLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('quantity', 'QUANTITY').toUpperCase()}</th>}
                                    {getInvoiceLabel('showUom') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('uom', 'UOM').toUpperCase()}</th>}
                                    {getInvoiceLabel('showRate') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('rate', 'RATE').toUpperCase()}</th>}
                                    <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>AMOUNT PAID</th>
                                    {false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('discount', 'DISCOUNT').toUpperCase()}</th>}
                                    {getInvoiceLabel('showTax') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('tax', 'TAX (%)').toUpperCase()}</th>}
                                    <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'right' }}>{getTableHeader('price', 'PRICE').toUpperCase()}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {((selectedInvoice?.invoiceitem || selectedInvoice?.posinvoiceitem || selectedInvoice?.items) || []).map((item, idx) => {
                                    const productName = item.product?.name || item.service?.name || item.description || 'Item';
                                    const arabicRegex = /[\u0600-\u06FF]/;
                                    const match = productName.match(arabicRegex);
                                    let englishPart = productName;
                                    let arabicPart = '';
                                    if (match) {
                                        englishPart = productName.substring(0, match.index).trim();
                                        arabicPart = productName.substring(match.index).trim();
                                    }

                                    return (
                                        <tr key={idx}>
                                            <td style={{ width: '25%' }}>
                                                <div className="font-bold" style={{ fontSize: '1rem', color: '#1e293b' }}>{englishPart}</div>
                                                {arabicPart && (
                                                    <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '2px', fontWeight: '500' }}>
                                                        {arabicPart}
                                                    </div>
                                                )}
                                                {item.description && item.description !== productName && (
                                                    <div className="Invoice-text-xs Invoice-text-slate-500" style={{ marginTop: '4px' }}>{item.description}</div>
                                                )}
                                            </td>
                                            {getInvoiceLabel('showWarehouse') !== false && <td>{item.warehouse?.name || (item.warehouseId ? `WH #${item.warehouseId}` : 'Main Warehouse')}</td>}
                                            {getInvoiceLabel('showQty') !== false && <td>{item.quantity}</td>}
                                            {getInvoiceLabel('showUom') !== false && <td>{item.uom?.unitName || (item.uomId ? `UOM #${item.uomId}` : 'pcs')}</td>}
                                            {getInvoiceLabel('showRate') !== false && (
                                                <td>
                                                    {formatDocCurrency(item.rate, selectedInvoice?.currency)}
                                                    {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>
                                                            ({formatDocCurrency(item.rate * viewRate, companySettings?.currency || 'USD')})
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            <td>
                                                {(() => {
                                                    const totalAmount = selectedInvoice.totalAmount || 1;
                                                    const paidAmount = item.docPaidAmount !== undefined ? item.docPaidAmount : (selectedInvoice.paidAmount || 0);
                                                    const itemTotal = item.amount || 0;
                                                    const proportionalPaid = (itemTotal / totalAmount) * paidAmount;
                                                    return (
                                                        <>
                                                            {formatDocCurrency(proportionalPaid, selectedInvoice?.currency)}
                                                            {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                                                <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>
                                                                    ({formatDocCurrency(proportionalPaid * viewRate, companySettings?.currency || 'USD')})
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                            {false && (
                                                <td>
                                                    {formatDocCurrency(item.discount || 0, selectedInvoice?.currency)}
                                                    {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>
                                                            ({formatDocCurrency((item.discount || 0) * viewRate, companySettings?.currency || 'USD')})
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            {getInvoiceLabel('showTax') !== false && <td>{item.taxRate}%</td>}
                                            <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                                {formatDocCurrency(item.amount, selectedInvoice?.currency)}
                                                {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>
                                                        ({formatDocCurrency(item.amount * viewRate, companySettings?.currency || 'USD')})
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="invoice-total-section">
                            <div className="invoice-totals">
                                <div className="invoice-total-row">
                                    <span>{getInvoiceLabel('subTotal')}</span>
                                    <span>
                                        {formatDocCurrency(Object.values(selectedInvoice?.invoiceitem || selectedInvoice?.items || []).reduce((acc, item) => acc + (item.quantity * item.rate), 0), selectedInvoice?.currency)}
                                        {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginLeft: '6px' }}>
                                                ({formatDocCurrency(Object.values(selectedInvoice?.invoiceitem || selectedInvoice?.items || []).reduce((acc, item) => acc + (item.quantity * item.rate), 0) * viewRate, companySettings?.currency || 'USD')})
                                            </span>
                                        )}
                                    </span>
                                </div>
                                {getInvoiceLabel('showTax') !== false && (
                                    <div className="invoice-total-row">
                                        <span>{getInvoiceLabel('tax')}</span>
                                        <span>
                                            {formatDocCurrency(selectedInvoice?.taxAmount || 0, selectedInvoice?.currency)}
                                            {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginLeft: '6px' }}>
                                                    ({formatDocCurrency((selectedInvoice?.taxAmount || 0) * viewRate, companySettings?.currency || 'USD')})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                )}

                                <div className="invoice-final-total">
                                    <span>{getInvoiceLabel('total')}</span>
                                    <span>
                                        {formatDocCurrency(selectedInvoice?.totalAmount || 0, selectedInvoice?.currency)}
                                        {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginLeft: '6px' }}>
                                                ({formatDocCurrency((selectedInvoice?.totalAmount || 0) * viewRate, companySettings?.currency || 'USD')})
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <>
                                    <div className="invoice-total-row" style={{ marginTop: '0.8rem', borderTop: '1px solid #edf2f7', paddingTop: '0.8rem' }}>
                                        <span style={{ fontWeight: '600' }}>Amount Paid</span>
                                        <span>
                                            <span style={{ fontWeight: '700', color: '#10b981' }}>{formatDocCurrency(selectedInvoice?.paidAmount || 0, selectedInvoice?.currency)}</span>
                                            {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginLeft: '6px' }}>
                                                    ({formatDocCurrency((selectedInvoice?.paidAmount || 0) * viewRate, companySettings?.currency || 'USD')})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="invoice-total-row">
                                        <span style={{ fontWeight: '600' }}>Balance Due</span>
                                        <span>
                                            <span style={{ fontWeight: '700', color: '#ef4444' }}>{formatDocCurrency(selectedInvoice?.balanceAmount || 0, selectedInvoice?.currency)}</span>
                                            {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'USD') && (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginLeft: '6px' }}>
                                                    ({formatDocCurrency((selectedInvoice?.balanceAmount || 0) * viewRate, companySettings?.currency || 'USD')})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {selectedInvoice?.currency && selectedInvoice?.currency !== (companySettings?.currency || 'INR') && (
                                        <div className="invoice-total-row" style={{ marginTop: '0.8rem', borderTop: '1px dashed #edf2f7', paddingTop: '0.8rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
                                            <span>Base Total ({companySettings?.currency || 'INR'}):</span>
                                            <span>{formatDocCurrency((selectedInvoice?.totalAmount || 0) * viewRate, companySettings?.currency || 'INR')}</span>
                                        </div>
                                    )}
                                </>
                            </div>
                        </div>

                        {/* Receipt Details Section */}
                        {selectedInvoice?.receipt && selectedInvoice.receipt.length > 0 && (
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                <h3 className="invoice-section-header" style={{ marginBottom: '0.75rem', fontWeight: 'bold' }}>Receipt Details:</h3>
                                <table className="invoice-table-preview" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Date</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Vch Type</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Reference No.</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'left' }}>Received Into</th>
                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', padding: '8px', textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedInvoice.receipt.map((rec, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                                                <td style={{ padding: '8px' }}>{new Date(rec.date).toLocaleDateString()}</td>
                                                <td style={{ padding: '8px' }}>Receipt</td>
                                                <td style={{ padding: '8px' }}>{rec.receiptNumber || '-'}</td>
                                                <td style={{ padding: '8px' }}>{rec.cashBankAccount?.name || '-'}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatDocCurrency(rec.amount, selectedInvoice?.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Notes Section */}
                        {getInvoiceLabel('showFooter') !== false && (companyDetails.notes || companyDetails.terms) && (
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                <h3 className="invoice-section-header">Notes &amp; Terms</h3>
                                {companyDetails.notes && <p style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'pre-line', marginBottom: '8px' }}>{companyDetails.notes}</p>}
                                {companyDetails.terms && (
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        <strong>Terms &amp; Conditions:</strong> {companyDetails.terms}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Attachments Section in View Mode */}
                        {(() => {
                            let customFieldVals = {};
                            if (selectedInvoice?.customFields) {
                                try {
                                    customFieldVals = typeof selectedInvoice.customFields === 'string'
                                        ? JSON.parse(selectedInvoice.customFields)
                                        : selectedInvoice.customFields;
                                } catch (e) {
                                    console.error('Error parsing invoice custom fields for view:', e);
                                }
                            }
                            const atts = customFieldVals?._attachments;
                            const photos = atts?.photos || [];
                            const files = atts?.files || [];
                            if (photos.length === 0 && files.length === 0) return null;
                            return (
                                <div className="Invoice-no-print" style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', textAlign: 'left' }}>
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
                    </div>
                    {/* Collect Payment Modal */}
                    {showPaymentModal && selectedInvoice && (
                        <div className="POSINV-payment-overlay">
                            <div className="POSINV-payment-modal">
                                <div className="POSINV-payment-header">
                                    <h2 className="POSINV-payment-title">Collect Payment - {selectedInvoice.invoiceNumber}</h2>
                                    <button className="POSINV-payment-close" onClick={() => setShowPaymentModal(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="POSINV-payment-body">
                                    <div className="POSINV-payment-info-box">
                                        <span className="POSINV-payment-info-label">Outstanding Balance:</span>
                                        <span className="POSINV-payment-info-value">{formatCurrency(selectedInvoice.balanceAmount)}</span>
                                    </div>

                                    <div className="POSINV-payment-field">
                                        <label>Amount to Collect</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="POSINV-payment-input"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            placeholder="Enter amount"
                                        />
                                    </div>

                                    <div className="POSINV-payment-field">
                                        <label>Payment Mode</label>
                                        <select
                                            className="POSINV-payment-select"
                                            value={paymentMode}
                                            onChange={(e) => {
                                                setPaymentMode(e.target.value);
                                                const modeName = e.target.value === 'CASH' ? 'cash' : 'bank';
                                                const matched = accounts.find(a => a.name.toLowerCase().includes(modeName));
                                                if (matched) setSelectedAccountId(matched.id.toString());
                                            }}
                                        >
                                            <option value="CASH">Cash</option>
                                            <option value="BANK">Bank Transfer</option>
                                            <option value="CARD">Card Payment</option>
                                            <option value="UPI">UPI</option>
                                            <option value="CHEQUE">Cheque</option>
                                        </select>
                                    </div>

                                    <div className="POSINV-payment-field">
                                        <label>Received Into (Account)</label>
                                        <select
                                            className="POSINV-payment-select"
                                            value={selectedAccountId}
                                            onChange={(e) => setSelectedAccountId(e.target.value)}
                                        >
                                            <option value="">Select Account</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id.toString()}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="POSINV-payment-field">
                                        <label>Payment Date</label>
                                        <input
                                            type="date"
                                            className="POSINV-payment-input"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                        />
                                    </div>

                                    <div className="POSINV-payment-field">
                                        <label>Notes</label>
                                        <textarea
                                            className="POSINV-payment-input"
                                            rows={2}
                                            value={paymentNotes}
                                            onChange={(e) => setPaymentNotes(e.target.value)}
                                            placeholder="Add any payment notes..."
                                        />
                                    </div>
                                </div>
                                <div className="POSINV-payment-footer">
                                    <button className="POSINV-payment-btn-cancel" onClick={() => setShowPaymentModal(false)} disabled={paymentSubmitting}>
                                        Cancel
                                    </button>
                                    <button className="POSINV-payment-btn-submit" onClick={handleConfirmPayment} disabled={paymentSubmitting}>
                                        {paymentSubmitting ? 'Recording...' : 'Record Payment'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- DEFAULT RENDER (LIST) ---
    return (
        <div className="Invoice-invoice-page">
            <div className="Invoice-page-header">
                <div>
                    <h1 className="Invoice-page-title">Invoices</h1>
                    <p className="Invoice-page-subtitle">Manage billing and payments</p>
                </div>
                {hasPermission('create sales invoice') && (
                    <button className="Invoice-btn-add" onClick={handleAddNew}>
                        <Plus size={18} className="mr-2" /> CREATE INVOICE
                    </button>
                )}
            </div>

            <div className="Invoice-filters-card mb-4">
                <div className="Invoice-filters-grid">
                    <div className="Invoice-filter-group search">
                        <label>Search</label>
                        <div className="Invoice-search-inner">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Invoice #, Customer..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="Invoice-filter-group date">
                        <label>From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="Invoice-filter-group date">
                        <label>To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div className="Invoice-filter-group actions">
                        <button className="Invoice-btn-reset" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}>
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            <div className="Invoice-process-tracker-card">
                <div className="Invoice-tracker-wrapper">
                    {salesProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`Invoice-tracker-step ${step.status}`}>
                                <div className="Invoice-step-icon-wrapper">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="Invoice-status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="Invoice-status-badge" size={14} />}
                                </div>
                                <span className="Invoice-step-label">{step.label}</span>
                            </div>
                            {index < salesProcess.length - 1 && (
                                <div className={`Invoice-tracker-divider ${salesProcess[index + 1].status !== 'pending' ? 'Invoice-active' : ''}`}>
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="Invoice-table-card mt-6">
                <div className="Invoice-table-container">
                    <table className="Invoice-invoice-table">
                        <thead>
                            <tr>
                                <th>INVOICE</th>
                                <th>CUSTOMER</th>
                                <th>ISSUE DATE</th>
                                <th>DUE DATE</th>
                                <th>AMOUNT DUE</th>
                                <th>STATUS</th>
                                <th className="text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                // Grouping Logic (Now by Customer)
                                const groupedMap = {};

                                invoices.filter(inv => {
                                    const matchesSearch = (inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        inv.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        inv.totalAmount?.toString().includes(searchTerm));
                                    const invoiceDate = new Date(inv.date).setHours(0, 0, 0, 0);
                                    const matchStart = startDate ? invoiceDate >= new Date(startDate).setHours(0, 0, 0, 0) : true;
                                    const matchEnd = endDate ? invoiceDate <= new Date(endDate).setHours(0, 0, 0, 0) : true;
                                    return matchesSearch && matchStart && matchEnd;
                                }).forEach(inv => {
                                    const key = inv.customerId ? `CUST-${inv.customerId}` : `WALKIN-${inv.type || 'NONE'}`;
                                    if (!groupedMap[key]) {
                                        groupedMap[key] = {
                                            id: key,
                                            isGroup: true,
                                            invoices: [],
                                            returns: [],
                                            totalInvoiceAmount: 0,
                                            totalReturnAmount: 0,
                                            balanceAmount: 0,
                                            totalPaidAmount: 0,
                                            customer: inv.customer || { name: 'Walk-in Customer' },
                                            earliestDate: inv.date,
                                            latestDueDate: inv.dueDate,
                                            isSingle: false
                                        };
                                    }
                                    const rate = getSyncRate(inv.currency || 'USD', companySettings?.currency || 'USD');
                                    groupedMap[key].invoices.push(inv);
                                    groupedMap[key].totalInvoiceAmount += inv.totalAmount * rate;
                                    groupedMap[key].balanceAmount += (inv.balanceAmount || 0) * rate;
                                    const effectivePaid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAmount - (inv.balanceAmount || 0));
                                    groupedMap[key].totalPaidAmount += effectivePaid * rate;

                                    const curr = inv.currency || companySettings?.currency || 'USD';
                                    if (!groupedMap[key].currencyTotals) {
                                        groupedMap[key].currencyTotals = {};
                                    }
                                    if (!groupedMap[key].currencyTotals[curr]) {
                                        groupedMap[key].currencyTotals[curr] = 0;
                                    }
                                    groupedMap[key].currencyTotals[curr] += (inv.balanceAmount || 0);

                                    if (inv.salesreturn) {
                                        inv.salesreturn.forEach(ret => {
                                            groupedMap[key].returns.push(ret);
                                            const retRate = getSyncRate(ret.currency || inv.currency || 'USD', companySettings?.currency || 'USD');
                                            groupedMap[key].totalReturnAmount += (ret.totalAmount || 0) * retRate;
                                        });
                                    }

                                    if (new Date(inv.date) < new Date(groupedMap[key].earliestDate)) groupedMap[key].earliestDate = inv.date;
                                    if (inv.dueDate && new Date(inv.dueDate) > new Date(groupedMap[key].latestDueDate)) groupedMap[key].latestDueDate = inv.dueDate;
                                });

                                Object.values(groupedMap).forEach(group => {
                                    if (group.invoices.length === 1 && group.returns.length === 0) {
                                        group.isSingle = true;
                                    }
                                });

                                return Object.values(groupedMap).map(group => (
                                    <React.Fragment key={group.id}>
                                        <tr className="Invoice-group-row">
                                            <td className="px-4 py-3">
                                                <div className="Invoice-flex Invoice-items-center Invoice-gap-2">
                                                    <button
                                                        className={`Invoice-toggle-btn ${expandedGroups[group.id] ? 'expanded' : ''}`}
                                                        onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                                                    >
                                                        <ChevronDown size={14} />
                                                    </button>
                                                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                                        <span className="font-bold text-blue-600">
                                                            {group.customer?.name}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                                                            ({group.invoices.length} Total Records)
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{group.customer?.name}</td>
                                            <td>{new Date(group.earliestDate).toLocaleDateString()}</td>
                                            <td> {group.latestDueDate ? new Date(group.latestDueDate).toLocaleDateString() : 'N/A'}</td>
                                            <td className="font-bold">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {(() => {
                                                        const currs = Object.keys(group.currencyTotals || {});
                                                        const baseCurr = companySettings?.currency || 'USD';
                                                        if (currs.length === 1) {
                                                            const curr = currs[0];
                                                            const originalAmount = group.currencyTotals[curr];
                                                            if (curr !== baseCurr) {
                                                                return (
                                                                    <span>
                                                                        {formatDocCurrency(originalAmount, curr)}
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b', marginLeft: '6px' }}>
                                                                            ({formatDocCurrency(group.balanceAmount, baseCurr)})
                                                                        </span>
                                                                    </span>
                                                                );
                                                            }
                                                        } else if (currs.length > 1) {
                                                            return (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    {currs.map(curr => (
                                                                        <span key={curr} style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                                            {formatDocCurrency(group.currencyTotals[curr], curr)}
                                                                        </span>
                                                                    ))}
                                                                    <span style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '2px', marginTop: '2px' }}>
                                                                        Total: {formatDocCurrency(group.balanceAmount, baseCurr)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
                                                        return <span>{formatCurrency(group.balanceAmount)}</span>;
                                                    })()}
                                                    {group.totalReturnAmount > 0 && (
                                                        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                            Return Impact: -{formatCurrency(group.totalReturnAmount)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                {(() => {
                                                    let statusVal = 'Combined';
                                                    if (group.isSingle) {
                                                        statusVal = group.invoices[0].status;
                                                    } else if (group.balanceAmount === 0) {
                                                        if (group.totalReturnAmount > 0) {
                                                            const allReturned = group.invoices.every(inv => inv.status.toLowerCase().includes('returned') && !inv.status.toLowerCase().includes('partial'));
                                                            statusVal = allReturned ? 'Returned' : 'Partially Returned';
                                                        } else {
                                                            statusVal = 'Fully Paid';
                                                        }
                                                    }
                                                    if (group.isSingle) {
                                                        const singleInv = group.invoices[0];
                                                        return (
                                                            <select
                                                                value={singleInv.manualStatus ? singleInv.status : 'AUTO'}
                                                                onChange={(e) => handleStatusChange(singleInv.id, singleInv.type === 'POS_INVOICE', e.target.value)}
                                                                className="Invoice-invoice-status-pill"
                                                                style={getStatusStyle(singleInv.manualStatus ? singleInv.status : 'AUTO')}
                                                            >
                                                                <option value="AUTO">Auto ({singleInv.status})</option>
                                                                <option value="UNPAID">UNPAID</option>
                                                                <option value="PARTIAL">PARTIAL</option>
                                                                <option value="PAID">PAID</option>
                                                                <option value="CANCELLED">CANCELLED</option>
                                                            </select>
                                                        );
                                                    }
                                                    return (
                                                        <span className={`Invoice-invoice-status-pill ${getStatusClass(statusVal)}`}>
                                                            {statusVal}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="text-right">
                                                <div className="Invoice-invoice-action-buttons text-nowrap">
                                                    {!group.isSingle ? (
                                                        <button
                                                            className="Invoice-btn-combined-view"
                                                            onClick={() => handleCombinedView(group)}
                                                            style={{
                                                                background: '#f59e0b',
                                                                color: 'white',
                                                                padding: '6px 16px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '700',
                                                                border: 'none',
                                                                cursor: 'pointer',

                                                                boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)'
                                                            }}
                                                        >
                                                            View
                                                        </button>
                                                    ) : (
                                                        <button className="Invoice-invoice-action-btn Invoice-view" onClick={() => handleView(group.invoices[0])}><Eye size={16} /></button>
                                                    )}
                                                    {group.isSingle && (
                                                        <>
                                                            {group.invoices[0].type !== 'POS_INVOICE' && group.invoices[0].balanceAmount > 0 && hasPermission('create sales payment') && (
                                                                <button
                                                                    className="Invoice-invoice-action-btn Invoice-payment"
                                                                    onClick={() => navigate('/company/sales/payment', { state: { targetInvoiceId: group.invoices[0].id, customerId: group.invoices[0].customerId } })}
                                                                    title="Receive Payment"
                                                                    style={{ color: '#10b981' }}
                                                                >
                                                                    <CreditCard size={16} />
                                                                </button>
                                                            )}
                                                            {group.invoices[0].type === 'POS_INVOICE' && group.invoices[0].balanceAmount > 0 && hasPermission('create sales payment') && (
                                                                <button
                                                                    className="Invoice-invoice-action-btn Invoice-payment"
                                                                    onClick={() => navigate('/company/sales/payment', { state: { targetInvoiceId: group.invoices[0].id, invoiceType: 'POS_INVOICE', customerId: group.invoices[0].customerId } })}
                                                                    title="Receive Payment"
                                                                    style={{ color: '#10b981' }}
                                                                >
                                                                    <CreditCard size={16} />
                                                                </button>
                                                            )}
                                                            {group.invoices[0].type !== 'POS_INVOICE' && hasPermission('edit sales invoice') && (
                                                                <button className="Invoice-invoice-action-btn Invoice-edit" onClick={() => handleEdit(group.invoices[0])}><Pencil size={16} /></button>
                                                            )}
                                                            {hasPermission('delete sales invoice') && (
                                                                <button className="Invoice-invoice-action-btn Invoice-delete" onClick={() => handleDelete(group.invoices[0])}><Trash2 size={16} /></button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* EXPANDED CONTENT */}
                                        {group.isGroup && expandedGroups[group.id] && (
                                            <tr>
                                                <td colSpan="8" className="Invoice-expanded-cell">
                                                    <div className="Invoice-expanded-content">

                                                        {/* SUB-TABLE */}
                                                        <div className="Invoice-sub-table-wrapper">
                                                            <table className="Invoice-sub-table-dropdown">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Type</th>
                                                                        <th>Doc #</th>
                                                                        <th>Date</th>
                                                                        <th>Total</th>
                                                                        <th>Due</th>
                                                                        <th>Status</th>
                                                                        <th className="text-right">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.invoices.map(si => {
                                                                        const subRate = getSyncRate(si.currency || 'USD', companySettings?.currency || 'INR');
                                                                        return (
                                                                            <tr key={`si-${si.id}-${si.type}`}>
                                                                                <td>
                                                                                    <span style={{
                                                                                        fontSize: '10px',
                                                                                        padding: '2px 8px',
                                                                                        borderRadius: '4px',
                                                                                        background: si.type === 'POS_INVOICE' ? '#f0fdf4' : '#eff6ff',
                                                                                        color: si.type === 'POS_INVOICE' ? '#16a34a' : '#2563eb',
                                                                                        fontWeight: '800',
                                                                                        border: `1px solid ${si.type === 'POS_INVOICE' ? '#bbf7d0' : '#bfdbfe'}`
                                                                                    }}>
                                                                                        {si.type === 'POS_INVOICE' ? 'POS' : 'INVOICE'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="font-bold">{si.invoiceNumber}</td>
                                                                                <td>{new Date(si.date).toLocaleDateString()}</td>
                                                                                <td>
                                                                                    {formatDocCurrency(si.totalAmount, si.currency)}
                                                                                    {si.currency && si.currency !== (companySettings?.currency || 'INR') && (
                                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>
                                                                                            ({formatDocCurrency(si.totalAmount * subRate, companySettings?.currency || 'INR')})
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                                <td className="font-bold">
                                                                                    {formatDocCurrency(si.balanceAmount, si.currency)}
                                                                                    {si.currency && si.currency !== (companySettings?.currency || 'INR') && (
                                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>
                                                                                            ({formatDocCurrency(si.balanceAmount * subRate, companySettings?.currency || 'INR')})
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                                <td>
                                                                                    <select
                                                                                        value={si.manualStatus ? si.status : 'AUTO'}
                                                                                        onChange={(e) => handleStatusChange(si.id, si.type === 'POS_INVOICE', e.target.value)}
                                                                                        className="Invoice-invoice-status-pill"
                                                                                        style={getStatusStyle(si.manualStatus ? si.status : 'AUTO')}
                                                                                    >
                                                                                        <option value="AUTO">Auto ({si.status})</option>
                                                                                        <option value="UNPAID">UNPAID</option>
                                                                                        <option value="PARTIAL">PARTIAL</option>
                                                                                        <option value="PAID">PAID</option>
                                                                                        <option value="CANCELLED">CANCELLED</option>
                                                                                    </select>
                                                                                </td>
                                                                                <td className="text-right">
                                                                                    <div className="Invoice-invoice-action-buttons">
                                                                                        <button className="Invoice-invoice-action-btn Invoice-view" onClick={() => handleView(si)}><Eye size={14} /></button>
                                                                                        {si.type === 'POS_INVOICE' ? (
                                                                                            <>
                                                                                                {si.balanceAmount > 0 && hasPermission('create sales payment') && (
                                                                                                    <button
                                                                                                        className="Invoice-invoice-action-btn Invoice-payment"
                                                                                                        onClick={() => navigate('/company/sales/payment', { state: { targetInvoiceId: si.id, invoiceType: 'POS_INVOICE', customerId: si.customerId } })}
                                                                                                        title="Receive Payment"
                                                                                                        style={{ color: '#10b981' }}
                                                                                                    >
                                                                                                        <CreditCard size={14} />
                                                                                                    </button>
                                                                                                )}
                                                                                                {hasPermission('delete sales invoice') && (
                                                                                                    <button className="Invoice-invoice-action-btn Invoice-delete" onClick={() => handleDelete(si)}><Trash2 size={14} /></button>
                                                                                                )}
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                {si.balanceAmount > 0 && hasPermission('create sales payment') && (
                                                                                                    <button
                                                                                                        className="Invoice-invoice-action-btn Invoice-payment"
                                                                                                        onClick={() => navigate('/company/sales/payment', { state: { targetInvoiceId: si.id, customerId: si.customerId } })}
                                                                                                        title="Receive Payment"
                                                                                                        style={{ color: '#10b981' }}
                                                                                                    >
                                                                                                        <CreditCard size={14} />
                                                                                                    </button>
                                                                                                )}
                                                                                                {hasPermission('edit sales invoice') && (
                                                                                                    <button className="Invoice-invoice-action-btn Invoice-edit" onClick={() => handleEdit(si)}><Pencil size={14} /></button>
                                                                                                )}
                                                                                                {hasPermission('delete sales invoice') && (
                                                                                                    <button className="Invoice-invoice-action-btn Invoice-delete" onClick={() => handleDelete(si)}><Trash2 size={14} /></button>
                                                                                                )}
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    {group.returns.map(sr => (
                                                                        <tr key={`sr-${sr.id}`} style={{ background: '#fff1f2' }}>
                                                                            <td className="font-bold text-red-500">RETURN</td>
                                                                            <td className="font-bold">{sr.returnNumber}</td>
                                                                            <td>{new Date(sr.date).toLocaleDateString()}</td>
                                                                            <td className="text-red-600 font-bold">-{formatCurrency(sr.totalAmount)}</td>
                                                                            <td>-</td>
                                                                            <td><span className="Invoice-invoice-status-pill" style={{ background: '#ef4444' }}>Credited</span></td>
                                                                            <td className="text-right">
                                                                                <button className="Invoice-invoice-action-btn Invoice-view" onClick={() => handleView(sr)}><Eye size={14} /></button>
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

            {/* Premium Create Modal */}
            {showAddModal && (
                <div className="Invoice-modal-overlay">
                    <div className="Invoice-modal-content Invoice-invoice-form-modal">
                        <div className="Invoice-modal-header-simple">
                            <div className="Invoice-modal-header-left">
                                {companyDetails.logo && (
                                    <img src={companyDetails.logo} alt="Company Logo" className="Invoice-modal-logo-img" />
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">{editingId ? 'Edit Invoice' : 'New Invoice'}</h2>
                                    <p className="text-xs text-gray-500">{companyDetails.name} • {companyDetails.phone} • {companyDetails.email}</p>
                                </div>
                            </div>
                            <button className="Invoice-close-btn-simple" onClick={() => { setShowAddModal(false); resetForm(); setEditingId(null); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="Invoice-modal-body-scrollable">
                            {/* Horizontal Metadata Grid */}
                            <div className="Invoice-meta-horizontal-grid">

                                <div className="Invoice-meta-col">
                                    <label>Invoice No. *</label>
                                    <input type="text"
                                        value={invoiceMeta.manualNo}
                                        onChange={(e) => setInvoiceMeta({ ...invoiceMeta, manualNo: e.target.value })}
                                        placeholder="Invoice Number"
                                        disabled={numberingMode === 'auto'}
                                        className="Invoice-compact-input" />
                                </div>

                                <div className="Invoice-meta-col">
                                    <label>Manual No.</label>
                                    <input type="text"
                                        value={manualReference}
                                        onChange={(e) => setManualReference(e.target.value)}
                                        placeholder="e.g. REF-001"
                                        className="Invoice-compact-input" />
                                </div>
                                <div className="Invoice-meta-col">
                                    <label>Salesperson</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <select
                                            value={salespersonId}
                                            onChange={(e) => setSalespersonId(e.target.value)}
                                            className="Invoice-compact-select"
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">-- Select Salesperson --</option>
                                            {salespersonsList.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSalespersonFormData({ name: '', phone: '', email: '' });
                                                setShowAddSalespersonModal(true);
                                            }}
                                            style={{
                                                backgroundColor: '#3b82f6',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: '32px',
                                                width: '32px'
                                            }}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="Invoice-meta-col">
                                    <label>Car Number</label>
                                    <input type="text"
                                        value={carNumber}
                                        onChange={(e) => setCarNumber(e.target.value)}
                                        placeholder="Car/Gaadi No."
                                        className="Invoice-compact-input" />
                                </div>
                                <div className="Invoice-meta-col">
                                    <label>Date</label>
                                    <input type="date"
                                        value={invoiceMeta.date} onChange={(e) => {
                                            const newDate = e.target.value;
                                            const newDueDate = calculateDueDate(newDate, selectedCustomerCreditPeriod);
                                            setInvoiceMeta({ ...invoiceMeta, date: newDate, dueDate: newDueDate });
                                        }}
                                        className="Invoice-compact-input" />
                                </div>
                                <div className="Invoice-meta-col">
                                    <label>Due Date</label>
                                    <input type="date"
                                        value={invoiceMeta.dueDate} onChange={(e) => setInvoiceMeta({ ...invoiceMeta, dueDate: e.target.value })}
                                        className="Invoice-compact-input" />
                                </div>
                                <div className="Invoice-meta-col">
                                    <label>Currency</label>
                                    <select
                                        value={selectedCurrency}
                                        onChange={(e) => handleCurrencyChange(e.target.value)}
                                        className="Invoice-compact-select"
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
                                {selectedCurrency !== (companySettings?.currency || 'USD') && (
                                    <div className="Invoice-meta-col">
                                        <label>Exchange Rate</label>
                                        <input type="number"
                                            step="0.0001"
                                            value={exchangeRate}
                                            onChange={(e) => setExchangeRate(e.target.value)}
                                            className="Invoice-compact-input" />
                                    </div>
                                )}
                                <div className="Invoice-meta-col">
                                    <label>Del. Person Name <span style={{color:'red'}}>*</span></label>
                                    <input type="text" required
                                        value={invoiceMeta.deliveryPersonName || ''}
                                        onChange={(e) => setInvoiceMeta({ ...invoiceMeta, deliveryPersonName: e.target.value })}
                                        placeholder="Enter name"
                                        className="Invoice-compact-input" />
                                </div>
                                <div className="Invoice-meta-col">
                                    <label>Del. Person Mobile <span style={{color:'red'}}>*</span></label>
                                    <input type="text" required
                                        value={invoiceMeta.deliveryPersonMobile || ''}
                                        onChange={(e) => setInvoiceMeta({ ...invoiceMeta, deliveryPersonMobile: e.target.value })}
                                        placeholder="Enter mobile"
                                        className="Invoice-compact-input" />
                                </div>
                                <div className="Invoice-meta-col">
                                    <label>Del. Person Email <span style={{color:'red'}}>*</span></label>
                                    <input type="text" required
                                        value={invoiceMeta.deliveryPersonEmail || ''}
                                        onChange={(e) => setInvoiceMeta({ ...invoiceMeta, deliveryPersonEmail: e.target.value })}
                                        placeholder="Enter email"
                                        className="Invoice-compact-input" />
                                </div>
                            </div>

                            {/* Customer & Address Grid */}
                            <div className="Invoice-address-horizontal-grid">
                                <div className="Invoice-customer-select-col Invoice-address-card">
                                    <div className="Invoice-address-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label className="Invoice-compact-label">Bill To Customer</label>
                                        {creationMode === 'direct' && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAddCustomerModal(true)}
                                                style={{
                                                    backgroundColor: '#22c55e',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '2px 8px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Plus size={12} /> Add Customer
                                            </button>
                                        )}
                                    </div>
                                    <div className="Invoice-address-card-body">
                                        <select className="Invoice-compact-select-large" value={customerId} onChange={async (e) => {
                                            const id = e.target.value;
                                            setCustomerId(id);
                                            if (!id) {
                                                setCustomerShippingAddresses([]);
                                                return;
                                            }

                                            try {
                                                const companyId = GetCompanyId();
                                                const response = await customerService.getById(id, companyId);
                                                if (response.data.success) {
                                                    const c = response.data.data;

                                                    // Create a list of shipping addresses, starting with the primary one if it exists
                                                    const addresses = [];
                                                    if (c.shippingAddress) {
                                                        addresses.push({
                                                            id: -1, // Special ID for primary
                                                            name: c.shippingName || "Primary Address",
                                                            address: c.shippingAddress,
                                                            city: c.shippingCity,
                                                            state: c.shippingState,
                                                            country: c.shippingCountry,
                                                            zipCode: c.shippingZipCode
                                                        });
                                                    }
                                                    // Add alternate addresses from the database
                                                    if (c.shippingaddress && Array.isArray(c.shippingaddress)) {
                                                        addresses.push(...c.shippingaddress);
                                                    }

                                                    setCustomerShippingAddresses(addresses);
                                                    setSelectedCustomerCreditPeriod(c.creditPeriod || 0);
                                                    const newDueDate = calculateDueDate(invoiceMeta.date, c.creditPeriod || 0);
                                                    setInvoiceMeta(prev => ({ ...prev, dueDate: newDueDate }));
                                                    setBillingDetails({
                                                        name: c.billingName || c.name || '',
                                                        address: c.billingAddress || '',
                                                        city: c.billingCity || '',
                                                        state: c.billingState || '',
                                                        zipCode: c.billingZipCode || '',
                                                        country: c.billingCountry || ''
                                                    });
                                                    if (shippingSameAsBilling) {
                                                        setShippingDetails({
                                                            name: c.shippingName || c.name || '',
                                                            address: c.shippingAddress || c.billingAddress || '',
                                                            city: c.shippingCity || c.billingCity || '',
                                                            state: c.shippingState || c.billingState || '',
                                                            zipCode: c.shippingZipCode || c.billingZipCode || '',
                                                            country: c.shippingCountry || c.billingCountry || ''
                                                        });
                                                    }
                                                    await fetchCustomerReceipts(id);
                                                }
                                            } catch (error) {
                                                console.error("Error fetching customer addresses", error);
                                            }
                                        }}>
                                            <option value="">Select Customer...</option>
                                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>

                                        {/* Compact Billing Card */}
                                        {customerId ? (
                                            <div className="Invoice-info-card flex-1">
                                                <div className="Invoice-info-card-header">Billing Details</div>
                                                <div className="Invoice-info-card-body">
                                                    <strong>{billingDetails.name}</strong>
                                                    <p>{billingDetails.address}</p>
                                                    <p>{[billingDetails.city, billingDetails.state, billingDetails.zipCode, billingDetails.country].filter(Boolean).join(', ')}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="Invoice-info-card-placeholder flex-1">
                                                Select a customer to display billing details.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="Invoice-shipping-col Invoice-address-card">
                                    <div className="Invoice-address-card-header">
                                        <label className="Invoice-compact-label">Shipping Details</label>
                                        <label className="Invoice-shipping-checkbox-label">
                                            <input type="checkbox" checked={shippingSameAsBilling} onChange={(e) => {
                                                const checked = e.target.checked;
                                                setShippingSameAsBilling(checked);
                                                if (checked) {
                                                    setShippingDetails({ ...billingDetails });
                                                }
                                            }} />
                                            Same as Billing
                                        </label>
                                    </div>
                                    <div className="Invoice-address-card-body">
                                        {shippingSameAsBilling ? (
                                            <div className="Invoice-info-card Invoice-same-billing-badge flex-1">
                                                <span className="text-green-600 font-semibold flex items-center gap-1">
                                                    ✓ Shipping address is same as billing address
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="Invoice-shipping-inputs-card flex-1">
                                                {customerShippingAddresses.length > 0 && (
                                                    <div className="Invoice-shipping-alt-row mb-2">
                                                        <span className="text-xs text-gray-500 font-bold">Select Alternate Address:</span>
                                                        <select
                                                            className="Invoice-mini-select"
                                                            onChange={(e) => {
                                                                const addrId = e.target.value;
                                                                if (!addrId) return;
                                                                const addr = customerShippingAddresses.find(a => a.id === parseInt(addrId));
                                                                if (addr) {
                                                                    setShippingDetails({
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
                                                            {customerShippingAddresses.map(addr => (
                                                                <option key={addr.id} value={addr.id}>
                                                                    {addr.name} {addr.city ? `- ${addr.city}` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <input type="text" placeholder="Shipping Name" className="Invoice-compact-input mb-1"
                                                    disabled={true} readOnly
                                                    value={shippingDetails.name} />
                                                <textarea placeholder="Shipping Address" className="Invoice-compact-textarea mb-1"
                                                    rows={1}
                                                    value={shippingDetails.address} onChange={(e) => setShippingDetails({ ...shippingDetails, address: e.target.value })} />
                                                <div className="Invoice-compact-inputs-row">
                                                    <input type="text" placeholder="City" className="Invoice-compact-input"
                                                        value={shippingDetails.city} onChange={(e) => setShippingDetails({ ...shippingDetails, city: e.target.value })} />
                                                    <input type="text" placeholder="State" className="Invoice-compact-input"
                                                        value={shippingDetails.state} onChange={(e) => setShippingDetails({ ...shippingDetails, state: e.target.value })} />
                                                    <input type="text" placeholder="Zip" className="Invoice-compact-input"
                                                        value={shippingDetails.zipCode} onChange={(e) => setShippingDetails({ ...shippingDetails, zipCode: e.target.value })} />
                                                    <input type="text" placeholder="Country" className="Invoice-compact-input"
                                                        value={shippingDetails.country} onChange={(e) => setShippingDetails({ ...shippingDetails, country: e.target.value })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Custom Fields Section */}
                            {getCustomFieldsForType('invoice').length > 0 && (
                                <div className="Invoice-custom-fields-section-compact">
                                    <h4 className="Invoice-compact-section-header">Custom Fields</h4>
                                    <div className="Invoice-custom-fields-grid-compact">
                                        {getCustomFieldsForType('invoice').map(field => (
                                            <div key={field.id} className="flex flex-col gap-0.5">
                                                <label className="Invoice-mini-label">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                {field.type === 'select' ? (
                                                    <select
                                                        value={customFieldValues[field.label] || ''}
                                                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                                                        className="Invoice-compact-select"
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
                                                        className="Invoice-compact-input"
                                                        required={field.required}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Items Table */}
                            <div className="Invoice-items-section-compact">
                                <div className="Invoice-items-header-compact">
                                    <h4 className="Invoice-compact-section-header m-0">Line Items</h4>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="Invoice-btn-add-row-compact" onClick={addItem}>
                                            <Plus size={12} /> Add Line Item
                                        </button>
                                        <button
                                            type="button"
                                            className="Invoice-btn-add-row-compact"
                                            onClick={() => {
                                                setProductWarehouseRows(allWarehouses.map(wh => ({
                                                    id: wh.id,
                                                    warehouseId: wh.id,
                                                    quantity: 0,
                                                    minOrderQty: 0,
                                                    initialQty: 0
                                                })));
                                                setShowAddProductModal(true);
                                            }}
                                            style={{
                                                backgroundColor: '#22c55e',
                                                borderColor: '#22c55e',
                                                color: '#ffffff'
                                            }}
                                        >
                                            <Plus size={12} /> Add Product
                                        </button>
                                    </div>
                                </div>
                                <div className="Invoice-table-responsive-compact">
                                    <table className="Invoice-compact-items-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '20%' }}>{getTableHeader('item', 'ITEM DETAIL').toUpperCase()}</th>
                                                {getInvoiceLabel('showWarehouse') !== false && <th style={{ width: '13%' }}>{getTableHeader('warehouse', 'WAREHOUSE').toUpperCase()}</th>}
                                                {getInvoiceLabel('showQty') !== false && <th style={{ width: '7%' }}>{getTableHeader('quantity', 'QTY').toUpperCase()}</th>}
                                                {getInvoiceLabel('showUom') !== false && <th style={{ width: '7%' }}>{getTableHeader('uom', 'UOM').toUpperCase()}</th>}
                                                {getInvoiceLabel('showRate') !== false && <th style={{ width: '7%' }}>{getTableHeader('rate', 'RATE').toUpperCase()}</th>}
                                                {getInvoiceLabel('showTax') !== false && <th style={{ width: '7%' }}>{getTableHeader('tax', 'TAX %').toUpperCase()}</th>}
                                                {getInvoiceLabel('showDiscount') !== false && <th style={{ width: '7%' }}>{getTableHeader('discount', 'DISC.').toUpperCase()}</th>}
                                                <th style={{ width: '11%' }}>{getTableHeader('price', 'AMOUNT').toUpperCase()}</th>
                                                <th style={{ width: '4%' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map(item => (
                                                <tr key={item.id}>
                                                    <td>
                                                        <select className="Invoice-compact-select"
                                                            value={item.productId ? `p-${item.productId}` : item.serviceId ? `s-${item.serviceId}` : ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val.startsWith('p-')) {
                                                                    const pId = val.split('-')[1];
                                                                    const p = allProducts.find(x => x.id === parseInt(pId));
                                                                    if (p) {
                                                                        let autoWarehouseId = item.warehouseId || '';
                                                                        if (!autoWarehouseId && p.stock && p.stock.length > 0) {
                                                                            const bestStock = p.stock
                                                                                .filter(s => s.quantity > 0)
                                                                                .sort((a, b) => b.quantity - a.quantity)[0];
                                                                            if (bestStock) {
                                                                                autoWarehouseId = String(bestStock.warehouseId);
                                                                            } else if (p.stock[0]) {
                                                                                autoWarehouseId = String(p.stock[0].warehouseId);
                                                                            }
                                                                        }
                                                                        const conversionRate = getSyncRate(selectedCurrency, companySettings?.currency || 'INR') || 1.0;
                                                                        const convertedPrice = p.salePrice ? (p.salePrice / conversionRate) : 0;
                                                                        updateItem(item.id, {
                                                                            productId: pId,
                                                                            serviceId: '',
                                                                            uomId: p.salesUomId || p.uomId || '',
                                                                            rate: Number(convertedPrice.toFixed(2)) || 0,
                                                                            tax: p.taxRate || 0,
                                                                            description: item.description || p.name,
                                                                            warehouseId: autoWarehouseId
                                                                        });
                                                                    }
                                                                } else if (val.startsWith('s-')) {
                                                                    const sId = val.split('-')[1];
                                                                    const s = allServices.find(x => x.id === parseInt(sId));
                                                                    if (s) {
                                                                        const conversionRate = getSyncRate(selectedCurrency, companySettings?.currency || 'INR') || 1.0;
                                                                        const convertedPrice = s.price ? (s.price / conversionRate) : 0;
                                                                        updateItem(item.id, {
                                                                            serviceId: sId,
                                                                            productId: '',
                                                                            rate: Number(convertedPrice.toFixed(2)) || 0,
                                                                            tax: s.taxRate || 0,
                                                                            description: item.description || s.name
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
                                                            <select
                                                                className="Invoice-compact-select"
                                                                value={item.warehouseId}
                                                                disabled={!!selectedChallan}
                                                                onChange={(e) => updateItem(item.id, 'warehouseId', e.target.value)}
                                                            >
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
                                                            <input type="number" className="Invoice-compact-input text-center" value={item.qty}
                                                                min="0"
                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                onChange={(e) => updateItem(item.id, 'qty', e.target.value.replace(/-/g, ''))} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showUom') !== false && (
                                                        <td>
                                                            {item.productId ? (
                                                                <select className="Invoice-compact-select" value={item.uomId}
                                                                    disabled
                                                                    onChange={(e) => updateItem(item.id, 'uomId', e.target.value)}>
                                                                    <option value="">Select UOM...</option>
                                                                    {allUoms
                                                                        .filter(u => {
                                                                            const prod = allProducts.find(p => p.id === (String(item.productId).startsWith('p-') ? parseInt(String(item.productId).replace('p-', '')) : parseInt(item.productId)));
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
                                                            <input type="number" className="Invoice-compact-input text-right" value={item.rate}
                                                                min="0"
                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                onChange={(e) => updateItem(item.id, 'rate', e.target.value.replace(/-/g, ''))} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showTax') !== false && (
                                                        <td>
                                                            <input type="number" className="Invoice-compact-input text-center" value={item.tax}
                                                                min="0"
                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                onChange={(e) => updateItem(item.id, 'tax', e.target.value.replace(/-/g, ''))} />
                                                        </td>
                                                    )}
                                                    {getInvoiceLabel('showDiscount') !== false && (
                                                        <td>
                                                            <input type="number" className="Invoice-compact-input text-right" value={item.discount}
                                                                min="0"
                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                onChange={(e) => updateItem(item.id, 'discount', e.target.value.replace(/-/g, ''))} />
                                                        </td>
                                                    )}
                                                    <td>
                                                        <input type="text" className="Invoice-compact-input Invoice-disabled text-right" value={formatDocCurrency(item.total || 0, selectedCurrency)} readOnly />
                                                    </td>
                                                    <td className="text-center">
                                                        <button className="Invoice-btn-delete-row-compact" onClick={() => removeItem(item.id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Available Customer Advance Adjustments */}
                            {/* {customerId && availableReceipts.length > 0 && (
                                <div className="Invoice-advance-adjustments-compact">
                                    <h4 className="Invoice-compact-section-header">Adjust Available Credits / Advance Payment</h4>
                                    <div className="Invoice-advance-grid-compact">
                                        {availableReceipts.map(rec => {
                                            const adj = adjustments.find(a => a.receiptId === rec.id);
                                            const adjValue = adj ? adj.amount : '';
                                            const maxAdvance = rec.availableAdvance + (rec.currentAllocAmount || 0);
                                            return (
                                                <div key={rec.id} className="Invoice-advance-row-compact">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-xs text-gray-800">{rec.receiptNumber}</span>
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
                                                                    .filter(a => a.receiptId !== rec.id)
                                                                    .reduce((sum, a) => sum + a.amount, 0);
                                                                const remainingGrandTotal = Math.max(0, totals.finalTotal - otherAdjustedSum);
                                                                finalVal = Math.min(finalVal, remainingGrandTotal);

                                                                setAdjustments(prev => {
                                                                    const existing = prev.find(a => a.receiptId === rec.id);
                                                                    if (existing) {
                                                                        if (finalVal <= 0) {
                                                                            return prev.filter(a => a.receiptId !== rec.id);
                                                                        }
                                                                        return prev.map(a => a.receiptId === rec.id ? { ...a, amount: finalVal } : a);
                                                                    } else {
                                                                        if (finalVal <= 0) return prev;
                                                                        return [...prev, {
                                                                            receiptId: rec.id,
                                                                            receiptNumber: rec.receiptNumber,
                                                                            amount: finalVal
                                                                        }];
                                                                    }
                                                                });
                                                            }}
                                                            className="Invoice-compact-input"
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
                            <div className="Invoice-compact-footer-grid">
                                <div className="Invoice-compact-footer-col">
                                    <h4 className="Invoice-compact-section-header">Bank Details &amp; Attachments</h4>
                                    <div className="Invoice-compact-bank-details">
                                        <input type="text" className="Invoice-compact-input mb-1" placeholder="Bank Name" value={bankDetails.bankName} onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })} />
                                        <input type="text" className="Invoice-compact-input mb-1" placeholder="Account No" value={bankDetails.accNo} onChange={(e) => setBankDetails({ ...bankDetails, accNo: e.target.value })} />
                                        <input type="text" className="Invoice-compact-input mb-1" placeholder="Account Holder" value={bankDetails.holderName} onChange={(e) => setBankDetails({ ...bankDetails, holderName: e.target.value })} />
                                        <input type="text" className="Invoice-compact-input" placeholder="IFSC / Swift" value={bankDetails.ifsc} onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value })} />
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
                                            className="Invoice-btn-upload-small-compact flex-1"
                                            onClick={() => photoInputRef.current?.click()}
                                            disabled={uploadingPhotos}
                                        >
                                            <span>📷</span> {uploadingPhotos ? 'Uploading...' : 'Photos'}
                                        </button>
                                        <button
                                            type="button"
                                            className="Invoice-btn-upload-small-compact flex-1"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingFiles}
                                        >
                                            <span>📎</span> {uploadingFiles ? 'Uploading...' : 'Files'}
                                        </button>
                                    </div>
                                    {/* Uploaded attachments list */}
                                    {(selectedPhotos.length > 0 || selectedFiles.length > 0) && (
                                        <div className="Invoice-attachments-list mt-2 flex flex-col gap-1" style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px', background: '#f8fafc' }}>
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

                                <div className="Invoice-compact-footer-col">
                                    <h4 className="Invoice-compact-section-header">Notes &amp; Conditions</h4>
                                    <div className="Invoice-notes-terms-stack">
                                        <div>
                                            <label className="Invoice-mini-label mb-0.5">Notes</label>
                                            <textarea className="Invoice-compact-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter notes..."></textarea>
                                        </div>
                                        <div>
                                            <label className="Invoice-mini-label mb-0.5">Terms &amp; Conditions</label>
                                            <textarea className="Invoice-compact-textarea" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Enter terms & conditions..." />
                                        </div>
                                    </div>
                                </div>

                                <div className="Invoice-compact-totals-box">
                                    <div className="Invoice-compact-totals-top">
                                        <div className="Invoice-compact-t-row">
                                            <span>Sub Total:</span>
                                            <span>{formatDocCurrency(totals.subTotal, selectedCurrency)}</span>
                                        </div>
                                        <div className="Invoice-compact-t-row text-red-500">
                                            <span>Discount:</span>
                                            <span>-{formatDocCurrency(totals.discount, selectedCurrency)}</span>
                                        </div>
                                        <div className="Invoice-compact-t-row">
                                            <span>Tax Total:</span>
                                            <span>{formatDocCurrency(totals.tax, selectedCurrency)}</span>
                                        </div>
                                        <div className="Invoice-compact-t-row Invoice-totals-discount-row">
                                            <div className="Invoice-totals-discount-label-row">
                                                <span>Overall Disc:</span>
                                                <div className="Invoice-compact-discount-input-group">
                                                    <input
                                                        type="number"
                                                        className="Invoice-compact-discount-number-input"
                                                        value={overallDiscount}
                                                        onChange={(e) => setOverallDiscount(e.target.value)}
                                                    />
                                                    <select
                                                        className="Invoice-compact-discount-type-select"
                                                        value={overallDiscountType}
                                                        onChange={(e) => setOverallDiscountType(e.target.value)}
                                                    >
                                                        <option value="percentage">%</option>
                                                        <option value="fixed">Amt</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <span className="text-red-500">-{formatDocCurrency(totals.ovDiscountAmt, selectedCurrency)}</span>
                                        </div>
                                    </div>
                                    <div className="Invoice-compact-t-row Invoice-compact-total font-bold text-gray-800 border-t border-gray-200 pt-1 mt-1 text-sm">
                                        <span>Grand Total:</span>
                                        <span>{formatDocCurrency(totals.finalTotal, selectedCurrency)}</span>
                                    </div>
                                    {adjustments.reduce((sum, a) => sum + a.amount, 0) > 0 && (
                                        <>
                                            <div className="Invoice-compact-t-row text-green-600 font-semibold text-xs py-0.5">
                                                <span>Credits Adjusted:</span>
                                                <span>-{formatDocCurrency(adjustments.reduce((sum, a) => sum + a.amount, 0), selectedCurrency)}</span>
                                            </div>
                                            <div className="Invoice-compact-t-row Invoice-compact-total text-red-600 font-bold border-t border-dashed border-gray-200 pt-1 text-xs">
                                                <span>Balance Due:</span>
                                                <span>{formatDocCurrency(Math.max(0, totals.finalTotal - adjustments.reduce((sum, a) => sum + a.amount, 0)), selectedCurrency)}</span>
                                            </div>
                                        </>
                                    )}
                                    {selectedCurrency !== (companySettings?.currency || 'USD') && (
                                        <div className="Invoice-compact-t-row text-gray-500 font-semibold text-xs border-t border-dashed border-gray-200 pt-1 text-right justify-end gap-1.5">
                                            <span>Base Total:</span>
                                            <span>{formatDocCurrency(totals.finalTotal * (parseFloat(exchangeRate) || 1.0), companySettings?.currency || 'USD')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="Invoice-modal-footer-simple">
                            <button className="Invoice-btn-plain" onClick={() => { setShowAddModal(false); resetForm(); setEditingId(null); }}>Cancel</button>
                            <button className="Invoice-btn-primary-green" onClick={editingId ? handleUpdate : () => handleSave(false)}>
                                {editingId ? 'Update Invoice' : 'Generate Invoice'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDuplicateModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '24px',
                        borderRadius: '12px',
                        width: '400px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        textAlign: 'center',
                        fontFamily: 'inherit'
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: '#fee2e2',
                            color: '#ef4444',
                            marginBottom: '16px'
                        }}>
                            <AlertTriangle size={24} />
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#1f2937' }}>
                            Duplicate Manual Number
                        </h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.5' }}>
                            This is a duplicate manual number. Do you want to change it?
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                            <button
                                onClick={async () => {
                                    setShowDuplicateModal(false);
                                    await handleSave(true, duplicateRefToRetry);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#ffffff',
                                    color: '#374151',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => {
                                    setShowDuplicateModal(false);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                            >
                                No
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddSalespersonModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '20px',
                        borderRadius: '8px',
                        width: '350px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937' }}>Add New Salesperson</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#4b5563', marginBottom: '4px' }}>Name *</label>
                                <input
                                    type="text"
                                    value={salespersonFormData.name}
                                    onChange={(e) => setSalespersonFormData({ ...salespersonFormData, name: e.target.value })}
                                    className="Invoice-compact-input"
                                    style={{ width: '100%' }}
                                    placeholder="Salesperson Name"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#4b5563', marginBottom: '4px' }}>Phone / Number</label>
                                <input
                                    type="text"
                                    value={salespersonFormData.phone}
                                    onChange={(e) => setSalespersonFormData({ ...salespersonFormData, phone: e.target.value })}
                                    className="Invoice-compact-input"
                                    style={{ width: '100%' }}
                                    placeholder="Phone number"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#4b5563', marginBottom: '4px' }}>Email</label>
                                <input
                                    type="email"
                                    value={salespersonFormData.email}
                                    onChange={(e) => setSalespersonFormData({ ...salespersonFormData, email: e.target.value })}
                                    className="Invoice-compact-input"
                                    style={{ width: '100%' }}
                                    placeholder="Email address"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                            <button
                                type="button"
                                onClick={() => setShowAddSalespersonModal(false)}
                                style={{
                                    padding: '6px 12px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    backgroundColor: '#ffffff',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!salespersonFormData.name.trim()) {
                                        toast.error("Name is required");
                                        return;
                                    }
                                    try {
                                        const companyId = GetCompanyId();
                                        const res = await salespersonService.create({
                                            ...salespersonFormData,
                                            companyId: parseInt(companyId)
                                        });
                                        if (res.success) {
                                            toast.success("Salesperson added successfully");
                                            setSalespersonId(res.data.id);
                                            // Refresh list
                                            const listRes = await salespersonService.getAll(companyId);
                                            if (listRes.success) setSalespersonsList(listRes.data);
                                            setShowAddSalespersonModal(false);
                                        } else {
                                            toast.error(res.message || "Failed to create salesperson");
                                        }
                                    } catch (e) {
                                        toast.error(e.message || "Failed to create salesperson");
                                    }
                                }}
                                style={{
                                    padding: '6px 12px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    cursor: 'pointer'
                                }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Modal */}
            {showSelectionModal && (
                <div className="Invoice-modal-overlay">
                    <div className="Invoice-modal-content Invoice-selection-modal-small">
                        <div className="Invoice-modal-header-simple">
                            <h2 className="text-xl font-bold">Select Invoice Source</h2>
                            <button className="Invoice-close-btn-simple" onClick={() => setShowSelectionModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="Invoice-selection-grid-p">
                            <button className="Invoice-sel-btn-p" onClick={() => { setCreationMode('direct'); setShowSelectionModal(false); setShowAddModal(true); }}>
                                <div className="Invoice-sel-icon-p"><FileText /></div>
                                <div className="Invoice-sel-text-p">
                                    <strong>Direct Invoice</strong>
                                    <span>Create manually without link</span>
                                </div>
                            </button>
                            <button className="Invoice-sel-btn-p" onClick={() => setCreationMode('select_so')}>
                                <div className="Invoice-sel-icon-p"><ShoppingCart /></div>
                                <div className="Invoice-sel-text-p">
                                    <strong>From Sales Order</strong>
                                    <span>Fetch data from existing order</span>
                                </div>
                            </button>
                            <button className="Invoice-sel-btn-p" onClick={() => setCreationMode('select_dc')}>
                                <div className="Invoice-sel-icon-p"><Truck /></div>
                                <div className="Invoice-sel-text-p">
                                    <strong>From Delivery Challan</strong>
                                    <span>Fetch data from delivery note</span>
                                </div>
                            </button>
                        </div>

                        {creationMode === 'select_so' && (
                            <div className="Invoice-source-list-container">
                                <h3 className="Invoice-section-title-s">Pick a Sales Order</h3>
                                <div className="Invoice-source-search-box flex gap-3 mb-4">
                                    <div className="Invoice-form-group-mini" style={{ flex: 1 }}>
                                        <select
                                            className="Invoice-full-width-input"
                                            value={invoiceFilterCustomerId}
                                            onChange={(e) => setInvoiceFilterCustomerId(e.target.value)}
                                        >
                                            <option value="">Select Customer First...</option>
                                            {customers.map(c => {
                                                const orderCount = activeOrders.filter(o => o.customerId === c.id).length;
                                                return (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} ({orderCount} Orders)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className="Invoice-source-search-inner" style={{ flex: 1 }}>
                                        <Search size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search Sales Order #..."
                                            value={sourceSearchTerm}
                                            onChange={(e) => setSourceSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="Invoice-source-items-list">
                                    {activeOrders.filter(order => {
                                        const matchesSearch = order.orderNumber?.toLowerCase().includes(sourceSearchTerm.toLowerCase()) ||
                                            order.customer?.name?.toLowerCase().includes(sourceSearchTerm.toLowerCase());
                                        const matchesCustomer = !invoiceFilterCustomerId || order.customerId === parseInt(invoiceFilterCustomerId);
                                        return matchesSearch && matchesCustomer;
                                    }).map(order => (
                                        <div key={order.id} className="Invoice-source-item-row" onClick={() => { handleSelectOrder(order); setShowAddModal(true); setSourceSearchTerm(''); }}>
                                            <div className="Invoice-source-info">
                                                <span className="Invoice-source-id">{order.orderNumber}</span>
                                                <span className="Invoice-source-cust">{order.customer?.name}</span>
                                            </div>
                                            <div className="Invoice-source-meta">
                                                <span>{new Date(order.date).toLocaleDateString()}</span>
                                                <ArrowRight size={14} />
                                            </div>
                                        </div>
                                    ))}
                                    {activeOrders.filter(order =>
                                        order.orderNumber?.toLowerCase().includes(sourceSearchTerm.toLowerCase()) ||
                                        order.customer?.name?.toLowerCase().includes(sourceSearchTerm.toLowerCase())
                                    ).length === 0 && <div className="Invoice-no-source-found">No orders found</div>}
                                </div>
                                <button className="Invoice-btn-back-sel" onClick={() => { setCreationMode('direct'); setSourceSearchTerm(''); }}>Back</button>
                            </div>
                        )}

                        {creationMode === 'select_dc' && (
                            <div className="Invoice-source-list-container">
                                <h3 className="Invoice-section-title-s">Pick a Delivery Challan</h3>
                                <div className="Invoice-source-search-box flex gap-3 mb-4">
                                    <div className="Invoice-form-group-mini" style={{ flex: 1 }}>
                                        <select
                                            className="Invoice-full-width-input"
                                            value={invoiceFilterCustomerId}
                                            onChange={(e) => setInvoiceFilterCustomerId(e.target.value)}
                                        >
                                            <option value="">Select Customer First...</option>
                                            {customers.map(c => {
                                                const dcCount = activeChallans.filter(dc => dc.customerId === c.id).length;
                                                return (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} ({dcCount} Challans)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className="Invoice-source-search-inner" style={{ flex: 1 }}>
                                        <Search size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search Challan #..."
                                            value={sourceSearchTerm}
                                            onChange={(e) => setSourceSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="Invoice-source-items-list">
                                    {activeChallans.filter(dc => {
                                        const matchesSearch = dc.challanNumber?.toLowerCase().includes(sourceSearchTerm.toLowerCase()) ||
                                            dc.customer?.name?.toLowerCase().includes(sourceSearchTerm.toLowerCase());
                                        const matchesCustomer = !invoiceFilterCustomerId || dc.customerId === parseInt(invoiceFilterCustomerId);
                                        return matchesSearch && matchesCustomer;
                                    }).map(dc => (
                                        <div key={dc.id} className="Invoice-source-item-row" onClick={() => { handleSelectChallan(dc); setShowAddModal(true); setSourceSearchTerm(''); }}>
                                            <div className="Invoice-source-info">
                                                <span className="Invoice-source-id">{dc.challanNumber}</span>
                                                <span className="Invoice-source-cust">{dc.customer?.name}</span>
                                            </div>
                                            <div className="Invoice-source-meta">
                                                <span>{new Date(dc.date).toLocaleDateString()}</span>
                                                <ArrowRight size={14} />
                                            </div>
                                        </div>
                                    ))}
                                    {activeChallans.filter(dc =>
                                        dc.challanNumber?.toLowerCase().includes(sourceSearchTerm.toLowerCase()) ||
                                        dc.customer?.name?.toLowerCase().includes(sourceSearchTerm.toLowerCase())
                                    ).length === 0 && <div className="Invoice-no-source-found">No challans found</div>}
                                </div>
                                <button className="Invoice-btn-back-sel" onClick={() => { setCreationMode('direct'); setSourceSearchTerm(''); }}>Back</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="InvDelete-modal-overlay">
                    <div className="InvDelete-modal-content">
                        <div className="InvDelete-modal-header">
                            <h2>Delete Invoice</h2>
                            <button className="InvDelete-close-btn" onClick={() => setShowDeleteModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="InvDelete-modal-body">
                            <div className="InvDelete-icon-box">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="InvDelete-title">Are you sure?</h3>
                            <p className="InvDelete-desc">You are about to permanently delete invoice</p>
                            <div className="InvDelete-invoice-no">#{invoiceToDelete?.invoiceNumber}</div>
                            <p className="InvDelete-desc" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                This action cannot be undone and will affect your ledger balances.
                            </p>
                        </div>
                        <div className="InvDelete-modal-footer">
                            <button className="InvDelete-btn-cancel" onClick={() => setShowDeleteModal(false)}>
                                Cancel
                            </button>
                            <button className="InvDelete-btn-confirm" onClick={confirmDelete}>
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Collect Payment Modal */}
            {showPaymentModal && selectedInvoice && (
                <div className="POSINV-payment-overlay">
                    <div className="POSINV-payment-modal">
                        <div className="POSINV-payment-header">
                            <h2 className="POSINV-payment-title">Collect Payment - {selectedInvoice.invoiceNumber}</h2>
                            <button className="POSINV-payment-close" onClick={() => setShowPaymentModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="POSINV-payment-body">
                            <div className="POSINV-payment-info-box">
                                <span className="POSINV-payment-info-label">Outstanding Balance:</span>
                                <span className="POSINV-payment-info-value">{formatCurrency(selectedInvoice.balanceAmount)}</span>
                            </div>

                            <div className="POSINV-payment-field">
                                <label>Amount to Collect</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="POSINV-payment-input"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="Enter amount"
                                />
                            </div>

                            <div className="POSINV-payment-field">
                                <label>Payment Mode</label>
                                <select
                                    className="POSINV-payment-select"
                                    value={paymentMode}
                                    onChange={(e) => {
                                        setPaymentMode(e.target.value);
                                        const modeName = e.target.value === 'CASH' ? 'cash' : 'bank';
                                        const matched = accounts.find(a => a.name.toLowerCase().includes(modeName));
                                        if (matched) setSelectedAccountId(matched.id.toString());
                                    }}
                                >
                                    <option value="CASH">Cash</option>
                                    <option value="BANK">Bank Transfer</option>
                                    <option value="CARD">Card Payment</option>
                                    <option value="UPI">UPI</option>
                                    <option value="CHEQUE">Cheque</option>
                                </select>
                            </div>

                            <div className="POSINV-payment-field">
                                <label>Received Into (Account)</label>
                                <select
                                    className="POSINV-payment-select"
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                >
                                    <option value="">Select Account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id.toString()}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="POSINV-payment-field">
                                <label>Payment Date</label>
                                <input
                                    type="date"
                                    className="POSINV-payment-input"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                />
                            </div>

                            <div className="POSINV-payment-field">
                                <label>Notes</label>
                                <textarea
                                    className="POSINV-payment-input"
                                    rows={2}
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="Add any payment notes..."
                                />
                            </div>
                        </div>
                        <div className="POSINV-payment-footer">
                            <button className="POSINV-payment-btn-cancel" onClick={() => setShowPaymentModal(false)} disabled={paymentSubmitting}>
                                Cancel
                            </button>
                            <button className="POSINV-payment-btn-submit" onClick={handleConfirmPayment} disabled={paymentSubmitting}>
                                {paymentSubmitting ? 'Recording...' : 'Record Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Full Add Customer Modal */}
            {showAddCustomerModal && (
                <div className="Customers-modal-overlay" style={{ zIndex: 20000 }}>
                    <div className="Customers-modal-content Customers-modal-large" style={{ textAlign: 'left' }}>
                        <div className="Customers-modal-header">
                            <h2 className="Customers-modal-title">Add Customer</h2>
                            <button className="Customers-close-btn" onClick={() => setShowAddCustomerModal(false)}>×</button>
                        </div>

                        <div className="Customers-modal-body">
                            {/* Basic Information */}
                            <div className="Customers-form-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                                <h3 className="Customers-section-subtitle">Basic Information</h3>
                                <div className="Customers-form-row Customers-mixed-col">
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Name (English) <span className="Customers-text-red">*</span></label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="name"
                                            value={customerFormData.name}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter Name"
                                            required
                                        />
                                    </div>
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Name (Arabic)</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="nameArabic"
                                            value={customerFormData.nameArabic}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter Name (Arabic)"
                                        />
                                    </div>
                                </div>

                                <div className="Customers-form-row Customers-mixed-col">
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Company Name</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="companyName"
                                            value={customerFormData.companyName}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter company name"
                                        />
                                    </div>
                                    <div className="Customers-form-group Customers-google-loc">
                                        <label className="Customers-form-label">Company Google Location</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="companyLocation"
                                            value={customerFormData.companyLocation}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter Google Maps link"
                                        />
                                    </div>
                                </div>

                                {/* File Uploads */}
                                <div className="Customers-form-row Customers-mixed-col">
                                    <div className="Customers-form-group Customers-profile-img">
                                        <label className="Customers-form-label">Profile Image</label>
                                        {customerFormData.profileImage ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <img
                                                    src={customerFormData.profileImage}
                                                    alt="Profile"
                                                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setCustomerFormData(prev => ({ ...prev, profileImage: '' }))}
                                                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                >
                                                    x Remove
                                                </button>
                                            </div>
                                        ) : null}
                                        <input
                                            type="file"
                                            ref={profileImageRef}
                                            accept="image/jpeg,image/png,image/jpg"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleCustomerFileUpload(e.target.files[0], 'profileImage', 'customers')}
                                        />
                                        <div className="Customers-file-input-wrapper" onClick={() => profileImageRef.current?.click()} style={{ cursor: 'pointer' }}>
                                            <div className="Customers-file-label">
                                                <span className="Customers-file-btn">{uploadingProfileImage ? 'Uploading...' : 'Choose File'}</span>
                                                <span className="Customers-file-name">{customerFormData.profileImage ? 'Image uploaded ✓' : 'No file chosen'}</span>
                                            </div>
                                        </div>
                                        <span className="Customers-file-note">JPEG, PNG or JPG (max 5MB)</span>
                                    </div>
                                    <div className="Customers-form-group Customers-any-file">
                                        <label className="Customers-form-label">Any File</label>
                                        {customerFormData.anyFile ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                                <a
                                                    href={customerFormData.anyFile}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline', wordBreak: 'break-all', maxWidth: '200px' }}
                                                >
                                                    View File
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => setCustomerFormData(prev => ({ ...prev, anyFile: '' }))}
                                                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                >
                                                    x Remove
                                                </button>
                                            </div>
                                        ) : null}
                                        <input
                                            type="file"
                                            ref={anyFileRef}
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleCustomerFileUpload(e.target.files[0], 'anyFile', 'customers')}
                                        />
                                        <div className="Customers-file-input-wrapper" onClick={() => anyFileRef.current?.click()} style={{ cursor: 'pointer' }}>
                                            <div className="Customers-file-label">
                                                <span className="Customers-file-btn">{uploadingAnyFile ? 'Uploading...' : 'Choose File'}</span>
                                                <span className="Customers-file-name">{customerFormData.anyFile ? 'File uploaded ✓' : 'No file chosen'}</span>
                                            </div>
                                        </div>
                                        <span className="Customers-file-note">Any file type. Max 10MB</span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Information */}
                            <div className="Customers-form-section">
                                <h3 className="Customers-section-subtitle">Account Information</h3>
                                <div className="Customers-form-row Customers-mixed-col">
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Customer Type <span className="Customers-text-red">*</span></label>
                                        <select
                                            className="Customers-form-select"
                                            name="accountType"
                                            value={customerFormData.accountType || 'Credit'}
                                            onChange={handleCustomerInputChange}
                                        >
                                            <option value="Credit">Credit Customer</option>
                                            <option value="Cash">Cash Customer</option>
                                        </select>
                                    </div>
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Balance Type</label>
                                        <select
                                            className="Customers-form-select"
                                            name="balanceType"
                                            value={customerFormData.balanceType}
                                            onChange={handleCustomerInputChange}
                                        >
                                            <option value="Debit">Debit</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="Customers-form-row Customers-mixed-col">
                                    <div className="Customers-form-group Customers-half-width">
                                        <div className="Customers-input-with-note">
                                            <label className="Customers-form-label">Account Name <span className="Customers-text-red">*</span></label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                value={customerFormData.name}
                                                readOnly
                                                disabled
                                                style={{ backgroundColor: '#f3f4f6' }}
                                            />
                                            <span className="Customers-input-note">This will auto-fill from selection above</span>
                                        </div>
                                    </div>
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Account Balance <span className="Customers-text-red">*</span></label>
                                        <input
                                            type="number"
                                            className="Customers-form-input"
                                            name="accountBalance"
                                            value={customerFormData.accountBalance}
                                            onChange={handleCustomerInputChange}
                                            placeholder="0.00"
                                            min="0"
                                            onKeyDown={(e) => {
                                                if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Creation Date <span className="Customers-text-red">*</span></label>
                                        <input
                                            type="date"
                                            className="Customers-form-input"
                                            name="creationDate"
                                            value={customerFormData.creationDate}
                                            onChange={handleCustomerInputChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="Customers-form-section">
                                <h3 className="Customers-section-subtitle">Bank Details</h3>
                                <div className="Customers-form-row Customers-three-col">
                                    <div className="Customers-form-group">
                                        <label className="Customers-form-label">Bank Account Number</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="bankAccountNumber"
                                            value={customerFormData.bankAccountNumber}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter bank account number"
                                        />
                                    </div>
                                    <div className="Customers-form-group">
                                        <label className="Customers-form-label">Bank IFSC</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="bankIFSC"
                                            value={customerFormData.bankIFSC}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter bank IFSC"
                                        />
                                    </div>
                                    <div className="Customers-form-group">
                                        <label className="Customers-form-label">Bank Name & Branch</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="bankNameBranch"
                                            value={customerFormData.bankNameBranch}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter bank name & branch"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contact & GST */}
                            <div className="Customers-form-section">
                                <h3 className="Customers-section-subtitle">Contact & Status</h3>
                                <div className="Customers-form-row Customers-mixed-col">
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Phone <span className="Customers-text-red">*</span></label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="phone"
                                            value={customerFormData.phone}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter Phone"
                                            required
                                        />
                                    </div>
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Email <span className="Customers-text-red">*</span></label>
                                        <input
                                            type="email"
                                            className="Customers-form-input"
                                            name="email"
                                            value={customerFormData.email}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter Email"
                                            required
                                        />
                                    </div>
                                    <div className="Customers-form-group Customers-half-width">
                                        <label className="Customers-form-label">Credit Period (days)</label>
                                        <input
                                            type="number"
                                            className="Customers-form-input"
                                            name="creditPeriod"
                                            value={customerFormData.creditPeriod}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Enter credit period"
                                        />
                                    </div>
                                </div>

                                <div className="Customers-form-row" style={{ alignItems: 'center' }}>
                                    <label className="Customers-switch" style={{ marginRight: '10px' }}>
                                        <input
                                            type="checkbox"
                                            name="gstEnabled"
                                            checked={customerFormData.gstEnabled}
                                            onChange={handleCustomerInputChange}
                                        />
                                        <span className="Customers-slider Customers-round"></span>
                                    </label>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable GST</span>

                                    {customerFormData.gstEnabled && (
                                        <div className="Customers-form-group" style={{ marginLeft: '2rem', flex: 1 }}>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="gstNumber"
                                                value={customerFormData.gstNumber}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter GSTIN"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Addresses */}
                            <div className="Customers-form-section">
                                <div className="Customers-form-row">
                                    {/* Billing Address */}
                                    <div style={{ flex: 1 }}>
                                        <h3 className="Customers-section-subtitle">Billing Address</h3>
                                        <div className="Customers-form-group">
                                            <label className="Customers-form-label">Name</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="billingName"
                                                value={customerFormData.billingName}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter Name"
                                            />
                                        </div>
                                        <div className="Customers-form-group">
                                            <label className="Customers-form-label">Phone</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="billingPhone"
                                                value={customerFormData.billingPhone}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter Phone"
                                            />
                                        </div>
                                        <div className="Customers-form-group">
                                            <label className="Customers-form-label">Address</label>
                                            <textarea
                                                className="Customers-form-textarea"
                                                name="billingAddress"
                                                value={customerFormData.billingAddress}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter Address"
                                                rows="3"
                                            />
                                        </div>
                                        <div className="Customers-form-row">
                                            <div className="Customers-form-group" style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    className="Customers-form-input"
                                                    name="billingCity"
                                                    value={customerFormData.billingCity}
                                                    onChange={handleCustomerInputChange}
                                                    placeholder="City"
                                                />
                                            </div>
                                            <div className="Customers-form-group" style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    className="Customers-form-input"
                                                    name="billingState"
                                                    value={customerFormData.billingState}
                                                    onChange={handleCustomerInputChange}
                                                    placeholder="State"
                                                />
                                            </div>
                                        </div>
                                        <div className="Customers-form-row">
                                            <div className="Customers-form-group" style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    className="Customers-form-input"
                                                    name="billingCountry"
                                                    value={customerFormData.billingCountry}
                                                    onChange={handleCustomerInputChange}
                                                    placeholder="Country"
                                                />
                                            </div>
                                            <div className="Customers-form-group" style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    className="Customers-form-input"
                                                    name="billingZipCode"
                                                    value={customerFormData.billingZipCode}
                                                    onChange={handleCustomerInputChange}
                                                    placeholder="Zip Code"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Shipping Address */}
                                    <div style={{ flex: 1, paddingLeft: '2rem', borderLeft: '1px solid #edf2f7' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h3 className="Customers-section-subtitle">Shipping Addresses</h3>
                                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        name="shippingSameAsBilling"
                                                        checked={customerFormData.shippingSameAsBilling}
                                                        onChange={handleCustomerInputChange}
                                                        style={{ marginRight: '5px' }}
                                                    />
                                                    Apply Billing to First Shipping
                                                </label>
                                                <button
                                                    type="button"
                                                    className="Customers-voucher-badge text-blue-600 border border-blue-600 bg-white hover:bg-blue-50"
                                                    onClick={addCustomerShippingAddress}
                                                    style={{ padding: '2px 8px', fontSize: '0.8rem', cursor: 'pointer' }}
                                                >
                                                    + Add More
                                                </button>
                                            </div>
                                        </div>

                                        {customerFormData.shippingSameAsBilling && (
                                            <div style={{ marginBottom: '1.5rem', padding: '15px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
                                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0369a1' }}>First Shipping Address (Same as Billing)</h4>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#0c4a6e' }}>
                                                    <strong>Address:</strong> {customerFormData.billingAddress || 'N/A'}<br />
                                                    {customerFormData.billingCity && `${customerFormData.billingCity}, `}{customerFormData.billingState && `${customerFormData.billingState}, `}{customerFormData.billingZipCode}
                                                </p>
                                            </div>
                                        )}

                                        {customerFormData.shippingAddresses.length === 0 && !customerFormData.shippingSameAsBilling && (
                                            <div className="Customers-form-group" style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                                <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#64748b' }}>
                                                    No shipping addresses added.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={addCustomerShippingAddress}
                                                    className="Customers-voucher-badge text-blue-600"
                                                >
                                                    Click here to add one
                                                </button>
                                            </div>
                                        )}

                                        {customerFormData.shippingAddresses.map((addr, index) => (
                                            <div key={index} style={{ marginBottom: '1.5rem', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', position: 'relative' }}>
                                                {customerFormData.shippingAddresses.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCustomerShippingAddress(index)}
                                                        style={{ position: 'absolute', top: '10px', right: '10px', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#475569' }}>Shipping Address #{index + 1}</h4>

                                                <div className="Customers-form-group">
                                                    <label className="Customers-form-label">Name</label>
                                                    <input
                                                        type="text"
                                                        className="Customers-form-input"
                                                        value={addr.name}
                                                        onChange={(e) => handleCustomerShippingAddressChange(index, 'name', e.target.value)}
                                                        placeholder="Enter Name"
                                                    />
                                                </div>
                                                <div className="Customers-form-group">
                                                    <label className="Customers-form-label">Phone</label>
                                                    <input
                                                        type="text"
                                                        className="Customers-form-input"
                                                        value={addr.phone}
                                                        onChange={(e) => handleCustomerShippingAddressChange(index, 'phone', e.target.value)}
                                                        placeholder="Enter Phone"
                                                    />
                                                </div>
                                                <div className="Customers-form-group">
                                                    <label className="Customers-form-label">Address</label>
                                                    <textarea
                                                        className="Customers-form-textarea"
                                                        value={addr.address}
                                                        onChange={(e) => handleCustomerShippingAddressChange(index, 'address', e.target.value)}
                                                        placeholder="Enter Address"
                                                        rows="2"
                                                    />
                                                </div>
                                                <div className="Customers-form-row">
                                                    <div className="Customers-form-group" style={{ flex: 1 }}>
                                                        <input
                                                            type="text"
                                                            className="Customers-form-input"
                                                            value={addr.city}
                                                            onChange={(e) => handleCustomerShippingAddressChange(index, 'city', e.target.value)}
                                                            placeholder="City"
                                                        />
                                                    </div>
                                                    <div className="Customers-form-group" style={{ flex: 1 }}>
                                                        <input
                                                            type="text"
                                                            className="Customers-form-input"
                                                            value={addr.state}
                                                            onChange={(e) => handleCustomerShippingAddressChange(index, 'state', e.target.value)}
                                                            placeholder="State"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="Customers-form-row">
                                                    <div className="Customers-form-group" style={{ flex: 1 }}>
                                                        <input
                                                            type="text"
                                                            className="Customers-form-input"
                                                            value={addr.country}
                                                            onChange={(e) => handleCustomerShippingAddressChange(index, 'country', e.target.value)}
                                                            placeholder="Country"
                                                        />
                                                    </div>
                                                    <div className="Customers-form-group" style={{ flex: 1 }}>
                                                        <input
                                                            type="text"
                                                            className="Customers-form-input"
                                                            value={addr.zipCode}
                                                            onChange={(e) => handleCustomerShippingAddressChange(index, 'zipCode', e.target.value)}
                                                            placeholder="Zip Code"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="Customers-modal-footer">
                            <button type="button" className="Customers-btn-cancel" onClick={() => setShowAddCustomerModal(false)}>Cancel</button>
                            <button type="button" className="Customers-btn-save" onClick={handleCustomerSubmit} disabled={customerSubmitting}>
                                {customerSubmitting ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New Product Modal */}
            {showAddProductModal && (
                <div className="Zirak-Inventory-modal-overlay" style={{ zIndex: 20000 }}>
                    <div className="Zirak-Inventory-modal-content Zirak-Inventory-modal" style={{ textAlign: 'left' }}>
                        <div className="Zirak-Inventory-modal-header">
                            <h2 className="Zirak-Inventory-modal-title">Add Product</h2>
                            <button className="Zirak-Inventory-close-btn" onClick={() => setShowAddProductModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFullProductSubmit}>
                            <div className="Zirak-Inventory-modal-body">
                                <div className="Zirak-Inventory-form-grid">
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Item Name *</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="name"
                                            placeholder="Enter item name"
                                            value={productFormData.name}
                                            onChange={handleProductInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">HSN</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="hsn"
                                            placeholder="Enter HSN code"
                                            value={productFormData.hsn}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Barcode</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="barcode"
                                            placeholder="Enter barcode"
                                            value={productFormData.barcode}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Item Image</label>
                                        <div className="Zirak-Inventory-file-input-wrapper">
                                            <label className="Zirak-Inventory-file-input-label">
                                                {uploadingImage ? (
                                                    <>
                                                        <Loader2 size={16} className="Zirak-Inventory-animate-spin" style={{ display: 'inline-block', marginRight: '6px' }} />
                                                        <span>Uploading...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload size={16} style={{ display: 'inline-block', marginRight: '6px' }} />
                                                        <span>Choose File</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    className="Zirak-Inventory-hidden-file-input"
                                                    onChange={handleProductImageChange}
                                                    accept="image/*"
                                                    disabled={uploadingImage}
                                                />
                                            </label>
                                            <span className="Zirak-Inventory-file-name">
                                                {productFormData.image ? (
                                                    <a href={productFormData.image} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                                                        View Image
                                                    </a>
                                                ) : 'No file chosen'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Item Category (Optional)</label>
                                        <div className="Zirak-Inventory-input-with-action">
                                            <select
                                                name="categoryId" className="Zirak-Inventory-form-input"
                                                value={productFormData.categoryId} onChange={handleProductInputChange}
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                            <button type="button" className="Zirak-Inventory-btn-inline-add" onClick={() => setShowCategoryModal(true)}><Plus size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Base Unit (Tracking Unit)*</label>
                                        <div className="Zirak-Inventory-input-with-action">
                                            <select
                                                name="uomId" className="Zirak-Inventory-form-input"
                                                value={productFormData.uomId} onChange={(e) => {
                                                    const val = e.target.value;
                                                    setProductFormData(prev => ({
                                                        ...prev,
                                                        uomId: val,
                                                        purchaseUomId: val,
                                                        salesUomId: val
                                                    }));
                                                }}
                                                required
                                            >
                                                <option value="">Select Base UOM</option>
                                                {allUoms.filter(u => u.uomType === 'Simple').map(uom => (
                                                    <option key={uom.id} value={uom.id}>{uom.unitName} ({uom.category})</option>
                                                ))}
                                            </select>
                                            <button type="button" className="Zirak-Inventory-btn-inline-add" onClick={() => setShowUomModal(true)}>
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Default Purchase Unit</label>
                                        <select
                                            name="purchaseUomId" className="Zirak-Inventory-form-input"
                                            value={productFormData.purchaseUomId} onChange={handleProductInputChange}
                                            disabled={!productFormData.uomId}
                                        >
                                            <option value="">Select Purchase UOM</option>
                                            {productFormData.uomId && (() => {
                                                const base = allUoms.find(u => u.id === parseInt(productFormData.uomId));
                                                if (!base) return null;
                                                return allUoms.filter(u => u.category === base.category).map(uom => (
                                                    <option key={uom.id} value={uom.id}>{uom.unitName} ({uom.uomType})</option>
                                                ));
                                            })()}
                                        </select>
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Default Sales Unit</label>
                                        <select
                                            name="salesUomId" className="Zirak-Inventory-form-input"
                                            value={productFormData.salesUomId} onChange={handleProductInputChange}
                                            disabled={!productFormData.uomId}
                                        >
                                            <option value="">Select Sales UOM</option>
                                            {productFormData.uomId && (() => {
                                                const base = allUoms.find(u => u.id === parseInt(productFormData.uomId));
                                                if (!base) return null;
                                                return allUoms.filter(u => u.category === base.category).map(uom => (
                                                    <option key={uom.id} value={uom.id}>{uom.unitName} ({uom.uomType})</option>
                                                ));
                                            })()}
                                        </select>
                                    </div>

                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">SKU *</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="sku"
                                            placeholder="Enter SKU"
                                            value={productFormData.sku}
                                            onChange={handleProductInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="Zirak-Inventory-section-title-row">
                                    <h3 className="Zirak-Inventory-section-title">Warehouse Information</h3>
                                    <button type="button" className="Zirak-Inventory-btn-inline-add" onClick={addProductWarehouseRow}>+ Add Warehouse</button>
                                </div>

                                <div className="Zirak-Inventory-warehouse-table-container">
                                    <table className="Zirak-Inventory-warehouse-input-table">
                                        <thead>
                                            <tr>
                                                <th>WAREHOUSE</th>
                                                <th>QUANTITY</th>
                                                <th>MINIMUM ORDER QUANTITY</th>
                                                <th>INITIAL QUANTITY ON HAND</th>
                                                <th>ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productWarehouseRows.map((row) => (
                                                <tr key={row.id}>
                                                    <td>
                                                        <select
                                                            className="Zirak-Inventory-form-input Zirak-Inventory-mini"
                                                            value={row.warehouseId}
                                                            onChange={(e) => handleProductWhRowChange(row.id, 'warehouseId', e.target.value)}
                                                        >
                                                            <option value="">Select Warehouse</option>
                                                            {allWarehouses.map(wh => (
                                                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td><input type="number" className="Zirak-Inventory-form-input Zirak-Inventory-mini" value={row.quantity} onChange={(e) => handleProductWhRowChange(row.id, 'quantity', e.target.value)} /></td>
                                                    <td><input type="number" className="Zirak-Inventory-form-input Zirak-Inventory-mini" value={row.minOrderQty} onChange={(e) => handleProductWhRowChange(row.id, 'minOrderQty', e.target.value)} /></td>
                                                    <td><input type="number" className="Zirak-Inventory-form-input Zirak-Inventory-mini" value={row.initialQty} onChange={(e) => handleProductWhRowChange(row.id, 'initialQty', e.target.value)} /></td>
                                                    <td>
                                                        <button type="button" className="Zirak-Inventory-btn-remove" onClick={() => removeProductWarehouseRow(row.id)}>Remove</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="Zirak-Inventory-form-group Zirak-Inventory-full-width" style={{ marginTop: '1rem' }}>
                                    <label className="Zirak-Inventory-form-label">Item Description</label>
                                    <textarea
                                        name="description" className="Zirak-Inventory-form-input Zirak-Inventory-textarea"
                                        placeholder="Enter item description" rows={3}
                                        value={productFormData.description} onChange={handleProductInputChange}
                                    ></textarea>
                                </div>

                                <div className="Zirak-Inventory-form-grid" style={{ marginTop: '15px' }}>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">As of Date</label>
                                        <input
                                            type="date"
                                            className="Zirak-Inventory-form-input"
                                            name="asOfDate"
                                            value={productFormData.asOfDate}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Tax Account</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="taxAccount"
                                            placeholder="e.g. GST 18%"
                                            value={productFormData.taxAccount}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Initial Cost Price</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="initialCost"
                                            step="0.01"
                                            value={productFormData.initialCost}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Sale Price</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="salePrice"
                                            step="0.01"
                                            value={productFormData.salePrice}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Purchase Price</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="purchasePrice"
                                            step="0.01"
                                            value={productFormData.purchasePrice}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Discount (%)</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="discount"
                                            value={productFormData.discount}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="Zirak-Inventory-form-group" style={{ marginTop: '15px' }}>
                                    <label className="Zirak-Inventory-form-label">Remarks</label>
                                    <textarea
                                        className="Zirak-Inventory-form-textarea"
                                        name="remarks"
                                        placeholder="Enter remarks"
                                        value={productFormData.remarks}
                                        onChange={handleProductInputChange}
                                        rows="2"
                                    />
                                </div>


                            </div>
                            <div className="Zirak-Inventory-modal-footer">
                                <button type="button" className="Zirak-Inventory-btn-cancel" onClick={() => setShowAddProductModal(false)}>Cancel</button>
                                <button type="submit" className="Zirak-Inventory-btn-submit" disabled={uploadingImage}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add New Category Modal */}
            {showCategoryModal && (
                <div className="Zirak-Inventory-modal-overlay Zirak-Inventory-sub-modal" style={{ zIndex: 100000 }}>
                    <div className="Zirak-Inventory-modal-content Zirak-Inventory-category-modal" style={{ textAlign: 'left' }}>
                        <div className="Zirak-Inventory-modal-header">
                            <h2 className="Zirak-Inventory-modal-title">Add New Category</h2>
                            <button className="Zirak-Inventory-close-btn" onClick={() => setShowCategoryModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="Zirak-Inventory-modal-body">
                            <div className="Zirak-Inventory-form-group">
                                <label className="Zirak-Inventory-form-label">Category Name</label>
                                <input
                                    type="text"
                                    className="Zirak-Inventory-form-input"
                                    placeholder="Enter new category name"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="Zirak-Inventory-modal-footer">
                            <button className="Zirak-Inventory-btn-cancel" onClick={() => setShowCategoryModal(false)}>Cancel</button>
                            <button className="Zirak-Inventory-btn-submit" onClick={handleProductAddCategorySubmit}>Add</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New UOM Modal */}
            {showUomModal && (
                <div className="Zirak-UOM-modal-overlay" style={{ zIndex: 100000 }}>
                    <div className="Zirak-UOM-modal" style={{ textAlign: 'left' }}>
                        <div className="Zirak-UOM-modal-header">
                            <h2>Unit Details</h2>
                            <button className="Zirak-UOM-close-btn" onClick={() => setShowUomModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUomSubmit}>
                            <div className="Zirak-UOM-modal-body">
                                <div className="Zirak-UOM-form-group">
                                    <label>Measurement Category*</label>
                                    <input
                                        list="category-suggestions"
                                        name="category"
                                        placeholder="Select or type category"
                                        value={uomFormData.category}
                                        onChange={handleUomInputChange}
                                        required
                                        className="Zirak-UOM-form-input"
                                    />
                                    <datalist id="category-suggestions">
                                        {measurementCategories.map(cat => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="Zirak-UOM-form-group">
                                    <label>UOM Type*</label>
                                    <select
                                        name="uomType"
                                        value={uomFormData.uomType}
                                        onChange={handleUomInputChange}
                                        required
                                        className="Zirak-UOM-form-select"
                                    >
                                        <option value="Simple">Simple (Single Standalone Unit)</option>
                                        <option value="Compound">Compound (Pack of Simple Unit)</option>
                                    </select>
                                </div>
                                <div className="Zirak-UOM-form-group">
                                    <label>Unit of Measurement (UOM)*</label>
                                    <div className="Zirak-UOM-input-with-button">
                                        <input
                                            list="unit-suggestions"
                                            name="unitName"
                                            placeholder="Select or type UOM"
                                            value={uomFormData.unitName}
                                            onChange={handleUomInputChange}
                                            required
                                            className="Zirak-UOM-form-input"
                                        />
                                        <datalist id="unit-suggestions">
                                            {uomFormData.category && unitsByCategory[uomFormData.category] && unitsByCategory[uomFormData.category].map(unit => (
                                                <option key={unit} value={unit} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                                {uomFormData.uomType === 'Compound' && (
                                    <>
                                        <div className="Zirak-UOM-form-group">
                                            <label>Base Unit* (Simple Unit to convert to)</label>
                                            <select
                                                name="baseUnitId"
                                                value={uomFormData.baseUnitId}
                                                onChange={handleUomInputChange}
                                                required
                                                className="Zirak-UOM-form-select"
                                            >
                                                <option value="">-- Select Base Unit --</option>
                                                {getUniqueCategories().map(cat => {
                                                    const unitsInCat = getAvailableBaseUnitsForCategory(cat);
                                                    if (unitsInCat.length === 0) return null;
                                                    return (
                                                        <optgroup key={cat} label={cat}>
                                                            {unitsInCat.map(u => (
                                                                <option key={u.id} value={u.id}>
                                                                    {u.unitName} {u.isStandard ? ' - Standard' : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div className="Zirak-UOM-form-group">
                                            <label>Conversion Rate* (Multiplier)</label>
                                            <div className="UOM-compound-formula-preview">
                                                <span>1 {uomFormData.unitName || 'Compound Unit'} = </span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    name="conversionRate"
                                                    placeholder="Multiplier e.g. 24"
                                                    value={uomFormData.conversionRate}
                                                    onChange={handleUomInputChange}
                                                    required
                                                    min="0.0001"
                                                    style={{ width: '100px', display: 'inline-block', margin: '0 8px', padding: '6px' }}
                                                />
                                                <span> {
                                                    isNaN(uomFormData.baseUnitId)
                                                        ? uomFormData.baseUnitId
                                                        : (allUoms.find(u => u.id === parseInt(uomFormData.baseUnitId))?.unitName || 'Base Unit')
                                                }</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="Zirak-UOM-modal-footer">
                                <button type="button" className="Zirak-UOM-footer-close-btn" onClick={() => setShowUomModal(false)}>Close</button>
                                <button type="submit" className="Zirak-UOM-save-btn">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoice;