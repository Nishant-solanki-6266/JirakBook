import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Download, FileText, Printer } from 'lucide-react';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


import toast from 'react-hot-toast';
import chartOfAccountsService from '../../../../services/chartOfAccountsService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { useContext } from 'react';
import './LedgerReport.css';

const formatVoucherType = (type) => {
    if (!type) return '-';
    const upper = type.toUpperCase();
    if (upper === 'OPENING BALANCE') return 'Opening Balance';
    if (upper === 'POS_INVOICE') return 'POS Invoice';
    if (upper === 'JOURNAL') return 'Journal Entry';
    if (upper === 'INVOICE') return 'Sales Invoice';
    if (upper === 'BILL') return 'Purchase Bill';
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const LedgerReport = () => {
    const { formatCurrency, fetchCompanySettings, companySettings } = useContext(CompanyContext);
    const location = useLocation();
    const navigate = useNavigate();

    // State
    const [ledgers, setLedgers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedAccount, setSelectedAccount] = useState('');
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });
    const [filterType, setFilterType] = useState('ALL');
    const [hideInvoice, setHideInvoice] = useState(false);
    const [hideReceipt, setHideReceipt] = useState(false);
    const [enableColors, setEnableColors] = useState(true);



    // Helper to flatten COA for dropdown
    const flattenLedgers = (coaData) => {
        let flattened = [];
        const traverse = (groups, parentType = null) => {
            groups.forEach(group => {
                const currentType = group.type || parentType;
                if (group.ledger) {
                    group.ledger.forEach(ledger => flattened.push({
                        ...ledger,
                        groupName: group.name,
                        groupType: currentType
                    }));
                }
                if (group.accountsubgroup) {
                    traverse(group.accountsubgroup, currentType);
                }
            });
        };
        traverse(coaData);
        return flattened;
    };

    // Fetch initial data (Ledger List)
    useEffect(() => {
        fetchCompanySettings();
        const fetchLedgers = async () => {
            try {
                // We use getChartOfAccounts to build the dropdown options
                const response = await chartOfAccountsService.getChartOfAccounts();
                if (response.success) {
                    const allLedgers = flattenLedgers(response.data);
                    setLedgers(allLedgers);

                    // Pre-select account if passed via navigation state
                    if (location.state?.accountId) {
                        setSelectedAccount(location.state.accountId);
                    } else if (allLedgers.length > 0) {
                        // Default to first account 
                        setSelectedAccount(allLedgers[0].id);
                    }
                }
            } catch (error) {
                console.error('Error fetching ledgers:', error);
                toast.error('Failed to load chart of accounts');
            }
        };

        const initDates = () => {
            if (location.state?.startDate && location.state?.endDate) {
                setDateRange({
                    startDate: location.state.startDate,
                    endDate: location.state.endDate
                });
            } else {
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

                setDateRange({
                    startDate: firstDay.toISOString().split('T')[0],
                    endDate: lastDay.toISOString().split('T')[0]
                });
            }
        };

        fetchLedgers();
        initDates();
    }, [location.state]);

    // Fetch Transactions when Selected Account Changes or Search is clicked
    const fetchTransactions = async () => {
        if (!selectedAccount) return;

        setLoading(true);
        try {
            const companyId = GetCompanyId();
            // NOTE: The service method might need to support date filtering params.
            // Currently assuming getLedgerTransactions fetches all or we filter client side.
            // If backend supports optional query params, we should pass them.
            // For now, fetching all and filtering client side if needed, or assumig backend gives recent.
            const response = await chartOfAccountsService.getLedgerTransactions(selectedAccount, companyId);
            if (response.success) {
                setTransactions(response.data);
            } else {
                setTransactions([]); // Clear or empty
                if (response.message) toast.error(response.message);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            // toast.error('Failed to fetch transactions'); // Optional, to avoid spam
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when selectedAccount changes (optional, or wait for search button)
    useEffect(() => {
        if (selectedAccount) {
            fetchTransactions();
        }
    }, [selectedAccount]);

    const handleSearch = () => {
        fetchTransactions();
    };

    const handleReset = () => {
        const today = new Date();
        setDateRange({
            startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
            endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
        });
        setFilterType('ALL');
        setHideInvoice(false);
        setHideReceipt(false);
        setEnableColors(true);
        // Optionally reset account or keep it
        fetchTransactions();
    };

    // Process transactions to add running balance
    // Backend might return them sorted, but we ensure sorting by Date
    const [expandedGroups, setExpandedGroups] = useState({});

    const handleDownloadExcel = () => {
        if (!groupedTransactions || groupedTransactions.length === 0) {
            return;
        }

        // Build rows for Excel
        const rows = [];

        // Header info rows
        rows.push(['Ledger Summary']);
        rows.push(['Account:', currentLedgerName]);
        rows.push([
            'Period:',
            `${dateRange.startDate || 'All'} to ${dateRange.endDate || 'All'}`
        ]);
        rows.push([]); // blank spacer

        // Column headers
        rows.push([
            'ACCOUNT NAME',
            'TRANSACTION TYPE',
            'REF NO',
            'DATE',
            'DEBIT',
            'CREDIT',
            'BALANCE'
        ]);

        // Data rows — flatten all groups and their sub-items
        groupedTransactions.forEach(group => {
            const displayType = formatVoucherType(group.typeLabel);
            rows.push([
                currentLedgerName,
                group.items.length > 1 ? `${displayType} (${group.items.length} lines)` : displayType,
                group.refNo || '-',
                group.date ? new Date(group.date).toLocaleDateString() : '-',
                group.totalDebit > 0 ? group.totalDebit : '',
                group.totalCredit > 0 ? group.totalCredit : '',
                `${Math.abs(group.lastBalance).toFixed(2)} ${group.lastBalance >= 0 ? 'Dr' : 'Cr'}`
            ]);
            // Sub-transaction rows (only if there are multiple sub-items to expand)
            if (group.items.length > 1) {
                group.items.forEach(item => {
                    const name = item.partyName !== '-'
                        ? item.partyName
                        : (item.creditLedger?.name || item.debitLedger?.name || '-');
                    rows.push([
                        `  ↳ ${name}`,
                        formatVoucherType(item.voucherType || group.typeLabel),
                        item.refNo || group.refNo || '-',
                        item.dateStr || new Date(item.date).toLocaleDateString(),
                        item.debit > 0 ? item.debit : '',
                        item.credit > 0 ? item.credit : '',
                        `${Math.abs(item.balance).toFixed(2)} ${item.balance >= 0 ? 'Dr' : 'Cr'}`
                    ]);
                });
            }
        });

        // Create worksheet and workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Style the header columns (bold, wider)
        ws['!cols'] = [
            { wch: 30 }, // Account Name
            { wch: 22 }, // Transaction Type
            { wch: 16 }, // Ref No
            { wch: 14 }, // Date
            { wch: 14 }, // Debit
            { wch: 14 }, // Credit
            { wch: 16 }  // Balance
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ledger Summary');

        const fileName = `Ledger_${currentLedgerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const handleDownloadPDF = async () => {
        if (!groupedTransactions || groupedTransactions.length === 0) return;

        const doc = new jsPDF({ orientation: 'landscape' });

        // --- Register Arabic Font (Amiri TTF) from CDN ---
        // jsPDF only supports TTF format (not woff/woff2)
        let arabicFontLoaded = false;
        try {
            // Fetch actual TTF binary from jsDelivr (Google Fonts GitHub mirror)
            const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf';
            const fontResponse = await fetch(fontUrl);
            if (fontResponse.ok) {
                const fontBuffer = await fontResponse.arrayBuffer();
                // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
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

        // Helper: build cell with Arabic + English text
        // Handles: (1) arabicName provided separately, (2) englishName itself contains Arabic
        const makeNameCell = (englishName, arabicName) => {
            if (!arabicFontLoaded) return englishName || '-';
            const nameHasArabic = hasArabic(englishName);
            const hasExtra = arabicName && arabicName.trim().length > 0;
            // No Arabic anywhere - plain string
            if (!nameHasArabic && !hasExtra) return englishName || '-';
            // Build content: englishName on line 1, arabicName on line 2 (if separate)
            const content = hasExtra
                ? `${englishName || '-'}\n${arabicName}`
                : (englishName || '-');
            return { content, styles: { font: 'Amiri', fontSize: 8, lineHeight: 1.5 } };
        };

        // Unused renderArabic kept for reference
        const renderArabic = (text) => {
            if (!text) return '';
            return text;
        };

        // --- Header ---
        // Helper: split text into English-only and Arabic-only segments
        const splitByScript = (text) => {
            if (!text) return [{ text: '', isArabic: false }];
            const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
            const parts = [];
            let lastIndex = 0;
            let match;
            while ((match = arabicRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push({ text: text.slice(lastIndex, match.index).trim(), isArabic: false });
                }
                parts.push({ text: match[0], isArabic: true });
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < text.length) {
                parts.push({ text: text.slice(lastIndex).trim(), isArabic: false });
            }
            return parts.filter(p => p.text.length > 0);
        };

        // Helper: render mixed English/Arabic text on the SAME line
        // Returns the Y position (same as input y since it's one line)
        const renderMixedText = (text, x, y, fontSize, fontStyle = 'normal') => {
            if (!text) return y;
            if (!arabicFontLoaded || !hasArabic(text)) {
                doc.setFont('helvetica', fontStyle);
                doc.setFontSize(fontSize);
                doc.text(text, x, y);
                return y;
            }
            // Has Arabic: split by script
            const segments = splitByScript(text);
            const englishParts = segments.filter(s => !s.isArabic).map(s => s.text).join(' ').trim();
            const arabicParts = segments.filter(s => s.isArabic).map(s => s.text).join(' ').trim();

            let currentX = x;

            // Render English part
            if (englishParts) {
                doc.setFont('helvetica', fontStyle);
                doc.setFontSize(fontSize);
                doc.text(englishParts, currentX, y);
                currentX += doc.getTextWidth(englishParts) + 5; // 5 units gap
            }

            // Render Arabic part on the SAME line
            if (arabicParts) {
                doc.setFont('Amiri', 'normal');
                doc.setFontSize(fontSize);
                doc.text(arabicParts, currentX, y);
            }

            doc.setFont('helvetica', fontStyle);
            return y;
        };

        if (companySettings?.logo) {
            try {
                doc.addImage(companySettings.logo, 'PNG', 14, 10, 25, 25);
            } catch (e) {
                console.warn("Could not add logo to PDF:", e);
            }
        }

        // Company Name - Now on a single line
        const nameBottomY = renderMixedText(companySettings?.name || 'Ledger Summary', 45, 18, 20, 'bold');

        // Address & Phone
        const infoStartY = nameBottomY + 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(companySettings?.address || '', 45, infoStartY);
        doc.text(`Phone: ${companySettings?.phone || ''} | Email: ${companySettings?.email || ''}`, 45, infoStartY + 5);

        // Divider line
        doc.line(14, 38, 283, 38);

        // Account Ledger - Single line
        const ledgerBottomY = renderMixedText(`Account Ledger: ${currentLedgerName}`, 14, 48, 13, 'bold');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Period: ${dateRange.startDate || 'All'} to ${dateRange.endDate || 'All'}`, 14, ledgerBottomY + 6);
        doc.text(`Type: ${filterType} | Generated: ${new Date().toLocaleString()}`, 14, ledgerBottomY + 11);

        // --- Build table body ---
        const tableBody = [];
        groupedTransactions.forEach(group => {
            // Get Arabic name from group or first item
            const arabicName = group.partyNameArabic || group.items[0]?.partyNameArabic || '';

            const displayType = formatVoucherType(group.typeLabel);
            // Summary row - use makeNameCell which checks arabicFontLoaded
            tableBody.push([
                makeNameCell(currentLedgerName, arabicName),
                group.items.length > 1 ? `${displayType} (${group.items.length} lines)` : displayType,
                group.refNo || '-',
                group.date ? new Date(group.date).toLocaleDateString() : '-',
                group.totalDebit > 0 ? group.totalDebit.toFixed(2) : '-',
                group.totalCredit > 0 ? group.totalCredit.toFixed(2) : '-',
                `${Math.abs(group.lastBalance).toFixed(2)} ${group.lastBalance >= 0 ? 'Dr' : 'Cr'}`
            ]);
            // Sub-rows (only if there are multiple sub-items to expand)
            if (group.items.length > 1) {
                group.items.forEach(item => {
                    const name = item.partyName !== '-'
                        ? item.partyName
                        : (item.creditLedger?.name || item.debitLedger?.name || '-');
                    const itemArabicName = item.partyNameArabic || '';
                    const nameCell = makeNameCell(`  \u21b3 ${name}`, itemArabicName);
                    tableBody.push([
                        typeof nameCell === 'string'
                            ? { content: nameCell, styles: { textColor: [100, 116, 139], fontSize: 7 } }
                            : nameCell,
                        formatVoucherType(item.voucherType || group.typeLabel),
                        item.refNo || group.refNo || '-',
                        item.dateStr || new Date(item.date).toLocaleDateString(),
                        item.debit > 0 ? item.debit.toFixed(2) : '-',
                        item.credit > 0 ? item.credit.toFixed(2) : '-',
                        `${Math.abs(item.balance).toFixed(2)} ${item.balance >= 0 ? 'Dr' : 'Cr'}`
                    ]);
                });
            }
        });

        autoTable(doc, {
            startY: ledgerBottomY + 14,
            margin: { left: 14, right: 14 },
            head: [['ACCOUNT NAME', 'TRANSACTION TYPE', 'REF NO', 'DATE', 'DEBIT', 'CREDIT', 'BALANCE']],
            body: tableBody,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 8
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 'auto' }, // Flexible to fill space
                1: { cellWidth: 45 },
                2: { cellWidth: 35 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30, halign: 'right' },
                5: { cellWidth: 30, halign: 'right' },
                6: { cellWidth: 35, halign: 'right' }
            },
            didParseCell: (data) => {
                // Style sub-rows (indented ↳ rows) in grey when no Arabic font
                const cellContent = data.row.raw?.[0];
                const contentStr = typeof cellContent === 'string'
                    ? cellContent
                    : (cellContent?.content?.toString() || '');
                if (contentStr.includes('\u21b3')) {
                    // Only apply grey if not already styled by makeNameCell (Amiri font)
                    const hasCustomFont = typeof cellContent === 'object' && cellContent?.styles?.font;
                    if (!hasCustomFont) {
                        data.cell.styles.textColor = [100, 116, 139];
                        data.cell.styles.fontSize = 7;
                    }
                }
                // Safety: if Amiri font not loaded, override back to helvetica
                if (!arabicFontLoaded && data.cell.styles.font === 'Amiri') {
                    data.cell.styles.font = 'helvetica';
                }
            }
        });

        const fileName = `Ledger_${currentLedgerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const content = document.querySelector('.Ledger-table-card').innerHTML;
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(s => s.outerHTML)
            .join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Ledger Report - ${currentLedgerName}</title>
                    ${styles}
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        .print-header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                        .print-logo { width: 80px; height: 80px; object-fit: contain; }
                        .print-info h1 { margin: 0; color: #1e293b; }
                        .print-info p { margin: 5px 0; color: #64748b; }
                        .Ledger-expand-btn { display: none; }
                        @media print {
                            .Ledger-table { width: 100%; border-collapse: collapse; }
                            .Ledger-table th, .Ledger-table td { border: 1px solid #e2e8f0; padding: 8px; }
                            .Ledger-expand-btn { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        ${companySettings?.logo ? `<img src="${companySettings.logo}" class="print-logo" />` : ''}
                        <div class="print-info">
                            <h1>${companySettings?.name || 'Ledger Report'}</h1>
                            <p>${companySettings?.address || ''}</p>
                            <p>Phone: ${companySettings?.phone || ''} | Email: ${companySettings?.email || ''}</p>
                        </div>
                    </div>
                    <div class="report-meta">
                        <h2>Account Ledger: ${currentLedgerName}</h2>
                        <p>Period: ${dateRange.startDate || 'All'} to ${dateRange.endDate || 'All'}</p>
                        <p>Generated on: ${new Date().toLocaleString()}</p>
                    </div>
                    ${content}

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

                    <script>
                        window.onload = () => {
                            window.print();
                            // window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const toggleGroup = (groupKey) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    const handleVoucherRedirect = (typeLabel, item) => {
        if (!item) return;
        const upperType = typeLabel?.toUpperCase();
        const stateArgs = { type: upperType };

        if ((upperType === 'INVOICE' || upperType === 'SALES_INVOICE' || upperType === 'SALES INVOICE') && item.invoice) {
            navigate('/company/sales/invoice', { state: { ...stateArgs, targetInvoiceId: item.invoice.id, type: 'TAX_INVOICE' } });
        } else if ((upperType === 'BILL' || upperType === 'PURCHASE_BILL' || upperType === 'PURCHASE BILL') && item.purchaseBill) {
            navigate('/company/purchases/bill', { state: { ...stateArgs, targetBillId: item.purchaseBill.id } });
        } else if (upperType === 'RECEIPT') {
            if (item.posInvoice) {
                navigate('/company/pos/all-invoices', { state: { ...stateArgs, targetInvoiceId: item.posInvoice.id } });
            } else if (item.receipt) {
                navigate('/company/sales/payment', { state: { ...stateArgs, targetReceiptId: item.receipt.id } });
            }
        } else if (upperType === 'PAYMENT' && item.payment) {
            navigate('/company/purchases/payment', { state: { ...stateArgs, targetPaymentId: item.payment.id } });
        } else if ((upperType === 'POS_INVOICE' || upperType === 'POS INVOICE') && item.posInvoice) {
            navigate('/company/pos/all-invoices', { state: { ...stateArgs, targetInvoiceId: item.posInvoice.id } });
        } else if (upperType === 'JOURNAL' && item.journalEntry) {
            navigate('/company/voucher/create', { state: { ...stateArgs, targetJournalId: item.journalEntry.id } });
        } else if (upperType === 'JOURNAL' && item.posInvoice) {
            navigate('/company/pos/all-invoices', { state: { ...stateArgs, targetInvoiceId: item.posInvoice.id } });
        } else if (upperType === 'JOURNAL' && item.invoice) {
            navigate('/company/sales/invoice', { state: { ...stateArgs, targetInvoiceId: item.invoice.id, type: 'TAX_INVOICE' } });
        }
    };

    // Process transactions to add running balance and group them
    const groupedTransactions = React.useMemo(() => {
        if (!transactions || !selectedAccount) return [];

        const currentLedger = ledgers.find(l => l.id == selectedAccount);
        const groupType = currentLedger?.groupType;
        const openingBalance = parseFloat(currentLedger?.openingBalance || 0);

        // Filter transactions if checkboxes are checked
        let filteredTxns = [...transactions];
        if (hideInvoice) {
            filteredTxns = filteredTxns.filter(t => {
                const type = (t.voucherType || '').toUpperCase();
                const isInvoice = type === 'INVOICE' || type === 'POS_INVOICE' || type === 'POS INVOICE' || type === 'SALES_INVOICE' || type === 'BILL' || type === 'PURCHASE_BILL';
                return !isInvoice;
            });
        }
        if (hideReceipt) {
            filteredTxns = filteredTxns.filter(t => {
                const type = (t.voucherType || '').toUpperCase();
                const isReceipt = type === 'RECEIPT' || type === 'PAYMENT';
                return !isReceipt;
            });
        }

        // 1. Sort all transactions by date
        const sorted = filteredTxns.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Calculate individual details and running balance
        let runningBalance = (groupType === 'ASSETS' || groupType === 'EXPENSES')
            ? openingBalance
            : -openingBalance;

        const withDetails = sorted.map(txn => {
            const isDebit = txn.debitLedgerId === parseInt(selectedAccount);
            const isCredit = txn.creditLedgerId === parseInt(selectedAccount);

            const debit = isDebit ? txn.amount : 0;
            const credit = isCredit ? txn.amount : 0;
            runningBalance = runningBalance + debit - credit;

            let partyName = '-';
            let partyNameArabic = '';
            if (txn.invoice?.customer) {
                partyName = txn.invoice.customer.name;
                partyNameArabic = txn.invoice.customer.nameArabic || '';
            }
            else if (txn.purchaseBill?.vendor) {
                partyName = txn.purchaseBill.vendor.name;
                partyNameArabic = txn.purchaseBill.vendor.nameArabic || '';
            }
            else if (txn.receipt?.customer) {
                partyName = txn.receipt.customer.name;
                partyNameArabic = txn.receipt.customer.nameArabic || '';
            }
            else if (txn.payment?.vendor) {
                partyName = txn.payment.vendor.name;
                partyNameArabic = txn.payment.vendor.nameArabic || '';
            }
            else {
                if (isDebit) {
                    partyName = txn.creditLedger?.name || txn.creditAccount?.name || txn.toAccount?.name || txn.creditLedgerName || '-';
                }
                if (isCredit) {
                    partyName = txn.debitLedger?.name || txn.debitAccount?.name || txn.fromAccount?.name || txn.debitLedgerName || '-';
                }
            }

            let typeLabel = txn.voucherType?.toUpperCase() || 'JOURNAL';
            let refNo = txn.voucherNumber;
            if (txn.invoice) {
                typeLabel = 'INVOICE';
                refNo = txn.invoice.invoiceNumber;
            } else if (txn.purchaseBill) {
                typeLabel = 'BILL';
                refNo = txn.purchaseBill.billNumber;
            } else if (txn.receipt) {
                typeLabel = 'RECEIPT';
                refNo = txn.receipt.receiptNumber;
            } else if (txn.payment) {
                typeLabel = 'PAYMENT';
                refNo = txn.payment.paymentNumber;
            } else if (txn.posInvoice) {
                if (txn.voucherType === 'RECEIPT') {
                    typeLabel = 'RECEIPT';
                } else {
                    typeLabel = 'POS_INVOICE';
                }
                refNo = txn.posInvoice.invoiceNumber;
            } else if (txn.journalEntry) {
                typeLabel = 'JOURNAL';
                refNo = txn.journalEntry.voucherNumber || txn.voucherNumber;
            } else if (txn.voucherType === 'CONTRA') {
                typeLabel = 'CONTRA';
            } else if (txn.voucherType === 'JOURNAL') {
                typeLabel = 'JOURNAL';
            }

            const dateStr = new Date(txn.date).toISOString().split('T')[0];
            const groupKey = `${typeLabel}-${refNo}-${dateStr}`;

            return {
                ...txn,
                debit,
                credit,
                balance: runningBalance,
                partyName,
                partyNameArabic,
                typeLabel,
                refNo,
                groupKey,
                dateStr
            };
        });

        // 3. Filter by Date Range and calculate Opening for the period
        const start = dateRange.startDate ? new Date(dateRange.startDate) : null;
        const end = dateRange.endDate ? new Date(dateRange.endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const transactionsBeforePeriod = withDetails.filter(txn => start && new Date(txn.date) < start);
        const openingForPeriod = transactionsBeforePeriod.length > 0
            ? transactionsBeforePeriod[transactionsBeforePeriod.length - 1].balance
            : ((groupType === 'ASSETS' || groupType === 'EXPENSES') ? openingBalance : -openingBalance);

        let filtered = withDetails.filter(txn => {
            const txnDate = new Date(txn.date);
            if (start && txnDate < start) return false;
            if (end && txnDate > end) return false;
            return true;
        });

        // Apply Transaction Type Filter
        if (filterType !== 'ALL') {
            filtered = filtered.filter(txn => txn.typeLabel === filterType);
        }

        // 4. Group consecutive transactions and add Opening Balance Row
        const groups = [];

        // Add Opening Balance Row (only if not filtering by type, or if type is ALL)
        if (filterType === 'ALL') {
            groups.push({
                groupKey: 'OPENING',
                items: [],
                totalDebit: openingForPeriod >= 0 ? Math.abs(openingForPeriod) : 0,
                totalCredit: openingForPeriod < 0 ? Math.abs(openingForPeriod) : 0,
                typeLabel: 'Opening Balance',
                refNo: '-',
                date: dateRange.startDate || (sorted.length > 0 ? sorted[0].date : ''),
                lastBalance: openingForPeriod,
                partyName: 'Opening Balance'
            });
        }

        filtered.forEach(txn => {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.groupKey === txn.groupKey && lastGroup.groupKey !== 'OPENING') {
                lastGroup.items.push(txn);
                lastGroup.totalDebit += txn.debit;
                lastGroup.totalCredit += txn.credit;
                lastGroup.lastBalance = txn.balance;
            } else {
                groups.push({
                    groupKey: txn.groupKey,
                    items: [txn],
                    totalDebit: txn.debit,
                    totalCredit: txn.credit,
                    typeLabel: txn.typeLabel,
                    refNo: txn.refNo,
                    date: txn.dateStr,
                    lastBalance: txn.balance,
                    partyName: txn.partyName,
                    partyNameArabic: txn.partyNameArabic || ''
                });
            }
        });

        return groups;
    }, [transactions, selectedAccount, dateRange, ledgers, filterType, hideInvoice, hideReceipt, enableColors]);

    const currentLedgerName = ledgers.find(l => l.id == selectedAccount)?.name || '';

    const getTransactionColor = (item) => {
        if (!item) return null;
        if (item.typeLabel === 'Opening Balance') return null;

        // Check manualStatus: "manual paid blue"
        const isManual = item.invoice?.manualStatus ||
            item.purchaseBill?.manualStatus ||
            item.receipt?.manualStatus ||
            item.payment?.manualStatus ||
            item.posInvoice?.manualStatus;

        if (isManual) {
            return {
                background: '#dbeafe', // blue-100
                color: '#1e40af'       // blue-800
            };
        }

        // Check Transaction Type: "paid by receipt green"
        const isReceiptOrPayment = ['RECEIPT', 'PAYMENT'].includes(item.typeLabel);
        if (isReceiptOrPayment) {
            return {
                background: '#dcfce7', // green-100
                color: '#166534'       // green-800
            };
        }

        // Invoice/Bill Status checks
        const linkedDoc = item.invoice || item.purchaseBill || item.posInvoice;
        if (linkedDoc) {
            const status = (linkedDoc.status || '').toUpperCase();
            if (status === 'PAID' || status === 'COMPLETED' || status === 'FULLY PAID') {
                return {
                    background: '#dcfce7', // green-100
                    color: '#166534'       // green-800
                };
            }
            if (status === 'PARTIAL' || status === 'PARTIALLY PAID') {
                return {
                    background: '#fef9c3', // yellow-100
                    color: '#854d0e'       // yellow-800
                };
            }
            if (status === 'UNPAID' || status === 'PENDING' || status === 'OVERDUE') {
                return {
                    background: '#fee2e2', // red-100
                    color: '#991b1b'       // red-800
                };
            }
        }

        return null;
    };

    return (
        <div className="Ledger-report-page">
            <div className="Ledger-page-header">
                <div>
                    <h1 className="Ledger-page-title">Ledger Summary</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="Ledger-btn-download" onClick={handleDownloadExcel} title="Download Excel" style={{ backgroundColor: '#4ade80' }}>
                        <Download size={18} />
                    </button>
                    <button className="Ledger-btn-download" onClick={handleDownloadPDF} title="Download PDF" style={{ backgroundColor: '#ef4444' }}>
                        <FileText size={18} />
                    </button>
                    <button className="Ledger-btn-download" onClick={handlePrint} title="Print Report" style={{ backgroundColor: '#3b82f6' }}>
                        <Printer size={18} />
                    </button>
                </div>
            </div>

            {/* Filter Card */}
            <div className="Ledger-filter-card">
                <div className="Ledger-filter-group">
                    <label>Start Date</label>
                    <input
                        type="date"
                        className="Ledger-form-input"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                </div>
                <div className="Ledger-filter-group">
                    <label>End Date</label>
                    <input
                        type="date"
                        className="Ledger-form-input"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                </div>
                <div className="Ledger-filter-group" style={{ flexGrow: 1 }}>
                    <label>Account</label>
                    <div className="Ledger-select-wrapper">
                        <select
                            className="Ledger-form-select"
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                        >
                            <option value="">Select Account</option>
                            {ledgers.map(ledger => (
                                <option key={ledger.id} value={ledger.id}>{ledger.name} - {ledger.groupName}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="Ledger-filter-group" style={{ flexGrow: 1 }}>
                    <label>Transaction Type</label>
                    <div className="Ledger-select-wrapper">
                        <select
                            className="Ledger-form-select"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="ALL">All Types</option>
                            <option value="INVOICE">Sales Invoice</option>
                            <option value="RECEIPT">Receipt</option>
                            <option value="PAYMENT">Payment</option>
                            <option value="BILL">Purchase Bill</option>
                            <option value="POS_INVOICE">POS Invoice</option>
                            <option value="SALES_RETURN">Sales Return</option>
                            <option value="PURCHASE_RETURN">Purchase Return</option>
                            <option value="JOURNAL">Journal Entry</option>
                            <option value="EXPENSE">Expense</option>
                            <option value="INCOME">Income</option>
                            <option value="CONTRA">Contra</option>
                        </select>
                    </div>
                </div>
                <div className="Ledger-filter-group" style={{ justifyContent: 'center', minWidth: '130px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', height: '100%', marginTop: 'auto', marginBottom: '8px', fontWeight: '500', color: '#64748b', fontSize: '0.85rem' }}>
                        <input
                            type="checkbox"
                            checked={hideInvoice}
                            onChange={(e) => setHideInvoice(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#8ce043', cursor: 'pointer' }}
                        />
                        <span>Hide Invoice/Bill</span>
                    </label>
                </div>
                <div className="Ledger-filter-group" style={{ justifyContent: 'center', minWidth: '140px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', height: '100%', marginTop: 'auto', marginBottom: '8px', fontWeight: '500', color: '#64748b', fontSize: '0.85rem' }}>
                        <input
                            type="checkbox"
                            checked={hideReceipt}
                            onChange={(e) => setHideReceipt(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#8ce043', cursor: 'pointer' }}
                        />
                        <span>Hide Receipt/Payment</span>
                    </label>
                </div>
                <div className="Ledger-filter-group" style={{ justifyContent: 'center', minWidth: '150px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', height: '100%', marginTop: 'auto', marginBottom: '8px', fontWeight: '500', color: '#64748b', fontSize: '0.85rem' }}>
                        <input
                            type="checkbox"
                            checked={enableColors}
                            onChange={(e) => setEnableColors(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#8ce043', cursor: 'pointer' }}
                        />
                        <span>Color Transactions</span>
                    </label>
                </div>
                <div className="Ledger-filter-actions">
                    <button className="Ledger-btn-search" onClick={handleSearch} title="Search">
                        <Search size={20} />
                    </button>
                    <button className="Ledger-btn-reset" onClick={handleReset} title="Reset">
                        <RotateCcw size={20} />
                    </button>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="Ledger-table-card">
                <table className="Ledger-table">
                    <thead>
                        <tr>
                            <th>ACCOUNT NAME</th>
                            <th>TRANSACTION TYPE</th>
                            <th>TRANSACTION DATE</th>
                            <th className="text-right">DEBIT</th>
                            <th className="text-right">CREDIT</th>
                            <th className="text-right">BALANCE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center p-4">Loading transactions...</td></tr>
                        ) : groupedTransactions.length > 0 ? (
                            groupedTransactions.map((group, index) => (
                                <React.Fragment key={group.groupKey}>
                                    <tr
                                        className={group.items.length > 1 ? 'Ledger-grouped-row' : ''}
                                        style={enableColors ? (() => {
                                            const colorStyle = getTransactionColor(group.items && group.items[0]);
                                            return colorStyle ? { backgroundColor: colorStyle.background } : null;
                                        })() : null}
                                    >
                                        <td className="font-medium">{currentLedgerName}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {enableColors ? (
                                                        (() => {
                                                            const colorStyle = getTransactionColor(group.items && group.items[0]);
                                                            return (
                                                                <span
                                                                    style={{
                                                                        color: colorStyle ? colorStyle.color : 'inherit',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: '700',
                                                                        display: 'inline-block',
                                                                        textTransform: 'uppercase'
                                                                    }}
                                                                >
                                                                    {formatVoucherType(group.typeLabel)}
                                                                </span>
                                                            );
                                                        })()
                                                    ) : (
                                                        <span style={{ fontWeight: 500 }}>{formatVoucherType(group.typeLabel)}</span>
                                                    )}
                                                    {group.items.length > 1 && (
                                                        <button
                                                            onClick={() => toggleGroup(group.groupKey)}
                                                            className="Ledger-expand-btn"
                                                            style={{
                                                                background: 'none', border: 'none', color: '#8ce311',
                                                                cursor: 'pointer', fontSize: '0.7rem', padding: 0,
                                                                textDecoration: 'underline font-bold'
                                                            }}
                                                        >
                                                            {expandedGroups[group.groupKey] ? 'Hide Sub-Transactions' : `Show Sub-Transactions (${group.items.length})`}
                                                        </button>
                                                    )}
                                                </div>
                                                <span
                                                    style={group.refNo && group.refNo !== '-' ? { fontSize: '0.75rem', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' } : { fontSize: '0.75rem', color: '#64748b' }}
                                                    onClick={() => {
                                                        if (group.refNo && group.refNo !== '-' && group.items && group.items[0]) {
                                                            handleVoucherRedirect(group.typeLabel, group.items[0]);
                                                        }
                                                    }}
                                                >
                                                    #{group.refNo || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>{group.date ? new Date(group.date).toLocaleDateString() : '-'}</td>
                                        <td className="text-right">{group.totalDebit > 0 ? formatCurrency(group.totalDebit) : '-'}</td>
                                        <td className="text-right">{group.totalCredit > 0 ? formatCurrency(group.totalCredit) : '-'}</td>
                                        <td className="text-right font-medium">
                                            {formatCurrency(Math.abs(group.lastBalance))} {group.lastBalance >= 0 ? 'Dr' : 'Cr'}
                                        </td>
                                    </tr>
                                    {expandedGroups[group.groupKey] && group.items.length > 1 && group.items.map((item, i) => {
                                        const colorStyle = enableColors ? getTransactionColor(item) : null;
                                        return (
                                            <tr
                                                key={`${group.groupKey}-sub-${i}`}
                                                className="Ledger-sub-row"
                                                style={{
                                                    backgroundColor: colorStyle ? colorStyle.background : '#f8fafc',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                <td style={{ paddingLeft: '2rem', color: '#64748b' }}>
                                                    ↳ {item.partyName !== '-' ? item.partyName : (item.creditLedger?.name || item.debitLedger?.name || item.typeLabel || '-')}
                                                </td>
                                                <td style={{ color: '#64748b' }}>
                                                    {enableColors ? (
                                                        (() => {
                                                            const cStyle = getTransactionColor(item);
                                                            return (
                                                                <span
                                                                    style={{
                                                                        color: cStyle ? cStyle.color : 'inherit',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: '700',
                                                                        display: 'inline-block',
                                                                        textTransform: 'uppercase'
                                                                    }}
                                                                >
                                                                    {formatVoucherType(item.voucherType || group.typeLabel)}
                                                                </span>
                                                            );
                                                        })()
                                                    ) : (
                                                        <span style={{ fontWeight: 500 }}>{formatVoucherType(item.voucherType || group.typeLabel)}</span>
                                                    )}
                                                    <br />
                                                    <span
                                                        style={(item.refNo || group.refNo) && (item.refNo !== '-' || group.refNo !== '-') ? { fontSize: '0.7rem', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' } : { fontSize: '0.7rem', color: '#94a3b8' }}
                                                        onClick={() => {
                                                            const rNo = item.refNo || group.refNo;
                                                            if (rNo && rNo !== '-') {
                                                                handleVoucherRedirect(item.voucherType || group.typeLabel, item);
                                                            }
                                                        }}
                                                    >
                                                        #{item.refNo || group.refNo || '-'}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#64748b' }}>{item.dateStr ? new Date(item.dateStr).toLocaleDateString() : new Date(item.date).toLocaleDateString()}</td>
                                                <td className="text-right">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</td>
                                                <td className="text-right">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</td>
                                                <td className="text-right" style={{ color: '#94a3b8' }}>
                                                    {formatCurrency(Math.abs(item.balance))} {item.balance >= 0 ? 'Dr' : 'Cr'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))
                        ) : (
                            <tr><td colSpan="6" className="text-center p-4">No transactions found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LedgerReport;
