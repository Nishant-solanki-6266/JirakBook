import React, { useState, useEffect } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search, Plus, Eye, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Download, Send, Printer,
    Wallet
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './Payment.css';
import salesReceiptService from '../../../../api/salesReceiptService';
import salesInvoiceService from '../../../../api/salesInvoiceService';
import customerService from '../../../../api/customerService';
import ledgerService from '../../../../api/ledgerService';
import companyService from '../../../../api/companyService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import posService from '../../../../services/posService';

const Payment = () => {

    const { hasPermission } = useContext(AuthContext);
    const { companySettings, formatCurrency, getReceiptPaymentLabel, getReceiptPaymentHeader, getDocumentTitle, getSyncRate } = useContext(CompanyContext);
    const [receipts, setReceipts] = useState([]);
    const [customFieldValues, setCustomFieldValues] = useState({});

    const formatDocCurrency = (amount, currencyCode) => {
        const docCurrency = currencyCode || companySettings?.currency || 'INR';
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
    const [invoices, setInvoices] = useState([]);
    const [allLedgers, setAllLedgers] = useState([]); // Store all fetched ledgers
    const [ledgers, setLedgers] = useState([]); // Filtered ledgers for dropdown
    const [loading, setLoading] = useState(true);

    // List Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [showInvoiceSelect, setShowInvoiceSelect] = useState(false);
    const [showCustomerSelect, setShowCustomerSelect] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Edit & Delete State
    const [isEditMode, setIsEditMode] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [currentPayment, setCurrentPayment] = useState(null);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [customerLedgerId, setCustomerLedgerId] = useState(null);
    const [customerName, setCustomerName] = useState('');
    const [receiptNumber, setReceiptNumber] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMode, setPaymentMode] = useState('BANK');
    const [amountReceived, setAmountReceived] = useState(0);
    const [reference, setReference] = useState('');
    const [bankLedgerId, setBankLedgerId] = useState('');
    const [notes, setNotes] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountLedgerId, setDiscountLedgerId] = useState('');
    const [discountLedgers, setDiscountLedgers] = useState([]);
    const [allocations, setAllocations] = useState({}); // Stores { [invoiceId]: allocatedAmount }
    // Tracks invoice type for each invoice in the list: { [invoiceId]: 'TAX_INVOICE' | 'POS_INVOICE' }
    const [invoiceTypeMap, setInvoiceTypeMap] = useState({});

    // Fetch and combine customer invoices
    const customerInvoices = React.useMemo(() => {
        if (!customerId) return [];
        let list = invoices.filter(inv => inv.customerId === customerId);

        // If editing, include any invoices that are already allocated in this receipt
        if (isEditMode && currentPayment?.receiptinvoiceallocation) {
            currentPayment.receiptinvoiceallocation.forEach(alloc => {
                const alreadyInList = list.some(item => item.id === alloc.invoiceId);
                if (!alreadyInList && alloc.invoice) {
                    list.push(alloc.invoice);
                }
            });
        }
        return list;
    }, [invoices, customerId, isEditMode, currentPayment]);

    const getInvoiceAvailableBalance = (invoiceId, baseBalance) => {
        let balance = parseFloat(baseBalance || 0);
        if (isEditMode && currentPayment?.receiptinvoiceallocation) {
            const alloc = currentPayment.receiptinvoiceallocation.find(a => a.invoiceId === invoiceId);
            if (alloc) {
                balance += parseFloat(alloc.amount || 0);
            }
        }
        return balance;
    };

    const totalAllocated = React.useMemo(() => {
        return Object.values(allocations).reduce((sum, val) => sum + parseFloat(val || 0), 0);
    }, [allocations]);

    const remainingAmount = React.useMemo(() => {
        const received = parseFloat(amountReceived || 0);
        const discount = parseFloat(discountAmount || 0);
        return Math.max(0, (received + discount) - totalAllocated);
    }, [amountReceived, discountAmount, totalAllocated]);

    const dueAmount = React.useMemo(() => {
        if (!selectedInvoice) return 0;
        let due = parseFloat(selectedInvoice.balanceAmount || 0);
        if (isEditMode && currentPayment) {
            due += parseFloat(currentPayment.amount || 0) + parseFloat(currentPayment.discountAmount || 0);
        }
        return due;
    }, [selectedInvoice, isEditMode, currentPayment]);

    const location = useLocation();
    const navigate = useNavigate();

    // Initial Fetch
    useEffect(() => {
        fetchData();
        fetchDropdowns();
        fetchCompanyDetails();
    }, []);



    const [companyDetails, setCompanyDetails] = useState({
        name: 'Zirak Books', address: '', email: '', phone: '', logo: null, notes: '', terms: '', termsReceipt: '', showQr: true
    });

    const fetchCompanyDetails = async () => {
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getById(companyId);
                const data = res.data;
                setCompanyDetails({
                    name: data.name || 'Zirak Books',
                    address: data.address || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    logo: data.logo || null,
                    notes: data.notes || '',
                    terms: data.terms || '',
                    termsReceipt: data.termsReceipt || '',
                    showQr: data.showQrCode !== undefined ? data.showQrCode : true
                });
            }
        } catch (error) {
            console.error('Error fetching company details:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            const response = await salesReceiptService.getAll(companyId);
            if (response.data.success) {
                setReceipts(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching receipts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const companyId = GetCompanyId();
            const [invRes, ledgerRes, custRes, posRes] = await Promise.all([
                salesInvoiceService.getAll(companyId),
                ledgerService.getAll(companyId),
                customerService.getAll(companyId),
                posService.getPOSInvoices(companyId).catch(() => null)
            ]);

            // Build type map and combined invoice list
            const typeMap = {};
            const combinedInvoices = [];

            if (invRes.data.success) {
                const taxInvoices = invRes.data.data.filter(inv => inv.balanceAmount > 0);
                taxInvoices.forEach(inv => { typeMap[inv.id] = 'TAX_INVOICE'; });
                combinedInvoices.push(...taxInvoices);
            }

            if (posRes && posRes.success && posRes.data) {
                const posInvoices = (Array.isArray(posRes.data) ? posRes.data : [])
                    .filter(inv => parseFloat(inv.balanceAmount || 0) > 0)
                    .map(inv => ({ ...inv, invoiceType: 'POS_INVOICE' }));
                posInvoices.forEach(inv => { typeMap[inv.id] = 'POS_INVOICE'; });
                combinedInvoices.push(...posInvoices);
            }

            setInvoices(combinedInvoices);
            setInvoiceTypeMap(typeMap);

            if (ledgerRes.data.success) {
                setAllLedgers(ledgerRes.data.data);
                setLedgers(ledgerRes.data.data); // Default show all
            }
            if (custRes.data.success) {
                setCustomers(custRes.data.data);
            }
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    React.useEffect(() => {
        if (allLedgers.length > 0) {
            // Show Cash/Bank accounts (Assets) and Equity accounts
            const filteredLedgers = allLedgers.filter(l =>
                (l.accountgroup?.type === 'ASSETS' &&
                    !l.customerId &&
                    !l.vendorId &&
                    (l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank'))) ||
                l.accountgroup?.type === 'EQUITY'
            );
            setLedgers(filteredLedgers);

            // Filter Direct Expenses for Discount
            const filteredExpenses = allLedgers.filter(l =>
                l.accountgroup?.type === 'EXPENSES' &&
                (l.accountsubgroup?.name?.toLowerCase().includes('direct') ||
                    l.name.toLowerCase().includes('direct') ||
                    l.name.toLowerCase().includes('cost of goods sold') ||
                    l.name.toLowerCase().includes('discount allowed'))
            );
            setDiscountLedgers(filteredExpenses);

            // Auto-select if only one option is available
            if (filteredLedgers.length === 1) {
                setBankLedgerId(filteredLedgers[0].id);
            }
        }
    }, [allLedgers]);

    const filteredReceipts = receipts.filter(rec => {
        const matchesSearch = !searchTerm ||
            rec.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rec.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rec.invoice?.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());

        const dateObj = new Date(rec.date);
        const matchesStart = !startDate || dateObj >= new Date(startDate);
        const matchesEnd = !endDate || dateObj <= new Date(endDate);

        return matchesSearch && matchesStart && matchesEnd;
    });

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const groupedLedgers = React.useMemo(() => {
        return ledgers.reduce((acc, ledger) => {
            const groupName = ledger.accountgroup?.name || 'Other Accounts';
            if (!acc[groupName]) acc[groupName] = [];
            acc[groupName].push(ledger);
            return acc;
        }, {});
    }, [ledgers]);

    const salesProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'completed' },
        { id: 'sales-order', label: 'Sales Order', icon: ShoppingCart, status: 'completed' },
        { id: 'delivery', label: 'Delivery', icon: Truck, status: 'completed' },
        { id: 'invoice', label: 'Invoice', icon: Receipt, status: 'completed' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'active' },
    ];

    const handleSelectCustomer = (cust) => {
        setCustomerId(cust.id);
        setCustomerName(cust.name);
        setCustomerLedgerId(cust.ledgerId);
        setShowCustomerSelect(false);
        setShowInvoiceSelect(true);
    };

    const handleSelectInvoice = (inv) => {
        setSelectedInvoice(inv);
        setCustomerId(inv.customerId);
        setCustomerLedgerId(inv.customer?.ledgerId);
        setCustomerName(inv.customer?.name || '');
        setAmountReceived(inv.balanceAmount);
        setAllocations({ [inv.id]: inv.balanceAmount });
        // Track the invoice type for this selection
        const iType = inv.invoiceType || inv.type || invoiceTypeMap[inv.id] || 'TAX_INVOICE';
        setInvoiceTypeMap(prev => ({ ...prev, [inv.id]: iType }));
        setShowInvoiceSelect(false);
    };

    const resetForm = () => {
        setIsEditMode(false);
        setIsViewMode(false);
        setEditId(null);
        setCurrentPayment(null);
        setSelectedInvoice(null);
        setCustomerId('');
        setCustomerLedgerId(null);
        setCustomerName('');
        setAmountReceived(0);
        setDiscountAmount(0);
        setDiscountLedgerId('');
        setReceiptNumber('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMode('BANK');
        setReference('');
        setBankLedgerId('');
        setNotes(companyDetails.notes || '');
        setAllocations({});
        setInvoiceTypeMap({});
        setCustomFieldValues({});
        setShowInvoiceSelect(false);
        setShowCustomerSelect(false);
        setCustomerSearch('');
    };

    const handleAllocationChange = (invoiceId, value) => {
        setAllocations(prev => {
            const updated = { ...prev };
            if (value === '' || parseFloat(value) === 0) {
                delete updated[invoiceId];
            } else {
                updated[invoiceId] = parseFloat(value) || 0;
            }
            const newTotalAllocated = Object.values(updated).reduce((sum, val) => sum + parseFloat(val || 0), 0);
            const totalLimit = parseFloat(amountReceived || 0) + parseFloat(discountAmount || 0);
            if (newTotalAllocated > totalLimit) {
                // Auto-expand amountReceived only by the cash portion needed
                const cashNeeded = Math.max(0, newTotalAllocated - parseFloat(discountAmount || 0));
                setAmountReceived(cashNeeded);
            }
            return updated;
        });
    };

    const handleSave = async () => {
        try {
            const companyId = GetCompanyId();
            const discountVal = parseFloat(discountAmount || 0);
            const allocationsArray = Object.entries(allocations).map(([invoiceId, amount], index) => {
                let allocAmount = parseFloat(amount);
                if (index === 0) {
                    allocAmount = Math.max(0, allocAmount - discountVal);
                }
                // Determine invoice type from the type map
                const iType = invoiceTypeMap[parseInt(invoiceId)] ||
                    (selectedInvoice && parseInt(selectedInvoice.id) === parseInt(invoiceId)
                        ? (selectedInvoice.invoiceType || selectedInvoice.type || 'TAX_INVOICE')
                        : 'TAX_INVOICE');
                return {
                    invoiceId: parseInt(invoiceId),
                    invoiceType: iType,
                    amount: allocAmount
                };
            });

            // Determine top-level invoiceType (for single-invoice receipts without allocations)
            const topLevelInvoiceType = selectedInvoice
                ? (invoiceTypeMap[selectedInvoice.id] || selectedInvoice.invoiceType || selectedInvoice.type || 'TAX_INVOICE')
                : 'TAX_INVOICE';

            // For POS invoices, don't set invoiceId at top level (no FK in receipt table)
            const topLevelInvoiceId = selectedInvoice && topLevelInvoiceType !== 'POS_INVOICE'
                ? parseInt(selectedInvoice.id)
                : null;

            const data = {
                receiptNumber: editId ? undefined : (receiptNumber || `REC-${Date.now()}`),
                date: paymentDate,
                customerId: parseInt(customerId),
                invoiceId: topLevelInvoiceId,
                invoiceType: topLevelInvoiceType,
                cashBankAccountId: parseInt(bankLedgerId),
                amount: parseFloat(amountReceived),
                discountAmount: parseFloat(discountAmount || 0),
                discountLedgerId: discountLedgerId ? parseInt(discountLedgerId) : null,
                paymentMode: paymentMode,
                referenceNumber: reference,
                notes: notes,
                companyId: parseInt(companyId),
                allocations: allocationsArray,
                customFields: JSON.stringify(customFieldValues)
            };

            let response;
            if (isEditMode && editId) {
                response = await salesReceiptService.update(editId, data, companyId);
            } else {
                response = await salesReceiptService.create(data);
            }

            if (response.data.success) {
                fetchData();
                fetchDropdowns();
                setShowAddModal(false);
                resetForm();
            }
        } catch (error) {
            console.error('Error saving receipt:', error);
        }
    };

    const handleOpenModal = async () => {
        resetForm();
        setIsViewMode(false);
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getNextNumber(companyId, 'receipt');
                if (res.data.success) {
                    setReceiptNumber(res.data.nextNumber);
                }
            }
        } catch (error) {
            console.error('Error fetching next receipt number:', error);
        }
        setShowCustomerSelect(true); // Start with customer selection
        setShowAddModal(true);
    };

    const handleEdit = async (paymentId) => {
        await populatePayment(paymentId, false);
    };

    const handleView = async (paymentId) => {
        await populatePayment(paymentId, true);
    };

    // Handle Deep Link from Navigation State
    useEffect(() => {
        if (location.state && location.state.targetReceiptId) {
            const receiptId = location.state.targetReceiptId;
            // Clear location state immediately to prevent re-opening on re-renders
            navigate(location.pathname, { replace: true, state: {} });
            handleView(receiptId);
        } else if (location.state && location.state.targetInvoiceId) {
            const targetInvoiceId = location.state.targetInvoiceId;
            const targetInvoiceType = location.state.invoiceType || 'TAX_INVOICE';
            // Clear location state immediately to prevent re-opening on re-renders
            navigate(location.pathname, { replace: true, state: {} });

            const autoPopulatePaymentForInvoice = async () => {
                try {
                    const invId = targetInvoiceId;
                    const companyId = GetCompanyId();

                    // Fetch next receipt number (common step)
                    let nextNo = '';
                    try {
                        const res = await companyService.getNextNumber(companyId, 'receipt');
                        if (res.data.success) nextNo = res.data.nextNumber;
                    } catch (e) {
                        console.error('Error fetching next receipt number:', e);
                    }
                    
                    if (String(invId).startsWith('combined-')) {
                        // Combined/grouped invoice
                        const custIdStr = invId.replace('combined-CUST-', '');
                        const custId = parseInt(custIdStr);
                        
                        resetForm();
                        
                        // Fetch customer details, all invoices in parallel
                        const [custRes, allInvsRes] = await Promise.all([
                            customerService.getById(custId),
                            salesInvoiceService.getAll(companyId)
                        ]);
                        
                        if (custRes.data.success && allInvsRes.data.success) {
                            const cust = custRes.data.data;
                            
                            setReceiptNumber(nextNo);
                            setCustomerId(cust.id);
                            setCustomerLedgerId(cust.ledgerId);
                            setCustomerName(cust.name || '');
                            
                            // Find all unpaid/partial invoices for this customer
                            const custInvs = allInvsRes.data.data.filter(inv => inv.customerId === cust.id && inv.balanceAmount > 0);
                            const totalDue = custInvs.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);
                            
                            setAmountReceived(totalDue);
                            
                            // Auto-allocate the due amounts
                            const autoAllocs = {};
                            const newTypeMap = {};
                            custInvs.forEach(inv => {
                                autoAllocs[inv.id] = inv.balanceAmount;
                                newTypeMap[inv.id] = 'TAX_INVOICE';
                            });
                            setAllocations(autoAllocs);
                            setInvoiceTypeMap(prev => ({ ...prev, ...newTypeMap }));
                            
                            setShowCustomerSelect(false);
                            setShowInvoiceSelect(false);
                            setShowAddModal(true);
                        }
                    } else if (targetInvoiceType === 'POS_INVOICE') {
                        // POS Invoice deep link
                        const posRes = await posService.getPOSInvoiceById(invId, companyId);
                        if (posRes && posRes.success && posRes.data) {
                            const inv = { ...posRes.data, invoiceType: 'POS_INVOICE' };
                            resetForm();
                            setReceiptNumber(nextNo);
                            setSelectedInvoice(inv);
                            setCustomerId(inv.customerId);
                            setCustomerLedgerId(inv.customer?.ledgerId);
                            setCustomerName(inv.customer?.name || '');
                            setAmountReceived(inv.balanceAmount);
                            setAllocations({ [inv.id]: inv.balanceAmount });
                            setInvoiceTypeMap(prev => ({ ...prev, [inv.id]: 'POS_INVOICE' }));
                            setShowCustomerSelect(false);
                            setShowInvoiceSelect(false);
                            setShowAddModal(true);
                        }
                    } else {
                        // Standard Tax Invoice deep link
                        const invRes = await salesInvoiceService.getById(invId, companyId);
                        if (invRes.data.success) {
                            const inv = invRes.data.data;
                            resetForm();
                            setReceiptNumber(nextNo);
                            setSelectedInvoice(inv);
                            setCustomerId(inv.customerId);
                            setCustomerLedgerId(inv.customer?.ledgerId);
                            setCustomerName(inv.customer?.name || '');
                            setAmountReceived(inv.balanceAmount);
                            setAllocations({ [inv.id]: inv.balanceAmount });
                            setInvoiceTypeMap(prev => ({ ...prev, [inv.id]: 'TAX_INVOICE' }));
                            setShowCustomerSelect(false);
                            setShowInvoiceSelect(false);
                            setShowAddModal(true);
                        }
                    }
                } catch (error) {
                    console.error("Error setting up payment from invoice deep link:", error);
                }
            };
            autoPopulatePaymentForInvoice();
        }
    }, [location.state, navigate]);

    const populatePayment = async (paymentId, viewOnly) => {
        try {
            const companyId = GetCompanyId();
            const response = await salesReceiptService.getById(paymentId, companyId);
            if (response.data.success) {
                const rec = response.data.data;
                resetForm();
                setCurrentPayment(rec);
                setIsEditMode(!viewOnly);
                setIsViewMode(viewOnly);
                setEditId(paymentId);

                let fieldValues = {};
                if (rec.customFields) {
                    try {
                        fieldValues = typeof rec.customFields === 'string'
                            ? JSON.parse(rec.customFields)
                            : rec.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on edit:', e);
                    }
                }
                setCustomFieldValues(fieldValues);

                // Fetch invoice with items if invoice exists
                let invoiceWithItems = rec.invoice;
                if (rec.invoice?.id) {
                    try {
                        const invoiceResponse = await salesInvoiceService.getById(rec.invoice.id, companyId);
                        if (invoiceResponse.data.success) {
                            invoiceWithItems = invoiceResponse.data.data;
                        }
                    } catch (err) {
                        console.error('Error fetching invoice details:', err);
                    }
                }

                setSelectedInvoice(invoiceWithItems);
                setCustomerId(rec.customerId);
                setCustomerLedgerId(rec.customer?.ledgerId);
                setCustomerName(rec.customer?.name || '');
                setAmountReceived(rec.amount);
                setDiscountAmount(rec.discountAmount || 0);
                setDiscountLedgerId(rec.discountLedgerId || '');
                setPaymentDate(rec.date.split('T')[0]);
                setPaymentMode(rec.paymentMode || 'Bank');
                setReference(rec.referenceNumber || '');
                setBankLedgerId(rec.cashBankAccountId || ''); // Ensure backend returns this or we need to check receipt schema
                setNotes(rec.notes || '');
                setReceiptNumber(rec.receiptNumber || '');

                const newAllocs = {};
                const discAmount = parseFloat(rec.discountAmount || 0);
                if (rec.allocations && rec.allocations.length > 0) {
                    rec.allocations.forEach((a, idx) => {
                        newAllocs[a.invoiceId] = parseFloat(a.amount) + (idx === 0 ? discAmount : 0);
                    });
                } else if (rec.invoiceId && rec.amount) {
                    newAllocs[rec.invoiceId] = parseFloat(rec.amount) + discAmount;
                }
                setAllocations(newAllocs);

                setShowInvoiceSelect(false);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error('Error fetching payment details:', error);
        }
    };

    const handleDeleteClick = (id) => {
        setDeleteId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            const companyId = GetCompanyId();
            await salesReceiptService.delete(deleteId, companyId);
            fetchData();
            fetchDropdowns();
            setShowDeleteModal(false);
            setDeleteId(null);
        } catch (error) {
            console.error('Error deleting receipt:', error);
        }
    };

    const handleStatusChange = async (receiptId, newStatus) => {
        try {
            const companyId = GetCompanyId();
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };
            const response = await salesReceiptService.update(receiptId, payload, companyId);
            if (response.data?.success || response.success) {
                fetchData();
            }
        } catch (error) {
            console.error('Error changing status:', error);
        }
    };

    const handlePrint = () => {
        // Add print class to body to trigger print styles
        document.body.classList.add('printing');

        // Trigger print dialog
        window.print();

        // Remove print class after printing
        setTimeout(() => {
            document.body.classList.remove('printing');
        }, 1000);
    };

    return (
        <div className="SalesPayment-payment-page">
            <div className="SalesPayment-page-header">
                <div className="SalesPayment-header-left">
                    <h1 className="SalesPayment-page-title">Received Payments</h1>
                    <p className="SalesPayment-page-subtitle">Record and track customer payments</p>
                </div>
                <div className="SalesPayment-header-actions">
                    {hasPermission('create sales payment') && (
                        <button className="SalesPayment-btn-add" onClick={handleOpenModal}>
                            <Plus size={18} className="mr-2" /> Record Payment
                        </button>
                    )}
                </div>
            </div>

            {/* Sales Process Tracker */}
            <div className="SalesPayment-process-tracker-card">
                <div className="SalesPayment-tracker-wrapper">
                    {salesProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`SalesPayment-tracker-step ${step.status}`}>
                                <div className="SalesPayment-step-icon-wrapper">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="SalesPayment-status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="SalesPayment-status-badge" size={14} />}
                                </div>
                                <span className="SalesPayment-step-label">{step.label}</span>
                            </div>
                            {index < salesProcess.length - 1 && (
                                <div className={`SalesPayment-tracker-divider ${salesProcess[index + 1].status !== 'pending' ? 'SalesPayment-active' : ''}`}>
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="SalesPayment-table-card mt-6">
                <div className="SalesPayment-table-controls">
                    <div className="SalesPayment-search-control">
                        <Search size={18} className="SalesPayment-search-icon" />
                        <input
                            type="text"
                            placeholder="Search payments..."
                            className="SalesPayment-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="SalesPayment-filter-group">
                        <div className="SalesPayment-filter-item">
                            <span className="text-sm text-gray-500">From:</span>
                            <input
                                type="date"
                                className="SalesPayment-filter-date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="SalesPayment-filter-item">
                            <span className="text-sm text-gray-500">To:</span>
                            <input
                                type="date"
                                className="SalesPayment-filter-date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="SalesPayment-table-container">
                    <table className="SalesPayment-payment-table">
                        <thead>
                            <tr>
                                <th>PAYMENT ID</th>
                                <th>INVOICE</th>
                                <th>CUSTOMER</th>
                                <th>DATE</th>
                                <th>RECEIVED INTO</th>
                                {/* <th>MODE</th> */}
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th className="text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReceipts.map(rec => (
                                <tr key={rec.id}>
                                    <td className="font-bold text-blue-600">{rec.receiptNumber}</td>
                                    <td><span className="SalesPayment-source-link">{rec.invoice?.invoiceNumber || 'No Link'}</span></td>
                                    <td>{rec.customer?.name}</td>
                                    <td>{new Date(rec.date).toLocaleDateString()}</td>
                                    <td>{rec.cashBankAccount?.name || '-'}</td>
                                    {/* <td>{rec.paymentMode}</td> */}
                                    <td className="font-bold SalesPayment-text-green-600">
                                        {(() => {
                                            const recCurr = rec.allocations?.[0]?.invoice?.currency || rec.invoice?.currency || companySettings?.currency || 'INR';
                                            const recRate = getSyncRate(recCurr, companySettings?.currency || 'INR') || 1.0;
                                            const isForeignRec = recCurr !== (companySettings?.currency || 'INR');
                                            return isForeignRec ? (
                                                <>
                                                    <div style={{ fontWeight: '600' }}>{formatDocCurrency(rec.amount, recCurr)}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>({formatCurrency(rec.amount * recRate)})</div>
                                                </>
                                            ) : (
                                                formatCurrency(rec.amount)
                                            );
                                        })()}
                                    </td>
                                    <td>
                                        <select
                                            value={rec.manualStatus ? rec.status : 'AUTO'}
                                            onChange={(e) => handleStatusChange(rec.id, e.target.value)}
                                            className="SalesPayment-payment-status-badge"
                                            style={getStatusStyle(rec.manualStatus ? rec.status : 'AUTO')}
                                        >
                                            <option value="AUTO">Auto ({rec.status || 'Completed'})</option>
                                            <option value="PENDING">PENDING</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                            <option value="CANCELLED">CANCELLED</option>
                                        </select>
                                    </td>
                                    <td className="text-right">
                                        <div className="SalesPayment-payment-action-buttons">
                                            <button className="SalesPayment-payment-action-btn SalesPayment-view" onClick={() => handleView(rec.id)} title="View"><Eye size={16} /></button>
                                            {hasPermission('edit sales payment') && (
                                                <button className="SalesPayment-payment-action-btn SalesPayment-edit" onClick={() => handleEdit(rec.id)} title="Edit"><Pencil size={16} /></button>
                                            )}
                                            {hasPermission('delete sales payment') && (
                                                <button className="SalesPayment-payment-action-btn SalesPayment-delete" onClick={() => handleDeleteClick(rec.id)} title="Delete"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Record Payment Modal */}
            {showAddModal && (
                <div className={`SalesPayment-modal-overlay ${isViewMode ? 'SalesPayment-view-mode-overlay' : ''}`}>
                    <div className={`SalesPayment-modal-content SalesPayment-payment-modal ${isViewMode ? 'SalesPayment-view-mode-modal' : ''}`}>
                        {!isViewMode && (
                            <div className="SalesPayment-modal-header">
                                <div>
                                    <h2 className="SalesPayment-modal-title">{isEditMode ? 'Edit Payment' : 'Record Payment'}</h2>
                                    <p className="SalesPayment-modal-subtitle">{isEditMode ? 'Update payment details' : 'Log payment against an invoice'}</p>
                                </div>
                                <button className="SalesPayment-close-btn" onClick={() => setShowAddModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        {isViewMode && (
                            <div className="SalesPayment-view-mode-header SalesPayment-no-print">
                                <div>
                                    <h2 className="SalesPayment-modal-title">View Payment</h2>
                                    <p className="SalesPayment-modal-subtitle">Payment receipt and invoice details</p>
                                </div>
                                <div className="SalesPayment-view-mode-actions">
                                    <button className="SalesPayment-btn-secondary" onClick={handlePrint}>
                                        <Printer size={16} /> Print Receipt
                                    </button>
                                    <button className="SalesPayment-close-btn" onClick={() => setShowAddModal(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`SalesPayment-modal-body ${isViewMode ? 'SalesPayment-view-mode-body' : ''}`}>
                            {isViewMode ? (
                                // --- VIEW MODE: INVOICE TEMPLATE ---
                                <div className="SalesPayment-invoice-view-template" id="invoice-print-content">
                                    {/* Header */}
                                    <div className="SalesPayment-invoice-header-section">
                                        <div className="SalesPayment-invoice-company-info">
                                            {companyDetails.logo ? (
                                                <img src={companyDetails.logo} alt="Company Logo" className="SalesPayment-invoice-logo" />
                                            ) : (
                                                <div className="SalesPayment-invoice-logo-placeholder">ZB</div>
                                            )}
                                            <h2 className="SalesPayment-invoice-company-name">{companyDetails.name}</h2>
                                            <div className="SalesPayment-invoice-company-details">
                                                <p>{companyDetails.email}</p>
                                                <p>{companyDetails.phone}</p>
                                                <p>{companyDetails.address}</p>
                                            </div>
                                        </div>
                                        <div className="SalesPayment-invoice-meta-section">
                                            <h1 className="SalesPayment-invoice-title">{getDocumentTitle('receipt')}</h1>
                                            <div className="SalesPayment-invoice-meta-details">
                                                <p><span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('number', 'Receipt No:')}</span> {currentPayment?.receiptNumber || 'N/A'}</p>
                                                <p><span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('date', 'Payment Date:')}</span> {currentPayment?.date ? new Date(currentPayment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</p>
                                                {currentPayment?.invoice?.invoiceNumber && (
                                                    <p><span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('invoiceRef', 'Invoice Ref:')}</span> #{currentPayment.invoice.invoiceNumber}</p>
                                                )}
                                            </div>
                                            {companyDetails.showQr && (
                                                <div className="SalesPayment-invoice-qr-code">
                                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${currentPayment?.receiptNumber || 'Receipt'}`} alt="QR Code" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Address Section */}
                                    <div className="SalesPayment-invoice-addresses-section">
                                        <div className="SalesPayment-invoice-bill-to-section">
                                            <h3 className="SalesPayment-invoice-section-title">{getReceiptPaymentLabel('receivedFrom', 'Received From:')}</h3>
                                            <p className="SalesPayment-invoice-customer-name">{currentPayment?.customer?.name || customerName || 'Valued Customer'}</p>
                                            <p className="SalesPayment-invoice-customer-address">{currentPayment?.customer?.billingAddress || 'N/A'}</p>
                                            <p className="SalesPayment-invoice-customer-city">
                                                {currentPayment?.customer?.billingCity} {currentPayment?.customer?.billingState}
                                            </p>
                                        </div>
                                        <div className="pp-receipt-ship-to">
                                            <h3 className="SalesPayment-invoice-section-title">Payment Summary:</h3>
                                            <p className="SalesPayment-invoice-meta-details"><span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('receivedInto', 'Received Into:')}</span> {currentPayment?.cashBankAccount?.name || 'N/A'}</p>
                                            <p className="SalesPayment-invoice-meta-details"><span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('mode', 'Payment Mode:')}</span> {currentPayment?.paymentMode || 'N/A'}</p>
                                            {currentPayment?.referenceNumber && (
                                                <p className="SalesPayment-invoice-meta-details"><span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('refNo', 'Ref No:')}</span> {currentPayment.referenceNumber}</p>
                                            )}
                                            {currentPayment?.discountAmount > 0 && (() => {
                                                const recCurr = currentPayment?.allocations?.[0]?.invoice?.currency || currentPayment?.invoice?.currency || companySettings?.currency || 'INR';
                                                const recRate = getSyncRate(recCurr, companySettings?.currency || 'INR') || 1.0;
                                                const isForeignRec = recCurr !== (companySettings?.currency || 'INR');
                                                return (
                                                    <>
                                                        <p className="SalesPayment-invoice-meta-details">
                                                            <span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('discount', 'Discount Allowed:')}</span>{' '}
                                                            {isForeignRec ? (
                                                                <>
                                                                    {formatDocCurrency(currentPayment.discountAmount, recCurr)}
                                                                    <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '6px' }}>({formatCurrency(currentPayment.discountAmount * recRate)})</span>
                                                                </>
                                                            ) : (
                                                                formatCurrency(currentPayment.discountAmount)
                                                            )}
                                                        </p>
                                                        <p className="SalesPayment-invoice-meta-details"><span className="SalesPayment-invoice-meta-label">{getReceiptPaymentLabel('discountAccount', 'Discount Account:')}</span> {currentPayment.discountLedger?.name || 'N/A'}</p>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Amount Box */}
                                    {(() => {
                                        const recCurr = currentPayment?.allocations?.[0]?.invoice?.currency || currentPayment?.invoice?.currency || companySettings?.currency || 'INR';
                                        const recRate = getSyncRate(recCurr, companySettings?.currency || 'INR') || 1.0;
                                        const isForeignRec = recCurr !== (companySettings?.currency || 'INR');
                                        
                                        const amountText = isForeignRec 
                                            ? `${formatDocCurrency(currentPayment?.amount || 0, recCurr)} (${formatCurrency((currentPayment?.amount || 0) * recRate)})`
                                            : formatCurrency(currentPayment?.amount || 0);

                                        const discountText = currentPayment?.discountAmount > 0
                                            ? (isForeignRec 
                                                ? ` (with ${formatDocCurrency(currentPayment.discountAmount, recCurr)} (${formatCurrency(currentPayment.discountAmount * recRate)}) discount)`
                                                : ` (with ${formatCurrency(currentPayment.discountAmount)} discount)`)
                                            : '';

                                        return (
                                            <div className="SalesPayment-receipt-amount-box">
                                                <div className="SalesPayment-receipt-amount-text">
                                                    {getReceiptPaymentLabel('satisfaction', 'The sum of {amount} {discountText} was received in full satisfaction of the mentioned account.')
                                                        .replace('{amount}', amountText)
                                                        .replace('{discountText}', discountText)
                                                    }
                                                </div>
                                                <div className="SalesPayment-receipt-amount-value">
                                                    {isForeignRec ? (
                                                        <>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: 'normal', color: '#64748b' }}>{formatDocCurrency(currentPayment?.amount || 0, recCurr)}</div>
                                                            <div>{formatCurrency((currentPayment?.amount || 0) * recRate)}</div>
                                                        </>
                                                    ) : (
                                                        formatCurrency(currentPayment?.amount || 0)
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Custom Fields Print View */}
                                    {(() => {
                                        let customFieldVals = {};
                                        if (currentPayment?.customFields) {
                                            try {
                                                customFieldVals = typeof currentPayment.customFields === 'string'
                                                    ? JSON.parse(currentPayment.customFields)
                                                     : currentPayment.customFields;
                                            } catch (e) {
                                                console.error('Error parsing payment custom fields for view:', e);
                                            }
                                        }
                                        const fieldsList = getCustomFieldsForType('receipt');
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

                                    {/* Linked Invoices (if any) */}
                                    {((currentPayment?.allocations && currentPayment.allocations.length > 0) || currentPayment?.invoice) && (
                                        <div className="SalesPayment-invoice-items-section">
                                            <h3 className="SalesPayment-invoice-section-title">Applied To Invoices:</h3>
                                            <table className="SalesPayment-invoice-items-table">
                                                <thead>
                                                    <tr>
                                                        <th>{getReceiptPaymentHeader('invoiceNumber', 'Invoice Number')}</th>
                                                        <th>{getReceiptPaymentHeader('invoiceDate', 'Invoice Date')}</th>
                                                        <th className="text-right">{getReceiptPaymentHeader('invoiceAmount', 'Invoice Amount')}</th>
                                                        <th className="text-right">{getReceiptPaymentHeader('allocatedAmount', 'Allocated Amount')}</th>
                                                        <th className="text-right">{getReceiptPaymentHeader('balanceDue', 'Balance Due')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentPayment.allocations && currentPayment.allocations.length > 0 ? (
                                                        currentPayment.allocations.map((alloc, index) => {
                                                            const invCurr = alloc.invoice?.currency || companySettings?.currency || 'INR';
                                                            const invRate = getSyncRate(invCurr, companySettings?.currency || 'INR') || 1.0;
                                                            const isInvForeign = invCurr !== (companySettings?.currency || 'INR');
                                                            const allocSum = parseFloat(alloc.amount || 0) + (index === 0 ? parseFloat(currentPayment.discountAmount || 0) : 0);
                                                            return (
                                                                <tr key={alloc.id}>
                                                                    <td>{alloc.invoice?.invoiceNumber || `ID: ${alloc.invoiceId}`}</td>
                                                                    <td>{alloc.invoice?.date ? new Date(alloc.invoice.date).toLocaleDateString() : 'N/A'}</td>
                                                                    <td className="text-right">
                                                                        {isInvForeign ? (
                                                                            <>
                                                                                <div style={{ fontWeight: '600' }}>{formatDocCurrency(alloc.invoice?.totalAmount || 0, invCurr)}</div>
                                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>({formatCurrency((alloc.invoice?.totalAmount || 0) * invRate)})</div>
                                                                            </>
                                                                        ) : (
                                                                            formatCurrency(alloc.invoice?.totalAmount || 0)
                                                                        )}
                                                                    </td>
                                                                    <td className="text-right">
                                                                        {isInvForeign ? (
                                                                            <>
                                                                                <div style={{ fontWeight: '600' }}>{formatDocCurrency(allocSum, invCurr)}</div>
                                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>({formatCurrency(allocSum * invRate)})</div>
                                                                            </>
                                                                        ) : (
                                                                            formatCurrency(allocSum)
                                                                        )}
                                                                    </td>
                                                                    <td className="text-right font-bold text-red-500">
                                                                        {isInvForeign ? (
                                                                            <>
                                                                                <div>{formatDocCurrency(alloc.invoice?.balanceAmount || 0, invCurr)}</div>
                                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>({formatCurrency((alloc.invoice?.balanceAmount || 0) * invRate)})</div>
                                                                            </>
                                                                        ) : (
                                                                            formatCurrency(alloc.invoice?.balanceAmount || 0)
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        // Fallback to legacy single invoice link
                                                        (() => {
                                                            const invCurr = currentPayment?.invoice?.currency || companySettings?.currency || 'INR';
                                                            const invRate = getSyncRate(invCurr, companySettings?.currency || 'INR') || 1.0;
                                                            const isInvForeign = invCurr !== (companySettings?.currency || 'INR');
                                                            const allocSum = parseFloat(currentPayment?.amount || 0) + parseFloat(currentPayment?.discountAmount || 0);
                                                            return (
                                                                <tr>
                                                                    <td>{currentPayment?.invoice?.invoiceNumber}</td>
                                                                    <td>{currentPayment?.invoice?.date ? new Date(currentPayment.invoice.date).toLocaleDateString() : 'N/A'}</td>
                                                                    <td className="text-right">
                                                                        {isInvForeign ? (
                                                                            <>
                                                                                <div style={{ fontWeight: '600' }}>{formatDocCurrency(currentPayment?.invoice?.totalAmount || 0, invCurr)}</div>
                                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>({formatCurrency((currentPayment?.invoice?.totalAmount || 0) * invRate)})</div>
                                                                            </>
                                                                        ) : (
                                                                            formatCurrency(currentPayment?.invoice?.totalAmount || 0)
                                                                        )}
                                                                    </td>
                                                                    <td className="text-right">
                                                                        {isInvForeign ? (
                                                                            <>
                                                                                <div style={{ fontWeight: '600' }}>{formatDocCurrency(allocSum, invCurr)}</div>
                                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>({formatCurrency(allocSum * invRate)})</div>
                                                                            </>
                                                                        ) : (
                                                                            formatCurrency(allocSum)
                                                                        )}
                                                                    </td>
                                                                    <td className="text-right font-bold text-red-500">
                                                                        {isInvForeign ? (
                                                                            <>
                                                                                <div>{formatDocCurrency(currentPayment?.invoice?.balanceAmount || 0, invCurr)}</div>
                                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>({formatCurrency((currentPayment?.invoice?.balanceAmount || 0) * invRate)})</div>
                                                                            </>
                                                                        ) : (
                                                                            formatCurrency(currentPayment?.invoice?.balanceAmount || 0)
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })()
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Footer Info */}
                                    <div className="SalesPayment-invoice-payment-info-section">
                                        <div className="SalesPayment-invoice-payment-details">
                                            <div className="SalesPayment-payment-detail-row">
                                                <span className="SalesPayment-payment-detail-label">{getReceiptPaymentLabel('notes', 'Remarks / Notes:')}</span>
                                                <span className="SalesPayment-payment-detail-value">{currentPayment?.notes || 'No additional notes.'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Terms & Conditions */}
                                    {(companyDetails.termsReceipt || companyDetails.terms) && (
                                        <div style={{ marginTop: '1rem', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', border: '1px solid #e2e8f0', textAlign: 'left', width: '100%' }}>
                                            <div style={{ fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Terms & Conditions</div>
                                            <div style={{ whiteSpace: 'pre-line' }}>{companyDetails.termsReceipt || companyDetails.terms}</div>
                                        </div>
                                    )}

                                    {/* Signature Section */}
                                    <div className="SalesPayment-receipt-signature-section">
                                        <div className="SalesPayment-receipt-signature-box">
                                            <div className="SalesPayment-receipt-signature-line"></div>
                                            <div className="SalesPayment-receipt-signature-label">{getReceiptPaymentLabel('signature', 'Authorized Signature')}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // --- EDIT / CREATE MODE ---
                                <>
                                    {/* Customer Selection Step */}
                                    {showCustomerSelect && (
                                        <div className="SalesPayment-selection-container">
                                            <div className="SalesPayment-modal-section-header">
                                                <h3 className="SalesPayment-text-sm font-bold SalesPayment-text-gray-700">Select Customer</h3>
                                                <div className="SalesPayment-selection-search">
                                                    <Search size={14} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search customer..."
                                                        value={customerSearch}
                                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="SalesPayment-customer-grid">
                                                {filteredCustomers.map(cust => (
                                                    <div key={cust.id} className="SalesPayment-selection-card" onClick={() => handleSelectCustomer(cust)}>
                                                        <div className="SalesPayment-selection-card-icon">
                                                            <Eye size={20} />
                                                        </div>
                                                        <div className="SalesPayment-selection-card-info">
                                                            <div className="SalesPayment-selection-card-title">{cust.name}</div>
                                                            <div className="SalesPayment-selection-card-subtitle">{cust.email || cust.phone || 'No contact info'}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredCustomers.length === 0 && <div className="SalesPayment-no-results">No customers found</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Invoice Selection Step */}
                                    {showInvoiceSelect && (
                                        <div className="SalesPayment-selection-container">
                                            <div className="SalesPayment-modal-section-header">
                                                <h3 className="SalesPayment-text-sm font-bold SalesPayment-text-gray-700">
                                                    Select Unpaid Invoice for {customerName}
                                                </h3>
                                                <button className="SalesPayment-btn-text" onClick={() => setShowCustomerSelect(true)}>Change Customer</button>
                                            </div>
                                            <div className="SalesPayment-invoice-grid">
                                                {invoices.filter(inv => inv.customerId === customerId).map(inv => (
                                                    <div key={inv.id} className="SalesPayment-selection-card SalesPayment-invoice-card" onClick={() => handleSelectInvoice(inv)}>
                                                        <div className="SalesPayment-selection-card-info">
                                                            <div className="SalesPayment-selection-card-title">{inv.invoiceNumber}</div>
                                                            <div className="SalesPayment-selection-card-subtitle">Date: {new Date(inv.date).toLocaleDateString()}</div>
                                                        </div>
                                                        <div className="SalesPayment-selection-card-action text-right">
                                                            <div className="SalesPayment-amount-label">Due</div>
                                                            <div className="SalesPayment-amount-value">
                                                                {inv.currency && inv.currency !== (companySettings?.currency || 'INR') ? (
                                                                    <>
                                                                        <div style={{ fontWeight: '600' }}>{formatDocCurrency(inv.balanceAmount, inv.currency)}</div>
                                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>
                                                                            ({formatCurrency(inv.balanceAmount * getSyncRate(inv.currency, companySettings?.currency || 'INR'))})
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    formatCurrency(inv.balanceAmount)
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {invoices.filter(inv => inv.customerId === customerId).length === 0 && (
                                                    <div className="SalesPayment-no-results">No unpaid invoices for this customer</div>
                                                )}
                                            </div>
                                            <div className="SalesPayment-selection-footer mt-4">
                                                <button className="SalesPayment-btn-secondary w-full" onClick={() => setShowInvoiceSelect(false)}>
                                                    Continue without linking to invoice
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="SalesPayment-form-container">
                                        {/* Company Info - Read Only (Dynamic) */}
                                        <div className="SalesPayment-company-info-readonly">
                                            {companyDetails.logo ? (
                                                <img src={companyDetails.logo} alt="Logo" className="SalesPayment-company-logo-fixed" />
                                            ) : (
                                                <div className="SalesPayment-logo-placeholder-fixed">ZB</div>
                                            )}
                                            <div className="SalesPayment-brand-details">
                                                <h4 className="SalesPayment-company-name">{companyDetails.name}</h4>
                                                <p className="SalesPayment-company-address">{companyDetails.address}</p>
                                                <div className="SalesPayment-company-contact">
                                                    <span>{companyDetails.email}</span>
                                                    <span className="SalesPayment-contact-separator">•</span>
                                                    <span>{companyDetails.phone}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedInvoice && (
                                            <div className="SalesPayment-linked-indicator SalesPayment-mb-6">
                                                <Wallet size={16} /> Receiving Payment for <strong>{selectedInvoice.invoiceNumber}</strong>
                                                {!isViewMode && <button className="SalesPayment-change-link-btn" onClick={() => setShowInvoiceSelect(true)}>Change Invoice</button>}
                                            </div>
                                        )}

                                        <div className="SalesPayment-form-grid-2">
                                            <div className="SalesPayment-form-group">
                                                <label className="SalesPayment-form-label">Receipt Number</label>
                                                <input
                                                    type="text"
                                                    className="SalesPayment-form-input"
                                                    disabled={isViewMode || !!editId}
                                                    value={receiptNumber}
                                                    onChange={(e) => setReceiptNumber(e.target.value)}
                                                    placeholder="Auto-generated"
                                                />
                                            </div>

                                            <div className="SalesPayment-form-group">
                                                <label className="SalesPayment-form-label">Customer Name</label>
                                                <input
                                                    type="text"
                                                    className="SalesPayment-form-input SalesPayment-bg-gray-50"
                                                    value={customerName}
                                                    disabled
                                                />
                                            </div>

                                            <div className="SalesPayment-form-group">
                                                <label className="SalesPayment-form-label">Payment Date</label>
                                                <input
                                                    type="date"
                                                    className="SalesPayment-form-input"
                                                    disabled={isViewMode}
                                                    value={paymentDate}
                                                    onChange={(e) => setPaymentDate(e.target.value)}
                                                />
                                            </div>

                                            {/* <div className="SalesPayment-form-group">
                                                <label className="SalesPayment-form-label">Payment Mode</label>
                                                <select
                                                    className="SalesPayment-form-input"
                                                    disabled={isViewMode}
                                                    value={paymentMode}
                                                    onChange={(e) => setPaymentMode(e.target.value)}
                                                >
                                                    <option value="CASH">Cash</option>
                                                    <option value="UPI">UPI</option>
                                                    <option value="CARD">Card</option>
                                                    <option value="CHEQUE">Cheque</option>
                                                    <option value="BANK">Bank Transfer</option>
                                                </select>
                                            </div> */}

                                            <div className="SalesPayment-form-group">
                                                <label className="SalesPayment-form-label">Deposit To / Credit To (Account)</label>
                                                <select
                                                    className="SalesPayment-form-input"
                                                    disabled={isViewMode}
                                                    value={bankLedgerId}
                                                    onChange={(e) => setBankLedgerId(e.target.value)}
                                                >
                                                    <option value="">Select Account...</option>
                                                    {Object.entries(groupedLedgers).sort().map(([groupName, groupLedgers]) => (
                                                        <optgroup key={groupName} label={groupName}>
                                                            {groupLedgers.map(l => (
                                                                <option key={l.id} value={l.id}>
                                                                    {l.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <div className="SalesPayment-text-xs SalesPayment-text-slate-500 mt-1">Select the account where the payment will be credited.</div>
                                            </div>

                                            <div className="SalesPayment-form-group">
                                                <label className="SalesPayment-form-label">Reference ID / Check No.</label>
                                                <input
                                                    type="text"
                                                    className="SalesPayment-form-input"
                                                    disabled={isViewMode}
                                                    placeholder="e.g. TRN-12345678"
                                                    value={reference}
                                                    onChange={(e) => setReference(e.target.value)}
                                                />
                                            </div>

                                            {(() => {
                                                const invoiceCurrency = selectedInvoice?.currency || companySettings?.currency || 'INR';
                                                const baseCurrency = companySettings?.currency || 'INR';
                                                const rate = getSyncRate(invoiceCurrency, baseCurrency) || 1.0;
                                                return (
                                                    <div className="SalesPayment-form-group">
                                                        <label className="SalesPayment-form-label">Discount Allowed ({companySettings?.currency || 'INR'})</label>
                                                        <input
                                                            type="number"
                                                            className="SalesPayment-form-input"
                                                            disabled={isViewMode}
                                                            value={discountAmount ? (parseFloat(discountAmount) * rate).toFixed(2) : ''}
                                                            onChange={(e) => {
                                                                const inrDiscount = parseFloat(e.target.value) || 0;
                                                                const usdDiscount = rate > 0 ? inrDiscount / rate : inrDiscount;
                                                                setDiscountAmount(usdDiscount.toFixed(5));
                                                                if (selectedInvoice) {
                                                                    setAmountReceived(Math.max(0, dueAmount - usdDiscount).toFixed(5));
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                const inrDiscount = parseFloat(e.target.value) || 0;
                                                                const usdDiscount = rate > 0 ? inrDiscount / rate : inrDiscount;
                                                                setDiscountAmount(usdDiscount.toFixed(5));
                                                            }}
                                                            step="0.01"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                );
                                            })()}

                                            <div className="SalesPayment-form-group">
                                                <label className="SalesPayment-form-label">Discount Account</label>
                                                <select
                                                    className="SalesPayment-form-input"
                                                    disabled={isViewMode || parseFloat(discountAmount || 0) <= 0}
                                                    value={discountLedgerId}
                                                    onChange={(e) => setDiscountLedgerId(e.target.value)}
                                                >
                                                    <option value="">Select Discount Account...</option>
                                                    {discountLedgers.map(l => (
                                                        <option key={l.id} value={l.id}>
                                                            {l.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {/* <div className="SalesPayment-text-xs SalesPayment-text-slate-500 mt-1">Direct Expenses ledgers. Required if discount is &gt; 0.</div> */}
                                            </div>

                                            {(() => {
                                                const invoiceCurrency = selectedInvoice?.currency || companySettings?.currency || 'INR';
                                                const baseCurrency = companySettings?.currency || 'INR';
                                                const rate = getSyncRate(invoiceCurrency, baseCurrency) || 1.0;
                                                return (
                                                    <div className="amount -section SalesPayment-form-group SalesPayment-bg-green-50 SalesPayment-rounded-lg SalesPayment-border SalesPayment-border-green-100">
                                                        <div className="SalesPayment-form-group SalesPayment-mb-0">
                                                            <label className="SalesPayment-form-label SalesPayment-text-green-800 font-bold">Amount Received ({companySettings?.currency || 'INR'})</label>
                                                            <div className="SalesPayment-input-with-symbol SalesPayment-text-lg">
                                                                {isViewMode ? (
                                                                    <input
                                                                        type="text"
                                                                        className="SalesPayment-form-input SalesPayment-text-2xl font-bold SalesPayment-text-green-700 SalesPayment-h-12"
                                                                        disabled
                                                                        value={formatCurrency(amountReceived * rate)}
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type="number"
                                                                        className="SalesPayment-form-input SalesPayment-text-2xl font-bold SalesPayment-text-green-700 SalesPayment-h-12"
                                                                        value={amountReceived ? (parseFloat(amountReceived) * rate).toFixed(2) : ''}
                                                                        onChange={(e) => {
                                                                            const inrVal = parseFloat(e.target.value) || 0;
                                                                            setAmountReceived(rate > 0 ? (inrVal / rate).toFixed(5) : inrVal);
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            const inrVal = parseFloat(e.target.value) || 0;
                                                                            setAmountReceived(rate > 0 ? (inrVal / rate).toFixed(5) : inrVal.toFixed(2));
                                                                        }}
                                                                        step="0.01"
                                                                        placeholder="0.00"
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        {/* Custom Fields Section */}
                                        {getCustomFieldsForType('receipt').length > 0 && (
                                            <div className="SalesPayment-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Custom Fields
                                                </h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                                    {getCustomFieldsForType('receipt').map(field => (
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
                                                                    disabled={isViewMode}
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
                                                                    disabled={isViewMode}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="SalesPayment-form-group">
                                            <label className="SalesPayment-form-label">Notes</label>
                                            <textarea className="SalesPayment-form-textarea SalesPayment-h-20"
                                                disabled={isViewMode}
                                                placeholder="Internal notes..." value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
                                        </div>

                                        {/* Inline allocations table */}
                                        <div className="SalesPayment-allocations-section" style={{ marginTop: '24px' }}>
                                            <h3 className="SalesPayment-form-label" style={{ fontWeight: '700', color: '#475569', marginBottom: '10px' }}>Invoice Allocations</h3>
                                            {customerInvoices.length > 0 ? (
                                                <div className="SalesPayment-allocations-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
                                                    <table className="SalesPayment-allocations-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                            <tr>
                                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '600', color: '#64748b' }}>Invoice No</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '600', color: '#64748b' }}>Date</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>Total Amount</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>Due Balance</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '600', color: '#64748b', width: '150px' }}>Allocation</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {customerInvoices.map(inv => {
                                                                const maxDue = getInvoiceAvailableBalance(inv.id, inv.balanceAmount);
                                                                const allocatedVal = allocations[inv.id] !== undefined ? allocations[inv.id] : '';
                                                                return (
                                                                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '12px 16px', fontWeight: '500', color: '#1e293b' }}>{inv.invoiceNumber}</td>
                                                                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(inv.date).toLocaleDateString()}</td>
                                                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1e293b' }}>
                                                                            {inv.currency && inv.currency !== (companySettings?.currency || 'INR') ? (
                                                                                <>
                                                                                    <div style={{ fontWeight: '600' }}>{formatDocCurrency(inv.totalAmount, inv.currency)}</div>
                                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>({formatCurrency(inv.totalAmount * getSyncRate(inv.currency || 'USD', companySettings?.currency || 'INR'))})</div>
                                                                                </>
                                                                            ) : (
                                                                                formatCurrency(inv.totalAmount)
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#d97706' }}>
                                                                            {inv.currency && inv.currency !== (companySettings?.currency || 'INR') ? (
                                                                                <>
                                                                                    <div>{formatDocCurrency(maxDue, inv.currency)}</div>
                                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>({formatCurrency(maxDue * getSyncRate(inv.currency || 'USD', companySettings?.currency || 'INR'))})</div>
                                                                                </>
                                                                            ) : (
                                                                                formatCurrency(maxDue)
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                                            <input
                                                                                type="number"
                                                                                className="SalesPayment-form-input"
                                                                                style={{ margin: 0, padding: '4px 8px', textAlign: 'right', width: '120px', display: 'inline-block' }}
                                                                                value={allocatedVal}
                                                                                placeholder="0.00"
                                                                                min="0"
                                                                                max={maxDue}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    const num = parseFloat(val) || 0;
                                                                                    const capped = num > maxDue ? maxDue : num;
                                                                                    handleAllocationChange(inv.id, val === '' ? '' : capped);
                                                                                }}
                                                                            />
                                                                            {allocatedVal && inv.currency && inv.currency !== (companySettings?.currency || 'INR') && (
                                                                                <div style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '4px', fontWeight: '500' }}>
                                                                                    ({formatCurrency(parseFloat(allocatedVal || 0) * getSyncRate(inv.currency || 'USD', companySettings?.currency || 'INR'))})
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ color: '#64748b', fontSize: '0.875rem', fontStyle: 'italic', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                    No unpaid invoices found for this customer. Any payment received will be recorded as advance/on account.
                                                </div>
                                            )}
                                            {(() => {
                                                 const summaryCurr = selectedInvoice?.currency || companySettings?.currency || 'INR';
                                                 const summaryRate = getSyncRate(summaryCurr, companySettings?.currency || 'INR') || 1.0;
                                                 const isForeign = summaryCurr !== (companySettings?.currency || 'INR');
                                                 return (
                                                     <div className="SalesPayment-allocation-summary" style={{ marginTop: '16px', padding: '16px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                                                         <div>
                                                             <span style={{ color: '#64748b', marginRight: '8px' }}>Total Received:</span>
                                                             <span style={{ fontWeight: '700', color: '#1e293b' }}>
                                                                 {isForeign ? (
                                                                     <>
                                                                         <span>{formatDocCurrency(amountReceived || 0, summaryCurr)}</span>
                                                                         <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b', marginLeft: '6px' }}>
                                                                             ({formatCurrency((amountReceived || 0) * summaryRate)})
                                                                         </span>
                                                                     </>
                                                                 ) : (
                                                                     formatCurrency(amountReceived || 0)
                                                                 )}
                                                             </span>
                                                         </div>
                                                         <div>
                                                             <span style={{ color: '#64748b', marginRight: '8px' }}>Total Allocated:</span>
                                                             <span style={{ fontWeight: '700', color: '#2563eb' }}>
                                                                 {isForeign ? (
                                                                     <>
                                                                         <span>{formatDocCurrency(totalAllocated, summaryCurr)}</span>
                                                                         <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b', marginLeft: '6px' }}>
                                                                             ({formatCurrency(totalAllocated * summaryRate)})
                                                                         </span>
                                                                     </>
                                                                 ) : (
                                                                     formatCurrency(totalAllocated)
                                                                 )}
                                                             </span>
                                                         </div>
                                                         <div>
                                                             <span style={{ color: '#64748b', marginRight: '8px' }}>Unallocated (Advance):</span>
                                                             <span style={{ fontWeight: '700', color: remainingAmount > 0.01 ? '#16a34a' : '#64748b' }}>
                                                                 {isForeign ? (
                                                                     <>
                                                                         <span>{formatDocCurrency(remainingAmount, summaryCurr)}</span>
                                                                         <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b', marginLeft: '6px' }}>
                                                                             ({formatCurrency(remainingAmount * summaryRate)})
                                                                         </span>
                                                                     </>
                                                                 ) : (
                                                                     formatCurrency(remainingAmount)
                                                                 )}
                                                             </span>
                                                         </div>
                                                     </div>
                                                 );
                                             })()}

                                            {totalAllocated > (parseFloat(amountReceived || 0) + parseFloat(discountAmount || 0)) && (
                                                <div style={{ marginTop: '12px', padding: '12px', borderRadius: '6px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.875rem', fontWeight: '500' }}>
                                                    ⚠️ Total allocated amount ({formatCurrency(totalAllocated)}) cannot exceed the sum of amount received and discount ({formatCurrency(parseFloat(amountReceived || 0) + parseFloat(discountAmount || 0))}). Please adjust allocations or increase the Amount Received.
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </>
                            )}
                        </div>

                        {!isViewMode && (
                            <div className="SalesPayment-modal-footer">
                                <div className="SalesPayment-footer-left">
                                    <button className="SalesPayment-btn-secondary">
                                        <Printer size={16} /> Print Receipt
                                    </button>
                                </div>
                                <div className="SalesPayment-footer-right">
                                    {!isEditMode && !showCustomerSelect && (
                                        <button className="SalesPayment-btn-cancel mr-2" onClick={() => setShowCustomerSelect(true)}>Back</button>
                                    )}
                                    <button className="SalesPayment-btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                                    <button className="SalesPayment-btn-submit" style={{ backgroundColor: '#8ce043' }} disabled={!customerId || !bankLedgerId || amountReceived <= 0 || (parseFloat(discountAmount || 0) > 0 && !discountLedgerId) || totalAllocated > (parseFloat(amountReceived || 0) + parseFloat(discountAmount || 0))} onClick={handleSave}>
                                        {isEditMode ? 'Update Payment' : 'Save Payment'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="SalesPayment-modal-overlay">
                    <div className="SalesPayment-delete-modal-content">
                        <div className="SalesPayment-delete-modal-header">
                            <h2 className="SalesPayment-text-lg font-bold SalesPayment-text-red-600">Delete Payment?</h2>
                            <button className="SalesPayment-close-btn-simple" onClick={() => setShowDeleteModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="SalesPayment-delete-modal-body">
                            <p className="SalesPayment-text-gray-600">
                                Are you sure you want to delete this Payment Record? This will revert the Invoice balance.
                            </p>
                        </div>
                        <div className="SalesPayment-delete-modal-footer">
                            <button className="SalesPayment-btn-plain" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="SalesPayment-btn-delete-confirm" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payment;
