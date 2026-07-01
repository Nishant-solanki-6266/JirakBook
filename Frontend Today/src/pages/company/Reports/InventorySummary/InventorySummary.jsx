import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Filter, Download,
    Eye, X, MapPin, Package, AlertCircle
} from 'lucide-react';
import './InventorySummary.css';
import axiosInstance from '../../../../api/axiosInstance';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { useContext } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import warehouseService from '../../../../api/warehouseService';

const InventorySummary = () => {
    const { formatCurrency, fetchCompanySettings } = useContext(CompanyContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [inventoryData, setInventoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [sortBy, setSortBy] = useState('productName'); // productName, closing
    const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
    const [showFinishedOnly, setShowFinishedOnly] = useState(false); // Finished stock = Out of Stock
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('ALL');

    useEffect(() => {
        fetchCompanySettings();
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await warehouseService.getWarehouses(companyId);
                if (res.data?.success) {
                    setWarehouses(res.data.data || []);
                } else if (res.success) {
                    setWarehouses(res.data || []);
                }
            }
        } catch (error) {
            console.error("Error fetching warehouses:", error);
        }
    };

    useEffect(() => {
        fetchInventorySummary();
    }, [startDate, endDate]);

    const fetchInventorySummary = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const response = await axiosInstance.get(`/reports/inventory-summary`, {
                    params: { companyId, startDate, endDate }
                });
                if (response.data.success) {
                    setInventoryData(response.data.data);
                }
            }
        } catch (error) {
            console.error("Error fetching inventory summary:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleView = (item) => {
        setSelectedItem(item);
        setShowViewModal(true);
    };

    const exportToExcel = () => {
        const worksheetData = filteredData.map(row => ({
            'Product': row.productName,
            'SKU': row.sku,
            'Warehouse': row.warehouse,
            'Opening': row.opening,
            'Inward': row.inward,
            'Outward': row.outward,
            'Closing': row.closing,
            'Price': row.price,
            'Total Value': row.totalValue,
            'Status': row.status
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory Summary");
        XLSX.writeFile(wb, `Inventory_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
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
            return { content: text, styles: { font: 'Amiri', fontSize: 7 } };
        };

        doc.setFontSize(18);
        doc.text('Inventory Summary Report', 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
        if (startDate || endDate) {
            doc.text(`Period: ${startDate || 'Start'} to ${endDate || 'End'}`, 14, 28);
        }

        const tableColumn = ["Product", "SKU", "Warehouse", "Opening", "Inward", "Outward", "Closing", "Price", "Value", "Status"];
        const tableRows = filteredData.map(row => {
            const productText = row.productNameArabic
                ? `${row.productName}\n${row.productNameArabic}`
                : row.productName;

            const warehouseText = row.warehouseArabic
                ? `${row.warehouse}\n${row.warehouseArabic}`
                : row.warehouse;

            return [
                makeCell(productText),
                row.sku,
                makeCell(warehouseText),
                row.opening,
                row.inward,
                row.outward,
                row.closing,
                formatCurrency(row.price),
                formatCurrency(row.totalValue),
                row.status
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 7 },
            headStyles: { fillColor: [44, 62, 80] },
            didParseCell: (data) => {
                if (!arabicFontLoaded && data.cell.styles.font === 'Amiri') {
                    data.cell.styles.font = 'helvetica';
                }
            }
        });

        doc.save(`Inventory_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'In Stock': return 'status-success';
            case 'Low Stock': return 'status-warning';
            case 'Out of Stock': return 'status-danger';
            default: return 'status-neutral';
        }
    };

    const processedData = useMemo(() => {
        if (selectedWarehouseId === 'ALL') {
            const grouped = {};
            inventoryData.forEach(item => {
                const key = item.productId;
                if (!grouped[key]) {
                    grouped[key] = {
                        productId: item.productId,
                        productName: item.productName,
                        sku: item.sku,
                        price: item.price,
                        opening: 0,
                        inward: 0,
                        outward: 0,
                        closing: 0,
                        totalValue: 0,
                        warehousesList: [],
                        status: 'In Stock'
                    };
                }
                grouped[key].opening += item.opening || 0;
                grouped[key].inward += item.inward || 0;
                grouped[key].outward += item.outward || 0;
                grouped[key].closing += item.closing || 0;
                grouped[key].totalValue += item.totalValue || 0;
                if (item.warehouse && !grouped[key].warehousesList.includes(item.warehouse)) {
                    grouped[key].warehousesList.push(item.warehouse);
                }
            });

            return Object.values(grouped).map(item => {
                let status = 'In Stock';
                if (item.closing <= 0) status = 'Out of Stock';
                else if (item.closing < 10) status = 'Low Stock';

                return {
                    ...item,
                    warehouse: item.warehousesList.join(', ') || 'All Warehouses',
                    status
                };
            });
        } else {
            const targetWarehouse = warehouses.find(w => w.id === parseInt(selectedWarehouseId));
            return inventoryData.filter(item => {
                return targetWarehouse ? item.warehouse === targetWarehouse.name : false;
            });
        }
    }, [inventoryData, selectedWarehouseId, warehouses]);

    const filteredData = processedData
        .filter(item => {
            const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.sku.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFinished = showFinishedOnly ? item.closing <= 0 : true;
            return matchesSearch && matchesFinished;
        })
        .sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

    const selectedItemBreakdown = useMemo(() => {
        if (!selectedItem) return [];
        return inventoryData.filter(item => item.productId === selectedItem.productId);
    }, [selectedItem, inventoryData]);

    return (
        <div className="inventory-summary-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Inventory Summary</h1>
                    <p className="page-subtitle">Track stock movements and current status</p>
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
                        <div className="filter-item">
                            <label>Warehouse:</label>
                            <select value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)}>
                                <option value="ALL">All Warehouses</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        {(startDate || endDate || selectedWarehouseId !== 'ALL') && (
                            <button className="btn-clear-filters" onClick={() => { setStartDate(''); setEndDate(''); setSelectedWarehouseId('ALL'); }}>Clear</button>
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

            <div className="report-table-card">
                {/* Controls */}
                <div className="table-controls">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by Product or SKU..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="report-secondary-filters">
                        <div className="filter-group">
                            <label><Filter size={14} /> Sort By:</label>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                <option value="productName">Product Name</option>
                                <option value="closing">Quantity (Closing)</option>
                            </select>
                            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                                <option value="asc">Ascending</option>
                                <option value="desc">Descending</option>
                            </select>
                        </div>
                        <div className="filter-group checkbox-filter">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={showFinishedOnly}
                                    onChange={(e) => setShowFinishedOnly(e.target.checked)}
                                />
                                <span>Finished Stock Only (Zero Qty)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading inventory data...</div>
                    ) : filteredData.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No inventory records found.</div>
                    ) : (
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product</th>
                                    <th>SKU</th>
                                    <th>Warehouse</th>
                                    <th className="text-center">Opening</th>
                                    <th className="text-center">Inward</th>
                                    <th className="text-center">Outward</th>
                                    <th className="text-center">Closing</th>
                                    <th className="text-right">Price (₹)</th>
                                    <th className="text-right">Total Value (₹)</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((row, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td className="font-medium">{row.productName}</td>
                                        <td className="font-mono text-sm">{row.sku}</td>
                                        <td>{row.warehouse}</td>
                                        <td className="text-center text-gray-500">{row.opening}</td>
                                        <td className="text-center text-green-600">+{row.inward}</td>
                                        <td className="text-center text-red-500">-{row.outward}</td>
                                        <td className="text-center font-bold">{row.closing}</td>
                                        <td className="text-right">{formatCurrency(row.price)}</td>
                                        <td className="text-right font-bold">{formatCurrency(row.totalValue)}</td>
                                        <td>
                                            <span className={`status-pill ${getStatusClass(row.status)}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <button
                                                className="btn-icon-view"
                                                title="View Details"
                                                onClick={() => handleView(row)}
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* View Modal */}
            {showViewModal && selectedItem && (
                <div className="inventory-view-modal-overlay" onClick={() => setShowViewModal(false)}>
                    <div className="inventory-view-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="inventory-view-modal-header">
                            <div className="inventory-view-modal-title">
                                <Package size={20} />
                                <h2>Inventory Details</h2>
                            </div>
                            <button className="inventory-view-modal-close-icon" onClick={() => setShowViewModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="inventory-view-modal-body">
                            <div className="inventory-view-modal-hero">
                                <div className="inventory-view-modal-hero-left">
                                    <div className="inventory-view-modal-icon-box">
                                        <Package size={28} />
                                    </div>
                                    <div className="inventory-view-modal-hero-text">
                                        <h3>{selectedItem.productName}</h3>
                                        <span className="inventory-view-modal-sku">{selectedItem.sku}</span>
                                    </div>
                                </div>
                                <div className="inventory-view-modal-status">
                                    <span className={`inventory-view-modal-pill ${getStatusClass(selectedItem.status)}`}>
                                        {selectedItem.status}
                                    </span>
                                </div>
                            </div>

                            <div className="inventory-view-modal-info-grid">
                                <div className="inventory-view-modal-info-card">
                                    <label>Warehouse</label>
                                    <div className="inventory-view-modal-val">
                                        <MapPin size={14} /> {selectedItem.warehouse}
                                    </div>
                                </div>
                                <div className="inventory-view-modal-info-card">
                                    <label>Unit Price</label>
                                    <div className="inventory-view-modal-val">
                                        {formatCurrency(selectedItem.price)}
                                    </div>
                                </div>
                                <div className="inventory-view-modal-info-card">
                                    <label>Total Value</label>
                                    <div className="inventory-view-modal-val inventory-view-modal-highlight">
                                        {formatCurrency(selectedItem.totalValue)}
                                    </div>
                                </div>
                            </div>

                            <div className="inventory-view-modal-movement-box">
                                <h4 className="inventory-view-modal-section-title">Stock Movement Analysis</h4>
                                <div className="inventory-view-modal-stats-row">
                                    <div className="inventory-view-modal-stat-item">
                                        <span className="inventory-view-modal-stat-label">Opening</span>
                                        <span className="inventory-view-modal-stat-val">{selectedItem.opening}</span>
                                    </div>
                                    <div className="inventory-view-modal-stat-item inventory-view-modal-inward">
                                        <span className="inventory-view-modal-stat-label">Inward</span>
                                        <span className="inventory-view-modal-stat-val">+{selectedItem.inward}</span>
                                    </div>
                                    <div className="inventory-view-modal-stat-item inventory-view-modal-outward">
                                        <span className="inventory-view-modal-stat-label">Outward</span>
                                        <span className="inventory-view-modal-stat-val">-{selectedItem.outward}</span>
                                    </div>
                                    <div className="inventory-view-modal-stat-item inventory-view-modal-closing">
                                        <span className="inventory-view-modal-stat-label">Closing</span>
                                        <span className="inventory-view-modal-stat-val">{selectedItem.closing}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedWarehouseId === 'ALL' && selectedItemBreakdown.length > 0 && (
                                <div className="inventory-view-modal-movement-box" style={{ marginTop: '20px' }}>
                                    <h4 className="inventory-view-modal-section-title">Warehouse Stock Breakdown</h4>
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '10px' }}>
                                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, borderBottom: '1px solid #e2e8f0' }}>
                                                <tr>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#64748b' }}>Warehouse</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#64748b' }}>Opening</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#64748b' }}>Inward</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#64748b' }}>Outward</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#64748b' }}>Closing</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedItemBreakdown.map((breakdown, idx) => (
                                                    <tr key={idx} style={{ borderBottom: idx < selectedItemBreakdown.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                        <td style={{ padding: '8px 12px', fontWeight: '500', color: '#1e293b' }}>{breakdown.warehouse}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{breakdown.opening}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#16a34a' }}>+{breakdown.inward}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444' }}>-{breakdown.outward}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold', color: '#0f172a' }}>{breakdown.closing}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventorySummary;
