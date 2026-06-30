import React, { useState, useEffect } from 'react';
import { Search, Eye, X, Download, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { useContext } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Transactions.css';

const Transactions = () => {
    const { formatCurrency, fetchCompanySettings } = useContext(CompanyContext);
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    
    const [showExportOptions, setShowExportOptions] = useState(false);
    const navigate = useNavigate();
    
    // Set default date filters to empty string (Show All by default)
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        fetchCompanySettings();
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            if (!companyId) return;

            const response = await axiosInstance.get(`/reports/transactions?companyId=${companyId}`);
            if (response.data.success) {
                setTransactions(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatVoucherType = (type) => {
        if (!type) return '-';
        return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    const handleVoucherRedirect = (txn) => {
        if (!txn || !txn.voucherType) return;
        const lowerType = txn.voucherType.toUpperCase();
        const stateArgs = { type: txn.voucherType };

        switch (lowerType) {
            case 'SALES_INVOICE':
            case 'SALES INVOICE':
                navigate('/company/sales/invoice', { state: { ...stateArgs, targetInvoiceId: txn.targetId, type: 'TAX_INVOICE' } });
                break;
            case 'SALES_RETURN':
            case 'SALES RETURN':
                navigate('/company/sales/return', { state: { ...stateArgs, targetReturnId: txn.targetId } });
                break;
            case 'SALES_QUOTATION':
            case 'SALES QUOTATION':
                navigate('/company/sales/quotation', { state: { ...stateArgs, targetQuotationId: txn.targetId } });
                break;
            case 'SALES_ORDER':
            case 'SALES ORDER':
                navigate('/company/sales/order', { state: { ...stateArgs, targetOrderId: txn.targetId } });
                break;
            case 'DELIVERY_CHALLAN':
            case 'DELIVERY CHALLAN':
                navigate('/company/sales/challan', { state: { ...stateArgs, targetChallanId: txn.targetId } });
                break;
            case 'RECEIPT':
                navigate('/company/sales/payment', { state: { ...stateArgs, targetReceiptId: txn.targetId } });
                break;
            case 'PURCHASE_BILL':
            case 'PURCHASE BILL':
                navigate('/company/purchases/bill', { state: { ...stateArgs, targetBillId: txn.targetId } });
                break;
            case 'PURCHASE_RETURN':
            case 'PURCHASE RETURN':
                navigate('/company/purchases/return', { state: { ...stateArgs, targetReturnId: txn.targetId } });
                break;
            case 'PURCHASE_ORDER':
            case 'PURCHASE ORDER':
                navigate('/company/purchases/order', { state: { ...stateArgs, targetOrderId: txn.targetId } });
                break;
            case 'PURCHASE_QUOTATION':
            case 'PURCHASE QUOTATION':
                navigate('/company/purchases/quotation', { state: { ...stateArgs, targetQuotationId: txn.targetId } });
                break;
            case 'GOODS_RECEIPT':
            case 'GOODS RECEIPT':
                navigate('/company/purchases/receipt', { state: { ...stateArgs, targetGrnId: txn.targetId } });
                break;
            case 'PAYMENT':
                navigate('/company/purchases/payment', { state: { ...stateArgs, targetPaymentId: txn.targetId } });
                break;
            case 'EXPENSE':
                navigate('/company/voucher/expenses', { state: { ...stateArgs, targetExpenseId: txn.targetId } });
                break;
            case 'INCOME':
                navigate('/company/voucher/income', { state: { ...stateArgs, targetIncomeId: txn.targetId } });
                break;
            case 'CONTRA':
                navigate('/company/voucher/contra', { state: { ...stateArgs, targetContraId: txn.targetId } });
                break;
            case 'JOURNAL':
                navigate('/company/voucher/create', { state: { ...stateArgs, targetJournalId: txn.targetId } });
                break;
            case 'POS':
            case 'POS_INVOICE':
                navigate('/company/pos/all-invoices', { state: { ...stateArgs, targetInvoiceId: txn.targetId } });
                break;
            case 'BANK_TRANSFER':
            case 'BANK TRANSFER':
                navigate('/company/bank-transfer', { state: { ...stateArgs, targetTransferId: txn.targetId } });
                break;
            default:
                break;
        }
    };

    // Filter Logic
    const filteredTransactions = transactions.filter(item => {
        const itemDate = new Date(item.date);
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        
        let dateMatch = true;
        if (from) dateMatch = dateMatch && itemDate >= from;
        if (to) {
            // Need to set the to-date exactly at 23:59:59 to capture records created that day
            const endOfDayTo = new Date(to);
            endOfDayTo.setHours(23, 59, 59, 999);
            dateMatch = dateMatch && itemDate <= endOfDayTo;
        }

        const searchMatch = (item.voucherNo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.fromTo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.voucherType?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        return dateMatch && searchMatch;
    });

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        const wsData = [
            ["All Transactions Report", "", `Period: ${fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Time'}`],
            [],
            ["Date", "Transaction ID", "Balance Type", "Voucher Type", "Voucher No", "Amount", "From/To", "Account Type", "Note"],
            ...filteredTransactions.map(row => [
                formatDate(row.date),
                row.transactionId,
                row.balanceType,
                formatVoucherType(row.voucherType),
                row.voucherNo,
                row.amount,
                row.fromTo,
                row.accountType,
                row.note
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, `Transactions_${fromDate || 'all'}_${toDate || 'all'}.xlsx`);
    };

    const exportToPDF = async () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        // --- Register Arabic Font (Amiri TTF) from CDN ---
        let arabicFontLoaded = false;
        try {
            const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf';
            const fontResponse = await fetch(fontUrl);
            if (fontResponse.ok) {
                const fontBuffer = await fontResponse.arrayBuffer();
                const uint8Array = new Uint8Array(fontBuffer);
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
                }
                const base64Font = btoa(binary);
                doc.addFileToVFS('Amiri-Regular.ttf', base64Font);
                doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
                arabicFontLoaded = true;
            }
        } catch (e) {
            console.warn('Could not load Amiri Arabic font, PDF will render without Arabic:', e);
        }

        // Helper: check if text has Arabic characters
        const hasArabic = (text) => {
            if (!text) return false;
            return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
        };

        // Helper: build cell with Arabic font if needed
        const makeCell = (text) => {
            if (!arabicFontLoaded || !hasArabic(text)) return text || '-';
            return { content: text, styles: { font: 'Amiri', fontSize: 8 } };
        };

        doc.setFontSize(18);
        doc.text('All Transactions', 14, 15);
        doc.setFontSize(10);
        doc.text(`Period: ${fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Time'}`, 14, 22);

        const bodyData = filteredTransactions.map(row => {
            const fromToText = row.fromToArabic 
                ? `${row.fromTo}\n${row.fromToArabic}`
                : row.fromTo;
            
            const noteText = row.noteArabic
                ? `${row.note}\n${row.noteArabic}`
                : row.note;

            return [
                formatDate(row.date),
                row.transactionId,
                row.balanceType,
                formatVoucherType(row.voucherType),
                row.voucherNo,
                formatCurrency(row.amount),
                makeCell(fromToText),
                row.accountType,
                makeCell(noteText)
            ];
        });

        autoTable(doc, {
            head: [['Date', 'Transaction ID', 'Mode', 'Voucher', 'Number', 'Amount', 'Target', 'Account', 'Note']],
            body: bodyData,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [30, 41, 59] },
            didParseCell: (data) => {
                if (!arabicFontLoaded && data.cell.styles.font === 'Amiri') {
                    data.cell.styles.font = 'helvetica';
                }
            }
        });

        doc.save(`Transactions_${fromDate || 'all'}_${toDate || 'all'}.pdf`);
    };

    // Pagination Logic
    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    const currentEntries = filteredTransactions.slice(indexOfFirstEntry, indexOfLastEntry);
    const totalPages = Math.ceil(filteredTransactions.length / entriesPerPage);

    const changePage = (page) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleView = (txn) => {
        setSelectedTransaction(txn);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTransaction(null);
    };

    return (
        <div className="transactions-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title">All Transactions</h1>
                <div className="header-actions">
                    <div className="export-dropdown-wrapper">
                        <button className="btn-primary" onClick={() => setShowExportOptions(!showExportOptions)}>
                            <Download size={18} /> Export
                        </button>
                        {showExportOptions && (
                            <div className="export-menu">
                                <button onClick={() => { exportToExcel(); setShowExportOptions(false); }}>Excel File (.xlsx)</button>
                                <button onClick={() => { exportToPDF(); setShowExportOptions(false); }}>PDF Document (.pdf)</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="transactions-card">
                <div className="controls-row">
                    <div className="entries-control">
                        <select
                            value={entriesPerPage}
                            onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                            className="entries-select"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="entries-text">entries per page</span>
                    </div>
                    <div className="date-picker-wrapper">
                        <Calendar size={16} />
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="date-input-clean"
                            style={{ width: '110px' }}
                        />
                        <span style={{ margin: '0 4px', color: '#6b7280' }}>to</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="date-input-clean"
                            style={{ width: '110px' }}
                        />
                        {(fromDate || toDate) && (
                            <button
                                onClick={() => { setFromDate(''); setToDate(''); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    marginLeft: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="search-control">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="transactions-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>DATE</th>
                                <th>TRANSACTION ID</th>
                                <th>BALANCE TYPE</th>
                                <th>VOUCHER TYPE</th>
                                <th>VOUCHER NO</th>
                                <th className="text-right">AMOUNT</th>
                                <th>FROM/TO</th>
                                <th>ACCOUNT TYPE</th>
                                {/* <th>NOTE</th> */}
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentEntries.map((txn, index) => (
                                <tr key={txn.id}>
                                    <td>{indexOfFirstEntry + index + 1}</td>
                                    <td>{formatDate(txn.date)}</td>
                                    <td>{txn.transactionId}</td>
                                    <td>
                                        {/* <span className={`status-badge ${txn.balanceType === 'Debit' ? 'status-debit' : 'status-credit'}`}> */}
                                        {txn.balanceType}

                                    </td>
                                    <td className="voucher-type-cell">{formatVoucherType(txn.voucherType)}</td>
                                    <td>
                                        {txn.targetId ? (
                                            <div 
                                                className="voucher-badge"
                                                onClick={() => handleVoucherRedirect(txn)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                #{txn.voucherNo}
                                            </div>
                                        ) : (
                                            <div 
                                                className="voucher-badge disabled"
                                                style={{ cursor: 'default', opacity: 0.6, backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }}
                                            >
                                                #{txn.voucherNo}
                                            </div>
                                        )}
                                    </td>
                                    <td className={`text-right font-bold ${txn.balanceType === 'Debit' ? 'App-text-success' : 'text-danger'}`}>
                                        {formatCurrency(txn.amount)}
                                    </td>
                                    <td>{txn.fromTo}</td>
                                    <td>{txn.accountType}</td>
                                    {/* <td className="note-cell">{txn.note}</td>/ */}
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="action-btn btn-view"
                                                data-tooltip="View"
                                                onClick={() => handleView(txn)}
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {currentEntries.length === 0 && (
                                <tr>
                                    <td colSpan="11" className="text-center p-4 text-gray-500">
                                        {loading ? "Loading transactions..." : "No transactions found."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination-row">
                    <p className="pagination-info">
                        Showing {filteredTransactions.length > 0 ? indexOfFirstEntry + 1 : 0} to {Math.min(indexOfLastEntry, filteredTransactions.length)} of {filteredTransactions.length} entries
                    </p>
                    <div className="pagination-controls">
                        <button
                            className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                            onClick={() => changePage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>

                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            // Simple logic to show first 5 or logic to show current window
                            // For simplicity: just show up to 5, or if many pages need better logic.
                            // Let's just show current page surrounding.
                            let list = [];
                            // ... complex pagination logic omitted for brevity, let's just show Previous/Next + Current
                            return null;
                        })}
                        {/* Simplified Pagination: Active Page Indicator */}
                        <button className="pagination-btn active">{currentPage}</button>

                        <button
                            className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                            onClick={() => changePage(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* View Modal */}
            {isModalOpen && selectedTransaction && (
                <div className="txn-modal-overlay">
                    <div className="txn-modal-card">
                        <div className="txn-modal-header">
                            <h2>Transaction Details</h2>
                            <button className="txn-close-btn" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="txn-modal-body">
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">Transaction ID:</span>
                                <span className="txn-detail-value">{selectedTransaction.transactionId}</span>
                            </div>
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">Date:</span>
                                <span className="txn-detail-value">{formatDate(selectedTransaction.date)}</span>
                            </div>
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">Voucher Type:</span>
                                <span className="txn-detail-value">{selectedTransaction.voucherType}</span>
                            </div>
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">Voucher No:</span>
                                <span className="txn-detail-value">{selectedTransaction.voucherNo}</span>
                            </div>
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">Amount:</span>
                                <span className={`txn-detail-value ${selectedTransaction.balanceType === 'Debit' ? 'App-text-success' : 'text-danger'}`}>
                                    {formatCurrency(selectedTransaction.amount)}
                                </span>
                            </div>
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">Balance Type:</span>
                                <span className="txn-detail-value">{selectedTransaction.balanceType}</span>
                            </div>
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">From/To:</span>
                                <span className="txn-detail-value">{selectedTransaction.fromTo}</span>
                            </div>
                            <div className="txn-detail-row">
                                <span className="txn-detail-label">Account Type:</span>
                                <span className="txn-detail-value">{selectedTransaction.accountType}</span>
                            </div>
                            {/* <div className="txn-detail-row">
                                <span className="txn-detail-label">Note:</span>
                                <span className="txn-detail-value">{selectedTransaction.note}</span>
                            </div> */}
                        </div>
                        <div className="txn-modal-footer">
                            <button className="txn-btn-close" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Transactions;
