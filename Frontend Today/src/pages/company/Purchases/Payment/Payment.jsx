import React, { useState, useEffect, useMemo } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search, Plus, Pencil, Trash2, X,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Printer, Eye, Wallet, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './Payment.css';
import './PaymentReceiptView.css';
import './PaymentActionButtons.css';
import purchasePaymentService from '../../../../services/purchasePaymentService';
import purchaseBillService from '../../../../services/purchaseBillService';
import vendorService from '../../../../services/vendorService';
import ledgerService from '../../../../api/ledgerService';
import companyService from '../../../../api/companyService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { BASE_URL } from '../../../../api/axiosInstance';

const Payment = () => {
    const { hasPermission } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const sourceData = location.state?.sourceData;
    const targetPaymentId = location.state?.targetPaymentId;

    const { companySettings, formatCurrency, getReceiptPaymentLabel, getReceiptPaymentHeader, getDocumentTitle } = useContext(CompanyContext);

    // ── List state ──────────────────────────────────────────────
    const [payments, setPayments] = useState([]);
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
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // ── Dropdown data ────────────────────────────────────────────
    const [vendors, setVendors] = useState([]);
    const [allBills, setAllBills] = useState([]);   // all unpaid bills
    const [accounts, setAccounts] = useState([]);   // all ledger accounts

    // ── Modals ───────────────────────────────────────────────────
    const [showAddModal, setShowAddModal] = useState(false);
    const [showVendorSelect, setShowVendorSelect] = useState(false);
    const [showBillSelect, setShowBillSelect] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [viewPayment, setViewPayment] = useState(null);

    // ── Vendor / Bill selection searches ─────────────────────────
    const [vendorSearch, setVendorSearch] = useState('');
    const [billSearch, setBillSearch] = useState('');

    // ── Company details ──────────────────────────────────────────
    const [companyDetails, setCompanyDetails] = useState({
        name: 'My Company', address: '', email: '', phone: '', logo: null
    });

    // ── Form state ───────────────────────────────────────────────
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [selectedVendorName, setSelectedVendorName] = useState('');
    const [selectedBill, setSelectedBill] = useState(null);
    const [accountId, setAccountId] = useState('');
    const [amount, setAmount] = useState(0);
    const [paymentMeta, setPaymentMeta] = useState({
        manualNo: '', date: new Date().toISOString().split('T')[0], mode: 'Bank Transfer'
    });
    const [notes, setNotes] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountLedgerId, setDiscountLedgerId] = useState('');
    const [discountLedgers, setDiscountLedgers] = useState([]);
    const [allocations, setAllocations] = useState({}); // Stores { [billId]: allocatedAmount }

    const getBillAvailableBalance = (billId, baseBalance) => {
        let balance = parseFloat(baseBalance || 0);
        if (editingId && viewPayment?.allocations) {
            const alloc = viewPayment.allocations.find(a => a.purchaseBillId === billId);
            if (alloc) {
                balance += parseFloat(alloc.amount || 0);
            }
        }
        return balance;
    };

    const totalAllocated = useMemo(() => {
        return Object.values(allocations).reduce((sum, val) => sum + parseFloat(val || 0), 0);
    }, [allocations]);

    const remainingAmount = useMemo(() => {
        const received = parseFloat(amount || 0);
        const discount = parseFloat(discountAmount || 0);
        return Math.max(0, (received + discount) - totalAllocated);
    }, [amount, discountAmount, totalAllocated]);

    const dueAmount = useMemo(() => {
        if (!selectedBill) return 0;
        let due = parseFloat(selectedBill.balanceAmount || 0);
        if (editingId) {
            const p = payments.find(pay => pay.id === editingId);
            if (p) {
                due += parseFloat(p.amount || 0) + parseFloat(p.discountAmount || 0);
            }
        }
        return due;
    }, [selectedBill, editingId, payments]);

    // ── Initial load ─────────────────────────────────────────────
    useEffect(() => {
        fetchInitialData();
        fetchPayments();
    }, []);

    useEffect(() => {
        if (targetPaymentId && payments.length > 0) {
            const p = payments.find(pay => pay.id === targetPaymentId);
            if (p) {
                handleView(p);
                // Clear navigation state
                navigate(location.pathname, { replace: true, state: { ...location.state, targetPaymentId: undefined } });
            }
        }
    }, [targetPaymentId, payments]);

    // Handle source data auto-fill (from Bill page)
    useEffect(() => {
        if (sourceData && !editingId && allBills.length > 0) {
            const bill = allBills.find(b => b.id === parseInt(sourceData.billId));
            if (bill) {
                const vendor = vendors.find(v => v.id === bill.vendorId);
                setSelectedVendorId(bill.vendorId);
                setSelectedVendorName(vendor?.name || '');
                setSelectedBill(bill);
                setAmount(bill.balanceAmount || 0);
            }
            setShowAddModal(true);
        }
    }, [sourceData, editingId, allBills]);

    const fetchInitialData = async () => {
        try {
            const companyId = GetCompanyId();
            const [vendorRes, billRes, ledgerRes, companyRes] = await Promise.all([
                vendorService.getAllVendors(companyId),
                purchaseBillService.getBills(companyId),
                ledgerService.getAll(companyId),
                companyId ? companyService.getById(companyId) : Promise.resolve(null)
            ]);

            setVendors(vendorRes.data || vendorRes || []);

            if (billRes.success) {
                setAllBills(billRes.data.filter(b => b.balanceAmount > 0));
            }

            if (ledgerRes.data) {
                const allLeds = ledgerRes.data.data || ledgerRes.data || [];
                // Show Cash/Bank accounts and Equity accounts
                setAccounts(allLeds.filter(l =>
                    (l.accountgroup?.type === 'ASSETS' &&
                        !l.customerId &&
                        !l.vendorId &&
                        (l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank'))) ||
                    l.accountgroup?.type === 'EQUITY'
                ));

                // Direct Income filter
                setDiscountLedgers(allLeds.filter(l =>
                    l.accountgroup?.type === 'INCOME' &&
                    (l.accountsubgroup?.name?.toLowerCase().includes('sales') ||
                        l.accountsubgroup?.name?.toLowerCase().includes('direct') ||
                        l.name.toLowerCase().includes('sales') ||
                        l.name.toLowerCase().includes('direct') ||
                        l.name.toLowerCase().includes('discount received') ||
                        l.name.toLowerCase().includes('other income'))
                ));
            }

            if (companyRes?.data) {
                setCompanyDetails(companyRes.data);
                if (!editingId && !sourceData) {
                    setNotes(companyRes.data.notes || '');
                }
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        }
    };

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            const res = await purchasePaymentService.getPayments(companyId);
            setPayments(res.data || res || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (paymentId, newStatus) => {
        try {
            const companyId = GetCompanyId();
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };
            const res = await purchasePaymentService.updatePayment(paymentId, payload, companyId);
            if (res?.success || res?.data?.success) {
                toast.success('Status updated');
                fetchPayments();
            }
        } catch (error) {
            console.error('Error changing status:', error);
            toast.error('Failed to update status');
        }
    };

    // ── Filtered / derived data ──────────────────────────────────
    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            const q = searchTerm.toLowerCase();
            const matchSearch = !q ||
                p.paymentNumber?.toLowerCase().includes(q) ||
                p.vendor?.name?.toLowerCase().includes(q) ||
                p.purchasebill?.billNumber?.toLowerCase().includes(q);
            const dateObj = new Date(p.date);
            const matchStart = !startDate || dateObj >= new Date(startDate);
            const matchEnd = !endDate || dateObj <= new Date(endDate);
            return matchSearch && matchStart && matchEnd;
        });
    }, [payments, searchTerm, startDate, endDate]);

    const filteredVendors = useMemo(() =>
        vendors.filter(v =>
            v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
            v.email?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
            v.phone?.toLowerCase().includes(vendorSearch.toLowerCase())
        ),
        [vendors, vendorSearch]);

    // Bills for the selected vendor
    const vendorBills = useMemo(() => {
        if (!selectedVendorId) return [];
        let list = allBills.filter(b => b.vendorId === parseInt(selectedVendorId));

        // If editing, include any bills that are already allocated in this payment
        if (editingId && viewPayment?.allocations) {
            viewPayment.allocations.forEach(alloc => {
                const alreadyInList = list.some(item => item.id === alloc.purchaseBillId);
                if (!alreadyInList && alloc.purchasebill) {
                    list.push(alloc.purchasebill);
                }
            });
        }
        return list;
    }, [allBills, selectedVendorId, editingId, viewPayment]);

    // Filtered by search term
    const filteredVendorBills = useMemo(() => {
        if (!billSearch.trim()) return vendorBills;
        const q = billSearch.toLowerCase();
        return vendorBills.filter(b =>
            b.billNumber?.toLowerCase().includes(q)
        );
    }, [vendorBills, billSearch]);

    // Group all ledger accounts by account group
    const groupedAccounts = useMemo(() => {
        return accounts.reduce((acc, ledger) => {
            const group = ledger.accountgroup?.name || 'Other Accounts';
            if (!acc[group]) acc[group] = [];
            acc[group].push(ledger);
            return acc;
        }, {});
    }, [accounts]);

    // ── Handlers ─────────────────────────────────────────────────
    const resetForm = () => {
        setEditingId(null);
        setSelectedVendorId('');
        setSelectedVendorName('');
        setSelectedBill(null);
        setAccountId('');
        setAmount(0);
        setDiscountAmount(0);
        setDiscountLedgerId('');
        setVendorSearch('');
        setBillSearch('');
        setAllocations({});
        setPaymentMeta({ manualNo: '', date: new Date().toISOString().split('T')[0], mode: 'Bank Transfer' });
        setNotes(companyDetails.notes || '');
        setCustomFieldValues({});
    };

    const handleAllocationChange = (billId, value) => {
        setAllocations(prev => {
            const updated = { ...prev };
            if (value === '' || parseFloat(value) === 0) {
                delete updated[billId];
            } else {
                updated[billId] = parseFloat(value) || 0;
            }
            const newTotalAllocated = Object.values(updated).reduce((sum, val) => sum + parseFloat(val || 0), 0);
            const totalLimit = parseFloat(amount || 0) + parseFloat(discountAmount || 0);
            if (newTotalAllocated > totalLimit) {
                // Auto-expand amount only by the cash portion needed
                const cashNeeded = Math.max(0, newTotalAllocated - parseFloat(discountAmount || 0));
                setAmount(cashNeeded);
            }
            return updated;
        });
    };

    const handleAddNew = async () => {
        resetForm();
        let nextPayNo = '';
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getNextNumber(companyId, 'payment');
                if (res.data && res.data.success) {
                    nextPayNo = res.data.nextNumber;
                }
            }
        } catch (error) {
            console.error('Error fetching next payment number:', error);
        }
        setPaymentMeta(prev => ({
            ...prev,
            manualNo: nextPayNo
        }));
        setShowVendorSelect(true);
        setShowBillSelect(false);
        setShowAddModal(true);
    };

    const handleSelectVendor = (vendor) => {
        setSelectedVendorId(vendor.id);
        setSelectedVendorName(vendor.name);
        setSelectedBill(null);
        setAmount(0);
        setVendorSearch('');
        setBillSearch('');
        setShowVendorSelect(false);
        setShowBillSelect(true);
    };

    const handleSelectBill = (bill) => {
        setSelectedBill(bill);
        setAmount(bill.balanceAmount);
        setAllocations({ [bill.id]: bill.balanceAmount });
        setNotes(`Payment for Bill #${bill.billNumber}${companyDetails.notes ? '\n\n' + companyDetails.notes : ''}`);
        setShowBillSelect(false);
    };

    const handleEdit = (id) => {
        const p = payments.find(pay => pay.id === id);
        if (p) {
            resetForm();
            setEditingId(id);
            setSelectedVendorId(p.vendorId);
            setSelectedVendorName(p.vendor?.name || '');
            setSelectedBill(p.purchasebill || null);
            setAmount(p.amount);
            setDiscountAmount(p.discountAmount || 0);
            setDiscountLedgerId(p.discountLedgerId || '');
            setAccountId(p.cashBankAccountId || '');
            setPaymentMeta({
                manualNo: p.paymentNumber,
                date: p.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                mode: p.paymentMode || 'Bank Transfer'
            });
            setNotes(p.notes || '');

            const newAllocs = {};
            const discAmount = parseFloat(p.discountAmount || 0);
            if (p.allocations && p.allocations.length > 0) {
                p.allocations.forEach((a, idx) => {
                    newAllocs[a.purchaseBillId] = parseFloat(a.amount) + (idx === 0 ? discAmount : 0);
                });
            } else if (p.purchaseBillId && p.amount) {
                newAllocs[p.purchaseBillId] = parseFloat(p.amount) + discAmount;
            }
            setAllocations(newAllocs);

            let fieldValues = {};
            if (p.customFields) {
                try {
                    fieldValues = typeof p.customFields === 'string'
                        ? JSON.parse(p.customFields)
                        : p.customFields;
                } catch (e) {
                    console.error('Error parsing custom fields on edit:', e);
                }
            }
            setCustomFieldValues(fieldValues);

            setShowVendorSelect(false);
            setShowBillSelect(false);
            setShowAddModal(true);
        }
    };

    const handleView = async (payment) => {
        try {
            const companyId = GetCompanyId();
            const res = await purchasePaymentService.getPaymentById(payment.id, companyId);
            setViewPayment(res?.data || payment);
            setIsViewMode(true);
        } catch {
            setViewPayment(payment);
            setIsViewMode(true);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDelete = (id) => { setDeleteId(id); setShowDeleteConfirm(true); };

    const confirmDelete = async () => {
        try {
            const companyId = GetCompanyId();
            await purchasePaymentService.deletePayment(deleteId, companyId);
            toast.success('Payment deleted');
            fetchPayments();
            fetchInitialData();
        } catch (e) { console.error(e); }
        setShowDeleteConfirm(false);
        setDeleteId(null);
    };

    const handleSave = async () => {
        if (!selectedVendorId) { toast.error('Please select a vendor'); return; }
        if (!amount || amount <= 0) { toast.error('Please enter a valid amount'); return; }
        if (parseFloat(discountAmount || 0) > 0 && !discountLedgerId) { toast.error('Please select a Discount Account'); return; }

        const companyId = GetCompanyId();
        const discountVal = parseFloat(discountAmount || 0);
        const allocationsArray = Object.entries(allocations).map(([billId, amountVal], index) => {
            let allocAmount = parseFloat(amountVal);
            if (index === 0) {
                allocAmount = Math.max(0, allocAmount - discountVal);
            }
            return {
                purchaseBillId: parseInt(billId),
                amount: allocAmount
            };
        });

        const payload = {
            paymentNumber: paymentMeta.manualNo || `PAY-${Date.now()}`,
            vendorId: parseInt(selectedVendorId),
            purchaseBillId: selectedBill ? parseInt(selectedBill.id) : null,
            cashBankAccountId: accountId ? parseInt(accountId) : null,
            date: paymentMeta.date,
            amount: parseFloat(amount),
            discountAmount: parseFloat(discountAmount || 0),
            discountLedgerId: discountLedgerId ? parseInt(discountLedgerId) : null,
            paymentMode: paymentMeta.mode,
            companyId,
            notes,
            allocations: allocationsArray,
            customFields: JSON.stringify(customFieldValues)
        };

        try {
            if (editingId) {
                await purchasePaymentService.updatePayment(editingId, payload, companyId);
                toast.success('Payment updated');
            } else {
                await purchasePaymentService.createPayment(payload);
                toast.success('Payment recorded');
            }
            setShowAddModal(false);
            resetForm();
            fetchPayments();
            fetchInitialData();
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Failed to save payment');
        }
    };

    const purchaseProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'completed' },
        { id: 'purchase-order', label: 'Purchase Order', icon: ShoppingCart, status: 'completed' },
        { id: 'grn', label: 'Goods Receipt', icon: Truck, status: 'completed' },
        { id: 'bill', label: 'Bill', icon: Receipt, status: 'completed' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'active' },
    ];

    const selectedVendorObj = vendors.find(v => v.id === parseInt(selectedVendorId));

    return (
        <div className="PurchasePayment-page">

            {/* ── Page Header ── */}
            <div className="PurchasePayment-header">
                <div>
                    <h1 className="PurchasePayment-title">Purchase Payments</h1>
                    <p className="PurchasePayment-subtitle">Record and track vendor payments</p>
                </div>
                {hasPermission('create purchase payment') && (
                    <button className="PurchasePayment-btn-add" onClick={handleAddNew}>
                        <Plus size={18} /> Record Payment
                    </button>
                )}
            </div>

            {/* ── Process Tracker ── */}
            <div className="PurchasePayment-tracker-card">
                <div className="PurchasePayment-tracker-wrapper">
                    {purchaseProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`tracker-step ${step.status}`}>
                                <div className="PurchasePayment-step-icon">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="status-badge" size={14} />}
                                </div>
                                <span className="PurchasePayment-step-label">{step.label}</span>
                            </div>
                            {index < purchaseProcess.length - 1 && (
                                <div className={`tracker-divider ${purchaseProcess[index + 1].status !== 'pending' ? 'active' : ''}`}>
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* ── Table Card ── */}
            <div className="PurchasePayment-table-card">

                {/* Search + Date Filters */}
                <div className="SalesPayment-table-controls">
                    <div className="SalesPayment-search-control">
                        <Search size={18} className="SalesPayment-search-icon" />
                        <input
                            type="text"
                            placeholder="Search by payment no, vendor, bill…"
                            className="SalesPayment-search-input"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="SalesPayment-filter-group">
                        <div className="SalesPayment-filter-item">
                            <span className="text-sm text-gray-500">From:</span>
                            <input type="date" className="SalesPayment-filter-date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="SalesPayment-filter-item">
                            <span className="text-sm text-gray-500">To:</span>
                            <input type="date" className="SalesPayment-filter-date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="PurchasePayment-table-container">
                    <table className="PurchasePayment-table">
                        <thead>
                            <tr>
                                <th>PAYMENT ID</th>
                                <th>VENDOR</th>
                                <th>BILL REF</th>
                                <th>DATE</th>
                                <th>PAID FROM</th>
                                {/* <th>MODE</th> */}
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="text-center p-4">Loading...</td></tr>
                            ) : filteredPayments.length === 0 ? (
                                <tr><td colSpan="8" className="text-center p-4">No payments found</td></tr>
                            ) : (
                                filteredPayments.map(p => (
                                    <tr key={p.id}>
                                        <td className="PurchasePayment-id-text">#{p.paymentNumber}</td>
                                        <td className="PurchasePayment-vendor-text">{p.vendor?.name}</td>
                                        <td>{p.purchasebill?.billNumber || '-'}</td>
                                        <td>{new Date(p.date).toLocaleDateString()}</td>
                                        <td>{p.bankLedger?.name || '-'}</td>
                                        {/* <td><span className="PurchasePayment-mode-badge">{p.paymentMode}</span></td> */}
                                        <td className="PurchasePayment-amount-text">{formatCurrency(p.amount)}</td>
                                        <td>
                                            <select
                                                value={p.manualStatus ? p.status : 'AUTO'}
                                                onChange={(e) => handleStatusChange(p.id, e.target.value)}
                                                className="PurchasePayment-status-pill"
                                                style={getStatusStyle(p.manualStatus ? p.status : 'AUTO')}
                                            >
                                                <option value="AUTO">Auto ({p.status || 'Completed'})</option>
                                                <option value="PENDING">PENDING</option>
                                                <option value="COMPLETED">COMPLETED</option>
                                                <option value="CANCELLED">CANCELLED</option>
                                            </select>
                                        </td>
                                        <td className="text-right">
                                            <div className="PurchasePayment-action-buttons">
                                                <button className="PurchasePayment-btn-icon view" title="View" onClick={() => handleView(p)}><Eye size={16} /></button>
                                                {hasPermission('edit purchase payment') && (
                                                    <button className="PurchasePayment-btn-icon edit" title="Edit" onClick={() => handleEdit(p.id)}><Pencil size={16} /></button>
                                                )}
                                                {hasPermission('delete purchase payment') && (
                                                    <button className="PurchasePayment-btn-icon delete" title="Delete" onClick={() => handleDelete(p.id)}><Trash2 size={16} /></button>
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

            {/* ══════════════════════════════════════
                ADD / EDIT MODAL
            ══════════════════════════════════════ */}
            {showAddModal && (
                <div className="PurchasePayment-modal-overlay">
                    <div className="PurchasePayment-modal-container">

                        {/* Header */}
                        <div className="PurchasePayment-modal-header">
                            <div className="PurchasePayment-modal-title-area">
                                <h2>{editingId ? 'Edit Payment' : 'Record Payment'}</h2>
                                <p>Log payment against a vendor bill</p>
                            </div>
                            <button className="PurchasePayment-close-x" onClick={() => { setShowAddModal(false); resetForm(); }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="PurchasePayment-modal-body">

                            {/* ── STEP 1: Vendor Selection ── */}
                            {showVendorSelect && (
                                <div className="SalesPayment-selection-container">
                                    <div className="SalesPayment-modal-section-header">
                                        <h3 className="SalesPayment-text-sm font-bold SalesPayment-text-gray-700">Select Vendor</h3>
                                        <div className="SalesPayment-selection-search">
                                            <Search size={14} />
                                            <input
                                                type="text"
                                                placeholder="Search vendor…"
                                                value={vendorSearch}
                                                onChange={e => setVendorSearch(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    <div className="SalesPayment-customer-grid">
                                        {filteredVendors.map(v => (
                                            <div key={v.id} className="SalesPayment-selection-card" onClick={() => handleSelectVendor(v)}>
                                                <div className="SalesPayment-selection-card-icon">
                                                    <User size={20} />
                                                </div>
                                                <div className="SalesPayment-selection-card-info">
                                                    <div className="SalesPayment-selection-card-title">{v.name}</div>
                                                    <div className="SalesPayment-selection-card-subtitle">{v.email || v.phone || 'No contact info'}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredVendors.length === 0 && <div className="SalesPayment-no-results">No vendors found</div>}
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 2: Bill Selection ── */}
                            {showBillSelect && (
                                <div className="SalesPayment-selection-container">
                                    <div className="SalesPayment-modal-section-header">
                                        <h3 className="SalesPayment-text-sm font-bold SalesPayment-text-gray-700">
                                            Select Unpaid Bill for <span style={{ color: '#3b82f6' }}>{selectedVendorName}</span>
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div className="SalesPayment-selection-search">
                                                <Search size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Search bill no…"
                                                    value={billSearch}
                                                    onChange={e => setBillSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <button className="SalesPayment-btn-text" onClick={() => { setShowVendorSelect(true); setShowBillSelect(false); setBillSearch(''); }}>Change Vendor</button>
                                        </div>
                                    </div>
                                    <div className="SalesPayment-invoice-grid">
                                        {filteredVendorBills.map(bill => (
                                            <div key={bill.id} className="SalesPayment-selection-card SalesPayment-invoice-card" onClick={() => handleSelectBill(bill)}>
                                                <div className="SalesPayment-selection-card-info">
                                                    <div className="SalesPayment-selection-card-title">{bill.billNumber}</div>
                                                    <div className="SalesPayment-selection-card-subtitle">Date: {new Date(bill.date).toLocaleDateString()}</div>
                                                </div>
                                                <div className="SalesPayment-selection-card-action text-right">
                                                    <div className="SalesPayment-amount-label">Due</div>
                                                    <div className="SalesPayment-amount-value">{formatCurrency(bill.balanceAmount)}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredVendorBills.length === 0 && (
                                            <div className="SalesPayment-no-results">
                                                {billSearch ? `No bills matching "${billSearch}"` : 'No unpaid bills for this vendor'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="SalesPayment-selection-footer mt-4">
                                        <button className="SalesPayment-btn-secondary w-full" onClick={() => setShowBillSelect(false)}>
                                            Continue without linking to a bill
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── FORM (after vendor/bill chosen or editing) ── */}
                            {!showVendorSelect && !showBillSelect && (
                                <div className="PurchasePayment-form-body">

                                    {/* Company info strip */}
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
                                                {companyDetails.email && companyDetails.phone && <span className="SalesPayment-contact-separator">•</span>}
                                                <span>{companyDetails.phone}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Linked bill indicator */}
                                    {selectedBill && (
                                        <div className="SalesPayment-linked-indicator SalesPayment-mb-6">
                                            <Wallet size={16} /> Paying against Bill <strong>{selectedBill.billNumber}</strong>
                                            {!editingId && (
                                                <button className="SalesPayment-change-link-btn" onClick={() => { setShowBillSelect(true); }}>Change Bill</button>
                                            )}
                                        </div>
                                    )}

                                    {/* Vendor display */}
                                    {selectedVendorObj && (
                                        <div className="PurchasePayment-vendor-card" style={{ marginBottom: '1.25rem' }}>
                                            <div className="PurchasePayment-avatar">
                                                {selectedVendorObj.profileImage ? (
                                                    <img
                                                        src={selectedVendorObj.profileImage.startsWith('http') ? selectedVendorObj.profileImage : `${BASE_URL}/${selectedVendorObj.profileImage.replace(/\\/g, '/')}`}
                                                        alt="Vendor"
                                                    />
                                                ) : (
                                                    <div className="text-2xl font-bold text-gray-300">
                                                        {selectedVendorObj.name?.charAt(0) || 'V'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="PurchasePayment-vendor-info">
                                                <h3>{selectedVendorObj.name}</h3>
                                                <div className="PurchasePayment-vendor-meta">
                                                    <span>{selectedVendorObj.billingAddress || 'No address'}</span>
                                                    <span>{selectedVendorObj.email} {selectedVendorObj.phone ? '• ' + selectedVendorObj.phone : ''}</span>
                                                    <div className="mt-2" style={{ color: '#1e293b', fontWeight: '700' }}>
                                                        Vendor Balance: {formatCurrency(selectedVendorObj.ledger?.currentBalance || 0)}
                                                    </div>
                                                </div>
                                            </div>
                                            {!editingId && (
                                                <button
                                                    className="SalesPayment-btn-text"
                                                    style={{ marginLeft: 'auto', alignSelf: 'center' }}
                                                    onClick={() => { setShowVendorSelect(true); }}
                                                >
                                                    Change Vendor
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Form Grid ── */}
                                    <div className="PurchasePayment-form-grid">

                                        <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Vendor Name</label>
                                            <input
                                                type="text"
                                                className="PurchasePayment-input font-medium"
                                                value={selectedVendorName}
                                                disabled
                                            />
                                        </div>

                                        <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Payment Date</label>
                                            <input
                                                type="date"
                                                value={paymentMeta.date}
                                                onChange={e => setPaymentMeta({ ...paymentMeta, date: e.target.value })}
                                                className="PurchasePayment-input font-medium"
                                            />
                                        </div>

                                        {/* <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Payment Mode</label>
                                            <select
                                                className="PurchasePayment-select font-medium"
                                                value={paymentMeta.mode}
                                                onChange={e => setPaymentMeta({ ...paymentMeta, mode: e.target.value })}
                                            >
                                                <option>Bank Transfer</option>
                                                <option>UPI</option>
                                                <option>Online</option>
                                                <option>Cash</option>
                                                <option>Credit Card</option>
                                                <option>Cheque</option>
                                            </select>
                                        </div> */}

                                        {/* Credit To Account — all ledgers grouped */}
                                        <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Credit To Account</label>
                                            <select
                                                className="PurchasePayment-select font-medium"
                                                value={accountId}
                                                onChange={e => setAccountId(e.target.value)}
                                            >
                                                <option value="">Select Account…</option>
                                                {Object.entries(groupedAccounts).sort().map(([groupName, groupLedgers]) => (
                                                    <optgroup key={groupName} label={groupName}>
                                                        {groupLedgers.map(acc => (
                                                            <option key={acc.id} value={acc.id}>
                                                                {acc.name} ({formatCurrency(acc.currentBalance)})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    Select the account to credit this payment against.
                                                </div>
                                                {accountId && accounts.find(a => a.id === parseInt(accountId)) && (
                                                    <div style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: '600' }}>
                                                        Balance: {formatCurrency(accounts.find(a => a.id === parseInt(accountId)).currentBalance)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Payment Number</label>
                                            <input
                                                type="text"
                                                value={paymentMeta.manualNo}
                                                placeholder="e.g. PAY-0001"
                                                onChange={e => setPaymentMeta({ ...paymentMeta, manualNo: e.target.value })}
                                                className="PurchasePayment-input font-medium"
                                            />
                                        </div>

                                        <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Amount Paid</label>
                                            <input
                                                type="number"
                                                className="PurchasePayment-input font-bold text-lg"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                            />
                                        </div>

                                        <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Discount Received</label>
                                            <input
                                                type="number"
                                                className="PurchasePayment-input font-medium"
                                                value={discountAmount}
                                                onChange={e => {
                                                    const valStr = e.target.value;
                                                    setDiscountAmount(valStr);
                                                    const val = parseFloat(valStr || 0);
                                                    if (selectedBill) {
                                                        setAmount(Math.max(0, dueAmount - val));
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="PurchasePayment-form-group">
                                            <label className="PurchasePayment-label">Discount Account</label>
                                            <select
                                                className="PurchasePayment-select font-medium"
                                                disabled={parseFloat(discountAmount || 0) <= 0}
                                                value={discountLedgerId}
                                                onChange={e => setDiscountLedgerId(e.target.value)}
                                            >
                                                <option value="">Select Account…</option>
                                                {discountLedgers.map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                                Direct Income ledgers. Required if discount is &gt; 0.
                                            </div>
                                        </div>

                                        {/* Custom Fields Section */}
                                        {getCustomFieldsForType('payment').length > 0 && (
                                            <div className="PurchasePayment-form-group full-width" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                                                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>
                                                    Custom Fields
                                                </h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                                    {getCustomFieldsForType('payment').map(field => (
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

                                        <div className="PurchasePayment-form-group full-width">
                                            <label className="PurchasePayment-label">Notes</label>
                                            <textarea
                                                className="PurchasePayment-textarea"
                                                placeholder="Add internal notes or remarks…"
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                            />
                                        </div>

                                        {/* Inline allocations table */}
                                        <div className="SalesPayment-allocations-section" style={{ marginTop: '24px', gridColumn: 'span 2' }}>
                                            <h3 className="SalesPayment-form-label" style={{ fontWeight: '700', color: '#475569', marginBottom: '10px' }}>Bill Allocations</h3>
                                            {vendorBills.length > 0 ? (
                                                <div className="SalesPayment-allocations-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
                                                    <table className="SalesPayment-allocations-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                            <tr>
                                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '600', color: '#64748b' }}>Bill No</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '600', color: '#64748b' }}>Date</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>Total Amount</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>Due Balance</th>
                                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '600', color: '#64748b', width: '150px' }}>Allocation</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {vendorBills.map(bill => {
                                                                const maxDue = getBillAvailableBalance(bill.id, bill.balanceAmount);
                                                                const allocatedVal = allocations[bill.id] !== undefined ? allocations[bill.id] : '';
                                                                return (
                                                                    <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '12px 16px', fontWeight: '500', color: '#1e293b' }}>{bill.billNumber}</td>
                                                                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(bill.date).toLocaleDateString()}</td>
                                                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1e293b' }}>{formatCurrency(bill.totalAmount)}</td>
                                                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#d97706' }}>{formatCurrency(maxDue)}</td>
                                                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                                            <input
                                                                                type="number"
                                                                                className="PurchasePayment-input"
                                                                                style={{ margin: 0, padding: '4px 8px', textAlign: 'right', width: '120px', display: 'inline-block' }}
                                                                                value={allocatedVal}
                                                                                placeholder="0.00"
                                                                                min="0"
                                                                                max={maxDue}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    const num = parseFloat(val) || 0;
                                                                                    const capped = num > maxDue ? maxDue : num;
                                                                                    handleAllocationChange(bill.id, val === '' ? '' : capped);
                                                                                }}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ color: '#64748b', fontSize: '0.875rem', fontStyle: 'italic', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                    No unpaid bills found for this vendor. Any payment made will be recorded as advance/on account.
                                                </div>
                                            )}

                                            {/* Allocation Summary Info */}
                                            <div className="SalesPayment-allocation-summary" style={{ marginTop: '16px', padding: '16px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                                                <div>
                                                    <span style={{ color: '#64748b', marginRight: '8px' }}>Total Paid:</span>
                                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>{formatCurrency(amount || 0)}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#64748b', marginRight: '8px' }}>Total Allocated:</span>
                                                    <span style={{ fontWeight: '700', color: '#2563eb' }}>{formatCurrency(totalAllocated)}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#64748b', marginRight: '8px' }}>Unallocated (Advance):</span>
                                                    <span style={{ fontWeight: '700', color: remainingAmount > 0.01 ? '#16a34a' : '#64748b' }}>
                                                        {formatCurrency(remainingAmount)}
                                                    </span>
                                                </div>
                                            </div>
                                            {totalAllocated > (parseFloat(amount || 0) + parseFloat(discountAmount || 0)) && (
                                                <div style={{ marginTop: '12px', padding: '12px', borderRadius: '6px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.875rem', fontWeight: '500' }}>
                                                    ⚠️ Total allocated amount ({formatCurrency(totalAllocated)}) cannot exceed the sum of paid amount and discount ({formatCurrency(parseFloat(amount || 0) + parseFloat(discountAmount || 0))}). Please adjust allocations or increase the paid amount.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {!showVendorSelect && !showBillSelect && (
                            <div className="PurchasePayment-modal-footer">
                                <button className="PurchasePayment-btn PurchasePayment-btn-print" onClick={handlePrint}>
                                    <Printer size={18} /> Print Receipt
                                </button>
                                <button className="PurchasePayment-btn PurchasePayment-btn-cancel" onClick={() => { setShowAddModal(false); resetForm(); }}>
                                    Cancel
                                </button>
                                <button className="PurchasePayment-btn PurchasePayment-btn-save" disabled={!selectedVendorId || !accountId || amount <= 0 || (parseFloat(discountAmount || 0) > 0 && !discountLedgerId) || totalAllocated > (parseFloat(amount || 0) + parseFloat(discountAmount || 0))} onClick={handleSave}>
                                    {editingId ? 'Update Payment' : 'Save Payment'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════
                VIEW MODE MODAL
            ══════════════════════════════════════ */}
            {isViewMode && viewPayment && (
                <div className="pp-view-modal-overlay">
                    <div className="pp-view-modal-container">

                        {/* Modal Header */}
                        <div className="pp-view-modal-header no-print">
                            <h1 className="pp-view-modal-title">View Payment</h1>
                            <div className="pp-view-modal-actions">
                                <button className="pp-view-btn-print" onClick={handlePrint}>
                                    <Printer size={16} /> Print Receipt
                                </button>
                                <button className="pp-view-close-btn" onClick={() => setIsViewMode(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="pp-view-modal-body">
                            <div className="pp-receipt-view-container" id="payment-print-area">

                                {/* ── Receipt Header: Company + Payment Title ── */}
                                <div className="pp-receipt-header">
                                    <div className="pp-receipt-company-section">
                                        {companyDetails.logo && (
                                            <div className="pp-receipt-logo">
                                                <img src={companyDetails.logo} alt="Company Logo" />
                                            </div>
                                        )}
                                        <div className="pp-receipt-company-details">
                                            <h2 className="pp-receipt-company-name">{companyDetails.name || 'Your Company'}</h2>
                                            {companyDetails.email && <p className="pp-receipt-company-text">{companyDetails.email}</p>}
                                            {companyDetails.phone && <p className="pp-receipt-company-text">{companyDetails.phone}</p>}
                                            {companyDetails.address && <p className="pp-receipt-company-text">{companyDetails.address}</p>}
                                        </div>
                                    </div>
                                    <div className="pp-receipt-meta-section">
                                        <h1 className="pp-receipt-title">{getDocumentTitle('purchasepayment')}</h1>
                                        <div className="pp-receipt-meta-details">
                                            <p>
                                                <span className="pp-receipt-meta-label">{getReceiptPaymentLabel('number', 'Receipt No:')}</span>
                                                {viewPayment.paymentNumber}
                                            </p>
                                            <p>
                                                <span className="pp-receipt-meta-label">{getReceiptPaymentLabel('date', 'Payment Date:')}</span>
                                                {new Date(viewPayment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </p>
                                            {viewPayment.purchasebill?.billNumber && (
                                                <p>
                                                    <span className="pp-receipt-meta-label">{getReceiptPaymentLabel('invoiceRef', 'Invoice Ref:')}</span>
                                                    #{viewPayment.purchasebill.billNumber}
                                                </p>
                                            )}
                                        </div>
                                        <div className="pp-receipt-qr-code">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(viewPayment.paymentNumber || 'Payment')}`}
                                                alt="QR"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="PurchasePayment-divider" style={{ margin: '20px 0', borderTop: '1px solid #e2e8f0' }}></div>

                                {/* ── Vendor + Payment Summary ── */}
                                <div className="pp-receipt-addresses">
                                    <div className="pp-receipt-bill-to">
                                        <h3 className="pp-receipt-section-title">{getReceiptPaymentLabel('receivedFrom', 'RECEIVED FROM:')}</h3>
                                        <p className="pp-receipt-vendor-name">{viewPayment.vendor?.name || '—'}</p>
                                        {viewPayment.vendor?.city && <p className="pp-receipt-vendor-address">{viewPayment.vendor.city}</p>}
                                        {[viewPayment.vendor?.city, viewPayment.vendor?.state].filter(Boolean).length > 0 && (
                                            <p className="pp-receipt-vendor-city">
                                                {[viewPayment.vendor?.city, viewPayment.vendor?.state].filter(Boolean).join(' ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="pp-receipt-ship-to">
                                        <h3 className="pp-receipt-section-title" style={{ textAlign: 'right' }}>PAYMENT SUMMARY:</h3>
                                        <p className="pp-receipt-vendor-address" style={{ textAlign: 'right' }}>
                                            <span style={{ color: '#64748b' }}>{getReceiptPaymentLabel('receivedInto', 'Paid From:')}</span> {viewPayment.bankLedger?.name || 'N/A'}
                                        </p>
                                        <p className="pp-receipt-vendor-address" style={{ textAlign: 'right' }}>
                                            <span style={{ color: '#64748b' }}>{getReceiptPaymentLabel('mode', 'Payment Mode:')}</span> {viewPayment.paymentMode || 'BANK'}
                                        </p>
                                        <p className="pp-receipt-vendor-address" style={{ textAlign: 'right' }}>
                                            <span style={{ color: '#64748b' }}>{getReceiptPaymentLabel('refNo', 'Ref No:')}</span> {viewPayment.referenceNo || '1200'}
                                        </p>
                                        {viewPayment.discountAmount > 0 && (
                                            <>
                                                <p className="pp-receipt-vendor-address" style={{ textAlign: 'right' }}>
                                                    <span style={{ color: '#64748b' }}>{getReceiptPaymentLabel('discount', 'Discount Received:')}</span> {formatCurrency(viewPayment.discountAmount)}
                                                </p>
                                                <p className="pp-receipt-vendor-address" style={{ textAlign: 'right' }}>
                                                    <span style={{ color: '#64748b' }}>{getReceiptPaymentLabel('discountAccount', 'Discount Account:')}</span> {viewPayment.discountLedger?.name || 'N/A'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ── Satisfaction Banner ── */}
                                <div className="pp-receipt-satisfaction-banner">
                                    <p className="pp-receipt-satisfaction-text">
                                        {getReceiptPaymentLabel('satisfaction', 'The sum of {amount} {discountText} was received in full satisfaction of the mentioned account.')
                                            .replace('{amount}', formatCurrency(viewPayment.amount))
                                            .replace('{discountText}', viewPayment.discountAmount > 0 ? `(with ${formatCurrency(viewPayment.discountAmount)} discount received)` : '')
                                        }
                                    </p>
                                    <span className="pp-receipt-satisfaction-amount">{formatCurrency(viewPayment.amount)}</span>
                                </div>

                                {/* ── Applied To Bill Section ── */}
                                {((viewPayment.allocations && viewPayment.allocations.length > 0) || viewPayment.purchasebill) && (
                                    <div className="pp-receipt-applied-section">
                                        <h3 className="pp-receipt-section-title">APPLIED TO BILLS:</h3>
                                        <table className="pp-receipt-table">
                                            <thead>
                                                <tr>
                                                    <th>{getReceiptPaymentHeader('billNumber', 'Bill Number')}</th>
                                                    <th>{getReceiptPaymentHeader('billDate', 'Bill Date')}</th>
                                                    <th>{getReceiptPaymentHeader('billAmount', 'Bill Amount')}</th>
                                                    <th>{getReceiptPaymentHeader('allocatedAmount', 'Allocated Amount')}</th>
                                                    <th style={{ textAlign: 'right' }}>{getReceiptPaymentHeader('balanceDue', 'Balance Due')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewPayment.allocations && viewPayment.allocations.length > 0 ? (
                                                    viewPayment.allocations.map((alloc, index) => (
                                                        <tr key={alloc.id}>
                                                            <td>{alloc.purchasebill?.billNumber || `ID: ${alloc.purchaseBillId}`}</td>
                                                            <td>
                                                                {alloc.purchasebill?.date
                                                                    ? new Date(alloc.purchasebill.date).toLocaleDateString()
                                                                    : '—'
                                                                }
                                                            </td>
                                                            <td>{formatCurrency(alloc.purchasebill?.totalAmount || 0)}</td>
                                                            <td>{formatCurrency(parseFloat(alloc.amount || 0) + (index === 0 ? parseFloat(viewPayment.discountAmount || 0) : 0))}</td>
                                                            <td style={{ textAlign: 'right' }}>{formatCurrency(alloc.purchasebill?.balanceAmount || 0)}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    // Fallback to legacy single bill link
                                                    <tr>
                                                        <td>{viewPayment.purchasebill?.billNumber || '—'}</td>
                                                        <td>
                                                            {viewPayment.purchasebill?.date
                                                                ? new Date(viewPayment.purchasebill.date).toLocaleDateString()
                                                                : '—'
                                                            }
                                                        </td>
                                                        <td>{formatCurrency(viewPayment.purchasebill?.totalAmount || (parseFloat(viewPayment.amount || 0) + parseFloat(viewPayment.discountAmount || 0)))}</td>
                                                        <td>{formatCurrency(parseFloat(viewPayment.amount || 0) + parseFloat(viewPayment.discountAmount || 0))}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(viewPayment.purchasebill?.balanceAmount || 0)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Custom Fields View */}
                                {(() => {
                                    let customFieldVals = {};
                                    if (viewPayment?.customFields) {
                                        try {
                                            customFieldVals = typeof viewPayment.customFields === 'string'
                                                ? JSON.parse(viewPayment.customFields)
                                                : viewPayment.customFields;
                                        } catch (e) {
                                            console.error('Error parsing payment custom fields for view:', e);
                                        }
                                    }
                                    const fieldsList = getCustomFieldsForType('payment');
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

                                {/* ── Footer Section with Remarks and Signature ── */}
                                <div className="pp-receipt-footer-details">
                                    <div className="pp-receipt-remarks-title">{getReceiptPaymentLabel('notes', 'Remarks / Notes:')}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div className="pp-receipt-remarks-content">
                                            This accounting software is designed to assist users in managing financial data such as invoices, expenses, payments, reports, and tax-related records. All information and reports generated by the system depend on the data entered by the user, and users should verify details before final submission. The software may receive updates, improvements, or feature changes to enhance performance, accuracy, and security. Regular data backups are recommended to avoid potential data loss.
                                        </div>
                                        <div className="pp-receipt-signature-section">
                                            <div className="pp-receipt-signature-line"></div>
                                            <div className="pp-receipt-signature-label">{getReceiptPaymentLabel('signature', 'AUTHORIZED SIGNATURE')}</div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation ── */}
            {showDeleteConfirm && (
                <div className="PurchasePayment-delete-modal-overlay">
                    <div className="PurchasePayment-delete-box">
                        <div className="PurchasePayment-delete-header">
                            <h3 className="PurchasePayment-delete-title"><Trash2 size={20} /> Delete Payment?</h3>
                            <button className="PurchasePayment-delete-close-x" onClick={() => setShowDeleteConfirm(false)}><X size={20} /></button>
                        </div>
                        <div className="PurchasePayment-delete-body">
                            <p>Are you sure you want to delete this payment record? This action cannot be undone and will affect your ledger balances.</p>
                        </div>
                        <div className="PurchasePayment-delete-footer">
                            <button className="PurchasePayment-delete-btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button className="PurchasePayment-delete-btn-confirm" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payment;
