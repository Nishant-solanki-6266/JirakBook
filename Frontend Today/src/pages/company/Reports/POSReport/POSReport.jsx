import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Download, Calendar,
    Receipt, FileText, PieChart, Printer,
    CreditCard, Banknote
} from 'lucide-react';
import './POSReport.css';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { useContext } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const POSReport = () => {
    const { formatCurrency, fetchCompanySettings } = useContext(CompanyContext);
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summaryStats, setSummaryStats] = useState({
        totalSales: 0,
        totalCash: 0,
        totalCard: 0,
        totalUPI: 0,
        totalOther: 0
    });

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showExportOptions, setShowExportOptions] = useState(false);

    useEffect(() => {
        fetchCompanySettings();
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [startDate, endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const response = await axiosInstance.get(`/reports/pos`, {
                    params: { companyId, startDate, endDate }
                });
                if (response.data.success) {
                    const sortedData = processReportData(response.data.data);
                    setReportData(sortedData);
                    setSummaryStats(response.data.summary);
                }
            }
        } catch (error) {
            console.error("Error fetching POS report:", error);
        } finally {
            setLoading(false);
        }
    };

    const processReportData = (data) => {
        // Flatten nested items for tabular display
        let rows = [];
        data.forEach(invoice => {
            if (invoice.posinvoiceitem && invoice.posinvoiceitem.length > 0) {
                invoice.posinvoiceitem.forEach(item => {
                    rows.push({
                        id: item.id,
                        invoiceId: invoice.id,
                        invoiceNo: invoice.invoiceNumber,
                        date: invoice.createdAt,
                        productName: item.product?.name || item.description,
                        productNameArabic: item.product?.nameArabic || '',
                        customerName: invoice.customer?.name || 'Walk-in',
                        customerNameArabic: invoice.customer?.nameArabic || '',
                        paymentType: invoice.paymentMode,
                        amount: item.amount,
                        tax: (item.amount * (item.taxRate || 0)) / 100, // Approximate per item tax if not stored
                        total: item.amount, // Item Amount is usually total line amount
                        time: new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                });
            } else {
                // Should not happen ideally, but handle empty items
                rows.push({
                    id: invoice.id,
                    invoiceId: invoice.id,
                    invoiceNo: invoice.invoiceNumber,
                    date: invoice.createdAt,
                    productName: 'N/A',
                    paymentType: invoice.paymentMode,
                    amount: invoice.subtotal,
                    tax: invoice.taxAmount,
                    total: invoice.totalAmount,
                    time: new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        });
        return rows;
    };

    const exportToExcel = () => {
        const worksheetData = reportData.map(row => ({
            'Invoice No': row.invoiceNo,
            'Date': new Date(row.date).toLocaleDateString(),
            'Product': row.productName,
            'Payment Type': row.paymentType,
            'Total': row.total,
            'Time': row.time
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "POS Report");
        XLSX.writeFile(wb, `POS_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportToPDF = async () => {
        const doc = new jsPDF('p', 'mm', 'a4');

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
        doc.text('POS Report', 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
        doc.text(`Total Sales: ${formatCurrency(summaryStats.totalSales)}`, 14, 35);
        doc.text(`Cash: ${formatCurrency(summaryStats.totalCash)}`, 70, 35);
        doc.text(`Card/Online: ${formatCurrency(summaryStats.totalCard + summaryStats.totalUPI + summaryStats.totalOther)}`, 120, 35);

        const tableColumn = ["Inv No", "Date", "Product", "Type", "Total", "Time"];
        const tableRows = reportData.map(row => {
            const productText = row.productNameArabic
                ? `${row.productName}\n${row.productNameArabic}`
                : row.productName;

            return [
                row.invoiceNo,
                new Date(row.date).toLocaleDateString(),
                makeCell(productText),
                row.paymentType,
                formatCurrency(row.total),
                row.time
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255] },
            didParseCell: (data) => {
                if (!arabicFontLoaded && data.cell.styles.font === 'Amiri') {
                    data.cell.styles.font = 'helvetica';
                }
            }
        });

        doc.save(`POS_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };


    const summaryCards = [
        { id: 1, label: 'Total Sales', value: formatCurrency(summaryStats.totalSales), color: 'blue', icon: Receipt },
        { id: 2, label: 'Cash Sales', value: formatCurrency(summaryStats.totalCash), color: 'green', icon: Banknote },
        { id: 3, label: 'Card/Online', value: formatCurrency(summaryStats.totalCard + summaryStats.totalUPI + summaryStats.totalOther), color: 'purple', icon: CreditCard },
    ];

    return (
        <div className="pos-report-page">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">POS Report</h1>
                    <p className="page-subtitle">Point of Sale transactions and analysis</p>
                </div>
                <div className="header-actions">
                    <div className="report-filters-group">
                        <div className="filter-item">
                            <label>From:</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="filter-item">
                            <label>To:</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        {(startDate || endDate) && (
                            <button className="btn-clear-filters" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>
                        )}
                    </div>
                    <div className="export-dropdown-wrapper">
                        <button className="btn-export" onClick={() => setShowExportOptions(!showExportOptions)}>
                            <Download size={16} /> Export
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

            {/* Summary Cards */}
            <div className="summary-grid-three">
                {summaryCards.map((card) => (
                    <div key={card.id} className={`summary-card card-${card.color}`}>
                        <div className="card-content">
                            <span className="card-label">{card.label}</span>
                            <h3 className="card-value">{card.value}</h3>
                        </div>
                        <div className={`card-icon icon-${card.color}`}>
                            <card.icon size={24} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Table Section */}
            <div className="report-table-card">
                {/* Table Controls */}
                <div className="table-controls">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input type="text" placeholder="Search invoices..." className="search-input" />
                    </div>
                </div>

                {/* Data Table */}
                <div className="table-container">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading POS data...</div>
                    ) : reportData.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No POS transactions found.</div>
                    ) : (
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Invoice No</th>
                                    <th>Date</th>
                                    <th>Product</th>
                                    <th>Payment Type</th>
                                    <th className="text-right">Total</th>
                                    <th>Time</th>
                                    {/* <th className="text-right">Action</th> */}
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="font-mono App-text-primary">{row.invoiceNo}</td>
                                        <td className="text-sm text-gray-600">{new Date(row.date).toLocaleDateString()}</td>
                                        <td className="font-medium">{row.productName}</td>
                                        <td>
                                            <span className={`payment-badge ${row.paymentType?.toLowerCase()}`}>
                                                {row.paymentType}
                                            </span>
                                        </td>
                                        <td className=" font-bold">{formatCurrency(row.total)}</td>
                                        <td className="text-gray-500">{row.time}</td>
                                        {/* <td className="text-right">
                                        <div className="pos-report-action-buttons">
                                            <button className="btn-icon-view" title="View Receipt">
                                                <Printer size={16} />
                                            </button>
                                        </div>
                                    </td> */}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default POSReport;
