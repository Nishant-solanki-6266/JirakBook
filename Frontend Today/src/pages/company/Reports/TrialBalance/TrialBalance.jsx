import React, { useState, useEffect } from 'react';
import {
    Calendar, Download, Printer, Search, Filter,
    ArrowRightLeft
} from 'lucide-react';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { useContext } from 'react';
import { CompanyContext } from '../../../../context/CompanyContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './TrialBalance.css';

const TrialBalance = () => {
    const { formatCurrency, fetchCompanySettings } = useContext(CompanyContext);
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showExportOptions, setShowExportOptions] = useState(false);

    useEffect(() => {
        fetchCompanySettings();
        fetchTrialBalance();
    }, [selectedDate]);

    const fetchTrialBalance = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            if (!companyId) return;

            const response = await axiosInstance.get(`/reports/trial-balance?companyId=${companyId}&date=${selectedDate}`);
            if (response.data.success) {
                setAccounts(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching Trial Balance:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAccounts = accounts.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalDebit = filteredAccounts.reduce((acc, item) => acc + (item.debit || 0), 0);
    const totalCredit = filteredAccounts.reduce((acc, item) => acc + (item.credit || 0), 0);

    // Check if balanced within a small margin of error for floating point
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        const wsData = [
            ["Trial Balance Report", "", `Date: ${formatDate(selectedDate)}`],
            [],
            ["Account Name", "Account Type", "Debit Amount", "Credit Amount"],
            ...filteredAccounts.map(row => [
                row.name,
                row.type,
                row.debit > 0 ? formatCurrency(row.debit) : '-',
                row.credit > 0 ? formatCurrency(row.credit) : '-'
            ]),
            [],
            ["Total", "", formatCurrency(totalDebit), formatCurrency(totalCredit)]
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
        XLSX.writeFile(wb, `Trial_Balance_${selectedDate}.xlsx`);
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

        const combineName = (item) => {
            return item.nameArabic ? `${item.name}\n${item.nameArabic}` : item.name;
        };

        doc.setFontSize(18);
        doc.text('Trial Balance', 14, 15);
        doc.setFontSize(10);
        doc.text(`As of: ${formatDate(selectedDate)}`, 14, 22);

        const bodyData = filteredAccounts.map(row => [
            makeCell(combineName(row)),
            row.type,
            row.debit > 0 ? formatCurrency(row.debit) : '-',
            row.credit > 0 ? formatCurrency(row.credit) : '-'
        ]);
        
        bodyData.push([
            { content: 'Total', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: formatCurrency(totalDebit), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: formatCurrency(totalCredit), styles: { fontStyle: 'bold', halign: 'right' } }
        ]);

        autoTable(doc, {
            head: [['Account Name', 'Account Type', 'Debit Amount', 'Credit Amount']],
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

        doc.save(`Trial_Balance_${selectedDate}.pdf`);
    };

    if (loading && accounts.length === 0) return <div className="p-8 text-center">Loading Trial Balance...</div>;

    return (
        <div className="trial-balance-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Trial Balance</h1>
                    <p className="page-subtitle">As of {formatDate(selectedDate)}</p>
                </div>
                <div className="header-actions">
                    <div className="date-picker-wrapper">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="date-input-clean"
                        />
                    </div>
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

            {/* Controls */}
            <div className="controls-card">
                <div className="search-group">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search Account Name..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Main Table */}
            <div className="table-card">
                <div className="table-responsive">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Account Name</th>
                                <th>Account Type</th>
                                <th className="text-right">Debit (₹)</th>
                                <th className="text-right">Credit (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAccounts.length > 0 ? (
                                filteredAccounts.map((row) => (
                                    <tr key={row.id}>
                                        <td className="font-medium text-slate-700">{row.name}</td>
                                        <td>
                                            <span className={`type-badge ${row.type.toLowerCase().replace(/\s/g, '-')}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="text-right">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                                        <td className="text-right">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="text-center p-4 text-gray-500">No accounts found with balance.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="footer-row">
                                <td colSpan={2} className="text-right uppercase tracking-wider">Total</td>
                                <td className="text-right text-blue-700">{formatCurrency(totalDebit)}</td>
                                <td className="text-right text-blue-700">{formatCurrency(totalCredit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Balance Status */}
            <div className={`status-bar ${isBalanced ? 'balanced' : 'unbalanced'}`}>
                <div className="icon-wrapper">
                    <ArrowRightLeft size={20} />
                </div>
                {isBalanced ? (
                    <div className="status-info">
                        <strong>Trial Balance is matched</strong>
                        <span>Total Debits equal Total Credits.</span>
                    </div>
                ) : (
                    <div className="status-info">
                        <strong>Difference Detected</strong>
                        <span>Debits and Credits do not match. Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrialBalance;
