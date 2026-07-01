import React, { createContext, useState, useEffect, useContext } from 'react';
import companyService from '../api/companyService';
import GetCompanyId from '../api/GetCompanyId';
import { AuthContext } from './AuthContext';

export const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
    const { currentUser } = useContext(AuthContext);
    const [companySettings, setCompanySettings] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchCompanySettings = async () => {
        const companyId = GetCompanyId();
        if (companyId) {
            try {
                const res = await companyService.getById(companyId);
                setCompanySettings(res.data);
            } catch (error) {
                console.error("Error fetching company settings:", error);
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchCompanySettings();
        } else {
            setCompanySettings(null);
            setLoading(false);
        }
    }, [currentUser]);

    const formatCurrency = (amount) => {
        const currencyCode = companySettings?.currency || 'USD';

        // Dynamic locale mapping to ensure proper thousand/lakh separators
        // Most currencies can use 'en-US' formatting with their specific symbol,
        // but some like INR have unique grouping rules.
        const localeMap = {
            'INR': 'en-IN',
            'AED': 'ar-AE',
            'SAR': 'ar-SA',
            'EUR': 'de-DE',
            'GBP': 'en-GB',
            'JPY': 'ja-JP',
            'CNY': 'zh-CN',
            'RUB': 'ru-RU',
            'BRL': 'pt-BR',
            'CAD': 'en-CA',
            'AUD': 'en-AU',
            'PKR': 'en-PK',
            'BDT': 'en-BD'
        };

        const locale = localeMap[currencyCode] || 'en-US';

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount || 0);
        } catch (e) {
            // Ultimate fallback for very rare or unsupported currency codes
            return `${currencyCode} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    };

    const DEFAULT_LABELS = {
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

    const getInvoiceLabel = (key) => {
        if (companySettings?.invoiceLabels) {
            try {
                const labels = typeof companySettings.invoiceLabels === 'string'
                    ? JSON.parse(companySettings.invoiceLabels)
                    : companySettings.invoiceLabels;
                if (labels[key] !== undefined) {
                    return labels[key];
                }
            } catch (e) {
                // fall through to default
            }
        }
        return DEFAULT_LABELS[key] !== undefined ? DEFAULT_LABELS[key] : key;
    };

    const DEFAULT_HEADERS = {
        item: 'Item',
        quantity: 'Quantity',
        rate: 'Rate',
        discount: 'Discount',
        tax: 'Tax (%)',
        price: 'Price',
        warehouse: 'Warehouse',
        uom: 'UOM'
    };

    const getTableHeader = (key, defaultVal) => {
        if (companySettings?.invoiceTableHeaders) {
            try {
                const headers = typeof companySettings.invoiceTableHeaders === 'string'
                    ? JSON.parse(companySettings.invoiceTableHeaders)
                    : companySettings.invoiceTableHeaders;
                return headers[key] !== undefined ? headers[key] : (defaultVal || DEFAULT_HEADERS[key] || key);
            } catch (e) {
                // fall through to default
            }
        }
        return defaultVal || DEFAULT_HEADERS[key] || key;
    };

    const getReceiptPaymentLabel = (key, defaultVal = '') => {
        if (companySettings?.receiptLabels) {
            try {
                const labels = typeof companySettings.receiptLabels === 'string'
                    ? JSON.parse(companySettings.receiptLabels)
                    : companySettings.receiptLabels;
                return labels[key] || defaultVal || key;
            } catch (e) {}
        }
        return defaultVal || key;
    };
    const getReceiptPaymentHeader = (key, defaultVal = '') => {
        if (companySettings?.receiptTableHeaders) {
            try {
                const headers = typeof companySettings.receiptTableHeaders === 'string'
                    ? JSON.parse(companySettings.receiptTableHeaders)
                    : companySettings.receiptTableHeaders;
                return headers[key] || defaultVal || key;
            } catch (e) {}
        }
        return defaultVal || key;
    };

    const DEFAULT_DOCUMENT_TITLES = {
        invoice: 'INVOICE',
        receipt: 'RECEIPT',
        payment: 'PAYMENT VOUCHER',
        salesreturn: 'SALES RETURN',
        purchasebill: 'PURCHASE BILL',
        purchasepayment: 'PAYMENT',
        purchasereturn: 'PURCHASE RETURN',
        salesorder: 'SALES ORDER',
        quotation: 'QUOTATION',
        purchasequotation: 'PURCHASE QUOTATION',
        purchaseorder: 'PURCHASE ORDER',
        deliverychallan: 'DELIVERY CHALLAN',
        goodsreceipt: 'GOODS RECEIPT NOTE',
        posinvoice: 'INVOICE',
        journalvoucher: 'JOURNAL VOUCHER',
        expense: 'EXPENSE VOUCHER',
        income: 'INCOME VOUCHER',
        contravoucher: 'CONTRA VOUCHER',
        addcapital: 'ADD CAPITAL',
        drawingcapital: 'DRAWING CAPITAL',
    };

    const getDocumentTitle = (transactionType) => {
        if (companySettings?.documentTitles) {
            try {
                const titles = typeof companySettings.documentTitles === 'string'
                    ? JSON.parse(companySettings.documentTitles)
                    : companySettings.documentTitles;
                if (titles && titles[transactionType]) {
                    return titles[transactionType];
                }
            } catch (e) {}
        }
        return DEFAULT_DOCUMENT_TITLES[transactionType] || transactionType.toUpperCase();
    };

    return (
        <CompanyContext.Provider value={{ companySettings, fetchCompanySettings, formatCurrency, getInvoiceLabel, getReceiptPaymentLabel, getReceiptPaymentHeader, getTableHeader, getDocumentTitle, loading }}>
            {children}
        </CompanyContext.Provider>
    );
};