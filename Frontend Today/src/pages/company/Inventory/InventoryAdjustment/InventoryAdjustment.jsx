import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, X, Eye, Loader2, Save, Pencil, Printer } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './InventoryAdjustment.css';
import adjustmentService from '../../../../api/adjustmentService';
import warehouseService from '../../../../api/warehouseService';
import productService from '../../../../api/productService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import toast from 'react-hot-toast';
import companyService from '../../../../api/companyService';

const InventoryAdjustment = () => {
    const { formatCurrency, companySettings } = useContext(CompanyContext);
    const { hasPermission } = useContext(AuthContext);
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedAdjustment, setSelectedAdjustment] = useState(null);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [editingAdjustment, setEditingAdjustment] = useState(null);

    // Form Data
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [adjustmentItems, setAdjustmentItems] = useState([]);
    const [formData, setFormData] = useState({
        voucherNo: '',
        manualVoucherNo: '',
        date: new Date().toISOString().split('T')[0],
        type: 'ADD_STOCK',
        warehouseId: '',
        note: ''
    });

    useEffect(() => {
        fetchAdjustments();
        fetchInitialData();
    }, []);

    const fetchAdjustments = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            const response = await adjustmentService.getAdjustments(companyId);
            if (response.success) setAdjustments(response.data);
        } catch (error) {
            toast.error('Failed to load adjustments');
        } finally {
            setLoading(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const companyId = GetCompanyId();
            const [whRes, prodRes] = await Promise.all([
                warehouseService.getWarehouses(companyId),
                productService.getProducts(companyId)
            ]);
            if (whRes.success) setWarehouses(whRes.data);
            if (prodRes.success) setProducts(prodRes.data);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    const generateVoucherNo = () => {
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        return `ADJ-${dateStr}-${randomStr}`;
    };

    const handleOpenAdd = async () => {
        setIsEdit(false);
        setEditingAdjustment(null);
        let nextVoucherNo = '';
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getNextNumber(companyId, 'adjustment');
                if (res.data && res.data.success) {
                    nextVoucherNo = res.data.nextNumber;
                }
            }
        } catch (error) {
            console.error('Error fetching next adjustment number:', error);
            nextVoucherNo = generateVoucherNo();
        }

        setFormData({
            voucherNo: nextVoucherNo,
            manualVoucherNo: '',
            date: new Date().toISOString().split('T')[0],
            type: 'ADD_STOCK',
            warehouseId: '',
            note: ''
        });
        setAdjustmentItems([]);
        setProductSearchTerm('');
        setShowAddModal(true);
    };

    const handleEdit = async (adjId) => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            const response = await adjustmentService.getAdjustmentById(adjId, companyId);
            if (response.success) {
                const adj = response.data;
                setIsEdit(true);
                setEditingAdjustment(adj);
                setFormData({
                    voucherNo: adj.voucherNo,
                    manualVoucherNo: adj.manualVoucherNo || '',
                    date: new Date(adj.date).toISOString().split('T')[0],
                    type: adj.type || 'ADD_STOCK',
                    warehouseId: adj.warehouseId,
                    note: adj.note || ''
                });

                const items = adj.inventoryadjustmentitem.map(item => ({
                    productId: item.productId,
                    name: item.product?.name,
                    sku: item.product?.sku,
                    warehouseId: item.warehouseId,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    narration: item.narration || ''
                }));

                setAdjustmentItems(items);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error('Error loading adjustment for edit:', error);
            toast.error('Failed to load adjustment details');
        } finally {
            setLoading(false);
        }
    };

    const handleProductSearch = (value) => {
        setProductSearchTerm(value);
        if (value.trim() === '') return setSearchResults([]);
        const filtered = products.filter(p =>
            p.name.toLowerCase().includes(value.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(value.toLowerCase()))
        ).slice(0, 5);
        setSearchResults(filtered);
    };

    const addItem = (product) => {
        if (adjustmentItems.find(i => i.productId === product.id)) return toast.error('Item already added');
        setAdjustmentItems([...adjustmentItems, {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            warehouseId: formData.warehouseId || '',
            quantity: 1,
            rate: product.purchasePrice || 0,
            amount: product.purchasePrice || 0,
            narration: ''
        }]);
        setProductSearchTerm('');
        setSearchResults([]);
    };

    const removeItem = (idx) => {
        const newItems = [...adjustmentItems];
        newItems.splice(idx, 1);
        setAdjustmentItems(newItems);
    };

    const updateItem = (idx, field, value) => {
        const newItems = [...adjustmentItems];
        newItems[idx][field] = value;
        if (field === 'quantity' || field === 'rate') {
            newItems[idx].amount = (parseFloat(newItems[idx].quantity) || 0) * (parseFloat(newItems[idx].rate) || 0);
        }
        setAdjustmentItems(newItems);
    };

    const calculateTotal = () => adjustmentItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const handleSubmit = async () => {
        if (adjustmentItems.length === 0) return toast.error('Please add at least one item');
        if (adjustmentItems.some(item => !item.warehouseId)) return toast.error('Please select warehouse for all items');

        try {
            setSubmitting(true);
            const payload = { ...formData, items: adjustmentItems, totalValue: calculateTotal() };
            const response = isEdit
                ? await adjustmentService.updateAdjustment(editingAdjustment.id, payload)
                : await adjustmentService.createAdjustment(payload);

            if (response.success) {
                toast.success(isEdit ? 'Adjustment updated' : 'Adjustment saved');
                fetchAdjustments();
                setShowAddModal(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save adjustment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleView = async (adj) => {
        try {
            const companyId = GetCompanyId();
            const response = await adjustmentService.getAdjustmentById(adj.id, companyId);
            if (response.success) {
                setSelectedAdjustment(response.data);
                setShowViewModal(true);
            }
        } catch (error) {
            toast.error('Failed to load details');
        }
    };

    const handlePrint = () => {
        if (!selectedAdjustment) return;

        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const itemsHtml = selectedAdjustment.inventoryadjustmentitem?.map(item => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 10px;">${item.product?.name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 10px;">${item.warehouse?.name || 'N/A'}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${formatCurrency(item.rate)}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${formatCurrency(item.amount)}</td>
            </tr>
        `).join('');

        const content = `
            <html>
                <head>
                    <title>Inventory Adjustment - ${selectedAdjustment.voucherNo}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 15px; }
                        .logo { max-height: 70px; max-width: 150px; object-fit: contain; }
                        .company-details { font-size: 12px; color: #475569; line-height: 1.4; }
                        .company-name { font-size: 18px; font-weight: 700; color: #1a5f7a; margin: 0 0 5px 0; text-transform: uppercase; }
                        .voucher-title { text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; text-transform: uppercase; color: #444; }
                        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .detail-item { font-size: 14px; margin-bottom: 5px; }
                        .detail-label { font-weight: bold; color: #666; width: 150px; display: inline-block; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th { background: #f8fafc; border: 1px solid #ddd; padding: 12px 10px; text-align: left; font-size: 13px; color: #444; }
                        .total-section { display: flex; justify-content: flex-end; }
                        .total-box { width: 250px; }
                        .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                        .grand-total { font-weight: bold; font-size: 18px; color: #1a5f7a; border-bottom: 2px solid #1a5f7a; }
                        .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            ${companySettings?.logo ? `<img src="${companySettings.logo}" class="logo" />` : ''}
                            <div class="company-details">
                                <h1 class="company-name">${companySettings?.name || 'Your Company'}</h1>
                                <p style="margin: 0;">${companySettings?.address || ''}</p>
                                <p style="margin: 2px 0 0 0;">
                                    ${companySettings?.phone ? `Phone: ${companySettings.phone}` : ''}
                                    ${companySettings?.email ? ` | Email: ${companySettings.email}` : ''}
                                </p>
                                ${companySettings?.gstNumber ? `<p style="margin: 2px 0 0 0; font-weight: 600;">GSTIN: ${companySettings.gstNumber}</p>` : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 18px; font-weight: bold; color: #6366f1;">INVENTORY ADJUSTMENT</div>
                            <div style="font-family: monospace; font-size: 12px; margin-top: 5px;">NO: ${selectedAdjustment.voucherNo}</div>
                            <div style="font-size: 11px; color: #666; margin-top: 3px;">Date: ${new Date(selectedAdjustment.date).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div class="voucher-title">INVENTORY ADJUSTMENT VOUCHER</div>

                    <div class="details-grid">
                        <div>
                            <div class="detail-item"><span class="detail-label">Voucher No:</span> ${selectedAdjustment.voucherNo}</div>
                            <div class="detail-item"><span class="detail-label">Manual No:</span> ${selectedAdjustment.manualVoucherNo || '-'}</div>
                        </div>
                        <div>
                            <div class="detail-item"><span class="detail-label">Date:</span> ${new Date(selectedAdjustment.date).toLocaleDateString()}</div>
                            <div class="detail-item"><span class="detail-label">Type:</span> ${selectedAdjustment.type?.replace('_', ' ')}</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Warehouse</th>
                                <th style="text-align: center;">Qty</th>
                                <th style="text-align: right;">Rate</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div class="total-section">
                        <div class="total-box">
                            <div class="total-row grand-total">
                                <span>Total Value:</span>
                                <span>${formatCurrency(selectedAdjustment.totalValue || 0)}</span>
                            </div>
                        </div>
                    </div>

                    ${(companySettings?.notes || companySettings?.terms) ? `
                    <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; color: #555;">
                        <div>
                            ${companySettings?.notes ? `
                                <div style="font-weight: 700; text-transform: uppercase; color: #333; margin-bottom: 5px; font-size: 10px;">Notes &amp; Privacy Policy</div>
                                <div style="white-space: pre-line; line-height: 1.4; color: #666;">${companySettings.notes}</div>
                            ` : ''}
                        </div>
                        <div>
                            ${companySettings?.terms ? `
                                <div style="font-weight: 700; text-transform: uppercase; color: #333; margin-bottom: 5px; font-size: 10px;">Terms &amp; Conditions</div>
                                <div style="white-space: pre-line; line-height: 1.4; color: #666;">${companySettings.terms}</div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <div class="footer">Generated on ${new Date().toLocaleString()}</div>
                </body>
            </html>
        `;

        printFrame.contentDocument.write(content);
        printFrame.contentDocument.close();

        printFrame.onload = () => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(printFrame);
            }, 1000);
        };
    };

    const handleDeleteClick = (adj) => {
        setSelectedAdjustment(adj);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            setSubmitting(true);
            const companyId = GetCompanyId();
            const response = await adjustmentService.deleteAdjustment(selectedAdjustment.id, companyId);
            if (response.success) {
                toast.success('Adjustment deleted');
                fetchAdjustments();
                setShowDeleteModal(false);
            }
        } catch (error) {
            toast.error('Failed to delete adjustment');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredAdjustments = adjustments.filter(a =>
        a.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.manualVoucherNo && a.manualVoucherNo.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="Zirak-Adjustment-page">
            <div className="Zirak-Adjustment-page-header">
                <h1 className="Zirak-Adjustment-page-title">Inventory Adjustment</h1>
                {hasPermission('create inventory adjustment') && (
                    <button className="Zirak-Adjustment-btn-add" style={{ backgroundColor: '#8ce043' }} onClick={handleOpenAdd}>
                        <Plus size={18} /> Add Inventory Adjustment
                    </button>
                )}
            </div>

            <div className="Zirak-Adjustment-card">
                <div className="Zirak-Adjustment-controls-row">
                    <div className="Zirak-Adjustment-entries-control">
                        <select value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value))} className="Zirak-Adjustment-entries-select">
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="Zirak-Adjustment-entries-text">entries per page</span>
                    </div>
                    <div className="Zirak-Adjustment-search-control">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="Zirak-Adjustment-search-input"
                        />
                    </div>
                </div>

                <div className="Zirak-Adjustment-table-container">
                    {loading ? (
                        <div className="Zirak-Adjustment-loading-state">
                            <Loader2 className="Zirak-Adjustment-spinner" size={40} />
                            <p>Loading adjustments...</p>
                        </div>
                    ) : (
                        <table className="Zirak-Adjustment-table">
                            <thead>
                                <tr>
                                    <th>VOUCHER NO</th>
                                    <th>MANUAL NO</th>
                                    <th>DATE</th>
                                    <th>TYPE</th>
                                    <th>WAREHOUSE</th>
                                    <th>ITEMS</th>
                                    <th>TOTAL</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAdjustments.map((a) => (
                                    <tr key={a.id}>
                                        <td className="Zirak-Adjustment-voucher-no">{a.voucherNo}</td>
                                        <td>{a.manualVoucherNo || '-'}</td>
                                        <td>{new Date(a.date).toLocaleDateString()}</td>
                                        <td>
                                            <span className={`Zirak-Adjustment-type-badge ${a.type === 'ADD_STOCK' ? 'Zirak-Adjustment-type-add-stock' :
                                                a.type === 'REMOVE_STOCK' ? 'Zirak-Adjustment-type-remove-stock' :
                                                    'Zirak-Adjustment-type-adjust-value'
                                                }`}>
                                                {a.type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td>{a.warehouse?.name}</td>
                                        <td>{a.inventoryadjustmentitem?.length} Items</td>
                                        <td>{formatCurrency(a.totalValue || 0)}</td>
                                        <td>
                                            <div className="Zirak-Adjustment-action-buttons">
                                                <button className="Zirak-Adjustment-action-btn Zirak-Adjustment-btn-view" onClick={() => handleView(a)}><Eye size={16} /></button>
                                                {hasPermission('edit inventory adjustment') && (
                                                    <button className="Zirak-Adjustment-action-btn Zirak-Adjustment-btn-edit" style={{ backgroundColor: '#59d5e0', color: 'white' }} onClick={() => handleEdit(a.id)}><Pencil size={16} /></button>
                                                )}
                                                {hasPermission('delete inventory adjustment') && (
                                                    <button className="Zirak-Adjustment-action-btn Zirak-Adjustment-btn-delete" onClick={() => handleDeleteClick(a)}><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="Zirak-Adjustment-modal-overlay">
                    <div className="Zirak-Adjustment-modal-content Zirak-Adjustment-modal-large">
                        <div className="Zirak-Adjustment-modal-header">
                            <h2 className="Zirak-Adjustment-modal-title">{isEdit ? 'Edit Inventory Adjustment' : 'New Inventory Adjustment'}</h2>
                            <button className="Zirak-Adjustment-close-btn" onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>
                        <div className="Zirak-Adjustment-modal-body">
                            <div className="Zirak-Adjustment-form-grid">
                                <div className="Zirak-Adjustment-form-group">
                                    <label className="Zirak-Adjustment-form-label">System Voucher No</label>
                                    <input 
                                        type="text" 
                                        className="Zirak-Adjustment-form-input" 
                                        value={formData.voucherNo} 
                                        onChange={e => setFormData({ ...formData, voucherNo: e.target.value })} 
                                    />
                                </div>
                                <div className="Zirak-Adjustment-form-group">
                                    <label className="Zirak-Adjustment-form-label">Manual Voucher No</label>
                                    <input type="text" className="Zirak-Adjustment-form-input" placeholder="Manual No" value={formData.manualVoucherNo} onChange={e => setFormData({ ...formData, manualVoucherNo: e.target.value })} />
                                </div>
                                <div className="Zirak-Adjustment-form-group">
                                    <label className="Zirak-Adjustment-form-label">Voucher Date</label>
                                    <input type="date" className="Zirak-Adjustment-form-input" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                            </div>

                            <div className="Zirak-Adjustment-form-group Zirak-Adjustment-mt-4">
                                <label className="Zirak-Adjustment-form-label">Adjustment Type <span className="Zirak-Adjustment-text-red">*</span></label>
                                <div className="Zirak-Adjustment-radio-group-horizontal">
                                    {['ADD_STOCK', 'REMOVE_STOCK'].map(type => (
                                        <label key={type} className="Zirak-Adjustment-radio-label">
                                            <input type="radio" name="adjType" value={type} checked={formData.type === type} onChange={e => setFormData({ ...formData, type: e.target.value })} />
                                            {type.replace('_', ' ')}
                                        </label>
                                    ))}
                                </div>
                            </div>


                            <div className="Zirak-Adjustment-form-group Zirak-Adjustment-full-width Zirak-Adjustment-mt-4">
                                <label className="Zirak-Adjustment-form-label">Select Item</label>
                                <div className="Zirak-Adjustment-search-wrapper">
                                    <Search size={16} className="Zirak-Adjustment-search-icon-inline" />
                                    <input type="text" className="Zirak-Adjustment-form-input Zirak-Adjustment-with-icon" placeholder="Search product..." value={productSearchTerm} onChange={e => handleProductSearch(e.target.value)} />
                                    {searchResults.length > 0 && (
                                        <div className="Zirak-Adjustment-product-search-results">
                                            {searchResults.map(p => (
                                                <div key={p.id} className="Zirak-Adjustment-search-result-item" onClick={() => addItem(p)}>
                                                    <span>{p.name}</span>
                                                    <span className="Zirak-Adjustment-p-sku">{p.sku}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="Zirak-Adjustment-items-table-container">
                                <table className="Zirak-Adjustment-items-input-table">
                                    <thead>
                                        <tr>
                                            <th>ITEM</th>
                                            <th>WAREHOUSE</th>
                                            <th>QUANTITY</th>
                                            <th>RATE</th>
                                            <th>AMOUNT</th>
                                            <th>NARRATION</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adjustmentItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <div className="Zirak-Adjustment-item-name">{item.name}</div>
                                                    <div className="Zirak-Adjustment-item-sku">{item.sku}</div>
                                                </td>
                                                <td>
                                                    <select
                                                        className="Zirak-Adjustment-table-input"
                                                        value={item.warehouseId}
                                                        onChange={(e) => updateItem(idx, 'warehouseId', e.target.value)}
                                                    >
                                                        <option value="">Select</option>
                                                        {warehouses.map(w => {
                                                            const product = products.find(p => p.id === item.productId);
                                                            const stockItem = product?.stock?.find(s => s.warehouseId === w.id);
                                                            const count = stockItem ? stockItem.quantity : 0;
                                                            return (
                                                                <option key={w.id} value={w.id}>
                                                                    {w.name} ({count})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </td>
                                                <td><input type="number" className="Zirak-Adjustment-table-input" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                                                <td><input type="number" className="Zirak-Adjustment-table-input" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} /></td>
                                                <td className="Zirak-Adjustment-font-bold">{formatCurrency(item.amount)}</td>
                                                <td><input type="text" className="Zirak-Adjustment-table-input" value={item.narration} onChange={e => updateItem(idx, 'narration', e.target.value)} /></td>
                                                <td><button className="Zirak-Adjustment-row-delete-btn" onClick={() => removeItem(idx)}><Trash2 size={14} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="Zirak-Adjustment-footer-flex-row">
                                <div className="Zirak-Adjustment-form-group Zirak-Adjustment-flex-1">
                                    <label className="Zirak-Adjustment-form-label">Additional Note</label>
                                    <textarea className="Zirak-Adjustment-form-input Zirak-Adjustment-textarea" rows={3} placeholder="Enter note..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
                                </div>
                                <div className="Zirak-Adjustment-total-display-card">
                                    <label>Total Value</label>
                                    <div className="Zirak-Adjustment-total-amount-display">{formatCurrency(calculateTotal())}</div>
                                </div>
                            </div>
                        </div>
                        <div className="Zirak-Adjustment-modal-footer">
                            <button className="Zirak-Adjustment-btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="Zirak-Adjustment-btn-submit" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? <Loader2 className="Zirak-Adjustment-spinner" size={18} /> : <Save size={18} />}
                                Save Adjustment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {showViewModal && (
                <div className="Zirak-Adjustment-modal-overlay">
                    <div className="Zirak-Adjustment-modal-content Zirak-Adjustment-modal-large">
                        <div className="Zirak-Adjustment-modal-header">
                            <h2 className="Zirak-Adjustment-modal-title">Adjustment Details</h2>
                            <button className="Zirak-Adjustment-close-btn" onClick={() => setShowViewModal(false)}><X size={20} /></button>
                        </div>
                        <div className="Zirak-Adjustment-modal-body">
                            <div className="Zirak-Adjustment-view-grid">
                                <div className="Zirak-Adjustment-view-item">
                                    <label>Voucher No</label>
                                    <p>{selectedAdjustment?.voucherNo}</p>
                                </div>
                                <div className="Zirak-Adjustment-view-item">
                                    <label>Date</label>
                                    <p>{new Date(selectedAdjustment?.date).toLocaleDateString()}</p>
                                </div>
                                <div className="Zirak-Adjustment-view-item">
                                    <label>Type</label>
                                    <p>{selectedAdjustment?.type.replace('_', ' ')}</p>
                                </div>
                                {/* <div className="Zirak-Adjustment-view-item">
                                    <label>Warehouse</label>
                                    <p>{selectedAdjustment?.warehouse?.name}</p>
                                </div> */}
                            </div>
                            <div className="Zirak-Adjustment-mt-6">
                                <h3 className="Zirak-Adjustment-section-subtitle">Adjusted Items</h3>
                                <table className="Zirak-Adjustment-view-items-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Warehouse</th>
                                            <th>Qty</th>
                                            <th>Rate</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedAdjustment?.inventoryadjustmentitem?.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.product?.name}</td>
                                                <td>{item.warehouse?.name || 'N/A'}</td>
                                                <td>{item.quantity}</td>
                                                <td>{formatCurrency(item.rate)}</td>
                                                <td>{formatCurrency(item.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="Zirak-Adjustment-modal-footer">
                            <button className="Zirak-Adjustment-btn-print" style={{ backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handlePrint}>
                                <Printer size={18} />
                                Print Details
                            </button>
                            <button className="Zirak-Adjustment-btn-cancel" onClick={() => setShowViewModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="Zirak-Adjustment-modal-overlay">
                    <div className="Zirak-Adjustment-modal-content Zirak-Adjustment-modal-small">
                        <div className="Zirak-Adjustment-modal-header">
                            <h2 className="Zirak-Adjustment-modal-title Zirak-Adjustment-text-red-600">Delete Adjustment</h2>
                            <button className="Zirak-Adjustment-close-btn" onClick={() => setShowDeleteModal(false)}><X size={20} /></button>
                        </div>
                        <div className="Zirak-Adjustment-modal-body">
                            <p>Are you sure you want to delete <strong>{selectedAdjustment?.voucherNo}</strong>?</p>
                            <p className="Zirak-Adjustment-text-red-500 Zirak-Adjustment-mt-4" style={{ fontSize: '0.875rem' }}>Warning: This will reverse the stock quantities!</p>
                        </div>
                        <div className="Zirak-Adjustment-modal-footer">
                            <button className="Zirak-Adjustment-btn-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="Zirak-Adjustment-btn-submit Zirak-Adjustment-bg-red" onClick={confirmDelete} disabled={submitting}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryAdjustment;