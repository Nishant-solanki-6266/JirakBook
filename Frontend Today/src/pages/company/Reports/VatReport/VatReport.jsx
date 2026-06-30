import React, { useState, useEffect } from 'react';
import { Download, Calendar, Search, Filter, Printer } from 'lucide-react';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { useContext } from 'react';
import { CompanyContext } from '../../../../context/CompanyContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './VatReport.css';

const VatReport = () => {
    const { formatCurrency, fetchCompanySettings } = useContext(CompanyContext);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [vatData, setVatData] = useState([]);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCompanySettings();
        fetchVatReport();
    }, [year]);

    const fetchVatReport = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            if (!companyId) return;

            const response = await axiosInstance.get(`/reports/vat?companyId=${companyId}&year=${year}`);
            if (response.data.success) {
                setVatData(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching VAT report:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredData = vatData.filter(item =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalTaxable = filteredData.reduce((acc, item) => acc + item.taxableAmount, 0);
    const totalVat = filteredData.reduce((acc, item) => acc + item.vatAmount, 0);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        const wsData = [
            ["VAT Report", "", `Year: ${year}`],
            [],
            ["Type", "Description", "Date", "Taxable Amount", "VAT Rate (%)", "VAT Amount"],
            ...filteredData.map(row => [
                row.type,
                row.description,
                formatDate(row.date),
                formatCurrency(row.taxableAmount),
                `${row.vatRate}%`,
                formatCurrency(row.vatAmount)
            ]),
            [],
            ["Grand Total", "", "", formatCurrency(totalTaxable), "", formatCurrency(totalVat)]
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "VAT Report");
        XLSX.writeFile(wb, `VAT_Report_${year}.xlsx`);
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
            return { content: text, styles: { font: 'Amiri', fontSize: 9 } };
        };

        doc.setFontSize(18);
        doc.text('VAT Report', 14, 15);
        doc.setFontSize(10);
        doc.text(`Year: ${year}`, 14, 22);

        const bodyData = filteredData.map(row => {
            const descriptionText = row.descriptionArabic 
                ? `${row.description}\n${row.descriptionArabic}`
                : row.description;
            
            return [
                row.type,
                makeCell(descriptionText),
                formatCurrency(row.taxableAmount),
                `${row.vatRate}%`,
                formatCurrency(row.vatAmount)
            ];
        });
        
        // Add grand total row
        bodyData.push([
            { content: 'Grand Total', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: formatCurrency(totalTaxable), styles: { fontStyle: 'bold' } },
            { content: '' },
            { content: formatCurrency(totalVat), styles: { fontStyle: 'bold' } }
        ]);

        autoTable(doc, {
            head: [['Type', 'Description', 'Taxable Amount', 'VAT Rate', 'VAT Amount']],
            body: bodyData,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [30, 41, 59] },
            didParseCell: (data) => {
                if (!arabicFontLoaded && data.cell.styles.font === 'Amiri') {
                    data.cell.styles.font = 'helvetica';
                }
            }
        });

        doc.save(`VAT_Report_${year}.pdf`);
    };

    if (loading && vatData.length === 0) return <div className="p-8 text-center">Loading VAT Report...</div>;

    return (
        <div className="vat-report-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">VAT Report</h1>
                    <p className="page-subtitle">Value Added Tax detailed statement</p>
                </div>
                <div className="header-actions">
                    <div className="export-dropdown-wrapper">
                        <button className="btn-primary" onClick={() => setShowExportOptions(!showExportOptions)}>
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

            {/* Filters */}
            <div className="filters-card">
                <div className="filter-group">
                    <div className="date-range-picker">
                        <Calendar size={16} />
                        <select
                            className="vat-date-input"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="search-group">
                    <div className="search-input-wrapper">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* <button className="btn-filter">
                        <Filter size={16} /> Filter
                    </button> */}
                </div>
            </div>

            {/* Summary Row */}
            <div className="summary-row">
                <div className="summary-card">
                    <span className="summary-label">Total Taxable Amount</span>
                    <h3 className="summary-value">{formatCurrency(totalTaxable)}</h3>
                </div>
                <div className="summary-card highlight">
                    <span className="summary-label">Total VAT Amount</span>
                    <h3 className="summary-value">{formatCurrency(totalVat)}</h3>
                </div>
            </div>

            {/* Main Table */}
            <div className="table-card">
                <div className="table-responsive">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Description</th>
                                <th className="text-right">Taxable Amount</th>
                                <th className="text-center">VAT Rate (%)</th>
                                <th className="text-right">VAT Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? (
                                filteredData.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <span className={`type-badge ${row.type.toLowerCase()}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="desc-cell">
                                                <span className="desc-text">{row.description}</span>
                                                <span className="desc-date">{formatDate(row.date)}</span>
                                            </div>
                                        </td>
                                        <td className="text-right font-medium">{formatCurrency(row.taxableAmount)}</td>
                                        <td className="text-center">{row.vatRate}%</td>
                                        <td className="text-right font-bold">{formatCurrency(row.vatAmount)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center p-4 text-gray-500">No records found for this period.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="footer-row">
                                <td colSpan={2} className="text-right">Grand Total</td>
                                <td className="text-right">{formatCurrency(totalTaxable)}</td>
                                <td></td>
                                <td className="text-right">{formatCurrency(totalVat)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VatReport;
