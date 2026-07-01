import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useReactToPrint } from 'react-to-print';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, User, MapPin, Box, Calendar, Eye, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import './GoodsReceipt.css'; // New isolated CSS
import goodsReceiptNoteService from '../../../../services/goodsReceiptNoteService';
import purchaseOrderService from '../../../../services/purchaseOrderService';
import vendorService from '../../../../services/vendorService';
import productService from '../../../../api/productService';
import warehouseService from '../../../../api/warehouseService';
import companyService from '../../../../api/companyService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import { BASE_URL } from '../../../../api/axiosInstance';
import '../../Vendors/Vendors.css';
import '../../Inventory/ProductInventory/Inventory.css';
import '../../Inventory/UOM/UOM.css';
import productServiceFromServices from '../../../../services/productService';
import categoryService from '../../../../services/categoryService';
import uomService from '../../../../services/uomService';
import { uploadToCloudinary } from '../../../../utils/cloudinaryUpload';
import axiosInstance from '../../../../api/axiosInstance';
import { Upload, Loader2 } from 'lucide-react';
import chartOfAccountsService from '../../../../services/chartOfAccountsService';


const GoodsReceipt = () => {
    const { hasPermission } = useContext(AuthContext);
    const { formatCurrency, getTableHeader, getInvoiceLabel, companySettings, getDocumentTitle } = useContext(CompanyContext);
    const location = useLocation();
    const navigate = useNavigate();
    const sourceData = location.state?.sourceData;
    const targetGrnId = location.state?.targetGrnId;

    // --- State Management ---
    const [grns, setGrns] = useState([]);
    const [selectedGrnIds, setSelectedGrnIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customFieldValues, setCustomFieldValues] = useState({});
    const getCustomFieldsForType = (type) => {
        if (!companySettings?.customFieldsConfig) return [];
        try {
            const parsed = typeof companySettings.customFieldsConfig === 'string'
                ? JSON.parse(companySettings.customFieldsConfig)
                : companySettings.customFieldsConfig;
            if (Array.isArray(parsed)) {
                const config = parsed.find(c => c.transactionType === type);
                return config ? (config.fields || []) : [];
            }
        } catch (e) {
            console.error("Error parsing customFieldsConfig:", e);
        }
        return [];
    };
    const [vendors, setVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [pendingOrders, setPendingOrders] = useState([]);

    // Modal & Wizard State
    const [showAddModal, setShowAddModal] = useState(false);

    // Inline Modals States
    const [showAddVendorModal, setShowAddVendorModal] = useState(false);
    const [accountTypes, setAccountTypes] = useState([]);

    useEffect(() => {
        if (showAddVendorModal) {
            const fetchCOA = async () => {
                try {
                    const companyId = GetCompanyId();
                    const res = await chartOfAccountsService.getAccountTypes(companyId);
                    if (res?.success && Array.isArray(res.data)) {
                        setAccountTypes(res.data);
                    } else if (res?.data && Array.isArray(res.data)) {
                        setAccountTypes(res.data);
                    } else if (Array.isArray(res)) {
                        setAccountTypes(res);
                    }
                } catch (e) {
                    console.error("Error fetching account types", e);
                }
            };
            fetchCOA();
        }
    }, [showAddVendorModal]);
    const [vendorFormData, setVendorFormData] = useState({
        name: '', nameArabic: '', companyName: '', companyLocation: '',
        billingName: '', billingPhone: '', billingAddress: '', billingCity: '', billingState: '', billingCountry: '', billingZipCode: '',
        shippingSameAsBilling: true,
        shippingAddresses: [],
        accountType: 'Credit', balanceType: 'Credit', accountBalance: '', creationDate: new Date().toISOString().split('T')[0],
        bankAccountNumber: '', bankIFSC: '', bankNameBranch: '',
        primaryContactName: '', email: '', phone: '', alternativePhone: '', designation: '', website: '', gstin: '', profileImage: '', anyFile: '', remarks: ''
    });
    const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
    const [uploadingAnyFile, setUploadingAnyFile] = useState(false);
    const profileImageRef = useRef();
    const anyFileRef = useRef();

    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [productFormData, setProductFormData] = useState({
        name: '', sku: '', hsn: '', barcode: '', categoryId: '',
        uomId: '', purchaseUomId: '', salesUomId: '', unit: '', description: '', asOfDate: new Date().toISOString().split('T')[0],
        taxAccount: '', initialCost: 0, salePrice: 0, purchasePrice: 0,
        discount: 0, remarks: '', image: null
    });
    const [productWarehouseRows, setProductWarehouseRows] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [allUoms, setAllUoms] = useState([]);

    // UOM Modal States
    const [showUomModal, setShowUomModal] = useState(false);
    const [uomFormData, setUomFormData] = useState({
        category: '', unitName: '', weightPerUnit: '', uomType: 'Simple', baseUnitId: '', conversionRate: ''
    });
    const measurementCategories = ['Weight', 'Area', 'Volume', 'Length', 'Count'];
    const unitsByCategory = {
        'Weight': ['Microgram', 'Milligram', 'Gram', 'Kilogram (KG)', 'Metric Ton (Tonne)', 'Quintal', 'Pound (lb)', 'Ounce (oz)', 'Stone', 'Carat'],
        'Area': ['Square Millimeter', 'Square Centimeter', 'Square Meter', 'Square Kilometer', 'Square Inch', 'Square Foot', 'Square Yard', 'Acre', 'Hectare', 'Bigha', 'Kanal', 'Cent'],
        'Volume': ['Millilitre (mL)', 'Litre (L)', 'Cubic Centimeter (cc)', 'Cubic Meter', 'Cubic Inch', 'Cubic Foot', 'Gallon', 'Barrel', 'Pint', 'Quart', 'Fluid Ounce'],
        'Length': ['Nanometer', 'Micrometer', 'Millimeter', 'Centimeter', 'Meter', 'Kilometer', 'Inch', 'Foot', 'Yard', 'Mile'],
        'Count': ['Piece', 'Unit', 'Dozen', 'Pair', 'Set', 'Box', 'Packet', 'Carton', 'Bundle', 'Roll', 'Strip', 'Bottle', 'Bag', 'Can', 'Jar', 'Tube']
    };

    const [step, setStep] = useState(1); // 1: Select Order, 2: Challan Details
    const [editingId, setEditingId] = useState(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Form Data
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [vendorId, setVendorId] = useState('');
    const [companyInfo, setCompanyInfo] = useState({
        name: '', address: '', email: '', phone: '', logo: ''
    });

    // Challan Specifics
    const [grnMeta, setGrnMeta] = useState({
        grnNumber: '',
        manualRef: '', // e.g. DC-MAN-01
        date: new Date().toISOString().split('T')[0],
        vehicleNo: ''
    });

    // Addresses
    const [destAddress, setDestAddress] = useState({
        line1: '', line2: '', city: '', zip: '', phone: '', email: ''
    });

    const [items, setItems] = useState([]);
    const [notes, setNotes] = useState({ logistics: '', remarks: '' });

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [orderSearchTerm, setOrderSearchTerm] = useState('');
    const [grnFilterVendorId, setGrnFilterVendorId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const printRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `GoodsReceipt_${grnMeta.grnNumber || 'New'}`,
    });

    useEffect(() => {
        fetchInitialData();
        fetchGRNs();
        fetchCompanyInfo();
    }, []);

    useEffect(() => {
        if (targetGrnId && grns.length > 0) {
            handleView(targetGrnId);
            // Clear navigation state
            navigate(location.pathname, { replace: true, state: { ...location.state, targetGrnId: undefined } });
        }
    }, [targetGrnId, grns]);

    // Handle Source Data (Auto-fill from Navigation)
    useEffect(() => {
        if (sourceData && !editingId) {
            // If coming from PO, we might already have order info
            // For now, let's treat it as if we selected the order in Step 1
            if (sourceData.purchaseOrderId) {
                // Try to resolve order
                handleSelectOrderById(sourceData.purchaseOrderId);
            }
        }
    }, [sourceData, pendingOrders]);

    const fetchCompanyInfo = async () => {
        const companyId = GetCompanyId();
        if (companyId) {
            try {
                const res = await companyService.getById(companyId);
                if (res.data) {
                    setCompanyInfo({
                        name: res.data.name || 'My Company',
                        address: res.data.address || '',
                        email: res.data.email || '',
                        phone: res.data.phone || '',
                        logo: res.data.logo || '',
                        zip: res.data.zip || res.data.postalCode || ''
                    });
                    // Auto-fill dest address from company address parts if possible
                    setDestAddress(prev => ({
                        ...prev,
                        line1: res.data.address || '',
                        city: res.data.city || '',
                        zip: res.data.zip || res.data.postalCode || '',
                        email: res.data.email || ''
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch company info", err);
            }
        }
    };

    const fetchInitialData = async () => {
        try {
            const companyId = GetCompanyId();
            const [vendorRes, productRes, warehouseRes, orderRes, uomRes] = await Promise.all([
                vendorService.getAllVendors(companyId),
                productService.getProducts(companyId),
                warehouseService.getWarehouses(companyId),
                purchaseOrderService.getOrders(companyId),
                uomService.getUOMs(companyId)
            ]);

            // Vendors
            if (vendorRes.success && Array.isArray(vendorRes.data)) setVendors(vendorRes.data);
            else if (Array.isArray(vendorRes)) setVendors(vendorRes);
            else if (vendorRes.data && Array.isArray(vendorRes.data)) setVendors(vendorRes.data);

            // Products
            if (productRes.success && Array.isArray(productRes.data)) setProducts(productRes.data);
            else if (Array.isArray(productRes)) setProducts(productRes);
            else if (productRes.data && Array.isArray(productRes.data)) setProducts(productRes.data);

            // Warehouses
            if (warehouseRes.success && Array.isArray(warehouseRes.data)) setWarehouses(warehouseRes.data);
            else if (Array.isArray(warehouseRes)) setWarehouses(warehouseRes);
            else if (warehouseRes.data && Array.isArray(warehouseRes.data)) setWarehouses(warehouseRes.data);

            // UOMs
            if (uomRes?.success) setAllUoms(uomRes.data || []);
            else if (uomRes?.data) setAllUoms(uomRes.data);

            // Orders - filter out those that already have GRNs
            if (orderRes.success) {
                setPendingOrders(orderRes.data.filter(o => o.status !== 'COMPLETED' && (!o.grns || o.grns.length === 0)));
            }
        } catch (error) {
            console.error("Error fetching dropdowns", error);
            toast.error("Failed to load dropdown data");
        }
    };

    useEffect(() => {
        if (showAddProductModal) {
            const companyId = GetCompanyId();
            categoryService.getCategories(companyId).then(res => {
                if (res.success) setCategories(res.data);
            });
        }
    }, [showAddProductModal]);

    // Inline Vendor Handlers
    const handleVendorInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        let val = type === 'checkbox' ? checked : value;
        if ((name === 'phone' || name === 'billingPhone' || name === 'alternativePhone') && typeof value === 'string') {
            val = value.replace(/\D/g, '');
        }
        setVendorFormData(prev => {
            const newData = { ...prev, [name]: val };
            if (name === 'billingAddress' && prev.shippingSameAsBilling) {
                newData.shippingAddress = val;
            }
            if (prev.shippingSameAsBilling && name.startsWith('billing')) {
                const shippingField = name.replace('billing', 'shipping');
                newData[shippingField] = val;
            }
            if (name === 'shippingSameAsBilling' && val) {
                newData.shippingAddress = prev.billingAddress;
                newData.shippingCity = prev.billingCity;
                newData.shippingState = prev.billingState;
                newData.shippingCountry = prev.billingCountry;
                newData.shippingZipCode = prev.billingZipCode;
            }
            return newData;
        });
    };

    const handleVendorShippingAddressChange = (index, field, value) => {
        setVendorFormData(prev => {
            const newAddresses = [...prev.shippingAddresses];
            let processedValue = value;
            if (field === 'phone' && typeof value === 'string') {
                processedValue = value.replace(/\D/g, '');
            }
            newAddresses[index] = { ...newAddresses[index], [field]: processedValue };
            return { ...prev, shippingAddresses: newAddresses };
        });
    };

    const addVendorShippingAddress = () => {
        setVendorFormData(prev => ({
            ...prev,
            shippingAddresses: [
                ...prev.shippingAddresses,
                { name: '', phone: '', address: '', city: '', state: '', country: '', zipCode: '', isDefault: false }
            ]
        }));
    };

    const removeVendorShippingAddress = (index) => {
        setVendorFormData(prev => ({
            ...prev,
            shippingAddresses: prev.shippingAddresses.filter((_, i) => i !== index)
        }));
    };

    const handleVendorFileUpload = async (file, field, folder) => {
        if (!file) return;
        const setUploading = field === 'profileImage' ? setUploadingProfileImage : setUploadingAnyFile;
        setUploading(true);
        try {
            const url = await uploadToCloudinary(file);
            setVendorFormData(prev => ({ ...prev, [field]: url }));
            toast.success(`${field === 'profileImage' ? 'Profile image' : 'File'} uploaded!`);
        } catch (err) {
            toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleFullVendorSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!vendorFormData.name || !vendorFormData.email) {
            toast.error('Please fill in required fields (Name and Email)');
            return;
        }

        const payload = { ...vendorFormData };
        let shippingAddresses = [...vendorFormData.shippingAddresses];

        if (vendorFormData.shippingSameAsBilling) {
            const billingAsShipping = {
                name: vendorFormData.billingName || vendorFormData.name,
                phone: vendorFormData.billingPhone || vendorFormData.phone,
                address: vendorFormData.billingAddress,
                city: vendorFormData.billingCity,
                state: vendorFormData.billingState,
                country: vendorFormData.billingCountry,
                zipCode: vendorFormData.billingZipCode,
                isDefault: true
            };
            shippingAddresses = [billingAsShipping, ...vendorFormData.shippingAddresses];
        }

        payload.shippingAddresses = shippingAddresses;
        payload.companyId = parseInt(GetCompanyId());

        try {
            const res = await vendorService.createVendor(payload);
            toast.success('Vendor created successfully!');
            setShowAddVendorModal(false);

            // Refresh vendors list
            const companyId = GetCompanyId();
            const vendRes = await vendorService.getAllVendors(companyId);
            if (vendRes?.success && Array.isArray(vendRes.data)) {
                setVendors(vendRes.data);
            } else if (Array.isArray(vendRes)) {
                setVendors(vendRes);
            } else if (vendRes?.data && Array.isArray(vendRes.data)) {
                setVendors(vendRes.data);
            }

            const added = res?.data || res;
            if (added && added.id) {
                setVendorId(added.id.toString());
            }

            // Reset vendor form
            setVendorFormData({
                name: '', nameArabic: '', companyName: '', companyLocation: '',
                billingName: '', billingPhone: '', billingAddress: '', billingCity: '', billingState: '', billingCountry: '', billingZipCode: '',
                shippingSameAsBilling: true,
                shippingAddresses: [],
                accountType: 'Credit', balanceType: 'Credit', accountBalance: '', creationDate: new Date().toISOString().split('T')[0],
                bankAccountNumber: '', bankIFSC: '', bankNameBranch: '',
                primaryContactName: '', email: '', phone: '', alternativePhone: '', designation: '', website: '', gstin: '', profileImage: '', anyFile: '', remarks: ''
            });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create vendor');
        }
    };

    // Inline Product Handlers
    const handleProductInputChange = (e) => {
        const { name, value } = e.target;
        setProductFormData(prev => ({ ...prev, [name]: value }));
    };

    const addProductWarehouseRow = () => {
        const firstWhId = warehouses.length > 0 ? warehouses[0].id : '';
        setProductWarehouseRows([...productWarehouseRows, {
            id: Date.now(),
            warehouseId: firstWhId,
            quantity: 0,
            minOrderQty: 0,
            initialQty: 0
        }]);
    };

    const removeProductWarehouseRow = (id) => {
        setProductWarehouseRows(productWarehouseRows.filter(row => row.id !== id));
    };

    const handleProductWhRowChange = (id, field, value) => {
        setProductWarehouseRows(productWarehouseRows.map(row =>
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    const handleProductImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                setUploadingImage(true);
                toast.loading('Uploading image...', { id: 'prod-image-upload' });
                const imageUrl = await uploadToCloudinary(file);
                setProductFormData(prev => ({ ...prev, image: imageUrl }));
                toast.success('Image uploaded successfully', { id: 'prod-image-upload' });
            } catch (error) {
                console.error(error);
                toast.error('Failed to upload image', { id: 'prod-image-upload' });
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const handleProductAddCategorySubmit = async () => {
        if (!newCategoryName.trim()) return toast.error('Category name is required');
        try {
            const companyId = GetCompanyId();
            const res = await categoryService.createCategory({ name: newCategoryName, companyId });
            if (res.success) {
                toast.success('Category added');
                setShowCategoryModal(false);
                setNewCategoryName('');
                const catRes = await categoryService.getCategories(companyId);
                if (catRes.success) setCategories(catRes.data);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add category');
        }
    };

    const getUniqueCategories = () => {
        return [...new Set(allUoms.map(u => u.category))];
    };

    const getAvailableBaseUnitsForCategory = (category) => {
        return allUoms.filter(u => u.category === category && u.uomType === 'Simple');
    };

    const handleUomInputChange = (e) => {
        const { name, value } = e.target;
        setUomFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUomSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            const companyId = GetCompanyId();
            const payload = {
                category: uomFormData.category,
                unitName: uomFormData.unitName,
                weightPerUnit: uomFormData.weightPerUnit,
                uomType: uomFormData.uomType,
                baseUnitId: uomFormData.uomType === 'Compound' && uomFormData.baseUnitId
                    ? (isNaN(uomFormData.baseUnitId) ? uomFormData.baseUnitId : parseInt(uomFormData.baseUnitId))
                    : null,
                conversionRate: uomFormData.uomType === 'Compound' && uomFormData.conversionRate ? parseFloat(uomFormData.conversionRate) : null,
                companyId: parseInt(companyId)
            };

            const res = await uomService.createUOM(payload);
            if (res.success) {
                toast.success('Unit added successfully');
                const uomsRes = await uomService.getUOMs(companyId);
                if (uomsRes.success) {
                    setAllUoms(uomsRes.data || []);
                }
                setProductFormData(prev => ({
                    ...prev,
                    uomId: res.data?.id || prev.uomId,
                    purchaseUomId: res.data?.id || prev.purchaseUomId,
                    salesUomId: res.data?.id || prev.salesUomId
                }));
                setShowUomModal(false);
                setUomFormData({
                    category: '', unitName: '', weightPerUnit: '', uomType: 'Simple', baseUnitId: '', conversionRate: ''
                });
            }
        } catch (error) {
            console.error('Error saving UOM:', error);
            toast.error(error.response?.data?.message || 'Failed to save UOM');
        }
    };

    const handleFullProductSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!productFormData.name) {
            toast.error('Item Name is required');
            return;
        }
        try {
            const companyId = GetCompanyId();
            const payload = {
                ...productFormData,
                companyId: parseInt(companyId),
                warehouseInfo: productWarehouseRows.map(row => ({
                    warehouseId: parseInt(row.warehouseId),
                    quantity: parseFloat(row.quantity) || 0,
                    minOrderQty: parseFloat(row.minOrderQty) || 0,
                    initialQty: parseFloat(row.initialQty) || 0
                }))
            };
            await productServiceFromServices.createProduct(payload);
            toast.success('Product created successfully!');
            setShowAddProductModal(false);

            // Refresh products
            const prodRes = await productService.getProducts(companyId);
            if (prodRes?.success && Array.isArray(prodRes.data)) {
                setProducts(prodRes.data);
            } else if (prodRes?.data) {
                setProducts(prodRes.data);
            } else if (Array.isArray(prodRes)) {
                setProducts(prodRes);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to create product');
        }
    };

    const filteredPendingOrders = useMemo(() => {
        return pendingOrders.filter(o => {
            const query = orderSearchTerm.toLowerCase();
            const matchesSearch = !query ||
                o.orderNumber?.toLowerCase().includes(query) ||
                o.vendor?.name?.toLowerCase().includes(query);
            const matchesVendor = !grnFilterVendorId || o.vendorId === parseInt(grnFilterVendorId);
            return matchesSearch && matchesVendor;
        });
    }, [pendingOrders, orderSearchTerm, grnFilterVendorId]);

    const filteredGrns = useMemo(() => {
        return grns.filter(g => {
            const query = searchTerm.toLowerCase();
            const grnNo = g.grnNumber || '';
            const vendorName = g.vendor?.name || '';
            const poRef = g.purchaseorder?.orderNumber || '';

            const matchesSearch = !query ||
                grnNo.toLowerCase().includes(query) ||
                vendorName.toLowerCase().includes(query) ||
                poRef.toLowerCase().includes(query);

            const gDate = new Date(g.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || gDate >= start) && (!end || gDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [grns, searchTerm, startDate, endDate]);

    const fetchGRNs = async () => {
        setLoading(true);
        try {
            const companyId = GetCompanyId();
            const res = await goodsReceiptNoteService.getGRNs(companyId);
            if (res.success) {
                setGrns(res.data);
                setSelectedGrnIds([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const nonConvertedIds = grns
                .filter(g => g.status !== 'Converted')
                .map(g => g.id);
            setSelectedGrnIds(nonConvertedIds);
        } else {
            setSelectedGrnIds([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedGrnIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkConvert = async () => {
        if (selectedGrnIds.length === 0) return;

        try {
            const companyId = GetCompanyId();
            const response = await goodsReceiptNoteService.convertMultiple(selectedGrnIds, companyId);
            if (response.success) {
                toast.success("Successfully converted selected GRNs to Purchase Bill!");
                setSelectedGrnIds([]);
                fetchGRNs();
            } else {
                toast.error(response.message || "Failed to convert selected GRNs.");
            }
        } catch (error) {
            console.error("Bulk convert error:", error);
            toast.error(error.response?.data?.message || "Error converting selected GRNs.");
        }
    };

    const addItem = () => {
        let defWarehouseId = '';
        if (companySettings?.inventoryConfig) {
            try {
                const parsed = typeof companySettings.inventoryConfig === 'string'
                    ? JSON.parse(companySettings.inventoryConfig)
                    : companySettings.inventoryConfig;
                if (parsed.defaultPurchaseWarehouseId) {
                    defWarehouseId = parseInt(parsed.defaultPurchaseWarehouseId);
                }
            } catch (e) {
                console.error(e);
            }
        }
        setItems([...items, { id: Date.now(), productId: '', warehouseId: defWarehouseId, orderedQty: 0, receivedQty: 1, unit: 'pcs' }]);
    };

    const handleSelectOrderById = (orderId) => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (order) handleSelectOrder(order);
    };

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setVendorId(order.vendorId);

        // Map Items
        const sourceItems = order.purchaseorderitem || order.items || [];
        const grnItems = sourceItems.map(item => {
            // Ensure productId is valid by checking against loaded 'products'
            let validProductId = item.productId;
            if (products.length > 0) {
                const exists = products.find(p => p.id === item.productId);
                if (!exists) {
                    // Try finding by name if ID mismatch
                    const byName = products.find(p => p.name === item.productName || p.name === item.description); // Adjust based on PO item structure
                    if (byName) validProductId = byName.id;
                }
            }

            const prod = products.find(p => p.id === validProductId);
            return {
                id: Date.now() + Math.random(),
                productId: validProductId || '',
                warehouseId: (warehouses.length > 0) ? warehouses[0].id : '', // Auto-select first warehouse
                orderedQty: item.quantity,
                receivedQty: item.quantity,
                unit: prod?.uom?.unitName || prod?.purchaseUom?.unitName || prod?.unit || 'NA',
                description: item.description
            };
        });
        setItems(grnItems);

        // Go to step 2
        setStep(2);

        // Ensure modal is open if triggered externally
        setShowAddModal(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setStep(1);
        setSelectedOrder(null);
        setVendorId('');
        setGrnMeta({ grnNumber: '', manualRef: '', date: new Date().toISOString().split('T')[0], vehicleNo: '' });
        setItems([]);
        setNotes({ logistics: '', remarks: '' });
        setOrderSearchTerm('');
        setGrnFilterVendorId('');
        setCustomFieldValues({});
        setIsViewMode(false);
        setShowAddModal(false);
    };

    const handleView = async (id) => {
        try {
            const companyId = GetCompanyId();
            const res = await goodsReceiptNoteService.getGRNById(id, companyId);
            if (res.success && res.data) {
                const grn = res.data;
                setEditingId(grn.id);
                setIsViewMode(true);
                setVendorId(grn.vendorId);
                setGrnMeta({
                    grnNumber: grn.grnNumber,
                    manualRef: (grn.notes && grn.notes.match(/Manual Ref: (.*)/)) ? grn.notes.match(/Manual Ref: (.*)/)[1] : '',
                    date: grn.date.split('T')[0],
                    vehicleNo: (grn.notes && grn.notes.match(/Vehicle: (.*)/)) ? grn.notes.match(/Vehicle: (.*)/)[1] : ''
                });

                const noteText = grn.notes || '';
                setNotes({
                    logistics: (noteText.match(/Logistics: (.*)/)) ? noteText.match(/Logistics: (.*)/)[1] : '',
                    remarks: (noteText.match(/Remarks: (.*)/)) ? noteText.match(/Remarks: (.*)/)[1] : noteText
                });

                const itemsData = grn.goodsreceiptnoteitem || grn.items;
                if (itemsData) {
                    const mappedItems = itemsData.map(i => {
                        // Find ordered quantity from linked PO if possible
                        const poItem = grn.purchaseorder?.purchaseorderitem?.find(pi => pi.productId === i.productId);
                        const prod = products.find(p => p.id === i.productId);
                        return {
                            id: i.id || Date.now() + Math.random(),
                            productId: i.productId || '',
                            warehouseId: i.warehouseId || '',
                            orderedQty: poItem ? poItem.quantity : 0,
                            receivedQty: i.quantity,
                            unit: prod?.uom?.unitName || prod?.purchaseUom?.unitName || prod?.unit || i.product?.uom?.unitName || i.product?.purchaseUom?.unitName || 'pcs',
                            description: i.description
                        };
                    });
                    setItems(mappedItems);
                }
                let fieldValues = {};
                if (grn.customFields) {
                    try {
                        fieldValues = typeof grn.customFields === 'string'
                            ? JSON.parse(grn.customFields)
                            : grn.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on view:', e);
                    }
                }
                setCustomFieldValues(fieldValues);
                setStep(2);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error("Error fetching GRN details", error);
            toast.error("Failed to fetch GRN details");
        }
    };

    const handleAddNew = async () => {
        resetForm();
        setStep(2);
        let nextGrn = '';
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getNextNumber(companyId, 'goodsreceiptnote');
                if (res.data && res.data.success) {
                    nextGrn = res.data.nextNumber;
                }
            }
        } catch (error) {
            console.error('Error fetching next goodsreceiptnote number:', error);
        }
        setGrnMeta(prev => ({
            ...prev,
            grnNumber: nextGrn
        }));
        setShowAddModal(true);
    };

    const handleEdit = async (id) => {
        try {
            const companyId = GetCompanyId();
            const res = await goodsReceiptNoteService.getGRNById(id, companyId);
            if (res.success && res.data) {
                const grn = res.data;
                setEditingId(grn.id);
                setIsViewMode(false);

                // Populate Data
                setVendorId(grn.vendorId);
                setGrnMeta({
                    grnNumber: grn.grnNumber,
                    manualRef: (grn.notes && grn.notes.match(/Manual Ref: (.*)/)) ? grn.notes.match(/Manual Ref: (.*)/)[1] : '',
                    date: grn.date.split('T')[0],
                    vehicleNo: (grn.notes && grn.notes.match(/Vehicle: (.*)/)) ? grn.notes.match(/Vehicle: (.*)/)[1] : ''
                });

                // Extract Challan/Vehicle from notes if stored there as JSON or text
                const noteText = grn.notes || '';
                setNotes({
                    logistics: (noteText.match(/Logistics: (.*)/)) ? noteText.match(/Logistics: (.*)/)[1] : '',
                    remarks: (noteText.match(/Remarks: (.*)/)) ? noteText.match(/Remarks: (.*)/)[1] : noteText
                });

                const itemsData = grn.goodsreceiptnoteitem || grn.items;
                if (itemsData) {
                    const mappedItems = itemsData.map(i => {
                        // Find ordered quantity from linked PO if possible
                        const poItem = grn.purchaseorder?.purchaseorderitem?.find(pi => pi.productId === i.productId);
                        const prod = products.find(p => p.id === i.productId);
                        return {
                            id: i.id || Date.now() + Math.random(),
                            productId: i.productId || '',
                            warehouseId: i.warehouseId || '',
                            orderedQty: poItem ? poItem.quantity : 0,
                            receivedQty: i.quantity,
                            unit: prod?.uom?.unitName || prod?.purchaseUom?.unitName || prod?.unit || i.product?.uom?.unitName || i.product?.purchaseUom?.unitName || 'pcs',
                            description: i.description
                        };
                    });
                    setItems(mappedItems);
                }
                let fieldValues = {};
                if (grn.customFields) {
                    try {
                        fieldValues = typeof grn.customFields === 'string'
                            ? JSON.parse(grn.customFields)
                            : grn.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on edit:', e);
                    }
                }
                setCustomFieldValues(fieldValues);

                // Skip link, go to step 2 directly
                setStep(2);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error("Error fetching GRN details", error);
            toast.error("Failed to fetch GRN details for editing");
        }
    };

    const handleDelete = (id) => {
        setDeleteId(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        try {
            const companyId = GetCompanyId();
            await goodsReceiptNoteService.deleteGRN(deleteId, companyId);
            toast.success("GRN deleted successfully");
            fetchGRNs();
        } catch (e) {
            toast.error("Failed to delete GRN");
        }
        setShowDeleteConfirm(false);
    };

    const handleConvert = async (id) => {
        try {
            const companyId = GetCompanyId();
            const response = await goodsReceiptNoteService.convertGRN(id, companyId);
            if (response.success) {
                toast.success('Converted to Purchase Bill successfully');
                setShowAddModal(false);
                navigate('/company/purchases/bill', { state: { targetBillId: response.data.id } });
            } else {
                toast.error(response.message || 'Conversion failed');
            }
        } catch (error) {
            console.error('Error converting GRN:', error);
            toast.error(error.response?.data?.message || error.message || 'Error converting GRN');
        }
    };

    const handleStatusChange = async (grnId, newStatus) => {
        try {
            const companyId = GetCompanyId();
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };
            const response = await goodsReceiptNoteService.updateGRN(grnId, payload, companyId);
            if (response?.success || response?.data?.success) {
                toast.success('Status updated');
                fetchGRNs();
            }
        } catch (error) {
            console.error('Error changing status:', error);
            toast.error('Failed to update status');
        }
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'productId') {
                    const prod = products.find(p => p.id === Number(value));
                    updated.unit = prod?.uom?.unitName || prod?.purchaseUom?.unitName || prod?.unit || 'pcs';
                }
                return updated;
            }
            return item;
        }));
    };

    const handleSave = async () => {
        if (!vendorId) return toast.error("Vendor is required");
        if (items.some(i => !i.warehouseId || !i.productId)) return toast.error("Warehouse and Product required for all items");

        const companyId = GetCompanyId();
        const payload = {
            companyId,
            grnNumber: grnMeta.grnNumber || `GRN-${Date.now()}`, // Temporary fallback if auto-gen not in backend
            purchaseOrderId: selectedOrder ? selectedOrder.id : null,
            vendorId: parseInt(vendorId),
            date: grnMeta.date,
            customFields: JSON.stringify(customFieldValues),
            items: items.map(item => ({
                productId: parseInt(item.productId),
                warehouseId: parseInt(item.warehouseId),
                quantity: parseFloat(item.receivedQty),
                description: item.description
            })),
            // Combine extra fields into notes for now if backend Schema doesn't support them explicitly
            notes: `Vehicle: ${grnMeta.vehicleNo}\nManual Ref: ${grnMeta.manualRef}\nLogistics: ${notes.logistics}\nRemarks: ${notes.remarks}`
        };

        try {
            if (editingId) {
                await goodsReceiptNoteService.updateGRN(editingId, payload, companyId);
                toast.success("GRN Updated");
            } else {
                await goodsReceiptNoteService.createGRN(payload);
                toast.success("GRN Created");
            }
            setShowAddModal(false);
            fetchGRNs();
        } catch (error) {
            toast.error("Failed to save GRN");
        }
    };

    // --- Render Helpers ---

    // Get vendor details for display
    const selectedVendor = vendors.find(v => v.id == vendorId);

    return (
        <div className="grn-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Goods Receipt</h1>
                    <p className="page-subtitle">Manage inbound deliveries and receipts</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {selectedGrnIds.length > 0 && (
                        <button className="grn-btn-primary" onClick={handleBulkConvert} style={{ backgroundColor: '#4f46e5' }}>
                            <Receipt size={18} className="mr-2" /> Convert Selected ({selectedGrnIds.length})
                        </button>
                    )}
                    {hasPermission('create goods receipt') && (
                        <button className="grn-btn-primary" onClick={handleAddNew}>
                            <Plus size={18} className="mr-2" /> New Goods Receipt
                        </button>
                    )}
                </div>
            </div>

            {/* List Table (Existing style kept for list view) */}
            <div className="table-card mt-6">
                <div className="grn-table-controls p-4 border-b flex justify-between items-center gap-4 flex-wrap">
                    <div className="grn-search-wrapper">
                        <Search className="grn-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by ID, PO or Vendor..."
                            className="grn-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="grn-date-filters flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">From:</span>
                            <input
                                type="date"
                                className="grn-date-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">To:</span>
                            <input
                                type="date"
                                className="grn-date-input"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        {(searchTerm || startDate || endDate) && (
                            <button
                                className="text-sm text-red-500 hover:text-red-700 font-medium"
                                onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                </div>
                <table className="grn-list-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={
                                        grns.length > 0 &&
                                        grns.filter(g => g.status !== 'Converted').length > 0 &&
                                        grns.filter(g => g.status !== 'Converted').every(g => selectedGrnIds.includes(g.id))
                                    }
                                />
                            </th>
                            <th>GRN ID</th>
                            <th>PO REF</th>
                            <th>VENDOR</th>
                            <th>DATE</th>
                            <th>STATUS</th>
                            <th className="text-right">ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredGrns.length === 0 ? (
                            <tr><td colSpan="7" className="text-center p-4">No receipts found</td></tr>
                        ) : (
                            filteredGrns.map(g => (
                                <tr key={g.id}>
                                    <td style={{ textAlign: 'center' }}>
                                        {g.status !== 'Converted' ? (
                                            <input
                                                type="checkbox"
                                                checked={selectedGrnIds.includes(g.id)}
                                                onChange={() => handleSelectRow(g.id)}
                                            />
                                        ) : (
                                            <input type="checkbox" disabled />
                                        )}
                                    </td>
                                    <td className="font-bold text-blue-600">{g.grnNumber}</td>
                                    <td>{g.purchaseorder?.orderNumber || '-'}</td>
                                    <td>{g.vendor?.name}</td>
                                    <td>{new Date(g.date).toLocaleDateString()}</td>
                                    <td>
                                        <select
                                            value={g.manualStatus ? g.status : 'AUTO'}
                                            onChange={(e) => handleStatusChange(g.id, e.target.value)}
                                            className="status-pill"
                                            style={getStatusStyle(g.manualStatus ? g.status : 'AUTO')}
                                        >
                                            <option value="AUTO">Auto ({g.status})</option>
                                            <option value="PENDING">PENDING</option>
                                            <option value="PARTIAL">PARTIAL</option>
                                            <option value="RECEIVED">RECEIVED</option>
                                            <option value="CANCELLED">CANCELLED</option>
                                        </select>
                                    </td>
                                    <td className="">
                                        <div className="grn-action-buttons">
                                            <button className="btn-action-header view" onClick={() => handleView(g.id)} title="View"><Eye size={16} /></button>
                                            {g.status !== 'Converted' ? (
                                                <button className="btn-action-header convert" onClick={() => handleConvert(g.id)} title="Convert to Purchase Bill" style={{ backgroundColor: '#4f46e5', color: 'white', padding: '6px', borderRadius: '4px' }}><Receipt size={16} /></button>
                                            ) : (
                                                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-500 rounded" style={{ alignSelf: 'center' }}>Converted</span>
                                            )}
                                            {hasPermission('edit goods receipt') && (
                                                <button className="btn-action-header edit" onClick={() => handleEdit(g.id)} title="Edit"><Pencil size={16} /></button>
                                            )}
                                            {hasPermission('delete goods receipt') && (
                                                <button className="btn-action-header delete" onClick={() => handleDelete(g.id)} title="Delete"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )))}
                    </tbody>
                </table>
            </div>

            {/* Main Modal */}
            {showAddModal && (
                <div className="grn-modal-overlay">
                    <div className={`grn-modal-content ${isViewMode ? 'grn-delivery-modal-premium' : ''}`}>
                        {/* Header */}
                        <div className="grn-modal-header">
                            <div className="flex items-center gap-3">
                                <h2 className="grn-modal-title" style={{ margin: 0 }}>
                                    {isViewMode ? 'Goods Receipt' : (editingId ? 'Edit Goods Receipt' : 'New Goods Receipt')}
                                </h2>
                                {isViewMode
                                    ? <span className="grn-status-badge-header" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>VIEW</span>
                                    : <span className="grn-status-badge-header" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>RECEIPT</span>
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                {isViewMode && (
                                    <button className="grn-btn-print-header" onClick={handlePrint} title="Print Receipt">
                                        <Printer size={20} />
                                    </button>
                                )}
                                <button className="grn-close-btn" onClick={() => setShowAddModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Steps Indicator */}
                        {!isViewMode && (
                            <div className="grn-wizard-steps">
                                <div className="grn-step-connector"></div>
                                <div className={`grn-step ${step >= 1 ? 'completed' : ''}`}>
                                    <div className="grn-step-circle">1</div>
                                    <span className="grn-step-label">Select Order</span>
                                </div>
                                <div className={`grn-step ${step >= 2 ? 'active' : ''}`}>
                                    <div className="grn-step-circle">2</div>
                                    <span className="grn-step-label">Challan Details</span>
                                </div>
                            </div>
                        )}

                        {/* Body */}
                        <div className="grn-modal-body" ref={printRef}>
                            {isViewMode ? (
                                <div className="Zirak-GRN-view-challan-doc">
                                    <div
                                        className={`invoice-preview-container template-${(companySettings?.invoiceTemplate || 'New York').toLowerCase().replace(' ', '').replace('invoice-', '')}`}
                                        style={{
                                            '--header-bg': companySettings?.invoiceColor || '#004aad',
                                            '--header-text': (() => {
                                                const hex = (companySettings?.invoiceColor || '#004aad').replace('#', '');
                                                const r = parseInt(hex.substr(0, 2), 16);
                                                const g = parseInt(hex.substr(2, 2), 16);
                                                const b = parseInt(hex.substr(4, 2), 16);
                                                const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                                                return (yiq >= 150) ? '#1e293b' : '#ffffff';
                                            })()
                                        }}
                                    >
                                        {getInvoiceLabel('showHeader') !== false && (
                                            <div className="invoice-header-wrapper" style={{ border: 'none', padding: '0', margin: '0' }}>
                                                <div className="invoice-preview-header" style={{ marginBottom: '10px' }}>
                                                    <div className="invoice-header-left">
                                                        {(companySettings?.invoiceLogo || companyInfo.logo) && (
                                                            <img
                                                                src={companySettings?.invoiceLogo || (companyInfo.logo.startsWith('http') ? companyInfo.logo : `${BASE_URL}/${companyInfo.logo.replace(/\\/g, '/')}`)}
                                                                alt="Company Logo"
                                                                className="invoice-logo-large"
                                                                style={{ margin: '0' }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="invoice-header-right">
                                                        <div className="invoice-title-large" style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0' }}>{getDocumentTitle('goodsreceipt')}</div>
                                                    </div>
                                                </div>

                                                <div className="invoice-preview-header" style={{ alignItems: 'flex-start' }}>
                                                    <div className="invoice-header-left">
                                                        <div className="invoice-company-details">
                                                            <h2 style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0 0 5px 0', fontSize: '1.6rem', fontWeight: '900' }}>
                                                                {companyInfo.name}
                                                            </h2>
                                                            <p>{companyInfo.address}</p>
                                                            <p>{companyInfo.email} | {companyInfo.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="invoice-header-right">
                                                        <div className="invoice-meta-info">
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Challan No:</span>
                                                                <span>#{grnMeta.grnNumber}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Ref:</span>
                                                                <span>{grnMeta.manualRef || '—'}</span>
                                                            </div>
                                                            <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                <span className="invoice-label">Date:</span>
                                                                <span>{grnMeta.date ? new Date(grnMeta.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                                                            </div>
                                                            {grnMeta.vehicleNo && (
                                                                <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                    <span className="invoice-label">Vehicle:</span>
                                                                    <span>{grnMeta.vehicleNo}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Address Block */}
                                        <div className="invoice-addresses" style={{ display: 'flex', justifyContent: 'space-between', width: '100% !important', marginTop: '2.5rem', gap: '3rem' }}>
                                            <div className="invoice-bill-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                <div className="invoice-section-header">FROM (VENDOR)</div>
                                                {selectedVendor ? (
                                                    <>
                                                        <div className="font-bold text-gray-800" style={{ fontSize: '1.1rem', marginBottom: '5px' }}>{selectedVendor.name}</div>
                                                        <div className="invoice-company-details">
                                                            <p style={{ margin: '2px 0' }}><strong>Address:</strong> {selectedVendor.address || selectedVendor.billingAddress || 'N/A'}</p>
                                                            <p style={{ margin: '2px 0' }}><strong>Email:</strong> {selectedVendor.email || 'N/A'}</p>
                                                            <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {selectedVendor.phone || 'N/A'}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Vendor not selected</div>
                                                )}
                                            </div>
                                            <div className="invoice-ship-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                <div className="invoice-section-header">DELIVER TO</div>
                                                <div className="font-bold text-gray-800" style={{ fontSize: '1.1rem', marginBottom: '5px' }}>{companyInfo.name || 'Company Name'}</div>
                                                <div className="invoice-company-details">
                                                    {destAddress.line1 && <p style={{ margin: '2px 0' }}>{destAddress.line1}</p>}
                                                    {[destAddress.city, destAddress.zip].filter(Boolean).length > 0 && (
                                                        <p style={{ margin: '2px 0' }}>{[destAddress.city, destAddress.zip].filter(Boolean).join(', ')}</p>
                                                    )}
                                                    {destAddress.email && <p style={{ margin: '2px 0' }}>{destAddress.email}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Custom Fields Print View */}
                                        {(() => {
                                            const grn = grns.find(g => g.id === editingId);
                                            let customFieldVals = {};
                                            if (grn?.customFields) {
                                                try {
                                                    customFieldVals = typeof grn.customFields === 'string'
                                                        ? JSON.parse(grn.customFields)
                                                        : grn.customFields;
                                                } catch (e) {
                                                    console.error('Error parsing goods receipt custom fields for view:', e);
                                                }
                                            }
                                            const fieldsList = getCustomFieldsForType('goodsreceiptnote');
                                            const activeCustomFields = fieldsList.filter(f => customFieldVals[f.label]);
                                            if (activeCustomFields.length === 0) return null;
                                            return (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', margin: '20px 0', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', textAlign: 'left' }}>
                                                    {activeCustomFields.map(field => (
                                                        <div key={field.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{field.label}</span>
                                                            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1e293b', marginTop: '2px' }}>{customFieldVals[field.label]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        {/* Line Items Table */}
                                        <div className="invoice-table-container" style={{ marginTop: '2rem' }}>
                                            <table className="invoice-table-preview" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid var(--header-bg, #004aad)' }}>
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', width: '5%' }}>#</th>
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', width: '45%' }}>{getTableHeader('item', 'Product / Description').toUpperCase()}</th>
                                                        {getInvoiceLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', width: '15%' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center', width: '15%' }}>{getTableHeader('orderedQty', 'Ordered').toUpperCase()}</th>}
                                                        {getInvoiceLabel('showQty') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center', width: '15%' }}>{getTableHeader('receivedQty', 'Received').toUpperCase()}</th>}
                                                        <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center', width: '10%' }}>UNIT</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item, idx) => {
                                                        const prod = products.find(p => p.id === Number(item.productId));
                                                        return (
                                                            <tr key={item.id || idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                                                                <td>{idx + 1}</td>
                                                                <td>
                                                                    <span className="font-bold text-sm text-gray-800 block">{prod?.name || 'Unknown Product'}</span>
                                                                    {item.description && <span className="text-xs text-gray-500 block mt-0.5">{item.description}</span>}
                                                                </td>
                                                                {getInvoiceLabel('showWarehouse') !== false && <td>{warehouses.find(w => w.id === parseInt(item.warehouseId))?.name || '—'}</td>}
                                                                {getInvoiceLabel('showQty') !== false && <td style={{ textAlign: 'center' }}>{item.orderedQty}</td>}
                                                                {getInvoiceLabel('showQty') !== false && (
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <span className={`Zirak-GRN-vcd-delivered-pill ${parseFloat(item.receivedQty) >= parseFloat(item.orderedQty) ? 'full' : 'partial'}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                                                            {item.receivedQty}
                                                                        </span>
                                                                    </td>
                                                                )}
                                                                <td style={{ textAlign: 'center' }}>{prod?.uom?.unitName || prod?.purchaseUom?.unitName || prod?.unit || item.unit || 'pcs'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Notes & Footer */}
                                        {(notes.logistics || notes.remarks) && (
                                            <div className="Zirak-GRN-vcd-notes-grid" style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
                                                {notes.logistics && (
                                                    <div className="Zirak-GRN-vcd-note-box" style={{ flex: 1 }}>
                                                        <div className="Zirak-GRN-vcd-note-label" style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem' }}>TRANSPORT / LOGISTICS</div>
                                                        <div className="Zirak-GRN-vcd-note-text" style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{notes.logistics}</div>
                                                    </div>
                                                )}
                                                {notes.remarks && (
                                                    <div className="Zirak-GRN-vcd-note-box" style={{ flex: 1 }}>
                                                        <div className="Zirak-GRN-vcd-note-label" style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem' }}>REMARKS</div>
                                                        <div className="Zirak-GRN-vcd-note-text" style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{notes.remarks}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Signature Row */}
                                        <div className="Zirak-GRN-vcd-sig-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4rem', gap: '4rem' }}>
                                            <div className="Zirak-GRN-vcd-sig-box" style={{ flex: 1, textAlign: 'center' }}>
                                                <div className="Zirak-GRN-vcd-sig-line" style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '0.5rem' }}></div>
                                                <div className="Zirak-GRN-vcd-sig-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Authorized Signatory</div>
                                            </div>
                                            <div className="Zirak-GRN-vcd-sig-box" style={{ flex: 1, textAlign: 'center' }}>
                                                <div className="Zirak-GRN-vcd-sig-line" style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '0.5rem' }}></div>
                                                <div className="Zirak-GRN-vcd-sig-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Received By</div>
                                            </div>
                                        </div>

                                        {getInvoiceLabel('showFooter') !== false && (
                                            <div className="invoice-thank-you" style={{ textAlign: 'center', marginTop: '3rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', fontStyle: 'italic', color: '#64748b' }}>
                                                Thank you for your business!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {step === 1 && (
                                        <div className="grn-step1-container">
                                            <div className="grn-step1-title-area flex justify-between items-center gap-4 mb-4">
                                                <h3 className="grn-section-headline mb-0 flex-shrink-0">
                                                    <ShoppingCart size={20} /> Pending Purchase Orders
                                                </h3>
                                                <div className="grn-vendor-filter-mini flex-grow max-w-xs">
                                                    <select
                                                        className="grn-o-search-input-mini w-full"
                                                        value={grnFilterVendorId}
                                                        onChange={(e) => setGrnFilterVendorId(e.target.value)}
                                                    >
                                                        <option value="">All Vendors</option>
                                                        {vendors.map(v => {
                                                            const orderCount = pendingOrders.filter(o => o.vendorId === v.id).length;
                                                            return (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.name} ({orderCount} Orders)
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                                <div className="grn-o-search-wrapper-mini flex-grow max-w-xs">
                                                    <Search size={14} className="grn-o-search-icon-mini" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search orders..."
                                                        className="grn-o-search-input-mini"
                                                        value={orderSearchTerm}
                                                        onChange={(e) => setOrderSearchTerm(e.target.value)}
                                                    />
                                                    {orderSearchTerm && (
                                                        <button
                                                            className="grn-o-search-clear-mini"
                                                            onClick={() => setOrderSearchTerm('')}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grn-order-grid">
                                                {filteredPendingOrders.length > 0 ? (
                                                    filteredPendingOrders.map(order => (
                                                        <div key={order.id} className="grn-order-card" onClick={() => handleSelectOrder(order)}>
                                                            <div className="grn-order-header">
                                                                <div className="grn-order-badge">
                                                                    <FileText size={10} />
                                                                    {order.orderNumber}
                                                                </div>
                                                                <span className="grn-order-date">
                                                                    <Clock size={10} className="inline mr-1" />
                                                                    {new Date(order.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                </span>
                                                            </div>

                                                            <div className="grn-order-vendor-row">
                                                                <div className="grn-vendor-avatar">
                                                                    {order.vendor?.name ? order.vendor.name.charAt(0).toUpperCase() : 'V'}
                                                                </div>
                                                                <div className="grn-vendor-details">
                                                                    <h4>{order.vendor?.name || 'Unknown Vendor'}</h4>
                                                                    <p>{order.vendor?.address || order.vendor?.city || 'No Address'}</p>
                                                                </div>
                                                            </div>

                                                            <div className="grn-order-footer">
                                                                {(order.purchaseorderitem?.length || order.items?.length || 0)} items to receive
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="grn-empty-state">
                                                        <CheckCircle2 size={48} className="mx-auto mb-4 text-green-200" />
                                                        <p className="font-medium text-gray-900">{orderSearchTerm ? 'No matching orders' : 'All Caught Up!'}</p>
                                                        <p className="text-sm mt-1">{orderSearchTerm ? `No results found for "${orderSearchTerm}"` : 'No pending purchase orders found.'}</p>
                                                        {!orderSearchTerm && (
                                                            <button className="mt-4 text-blue-600 text-sm font-semibold hover:underline" onClick={() => setStep(2)}>
                                                                Create Direct Receipt &rarr;
                                                            </button>
                                                        )}
                                                        {orderSearchTerm && (
                                                            <button className="mt-4 text-green-600 text-sm font-semibold hover:underline" onClick={() => setOrderSearchTerm('')}>
                                                                Clear Search &rarr;
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {pendingOrders.length > 0 && (
                                                <div className="text-center mt-8">
                                                    <button className="text-sm text-gray-400 hover:text-gray-600 hover:underline" onClick={() => setStep(2)}>
                                                        Skip and create direct delivery challan
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="grn-step2-container">
                                            {/* Top Card: Company & Meta */}
                                            <div className="grn-card grn-grid-2">
                                                <div className="grn-company-inline-card">
                                                    {/* Logo - top center */}
                                                    <div className="grn-company-inline-logo">
                                                        {companyInfo.logo ? (
                                                            <img src={companyInfo.logo} alt="Company Logo" className="grn-company-logo-img" />
                                                        ) : (
                                                            <div className="grn-company-logo-fallback">
                                                                {companyInfo.name ? companyInfo.name.charAt(0).toUpperCase() : 'C'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Name */}
                                                    <div className="grn-company-inline-name">{companyInfo.name || 'Company Name'}</div>
                                                    {/* Details stacked */}
                                                    {companyInfo.address && <div className="grn-company-inline-line">{companyInfo.address}</div>}
                                                    {companyInfo.phone && <div className="grn-company-inline-line">{companyInfo.phone}</div>}
                                                    {companyInfo.email && <div className="grn-company-inline-line">{companyInfo.email}</div>}
                                                    {companyInfo.zip && <div className="grn-company-inline-line">Postal: {companyInfo.zip}</div>}
                                                </div>
                                                <div className="grn-meta-form">
                                                    <div className="grn-input-row">
                                                        <label>Challan No.</label>
                                                        <input
                                                            type="text"
                                                            value={grnMeta.grnNumber}
                                                            onChange={e => setGrnMeta({ ...grnMeta, grnNumber: e.target.value })}
                                                            disabled={isViewMode}
                                                        />
                                                    </div>
                                                    <div className="grn-input-row">
                                                        <label>Manual Ref</label>
                                                        <input type="text" placeholder="e.g. DC-MAN-01" disabled={isViewMode}
                                                            value={grnMeta.manualRef} onChange={e => setGrnMeta({ ...grnMeta, manualRef: e.target.value })} />
                                                    </div>
                                                    <div className="grn-input-row">
                                                        <label>Date</label>
                                                        <input type="date" disabled={isViewMode}
                                                            value={grnMeta.date} onChange={e => setGrnMeta({ ...grnMeta, date: e.target.value })} />
                                                    </div>
                                                    <div className="grn-input-row">
                                                        <label>Vehicle No</label>
                                                        <input type="text" placeholder="MH-12-XX-9999" disabled={isViewMode}
                                                            value={grnMeta.vehicleNo} onChange={e => setGrnMeta({ ...grnMeta, vehicleNo: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Address Card */}
                                            <div className="grn-card grn-grid-2">
                                                <div>
                                                    <div className="grn-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span className="flex items-center gap-1"><User size={14} /> Vendor & Billing Info</span>
                                                        {!isViewMode && !selectedOrder && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowAddVendorModal(true)}
                                                                style={{
                                                                    backgroundColor: '#22c55e',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    padding: '2px 8px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 'bold',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}
                                                            >
                                                                <Plus size={12} /> Add Vendor
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grn-vendor-row-container">
                                                        {selectedOrder ? (
                                                            selectedVendor ? (
                                                                <div className="grn-vendor-single-line">
                                                                    <div><span className="grn-label-strong">Name:</span>{selectedVendor.name}</div>
                                                                    <span className="grn-separator">|</span>
                                                                    <div><span className="grn-label-strong">Address:</span>{selectedVendor.address || selectedVendor.billingAddress || 'N/A'}</div>
                                                                    <span className="grn-separator">|</span>
                                                                    <div><span className="grn-label-strong">Phone:</span>{selectedVendor.phone || 'N/A'}</div>
                                                                    <span className="grn-separator">|</span>
                                                                    <div><span className="grn-label-strong">Email:</span>{selectedVendor.email || 'N/A'}</div>
                                                                </div>
                                                            ) : <div className="text-gray-400 italic">No vendor selected</div>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <select
                                                                    className="grn-table-select"
                                                                    value={vendorId}
                                                                    onChange={(e) => setVendorId(e.target.value)}
                                                                    disabled={isViewMode}
                                                                    style={{ width: '100%', maxWidth: '300px' }}
                                                                >
                                                                    <option value="">Select Vendor...</option>
                                                                    {vendors.map(v => (
                                                                        <option key={v.id} value={v.id}>{v.name}</option>
                                                                    ))}
                                                                </select>
                                                                {selectedVendor && (
                                                                    <div className="grn-vendor-single-line" style={{ marginTop: '8px' }}>
                                                                        <div><span className="grn-label-strong">Address:</span>{selectedVendor.address || selectedVendor.billingAddress || 'N/A'}</div>
                                                                        <span className="grn-separator">|</span>
                                                                        <div><span className="grn-label-strong">Phone:</span>{selectedVendor.phone || 'N/A'}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="grn-section-title"><MapPin size={14} /> Delivery Destination</div>
                                                    <div className="grn-address-box">
                                                        <input type="text" placeholder="Address Line 1" className="grn-address-input" disabled={isViewMode}
                                                            value={destAddress.line1} onChange={e => setDestAddress({ ...destAddress, line1: e.target.value })} />
                                                        <input type="text" placeholder="City / State" className="grn-address-input" disabled={isViewMode}
                                                            value={destAddress.city} onChange={e => setDestAddress({ ...destAddress, city: e.target.value })} />
                                                        <input type="text" placeholder="Zip Code" className="grn-address-input" disabled={isViewMode}
                                                            value={destAddress.zip} onChange={e => setDestAddress({ ...destAddress, zip: e.target.value })} />
                                                        <input type="text" placeholder="Contact Email/Phone" className="grn-address-input" disabled={isViewMode}
                                                            value={destAddress.email} onChange={e => setDestAddress({ ...destAddress, email: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Custom Fields Section */}
                                            {getCustomFieldsForType('goodsreceiptnote').length > 0 && (
                                                <div className="GoodsReceipt-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        Custom Fields
                                                    </h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                                        {getCustomFieldsForType('goodsreceiptnote').map(field => (
                                                            <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', textAlign: 'left' }}>
                                                                    {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                                                                </label>
                                                                {field.type === 'select' ? (
                                                                    <select
                                                                        value={customFieldValues[field.label] || ''}
                                                                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                                                                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', backgroundColor: 'white' }}
                                                                        required={field.required}
                                                                    >
                                                                        <option value="">Select...</option>
                                                                        {(field.options || '').split(',').map(opt => opt.trim()).filter(Boolean).map(opt => (
                                                                            <option key={opt} value={opt}>{opt}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        placeholder={`Enter ${field.label}`}
                                                                        value={customFieldValues[field.label] || ''}
                                                                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                                                                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%' }}
                                                                        required={field.required}
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Items Card */}
                                            <div className="grn-card">
                                                <div className="grn-section-title"><Box size={14} /> Delivery Items</div>
                                                <table className="grn-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '30%', fontSize: '12px' }}>{getTableHeader('item', 'PRODUCT').toUpperCase()}</th>
                                                            {getInvoiceLabel('showWarehouse') !== false && <th style={{ width: '25%', fontSize: '12px' }}>{getTableHeader('warehouse', 'WH / LOCATION').toUpperCase()}</th>}
                                                            {getInvoiceLabel('showQty') !== false && <th style={{ width: '10%', fontSize: '12px' }} className="text-center">{getTableHeader('orderedQty', 'ORDERED').toUpperCase()}</th>}
                                                            {getInvoiceLabel('showQty') !== false && <th style={{ width: '15%', fontSize: '12px' }} className="text-center">{getTableHeader('receivedQty', 'DELIVERY QTY').toUpperCase()}</th>}
                                                            <th style={{ width: '10%', fontSize: '12px' }}>UNIT</th>
                                                            <th style={{ width: '10%', fontSize: '12px' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.map(item => (
                                                            <tr key={item.id}>
                                                                <td>
                                                                    <select className="grn-table-select" disabled={isViewMode}
                                                                        value={item.productId || ''} onChange={e => updateItem(item.id, 'productId', e.target.value)}>
                                                                        <option value="">Select Product...</option>
                                                                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.totalQuantity ?? 0})</option>)}
                                                                    </select>
                                                                </td>
                                                                {getInvoiceLabel('showWarehouse') !== false && (
                                                                    <td>
                                                                        <select className="grn-table-select" disabled={isViewMode}
                                                                            value={item.warehouseId || ''} onChange={e => updateItem(item.id, 'warehouseId', e.target.value)}>
                                                                            <option value="">Select Warehouse...</option>
                                                                            {warehouses.map(w => {
                                                                                const prod = products.find(p => p.id === parseInt(item.productId));
                                                                                const stockItem = prod?.stock?.find(s => Number(s.warehouseId) === Number(w.id));
                                                                                const count = stockItem ? stockItem.quantity : 0;
                                                                                return <option key={w.id} value={w.id}>{w.name} ({count})</option>;
                                                                            })}
                                                                        </select>
                                                                    </td>
                                                                )}
                                                                {getInvoiceLabel('showQty') !== false && (
                                                                    <td>
                                                                        <input type="text" className="grn-table-input readonly" value={item.orderedQty} disabled />
                                                                    </td>
                                                                )}
                                                                {getInvoiceLabel('showQty') !== false && (
                                                                    <td>
                                                                        <input type="number" className="grn-table-input qty-highlight" disabled={isViewMode}
                                                                            min="0"
                                                                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                            value={item.receivedQty} onChange={e => updateItem(item.id, 'receivedQty', e.target.value.replace(/-/g, ''))} />
                                                                    </td>
                                                                )}
                                                                <td>
                                                                    <span className="text-sm text-gray-600 pl-2">
                                                                        {(() => {
                                                                            const prod = products.find(p => p.id === Number(item.productId));
                                                                            return prod?.uom?.unitName || prod?.purchaseUom?.unitName || prod?.unit || item.unit || 'pcs';
                                                                        })()}
                                                                    </span>
                                                                </td>
                                                                <td className="text-center">
                                                                    <button className="text-red-400 hover:text-red-600" onClick={() => {
                                                                        setItems(items.filter(i => i.id !== item.id));
                                                                    }}>
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {items.length === 0 && (
                                                            <tr><td colSpan={getInvoiceLabel('showWarehouse') === false ? (getInvoiceLabel('showQty') === false ? 3 : 5) : (getInvoiceLabel('showQty') === false ? 4 : 6)} className="text-center py-4 text-gray-400">No items added.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                                    <button className="text-sm font-semibold text-green-600 flex items-center hover:text-green-700"
                                                        onClick={addItem}>
                                                        <Plus size={16} className="mr-1" /> Add Additional Item
                                                    </button>
                                                    {!isViewMode && (
                                                        <button
                                                            type="button"
                                                            className="text-sm font-semibold text-green-600 flex items-center hover:text-green-700"
                                                            onClick={() => {
                                                                setProductWarehouseRows(warehouses.map(wh => ({
                                                                    id: wh.id,
                                                                    warehouseId: wh.id,
                                                                    quantity: 0,
                                                                    minOrderQty: 0,
                                                                    initialQty: 0
                                                                })));
                                                                setShowAddProductModal(true);
                                                            }}
                                                            style={{ color: '#22c55e' }}
                                                        >
                                                            <Plus size={16} className="mr-1" /> Add Product
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Footer Notes */}
                                            <div className="grn-grid-2">
                                                <div className="grn-card">
                                                    <div className="grn-section-title">
                                                        <Truck size={18} className="text-green-600" />
                                                        <span>TRANSPORT / LOGISTICS NOTE</span>
                                                    </div>
                                                    <textarea className="grn-textarea" placeholder="Driver contact, Courier name, Airway bill no..." disabled={isViewMode}
                                                        value={notes.logistics} onChange={e => setNotes({ ...notes, logistics: e.target.value })}></textarea>
                                                </div>
                                                <div className="grn-card">
                                                    <div className="grn-section-title">
                                                        <FileText size={18} className="text-green-600" />
                                                        <span>DELIVERY REMARKS</span>
                                                    </div>
                                                    <textarea className="grn-textarea" placeholder="Add any specific instructions or remarks..." disabled={isViewMode}
                                                        value={notes.remarks} onChange={e => setNotes({ ...notes, remarks: e.target.value })}></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="grn-modal-footer">
                            <button className="grn-btn-cancel" onClick={() => setShowAddModal(false)}>
                                {isViewMode ? 'Close' : 'Cancel'}
                            </button>
                            {isViewMode && (
                                <>
                                    {grns.find(g => g.id === editingId)?.status !== 'Converted' ? (
                                        <button className="grn-btn-primary-green" onClick={() => handleConvert(editingId)} style={{ backgroundColor: '#4f46e5' }}>
                                            <Receipt size={18} className="mr-2" /> Convert to Purchase Bill
                                        </button>
                                    ) : (
                                        <span className="text-sm font-semibold px-3 py-2 bg-gray-100 text-gray-500 rounded mr-2">Already Converted</span>
                                    )}
                                    <button className="grn-btn-primary-green" onClick={handlePrint}>
                                        <Printer size={18} className="mr-2" /> Print Receipt
                                    </button>
                                </>
                            )}
                            {step === 2 && !isViewMode && (
                                <button className="grn-btn-primary-green" onClick={handleSave}>
                                    Confirm Delivery
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Unique Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="GRN-unique-delete-overlay">
                    <div className="GRN-unique-delete-modal">
                        <div className="GRN-unique-delete-header">
                            <h2 className="GRN-unique-delete-title">Delete GRN?</h2>
                            <button className="GRN-unique-delete-close" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="GRN-unique-delete-body">
                            <p className="GRN-unique-delete-message">
                                Are you sure you want to delete this Goods Receipt record? This action cannot be undone and will permanently remove it from the system.
                            </p>
                        </div>
                        <div className="GRN-unique-delete-footer">
                            <button className="GRN-unique-delete-btn GRN-unique-delete-cancel" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="GRN-unique-delete-btn GRN-unique-delete-confirm" onClick={confirmDelete}>
                                <Trash2 size={18} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Add New Vendor Modal */}
            {showAddVendorModal && (
                <div className="Vendors-modal-overlay" style={{ zIndex: 20000 }}>
                    <div className="Vendors-modal-content Vendors-modal-large" style={{ textAlign: 'left' }}>
                        <div className="Vendors-modal-header">
                            <h2 className="Vendors-modal-title">Add Vendor</h2>
                            <button className="Vendors-close-btn" onClick={() => setShowAddVendorModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleFullVendorSubmit}>
                            <div className="Vendors-modal-body">
                                {/* Basic Information */}
                                <div className="Vendors-form-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                                    <h3 className="Vendors-section-subtitle">Basic Information</h3>
                                    <div className="Vendors-form-row Vendors-mixed-col">
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Name (English) <span className="Vendors-text-red">*</span></label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="name"
                                                value={vendorFormData.name}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter Name"
                                                required
                                            />
                                        </div>
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Name (Arabic)</label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="nameArabic"
                                                value={vendorFormData.nameArabic}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter Name (Arabic)"
                                            />
                                        </div>
                                    </div>

                                    <div className="Vendors-form-row Vendors-mixed-col">
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Company Name</label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="companyName"
                                                value={vendorFormData.companyName}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter company name"
                                            />
                                        </div>
                                        <div className="Vendors-form-group Vendors-google-loc">
                                            <label className="Vendors-form-label">Company Google Location</label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="companyLocation"
                                                value={vendorFormData.companyLocation}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter Google Maps link"
                                            />
                                        </div>
                                    </div>

                                    {/* File Uploads */}
                                    <div className="Vendors-form-row Vendors-mixed-col">
                                        <div className="Vendors-form-group Vendors-profile-img">
                                            <label className="Vendors-form-label">Profile Image</label>
                                            {vendorFormData.profileImage ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                    <img
                                                        src={vendorFormData.profileImage}
                                                        alt="Profile"
                                                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => { setVendorFormData(prev => ({ ...prev, profileImage: '' })); }}
                                                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        x Remove
                                                    </button>
                                                </div>
                                            ) : null}
                                            {!vendorFormData.profileImage && (
                                                <>
                                                    <input
                                                        type="file"
                                                        ref={profileImageRef}
                                                        accept="image/jpeg,image/png,image/jpg"
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => handleVendorFileUpload(e.target.files[0], 'profileImage', 'vendors')}
                                                    />
                                                    <div className="Vendors-file-input-wrapper" onClick={() => profileImageRef.current?.click()} style={{ cursor: 'pointer' }}>
                                                        <div className="Vendors-file-label">
                                                            <span className="Vendors-file-btn">{uploadingProfileImage ? 'Uploading...' : 'Choose File'}</span>
                                                            <span className="Vendors-file-name">{vendorFormData.profileImage ? 'Image uploaded ✓' : 'No file chosen'}</span>
                                                        </div>
                                                    </div>
                                                    <span className="Vendors-file-note">JPEG, PNG or JPG (max 5MB)</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="Vendors-form-group Vendors-any-file">
                                            <label className="Vendors-form-label">Any File</label>
                                            {vendorFormData.anyFile ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                                    <a
                                                        href={vendorFormData.anyFile}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline', wordBreak: 'break-all', maxWidth: '200px' }}
                                                    >
                                                        View File
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => setVendorFormData(prev => ({ ...prev, anyFile: '' }))}
                                                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        x Remove
                                                    </button>
                                                </div>
                                            ) : null}
                                            {!vendorFormData.anyFile && (
                                                <>
                                                    <input
                                                        type="file"
                                                        ref={anyFileRef}
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => handleVendorFileUpload(e.target.files[0], 'anyFile', 'vendors')}
                                                    />
                                                    <div className="Vendors-file-input-wrapper" onClick={() => anyFileRef.current?.click()} style={{ cursor: 'pointer' }}>
                                                        <div className="Vendors-file-label">
                                                            <span className="Vendors-file-btn">{uploadingAnyFile ? 'Uploading...' : 'Choose File'}</span>
                                                            <span className="Vendors-file-name">{vendorFormData.anyFile ? 'File uploaded ✓' : 'No file chosen'}</span>
                                                        </div>
                                                    </div>
                                                    <span className="Vendors-file-note">Any file type. Max 10MB</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Account Information */}
                                <div className="Vendors-form-section">
                                    <h3 className="Vendors-section-subtitle">Account Information</h3>
                                    <div className="Vendors-form-row Vendors-mixed-col">
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Account Type <span className="Vendors-text-red">*</span></label>
                                            <select
                                                className="Vendors-form-select"
                                                name="accountType"
                                                value={vendorFormData.accountType}
                                                onChange={handleVendorInputChange}
                                            >
                                                {accountTypes
                                                    .flatMap(group => group.accounts)
                                                    .filter(acc => acc.accountTypeName === 'Accounts Payable')
                                                    .map((acc, j) => (
                                                        <option key={j} value={acc.accountTypeId}>{acc.accountTypeName}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Balance Type</label>
                                            <select
                                                className="Vendors-form-select"
                                                name="balanceType"
                                                value={vendorFormData.balanceType}
                                                onChange={handleVendorInputChange}
                                            >
                                                <option value="Credit">Credit</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="Vendors-form-row Vendors-mixed-col">
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <div className="Vendors-input-with-note">
                                                <label className="Vendors-form-label">Account Name <span className="Vendors-text-red">*</span></label>
                                                <input
                                                    type="text"
                                                    className="Vendors-form-input"
                                                    value={vendorFormData.name}
                                                    readOnly
                                                    disabled
                                                    style={{ backgroundColor: '#f3f4f6' }}
                                                />
                                                <span className="Vendors-input-note">This will auto-fill from selection above</span>
                                            </div>
                                        </div>
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Account Balance <span className="Vendors-text-red">*</span></label>
                                            <input
                                                type="number"
                                                className="Vendors-form-input"
                                                name="accountBalance"
                                                value={vendorFormData.accountBalance}
                                                onChange={handleVendorInputChange}
                                                placeholder="0.00"
                                                min="0"
                                                onKeyDown={(e) => {
                                                    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                                                        e.preventDefault();
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Creation Date <span className="Vendors-text-red">*</span></label>
                                            <input
                                                type="date"
                                                className="Vendors-form-input"
                                                name="creationDate"
                                                value={vendorFormData.creationDate}
                                                onChange={handleVendorInputChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Details */}
                                <div className="Vendors-form-section">
                                    <h3 className="Vendors-section-subtitle">Bank Details</h3>
                                    <div className="Vendors-form-row Vendors-three-col">
                                        <div className="Vendors-form-group">
                                            <label className="Vendors-form-label">Bank Account Number</label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="bankAccountNumber"
                                                value={vendorFormData.bankAccountNumber}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter bank account number"
                                            />
                                        </div>
                                        <div className="Vendors-form-group">
                                            <label className="Vendors-form-label">Bank IFSC</label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="bankIFSC"
                                                value={vendorFormData.bankIFSC}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter bank IFSC"
                                            />
                                        </div>
                                        <div className="Vendors-form-group">
                                            <label className="Vendors-form-label">Bank Name & Branch</label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="bankNameBranch"
                                                value={vendorFormData.bankNameBranch}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter bank name & branch"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Contact & GST */}
                                <div className="Vendors-form-section">
                                    <h3 className="Vendors-section-subtitle">Contact & Status</h3>
                                    <div className="Vendors-form-row Vendors-mixed-col">
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Phone <span className="Vendors-text-red">*</span></label>
                                            <input
                                                type="text"
                                                className="Vendors-form-input"
                                                name="phone"
                                                value={vendorFormData.phone}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter Phone"
                                            />
                                        </div>
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Email <span className="Vendors-text-red">*</span></label>
                                            <input
                                                type="email"
                                                className="Vendors-form-input"
                                                name="email"
                                                value={vendorFormData.email}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter Email"
                                            />
                                        </div>
                                        <div className="Vendors-form-group Vendors-half-width">
                                            <label className="Vendors-form-label">Credit Period (days)</label>
                                            <input
                                                type="number"
                                                className="Vendors-form-input"
                                                name="creditPeriod"
                                                value={vendorFormData.creditPeriod}
                                                onChange={handleVendorInputChange}
                                                placeholder="Enter credit period"
                                            />
                                        </div>
                                    </div>

                                    <div className="Vendors-form-row" style={{ alignItems: 'center' }}>
                                        <label className="Vendors-switch" style={{ marginRight: '10px' }}>
                                            <input
                                                type="checkbox"
                                                name="gstEnabled"
                                                checked={vendorFormData.gstEnabled}
                                                onChange={handleVendorInputChange}
                                            />
                                            <span className="Vendors-slider Vendors-round"></span>
                                        </label>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable GST</span>

                                        {vendorFormData.gstEnabled && (
                                            <div className="Vendors-form-group" style={{ marginLeft: '2rem', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    className="Vendors-form-input"
                                                    name="gstNumber"
                                                    value={vendorFormData.gstNumber}
                                                    onChange={handleVendorInputChange}
                                                    placeholder="Enter GSTIN"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Addresses */}
                                <div className="Vendors-form-section">
                                    <div className="Vendors-form-row">
                                        {/* Billing Address */}
                                        <div style={{ flex: 1 }}>
                                            <h3 className="Vendors-section-subtitle">Billing Address</h3>
                                            <div className="Vendors-form-group">
                                                <label className="Vendors-form-label">Name</label>
                                                <input
                                                    type="text"
                                                    className="Vendors-form-input"
                                                    name="billingName"
                                                    value={vendorFormData.billingName}
                                                    onChange={handleVendorInputChange}
                                                    placeholder="Enter Name"
                                                />
                                            </div>
                                            <div className="Vendors-form-group">
                                                <label className="Vendors-form-label">Phone</label>
                                                <input
                                                    type="text"
                                                    className="Vendors-form-input"
                                                    name="billingPhone"
                                                    value={vendorFormData.billingPhone}
                                                    onChange={handleVendorInputChange}
                                                    placeholder="Enter Phone"
                                                />
                                            </div>
                                            <div className="Vendors-form-group">
                                                <label className="Vendors-form-label">Address</label>
                                                <textarea
                                                    className="Vendors-form-textarea"
                                                    name="billingAddress"
                                                    value={vendorFormData.billingAddress}
                                                    onChange={handleVendorInputChange}
                                                    placeholder="Enter Address"
                                                    rows="3"
                                                />
                                            </div>
                                            <div className="Vendors-form-row">
                                                <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        className="Vendors-form-input"
                                                        name="billingCity"
                                                        value={vendorFormData.billingCity}
                                                        onChange={handleVendorInputChange}
                                                        placeholder="City"
                                                    />
                                                </div>
                                                <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        className="Vendors-form-input"
                                                        name="billingState"
                                                        value={vendorFormData.billingState}
                                                        onChange={handleVendorInputChange}
                                                        placeholder="State"
                                                    />
                                                </div>
                                            </div>
                                            <div className="Vendors-form-row">
                                                <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        className="Vendors-form-input"
                                                        name="billingCountry"
                                                        value={vendorFormData.billingCountry}
                                                        onChange={handleVendorInputChange}
                                                        placeholder="Country"
                                                    />
                                                </div>
                                                <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        className="Vendors-form-input"
                                                        name="billingZipCode"
                                                        value={vendorFormData.billingZipCode}
                                                        onChange={handleVendorInputChange}
                                                        placeholder="Zip Code"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Shipping Address */}
                                        <div style={{ flex: 1, paddingLeft: '2rem', borderLeft: '1px solid #edf2f7' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <h3 className="Vendors-section-subtitle">Shipping Addresses</h3>
                                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
                                                        <input
                                                            type="checkbox"
                                                            name="shippingSameAsBilling"
                                                            checked={vendorFormData.shippingSameAsBilling}
                                                            onChange={handleVendorInputChange}
                                                            style={{ marginRight: '5px' }}
                                                        />
                                                        Apply Billing to First Shipping
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="Vendors-voucher-badge text-blue-600 border border-blue-600 bg-white hover:bg-blue-50"
                                                        onClick={addVendorShippingAddress}
                                                        style={{ padding: '2px 8px', fontSize: '0.8rem', cursor: 'pointer' }}
                                                    >
                                                        + Add More
                                                    </button>
                                                </div>
                                            </div>

                                            {vendorFormData.shippingSameAsBilling && (
                                                <div style={{ marginBottom: '1.5rem', padding: '15px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
                                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0369a1' }}>First Shipping Address (Same as Billing)</h4>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#0c4a6e' }}>
                                                        <strong>Address:</strong> {vendorFormData.billingAddress || 'N/A'}<br />
                                                        {vendorFormData.billingCity && `${vendorFormData.billingCity}, `}{vendorFormData.billingState && `${vendorFormData.billingState}, `}{vendorFormData.billingZipCode}
                                                    </p>
                                                </div>
                                            )}

                                            {vendorFormData.shippingAddresses.length === 0 && !vendorFormData.shippingSameAsBilling && (
                                                <div className="Vendors-form-group" style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#64748b' }}>
                                                        No shipping addresses added.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={addVendorShippingAddress}
                                                        className="Vendors-voucher-badge text-blue-600"
                                                    >
                                                        Click here to add one
                                                    </button>
                                                </div>
                                            )}

                                            {vendorFormData.shippingAddresses.map((addr, index) => (
                                                <div key={index} style={{ marginBottom: '1.5rem', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', position: 'relative' }}>
                                                    {vendorFormData.shippingAddresses.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeVendorShippingAddress(index)}
                                                            style={{ position: 'absolute', top: '10px', right: '10px', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#475569' }}>Shipping Address #{index + 1}</h4>

                                                    <div className="Vendors-form-group">
                                                        <label className="Vendors-form-label">Name</label>
                                                        <input
                                                            type="text"
                                                            className="Vendors-form-input"
                                                            value={addr.name}
                                                            onChange={(e) => handleVendorShippingAddressChange(index, 'name', e.target.value)}
                                                            placeholder="Enter Name"
                                                        />
                                                    </div>
                                                    <div className="Vendors-form-group">
                                                        <label className="Vendors-form-label">Phone</label>
                                                        <input
                                                            type="text"
                                                            className="Vendors-form-input"
                                                            value={addr.phone}
                                                            onChange={(e) => handleVendorShippingAddressChange(index, 'phone', e.target.value)}
                                                            placeholder="Enter Phone"
                                                        />
                                                    </div>
                                                    <div className="Vendors-form-group">
                                                        <label className="Vendors-form-label">Address</label>
                                                        <textarea
                                                            className="Vendors-form-textarea"
                                                            value={addr.address}
                                                            onChange={(e) => handleVendorShippingAddressChange(index, 'address', e.target.value)}
                                                            placeholder="Enter Address"
                                                            rows="2"
                                                        />
                                                    </div>
                                                    <div className="Vendors-form-row">
                                                        <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                            <input
                                                                type="text"
                                                                className="Vendors-form-input"
                                                                value={addr.city}
                                                                onChange={(e) => handleVendorShippingAddressChange(index, 'city', e.target.value)}
                                                                placeholder="City"
                                                            />
                                                        </div>
                                                        <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                            <input
                                                                type="text"
                                                                className="Vendors-form-input"
                                                                value={addr.state}
                                                                onChange={(e) => handleVendorShippingAddressChange(index, 'state', e.target.value)}
                                                                placeholder="State"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="Vendors-form-row">
                                                        <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                            <input
                                                                type="text"
                                                                className="Vendors-form-input"
                                                                value={addr.country}
                                                                onChange={(e) => handleVendorShippingAddressChange(index, 'country', e.target.value)}
                                                                placeholder="Country"
                                                            />
                                                        </div>
                                                        <div className="Vendors-form-group" style={{ flex: 1 }}>
                                                            <input
                                                                type="text"
                                                                className="Vendors-form-input"
                                                                value={addr.zipCode}
                                                                onChange={(e) => handleVendorShippingAddressChange(index, 'zipCode', e.target.value)}
                                                                placeholder="Zip Code"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="Vendors-modal-footer">
                                <button type="button" className="Vendors-btn-cancel" onClick={() => setShowAddVendorModal(false)}>Cancel</button>
                                <button type="submit" className="Vendors-btn-submit" disabled={uploadingAnyFile || uploadingProfileImage}>Save Vendor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add New Product Modal */}
            {showAddProductModal && (
                <div className="Zirak-Inventory-modal-overlay" style={{ zIndex: 20000 }}>
                    <div className="Zirak-Inventory-modal-content Zirak-Inventory-modal" style={{ textAlign: 'left' }}>
                        <div className="Zirak-Inventory-modal-header">
                            <h2 className="Zirak-Inventory-modal-title">Add Product</h2>
                            <button className="Zirak-Inventory-close-btn" onClick={() => setShowAddProductModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFullProductSubmit}>
                            <div className="Zirak-Inventory-modal-body">
                                <div className="Zirak-Inventory-form-grid">
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Item Name *</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="name"
                                            placeholder="Enter item name"
                                            value={productFormData.name}
                                            onChange={handleProductInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">HSN</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="hsn"
                                            placeholder="Enter HSN code"
                                            value={productFormData.hsn}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Barcode</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="barcode"
                                            placeholder="Enter barcode"
                                            value={productFormData.barcode}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Item Image</label>
                                        <div className="Zirak-Inventory-file-input-wrapper">
                                            <label className="Zirak-Inventory-file-input-label">
                                                {uploadingImage ? (
                                                    <>
                                                        <Loader2 size={16} className="Zirak-Inventory-animate-spin" style={{ display: 'inline-block', marginRight: '6px' }} />
                                                        <span>Uploading...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload size={16} style={{ display: 'inline-block', marginRight: '6px' }} />
                                                        <span>Choose File</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    className="Zirak-Inventory-hidden-file-input"
                                                    onChange={handleProductImageChange}
                                                    accept="image/*"
                                                    disabled={uploadingImage}
                                                />
                                            </label>
                                            <span className="Zirak-Inventory-file-name">
                                                {productFormData.image ? (
                                                    <a href={productFormData.image} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                                                        View Image
                                                    </a>
                                                ) : 'No file chosen'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Item Category (Optional)</label>
                                        <div className="Zirak-Inventory-input-with-action">
                                            <select
                                                name="categoryId" className="Zirak-Inventory-form-input"
                                                value={productFormData.categoryId} onChange={handleProductInputChange}
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                            <button type="button" className="Zirak-Inventory-btn-inline-add" onClick={() => setShowCategoryModal(true)}><Plus size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Base Unit (Tracking Unit)*</label>
                                        <div className="Zirak-Inventory-input-with-action">
                                            <select
                                                name="uomId" className="Zirak-Inventory-form-input"
                                                value={productFormData.uomId} onChange={(e) => {
                                                    const val = e.target.value;
                                                    setProductFormData(prev => ({
                                                        ...prev,
                                                        uomId: val,
                                                        purchaseUomId: val,
                                                        salesUomId: val
                                                    }));
                                                }}
                                                required
                                            >
                                                <option value="">Select Base UOM</option>
                                                {allUoms.filter(u => u.uomType === 'Simple').map(uom => (
                                                    <option key={uom.id} value={uom.id}>{uom.unitName} ({uom.category})</option>
                                                ))}
                                            </select>
                                            <button type="button" className="Zirak-Inventory-btn-inline-add" onClick={() => setShowUomModal(true)}>
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Default Purchase Unit</label>
                                        <select
                                            name="purchaseUomId" className="Zirak-Inventory-form-input"
                                            value={productFormData.purchaseUomId} onChange={handleProductInputChange}
                                            disabled={!productFormData.uomId}
                                        >
                                            <option value="">Select Purchase UOM</option>
                                            {productFormData.uomId && (() => {
                                                const base = allUoms.find(u => u.id === parseInt(productFormData.uomId));
                                                if (!base) return null;
                                                return allUoms.filter(u => u.category === base.category).map(uom => (
                                                    <option key={uom.id} value={uom.id}>{uom.unitName} ({uom.uomType})</option>
                                                ));
                                            })()}
                                        </select>
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Default Sales Unit</label>
                                        <select
                                            name="salesUomId" className="Zirak-Inventory-form-input"
                                            value={productFormData.salesUomId} onChange={handleProductInputChange}
                                            disabled={!productFormData.uomId}
                                        >
                                            <option value="">Select Sales UOM</option>
                                            {productFormData.uomId && (() => {
                                                const base = allUoms.find(u => u.id === parseInt(productFormData.uomId));
                                                if (!base) return null;
                                                return allUoms.filter(u => u.category === base.category).map(uom => (
                                                    <option key={uom.id} value={uom.id}>{uom.unitName} ({uom.uomType})</option>
                                                ));
                                            })()}
                                        </select>
                                    </div>

                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">SKU *</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="sku"
                                            placeholder="Enter SKU"
                                            value={productFormData.sku}
                                            onChange={handleProductInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="Zirak-Inventory-section-title-row">
                                    <h3 className="Zirak-Inventory-section-title">Warehouse Information</h3>
                                    <button type="button" className="Zirak-Inventory-btn-inline-add" onClick={addProductWarehouseRow}>+ Add Warehouse</button>
                                </div>

                                <div className="Zirak-Inventory-warehouse-table-container">
                                    <table className="Zirak-Inventory-warehouse-input-table">
                                        <thead>
                                            <tr>
                                                <th>WAREHOUSE</th>
                                                <th>QUANTITY</th>
                                                <th>MINIMUM ORDER QUANTITY</th>
                                                <th>INITIAL QUANTITY ON HAND</th>
                                                <th>ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productWarehouseRows.map((row) => (
                                                <tr key={row.id}>
                                                    <td>
                                                        <select
                                                            className="Zirak-Inventory-form-input Zirak-Inventory-mini"
                                                            value={row.warehouseId}
                                                            onChange={(e) => handleProductWhRowChange(row.id, 'warehouseId', e.target.value)}
                                                        >
                                                            <option value="">Select Warehouse</option>
                                                            {warehouses.map(wh => (
                                                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td><input type="number" className="Zirak-Inventory-form-input Zirak-Inventory-mini" value={row.quantity} onChange={(e) => handleProductWhRowChange(row.id, 'quantity', e.target.value)} /></td>
                                                    <td><input type="number" className="Zirak-Inventory-form-input Zirak-Inventory-mini" value={row.minOrderQty} onChange={(e) => handleProductWhRowChange(row.id, 'minOrderQty', e.target.value)} /></td>
                                                    <td><input type="number" className="Zirak-Inventory-form-input Zirak-Inventory-mini" value={row.initialQty} onChange={(e) => handleProductWhRowChange(row.id, 'initialQty', e.target.value)} /></td>
                                                    <td>
                                                        <button type="button" className="Zirak-Inventory-btn-remove" onClick={() => removeProductWarehouseRow(row.id)}>Remove</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="Zirak-Inventory-form-group Zirak-Inventory-full-width" style={{ marginTop: '1rem' }}>
                                    <label className="Zirak-Inventory-form-label">Item Description</label>
                                    <textarea
                                        name="description" className="Zirak-Inventory-form-input Zirak-Inventory-textarea"
                                        placeholder="Enter item description" rows={3}
                                        value={productFormData.description} onChange={handleProductInputChange}
                                    ></textarea>
                                </div>

                                <div className="Zirak-Inventory-form-grid" style={{ marginTop: '15px' }}>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">As of Date</label>
                                        <input
                                            type="date"
                                            className="Zirak-Inventory-form-input"
                                            name="asOfDate"
                                            value={productFormData.asOfDate}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Tax Account</label>
                                        <input
                                            type="text"
                                            className="Zirak-Inventory-form-input"
                                            name="taxAccount"
                                            placeholder="e.g. GST 18%"
                                            value={productFormData.taxAccount}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Initial Cost Price</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="initialCost"
                                            step="0.01"
                                            value={productFormData.initialCost}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Sale Price</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="salePrice"
                                            step="0.01"
                                            value={productFormData.salePrice}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Purchase Price</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="purchasePrice"
                                            step="0.01"
                                            value={productFormData.purchasePrice}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                    <div className="Zirak-Inventory-form-group">
                                        <label className="Zirak-Inventory-form-label">Discount (%)</label>
                                        <input
                                            type="number"
                                            className="Zirak-Inventory-form-input"
                                            name="discount"
                                            value={productFormData.discount}
                                            onChange={handleProductInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="Zirak-Inventory-form-group" style={{ marginTop: '15px' }}>
                                    <label className="Zirak-Inventory-form-label">Remarks</label>
                                    <textarea
                                        className="Zirak-Inventory-form-textarea"
                                        name="remarks"
                                        placeholder="Enter remarks"
                                        value={productFormData.remarks}
                                        onChange={handleProductInputChange}
                                        rows="2"
                                    />
                                </div>


                            </div>
                            <div className="Zirak-Inventory-modal-footer">
                                <button type="button" className="Zirak-Inventory-btn-cancel" onClick={() => setShowAddProductModal(false)}>Cancel</button>
                                <button type="submit" className="Zirak-Inventory-btn-submit" disabled={uploadingImage}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add New Category Modal */}
            {showCategoryModal && (
                <div className="Zirak-Inventory-modal-overlay Zirak-Inventory-sub-modal" style={{ zIndex: 100000 }}>
                    <div className="Zirak-Inventory-modal-content Zirak-Inventory-category-modal" style={{ textAlign: 'left' }}>
                        <div className="Zirak-Inventory-modal-header">
                            <h2 className="Zirak-Inventory-modal-title">Add New Category</h2>
                            <button className="Zirak-Inventory-close-btn" onClick={() => setShowCategoryModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="Zirak-Inventory-modal-body">
                            <div className="Zirak-Inventory-form-group">
                                <label className="Zirak-Inventory-form-label">Category Name</label>
                                <input
                                    type="text"
                                    className="Zirak-Inventory-form-input"
                                    placeholder="Enter new category name"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="Zirak-Inventory-modal-footer">
                            <button className="Zirak-Inventory-btn-cancel" onClick={() => setShowCategoryModal(false)}>Cancel</button>
                            <button className="Zirak-Inventory-btn-submit" onClick={handleProductAddCategorySubmit}>Add</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New UOM Modal */}
            {showUomModal && (
                <div className="Zirak-UOM-modal-overlay" style={{ zIndex: 100000 }}>
                    <div className="Zirak-UOM-modal" style={{ textAlign: 'left' }}>
                        <div className="Zirak-UOM-modal-header">
                            <h2>Unit Details</h2>
                            <button className="Zirak-UOM-close-btn" onClick={() => setShowUomModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUomSubmit}>
                            <div className="Zirak-UOM-modal-body">
                                <div className="Zirak-UOM-form-group">
                                    <label>Measurement Category*</label>
                                    <input
                                        list="category-suggestions"
                                        name="category"
                                        placeholder="Select or type category"
                                        value={uomFormData.category}
                                        onChange={handleUomInputChange}
                                        required
                                        className="Zirak-UOM-form-input"
                                    />
                                    <datalist id="category-suggestions">
                                        {measurementCategories.map(cat => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="Zirak-UOM-form-group">
                                    <label>UOM Type*</label>
                                    <select
                                        name="uomType"
                                        value={uomFormData.uomType}
                                        onChange={handleUomInputChange}
                                        required
                                        className="Zirak-UOM-form-select"
                                    >
                                        <option value="Simple">Simple (Single Standalone Unit)</option>
                                        <option value="Compound">Compound (Pack of Simple Unit)</option>
                                    </select>
                                </div>
                                <div className="Zirak-UOM-form-group">
                                    <label>Unit of Measurement (UOM)*</label>
                                    <div className="Zirak-UOM-input-with-button">
                                        <input
                                            list="unit-suggestions"
                                            name="unitName"
                                            placeholder="Select or type UOM"
                                            value={uomFormData.unitName}
                                            onChange={handleUomInputChange}
                                            required
                                            className="Zirak-UOM-form-input"
                                        />
                                        <datalist id="unit-suggestions">
                                            {uomFormData.category && unitsByCategory[uomFormData.category] && unitsByCategory[uomFormData.category].map(unit => (
                                                <option key={unit} value={unit} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                                {uomFormData.uomType === 'Compound' && (
                                    <>
                                        <div className="Zirak-UOM-form-group">
                                            <label>Base Unit* (Simple Unit to convert to)</label>
                                            <select
                                                name="baseUnitId"
                                                value={uomFormData.baseUnitId}
                                                onChange={handleUomInputChange}
                                                required
                                                className="Zirak-UOM-form-select"
                                            >
                                                <option value="">-- Select Base Unit --</option>
                                                {getUniqueCategories().map(cat => {
                                                    const unitsInCat = getAvailableBaseUnitsForCategory(cat);
                                                    if (unitsInCat.length === 0) return null;
                                                    return (
                                                        <optgroup key={cat} label={cat}>
                                                            {unitsInCat.map(u => (
                                                                <option key={u.id} value={u.id}>
                                                                    {u.unitName} {u.isStandard ? ' - Standard' : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div className="Zirak-UOM-form-group">
                                            <label>Conversion Rate* (Multiplier)</label>
                                            <div className="UOM-compound-formula-preview">
                                                <span>1 {uomFormData.unitName || 'Compound Unit'} = </span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    name="conversionRate"
                                                    placeholder="Multiplier e.g. 24"
                                                    value={uomFormData.conversionRate}
                                                    onChange={handleUomInputChange}
                                                    required
                                                    min="0.0001"
                                                    style={{ width: '100px', display: 'inline-block', margin: '0 8px', padding: '6px' }}
                                                />
                                                <span> {
                                                    isNaN(uomFormData.baseUnitId)
                                                        ? uomFormData.baseUnitId
                                                        : (allUoms.find(u => u.id === parseInt(uomFormData.baseUnitId))?.unitName || 'Base Unit')
                                                }</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="Zirak-UOM-modal-footer">
                                <button type="button" className="Zirak-UOM-footer-close-btn" onClick={() => setShowUomModal(false)}>Close</button>
                                <button type="submit" className="Zirak-UOM-save-btn">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoodsReceipt;
