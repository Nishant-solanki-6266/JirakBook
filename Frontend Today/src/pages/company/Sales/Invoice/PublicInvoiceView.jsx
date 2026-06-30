import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import salesInvoiceService from '../../../../api/salesInvoiceService';
import posService from '../../../../services/posService';
import { CompanyContext } from '../../../../context/CompanyContext';
import './Invoice.css';
import { Loader2, AlertCircle } from 'lucide-react';

const PublicInvoiceView = ({ type = 'invoice' }) => {
    const { id } = useParams();
    const { formatCurrency } = useContext(CompanyContext);
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                setLoading(true);
                let response;
                if (type === 'pos') {
                    response = await posService.getPublicPOSInvoiceById(id);
                } else {
                    const axiosRes = await salesInvoiceService.getPublicById(id);
                    response = axiosRes.data;
                }
                
                if (response.success) {
                    setDocument(response.data);
                } else {
                    setError('Document not found or inaccessible.');
                }
            } catch (err) {
                console.error('Public Preview Error:', err);
                setError('Failed to load document. Please check your connection.');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDocument();
    }, [id, type]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                <p className="text-slate-600 font-medium">Fetching secure digital document...</p>
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                <AlertCircle className="text-red-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Oops!</h2>
                <p className="text-slate-600">{error || 'Unable to load this document.'}</p>
            </div>
        );
    }

    const companyDetails = document.company || {};

    const getTableHeader = (key, defaultVal) => {
        const defaults = {
            item: 'Item',
            quantity: 'Quantity',
            rate: 'Rate',
            discount: 'Discount',
            tax: 'Tax (%)',
            price: 'Price',
            warehouse: 'Warehouse',
            uom: 'UOM'
        };
        if (companyDetails?.invoiceTableHeaders) {
            try {
                const headers = typeof companyDetails.invoiceTableHeaders === 'string'
                    ? JSON.parse(companyDetails.invoiceTableHeaders)
                    : companyDetails.invoiceTableHeaders;
                if (headers[key] !== undefined) {
                    return headers[key];
                }
            } catch (e) {
                console.error(e);
            }
        }
        return defaultVal || defaults[key] || key;
    };

    const getCustomLabel = (key) => {
        const defaults = {
            billTo: 'Bill To:',
            shipTo: 'Ship To:',
            subTotal: 'Sub Total',
            tax: 'Tax',
            total: 'Total',
            number: 'Number:',
            issue: 'Issue:',
            dueDate: 'Due Date:',
            showHeader: true,
            showFooter: true,
            showWarehouse: true,
            showQty: true,
            showUom: true,
            showRate: true,
            showTax: true,
            showDiscount: true
        };
        if (companyDetails?.invoiceLabels) {
            try {
                const labels = typeof companyDetails.invoiceLabels === 'string'
                    ? JSON.parse(companyDetails.invoiceLabels)
                    : companyDetails.invoiceLabels;
                if (labels[key] !== undefined) {
                    return labels[key];
                }
            } catch (e) {}
        }
        return defaults[key] !== undefined ? defaults[key] : key;
    };

    const items = type === 'pos' ? (document.posinvoiceitem || []) : (document.invoiceitem || []);

    const returnedQtyMap = {};
    let totalReturned = 0;
    if (document.salesreturn && document.salesreturn.length > 0) {
        document.salesreturn.forEach(ret => {
            totalReturned += ret.totalAmount || 0;
            const itemsList = ret.salesreturnitem || ret.items || [];
            itemsList.forEach(item => {
                const pId = item.productId;
                if (pId) {
                    returnedQtyMap[pId] = (returnedQtyMap[pId] || 0) + (item.quantity || 0);
                }
            });
        });
    }
    const netTotal = Math.max(0, document.totalAmount - totalReturned);

    return (
        <div className="public-invoice-page bg-slate-100 min-h-screen p-4 md:p-10">
            <div className="max-w-4xl mx-auto">
                <div 
                    className={`invoice-preview-container template-${(companyDetails.invoiceTemplate || 'newyork').toLowerCase().replace(/\s+/g, '')}`}
                    id="invoice-print-content"
                    style={{ 
                        '--header-bg': companyDetails.invoiceColor || '#004aad',
                        '--header-text': (() => {
                            const hex = (companyDetails.invoiceColor || '#004aad').replace('#', '');
                            const r = parseInt(hex.substr(0, 2), 16);
                            const g = parseInt(hex.substr(2, 2), 16);
                            const b = parseInt(hex.substr(4, 2), 16);
                            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                            return (yiq >= 150) ? '#1e293b' : '#ffffff';
                        })()
                    }}
                >
                    {getCustomLabel('showHeader') !== false && (
                        <div className="invoice-header-wrapper" style={{ border: 'none', padding: '0', margin: '0' }}>
                            <div className="invoice-preview-header" style={{ marginBottom: '10px' }}>
                                <div className="invoice-header-left">
                                    {companyDetails.logo ? (
                                        <img src={companyDetails.logo} alt="Company Logo" className="invoice-logo-large" style={{ margin: '0' }} />
                                    ) : (
                                        <h2 style={{ color: companyDetails.invoiceColor, margin: 0, textTransform: 'uppercase' }}>{companyDetails.name}</h2>
                                    )}
                                </div>
                                <div className="invoice-header-right">
                                    <div className="invoice-title-large" style={{ color: companyDetails.invoiceColor, margin: '0' }}>
                                        {type === 'pos' ? 'POS RECEIPT' : 'TAX INVOICE'}
                                    </div>
                                </div>
                            </div>

                            <div className="invoice-preview-header" style={{ alignItems: 'flex-start' }}>
                                <div className="invoice-header-left">
                                    <div className="invoice-company-details">
                                        <h2 style={{ color: companyDetails.invoiceColor, margin: '0 0 5px 0', fontSize: '1.6rem', fontWeight: '900' }}>{companyDetails.name}</h2>
                                        <p>{companyDetails.address}</p>
                                        <p>{companyDetails.email} | {companyDetails.phone}</p>
                                    </div>
                                </div>
                                <div className="invoice-header-right">
                                    <div className="invoice-meta-info">
                                        <div className="invoice-meta-row">
                                            <span className="invoice-label">{getCustomLabel('number')}</span> <span>#{document.invoiceNumber}</span>
                                        </div>
                                        <div className="invoice-meta-row">
                                            <span className="invoice-label">{getCustomLabel('issue')}</span> <span>{new Date(document.date).toLocaleDateString()}</span>
                                        </div>
                                        {document.dueDate && (
                                            <div className="invoice-meta-row">
                                                <span className="invoice-label">{getCustomLabel('dueDate')}</span> <span>{new Date(document.dueDate).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="invoice-addresses" style={{ display: 'flex', justifyContent: 'space-between', width: '100% !important', marginTop: '2.5rem', gap: '3rem' }}>
                        <div className="invoice-bill-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                            <div className="invoice-section-header">{getCustomLabel('billTo')}</div>
                            <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>{document.customer?.name || document.billingName || 'Walk-in Customer'}</div>
                            <div className="invoice-company-details" style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                {document.billingAddress || document.customer?.billingAddress || 'N/A'}<br />
                                {[document.billingCity || document.customer?.billingCity, document.billingState || document.customer?.billingState].filter(Boolean).join(', ')}
                            </div>
                        </div>
                        <div className="invoice-ship-to" style={{ flex: 1, textAlign: 'right', minWidth: '0' }}>
                            <div className="invoice-section-header">{getCustomLabel('shipTo')}</div>
                            <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>{document.shippingName || document.customer?.name || 'Walk-in Customer'}</div>
                            <div className="invoice-company-details" style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                {document.shippingAddress || document.customer?.shippingAddress || 'N/A'}<br />
                                {[document.shippingCity || document.customer?.shippingCity, document.shippingState || document.customer?.shippingState].filter(Boolean).join(', ')}
                            </div>
                        </div>
                    </div>

                    <table className="invoice-table-preview">
                        <thead>
                            <tr>
                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'white' }}>{getTableHeader('item', 'Item Description').toUpperCase()}</th>
                                {getCustomLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'white' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                {getCustomLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'white', textAlign: 'center' }}>{getTableHeader('quantity', 'Qty').toUpperCase()}</th>}
                                {getCustomLabel('showUom') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'white' }}>{getTableHeader('uom', 'UOM').toUpperCase()}</th>}
                                {getCustomLabel('showRate') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'white' }}>{getTableHeader('rate', 'Rate').toUpperCase()}</th>}
                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'white' }}>AMOUNT PAID</th>
                                {getCustomLabel('showDiscount') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'white' }}>{getTableHeader('discount', 'Discount').toUpperCase()}</th>}
                                {getCustomLabel('showTax') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'white' }}>{getTableHeader('tax', 'Tax').toUpperCase()}</th>}
                                <th style={{ backgroundColor: 'var(--header-bg)', color: 'white', textAlign: 'right' }}>{getTableHeader('price', 'Total').toUpperCase()}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => {
                                const productName = item.product?.name || item.service?.name || item.description || 'Service/Product';
                                return (
                                    <tr key={idx}>
                                        <td style={{ padding: '15px 0' }}>
                                            <div className="font-bold" style={{ fontSize: '1rem', color: '#1e293b' }}>{productName}</div>
                                            {item.description && item.description !== productName && (
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{item.description}</div>
                                            )}
                                        </td>
                                        {getCustomLabel('showWarehouse') !== false && <td>{item.warehouse?.name || (item.warehouseId ? `WH #${item.warehouseId}` : 'Main Warehouse')}</td>}
                                        {getCustomLabel('showQty') !== false && (
                                            <td style={{ textAlign: 'center' }}>
                                                {item.quantity}
                                                {(() => {
                                                    const retQty = returnedQtyMap[item.productId] || 0;
                                                    return retQty > 0 ? (
                                                        <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', marginTop: '2px' }}>
                                                            ({retQty} Returned)
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </td>
                                        )}
                                        {getCustomLabel('showUom') !== false && <td>{item.uom?.unitName || (item.uomId ? `UOM #${item.uomId}` : 'pcs')}</td>}
                                        {getCustomLabel('showRate') !== false && <td>{formatCurrency(item.rate)}</td>}
                                        <td>
                                            {(() => {
                                                const totalAmount = document.totalAmount || 1;
                                                const paidAmount = document.paidAmount || 0;
                                                const itemTotal = item.amount || 0;
                                                const proportionalPaid = (itemTotal / totalAmount) * paidAmount;
                                                return formatCurrency(proportionalPaid);
                                            })()}
                                        </td>
                                        {getCustomLabel('showDiscount') !== false && <td>{formatCurrency(item.discount || 0)}</td>}
                                        {getCustomLabel('showTax') !== false && <td>{item.taxRate || 0}%</td>}
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.amount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="invoice-total-section">
                        <div className="invoice-totals">
                            <div className="invoice-total-row">
                                <span>{getCustomLabel('subTotal')}</span>
                                <span>{formatCurrency(document.subtotal)}</span>
                            </div>
                            <div className="invoice-total-row">
                                <span>Item Discount</span>
                                <span>{formatCurrency(document.discountAmount || 0)}</span>
                            </div>
                            {getCustomLabel('showTax') !== false && (
                                <div className="invoice-total-row">
                                    <span>{getCustomLabel('tax')}</span>
                                    <span>{formatCurrency(document.taxAmount || 0)}</span>
                                </div>
                            )}
                            
                            {document.overallDiscount > 0 && (
                                <div className="invoice-total-row" style={{ color: '#ef4444' }}>
                                    <span>Overall Discount ({document.overallDiscountType === 'percentage' ? `${document.overallDiscount}%` : 'Flat'})</span>
                                    <span>-{formatCurrency(document.overallDiscountType === 'percentage' ? (document.totalAmount / (1 - document.overallDiscount/100) * (document.overallDiscount/100)) : document.overallDiscount)}</span>
                                </div>
                            )}

                            <div className="invoice-final-total">
                                <span>{getCustomLabel('total')}</span>
                                <span>{formatCurrency(document.totalAmount)}</span>
                            </div>
                            
                            {totalReturned > 0 && (
                                <>
                                    <div className="invoice-total-row" style={{ color: '#ef4444', fontWeight: '600' }}>
                                        <span>Returned Amount</span>
                                        <span>-{formatCurrency(totalReturned)}</span>
                                    </div>
                                    <div className="invoice-total-row" style={{ fontWeight: '700', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                                        <span>Net Total</span>
                                        <span>{formatCurrency(netTotal)}</span>
                                    </div>
                                </>
                            )}

                            <div className="invoice-total-row" style={{ color: '#10b981', fontWeight: '600', marginTop: '5px' }}>
                                <span>Paid Amount</span>
                                <span>{formatCurrency(document.paidAmount || 0)}</span>
                            </div>
                            
                            {document.balanceAmount > 0 && (
                                <div className="invoice-total-row" style={{ color: '#ef4444', fontWeight: '600' }}>
                                    <span>Balance Due</span>
                                    <span>{formatCurrency(document.balanceAmount)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Receipt Details Section */}
                    {document?.receipt && document.receipt.length > 0 && (
                        <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginBottom: '2rem' }}>
                            <h3 className="invoice-section-header" style={{ marginBottom: '0.75rem', fontWeight: 'bold' }}>Receipt Details:</h3>
                            <table className="invoice-table-preview" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'white', padding: '8px', textAlign: 'left' }}>Date</th>
                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'white', padding: '8px', textAlign: 'left' }}>Vch Type</th>
                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'white', padding: '8px', textAlign: 'left' }}>Reference No.</th>
                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'white', padding: '8px', textAlign: 'left' }}>Received Into</th>
                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'white', padding: '8px', textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {document.receipt.map((rec, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                                            <td style={{ padding: '8px' }}>{new Date(rec.date).toLocaleDateString()}</td>
                                            <td style={{ padding: '8px' }}>Receipt</td>
                                            <td style={{ padding: '8px' }}>{rec.receiptNumber || '-'}</td>
                                            <td style={{ padding: '8px' }}>{rec.cashBankAccount?.name || '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(rec.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Returned Items Section */}
                    {document.salesreturn && document.salesreturn.length > 0 && (
                        <div style={{ marginTop: '2rem', borderTop: '2px solid #ef4444', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                            <h3 className="invoice-section-header" style={{ color: '#ef4444', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '1.1rem' }}>Returned Items:</h3>
                            <table className="invoice-table-preview">
                                <thead>
                                    <tr style={{ backgroundColor: '#fef2f2' }}>
                                        <th style={{ color: '#991b1b', padding: '10px' }}>Returned Item</th>
                                        <th style={{ color: '#991b1b', padding: '10px' }}>Warehouse</th>
                                        <th style={{ color: '#991b1b', padding: '10px', textAlign: 'center' }}>Qty Returned</th>
                                        <th style={{ color: '#991b1b', padding: '10px' }}>Rate</th>
                                        <th style={{ color: '#991b1b', padding: '10px' }}>Tax (%)</th>
                                        <th style={{ color: '#991b1b', padding: '10px', textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {document.salesreturn.flatMap((ret) => ret.salesreturnitem || []).map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #fee2e2' }}>
                                            <td style={{ padding: '12px 10px' }}>
                                                <div className="font-bold">{item.product?.name || item.description || 'Item'}</div>
                                            </td>
                                            <td style={{ padding: '12px 10px' }}>{item.warehouse?.name || (item.warehouseId ? `WH #${item.warehouseId}` : '-')}</td>
                                            <td style={{ padding: '12px 10px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>{item.quantity}</td>
                                            <td style={{ padding: '12px 10px' }}>{formatCurrency(item.rate)}</td>
                                            <td style={{ padding: '12px 10px' }}>{item.taxRate}%</td>
                                            <td style={{ padding: '12px 10px', textAlign: 'right', color: '#ef4444', fontWeight: 'bold' }}>{formatCurrency(item.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {getCustomLabel('showFooter') !== false && (document.notes || companyDetails.notes || companyDetails.termsInvoice || companyDetails.terms) && (
                        <div className="invoice-footer-notes" style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                            <div className="invoice-section-header">Notes & Terms</div>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'pre-line', marginBottom: '8px' }}>{document.notes || companyDetails.notes}</p>
                            {(companyDetails.termsInvoice || companyDetails.terms) && (
                                <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
                                    <strong>Terms:</strong> {companyDetails.termsInvoice || companyDetails.terms}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="no-print mt-10 flex justify-center">
                        <button 
                            onClick={() => window.print()}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition"
                        >
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicInvoiceView;
