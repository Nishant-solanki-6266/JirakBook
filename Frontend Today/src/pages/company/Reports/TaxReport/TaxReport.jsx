import React, { useState, useEffect } from 'react';
import { Download, Search, Settings } from 'lucide-react';
import './TaxReport.css';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { useContext } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TaxReport = () => {
    const { formatCurrency, fetchCompanySettings } = useContext(CompanyContext);
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState(null);
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const [showExportOptions, setShowExportOptions] = useState(false);

    useEffect(() => {
        fetchCompanySettings();
        fetchTaxReport();
    }, [year]);

    const fetchTaxReport = async () => {
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const response = await axiosInstance.get(`/reports/tax?companyId=${companyId}&year=${year}`);
                if (response.data.success) {
                    setData(response.data.data);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const incomeTaxes = [
        { name: 'CGST', values: data?.income?.CGST || Array(12).fill(0) },
        { name: 'SGST', values: data?.income?.SGST || Array(12).fill(0) },
        { name: 'IGST', values: data?.income?.IGST || Array(12).fill(0) },
    ];

    const expenseTaxes = [
        { name: 'CGST', values: data?.expense?.CGST || Array(12).fill(0) },
        { name: 'SGST', values: data?.expense?.SGST || Array(12).fill(0) },
        { name: 'IGST', values: data?.expense?.IGST || Array(12).fill(0) },
    ];

    const exportToExcel = () => {
        const worksheetData = [];
        
        // Income Section
        worksheetData.push(['INCOME TAXES']);
        worksheetData.push(['Month', 'CGST', 'SGST', 'IGST']);
        months.forEach((m, i) => {
            worksheetData.push([
                m,
                data?.income?.CGST[i] || 0,
                data?.income?.SGST[i] || 0,
                data?.income?.IGST[i] || 0
            ]);
        });
        
        worksheetData.push([]); // Spacer
        
        // Expense Section
        worksheetData.push(['EXPENSE TAXES']);
        worksheetData.push(['Month', 'CGST', 'SGST', 'IGST']);
        months.forEach((m, i) => {
            worksheetData.push([
                m,
                data?.expense?.CGST[i] || 0,
                data?.expense?.SGST[i] || 0,
                data?.expense?.IGST[i] || 0
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tax Summary");
        XLSX.writeFile(wb, `Tax_Summary_${year}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        doc.setFontSize(18);
        doc.text(`Tax Summary - ${year}`, 14, 20);
        
        // Income Table
        doc.setFontSize(14);
        doc.text('Income Taxes', 14, 30);
        const incomeRows = months.map((m, i) => [
            m,
            formatCurrency(data?.income?.CGST[i] || 0),
            formatCurrency(data?.income?.SGST[i] || 0),
            formatCurrency(data?.income?.IGST[i] || 0)
        ]);

        autoTable(doc, {
            head: [['Month', 'CGST', 'SGST', 'IGST']],
            body: incomeRows,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [46, 204, 113] }
        });

        // Expense Table
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.text('Expense Taxes', 14, finalY);
        const expenseRows = months.map((m, i) => [
            m,
            formatCurrency(data?.expense?.CGST[i] || 0),
            formatCurrency(data?.expense?.SGST[i] || 0),
            formatCurrency(data?.expense?.IGST[i] || 0)
        ]);

        autoTable(doc, {
            head: [['Month', 'CGST', 'SGST', 'IGST']],
            body: expenseRows,
            startY: finalY + 5,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [231, 76, 60] }
        });

        doc.save(`Tax_Summary_${year}.pdf`);
    };

    return (
        <div className="tax-report-page">
            {/* Header Section */}
            <div className="report-header">
                <div>
                    <h1 className="page-title">Tax Summary</h1>
                </div>
                <div className="export-dropdown-wrapper">
                    <button className="btn-download-green" onClick={() => setShowExportOptions(!showExportOptions)}>
                        <Download size={18} />
                    </button>
                    {showExportOptions && (
                        <div className="export-menu">
                            <button onClick={() => { exportToExcel(); setShowExportOptions(false); }}>Excel File (.xlsx)</button>
                            <button onClick={() => { exportToPDF(); setShowExportOptions(false); }}>PDF Document (.pdf)</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar card">
                <div className="filter-right">
                    <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
                        <option value={2026}>2026</option>
                        <option value={2025}>2025</option>
                        <option value={2024}>2024</option>
                    </select>
                    <button className="btn-icon-square green"><Search size={18} /></button>
                </div>
            </div>

            {/* Info Cards */}
            <div className="info-cards-row">
                <div className="info-card card">
                    <label>Report :</label>
                    <h3>Tax Summary</h3>
                </div>
                <div className="info-card card">
                    <label>Duration :</label>
                    <h3>Jan-{year} to Dec-{year}</h3>
                </div>
            </div>

            {/* Income Section */}
            <div className="section-card card">
                <h3 className="section-title">Income</h3>
                <div className="table-responsive">
                    <table className="tax-table">
                        <thead>
                            <tr>
                                <th>TAX</th>
                                {months.map(m => <th key={m}>{m.toUpperCase().substr(0, 3)}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {incomeTaxes.map((tax, idx) => (
                                <tr key={idx}>
                                    <td className="tax-name">{tax.name}</td>
                                    {tax.values.map((val, vIdx) => (
                                        <td key={vIdx}>
                                            {formatCurrency(val)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Expense Section */}
            <div className="section-card card mt-6">
                <h3 className="section-title">Expense</h3>
                <div className="table-responsive">
                    <table className="tax-table">
                        <thead>
                            <tr>
                                <th>TAX</th>
                                {months.map(m => <th key={m}>{m.toUpperCase().substr(0, 3)}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {expenseTaxes.map((tax, idx) => (
                                <tr key={idx}>
                                    <td className="tax-name">{tax.name}</td>
                                    {tax.values.map((val, vIdx) => (
                                        <td key={vIdx}>
                                            {formatCurrency(val)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TaxReport;
