import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Download, Calendar,
    ShoppingBag, CheckCircle2, XCircle, AlertCircle,
    Package, Users, LayoutList
} from 'lucide-react';
import './PurchaseReport.css';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PurchaseReport = () => {
    const { formatCurrency, fetchCompanySettings } = React.useContext(CompanyContext);
    const navigate = useNavigate();
    
    const [reportType, setReportType] = useState('general'); // general, item, vendor
    const [reportData, setReportData] = useState([]);
    const [summaryStats, setSummaryStats] = useState({
        totalAmount: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        overdue: 0
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');

    const handleApplyFilters = () => {
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
    };

    const handleResetFilters = () => {
        setTempStartDate('');
        setTempEndDate('');
        setStartDate('');
        setEndDate('');
    };
    const [showExportOptions, setShowExportOptions] = useState(false);

    useEffect(() => {
        fetchCompanySettings();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            if (!companyId) return;

            let endpoint = '/reports/purchase';
            if (reportType === 'item') endpoint = '/reports/purchase-by-item';
            if (reportType === 'vendor') endpoint = '/reports/purchase-by-vendor';

            const response = await axiosInstance.get(endpoint, {
                params: { companyId, startDate, endDate }
            });

            if (response.data.success) {
                const data = response.data.data;
                
                if (reportType === 'general') {
                    setSummaryStats(response.data.summary || {});
                    // Flatten for general view
                    const flattened = data.flatMap(bill => 
                        bill.purchasebillitem.map(item => ({
                            id: item.id,
                            billId: bill.id,
                            billNumber: bill.billNumber,
                            date: new Date(bill.date).toLocaleDateString(),
                            vendorName: bill.vendor?.name || 'Unknown',
                            productName: item.product?.name || item.description || 'Unknown',
                            qty: item.quantity,
                            amount: item.amount,
                            status: bill.status || 'UNPAID'
                        }))
                    );
                    setReportData(flattened);
                } else {
                    setReportData(data);
                }
            }
        } catch (error) {
            console.error("Error fetching report:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [reportType, startDate, endDate]);

    const filteredData = reportData.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        if (reportType === 'general') {
            return (
                item.billNumber?.toLowerCase().includes(searchLower) ||
                item.vendorName?.toLowerCase().includes(searchLower) ||
                item.productName?.toLowerCase().includes(searchLower)
            );
        } else if (reportType === 'item') {
            return item.productName?.toLowerCase().includes(searchLower) || item.sku?.toLowerCase().includes(searchLower);
        } else {
            return item.vendorName?.toLowerCase().includes(searchLower);
        }
    });

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PurchaseReport");
        XLSX.writeFile(wb, `Purchase_${reportType}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFontSize(18);
        doc.text(`Purchase Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, 20);
        
        let headers = [];
        let body = [];

        if (reportType === 'general') {
            headers = [["Bill #", "Date", "Vendor", "Product", "Qty", "Amount", "Status"]];
            body = filteredData.map(r => [r.billNumber, r.date, r.vendorName, r.productName, r.qty, formatCurrency(r.amount), r.status]);
        } else if (reportType === 'item') {
            headers = [["Product", "SKU", "Category", "Total Qty", "Total Purchase", "Avg Rate", "Bills"]];
            body = filteredData.map(r => [r.productName, r.sku, r.category, r.totalQty, formatCurrency(r.totalAmount), formatCurrency(r.avgRate), r.billCount]);
        } else {
            headers = [["Vendor Name", "Bills", "Total Purchase", "Paid", "Pending"]];
            body = filteredData.map(r => [r.vendorName, r.totalBills, formatCurrency(r.totalPurchases), formatCurrency(r.totalPaid), formatCurrency(r.totalPending)]);
        }

        autoTable(doc, {
            head: headers,
            body: body,
            startY: 30,
            theme: 'grid'
        });
        doc.save(`Purchase_${reportType}_Report.pdf`);
    };

    return (
        <div className="purchase-report-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Purchase Analytics</h1>
                    <p className="page-subtitle">Track your procurement and vendor performance</p>
                </div>
                
                <div className="header-actions">
                    <div className="report-filters-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="date-input-wrapper">
                            <span className="date-label">From</span>
                            <input type="date" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} className="date-input" />
                        </div>
                        <span className="date-separator">to</span>
                        <div className="date-input-wrapper">
                            <span className="date-label">To</span>
                            <input type="date" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} className="date-input" />
                        </div>
                        <button onClick={handleApplyFilters} className="btn-export" style={{ background: '#8ce043', color: 'white', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', transition: 'all 0.2s', height: '38px', display: 'flex', alignItems: 'center' }}>
                            Apply
                        </button>
                        <button onClick={handleResetFilters} style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontWeight: '500', transition: 'all 0.2s', height: '38px', display: 'flex', alignItems: 'center' }}>
                            Reset
                        </button>
                    </div>
                    
                    <div className="export-dropdown-wrapper">
                        <button className="btn-export" onClick={() => setShowExportOptions(!showExportOptions)}>
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

            <div className="report-tabs">
                <button className={`tab-btn ${reportType === 'general' ? 'active' : ''}`} onClick={() => setReportType('general')}>
                    <LayoutList size={18} /> Detailed Purchase
                </button>
                <button className={`tab-btn ${reportType === 'item' ? 'active' : ''}`} onClick={() => setReportType('item')}>
                    <Package size={18} /> Purchase by Item
                </button>
                <button className={`tab-btn ${reportType === 'vendor' ? 'active' : ''}`} onClick={() => setReportType('vendor')}>
                    <Users size={18} /> Purchase by Vendor
                </button>
            </div>

            {reportType === 'general' && (
                <div className="summary-grid">
                    <div className="summary-card card-blue">
                        <div className="card-content">
                            <span className="card-label">Total Purchase</span>
                            <h3 className="card-value">{formatCurrency(summaryStats.totalAmount || 0)}</h3>
                        </div>
                        <div className="card-icon icon-blue"><ShoppingBag size={24} /></div>
                    </div>
                    <div className="summary-card card-green">
                        <div className="card-content">
                            <span className="card-label">Total Paid</span>
                            <h3 className="card-value">{formatCurrency(summaryStats.totalPaid || 0)}</h3>
                        </div>
                        <div className="card-icon icon-green"><CheckCircle2 size={24} /></div>
                    </div>
                    <div className="summary-card card-orange">
                        <div className="card-content">
                            <span className="card-label">Unpaid Balance</span>
                            <h3 className="card-value">{formatCurrency(summaryStats.totalUnpaid || 0)}</h3>
                        </div>
                        <div className="card-icon icon-orange"><AlertCircle size={24} /></div>
                    </div>
                    <div className="summary-card card-red">
                        <div className="card-content">
                            <span className="card-label">Overdue Bills</span>
                            <h3 className="card-value">{formatCurrency(summaryStats.overdue || 0)}</h3>
                        </div>
                        <div className="card-icon icon-red"><XCircle size={24} /></div>
                    </div>
                </div>
            )}

            <div className="report-table-card">
                <div className="table-controls">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input 
                            type="text" 
                            placeholder={`Search by ${reportType === 'item' ? 'product' : reportType === 'vendor' ? 'vendor' : 'bill #, vendor or product'}...`} 
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-container">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading Report Data...</div>
                    ) : filteredData.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No records found matching your criteria.</div>
                    ) : (
                        <table className="report-table">
                            <thead>
                                {reportType === 'general' && (
                                    <tr>
                                        <th>Bill #</th>
                                        <th>Date</th>
                                        <th>Vendor</th>
                                        <th>Product</th>
                                        <th className="text-center">Qty</th>
                                        <th className="text-right">Amount</th>
                                        <th>Status</th>
                                    </tr>
                                )}
                                {reportType === 'item' && (
                                    <tr>
                                        <th>Product Name</th>
                                        <th>SKU</th>
                                        <th>Category</th>
                                        <th className="text-center">Total Qty</th>
                                        <th className="text-right">Total Purchase</th>
                                        <th className="text-right">Avg Rate</th>
                                        <th className="text-center">Bills</th>
                                    </tr>
                                )}
                                {reportType === 'vendor' && (
                                    <tr>
                                        <th>Vendor Name</th>
                                        <th className="text-center">Total Bills</th>
                                        <th className="text-right">Total Purchase</th>
                                        <th className="text-right">Paid</th>
                                        <th className="text-right">Pending</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {filteredData.map((row, idx) => (
                                    <tr key={idx}>
                                        {reportType === 'general' && (
                                            <>
                                                <td className="font-mono text-theme cursor-pointer hover:underline" onClick={() => navigate('/company/purchases/bill', { state: { targetBillId: row.billId } })}>
                                                    {row.billNumber}
                                                </td>
                                                <td>{row.date}</td>
                                                <td className="font-medium">{row.vendorName}</td>
                                                <td>{row.productName}</td>
                                                <td className="text-center">{row.qty}</td>
                                                <td className="text-right font-bold">{formatCurrency(row.amount)}</td>
                                                <td><span className={`status-pill ${(row.status || 'unknown').toLowerCase()}`}>{row.status || 'Unknown'}</span></td>
                                            </>
                                        )}
                                        {reportType === 'item' && (
                                            <>
                                                <td className="font-medium">{row.productName}</td>
                                                <td className="font-mono">{row.sku}</td>
                                                <td><span className="category-badge">{row.category}</span></td>
                                                <td className="text-center">{row.totalQty}</td>
                                                <td className="text-right font-bold">{formatCurrency(row.totalAmount)}</td>
                                                <td className="text-right">{formatCurrency(row.avgRate)}</td>
                                                <td className="text-center">{row.billCount}</td>
                                            </>
                                        )}
                                        {reportType === 'vendor' && (
                                            <>
                                                <td className="font-medium">{row.vendorName}</td>
                                                <td className="text-center">{row.totalBills}</td>
                                                <td className="text-right font-bold">{formatCurrency(row.totalPurchases)}</td>
                                                <td className="text-right text-theme">{formatCurrency(row.totalPaid)}</td>
                                                <td className="text-right text-red-600">{formatCurrency(row.totalPending)}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="table-footer">
                    <span className="footer-text">Showing {filteredData.length} records</span>
                </div>
            </div>
        </div>
    );
};

export default PurchaseReport;
