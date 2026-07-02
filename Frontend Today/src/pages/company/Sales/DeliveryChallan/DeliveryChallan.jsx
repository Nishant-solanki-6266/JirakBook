import React, { useState, useRef, useEffect } from 'react';
import { getStatusStyle } from '../../../../utils/statusStyle';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import {
    Search, Plus, Pencil, Trash2, X, ChevronDown, Eye,
    FileText, ShoppingCart, Truck, Receipt, CreditCard,
    CheckCircle2, Clock, ArrowRight, Download, Send, Printer,
    PackageCheck, Container, User, MapPin
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import toast from 'react-hot-toast';
import './DeliveryChallan.css';
import '../Invoice/Invoice.css';
import deliveryChallanService from '../../../../api/deliveryChallanService';
import salesOrderService from '../../../../api/salesOrderService';
import customerService from '../../../../api/customerService';
import productService from '../../../../api/productService';
import warehouseService from '../../../../api/warehouseService';
import companyService from '../../../../api/companyService';
import GetCompanyId from '../../../../api/GetCompanyId';
import { CompanyContext } from '../../../../context/CompanyContext';
import '../../Customers/Customers.css';
import '../../Inventory/ProductInventory/Inventory.css';
import '../../Inventory/UOM/UOM.css';
import customerServiceFromServices from '../../../../services/customerService';
import productServiceFromServices from '../../../../services/productService';
import categoryService from '../../../../services/categoryService';
import uomService from '../../../../services/uomService';
import { uploadToCloudinary } from '../../../../utils/cloudinaryUpload';
import { Upload, Loader2 } from 'lucide-react';

const DeliveryChallan = () => {
    const { hasPermission } = useContext(AuthContext);
    const { formatCurrency, getTableHeader, getInvoiceLabel, companySettings, getDocumentTitle } = useContext(CompanyContext);
    const [deliveryChallans, setDeliveryChallans] = useState([]);
    const [selectedChallanIds, setSelectedChallanIds] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [allWarehouses, setAllWarehouses] = useState([]);
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

    const [showAddModal, setShowAddModal] = useState(false);

    // Inline Modals States
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [customerFormData, setCustomerFormData] = useState({
        name: '', email: '', phone: '', company: '', gstin: '',
        billingAddress: '', billingCity: '', billingState: '', billingZip: '', billingCountry: '',
        shippingAddress: '', shippingCity: '', shippingState: '', shippingZip: '', shippingCountry: '',
        accountBalance: '', notes: '', profileImage: ''
    });
    const [uploadingAnyFile, setUploadingAnyFile] = useState(false);
    const profileImageRef = useRef();

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
    const [creationMode, setCreationMode] = useState('linked'); // 'direct' or 'linked'
    const [showOrderSelect, setShowOrderSelect] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderSearchTerm, setOrderSearchTerm] = useState('');
    const [challanFilterCustomerId, setChallanFilterCustomerId] = useState('');

    // Edit & Delete State
    const [isEditMode, setIsEditMode] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Form State
    const [companyDetails, setCompanyDetails] = useState({
        name: 'Zirak Books', address: '123 Business Avenue, Suite 404', email: 'info@zirakbooks.com', phone: '123-456-7890', notes: '', terms: ''
    });
    const [challanMeta, setChallanMeta] = useState({
        challanNo: '', manualNo: '', date: new Date().toISOString().split('T')[0], carrier: '', vehicleNo: '', transportNote: '', remarks: '',
        deliveryPersonName: '', deliveryPersonMobile: '', deliveryPersonEmail: ''
    });
    const [customerId, setCustomerId] = useState('');
    const [customerDetails, setCustomerDetails] = useState({
        address: '', email: '', phone: '', city: '', state: '', zipCode: ''
    });
    const [billingDetails, setBillingDetails] = useState({
        address: '', city: '', state: '', zipCode: ''
    });
    const [items, setItems] = useState([]);
    const navigate = useNavigate();
    const [activeModalStep, setActiveModalStep] = useState(1);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

    const location = useLocation();

    // Initial Fetch
    useEffect(() => {
        fetchData();
        fetchDropdowns();
        fetchCompanyDetails();
    }, []);

    const fetchCompanyDetails = async () => {
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getById(companyId);
                const data = res.data;
                setCompanyDetails({
                    name: data.name || 'Zirak Books',
                    address: data.address || '123 Business Avenue, Suite 404',
                    email: data.email || 'info@zirakbooks.com',
                    phone: data.phone || '123-456-7890',
                    logo: data.logo || null,
                    notes: data.notes || '',
                    terms: data.terms || ''
                });
                setChallanMeta(prev => ({
                    ...prev,
                    transportNote: data.notes || '',
                    remarks: data.terms || ''
                }));
            }
        } catch (error) {
            console.error('Error fetching company details:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const companyId = GetCompanyId();
            const response = await deliveryChallanService.getAll(companyId);
            if (response.data.success) {
                setDeliveryChallans(response.data.data);
                setSelectedChallanIds([]);
            }
        } catch (error) {
            console.error('Error fetching challans:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const companyId = GetCompanyId();
            const [custRes, prodRes, whRes, orderRes, uomRes] = await Promise.all([
                customerService.getAll(companyId),
                productService.getAll(companyId),
                warehouseService.getAll(companyId),
                salesOrderService.getAll(companyId),
                uomService.getUOMs(companyId)
            ]);
            if (custRes.data.success) setCustomers(custRes.data.data);
            if (prodRes.data.success) setAllProducts(prodRes.data.data);
            if (whRes.data.success) setAllWarehouses(whRes.data.data);
            if (orderRes.data.success) {
                setActiveOrders(orderRes.data.data.filter(o => o.status !== 'COMPLETED'));
            }
            if (uomRes.success) {
                setAllUoms(uomRes.data || []);
            }
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
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

    // Inline Customer Handlers
    const handleCustomerInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            const cleaned = value.replace(/\D/g, '');
            setCustomerFormData(prev => ({ ...prev, [name]: cleaned }));
        } else {
            setCustomerFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleCustomerImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                setUploadingAnyFile(true);
                toast.loading('Uploading profile image...', { id: 'cust-image-upload' });
                const url = await uploadToCloudinary(file);
                setCustomerFormData(prev => ({ ...prev, profileImage: url }));
                toast.success('Image uploaded successfully', { id: 'cust-image-upload' });
            } catch (error) {
                console.error(error);
                toast.error('Failed to upload image', { id: 'cust-image-upload' });
            } finally {
                setUploadingAnyFile(false);
            }
        }
    };

    const handleCustomerSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!customerFormData.name || !customerFormData.phone) {
            toast.error('Name and Phone are required');
            return;
        }
        try {
            const companyId = GetCompanyId();
            const payload = {
                ...customerFormData,
                accountBalance: parseFloat(customerFormData.accountBalance) || 0,
                companyId: parseInt(companyId)
            };
            const res = await customerServiceFromServices.createCustomer(payload);
            if (res.success) {
                toast.success('Customer added successfully');
                setShowAddCustomerModal(false);
                setCustomerFormData({
                    name: '', email: '', phone: '', company: '', gstin: '',
                    billingAddress: '', billingCity: '', billingState: '', billingZip: '', billingCountry: '',
                    shippingAddress: '', shippingCity: '', shippingState: '', shippingZip: '', shippingCountry: '',
                    accountBalance: '', notes: '', profileImage: ''
                });
                // Reload list of customers
                const custRes = await customerService.getAll(companyId);
                if (custRes.data?.success) {
                    setCustomers(custRes.data.data);
                }
                // Pre-select newly created customer
                if (res.data?.id) {
                    const cId = res.data.id;
                    setCustomerId(cId);
                    const c = res.data;
                    setCustomerDetails({
                        address: c.shippingAddress || c.billingAddress || '',
                        email: c.email || '',
                        phone: c.phone || '',
                        city: c.shippingCity || c.billingCity || '',
                        state: c.shippingState || c.billingState || '',
                        zipCode: c.shippingZip || c.billingZip || ''
                    });
                    setBillingDetails({
                        address: c.billingAddress || '',
                        city: c.billingCity || '',
                        state: c.billingState || '',
                        zipCode: c.billingZip || ''
                    });
                }
            }
        } catch (error) {
            console.error('Error adding customer:', error);
            toast.error(error.response?.data?.message || 'Failed to add customer');
        }
    };

    // Inline Product Handlers
    const handleProductInputChange = (e) => {
        const { name, value } = e.target;
        setProductFormData(prev => ({ ...prev, [name]: value }));
    };

    const addProductWarehouseRow = () => {
        const firstWhId = allWarehouses.length > 0 ? allWarehouses[0].id : '';
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
            const prodRes = await productService.getAll(companyId);
            if (prodRes?.data?.success) {
                setAllProducts(prodRes.data.data);
            } else if (prodRes?.data) {
                setAllProducts(prodRes.data);
            } else if (Array.isArray(prodRes)) {
                setAllProducts(prodRes);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to create product');
        }
    };

    const salesProcess = [
        { id: 'quotation', label: 'Quotation', icon: FileText, status: 'completed' },
        { id: 'sales-order', label: 'Sales Order', icon: ShoppingCart, status: 'completed' },
        { id: 'delivery', label: 'Delivery', icon: Truck, status: 'active' },
        { id: 'invoice', label: 'Invoice', icon: Receipt, status: 'pending' },
        { id: 'payment', label: 'Payment', icon: CreditCard, status: 'pending' },
    ];

    const resetForm = () => {
        setSelectedOrder(null);
        setCustomerId('');
        setCustomerDetails({ address: '', email: '', phone: '', city: '', state: '', zipCode: '' });
        setBillingDetails({ address: '', city: '', state: '', zipCode: '' });
        setItems([]);
        setSelectedChallanIds([]);
        const autoDC = `DC-${Math.floor(10000000 + Math.random() * 90000000)}`;
        setChallanMeta({
            challanNo: autoDC,
            manualNo: '',
            date: new Date().toISOString().split('T')[0],
            carrier: '',
            vehicleNo: '',
            transportNote: companyDetails.notes || '',
            remarks: companyDetails.terms || '',
            deliveryPersonName: '',
            deliveryPersonMobile: '',
            deliveryPersonEmail: ''
        });
        setIsEditMode(false);
        setIsViewMode(false);
        setEditId(null);
        setActiveModalStep(1);
        setSelectedWarehouseId('');
        setOrderSearchTerm('');
        setChallanFilterCustomerId('');
        setCustomFieldValues({});
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const nonConvertedIds = deliveryChallans
                .filter(dc => dc.status !== 'CONVERTED')
                .map(dc => dc.id);
            setSelectedChallanIds(nonConvertedIds);
        } else {
            setSelectedChallanIds([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedChallanIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkConvert = async () => {
        if (selectedChallanIds.length === 0) return;

        try {
            const companyId = GetCompanyId();
            const response = await deliveryChallanService.convertMultiple(selectedChallanIds, companyId);
            if (response.data.success) {
                toast.success("Successfully converted selected Delivery Challans to Invoice!");
                setSelectedChallanIds([]);
                fetchData();
            } else {
                toast.error(response.data.message || "Failed to convert selected Delivery Challans.");
            }
        } catch (error) {
            console.error("Bulk convert error:", error);
            toast.error(error.response?.data?.message || "Error converting selected Delivery Challans.");
        }
    };

    const handleAddNew = async () => {
        resetForm();
        try {
            const companyId = GetCompanyId();
            if (companyId) {
                const res = await companyService.getNextNumber(companyId, 'deliverychallan');
                if (res.data.success) {
                    setChallanMeta(prev => ({ ...prev, challanNo: res.data.nextNumber }));
                }
            }
        } catch (error) {
            console.error('Error fetching next deliverychallan number:', error);
        }
        setShowAddModal(true);
        setShowOrderSelect(false);
        setCreationMode('direct');
        setActiveModalStep(2);
    };

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setCustomerId(order.customerId);

        const c = order.customer || {};
        setCustomerDetails({
            address: c.shippingAddress || c.billingAddress || '',
            email: c.email || '',
            phone: c.phone || '',
            city: c.shippingCity || c.billingCity || '',
            state: c.shippingState || c.billingState || '',
            zipCode: c.shippingZipCode || c.billingZipCode || ''
        });
        setBillingDetails({
            address: c.billingAddress || '',
            city: c.billingCity || '',
            state: c.billingState || '',
            zipCode: c.billingZipCode || ''
        });
        const sourceItems = order.salesorderitem || order.items || [];
        const productItems = sourceItems
            .filter(item => item.productId) // ONLY physical products can be delivered
            .map(item => {
                // Find product to get unit
                const product = allProducts.find(p => p.id === item.productId);
                return {
                    id: Date.now() + Math.random(),
                    productId: item.productId, // Keep as ID from backend
                    warehouseId: item.warehouseId || '',
                    description: item.description || '',
                    ordered: item.quantity,
                    delivered: item.quantity,
                    unit: product?.uom?.unitName || product?.salesUom?.unitName || product?.unit || 'NA'
                };
            });

        if (productItems.length === 0) {
            toast.warning("This Sales Order contains no physical products to deliver.");
            return;
        }

        setItems(productItems);
        setShowOrderSelect(false);
        setActiveModalStep(2); // Proceed directly to Challan Details
    };

    const handleSelectWarehouse = (wId) => {
        setSelectedWarehouseId(wId);
        // Apply global warehouse to all items
        setItems(prev => prev.map(item => ({ ...item, warehouseId: wId })));
        setActiveModalStep(3); // Proceed to main form
    };

    const updateItem = (id, field, value) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleView = async (challanId) => {
        try {
            const companyId = GetCompanyId();
            const response = await deliveryChallanService.getById(challanId, companyId);
            if (response.data.success) {
                const challan = response.data.data;
                resetForm();
                setIsViewMode(true);
                setEditId(challanId);

                setCustomerId(challan.customerId);

                // Fallback to customer data if challan shipping fields are empty
                const custFallback = challan.customer || {};
                setCustomerDetails({
                    address: challan.shippingAddress || custFallback.shippingAddress || custFallback.billingAddress || '',
                    email: challan.shippingEmail || custFallback.email || '',
                    phone: challan.shippingPhone || custFallback.phone || '',
                    city: challan.shippingCity || custFallback.shippingCity || custFallback.billingCity || '',
                    state: challan.shippingState || custFallback.shippingState || custFallback.billingState || '',
                    zipCode: challan.shippingZipCode || custFallback.shippingZipCode || custFallback.billingZipCode || ''
                });

                if (challan.customer) {
                    setBillingDetails({
                        address: challan.customer.billingAddress || '',
                        city: challan.customer.billingCity || '',
                        state: challan.customer.billingState || '',
                        zipCode: challan.customer.billingZipCode || ''
                    });
                }



                if (challan.salesorder) {
                    setSelectedOrder(challan.salesorder);
                }

                setItems((challan.deliverychallanitem || challan.items || []).map(item => ({
                    id: item.id,
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    description: item.description || '',
                    ordered: item.quantity,
                    delivered: item.quantity,
                    unit: item.product?.uom?.unitName || item.product?.salesUom?.unitName || item.product?.unit || 'pcs'
                })));

                let fieldValues = {};
                if (challan.customFields) {
                    try {
                        fieldValues = typeof challan.customFields === 'string'
                            ? JSON.parse(challan.customFields)
                            : challan.customFields;
                    } catch (e) {
                        console.error('Error parsing custom fields on view:', e);
                    }
                }
                setCustomFieldValues(fieldValues);

                setChallanMeta({
                    challanNo: challan.challanNumber,
                    manualNo: challan.manualReference || '',
                    date: new Date(challan.date).toISOString().split('T')[0],
                    carrier: challan.carrier || '',
                    vehicleNo: challan.vehicleNo || '',
                    transportNote: challan.transportNote || '',
                    remarks: challan.remarks || '',
                    deliveryPersonName: fieldValues.deliveryPersonName || '',
                    deliveryPersonMobile: fieldValues.deliveryPersonMobile || '',
                    deliveryPersonEmail: fieldValues.deliveryPersonEmail || ''
                });

                if (challan.salesorder) {
                    setSelectedOrder(challan.salesorder);
                }

                setActiveModalStep(2);
                setShowAddModal(true);
            }
        } catch (error) {
            console.error('Error fetching challan for view:', error);
        }
    };

    const handleEdit = async (challanId) => {
        try {
            const companyId = GetCompanyId();
            const response = await deliveryChallanService.getById(challanId, companyId);
            if (response.data.success) {
                const challan = response.data.data;
                resetForm();
                setIsEditMode(true);
                setEditId(challanId);

                setCustomerId(challan.customerId);
                setCustomerDetails({
                    address: challan.shippingAddress || '',
                    email: challan.shippingEmail || '',
                    phone: challan.shippingPhone || '',
                    city: challan.shippingCity || '',
                    state: challan.shippingState || '',
                    zipCode: challan.shippingZipCode || ''
                });

                if (challan.customer) {
                    setBillingDetails({
                        address: challan.customer.billingAddress || '',
                        city: challan.customer.billingCity || '',
                        state: challan.customer.billingState || '',
                        zipCode: challan.customer.billingZipCode || ''
                    });
                }

                 let fieldValues = {};
                 if (challan.customFields) {
                     try {
                         fieldValues = typeof challan.customFields === 'string'
                             ? JSON.parse(challan.customFields)
                             : challan.customFields;
                     } catch (e) {
                         console.error('Error parsing custom fields on edit:', e);
                     }
                 }
                 setCustomFieldValues(fieldValues);

                 setChallanMeta({
                      challanNo: challan.challanNumber,
                      manualNo: challan.manualReference || '',
                      date: new Date(challan.date).toISOString().split('T')[0],
                      carrier: challan.carrier || '',
                      vehicleNo: challan.vehicleNo || '',
                      transportNote: challan.transportNote || '',
                      remarks: challan.remarks || '',
                      deliveryPersonName: fieldValues.deliveryPersonName || '',
                      deliveryPersonMobile: fieldValues.deliveryPersonMobile || '',
                      deliveryPersonEmail: fieldValues.deliveryPersonEmail || ''
                  });

                  if (challan.salesorder) {
                      setSelectedOrder(challan.salesorder);
                  }

                  setItems((challan.deliverychallanitem || challan.items || []).map(item => ({
                      id: item.id,
                      productId: item.productId,
                      warehouseId: item.warehouseId,
                      description: item.description || '',
                      ordered: item.quantity,
                      delivered: item.quantity,
                      unit: item.product?.uom?.unitName || item.product?.salesUom?.unitName || item.product?.unit || 'pcs'
                  })));

                 setActiveModalStep(2);
                 setShowAddModal(true);
            }
        } catch (error) {
            console.error('Error fetching challan for edit:', error);
        }
    };

    const handleDeleteClick = (id) => {
        setDeleteId(id);
        setShowDeleteModal(true);
    };

    const handleConvert = async (id) => {
        try {
            const companyId = GetCompanyId();
            const response = await deliveryChallanService.convert(id, companyId);
            if (response.data.success) {
                toast.success('Converted to Invoice successfully');
                setShowAddModal(false);
                navigate('/company/sales/invoice', { state: { targetInvoiceId: response.data.data.id } });
            } else {
                toast.error(response.data.message || 'Conversion failed');
            }
        } catch (error) {
            console.error('Error converting challan:', error);
            toast.error(error.response?.data?.message || 'Error converting challan');
        }
    };

    const handleStatusChange = async (challanId, newStatus) => {
        try {
            const companyId = GetCompanyId();
            const payload = {
                onlyUpdateStatus: true,
                manualStatus: newStatus !== 'AUTO',
                status: newStatus === 'AUTO' ? undefined : newStatus
            };
            const response = await deliveryChallanService.update(challanId, payload, companyId);
            if (response.data?.success || response.success) {
                fetchData();
            }
        } catch (error) {
            console.error('Error changing status:', error);
        }
    };

    const addItem = () => {
        let defWarehouseId = '';
        if (companySettings?.inventoryConfig) {
            try {
                const parsed = typeof companySettings.inventoryConfig === 'string'
                    ? JSON.parse(companySettings.inventoryConfig)
                    : companySettings.inventoryConfig;
                if (parsed.defaultSalesWarehouseId) {
                    defWarehouseId = parseInt(parsed.defaultSalesWarehouseId);
                }
            } catch (e) {
                console.error(e);
            }
        }
        setItems([...items, { id: Date.now(), productId: '', warehouseId: defWarehouseId, description: '', ordered: 0, delivered: 0, unit: 'pcs' }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    // --- Filter Logic ---
    const filteredChallans = React.useMemo(() => {
        return deliveryChallans.filter(c => {
            const query = searchTerm.toLowerCase();
            const matchesSearch = !query ||
                c.challanNumber?.toLowerCase().includes(query) ||
                c.customer?.name?.toLowerCase().includes(query);

            const cDate = new Date(c.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || cDate >= start) && (!end || cDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [deliveryChallans, searchTerm, startDate, endDate]);

    const filteredActiveOrders = React.useMemo(() => {
        return activeOrders.filter(o => {
            const query = orderSearchTerm.toLowerCase();
            const matchesSearch = !query ||
                o.orderNumber?.toLowerCase().includes(query) ||
                o.customer?.name?.toLowerCase().includes(query);

            const matchesCustomer = !challanFilterCustomerId || o.customerId === parseInt(challanFilterCustomerId);

            return matchesSearch && matchesCustomer;
        });
    }, [activeOrders, orderSearchTerm, challanFilterCustomerId]);

    const handleSave = async (allowDuplicate = false) => {
        try {
            if (!customerId) {
                toast.warning("Please select a customer.");
                return;
            }
            if (items.some(i => !i.productId || !i.warehouseId)) {
                toast.error("All items must have a product and a warehouse");
                return;
            }

            const companyId = GetCompanyId();
            const data = {
                challanNumber: challanMeta.challanNo,
                manualReference: challanMeta.manualNo,
                date: challanMeta.date,
                customerId: parseInt(customerId),
                companyId: companyId,
                salesOrderId: selectedOrder ? parseInt(selectedOrder.id) : null,
                customFields: JSON.stringify({
                    ...customFieldValues,
                    deliveryPersonName: challanMeta.deliveryPersonName,
                    deliveryPersonMobile: challanMeta.deliveryPersonMobile,
                    deliveryPersonEmail: challanMeta.deliveryPersonEmail
                }),
                vehicleNo: challanMeta.vehicleNo,
                carrier: challanMeta.carrier,
                transportNote: challanMeta.transportNote,
                remarks: challanMeta.remarks,
                shippingAddress: customerDetails.address,
                shippingCity: customerDetails.city,
                shippingState: customerDetails.state,
                shippingZipCode: customerDetails.zipCode,
                shippingPhone: customerDetails.phone,
                shippingEmail: customerDetails.email,
                items: items.map(item => ({
                    productId: parseInt(item.productId),
                    warehouseId: parseInt(item.warehouseId),
                    quantity: parseFloat(item.delivered),
                    description: item.description || (allProducts.find(p => p.id === parseInt(item.productId))?.name || '')
                })),
                allowDuplicateManualNo: allowDuplicate === true
            };

            let response;
            try {
                if (isEditMode) {
                    response = await deliveryChallanService.update(editId, data, companyId);
                } else {
                    response = await deliveryChallanService.create(data);
                }

                if (response.data.success) {
                    toast.success(isEditMode ? 'Challan updated successfully' : 'Challan created successfully');
                    fetchData();
                    setShowAddModal(false);
                    resetForm();
                }
            } catch (err) {
                if (err.response?.data?.isDuplicateWarning) {
                    const confirmUse = window.confirm(err.response.data.message);
                    if (confirmUse) {
                        await handleSave(true);
                    }
                } else {
                    toast.error(err.response?.data?.message || 'Error saving delivery challan');
                    console.error('Error saving challan:', err);
                }
            }
        } catch (error) {
            console.error('Error in handleSave:', error);
        }
    };

    const confirmDelete = async () => {
        try {
            const companyId = GetCompanyId();
            const response = await deliveryChallanService.delete(deleteId, companyId);
            if (response.data.success) {
                fetchData();
                setShowDeleteModal(false);
                setDeleteId(null);
            }
        } catch (error) {
            console.error('Error deleting challan:', error);
        }
    };

    const printRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `DeliveryChallan_${challanMeta.challanNo || 'New'}`,
    });

    // Handle Deep Link from Navigation State
    useEffect(() => {
        if (location.state && location.state.targetChallanId) {
            handleView(location.state.targetChallanId);
            // Clear location state after handling to prevent re-opening on re-renders
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, fetchData, navigate]);

    return (
        <div className="Zirak-DC-wrapper Zirak-DC-delivery-page">
            <div className="Zirak-DC-page-header">
                <div>
                    <h1 className="Zirak-DC-page-title">Delivery Challan</h1>
                    <p className="Zirak-DC-page-subtitle">Manage product deliveries and shipments</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {selectedChallanIds.length > 0 && (
                        <button className="Zirak-DC-btn-add" onClick={handleBulkConvert} style={{ backgroundColor: '#4f46e5' }}>
                            <Receipt size={18} className="mr-2" /> Convert Selected ({selectedChallanIds.length})
                        </button>
                    )}
                    {hasPermission('create delivery challan') && (
                        <button className="Zirak-DC-btn-add" onClick={handleAddNew}>
                            <Plus size={18} className="mr-2" /> Create Challan
                        </button>
                    )}
                </div>
            </div>

            <div className="Zirak-DC-process-tracker-card">
                <div className="Zirak-DC-tracker-wrapper">
                    {salesProcess.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`Zirak-DC-tracker-step ${step.status}`}>
                                <div className="Zirak-DC-step-icon-wrapper">
                                    <step.icon size={20} />
                                    {step.status === 'completed' && <CheckCircle2 className="Zirak-DC-status-badge" size={14} />}
                                    {step.status === 'active' && <Clock className="Zirak-DC-status-badge" size={14} />}
                                </div>
                                <span className="Zirak-DC-step-label">{step.label}</span>
                            </div>
                            {index < salesProcess.length - 1 && (
                                <div className={`Zirak-DC-tracker-divider ${salesProcess[index + 1].status !== 'pending' ? 'active' : ''}`}>
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="Zirak-DC-table-card mt-6">
                <div className="Zirak-DC-table-controls p-4 border-b flex justify-between items-center gap-4 flex-wrap">
                    <div className="Zirak-DC-search-wrapper">
                        <Search className="Zirak-DC-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Challan ID or Customer..."
                            className="Zirak-DC-search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="Zirak-DC-date-filters flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">From:</span>
                            <input
                                type="date"
                                className="Zirak-DC-date-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">To:</span>
                            <input
                                type="date"
                                className="Zirak-DC-date-input"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="Zirak-DC-table-container">
                    <table className="Zirak-DC-challan-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={
                                            deliveryChallans.length > 0 &&
                                            deliveryChallans.filter(dc => dc.status !== 'CONVERTED').length > 0 &&
                                            deliveryChallans.filter(dc => dc.status !== 'CONVERTED').every(dc => selectedChallanIds.includes(dc.id))
                                        }
                                    />
                                </th>
                                <th>CHALLAN ID</th>
                                <th>CUSTOMER</th>
                                <th>LINKED ORDER</th>
                                <th>DATE</th>
                                <th>STATUS</th>
                                <th className="text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deliveryChallans.map(dc => (
                                <tr key={dc.id}>
                                    <td style={{ textAlign: 'center' }}>
                                        {dc.status !== 'CONVERTED' ? (
                                            <input
                                                type="checkbox"
                                                checked={selectedChallanIds.includes(dc.id)}
                                                onChange={() => handleSelectRow(dc.id)}
                                            />
                                        ) : (
                                            <input type="checkbox" disabled />
                                        )}
                                    </td>
                                    <td className="font-bold Zirak-DC-text-blue-600">{dc.challanNumber}</td>
                                    <td>{dc.customer?.name}</td>
                                    <td><span className="Zirak-DC-source-link">{dc.salesOrder?.orderNumber || 'Direct'}</span></td>
                                    <td>{new Date(dc.date).toLocaleDateString()}</td>
                                    <td>
                                        <select
                                            value={dc.manualStatus ? dc.status : 'AUTO'}
                                            onChange={(e) => handleStatusChange(dc.id, e.target.value)}
                                            className="Zirak-DC-challan-status-pill"
                                            style={getStatusStyle(dc.manualStatus ? dc.status : 'AUTO')}
                                        >
                                            <option value="AUTO">Auto ({dc.status || 'Pending'})</option>
                                            <option value="PENDING">PENDING</option>
                                            <option value="PARTIAL">PARTIAL</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                            <option value="CANCELLED">CANCELLED</option>
                                        </select>
                                    </td>
                                    <td className="text-right">
                                        <div className="Zirak-DC-delivery-action-buttons">
                                            <button className="Zirak-DC-challan-action-btn Zirak-DC-view" onClick={() => handleView(dc.id)} title="View"><Eye size={16} /></button>
                                            {dc.status !== 'CONVERTED' ? (
                                                <button className="Zirak-DC-challan-action-btn Zirak-DC-convert" onClick={() => handleConvert(dc.id)} title="Convert to Invoice" style={{ backgroundColor: '#4f46e5', color: 'white' }}><Receipt size={16} /></button>
                                            ) : (
                                                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-500 rounded" style={{ alignSelf: 'center' }}>Converted</span>
                                            )}
                                            {hasPermission('edit delivery challan') && (
                                                <button className="Zirak-DC-challan-action-btn Zirak-DC-edit" onClick={() => handleEdit(dc.id)} title="Edit"><Pencil size={16} /></button>
                                            )}
                                            {hasPermission('delete delivery challan') && (
                                                <button className="Zirak-DC-challan-action-btn Zirak-DC-delete" onClick={() => handleDeleteClick(dc.id)} title="Delete"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Enhanced Create Modal */}
            {showAddModal && (
                <div className="Zirak-DC-modal-overlay">
                    <div className="Zirak-DC-modal-content Zirak-DC-delivery-modal-premium">
                        <div className="Zirak-DC-modal-header-simple">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold Zirak-DC-text-gray-800">
                                    {isViewMode ? 'Delivery Challan' : isEditMode ? 'Edit Delivery Challan' : 'New Delivery Challan'}
                                </h2>
                                {isViewMode
                                    ? <span className="Zirak-DC-challan-status-badge-header" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>VIEW</span>
                                    : <span className="Zirak-DC-challan-status-badge-header">DELIVERY</span>
                                }
                            </div>
                            <div className="Zirak-DC-close-wrapper flex items-center gap-4">
                                {isViewMode && (
                                    <button className="Zirak-DC-btn-print-header" onClick={handlePrint} title="Print Challan">
                                        <Printer size={20} />
                                    </button>
                                )}
                                <button className="Zirak-DC-close-btn-simple" onClick={() => setShowAddModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="Zirak-DC-modal-body-scrollable" ref={printRef}>
                            {/* Modal Step Indicator - Only for Create/Edit */}
                            {!isViewMode && (
                                <div className="Zirak-DC-modal-step-stepper">
                                    <div className={`Zirak-DC-m-step ${activeModalStep >= 1 ? 'active' : ''} ${activeModalStep > 1 ? 'done' : ''}`}>
                                        <div className="Zirak-DC-m-step-num">{activeModalStep > 1 ? '✓' : '1'}</div>
                                        <span>Select Order</span>
                                    </div>
                                    <div className={`Zirak-DC-m-step-line ${activeModalStep >= 2 ? 'active' : ''}`}></div>
                                    <div className={`Zirak-DC-m-step ${activeModalStep >= 2 ? 'active' : ''}`}>
                                        <div className="Zirak-DC-m-step-num">2</div>
                                        <span>Challan Details</span>
                                    </div>
                                </div>
                            )}

                            {/* Step 1: Order Selection List (Conditional) */}
                            {activeModalStep === 1 && (
                                <div className="Zirak-DC-order-link-container-premium">
                                    <div className="Zirak-DC-section-header-flex mb-6">
                                        <div className="Zirak-DC-form-group-mini">
                                            <label className="Zirak-DC-form-label-sm">Select Customer First</label>
                                            <select
                                                className="Zirak-DC-purchase-module-select-large"
                                                style={{ width: '300px' }}
                                                value={challanFilterCustomerId}
                                                onChange={(e) => setChallanFilterCustomerId(e.target.value)}
                                            >
                                                <option value="">Choose Customer...</option>
                                                {customers.map(c => {
                                                    const orderCount = activeOrders.filter(o => o.customerId === c.id).length;
                                                    return (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name} ({orderCount} Orders)
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="Zirak-DC-order-search-mini">
                                                <Search size={14} className="Zirak-DC-o-search-icon-mini" />
                                                <input
                                                    type="text"
                                                    placeholder="Search orders..."
                                                    className="Zirak-DC-o-search-input-mini"
                                                    value={orderSearchTerm}
                                                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <button className="Zirak-DC-btn-direct-entry" onClick={() => { setCreationMode('direct'); setActiveModalStep(2); }}>
                                                Direct Delivery (No Order) <ArrowRight size={14} className="ml-1" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="Zirak-DC-section-header-flex mb-4">
                                        <h3 className="text-md Zirak-DC-font-extrabold Zirak-DC-text-slate-700 flex items-center gap-2">
                                            <ShoppingCart size={18} className="Zirak-DC-text-indigo-500" />
                                            {challanFilterCustomerId
                                                ? `Available Orders (${filteredActiveOrders.length})`
                                                : 'All Pending Sales Orders'}
                                        </h3>
                                    </div>
                                    <div className="Zirak-DC-order-grid-premium">
                                        {filteredActiveOrders.length > 0 ? (
                                            filteredActiveOrders.map(order => (
                                                <div key={order.id} className="Zirak-DC-order-link-card-premium" onClick={() => handleSelectOrder(order)}>
                                                    <div className="Zirak-DC-o-card-header-premium">
                                                        <div className="Zirak-DC-o-id-badge">
                                                            <FileText size={12} />
                                                            <span>{order.orderNumber}</span>
                                                        </div>
                                                        <div className="Zirak-DC-o-date-premium">
                                                            <Clock size={12} />
                                                            <span>{new Date(order.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                                                        </div>
                                                    </div>
                                                    <div className="Zirak-DC-o-card-body-premium">
                                                        <div className="Zirak-DC-o-customer-flex">
                                                            <div className="Zirak-DC-cust-avatar">{order.customer?.name?.charAt(0) || 'C'}</div>
                                                            <div className="Zirak-DC-cust-info">
                                                                <span className="Zirak-DC-cust-name">{order.customer?.name}</span>
                                                                <span className="Zirak-DC-cust-location">{order.customer?.billingCity || 'No Location'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="Zirak-DC-o-items-summary">
                                                            {(order.salesorderitem?.length || order.items?.length || 0)} items to deliver
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="Zirak-DC-empty-orders-state">
                                                <PackageCheck size={40} className="Zirak-DC-text-slate-200" />
                                                <p>No pending sales orders found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Main Form */}
                            {activeModalStep === 2 && (
                                <>
                                    {/* ========== VIEW MODE: Challan Document ========== */}
                                    {isViewMode ? (
                                        <div className="Zirak-DC-view-challan-doc">
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
                                                                {(companySettings?.invoiceLogo || companyDetails.logo) && (
                                                                    <img src={companySettings?.invoiceLogo || companyDetails.logo} alt="Company Logo" className="invoice-logo-large" style={{ margin: '0' }} />
                                                                )}
                                                            </div>
                                                            <div className="invoice-header-right">
                                                                <div className="invoice-title-large" style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0' }}>{getDocumentTitle('deliverychallan')}</div>
                                                            </div>
                                                        </div>

                                                        <div className="invoice-preview-header" style={{ alignItems: 'flex-start' }}>
                                                            <div className="invoice-header-left">
                                                                <div className="invoice-company-details">
                                                                    <h2 style={{ color: companySettings?.invoiceColor || '#004aad', margin: '0 0 5px 0', fontSize: '1.6rem', fontWeight: '900' }}>
                                                                        {companyDetails.name}
                                                                    </h2>
                                                                    <p>{companyDetails.address}</p>
                                                                    <p>{companyDetails.email} | {companyDetails.phone}</p>
                                                                </div>
                                                            </div>
                                                            <div className="invoice-header-right">
                                                                <div className="invoice-meta-info">
                                                                    <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                        <span className="invoice-label">Challan No:</span>
                                                                        <span>#{challanMeta?.challanNo || '—'}</span>
                                                                    </div>
                                                                    <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                        <span className="invoice-label">Date:</span>
                                                                        <span>{challanMeta.date ? new Date(challanMeta.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                                                                    </div>
                                                                    {challanMeta.manualNo && (
                                                                        <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                            <span className="invoice-label">Manual Ref:</span>
                                                                            <span>{challanMeta.manualNo}</span>
                                                                        </div>
                                                                    )}
                                                                    {challanMeta.vehicleNo && (
                                                                        <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                            <span className="invoice-label">Vehicle No:</span>
                                                                            <span>{challanMeta.vehicleNo}</span>
                                                                        </div>
                                                                    )}
                                                                    {challanMeta.deliveryPersonName && (
                                                                        <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                            <span className="invoice-label">Del. Person:</span>
                                                                            <span>{challanMeta.deliveryPersonName}</span>
                                                                        </div>
                                                                    )}
                                                                    {challanMeta.deliveryPersonMobile && (
                                                                        <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                            <span className="invoice-label">Del. Mobile:</span>
                                                                            <span>{challanMeta.deliveryPersonMobile}</span>
                                                                        </div>
                                                                    )}
                                                                    {challanMeta.deliveryPersonEmail && (
                                                                        <div className="invoice-meta-row flex justify-between gap-8 py-1 text-sm">
                                                                            <span className="invoice-label">Del. Email:</span>
                                                                            <span>{challanMeta.deliveryPersonEmail}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="invoice-addresses" style={{ display: 'flex', justifyContent: 'space-between', width: '100% !important', marginTop: '2.5rem', gap: '3rem' }}>
                                                    <div className="invoice-bill-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                        <div className="invoice-section-header">BILL TO</div>
                                                        <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                                            {customers.find(c => c.id === parseInt(customerId))?.name || '—'}
                                                        </div>
                                                        {billingDetails.address && <div style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>{billingDetails.address}</div>}
                                                        {[billingDetails.city, billingDetails.state, billingDetails.zipCode].filter(Boolean).length > 0 && (
                                                            <div style={{ color: '#475569', fontWeight: '500', fontSize: '0.95rem' }}>{[billingDetails.city, billingDetails.state, billingDetails.zipCode].filter(Boolean).join(', ')}</div>
                                                        )}
                                                        {(() => {
                                                            const cust = customers.find(c => c.id === parseInt(customerId));
                                                            return (<>
                                                                {cust?.phone && <div style={{ color: '#475569', fontSize: '0.95rem' }}>{cust.phone}</div>}
                                                                {cust?.email && <div style={{ color: '#475569', fontSize: '0.95rem' }}>{cust.email}</div>}
                                                            </>);
                                                        })()}
                                                    </div>

                                                    <div className="invoice-ship-to" style={{ flex: 1, textAlign: 'left', minWidth: '0' }}>
                                                        <div className="invoice-section-header">SHIP TO / DESTINATION</div>
                                                        <div className="font-bold" style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                                            {customers.find(c => c.id === parseInt(customerId))?.name || '—'}
                                                        </div>
                                                        {customerDetails.address && <div style={{ marginTop: '8px', color: '#475569', fontWeight: '500', fontSize: '0.95rem', lineHeight: '1.4' }}>{customerDetails.address}</div>}
                                                        {[customerDetails.city, customerDetails.state, customerDetails.zipCode].filter(Boolean).length > 0 && (
                                                            <div style={{ color: '#475569', fontWeight: '500', fontSize: '0.95rem' }}>{[customerDetails.city, customerDetails.state, customerDetails.zipCode].filter(Boolean).join(', ')}</div>
                                                        )}
                                                        {customerDetails.phone && <div style={{ color: '#475569', fontSize: '0.95rem' }}>{customerDetails.phone}</div>}
                                                        {customerDetails.email && <div style={{ color: '#475569', fontSize: '0.95rem' }}>{customerDetails.email}</div>}
                                                    </div>
                                                </div>

                                                {/* Custom Fields Print View */}
                                                {(() => {
                                                    const dc = deliveryChallans.find(c => c.id === editId);
                                                    let customFieldVals = {};
                                                    if (dc?.customFields) {
                                                        try {
                                                            customFieldVals = typeof dc.customFields === 'string'
                                                                ? JSON.parse(dc.customFields)
                                                                : dc.customFields;
                                                        } catch (e) {
                                                            console.error('Error parsing delivery challan custom fields for view:', e);
                                                        }
                                                    }
                                                    const fieldsList = getCustomFieldsForType('deliverychallan');
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

                                                <table className="invoice-table-preview" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2rem' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>#</th>
                                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('item', 'Product / Description').toUpperCase()}</th>
                                                            {getInvoiceLabel('showWarehouse') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)' }}>{getTableHeader('warehouse', 'Warehouse').toUpperCase()}</th>}
                                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center' }}>ORDERED</th>
                                                            <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center' }}>DELIVERED</th>
                                                            {getInvoiceLabel('showUom') !== false && <th style={{ backgroundColor: 'var(--header-bg)', color: 'var(--header-text)', textAlign: 'center' }}>{getTableHeader('uom', 'Unit').toUpperCase()}</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.map((item, idx) => {
                                                            const prod = allProducts.find(p => p.id === Number(item.productId));
                                                            return (
                                                                <tr key={item.id}>
                                                                    <td style={{ width: '5%' }}>{idx + 1}</td>
                                                                    <td style={{ width: '35%' }}>
                                                                        <div className="font-bold text-sm text-gray-800">{prod?.name || 'Unknown Product'}</div>
                                                                        {item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}
                                                                    </td>
                                                                    {getInvoiceLabel('showWarehouse') !== false && <td>{allWarehouses.find(w => w.id === parseInt(item.warehouseId))?.name || 'N/A'}</td>}
                                                                    <td style={{ textAlign: 'center' }}>{item.ordered}</td>
                                                                    <td style={{ textAlign: 'center', fontWeight: '600' }}>{item.delivered}</td>
                                                                    {getInvoiceLabel('showUom') !== false && <td style={{ textAlign: 'center' }}>{item.unit || 'pcs'}</td>}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>

                                                {getInvoiceLabel('showFooter') !== false && (
                                                    <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                                        <div className="Zirak-DC-vcd-notes-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '0 0 2rem 0' }}>
                                                            {challanMeta.transportNote && (
                                                                <div>
                                                                    <strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Transport / Logistics Note</strong>
                                                                    <p style={{ color: '#475569', fontSize: '0.9rem', whiteSpace: 'pre-line', marginTop: '4px' }}>{challanMeta.transportNote}</p>
                                                                </div>
                                                            )}
                                                            {challanMeta.remarks && (
                                                                <div>
                                                                    <strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Remarks</strong>
                                                                    <p style={{ color: '#475569', fontSize: '0.9rem', whiteSpace: 'pre-line', marginTop: '4px' }}>{challanMeta.remarks}</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="Zirak-DC-vcd-sig-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
                                                            <div className="Zirak-DC-vcd-sig-box" style={{ width: '200px', textAlign: 'center' }}>
                                                                <div className="Zirak-DC-vcd-sig-line" style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '8px' }}></div>
                                                                <div className="Zirak-DC-vcd-sig-label" style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Authorized Signatory</div>
                                                            </div>
                                                            <div className="Zirak-DC-vcd-sig-box" style={{ width: '200px', textAlign: 'center' }}>
                                                                <div className="Zirak-DC-vcd-sig-line" style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '8px' }}></div>
                                                                <div className="Zirak-DC-vcd-sig-label" style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Received By</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        /* ========== CREATE/EDIT MODE: Form ========== */
                                        <>
                                            <div className="Zirak-DC-form-section-grid">
                                                <div className="Zirak-DC-company-info-card">
                                                    <div className="Zirak-DC-company-card-strip"></div>
                                                    <div className="Zirak-DC-company-info-card-inner">
                                                        <div className="Zirak-DC-company-header-flex">
                                                            <div className="Zirak-DC-logo-upload-box">
                                                                {companyDetails.logo ? (
                                                                    <img src={companyDetails.logo} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '60px', objectFit: 'contain' }} />
                                                                ) : (
                                                                    <div className="Zirak-DC-logo-placeholder">
                                                                        <Truck size={28} color="white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="Zirak-DC-company-details-inputs">
                                                                <input type="text" className="Zirak-DC-full-width-input font-bold text-lg"
                                                                    value={companyDetails.name} readOnly disabled />
                                                                <input type="text" className="Zirak-DC-full-width-input Zirak-DC-text-gray-500"
                                                                    value={companyDetails.address} readOnly disabled />
                                                                <div className="Zirak-DC-grid Zirak-DC-grid-cols-2 gap-2 mt-2">
                                                                    <input type="text" className="Zirak-DC-full-width-input Zirak-DC-text-gray-500"
                                                                        placeholder="Phone"
                                                                        value={companyDetails.phone} readOnly disabled />
                                                                    <input type="text" className="Zirak-DC-full-width-input Zirak-DC-text-gray-500"
                                                                        placeholder="Email"
                                                                        value={companyDetails.email} readOnly disabled />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="Zirak-DC-meta-fields-col">
                                                    <div className="Zirak-DC-meta-row">
                                                        <label>Challan No.</label>
                                                        <input
                                                            type="text"
                                                            value={challanMeta.challanNo || ''}
                                                            onChange={(e) => setChallanMeta({ ...challanMeta, challanNo: e.target.value })}
                                                            disabled={isViewMode || !!editId}
                                                            className={`Zirak-DC-meta-input ${isViewMode || editId ? 'Zirak-DC-disabled' : ''}`}
                                                        />
                                                    </div>
                                                    <div className="Zirak-DC-meta-row">
                                                        <label>Manual Ref</label>
                                                        <input type="text" placeholder="e.g. DC-MAN-01"
                                                            value={challanMeta.manualNo} onChange={(e) => setChallanMeta({ ...challanMeta, manualNo: e.target.value })}
                                                            className="Zirak-DC-meta-input" />
                                                    </div>
                                                    <div className="Zirak-DC-meta-row">
                                                        <label>Date</label>
                                                        <input type="date"
                                                            value={challanMeta.date} onChange={(e) => setChallanMeta({ ...challanMeta, date: e.target.value })}
                                                            className="Zirak-DC-meta-input" />
                                                    </div>
                                                    <div className="Zirak-DC-meta-row">
                                                        <label>Vehicle No</label>
                                                        <input type="text"
                                                            value={challanMeta.vehicleNo} onChange={(e) => setChallanMeta({ ...challanMeta, vehicleNo: e.target.value })}
                                                            className="Zirak-DC-meta-input font-mono" placeholder='MH-12-XX-9999' />
                                                    </div>
                                                    <div className="Zirak-DC-meta-row">
                                                        <label>Del. Person Name</label>
                                                        <input type="text"
                                                            value={challanMeta.deliveryPersonName || ''} onChange={(e) => setChallanMeta({ ...challanMeta, deliveryPersonName: e.target.value })}
                                                            className="Zirak-DC-meta-input" placeholder='Enter name' />
                                                    </div>
                                                    <div className="Zirak-DC-meta-row">
                                                        <label>Del. Person Mobile</label>
                                                        <input type="text"
                                                            value={challanMeta.deliveryPersonMobile || ''} onChange={(e) => setChallanMeta({ ...challanMeta, deliveryPersonMobile: e.target.value })}
                                                            className="Zirak-DC-meta-input" placeholder='Enter mobile' />
                                                    </div>
                                                    <div className="Zirak-DC-meta-row">
                                                        <label>Del. Person Email</label>
                                                        <input type="text"
                                                            value={challanMeta.deliveryPersonEmail || ''} onChange={(e) => setChallanMeta({ ...challanMeta, deliveryPersonEmail: e.target.value })}
                                                            className="Zirak-DC-meta-input" placeholder='Enter email' />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="Zirak-DC-customer-selection-area">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <label className="Zirak-DC-form-label-sm font-bold Zirak-DC-text-slate-700">Customer</label>
                                                    {!selectedOrder && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAddCustomerModal(true)}
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
                                                            <Plus size={12} /> Add Customer
                                                        </button>
                                                    )}
                                                </div>
                                                <select
                                                    className="Zirak-DC-purchase-module-select-large"
                                                    style={{ flex: 1, width: 'auto' }}
                                                    value={customerId}
                                                    disabled={selectedOrder}
                                                    onChange={(e) => {
                                                        const cId = parseInt(e.target.value);
                                                        setCustomerId(cId);
                                                        const c = customers.find(cust => cust.id === cId);
                                                        if (c) {
                                                            setCustomerDetails({
                                                                address: c.shippingAddress || c.billingAddress || '',
                                                                email: c.email || '',
                                                                phone: c.phone || '',
                                                                city: c.shippingCity || c.billingCity || '',
                                                                state: c.shippingState || c.billingState || '',
                                                                zipCode: c.shippingZipCode || c.billingZipCode || ''
                                                            });
                                                            setBillingDetails({
                                                                address: c.billingAddress || '',
                                                                city: c.billingCity || '',
                                                                state: c.billingState || '',
                                                                zipCode: c.billingZipCode || ''
                                                            });
                                                        }
                                                    }}>
                                                    <option value="">Select Customer...</option>
                                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>

                                            <div className="Zirak-DC-address-double-grid">
                                                <div className="Zirak-DC-address-col">
                                                    <h3><MapPin size={16} color="var(--primary)" /> Billing Address</h3>
                                                    <div className="Zirak-DC-readonly-address-box">
                                                        <p className="font-bold Zirak-DC-text-slate-800">
                                                            {customers.find(c => c.id === parseInt(customerId))?.name || 'Customer'}
                                                        </p>
                                                        {billingDetails.address
                                                            ? <p style={{ marginTop: '4px' }}>{billingDetails.address}</p>
                                                            : !customerId && <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Select a customer to see billing details</p>
                                                        }
                                                        {(billingDetails.city || billingDetails.state || billingDetails.zipCode) && (
                                                            <p>{[billingDetails.city, billingDetails.state, billingDetails.zipCode].filter(Boolean).join(', ')}</p>
                                                        )}
                                                        {(() => {
                                                            const cust = customers.find(c => c.id === parseInt(customerId));
                                                            return (<>
                                                                {cust?.phone && <p style={{ marginTop: '6px', color: '#059669', fontWeight: '600' }}>{cust.phone}</p>}
                                                                {cust?.email && <p style={{ color: '#0284c7' }}>{cust.email}</p>}
                                                            </>);
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="Zirak-DC-address-col">
                                                    <h3><Truck size={16} color="var(--primary)" /> Delivery Destination</h3>
                                                    <div className="Zirak-DC-readonly-address-box" style={{ borderColor: '#d1fae5', background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)' }}>
                                                        <p className="font-bold Zirak-DC-text-slate-800">
                                                            {customers.find(c => c.id === parseInt(customerId))?.name || 'Customer'}
                                                        </p>
                                                        {customerDetails.address && <p style={{ marginTop: '4px' }}>{customerDetails.address}</p>}
                                                        {(customerDetails.city || customerDetails.state || customerDetails.zipCode) && (
                                                            <p>{[customerDetails.city, customerDetails.state, customerDetails.zipCode].filter(Boolean).join(', ')}</p>
                                                        )}
                                                        {customerDetails.phone && (
                                                            <p style={{ marginTop: '6px', color: '#059669', fontWeight: '600' }}>{customerDetails.phone}</p>
                                                        )}
                                                        {customerDetails.email && (
                                                            <p style={{ color: '#0284c7' }}>{customerDetails.email}</p>
                                                        )}
                                                        {!customerId && (
                                                            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Select a customer to see delivery details</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Custom Fields Section */}
                                            {getCustomFieldsForType('deliverychallan').length > 0 && (
                                                <div className="DeliveryChallan-custom-fields-section" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        Custom Fields
                                                    </h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                                                        {getCustomFieldsForType('deliverychallan').map(field => (
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

                                            {/* Items Section */}
                                            <div className="Zirak-DC-section-header-flex mt-4 mb-3">
                                                <h3 className="text-lg font-bold flex items-center gap-2">
                                                    <PackageCheck size={20} color="var(--primary)" /> Delivery Items
                                                </h3>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="Zirak-DC-btn-add-row-mini" onClick={addItem}>
                                                        <Plus size={14} /> Add Line Item
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="Zirak-DC-btn-add-row-mini"
                                                        onClick={() => {
                                                            setProductWarehouseRows(allWarehouses.map(wh => ({
                                                                id: wh.id,
                                                                warehouseId: wh.id,
                                                                quantity: 0,
                                                                minOrderQty: 0,
                                                                initialQty: 0
                                                            })));
                                                            setShowAddProductModal(true);
                                                        }}
                                                        style={{
                                                            backgroundColor: '#22c55e',
                                                            borderColor: '#22c55e',
                                                            color: '#ffffff'
                                                        }}
                                                    >
                                                        <Plus size={14} /> Add Product
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="Zirak-DC-items-section-new">
                                                <div className="Zirak-DC-table-responsive">
                                                    <table className="Zirak-DC-new-items-table">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '30%' }}>{getTableHeader('item', 'Product').toUpperCase()}</th>
                                                                {getInvoiceLabel('showWarehouse') !== false && <th style={{ width: '20%' }}>{getTableHeader('warehouse', 'WH / Location').toUpperCase()}</th>}
                                                                <th style={{ width: '15%', textAlign: 'center' }}>ORDERED</th>
                                                                <th style={{ width: '15%', textAlign: 'center' }}>DELIVERY QTY</th>
                                                                {getInvoiceLabel('showUom') !== false && <th style={{ width: '10%', textAlign: 'center' }}>{getTableHeader('uom', 'Unit').toUpperCase()}</th>}
                                                                <th style={{ width: '10%', textAlign: 'center' }}>ACTION</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {items.map(item => (
                                                                <React.Fragment key={item.id}>
                                                                    <tr className="Zirak-DC-main-item-row Zirak-DC-hover:bg-slate-50">
                                                                        <td>
                                                                            <select className="Zirak-DC-full-width-input font-bold"
                                                                                value={Number(item.productId) || ''}
                                                                                onChange={(e) => {
                                                                                    const pId = Number(e.target.value);
                                                                                    const product = allProducts.find(p => p.id === pId);
                                                                                    updateItem(item.id, 'productId', pId);
                                                                                    if (product) {
                                                                                        updateItem(item.id, 'unit', product.uom?.unitName || product.salesUom?.unitName || product.unit || 'pcs');
                                                                                        if (!item.description) updateItem(item.id, 'description', product.name);
                                                                                    }
                                                                                }}>
                                                                                <option value="">Select Product...</option>
                                                                                {allProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.totalQuantity ?? 0})</option>)}
                                                                            </select>
                                                                        </td>
                                                                        {getInvoiceLabel('showWarehouse') !== false && (
                                                                            <td>
                                                                                <select className="Zirak-DC-full-width-input"
                                                                                    value={item.warehouseId || ''}
                                                                                    onChange={(e) => updateItem(item.id, 'warehouseId', e.target.value)}>
                                                                                    <option value="">Select Warehouse...</option>
                                                                                    {allWarehouses.map(w => {
                                                                                        const prod = allProducts.find(p => p.id === Number(item.productId));
                                                                                        const stockItem = prod?.stock?.find(s => Number(s.warehouseId) === Number(w.id));
                                                                                        const count = stockItem ? stockItem.quantity : 0;
                                                                                        return <option key={w.id} value={w.id}>{w.name} ({count})</option>;
                                                                                    })}
                                                                                </select>
                                                                            </td>
                                                                        )}
                                                                        <td className="text-center">
                                                                            <input type="number"
                                                                                className="Zirak-DC-qty-input-premium"
                                                                                value={item.ordered}
                                                                                min="0"
                                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                                onChange={(e) => updateItem(item.id, 'ordered', e.target.value.replace(/-/g, ''))}
                                                                            />
                                                                        </td>
                                                                        <td className="text-center">
                                                                            <input type="number" value={item.delivered}
                                                                                min="0"
                                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                                onChange={(e) => updateItem(item.id, 'delivered', e.target.value.replace(/-/g, ''))}
                                                                                className={`Zirak-DC-qty-input-premium ${parseFloat(item.delivered) > parseFloat(item.ordered) ? 'error' : 'success'}`} />
                                                                        </td>
                                                                        {getInvoiceLabel('showUom') !== false && (
                                                                            <td className="text-center">
                                                                                <span className="text-sm Zirak-DC-font-extrabold Zirak-DC-text-slate-600">{item.unit || 'pcs'}</span>
                                                                            </td>
                                                                        )}
                                                                        <td className="text-center">
                                                                            <button
                                                                                type="button"
                                                                                className="Zirak-DC-btn-delete-row"
                                                                                onClick={() => removeItem(item.id)}
                                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                                                disabled={items.length <= 1}
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                    <tr className="Zirak-DC-description-row">
                                                                        <td colSpan={4 + (getInvoiceLabel('showWarehouse') !== false ? 1 : 0) + (getInvoiceLabel('showUom') !== false ? 1 : 0)}>
                                                                            <input
                                                                                type="text"
                                                                                className="Zirak-DC-description-input-minimal"
                                                                                placeholder="Item description..."
                                                                                value={item.description || ''}
                                                                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                </React.Fragment>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Footer Sections */}
                                            <div className="Zirak-DC-form-footer-grid mt-6">
                                                <div className="Zirak-DC-notes-col">
                                                    <label className="Zirak-DC-section-label-premium">Transport / Logistics Note</label>
                                                    <textarea className="Zirak-DC-notes-area-premium Zirak-DC-h-32"
                                                        value={challanMeta.transportNote}
                                                        onChange={(e) => setChallanMeta({ ...challanMeta, transportNote: e.target.value })}
                                                        placeholder="Driver contact, Courier name, Airway bill no..."></textarea>
                                                </div>
                                                <div className="Zirak-DC-notes-col">
                                                    <label className="Zirak-DC-section-label-premium">Delivery Remarks</label>
                                                    <textarea className="Zirak-DC-notes-area-premium Zirak-DC-h-32"
                                                        value={challanMeta.remarks}
                                                        onChange={(e) => setChallanMeta({ ...challanMeta, remarks: e.target.value })}
                                                        placeholder="Add any specific instructions or remarks..."></textarea>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                        </div>
                        <div className="Zirak-DC-modal-footer-simple">
                            <button className="Zirak-DC-btn-plain" onClick={() => setShowAddModal(false)}>Cancel</button>
                            {isViewMode && (
                                <>
                                    {deliveryChallans.find(c => c.id === editId)?.status !== 'CONVERTED' ? (
                                        <button className="Zirak-DC-btn-primary-green" onClick={() => handleConvert(editId)} style={{ backgroundColor: '#4f46e5' }}>
                                            <Receipt size={18} className="mr-2" /> Convert to Invoice
                                        </button>
                                    ) : (
                                        <span className="text-sm font-semibold px-3 py-2 bg-gray-100 text-gray-500 rounded mr-2">Already Converted</span>
                                    )}
                                    <button className="Zirak-DC-btn-primary-green" onClick={handlePrint}>
                                        <Printer size={18} className="mr-2" /> Print Challan
                                    </button>
                                </>
                            )}
                            {!isViewMode && (
                                <button className="Zirak-DC-btn-primary-green" onClick={handleSave}>
                                    {isEditMode ? 'Update Delivery' : 'Confirm Delivery'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Unique Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="Zirak-DC-unique-delete-overlay">
                    <div className="Zirak-DC-unique-delete-modal">
                        <div className="Zirak-DC-unique-delete-header">
                            <h2 className="Zirak-DC-unique-delete-title">Delete Challan?</h2>
                            <button className="Zirak-DC-unique-delete-close" onClick={() => setShowDeleteModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="Zirak-DC-unique-delete-body">
                            <p className="Zirak-DC-unique-delete-message">
                                Are you sure you want to delete this Delivery Challan? This action cannot be undone and will permanently remove the record.
                            </p>
                        </div>
                        <div className="Zirak-DC-unique-delete-footer">
                            <button className="Zirak-DC-unique-delete-btn Zirak-DC-unique-delete-cancel" onClick={() => setShowDeleteModal(false)}>
                                Cancel
                            </button>
                            <button className="Zirak-DC-unique-delete-btn Zirak-DC-unique-delete-confirm" onClick={confirmDelete}>
                                <Trash2 size={18} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Add New Customer Modal */}
            {showAddCustomerModal && (
                <div className="Customers-modal-overlay" style={{ zIndex: 20000 }}>
                    <div className="Customers-modal-content" style={{ textAlign: 'left' }}>
                        <div className="Customers-modal-header">
                            <h2 className="Customers-modal-title">Add New Customer</h2>
                            <button className="Customers-close-btn" onClick={() => setShowAddCustomerModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCustomerSubmit}>
                            <div className="Customers-modal-body">
                                <div className="Customers-form-section">
                                    <h3>Basic Information</h3>
                                    <div className="Customers-form-row">
                                        <div className="Customers-form-group Customers-half-width">
                                            <label className="Customers-form-label">Full Name <span className="Customers-text-red">*</span></label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="name"
                                                value={customerFormData.name}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter Full Name"
                                                required
                                            />
                                        </div>
                                        <div className="Customers-form-group Customers-half-width">
                                            <label className="Customers-form-label">Company Name</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="company"
                                                value={customerFormData.company}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter Company Name"
                                            />
                                        </div>
                                    </div>

                                    <div className="Customers-form-row">
                                        <div className="Customers-form-group Customers-half-width">
                                            <label className="Customers-form-label">Email Address</label>
                                            <input
                                                type="email"
                                                className="Customers-form-input"
                                                name="email"
                                                value={customerFormData.email}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter Email Address"
                                            />
                                        </div>
                                        <div className="Customers-form-group Customers-half-width">
                                            <label className="Customers-form-label">Phone <span className="Customers-text-red">*</span></label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="phone"
                                                value={customerFormData.phone}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter Phone"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="Customers-form-row">
                                        <div className="Customers-form-group Customers-half-width">
                                            <label className="Customers-form-label">GSTIN</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="gstin"
                                                value={customerFormData.gstin}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Enter GSTIN"
                                            />
                                        </div>
                                        <div className="Customers-form-group Customers-half-width">
                                            <label className="Customers-form-label">Account Balance</label>
                                            <input
                                                type="number"
                                                className="Customers-form-input"
                                                name="accountBalance"
                                                value={customerFormData.accountBalance}
                                                onChange={handleCustomerInputChange}
                                                placeholder="0.00"
                                                min="0"
                                                onKeyDown={(e) => {
                                                    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                                                        e.preventDefault();
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="Customers-form-section">
                                    <h3>Billing Address</h3>
                                    <div className="Customers-form-group">
                                        <label className="Customers-form-label">Street Address</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="billingAddress"
                                            value={customerFormData.billingAddress}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Street address"
                                        />
                                    </div>
                                    <div className="Customers-form-row">
                                        <div className="Customers-form-group Customers-third-width">
                                            <label className="Customers-form-label">City</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="billingCity"
                                                value={customerFormData.billingCity}
                                                onChange={handleCustomerInputChange}
                                                placeholder="City"
                                            />
                                        </div>
                                        <div className="Customers-form-group Customers-third-width">
                                            <label className="Customers-form-label">State</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="billingState"
                                                value={customerFormData.billingState}
                                                onChange={handleCustomerInputChange}
                                                placeholder="State"
                                            />
                                        </div>
                                        <div className="Customers-form-group Customers-third-width">
                                            <label className="Customers-form-label">Zip Code</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="billingZip"
                                                value={customerFormData.billingZip}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Zip code"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="Customers-form-section">
                                    <h3>Shipping Address</h3>
                                    <div className="Customers-form-group">
                                        <label className="Customers-form-label">Street Address</label>
                                        <input
                                            type="text"
                                            className="Customers-form-input"
                                            name="shippingAddress"
                                            value={customerFormData.shippingAddress}
                                            onChange={handleCustomerInputChange}
                                            placeholder="Street address"
                                        />
                                    </div>
                                    <div className="Customers-form-row">
                                        <div className="Customers-form-group Customers-third-width">
                                            <label className="Customers-form-label">City</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="shippingCity"
                                                value={customerFormData.shippingCity}
                                                onChange={handleCustomerInputChange}
                                                placeholder="City"
                                            />
                                        </div>
                                        <div className="Customers-form-group Customers-third-width">
                                            <label className="Customers-form-label">State</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="shippingState"
                                                value={customerFormData.shippingState}
                                                onChange={handleCustomerInputChange}
                                                placeholder="State"
                                            />
                                        </div>
                                        <div className="Customers-form-group Customers-third-width">
                                            <label className="Customers-form-label">Zip Code</label>
                                            <input
                                                type="text"
                                                className="Customers-form-input"
                                                name="shippingZip"
                                                value={customerFormData.shippingZip}
                                                onChange={handleCustomerInputChange}
                                                placeholder="Zip code"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="Customers-modal-footer">
                                <button type="button" className="Customers-btn-cancel" onClick={() => setShowAddCustomerModal(false)}>Cancel</button>
                                <button type="submit" className="Customers-btn-submit" disabled={uploadingAnyFile}>Save Customer</button>
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
                                                            {allWarehouses.map(wh => (
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

export default DeliveryChallan;
