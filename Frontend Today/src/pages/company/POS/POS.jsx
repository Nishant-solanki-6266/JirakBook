import React, { useState, useEffect, useContext } from 'react';
import { CompanyContext } from '../../../context/CompanyContext';
import { AuthContext } from '../../../context/AuthContext';
import {
    Search,
    Grid,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    User,
    CreditCard,
    Home,
    Package,
    RefreshCw,
    X,
    Check,
    Printer,
    FileText
} from 'lucide-react';
import './POS.css';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import posService from '../../../services/posService';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';
import customerService from '../../../services/customerService';
import companyService from '../../../api/companyService';
import GetCompanyId from '../../../api/GetCompanyId';
import chartOfAccountsService from '../../../services/chartOfAccountsService';
import uomService from '../../../services/uomService';
import inventoryService from '../../../services/inventoryService';

const POS = () => {
    const { id } = useParams();
    const { formatCurrency, getInvoiceLabel, getDocumentTitle } = useContext(CompanyContext);
    const { hasPermission } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Payment States
    const [paymentStatus, setPaymentStatus] = useState('Paid'); // Paid, Partial, Due
    const [partialAmount, setPartialAmount] = useState('');
    const [selectedTax, setSelectedTax] = useState(10); // Default 10%

    // Split Payments States
    const [cashReceived, setCashReceived] = useState('');
    const [cardReceived, setCardReceived] = useState('');
    const [cashAccountId, setCashAccountId] = useState('');
    const [cardAccountId, setCardAccountId] = useState('');

    // Modal States
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('Cash'); // Cash, Card, UPI
    const [notes, setNotes] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedDueAccountId, setSelectedDueAccountId] = useState('');

    // Autocomplete & Quick Customer States
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
    const [quickCustomerName, setQuickCustomerName] = useState('');
    const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
    const [quickCustomerEmail, setQuickCustomerEmail] = useState('');
    const [quickCustomerSubmitting, setQuickCustomerSubmitting] = useState(false);

    // Data States
    const [categories, setCategories] = useState(['All']);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [companyDetails, setCompanyDetails] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [allAccounts, setAllAccounts] = useState([]);
    const [allUoms, setAllUoms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [customFieldValues, setCustomFieldValues] = useState({});
    const getCustomFieldsForType = (type) => {
        if (!companyDetails?.customFieldsConfig) return [];
        try {
            const parsed = typeof companyDetails.customFieldsConfig === 'string'
                ? JSON.parse(companyDetails.customFieldsConfig)
                : companyDetails.customFieldsConfig;
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
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            const ledgerId = selectedCustomer.ledgerId || selectedCustomer.ledger?.id;
            if (ledgerId) {
                setSelectedDueAccountId(ledgerId);
            }
        } else {
            // Default to walk-in or first asset account
            const walkin = accounts.find(a => a.name.toLowerCase().includes('walk-in'));
            if (walkin) {
                setSelectedDueAccountId(walkin.id);
            } else if (accounts.length > 0) {
                setSelectedDueAccountId(accounts[0].id);
            }
        }
    }, [selectedCustomer, accounts]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.companypos-customer-select-wrapper')) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            const promises = [
                categoryService.getCategories(companyId),
                productService.getProducts(companyId),
                customerService.getAllCustomers(companyId),
                chartOfAccountsService.getAllLedgers(companyId),
                uomService.getUOMs(companyId),
                inventoryService.getWarehouses(companyId)
            ];

            if (companyId) {
                promises.push(companyService.getById(companyId));
            }

            const results = await Promise.all(promises);
            const catsRes = results[0];
            const prodsRes = results[1];
            const custsRes = results[2];
            const accountsRes = results[3];
            const uomRes = results[4];
            const warehouseRes = results[5];
            const compRes = companyId ? results[6] : null;

            if (catsRes && catsRes.data) {
                setCategories(['All', ...catsRes.data.map(c => c.name)]);
            }

            if (uomRes && uomRes.success) {
                setAllUoms(uomRes.data);
            }

            let mappedProducts = [];
            if (prodsRes && prodsRes.data) {
                mappedProducts = prodsRes.data.map(p => {
                    const totalStock = p.stock ? p.stock.reduce((sum, s) => sum + s.quantity, 0) : 0;
                    const defaultWarehouseId = p.stock && p.stock.length > 0 ? p.stock[0].warehouseId : (p.stocks && p.stocks.length > 0 ? p.stocks[0].warehouseId : null);

                    return {
                        id: p.id,
                        name: p.name,
                        price: p.salePrice || 0,
                        category: p.category?.name || 'Uncategorized',
                        stock: totalStock,
                        stocks: p.stock || [],
                        image: p.image,
                        warehouseId: defaultWarehouseId,
                        taxRate: p.taxAccount ? 10 : 10,
                        uomId: p.salesUomId || p.uomId || '',
                        uom: p.uom,
                        salesUom: p.salesUom,
                        purchaseUom: p.purchaseUom
                    };
                });
                setProducts(mappedProducts);
            }

            if (custsRes && custsRes.data) {
                setCustomers(custsRes.data);
            }

            if (compRes && compRes.data) {
                setCompanyDetails(compRes.data);
            }

            if (warehouseRes && warehouseRes.success) {
                setWarehouses(warehouseRes.data);
                if (warehouseRes.data.length > 0 && !id) {
                    setSelectedWarehouseId(warehouseRes.data[0].id.toString());
                }
            }

            if (accountsRes && accountsRes.success) {
                setAllAccounts(accountsRes.data);
                // Filter for Cash/Bank accounts or just show all assets
                const assetAccounts = accountsRes.data.filter(a =>
                    a.accountgroup?.type === 'ASSETS' ||
                    a.name.toLowerCase().includes('cash') ||
                    a.name.toLowerCase().includes('bank')
                );
                setAccounts(assetAccounts);
                if (assetAccounts.length > 0) {
                    setSelectedAccountId(assetAccounts[0].id);

                    // Default Due Account (Walk-in Ledger or first asset)
                    const walkin = assetAccounts.find(a => a.name.toLowerCase().includes('walk-in'));
                    setSelectedDueAccountId(walkin ? walkin.id : assetAccounts[0].id);

                    const cashLedger = assetAccounts.find(a => a.name.toLowerCase().includes('cash'));
                    const bankLedger = assetAccounts.find(a => a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('card') || a.name.toLowerCase().includes('upi'));
                    setCashAccountId(cashLedger ? cashLedger.id : assetAccounts[0].id);
                    setCardAccountId(bankLedger ? bankLedger.id : assetAccounts[0].id);
                }
            }

            // Load existing invoice if id is present (Edit Mode)
            if (id) {
                const invRes = await posService.getPOSInvoiceById(id, companyId);
                if (invRes && invRes.success) {
                    const invoice = invRes.data;
                    setNotes(invoice.notes || '');
                    setSelectedTax(invoice.posinvoiceitem[0]?.taxRate || 10);
                    const firstWhId = invoice.posinvoiceitem[0]?.warehouseId;
                    if (firstWhId) setSelectedWarehouseId(firstWhId.toString());
                    
                    if (invoice.customerId) {
                        const cust = custsRes.data.find(c => c.id === invoice.customerId);
                        setSelectedCustomer(cust || null);
                        if (cust) setCustomerSearchTerm(cust.name);
                    } else {
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                    }
                    
                    if (invoice.balanceAmount === 0) {
                        setPaymentStatus('Paid');
                    } else if (invoice.paidAmount === 0) {
                        setPaymentStatus('Due Payment');
                    } else {
                        setPaymentStatus('Partial');
                        setPartialAmount(invoice.paidAmount.toString());
                    }
                    
                    // Parse split payments from receipts
                    const receipts = invoice.receipt || [];
                    let cashAmt = 0;
                    let cardAmt = 0;
                    let cashAccId = '';
                    let cardAccId = '';
                    
                    receipts.forEach(r => {
                        const name = (r.cashBankAccount?.name || '').toLowerCase();
                        if (name.includes('cash')) {
                            cashAmt += r.amount;
                            cashAccId = r.cashBankAccount?.id || '';
                        } else {
                            cardAmt += r.amount;
                            cardAccId = r.cashBankAccount?.id || '';
                        }
                    });
                    
                    setCashReceived(cashAmt > 0 ? cashAmt.toString() : '');
                    setCardReceived(cardAmt > 0 ? cardAmt.toString() : '');
                    if (cashAccId) setCashAccountId(cashAccId);
                    if (cardAccId) setCardAccountId(cardAccId);
                    
                    // Map invoice items to cart, adjusting their stock bounds to include original qty
                    const invoiceCart = invoice.posinvoiceitem.map((item, idx) => {
                        const matchedProd = mappedProducts.find(p => p.id === item.productId) || {};
                        return {
                            id: item.productId,
                            cartItemId: `cart-${item.productId}-${idx}-${Date.now()}`,
                            name: matchedProd.name || item.description || 'Product',
                            price: item.rate,
                            qty: item.quantity,
                            uomId: item.uomId,
                            warehouseId: item.warehouseId || 1,
                            stock: (matchedProd.stock || 0) + item.quantity,
                            uom: matchedProd.uom || item.product?.uom,
                            salesUom: matchedProd.salesUom || item.product?.salesUom,
                            purchaseUom: matchedProd.purchaseUom || item.product?.purchaseUom
                        };
                    });
                    setCart(invoiceCart);

                    let fieldValues = {};
                    if (invoice.customFields) {
                        try {
                            fieldValues = typeof invoice.customFields === 'string'
                                ? JSON.parse(invoice.customFields)
                                : invoice.customFields;
                        } catch (e) {
                            console.error('Error parsing POS custom fields on edit:', e);
                        }
                    }
                    setCustomFieldValues(fieldValues);
                }
            }

        } catch (error) {
            console.error("Error fetching POS data:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(product => {
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const filteredCustomers = customers.filter(c => {
        const term = customerSearchTerm.toLowerCase();
        return c.name.toLowerCase().includes(term) || (c.phone && c.phone.toLowerCase().includes(term));
    });

    const getProductStockForWarehouse = (product, whId) => {
        if (!whId) {
            return product.stock || 0;
        }
        const parsedWhId = parseInt(whId);
        const warehouseStock = product.stocks?.find(s => s.warehouseId === parsedWhId);
        return warehouseStock ? warehouseStock.quantity : 0;
    };

    // Cart Logic
    const addToCart = (product) => {
        const whId = selectedWarehouseId;
        const availableStock = getProductStockForWarehouse(product, whId);

        if (availableStock <= 0) {
            toast.error("Out of stock in selected warehouse");
            return;
        }

        setCart(prevCart => {
            return [...prevCart, { 
                ...product, 
                cartItemId: `cart-${product.id}-${Date.now()}-${Math.random()}`,
                qty: 1, 
                stock: availableStock,
                warehouseId: whId ? parseInt(whId) : (product.warehouseId || 1)
            }];
        });
    };

    const removeFromCart = (cartItemId) => {
        setCart(prevCart => prevCart.filter(item => item.cartItemId !== cartItemId));
    };

    const updateQty = (cartItemId, change) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.cartItemId === cartItemId) {
                    const currentQty = parseFloat(item.qty) || 0;
                    const newQty = currentQty + change;
                    if (newQty < 1) return item;
                    const stockLimit = item.stock;
                    if (newQty > stockLimit) {
                        toast.error("Not enough stock");
                        return item;
                    }
                    return { ...item, qty: newQty };
                }
                return item;
            });
        });
    };

    const handleQtyChange = (cartItemId, val) => {
        if (val === '') {
            setCart(prevCart => prevCart.map(item => item.cartItemId === cartItemId ? { ...item, qty: '' } : item));
            return;
        }
        const newQty = parseFloat(val);
        if (isNaN(newQty) || newQty < 1) return;
        const itemInCart = cart.find(item => item.cartItemId === cartItemId);
        const stockLimit = itemInCart ? itemInCart.stock : 0;
        if (newQty > stockLimit) {
            toast.error(`Only ${stockLimit} units available in stock`);
            setCart(prevCart => prevCart.map(item => item.cartItemId === cartItemId ? { ...item, qty: stockLimit } : item));
            return;
        }
        setCart(prevCart => prevCart.map(item => item.cartItemId === cartItemId ? { ...item, qty: newQty } : item));
    };

    const updateCartItemUom = (cartItemId, newUomId) => {
        setCart(prevCart => prevCart.map(item => {
            if (item.cartItemId === cartItemId) {
                const newUom = allUoms.find(u => u.id === newUomId) || item.uom || item.salesUom;
                const basePrice = products.find(p => p.id === item.id)?.price || item.price;
                const multiplier = newUom?.uomType === 'Compound' ? parseFloat(newUom.conversionRate) || 1 : 1;
                return {
                    ...item,
                    uomId: newUomId,
                    price: basePrice * multiplier
                };
            }
            return item;
        }));
    };

    const handlePriceChange = (cartItemId, val) => {
        if (val === '') {
            setCart(prevCart => prevCart.map(item => item.cartItemId === cartItemId ? { ...item, price: '' } : item));
            return;
        }
        const newPrice = parseFloat(val);
        if (isNaN(newPrice) || newPrice < 0) return;
        setCart(prevCart => prevCart.map(item => item.cartItemId === cartItemId ? { ...item, price: newPrice } : item));
    };

    const handleWarehouseChange = (whId) => {
        setSelectedWarehouseId(whId);
        setCart(prevCart => prevCart.map(item => {
            const matchedProd = products.find(p => p.id === item.id) || {};
            const availableStock = getProductStockForWarehouse(matchedProd, whId);
            const currentQty = parseFloat(item.qty) || 1;
            const cappedQty = currentQty > availableStock ? Math.max(1, availableStock) : currentQty;
            return {
                ...item,
                warehouseId: whId ? parseInt(whId) : (item.warehouseId || 1),
                stock: availableStock,
                qty: cappedQty
            };
        }));
    };

    // Calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * (selectedTax / 100);
    const total = subtotal + tax;

    // Payment Logic
    const getPaidAmount = () => {
        if (paymentStatus === 'Paid') return total;
        if (paymentStatus === 'Due Payment') return 0;
        return parseFloat(partialAmount) || 0;
    };

    const amountDue = total - getPaidAmount();

    const handleOpenCheckout = () => {
        if (cart.length === 0) return;
        if (!id) {
            // New sale defaults
            if (paymentStatus === 'Paid') {
                if (paymentMethod === 'Cash') {
                    setCashReceived(total.toFixed(2));
                    setCardReceived('');
                } else {
                    setCardReceived(total.toFixed(2));
                    setCashReceived('');
                }
            } else if (paymentStatus === 'Partial') {
                const partialVal = parseFloat(partialAmount) || 0;
                if (paymentMethod === 'Cash') {
                    setCashReceived(partialVal.toFixed(2));
                    setCardReceived('');
                } else {
                    setCardReceived(partialVal.toFixed(2));
                    setCashReceived('');
                }
            } else { // Due Payment
                setCashReceived('');
                setCardReceived('');
            }
        }
        setIsCheckoutModalOpen(true);
    };

    const handleConfirmCheckout = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const companyId = GetCompanyId();
            
            // Build payments array
            const payments = [];
            const cashAmt = parseFloat(cashReceived) || 0;
            const cardAmt = parseFloat(cardReceived) || 0;
            
            if (cashAmt > 0) {
                payments.push({
                    amount: cashAmt,
                    paymentMode: 'CASH',
                    accountId: cashAccountId ? parseInt(cashAccountId) : null
                });
            }
            
            if (cardAmt > 0) {
                payments.push({
                    amount: cardAmt,
                    paymentMode: 'CARD',
                    accountId: cardAccountId ? parseInt(cardAccountId) : null
                });
            }
            
            const paidAmt = cashAmt + cardAmt;
            const remaining = total - paidAmt;
            
            let finalPaymentMode = 'CASH';
            if (cashAmt > 0 && cardAmt > 0) {
                finalPaymentMode = 'SPLIT';
            } else if (cardAmt > 0) {
                finalPaymentMode = 'CARD';
            }

            const payload = {
                companyId,
                customerId: selectedCustomer ? selectedCustomer.id : null,
                paymentMode: finalPaymentMode,
                notes: notes,
                customFields: JSON.stringify(customFieldValues),
                items: cart.map(item => ({
                    productId: item.id,
                    warehouseId: item.warehouseId ? parseInt(item.warehouseId) : (selectedWarehouseId ? parseInt(selectedWarehouseId) : 1),
                    uomId: item.uomId ? parseInt(item.uomId) : null,
                    quantity: parseFloat(item.qty) || 1,
                    rate: parseFloat(item.price) || 0,
                    discount: 0,
                    taxRate: selectedTax,
                    description: item.name
                })),
                discountAmount: 0,
                receivedAmount: paidAmt,
                accountId: cashAmt > 0 ? (parseInt(cashAccountId) || null) : (parseInt(cardAccountId) || null),
                dueAccountId: selectedDueAccountId ? parseInt(selectedDueAccountId) : null,
                payments
            };

            const response = id 
                ? await posService.updatePOSInvoice(id, payload, companyId)
                : await posService.createPOSInvoice(payload);

            if (response.success) {
                toast.success(id ? `Invoice Updated! #${response.data.invoiceNumber}` : `Invoice Created! #${response.data.invoiceNumber}`);

                // Prepare Invoice Data for Print
                const finalInvoice = {
                    ...payload,
                    invoiceNumber: response.data.invoiceNumber,
                    date: new Date().toISOString(),
                    dueDate: new Date().toISOString(),
                    customer: selectedCustomer,
                    totalAmount: total,
                    taxAmount: tax,
                    subTotal: subtotal,
                    paymentMethod: finalPaymentMode,
                    paidAmount: paidAmt,
                    balanceAmount: remaining > 0 ? remaining : 0
                };

                setInvoiceData(finalInvoice);
                setIsCheckoutModalOpen(false);
                setShowPrintModal(true);
            } else {
                toast.error('Failed to process invoice');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error processing invoice: ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleClosePrint = () => {
        setShowPrintModal(false);
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchTerm('');
        setShowCustomerDropdown(false);
        setNotes('');
        setCustomFieldValues({});
        setPaymentStatus('Paid');
        setPartialAmount('');
        setCashReceived('');
        setCardReceived('');
        if (id) {
            navigate('/company/pos/all-invoices');
        } else {
            fetchData();
        }
    };

    const handleCreateQuickCustomer = async (e) => {
        e.preventDefault();
        if (!quickCustomerName.trim()) {
            toast.error('Customer name is required');
            return;
        }

        setQuickCustomerSubmitting(true);
        try {
            const companyId = GetCompanyId();
            const payload = {
                name: quickCustomerName.trim(),
                phone: quickCustomerPhone.trim(),
                email: quickCustomerEmail.trim(),
                accountType: 'Cash',
                balanceType: 'Debit',
                accountBalance: 0,
                creationDate: new Date().toISOString().split('T')[0],
                gstEnabled: false,
                shippingSameAsBilling: true,
                billingName: quickCustomerName.trim(),
                billingPhone: quickCustomerPhone.trim(),
                billingAddress: '',
                billingCity: '',
                billingState: '',
                billingCountry: '',
                billingZipCode: '',
                shippingAddresses: []
            };

            const response = await customerService.createCustomer(payload);
            if (response.success) {
                toast.success('Customer created successfully');
                const newCust = response.data?.customer || response.data;
                
                // 1. Refresh allAccounts & accounts so the new ledger immediately exists in the selectable lists
                const accountsRes = await chartOfAccountsService.getAllLedgers(companyId);
                if (accountsRes && accountsRes.success) {
                    setAllAccounts(accountsRes.data);
                    const assetAccounts = accountsRes.data.filter(a =>
                        a.accountgroup?.type === 'ASSETS' ||
                        a.name.toLowerCase().includes('cash') ||
                        a.name.toLowerCase().includes('bank')
                    );
                    setAccounts(assetAccounts);
                }

                // 2. Refresh customer list and set the newly created customer as selected
                const custsRes = await customerService.getAllCustomers(companyId);
                if (custsRes && custsRes.data) {
                    setCustomers(custsRes.data);
                    const freshCust = custsRes.data.find(c => c.id === newCust.id) || newCust;
                    setSelectedCustomer(freshCust);
                    setCustomerSearchTerm(freshCust.name);
                } else {
                    setSelectedCustomer(newCust);
                    setCustomerSearchTerm(newCust.name);
                }
                
                // Reset form and close modal
                setQuickCustomerName('');
                setQuickCustomerPhone('');
                setQuickCustomerEmail('');
                setShowQuickCustomerModal(false);
            } else {
                toast.error(response.message || 'Failed to create customer');
            }
        } catch (error) {
            console.error('Error creating customer:', error);
            toast.error(error.message || 'Failed to create customer');
        } finally {
            setQuickCustomerSubmitting(false);
        }
    };

    return (
        <div className="companypos-layout">
            <div className="companypos-main-content">
                <div className="companypos-header">
                    <div className="companypos-search-bar">
                        <Search className="companypos-search-icon" size={20} />
                        <input
                            type="text"
                            className="companypos-search-input"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-3 App-bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-gray-600" onClick={fetchData} title="Refresh Data">
                            <RefreshCw size={20} />
                        </button>
                        {hasPermission('view pos') && (
                            <button
                                className="p-3 App-bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-gray-600 flex items-center gap-2"
                                onClick={() => navigate('/company/pos/all-invoices')}
                                title="All POS Invoices"
                            >
                                <FileText size={20} />
                                <span className="hidden sm:inline font-semibold">All POS Invoice</span>
                            </button>
                        )}
                        <button className="p-3 App-bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-gray-600" onClick={() => navigate('/company/dashboard')}>
                            <Home size={20} />
                        </button>
                    </div>
                </div>

                <div className="companypos-categories">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`companypos-category-pill ${selectedCategory === cat ? 'companypos-active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="companypos-products-grid">
                    {loading ? <p className="col-span-full text-center py-10">Loading Products...</p> :
                        filteredProducts.length === 0 ? <p className="col-span-full text-center py-10">No products found</p> :
                            filteredProducts.map(product => (
                                <div key={product.id} className={`companypos-product-card ${getProductStockForWarehouse(product, selectedWarehouseId) <= 0 ? 'opacity-50 grayscale' : ''}`} onClick={() => addToCart(product)}>
                                    <div className={`companypos-stock-badge ${getProductStockForWarehouse(product, selectedWarehouseId) < 5 ? 'bg-red-500' : 'bg-green-500'}`}>{getProductStockForWarehouse(product, selectedWarehouseId)} in stock</div>
                                    <div className="companypos-product-image-placeholder">
                                        {product.image ? (
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="companypos-product-img"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://via.placeholder.com/150?text=📦';
                                                }}
                                            />
                                        ) : (
                                            <Package size={40} strokeWidth={1.5} />
                                        )}
                                    </div>
                                    <div className="companypos-product-info">
                                        <h3>{product.name}</h3>
                                        <p>{product.category}</p>
                                        <div className="companypos-product-price">{formatCurrency(product.price)}</div>
                                    </div>
                                </div>
                            ))}
                </div>
            </div>

            {/* Right Sidebar: Cart */}
            <div className="companypos-sidebar">
                <div className="companypos-cart-header">
                    <h2>Current Sale</h2>
                    <button className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Clear Cart" onClick={() => setCart([])}>
                        <Trash2 size={18} />
                    </button>
                </div>

                <div className="companypos-customer-selector">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
                        <div className="companypos-customer-select-wrapper" style={{ flex: 1 }}>
                            <User size={18} className="companypos-input-icon left" style={{ color: '#3b82f6' }} />
                            <input
                                type="text"
                                className="companypos-customer-select"
                                style={{ cursor: 'text' }}
                                placeholder="Search customer by name or phone..."
                                value={customerSearchTerm}
                                onFocus={() => setShowCustomerDropdown(true)}
                                onChange={(e) => {
                                    setCustomerSearchTerm(e.target.value);
                                    setShowCustomerDropdown(true);
                                    if (e.target.value === '') {
                                        setSelectedCustomer(null);
                                    }
                                }}
                            />
                            {customerSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomerSearchTerm('');
                                        setSelectedCustomer(null);
                                        setShowCustomerDropdown(false);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        right: '1rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#94a3b8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                            {!customerSearchTerm && (
                                <Grid size={16} className="companypos-input-icon right" />
                            )}
                            
                            {showCustomerDropdown && (
                                <div
                                    className="companypos-customer-dropdown-menu"
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        backgroundColor: 'white',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '10px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                        maxHeight: '220px',
                                        overflowY: 'auto',
                                        zIndex: 50,
                                        marginTop: '6px'
                                    }}
                                >
                                    <div
                                        className="companypos-customer-dropdown-item"
                                        style={{
                                            padding: '0.8rem 1rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f1f5f9',
                                            backgroundColor: selectedCustomer === null ? '#f8fafc' : 'white',
                                            fontWeight: selectedCustomer === null ? '700' : '500',
                                            color: selectedCustomer === null ? '#8ce043' : '#334155',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setCustomerSearchTerm('');
                                            setShowCustomerDropdown(false);
                                        }}
                                    >
                                        <span>Walk-in Customer</span>
                                        {selectedCustomer === null && <Check size={16} />}
                                    </div>
                                    {filteredCustomers.length === 0 ? (
                                        <div style={{ padding: '0.8rem 1rem', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                                            No customers found. Click '+' to add.
                                        </div>
                                    ) : (
                                        filteredCustomers.map(c => {
                                            const isSelected = selectedCustomer?.id === c.id;
                                            return (
                                                <div
                                                    key={c.id}
                                                    className="companypos-customer-dropdown-item"
                                                    style={{
                                                        padding: '0.8rem 1rem',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f1f5f9',
                                                        backgroundColor: isSelected ? '#f8fafc' : 'white',
                                                        fontWeight: isSelected ? '700' : '500',
                                                        color: isSelected ? '#8ce043' : '#334155',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                    onClick={() => {
                                                        setSelectedCustomer(c);
                                                        setCustomerSearchTerm(c.name);
                                                        setShowCustomerDropdown(false);
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                        <span style={{ fontSize: '0.95rem' }}>{c.name}</span>
                                                        {c.phone && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{c.phone}</span>}
                                                    </div>
                                                    {isSelected && <Check size={16} />}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="companypos-add-customer-btn"
                            onClick={() => setShowQuickCustomerModal(true)}
                            style={{
                                width: '46px',
                                height: '46px',
                                backgroundColor: '#8ce043',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                                boxShadow: '0 2px 4px rgba(140, 224, 67, 0.2)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7cd033'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#8ce043'}
                            title="Quick Add Customer"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
                <div className="companypos-sidebar-scroll-container">
                    <div className="companypos-cart-items-container">
                        {cart.length === 0 ? (
                            <div className="companypos-empty-cart">
                                <ShoppingCart size={48} />
                                <p>Cart is empty</p>
                                <span className="text-sm text-gray-400">Click products to add here</span>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.cartItemId} className="companypos-cart-item" style={{ gap: '0.5rem', padding: '1rem 0' }}>
                                    <div className="companypos-cart-item-top flex justify-between items-center mb-1">
                                        <span className="companypos-cart-item-title font-bold text-gray-800" style={{ marginBottom: 0 }}>{item.name}</span>
                                        <div className="companypos-cart-item-price font-bold text-gray-800">
                                            {formatCurrency((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0))}
                                        </div>
                                    </div>
                                    <div className="companypos-cart-item-bottom flex items-center gap-2 w-full" style={{ gap: '6px' }}>
                                        {/* Rate Input */}
                                        <div className="flex items-center gap-1" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Rate:</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="companypos-rate-input"
                                                style={{ width: '65px', height: '28px', fontSize: '0.8rem', padding: '0 4px' }}
                                                value={item.price}
                                                onChange={(e) => handlePriceChange(item.cartItemId, e.target.value)}
                                            />
                                        </div>

                                        {/* Qty Input */}
                                        <input 
                                            type="number" 
                                            className="companypos-qty-input" 
                                            style={{ width: '50px', height: '28px', fontSize: '0.8rem', padding: '0 4px' }}
                                            value={item.qty} 
                                            onChange={(e) => handleQtyChange(item.cartItemId, e.target.value)} 
                                            min="1" 
                                        />

                                        {/* UOM Selector */}
                                        <div className="companypos-uom-select-container flex-1" style={{ minWidth: '70px' }}>
                                             <select
                                                 className="companypos-uom-select"
                                                 style={{ height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                                 value={item.uomId || ''}
                                                 disabled
                                                 onChange={(e) => {
                                                     const newUomId = e.target.value ? parseInt(e.target.value) : '';
                                                     updateCartItemUom(item.cartItemId, newUomId);
                                                 }}
                                             >
                                                 <option value="">UOM...</option>
                                                 {allUoms
                                                     .filter(u => u.category === item.uom?.category || u.baseUnitId === item.uomId)
                                                     .map(u => (
                                                         <option key={u.id} value={u.id}>{u.unitName}</option>
                                                     ))
                                                 }
                                             </select>
                                         </div>

                                         {/* Warehouse Selector */}
                                         <div className="companypos-wh-select-container flex-1" style={{ minWidth: '70px' }}>
                                              <select
                                                  className="companypos-uom-select"
                                                  style={{ height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', width: '100%' }}
                                                  value={item.warehouseId || ''}
                                                  onChange={(e) => {
                                                      const newWhId = e.target.value;
                                                      setCart(cart.map(c => c.cartItemId === item.cartItemId ? { ...c, warehouseId: newWhId } : c));
                                                  }}
                                              >
                                                  <option value="">WH...</option>
                                                  {allWarehouses.map(w => (
                                                      <option key={w.id} value={w.id}>{w.name}</option>
                                                  ))}
                                              </select>
                                         </div>

                                         {/* Delete Button */}
                                         <button 
                                             className="companypos-cart-item-delete" 
                                             style={{ height: '28px', width: '28px', minWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                             onClick={() => removeFromCart(item.cartItemId)}
                                         >
                                             <Trash2 size={14} />
                                         </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="companypos-cart-footer">
                        {/* Settings Controls */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="companypos-tax-select-container">
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Tax</label>
                                <div className="companypos-tax-wrapper">
                                    <select
                                        className="companypos-tax-dropdown"
                                        value={selectedTax}
                                        onChange={(e) => setSelectedTax(parseFloat(e.target.value))}
                                    >
                                        <option value={0}>No Tax</option>
                                        <option value={5}>GST 5%</option>
                                        <option value={10}>GST 10%</option>
                                        <option value={12}>GST 12%</option>
                                        <option value={18}>GST 18%</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Payment Status</label>
                                <select
                                    className="companypos-control-select"
                                    value={paymentStatus}
                                    onChange={(e) => setPaymentStatus(e.target.value)}
                                >
                                    <option value="Paid">Paid</option>
                                    <option value="Partial">Partial Payment</option>
                                    <option value="Due Payment">Due Payment</option>
                                </select>
                            </div>
                        </div>

                        <div className="companypos-warehouse-select-container mb-4">
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Warehouse / Location</label>
                            <select
                                className="companypos-control-select"
                                style={{ width: '100%' }}
                                value={selectedWarehouseId}
                                onChange={(e) => handleWarehouseChange(e.target.value)}
                            >
                                <option value="">Select Warehouse...</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name} ({w.location})</option>
                                ))}
                            </select>
                        </div>

                        {paymentStatus === 'Partial' && (
                            <div className="mb-4">
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Amount Paid</label>
                                <input
                                    type="number"
                                    className="companypos-control-input"
                                    value={partialAmount}
                                    onChange={(e) => setPartialAmount(e.target.value)}
                                    placeholder="Enter amount"
                                />
                            </div>
                        )}

                        <div className="companypos-summary-container p-3 App-bg-white border rounded-lg mb-4">
                            <div className="companypos-summary-row">
                                <span className="font-bold text-gray-800">Subtotal:</span>
                                <span className="font-bold text-gray-800">{formatCurrency(subtotal)}</span>
                            </div>
                        </div>
                        <div className="companypos-summary-row">
                            <span className="font-bold text-gray-800">Tax ({selectedTax}%):</span>
                            <span className="font-bold text-gray-800">{formatCurrency(tax)}</span>
                        </div>
                        {paymentStatus !== 'Paid' && (
                            <div className="companypos-summary-row">
                                <span className="font-bold text-gray-800">Amount Paid:</span>
                                <span className="font-bold text-gray-800">{formatCurrency(getPaidAmount())}</span>
                            </div>
                        )}
                        {paymentStatus !== 'Paid' && (
                            <div className="companypos-summary-row">
                                <span className="font-bold text-gray-800">Amount Due:</span>
                                <span className="font-bold text-gray-800">{formatCurrency(amountDue)}</span>
                            </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">Total:</span>
                            <span className="text-lg font-bold text-gray-900">{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>

                {hasPermission('create pos') && (
                    <div className="companypos-checkout-btn-container">
                        <button className="companypos-checkout-btn" disabled={cart.length === 0} onClick={handleOpenCheckout}>
                            <span>Pay Now</span>
                            <div className="flex items-center gap-2">
                                <span>{formatCurrency(total)}</span>
                                <CreditCard size={20} />
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Checkout Modal */}
            {
                isCheckoutModalOpen && (
                    <div className="companypos-modal-overlay">
                        <div className="companypos-modal-content">
                            <div className="companypos-modal-header">
                                <div className="companypos-modal-header-title-container">
                                    <CreditCard className="companypos-modal-title-icon" size={24} />
                                    <h2>Complete Checkout</h2>
                                </div>
                                <button onClick={() => setIsCheckoutModalOpen(false)} className="companypos-modal-close-btn">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="companypos-modal-body">
                                <div className="companypos-checkout-summary" style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div className="companypos-summary-group">
                                        <div className="companypos-summary-label" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Total Amount Payable</div>
                                        <div className="companypos-summary-value" style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>{formatCurrency(total)}</div>
                                    </div>
                                    <div className="companypos-summary-group text-right mobile-left">
                                        <div className="companypos-summary-label" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Customer</div>
                                        <div className="companypos-summary-value customer-name" style={{ fontSize: '1.25rem', fontWeight: '700', color: '#3b82f6' }}>{selectedCustomer ? selectedCustomer.name : 'Walk-in'}</div>
                                    </div>
                                </div>

                                {/* Real-time Balance Display */}
                                {(() => {
                                    const totalPaid = (parseFloat(cashReceived) || 0) + (parseFloat(cardReceived) || 0);
                                    const remaining = total - totalPaid;
                                    const formattedRemaining = formatCurrency(Math.abs(remaining));
                                    const isOverpaid = remaining < -0.01;
                                    const isCleared = Math.abs(remaining) < 0.01;

                                    return (
                                        <div 
                                            className="companypos-balance-banner"
                                            style={{
                                                padding: '1rem',
                                                borderRadius: '12px',
                                                textAlign: 'center',
                                                fontWeight: '700',
                                                fontSize: '1.1rem',
                                                marginBottom: '1.5rem',
                                                border: '1px solid',
                                                background: isCleared ? '#f0fdf4' : (isOverpaid ? '#eff6ff' : '#fef2f2'),
                                                borderColor: isCleared ? '#bbf7d0' : (isOverpaid ? '#bfdbfe' : '#fecaca'),
                                                color: isCleared ? '#15803d' : (isOverpaid ? '#1d4ed8' : '#b91c1c')
                                            }}
                                        >
                                            {isCleared ? (
                                                <span>Remaining Balance: {formatCurrency(0)} (Fully Cleared)</span>
                                            ) : isOverpaid ? (
                                                <span>Change Due / Excess: {formattedRemaining}</span>
                                            ) : (
                                                <span>Remaining Balance: {formattedRemaining}</span>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Split Payments Fields */}
                                <div className="grid grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                    {/* Cash Side */}
                                    <div className="companypos-payment-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div className="companypos-form-group">
                                            <label className="companypos-form-label" style={{ fontWeight: '700', color: '#475569', fontSize: '0.9rem' }}>Cash Paid</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    className="companypos-control-input"
                                                    placeholder="0.00"
                                                    value={cashReceived}
                                                    onChange={(e) => setCashReceived(e.target.value)}
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const currentOther = parseFloat(cardReceived) || 0;
                                                        const rem = Math.max(0, total - currentOther);
                                                        setCashReceived(rem.toFixed(2));
                                                    }}
                                                    style={{
                                                        padding: '0 0.5rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600',
                                                        background: '#e2e8f0',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        color: '#475569'
                                                    }}
                                                >
                                                    Full
                                                </button>
                                            </div>
                                        </div>

                                        <div className="companypos-form-group">
                                            <label className="companypos-form-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Cash Account</label>
                                            <select
                                                className="companypos-control-select"
                                                value={cashAccountId ? cashAccountId.toString() : ''}
                                                onChange={(e) => setCashAccountId(e.target.value)}
                                            >
                                                <option value="">Select Cash Account</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id.toString()}>{acc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Card Side */}
                                    <div className="companypos-payment-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div className="companypos-form-group">
                                            <label className="companypos-form-label" style={{ fontWeight: '700', color: '#475569', fontSize: '0.9rem' }}>Card / Bank Paid</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    className="companypos-control-input"
                                                    placeholder="0.00"
                                                    value={cardReceived}
                                                    onChange={(e) => setCardReceived(e.target.value)}
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const currentOther = parseFloat(cashReceived) || 0;
                                                        const rem = Math.max(0, total - currentOther);
                                                        setCardReceived(rem.toFixed(2));
                                                    }}
                                                    style={{
                                                        padding: '0 0.5rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600',
                                                        background: '#e2e8f0',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        color: '#475569'
                                                    }}
                                                >
                                                    Full
                                                </button>
                                            </div>
                                        </div>

                                        <div className="companypos-form-group">
                                            <label className="companypos-form-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Bank Account</label>
                                            <select
                                                className="companypos-control-select"
                                                value={cardAccountId ? cardAccountId.toString() : ''}
                                                onChange={(e) => setCardAccountId(e.target.value)}
                                            >
                                                <option value="">Select Bank Account</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id.toString()}>{acc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="companypos-form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="companypos-form-label" style={{ fontWeight: '700', color: '#475569', fontSize: '0.9rem' }}>Customer / Receivable Ledger (If Due)</label>
                                    <select
                                        className="companypos-control-select"
                                        value={selectedDueAccountId ? selectedDueAccountId.toString() : ''}
                                        onChange={(e) => setSelectedDueAccountId(e.target.value)}
                                    >
                                        <option value="">Select Due Account</option>
                                        {allAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id.toString()}>{acc.name} ({acc.accountgroup?.name || acc.group?.name || ''})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Custom Fields Section */}
                                {getCustomFieldsForType('posinvoice').length > 0 && (
                                    <div className="POS-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Custom Fields
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                            {getCustomFieldsForType('posinvoice').map(field => (
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

                                <div className="companypos-form-group">
                                    <label className="companypos-form-label" style={{ fontWeight: '700', color: '#475569', fontSize: '0.9rem' }}>Internal Notes</label>
                                    <textarea
                                        className="companypos-notes-input"
                                        placeholder="Add any transaction notes here..."
                                        rows={2}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        style={{ marginTop: '0.5rem' }}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="companypos-modal-footer">
                                <button className="companypos-btn-secondary" onClick={() => setIsCheckoutModalOpen(false)}>
                                    Cancel
                                </button>
                                <button className="companypos-btn-success" onClick={handleConfirmCheckout} disabled={submitting}>
                                    {submitting ? (
                                        <span>Processing...</span>
                                    ) : (
                                        <>
                                            <span>Confirm & Print Receipt</span>
                                            <Check size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div >
                )
            }

            {/* Print Receipt Modal */}
            {
                showPrintModal && invoiceData && (
                    <div className="companypos-modal-overlay">
                        <div className="companypos-modal-content print-mode">
                            <div className="companypos-modal-header no-print">
                                <div className="flex items-center gap-2">
                                    <Printer className="text-blue-500" size={24} />
                                    <h2>Invoice Receipt</h2>
                                </div>
                                <div className="flex gap-2">
                                    <button className="companypos-btn-success" onClick={handlePrint}>
                                        <Printer size={18} /> Print
                                    </button>
                                    <button onClick={handleClosePrint} className="text-gray-400 hover:text-gray-600">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            <div className="companypos-modal-body padded-print" id="print-area">
                                {/* Header */}
                                <div
                                    className={`POS-invoice-preview-container w-full POS-template-${(companyDetails?.invoiceTemplate || companyDetails?.template || 'New York').toLowerCase().replace(/\s+/g, '')}`}
                                    style={{ '--header-bg': companyDetails?.invoiceColor || '#004aad' }}
                                >
                                    <div className="POS-invoice-header-wrapper">
                                        <div className="POS-invoice-preview-header">
                                            <div className="POS-invoice-header-left">
                                                {companyDetails?.logo ? (
                                                    <img src={companyDetails.logo} alt="Logo" className="POS-invoice-logo-large" />
                                                ) : (
                                                    <h2 style={{ color: companyDetails?.color || '#004aad', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{companyDetails?.name || 'Company Name'}</h2>
                                                )}
                                                <div className="POS-invoice-company-details mt-2">
                                                    <strong>{companyDetails?.name}</strong><br />
                                                    {companyDetails?.email}<br />
                                                    {companyDetails?.phone}<br />
                                                    {companyDetails?.address}
                                                </div>
                                            </div>
                                            <div className="POS-invoice-header-right">
                                                <div className="POS-invoice-title-large">{getDocumentTitle('posinvoice')}</div>
                                                <div className="POS-invoice-meta-info">
                                                    <div className="POS-invoice-meta-row">
                                                        <span className="POS-invoice-label">{getInvoiceLabel('number')}</span> #{invoiceData.invoiceNumber}
                                                    </div>
                                                    <div className="POS-invoice-meta-row">
                                                        <span className="POS-invoice-label">{getInvoiceLabel('issue')}</span> {new Date(invoiceData.date).toLocaleDateString()}
                                                    </div>
                                                    <div className="POS-invoice-meta-row">
                                                        <span className="POS-invoice-label">{getInvoiceLabel('dueDate')}</span> {new Date(invoiceData.dueDate).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="POS-invoice-qr-box">
                                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${invoiceData.invoiceNumber}`} alt="QR" className="POS-invoice-qr-code" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="POS-invoice-addresses">
                                        <div className="POS-invoice-bill-to">
                                            <div className="POS-invoice-section-header">{getInvoiceLabel('billTo')}</div>
                                            {invoiceData.customer ? (
                                                <>
                                                    <div className="font-bold text-gray-800">{invoiceData.customer.name}</div>
                                                    <div className="text-sm text-gray-600">{invoiceData.customer.email}</div>
                                                    <div className="text-sm text-gray-600">{invoiceData.customer.phone}</div>
                                                    <div className="text-sm text-gray-600">{invoiceData.customer.billingAddress || invoiceData.customer.address}</div>
                                                </>
                                            ) : (
                                                <div className="text-sm text-gray-500">Walk-in Customer</div>
                                            )}
                                        </div>
                                        <div className="POS-invoice-ship-to text-right">
                                            <div className="POS-invoice-section-header">{getInvoiceLabel('shipTo')}</div>
                                            {invoiceData.customer ? (
                                                <>
                                                    <div className="font-bold text-gray-800">{invoiceData.customer.name}</div>
                                                    <div className="text-sm text-gray-600">{invoiceData.customer.shippingAddress || invoiceData.customer.address || invoiceData.customer.billingAddress}</div>
                                                </>
                                            ) : (
                                                <div className="text-sm text-gray-500">Same as Billing</div>
                                            )}
                                        </div>
                                    </div>

                                    <table className="POS-invoice-table-preview">
                                        <thead>
                                            <tr>
                                                <th>Item</th>
                                                <th>Warehouse</th>
                                                <th className="text-center">Quantity</th>
                                                <th className="text-right">Rate</th>
                                                <th className="text-right">Discount</th>
                                                <th className="text-right">Tax (%)</th>
                                                <th className="text-right">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceData.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className="font-bold text-gray-800">{item.description || 'Item'}</div>
                                                    </td>
                                                    <td>
                                                        {warehouses.find(w => w.id === parseInt(item.warehouseId))?.name || 'Warehouse Hub'}
                                                    </td>
                                                    <td className="text-center">{item.quantity}</td>
                                                    <td className="text-right">{formatCurrency(item.rate)}</td>
                                                    <td className="text-right">{formatCurrency(item.discount || 0)}</td>
                                                    <td className="text-right">{item.taxRate}%</td>
                                                    <td className="text-right font-bold">{formatCurrency((item.quantity * item.rate) * (1 + item.taxRate / 100))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="POS-invoice-total-section">
                                        <div className="POS-invoice-totals">
                                            <div className="POS-invoice-total-row">
                                                <span className="POS-invoice-label">{getInvoiceLabel('subTotal')}</span>
                                                <span>{formatCurrency(invoiceData.subTotal)}</span>
                                            </div>
                                            <div className="POS-invoice-total-row">
                                                <span className="POS-invoice-label">{getInvoiceLabel('tax')}</span>
                                                <span>{formatCurrency(invoiceData.taxAmount)}</span>
                                            </div>
                                            <div className="POS-invoice-total-row POS-invoice-final-total">
                                                <span className="font-bold">{getInvoiceLabel('total')}</span>
                                                <span className="font-bold text-lg">{formatCurrency(invoiceData.totalAmount)}</span>
                                            </div>
                                            <div className="POS-invoice-total-row POS-invoice-paid-row mt-4">
                                                <span className="POS-invoice-label" style={{ color: '#16a34a' }}>Amount Paid</span>
                                                <span className="font-bold">{formatCurrency(invoiceData.paidAmount || 0)}</span>
                                            </div>
                                            <div className="POS-invoice-total-row POS-invoice-due-row">
                                                <span className="POS-invoice-label" style={{ color: '#1e293b' }}>Amount Due</span>
                                                <span className="font-bold">{formatCurrency(invoiceData.balanceAmount || 0)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Custom Fields Print View */}
                                    {(() => {
                                        let customFieldVals = {};
                                        if (invoiceData?.customFields) {
                                            try {
                                                customFieldVals = typeof invoiceData.customFields === 'string'
                                                    ? JSON.parse(invoiceData.customFields)
                                                    : invoiceData.customFields;
                                            } catch (e) {
                                                console.error('Error parsing POS custom fields for view:', e);
                                            }
                                        }
                                        const fieldsList = getCustomFieldsForType('posinvoice');
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

                                    {invoiceData.notes && (
                                        <div className="POS-invoice-notes-section">
                                            <div className="POS-invoice-section-header">Notes</div>
                                            <p className="POS-invoice-notes-text">{invoiceData.notes}</p>
                                        </div>
                                    )}

                                    <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
                                        <p>This is a computer generated invoice and does not require a signature.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Quick Customer Modal */}
            {showQuickCustomerModal && (
                <div className="companypos-modal-overlay">
                    <div className="companypos-modal-content" style={{ maxWidth: '450px' }}>
                        <div className="companypos-modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                            <div className="companypos-modal-header-title-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User className="companypos-modal-title-icon" size={22} style={{ color: '#8ce043' }} />
                                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Quick Customer</h2>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowQuickCustomerModal(false);
                                    setQuickCustomerName('');
                                    setQuickCustomerPhone('');
                                    setQuickCustomerEmail('');
                                }} 
                                className="companypos-modal-close-btn"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                <X size={22} style={{ color: '#94a3b8' }} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateQuickCustomer}>
                            <div className="companypos-modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="companypos-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label className="companypos-form-label" style={{ fontWeight: '700', color: '#475569', fontSize: '0.85rem', textAlign: 'left' }}>
                                        Customer Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="companypos-control-input"
                                        placeholder="Enter Customer Name"
                                        value={quickCustomerName}
                                        onChange={(e) => setQuickCustomerName(e.target.value)}
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="companypos-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label className="companypos-form-label" style={{ fontWeight: '700', color: '#475569', fontSize: '0.85rem', textAlign: 'left' }}>
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        className="companypos-control-input"
                                        placeholder="Enter Phone Number"
                                        value={quickCustomerPhone}
                                        onChange={(e) => setQuickCustomerPhone(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="companypos-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label className="companypos-form-label" style={{ fontWeight: '700', color: '#475569', fontSize: '0.85rem', textAlign: 'left' }}>
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        className="companypos-control-input"
                                        placeholder="Enter Email Address"
                                        value={quickCustomerEmail}
                                        onChange={(e) => setQuickCustomerEmail(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                            <div className="companypos-modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'end', gap: '0.75rem' }}>
                                <button 
                                    type="button" 
                                    className="companypos-btn-secondary" 
                                    onClick={() => {
                                        setShowQuickCustomerModal(false);
                                        setQuickCustomerName('');
                                        setQuickCustomerPhone('');
                                        setQuickCustomerEmail('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="companypos-btn-success" 
                                    disabled={quickCustomerSubmitting}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    {quickCustomerSubmitting ? 'Saving...' : 'Save & Select'}
                                    {!quickCustomerSubmitting && <Check size={18} />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* End of CompanyPOS Layout */}
        </div >
    );
};

export default POS;