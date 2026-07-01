import React, { useState, useEffect } from 'react';
import {
    Calendar, Download, Printer, Search, Filter,
    ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { useContext } from 'react';
import { CompanyContext } from '../../../../context/CompanyContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './JournalEntries.css';

const JournalEntries = () => {
    const { formatCurrency, fetchCompanySettings } = useContext(CompanyContext);
    const [month, setMonth] = useState(new Date().getMonth()); // 0-11
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedEntries, setExpandedEntries] = useState({});
    const [showExportOptions, setShowExportOptions] = useState(false);

    useEffect(() => {
        fetchCompanySettings();
        fetchJournalEntries();
    }, [month, year]);

    const fetchJournalEntries = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            if (!companyId) return;

            const response = await axiosInstance.get(`/reports/journal?companyId=${companyId}&year=${year}&month=${month}`);
            if (response.data.success) {
                setEntries(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching Journal entries:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleEntry = (id) => {
        setExpandedEntries(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Filter Logic
    const filteredEntries = entries.filter(item =>
        item.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ledgers.some(l => l.amount.toString().includes(searchTerm))
    );

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        const wsData = [
            ["Journal Entries Report", "", `Period: ${monthNames[month]} ${year}`],
            [],
            ["Date", "Voucher No", "Particulars", "Debit Amount", "Credit Amount"]
        ];

        filteredEntries.forEach(entry => {
            const entryDate = new Date(entry.date).toLocaleDateString();
            entry.ledgers.forEach((ledger, idx) => {
                const particulars = ledger.nature === 'Credit' ? `To ${ledger.name}` : `${ledger.name} Dr`;
                wsData.push([
                    idx === 0 ? entryDate : "",
                    idx === 0 ? entry.voucherNo : "",
                    particulars,
                    ledger.nature === 'Debit' ? formatCurrency(ledger.amount) : '',
                    ledger.nature === 'Credit' ? formatCurrency(ledger.amount) : ''
                ]);
            });
            wsData.push(["", "", `Narration: ${entry.narration}`, "", ""]);
            wsData.push([]); // Gap between entries
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Journal");
        XLSX.writeFile(wb, `Journal_${monthNames[month]}_${year}.xlsx`);
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

        const combineName = (ledger) => {
            return ledger.nameArabic ? `${ledger.name}\n${ledger.nameArabic}` : ledger.name;
        };

        doc.setFontSize(18);
        doc.text('Journal Entries', 14, 15);
        doc.setFontSize(10);
        doc.text(`Period: ${monthNames[month]} ${year}`, 14, 22);

        const bodyData = [];
        filteredEntries.forEach(entry => {
            const entryDate = new Date(entry.date).toLocaleDateString();
            entry.ledgers.forEach((ledger, idx) => {
                const nameText = combineName(ledger);
                const particulars = ledger.nature === 'Credit' ? `  To ${nameText}` : `${nameText} Dr`;
                
                bodyData.push([
                    idx === 0 ? entryDate : "",
                    idx === 0 ? entry.voucherNo : "",
                    makeCell(particulars),
                    ledger.nature === 'Debit' ? formatCurrency(ledger.amount) : '',
                    ledger.nature === 'Credit' ? formatCurrency(ledger.amount) : ''
                ]);
            });
            
            const narrationText = entry.narrationArabic 
                ? `Narration: ${entry.narration}\n${entry.narrationArabic}`
                : `Narration: ${entry.narration}`;

            bodyData.push([
                { content: makeCell(narrationText), colSpan: 5, styles: { fontStyle: 'italic', textColor: [100, 100, 100] } }
            ]);
        });

        autoTable(doc, {
            head: [['Date', 'Voucher No', 'Particulars', 'Debit', 'Credit']],
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

        doc.save(`Journal_${monthNames[month]}_${year}.pdf`);
    };

    if (loading && entries.length === 0) return <div className="p-8 text-center">Loading Journal Entries...</div>;

    return (
        <div className="journal-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Journal Entries</h1>
                    <p className="page-subtitle">General Journal Register</p>
                </div>
                <div className="header-actions">
                    <div className="date-picker-wrapper flex items-center gap-2">
                        <Calendar size={16} />
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="date-input-clean"
                        >
                            {monthNames.map((m, idx) => (
                                <option key={idx} value={idx}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="date-input-clean"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
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
                        placeholder="Search Voucher No or Amount..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <button className="btn-filter"><Filter size={16} /> All Types</button>
                </div>
            </div>

            {/* Entries List */}
            <div className="entries-list">
                {filteredEntries.length > 0 ? (
                    filteredEntries.map((entry) => (
                        <div key={entry.id} className="entry-card">
                            <div className="entry-header">
                                <div className="header-left">
                                    <div className="date-block">
                                        <span className="date-day">{new Date(entry.date).getDate()}</span>
                                        <span className="date-month">{new Date(entry.date).toLocaleString('default', { month: 'short' })}</span>
                                    </div>
                                    <div className="voucher-info">
                                        <span className="voucher-no">{entry.voucherNo}</span>
                                        <span className="voucher-type journal">Journal</span>
                                    </div>
                                </div>
                                <div className="header-right">
                                    <div className="total-block">
                                        <span className="label">Amount</span>
                                        <span className="value">
                                            {/* Display total Debit amount (usually equals Credit) */}
                                            {formatCurrency(entry.ledgers.filter(l => l.nature === 'Debit').reduce((sum, l) => sum + l.amount, 0))}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="entry-body">
                                <table className="journal-table">
                                    <thead>
                                        <tr>
                                            <th>Particulars</th>
                                            <th className="text-right width-15">Debit (₹)</th>
                                            <th className="text-right width-15">Credit (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entry.ledgers.map((ledger, idx) => (
                                            <tr key={idx} className={ledger.nature === 'Credit' ? 'credit-row' : ''}>
                                                <td className="particulars-cell">
                                                    <span className="ledger-name">
                                                        {ledger.nature === 'Credit' ? 'To ' : ''}{ledger.name}
                                                    </span>
                                                    {ledger.nature === 'Debit' && <span className="dr-tag">Dr</span>}
                                                </td>
                                                <td className="text-right">
                                                    {ledger.nature === 'Debit' ? formatCurrency(ledger.amount) : ''}
                                                </td>
                                                <td className="text-right">
                                                    {ledger.nature === 'Credit' ? formatCurrency(ledger.amount) : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="narration-box">
                                    <span className="narration-label">Narration:</span> {entry.narration}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center p-8 text-gray-500">No journal entries found for {monthNames[month]} {year}.</div>
                )}
            </div>
        </div>
    );
};

export default JournalEntries;
