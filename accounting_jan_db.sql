-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 30, 2026 at 08:57 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `accounting_jan_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `accountgroup`
--

CREATE TABLE `accountgroup` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `type` enum('ASSETS','LIABILITIES','INCOME','EXPENSES','EQUITY') NOT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `accountgroup`
--

INSERT INTO `accountgroup` (`id`, `name`, `type`, `companyId`, `createdAt`, `updatedAt`) VALUES
(6, 'Assets', 'ASSETS', 3, '2026-06-29 13:07:31.584', '2026-06-29 13:07:31.584'),
(7, 'Liabilities', 'LIABILITIES', 3, '2026-06-29 13:07:31.646', '2026-06-29 13:07:31.646'),
(8, 'Equity', 'EQUITY', 3, '2026-06-29 13:07:31.671', '2026-06-29 13:07:31.671'),
(9, 'Income', 'INCOME', 3, '2026-06-29 13:07:31.700', '2026-06-29 13:07:31.700'),
(10, 'Expenses', 'EXPENSES', 3, '2026-06-29 13:07:31.724', '2026-06-29 13:07:31.724');

-- --------------------------------------------------------

--
-- Table structure for table `accountsubgroup`
--

CREATE TABLE `accountsubgroup` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `groupId` int(11) NOT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `accountsubgroup`
--

INSERT INTO `accountsubgroup` (`id`, `name`, `groupId`, `companyId`, `createdAt`, `updatedAt`) VALUES
(13, 'Cash', 6, 3, '2026-06-29 13:07:31.595', '2026-06-29 13:07:31.595'),
(14, 'Bank Accounts', 6, 3, '2026-06-29 13:07:31.610', '2026-06-29 13:07:31.610'),
(15, 'Accounts Receivable', 6, 3, '2026-06-29 13:07:31.624', '2026-06-29 13:07:31.624'),
(16, 'Inventory', 6, 3, '2026-06-29 13:07:31.627', '2026-06-29 13:07:31.627'),
(17, 'Fixed Assets', 6, 3, '2026-06-29 13:07:31.643', '2026-06-29 13:07:31.643'),
(18, 'Accounts Payable', 7, 3, '2026-06-29 13:07:31.649', '2026-06-29 13:07:31.649'),
(19, 'Duties & Taxes', 7, 3, '2026-06-29 13:07:31.659', '2026-06-29 13:07:31.659'),
(20, 'Loans & Borrowings', 7, 3, '2026-06-29 13:07:31.666', '2026-06-29 13:07:31.666'),
(21, 'Share Capital', 8, 3, '2026-06-29 13:07:31.678', '2026-06-29 13:07:31.678'),
(22, 'Equity Items', 8, 3, '2026-06-29 13:07:31.684', '2026-06-29 13:07:31.684'),
(23, 'Sales Income', 9, 3, '2026-06-29 13:07:31.704', '2026-06-29 13:07:31.704'),
(24, 'Other Income', 9, 3, '2026-06-29 13:07:31.715', '2026-06-29 13:07:31.715'),
(25, 'Direct Expenses / COGS', 10, 3, '2026-06-29 13:07:31.728', '2026-06-29 13:07:31.728'),
(26, 'Operating Expenses', 10, 3, '2026-06-29 13:07:31.736', '2026-06-29 13:07:31.736');

-- --------------------------------------------------------

--
-- Table structure for table `auditlog`
--

CREATE TABLE `auditlog` (
  `id` int(11) NOT NULL,
  `userId` int(11) DEFAULT NULL,
  `userEmail` varchar(191) DEFAULT NULL,
  `userName` varchar(191) DEFAULT NULL,
  `action` varchar(191) NOT NULL,
  `entity` varchar(191) NOT NULL,
  `entityId` int(11) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `auditlog`
--

INSERT INTO `auditlog` (`id`, `userId`, `userEmail`, `userName`, `action`, `entity`, `entityId`, `details`, `companyId`, `createdAt`) VALUES
(51, 5, 'company@gmail.com', 'Start Company Pvt. Ltd.', 'CREATE', 'Customer', 10, 'Customer Jay created', 3, '2026-06-29 13:09:12.534'),
(52, 5, 'company@gmail.com', 'Start Company Pvt. Ltd.', 'CREATE', 'Vendor', 10, 'Vendor Rahul created', 3, '2026-06-29 13:10:07.427'),
(53, 5, 'company@gmail.com', 'Start Company Pvt. Ltd.', 'CREATE', 'Product', 4, 'Product IPhone 17 Pro Max (SKU: MOBILE-001) created', 3, '2026-06-29 13:12:26.871'),
(54, 5, 'company@gmail.com', 'Start Company Pvt. Ltd.', 'CREATE', 'Invoice', 23, 'Invoice #INV-0001 created for Customer ID 10 with amount 13.2', 3, '2026-06-29 13:15:41.727'),
(55, 5, 'company@gmail.com', 'Start Company Pvt. Ltd.', 'CREATE', 'Receipt', 4, 'Receipt #RCV-0001 created for Customer ID 10 with amount 13.2', 3, '2026-06-29 13:31:05.949');

-- --------------------------------------------------------

--
-- Table structure for table `bankaccount`
--

CREATE TABLE `bankaccount` (
  `id` int(11) NOT NULL,
  `accountName` varchar(191) NOT NULL,
  `accountNumber` varchar(191) NOT NULL,
  `bankName` varchar(191) NOT NULL,
  `branchName` varchar(191) DEFAULT NULL,
  `ifscCode` varchar(191) DEFAULT NULL,
  `openingBalance` double NOT NULL DEFAULT 0,
  `currentBalance` double NOT NULL DEFAULT 0,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `banktransaction`
--

CREATE TABLE `banktransaction` (
  `id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `bankAccountId` int(11) NOT NULL,
  `transactionType` enum('DEPOSIT','WITHDRAWAL','TRANSFER') NOT NULL,
  `amount` double NOT NULL,
  `description` text DEFAULT NULL,
  `referenceNumber` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `category`
--

CREATE TABLE `category` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `category`
--

INSERT INTO `category` (`id`, `name`, `companyId`, `createdAt`, `updatedAt`) VALUES
(4, 'Mobile', 3, '2026-06-29 13:11:34.511', '2026-06-29 13:11:34.511');

-- --------------------------------------------------------

--
-- Table structure for table `company`
--

CREATE TABLE `company` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `logo` longtext DEFAULT NULL,
  `startDate` datetime(3) DEFAULT NULL,
  `endDate` datetime(3) DEFAULT NULL,
  `invoiceTemplate` varchar(191) NOT NULL DEFAULT 'New York',
  `invoiceColor` varchar(191) NOT NULL DEFAULT '#000000',
  `showQrCode` tinyint(1) NOT NULL DEFAULT 1,
  `invoiceLogo` longtext DEFAULT NULL,
  `planName` varchar(191) DEFAULT NULL,
  `planId` int(11) DEFAULT NULL,
  `planType` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `website` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `city` varchar(191) DEFAULT NULL,
  `state` varchar(191) DEFAULT NULL,
  `zip` varchar(191) DEFAULT NULL,
  `country` varchar(191) DEFAULT NULL,
  `currency` varchar(191) DEFAULT 'USD',
  `bankName` varchar(191) DEFAULT NULL,
  `accountHolder` varchar(191) DEFAULT NULL,
  `accountNumber` varchar(191) DEFAULT NULL,
  `ifsc` varchar(191) DEFAULT NULL,
  `terms` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `inventoryConfig` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`inventoryConfig`)),
  `customFieldsConfig` longtext DEFAULT NULL,
  `documentTitles` longtext DEFAULT NULL,
  `invoiceLabels` longtext DEFAULT NULL,
  `invoiceTableHeaders` longtext DEFAULT NULL,
  `paymentColor` varchar(191) DEFAULT '#004aad',
  `paymentLabels` longtext DEFAULT NULL,
  `paymentTableHeaders` longtext DEFAULT NULL,
  `paymentTemplate` varchar(191) DEFAULT 'New York',
  `receiptColor` varchar(191) DEFAULT '#004aad',
  `receiptLabels` longtext DEFAULT NULL,
  `receiptTableHeaders` longtext DEFAULT NULL,
  `receiptTemplate` varchar(191) DEFAULT 'New York',
  `termsCreditNote` text DEFAULT NULL,
  `termsInvoice` text DEFAULT NULL,
  `termsPurchase` text DEFAULT NULL,
  `termsQuotation` text DEFAULT NULL,
  `termsReceipt` text DEFAULT NULL,
  `termsSalesOrder` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `company`
--

INSERT INTO `company` (`id`, `name`, `email`, `logo`, `startDate`, `endDate`, `invoiceTemplate`, `invoiceColor`, `showQrCode`, `invoiceLogo`, `planName`, `planId`, `planType`, `phone`, `website`, `address`, `city`, `state`, `zip`, `country`, `currency`, `bankName`, `accountHolder`, `accountNumber`, `ifsc`, `terms`, `notes`, `createdAt`, `updatedAt`, `inventoryConfig`, `customFieldsConfig`, `documentTitles`, `invoiceLabels`, `invoiceTableHeaders`, `paymentColor`, `paymentLabels`, `paymentTableHeaders`, `paymentTemplate`, `receiptColor`, `receiptLabels`, `receiptTableHeaders`, `receiptTemplate`, `termsCreditNote`, `termsInvoice`, `termsPurchase`, `termsQuotation`, `termsReceipt`, `termsSalesOrder`) VALUES
(3, 'Start Company Pvt. Ltd.', 'company@gmail.com', 'https://res.cloudinary.com/dw48hcxi5/image/upload/v1782738481/company_logos/ikf4ac8roltokm9atvxh.png', '2026-06-29 00:00:00.000', '2027-06-29 00:00:00.000', 'Toronto', '#84cc16', 0, NULL, NULL, 1, 'Yearly', '1234567890', '', 'Address', 'City', 'State', '23456', 'United States', 'USD', 'HDFC', 'Zirakbook', '123456789076', '123456', '', '', '2026-06-29 13:07:31.537', '2026-06-29 13:15:04.764', '{\"reserveOnQuotation\":false,\"reserveOnSO\":false,\"challanAction\":\"ISSUE\",\"valuationMethod\":\"WAC\",\"negativeStockAllow\":true,\"batchTracking\":false,\"expiryTracking\":false,\"autoCogsEntry\":true,\"multiWarehouse\":false,\"defaultSalesWarehouseId\":\"3\",\"defaultPurchaseWarehouseId\":\"3\"}', '[]', '{\"invoice\":\"\",\"receipt\":\"\",\"payment\":\"\",\"salesreturn\":\"\",\"purchasebill\":\"\",\"purchasepayment\":\"\",\"purchasereturn\":\"\",\"salesorder\":\"\",\"quotation\":\"\",\"purchasequotation\":\"\",\"purchaseorder\":\"\",\"deliverychallan\":\"\",\"goodsreceipt\":\"\",\"posinvoice\":\"\",\"journalvoucher\":\"\",\"expense\":\"\",\"income\":\"\",\"contravoucher\":\"\",\"addcapital\":\"\",\"drawingcapital\":\"\"}', '{\"billTo\":\"Bill To:\",\"shipTo\":\"Ship To:\",\"subTotal\":\"Sub Total\",\"tax\":\"Tax\",\"total\":\"Total\",\"number\":\"Number:\",\"issue\":\"Issue:\",\"dueDate\":\"Due Date:\",\"showHeader\":true,\"showFooter\":true,\"showWarehouse\":true,\"showQty\":true,\"showUom\":true,\"showRate\":true,\"showTax\":true,\"showDiscount\":true}', '{\"item\":\"Item\",\"quantity\":\"Quantity\",\"rate\":\"Rate\",\"discount\":\"Discount\",\"tax\":\"Tax (%)\",\"price\":\"Price\",\"warehouse\":\"Warehouse\",\"uom\":\"UOM\"}', '#004aad', '{\"number\":\"Receipt No:\",\"date\":\"Payment Date:\",\"invoiceRef\":\"Invoice Ref:\",\"receivedFrom\":\"RECEIVED FROM:\",\"paidFrom\":\"Paid From:\",\"mode\":\"Payment Mode:\",\"refNo\":\"Ref No:\",\"discount\":\"Discount Received:\",\"discountAccount\":\"Discount Account:\",\"notes\":\"Remarks / Notes:\",\"signature\":\"AUTHORIZED SIGNATURE\",\"satisfaction\":\"The sum of {amount} {discountText} was received in full satisfaction of the mentioned account.\"}', '{\"billNumber\":\"Bill Number\",\"billDate\":\"Bill Date\",\"billAmount\":\"Bill Amount\",\"allocatedAmount\":\"Allocated Amount\",\"balanceDue\":\"Balance Due\"}', 'New York', '#004aad', '{\"number\":\"Receipt No:\",\"date\":\"Payment Date:\",\"invoiceRef\":\"Invoice Ref:\",\"receivedFrom\":\"Received From:\",\"receivedInto\":\"Received Into:\",\"mode\":\"Payment Mode:\",\"refNo\":\"Ref No:\",\"discount\":\"Discount Allowed:\",\"discountAccount\":\"Discount Account:\",\"notes\":\"Remarks / Notes:\",\"signature\":\"Authorized Signature\",\"satisfaction\":\"The sum of {amount} {discountText} was received in full satisfaction of the mentioned account.\"}', '{\"invoiceNumber\":\"Invoice Number\",\"invoiceDate\":\"Invoice Date\",\"invoiceAmount\":\"Invoice Amount\",\"allocatedAmount\":\"Allocated Amount\",\"balanceDue\":\"Balance Due\"}', 'New York', '', '', '', '', '', '');

-- --------------------------------------------------------

--
-- Table structure for table `customer`
--

CREATE TABLE `customer` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `nameArabic` varchar(191) DEFAULT NULL,
  `companyName` varchar(191) DEFAULT NULL,
  `companyLocation` text DEFAULT NULL,
  `profileImage` longtext DEFAULT NULL,
  `anyFile` longtext DEFAULT NULL,
  `accountType` varchar(191) DEFAULT NULL,
  `balanceType` varchar(191) NOT NULL DEFAULT 'Debit',
  `accountName` varchar(191) DEFAULT NULL,
  `accountBalance` double NOT NULL DEFAULT 0,
  `creationDate` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `bankAccountNumber` varchar(191) DEFAULT NULL,
  `bankIFSC` varchar(191) DEFAULT NULL,
  `bankNameBranch` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `creditPeriod` int(11) DEFAULT NULL,
  `gstNumber` varchar(191) DEFAULT NULL,
  `gstEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `billingName` varchar(191) DEFAULT NULL,
  `billingPhone` varchar(191) DEFAULT NULL,
  `billingAddress` text DEFAULT NULL,
  `billingCity` varchar(191) DEFAULT NULL,
  `billingState` varchar(191) DEFAULT NULL,
  `billingCountry` varchar(191) DEFAULT NULL,
  `billingZipCode` varchar(191) DEFAULT NULL,
  `shippingSameAsBilling` tinyint(1) NOT NULL DEFAULT 0,
  `shippingName` varchar(191) DEFAULT NULL,
  `shippingPhone` varchar(191) DEFAULT NULL,
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingCountry` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `ledgerId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer`
--

INSERT INTO `customer` (`id`, `name`, `nameArabic`, `companyName`, `companyLocation`, `profileImage`, `anyFile`, `accountType`, `balanceType`, `accountName`, `accountBalance`, `creationDate`, `bankAccountNumber`, `bankIFSC`, `bankNameBranch`, `phone`, `email`, `creditPeriod`, `gstNumber`, `gstEnabled`, `billingName`, `billingPhone`, `billingAddress`, `billingCity`, `billingState`, `billingCountry`, `billingZipCode`, `shippingSameAsBilling`, `shippingName`, `shippingPhone`, `shippingAddress`, `shippingCity`, `shippingState`, `shippingCountry`, `shippingZipCode`, `companyId`, `ledgerId`, `createdAt`, `updatedAt`) VALUES
(10, 'Jay', 'Jay', 'jay', 'Customer Address', 'https://res.cloudinary.com/dw48hcxi5/image/upload/v1782738510/customers/n75pp9jzznjxayx5km4a.jpg', '', 'Credit', 'Debit', 'Jay', 1000, '2026-06-29 00:00:00.000', 'BOI', 'BOI4152', 'BOI', '5244564566678', 'jay@gmail.com', 10, '1234567890abc', 1, 'Jay', '5244564566678', 'indore', 'indore', 'Madhya Pradesh', 'India', '4514465', 1, 'Jay', '5244564566678', 'indore', 'indore', 'Madhya Pradesh', 'India', '4514465', 3, 46, '2026-06-29 13:09:12.506', '2026-06-29 13:09:12.524');

-- --------------------------------------------------------

--
-- Table structure for table `dashboardannouncement`
--

CREATE TABLE `dashboardannouncement` (
  `id` int(11) NOT NULL,
  `title` varchar(191) NOT NULL,
  `content` text NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'Active',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `deliverychallan`
--

CREATE TABLE `deliverychallan` (
  `id` int(11) NOT NULL,
  `challanNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customerId` int(11) NOT NULL,
  `salesOrderId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('PENDING','DELIVERED','CANCELLED','CONVERTED') NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingEmail` varchar(191) DEFAULT NULL,
  `shippingPhone` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `transportNote` text DEFAULT NULL,
  `vehicleNo` varchar(191) DEFAULT NULL,
  `carrier` varchar(191) DEFAULT NULL,
  `manualReference` varchar(191) DEFAULT NULL,
  `customFields` text DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `deliverychallan`
--

INSERT INTO `deliverychallan` (`id`, `challanNumber`, `date`, `customerId`, `salesOrderId`, `companyId`, `notes`, `status`, `createdAt`, `updatedAt`, `shippingAddress`, `shippingCity`, `shippingEmail`, `shippingPhone`, `shippingState`, `shippingZipCode`, `remarks`, `transportNote`, `vehicleNo`, `carrier`, `manualReference`, `customFields`, `manualStatus`) VALUES
(22, 'DC-0001', '2026-06-29 13:15:33.916', 10, 13, 3, 'Quotation No: SQ-0001\nThank you for your business!', 'CONVERTED', '2026-06-29 13:15:33.919', '2026-06-29 13:15:41.727', 'indore', 'indore', 'jay@gmail.com', '5244564566678', 'Madhya Pradesh', '4514465', '\"Payment is due within 15 days.\",\n\"Goods once sold will not be taken back.\"', NULL, NULL, NULL, NULL, '{}', 0);

-- --------------------------------------------------------

--
-- Table structure for table `deliverychallanitem`
--

CREATE TABLE `deliverychallanitem` (
  `id` int(11) NOT NULL,
  `challanId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `quantity` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `deliverychallanitem`
--

INSERT INTO `deliverychallanitem` (`id`, `challanId`, `productId`, `warehouseId`, `quantity`, `createdAt`, `updatedAt`, `description`) VALUES
(39, 22, 4, 3, 1, '2026-06-29 13:15:33.919', '2026-06-29 13:15:33.919', 'IPhone 17 Pro Max');

-- --------------------------------------------------------

--
-- Table structure for table `expenseentry`
--

CREATE TABLE `expenseentry` (
  `id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expenseType` enum('DIRECT','INDIRECT') NOT NULL,
  `amount` double NOT NULL,
  `paymentMode` enum('CASH','BANK','CARD','UPI','CHEQUE','OTHER') NOT NULL,
  `description` text DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customFields` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `goodsreceiptnote`
--

CREATE TABLE `goodsreceiptnote` (
  `id` int(11) NOT NULL,
  `grnNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `vendorId` int(11) NOT NULL,
  `purchaseOrderId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'Received',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customFields` text DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `goodsreceiptnoteitem`
--

CREATE TABLE `goodsreceiptnoteitem` (
  `id` int(11) NOT NULL,
  `grnId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `quantity` double NOT NULL,
  `description` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `incomeentry`
--

CREATE TABLE `incomeentry` (
  `id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `incomeType` enum('PRODUCT_SALES','SERVICE_INCOME','OTHER_INCOME') NOT NULL,
  `amount` double NOT NULL,
  `paymentMode` enum('CASH','BANK','CARD','UPI','CHEQUE','OTHER') NOT NULL,
  `description` text DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customFields` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventoryadjustment`
--

CREATE TABLE `inventoryadjustment` (
  `id` int(11) NOT NULL,
  `voucherNo` varchar(191) NOT NULL,
  `manualVoucherNo` varchar(191) DEFAULT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `type` enum('ADD_STOCK','REMOVE_STOCK','ADJUST_VALUE') NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `note` text DEFAULT NULL,
  `totalValue` double NOT NULL DEFAULT 0,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventoryadjustmentitem`
--

CREATE TABLE `inventoryadjustmentitem` (
  `id` int(11) NOT NULL,
  `inventoryAdjustmentId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL DEFAULT 0,
  `narration` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventorytransaction`
--

CREATE TABLE `inventorytransaction` (
  `id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `type` enum('OPENING_STOCK','TRANSFER','ADJUSTMENT','PURCHASE','SALE','RETURN','GRN') NOT NULL,
  `productId` int(11) NOT NULL,
  `fromWarehouseId` int(11) DEFAULT NULL,
  `toWarehouseId` int(11) DEFAULT NULL,
  `quantity` double NOT NULL,
  `reason` text DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `userId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventorytransaction`
--

INSERT INTO `inventorytransaction` (`id`, `date`, `type`, `productId`, `fromWarehouseId`, `toWarehouseId`, `quantity`, `reason`, `companyId`, `createdAt`, `updatedAt`, `userId`) VALUES
(56, '2026-06-29 13:12:26.832', 'OPENING_STOCK', 4, NULL, 3, 100, 'Opening Stock', 3, '2026-06-29 13:12:26.832', '2026-06-29 13:12:26.832', 5),
(57, '2026-06-29 13:54:25.964', 'RETURN', 4, NULL, 3, 1, 'Sales Return: CN-0001', 3, '2026-06-29 13:54:25.964', '2026-06-29 13:54:25.964', 5);

-- --------------------------------------------------------

--
-- Table structure for table `inventory_batch`
--

CREATE TABLE `inventory_batch` (
  `id` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `purchaseBillId` int(11) DEFAULT NULL,
  `qtyReceived` double NOT NULL,
  `qtyRemaining` double NOT NULL,
  `rate` double NOT NULL,
  `batchNumber` varchar(191) DEFAULT NULL,
  `expiryDate` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_batch`
--

INSERT INTO `inventory_batch` (`id`, `productId`, `warehouseId`, `purchaseBillId`, `qtyReceived`, `qtyRemaining`, `rate`, `batchNumber`, `expiryDate`, `createdAt`, `updatedAt`) VALUES
(9, 4, 3, NULL, 100, 99, 10, NULL, NULL, '2026-06-29 13:12:26.859', '2026-06-29 13:15:41.697');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_consumption`
--

CREATE TABLE `inventory_consumption` (
  `id` int(11) NOT NULL,
  `invoiceId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `batchId` int(11) NOT NULL,
  `qtyUsed` double NOT NULL,
  `rateUsed` double NOT NULL,
  `totalCost` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_consumption`
--

INSERT INTO `inventory_consumption` (`id`, `invoiceId`, `productId`, `batchId`, `qtyUsed`, `rateUsed`, `totalCost`, `createdAt`) VALUES
(5, 23, 4, 9, 1, 10, 10, '2026-06-29 13:15:41.692');

-- --------------------------------------------------------

--
-- Table structure for table `invoice`
--

CREATE TABLE `invoice` (
  `id` int(11) NOT NULL,
  `invoiceNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `dueDate` datetime(3) DEFAULT NULL,
  `customerId` int(11) NOT NULL,
  `companyId` int(11) NOT NULL,
  `subtotal` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `taxAmount` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `paidAmount` double NOT NULL DEFAULT 0,
  `balanceAmount` double NOT NULL,
  `status` enum('UNPAID','PARTIAL','PAID','CANCELLED','COMPLETED') NOT NULL DEFAULT 'UNPAID',
  `salesOrderId` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `deliveryChallanId` int(11) DEFAULT NULL,
  `billingAddress` text DEFAULT NULL,
  `billingCity` varchar(191) DEFAULT NULL,
  `billingCountry` varchar(191) DEFAULT NULL,
  `billingName` varchar(191) DEFAULT NULL,
  `billingState` varchar(191) DEFAULT NULL,
  `billingZipCode` varchar(191) DEFAULT NULL,
  `overallDiscount` double NOT NULL DEFAULT 0,
  `overallDiscountType` varchar(191) NOT NULL DEFAULT 'percentage',
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingCountry` varchar(191) DEFAULT NULL,
  `shippingName` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `currency` varchar(191) DEFAULT 'USD',
  `customFields` text DEFAULT NULL,
  `exchangeRate` double DEFAULT 1,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoice`
--

INSERT INTO `invoice` (`id`, `invoiceNumber`, `date`, `dueDate`, `customerId`, `companyId`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `paidAmount`, `balanceAmount`, `status`, `salesOrderId`, `notes`, `createdAt`, `updatedAt`, `deliveryChallanId`, `billingAddress`, `billingCity`, `billingCountry`, `billingName`, `billingState`, `billingZipCode`, `overallDiscount`, `overallDiscountType`, `shippingAddress`, `shippingCity`, `shippingCountry`, `shippingName`, `shippingState`, `shippingZipCode`, `currency`, `customFields`, `exchangeRate`, `manualStatus`) VALUES
(23, 'INV-0001', '2026-06-29 00:00:00.000', '2026-06-29 00:00:00.000', 10, 3, 12, 0, 1.2, 13.2, 13.2, 0, 'PAID', 13, 'Quotation No: SQ-0001\nThank you for your business!', '2026-06-29 13:15:41.602', '2026-06-29 13:54:25.983', 22, 'indore', 'indore', 'India', 'Jay', 'Madhya Pradesh', '4514465', 0, 'amount', 'indore', 'indore', 'India', 'Jay', 'Madhya Pradesh', '4514465', 'USD', NULL, 1, 0);

-- --------------------------------------------------------

--
-- Table structure for table `invoiceitem`
--

CREATE TABLE `invoiceitem` (
  `id` int(11) NOT NULL,
  `invoiceId` int(11) NOT NULL,
  `productId` int(11) DEFAULT NULL,
  `serviceId` int(11) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `discount` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `warehouseId` int(11) DEFAULT NULL,
  `uomId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoiceitem`
--

INSERT INTO `invoiceitem` (`id`, `invoiceId`, `productId`, `serviceId`, `description`, `quantity`, `rate`, `discount`, `amount`, `taxRate`, `createdAt`, `updatedAt`, `warehouseId`, `uomId`) VALUES
(27, 23, 4, NULL, 'IPhone 17 Pro Max', 1, 12, 0, 13.2, 10, '2026-06-29 13:15:41.602', '2026-06-29 13:15:41.602', 3, 2);

-- --------------------------------------------------------

--
-- Table structure for table `journalentry`
--

CREATE TABLE `journalentry` (
  `id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `voucherNumber` varchar(191) NOT NULL,
  `narration` text DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `source` varchar(191) DEFAULT 'system'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `journalentry`
--

INSERT INTO `journalentry` (`id`, `date`, `voucherNumber`, `narration`, `companyId`, `createdAt`, `updatedAt`, `source`) VALUES
(34, '2026-06-29 00:00:00.000', 'INV-0001', 'Sales Invoice: INV-0001', 3, '2026-06-29 13:15:41.634', '2026-06-29 13:15:41.634', 'system');

-- --------------------------------------------------------

--
-- Table structure for table `ledger`
--

CREATE TABLE `ledger` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `groupId` int(11) NOT NULL,
  `subGroupId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `openingBalance` double NOT NULL DEFAULT 0,
  `currentBalance` double NOT NULL DEFAULT 0,
  `isControlAccount` tinyint(1) NOT NULL DEFAULT 0,
  `isEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `description` text DEFAULT NULL,
  `parentLedgerId` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `vendorId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ledger`
--

INSERT INTO `ledger` (`id`, `name`, `groupId`, `subGroupId`, `companyId`, `openingBalance`, `currentBalance`, `isControlAccount`, `isEnabled`, `description`, `parentLedgerId`, `customerId`, `vendorId`, `createdAt`, `updatedAt`, `date`) VALUES
(31, 'Cash in Hand', 6, 13, 3, 0, 13.2, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.601', '2026-06-29 13:31:05.918', '2026-06-29 13:07:31.601'),
(32, 'Main Bank Account', 6, 14, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.615', '2026-06-29 13:07:31.615', '2026-06-29 13:07:31.615'),
(33, 'Inventory Asset', 6, 16, 3, 0, 1000, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.631', '2026-06-29 13:54:26.073', '2026-06-29 13:07:31.631'),
(34, 'VAT / Sales Tax Payable', 7, 19, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.663', '2026-06-29 13:54:26.023', '2026-06-29 13:07:31.663'),
(35, 'Owner Investment / Capital', 8, 21, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.681', '2026-06-29 13:07:31.681', '2026-06-29 13:07:31.681'),
(36, 'Opening Balance Equity', 8, 22, 3, 0, -1000, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.690', '2026-06-29 13:12:26.829', '2026-06-29 13:07:31.690'),
(37, 'Retained Earnings', 8, 22, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.697', '2026-06-29 13:07:31.697', '2026-06-29 13:07:31.697'),
(38, 'Sales Revenue', 9, 23, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.709', '2026-06-29 13:07:31.709', '2026-06-29 13:07:31.709'),
(39, 'Discount Received on Purchase', 9, 24, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.720', '2026-06-29 13:07:31.720', '2026-06-29 13:07:31.720'),
(40, 'Cost of Goods Sold', 10, 25, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.732', '2026-06-29 13:54:26.080', '2026-06-29 13:07:31.732'),
(41, 'Rent Expense', 10, 26, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.742', '2026-06-29 13:07:31.742', '2026-06-29 13:07:31.742'),
(42, 'Electricity & Utilities', 10, 26, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.747', '2026-06-29 13:07:31.747', '2026-06-29 13:07:31.747'),
(43, 'Salary & Wages', 10, 26, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.751', '2026-06-29 13:07:31.751', '2026-06-29 13:07:31.751'),
(44, 'Inventory Adjustment Expense', 10, 26, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.756', '2026-06-29 13:07:31.756', '2026-06-29 13:07:31.756'),
(45, 'Discount Allowed on Sale', 10, 26, 3, 0, 0, 0, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:07:31.762', '2026-06-29 13:07:31.762', '2026-06-29 13:07:31.762'),
(46, 'Jay', 6, 15, 3, 1000, 986.8, 0, 1, 'Customer Ledger for Jay', NULL, 10, NULL, '2026-06-29 13:09:12.506', '2026-06-29 13:54:26.005', '2026-06-29 13:09:12.506'),
(47, 'Rahul', 7, 18, 3, 1000, 1000, 0, 1, 'Vendor Ledger for Rahul', NULL, NULL, 10, '2026-06-29 13:10:07.349', '2026-06-29 13:10:07.419', '2026-06-29 13:10:07.349'),
(48, 'Sales Income', 9, NULL, 3, 0, 12, 1, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:15:41.578', '2026-06-29 13:15:41.659', '2026-06-29 13:15:41.578'),
(49, 'Purchases', 10, NULL, 3, 0, 0, 1, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:15:41.595', '2026-06-29 13:15:41.595', '2026-06-29 13:15:41.595'),
(50, 'Sales Return', 10, NULL, 3, 0, 12, 1, 1, NULL, NULL, NULL, NULL, '2026-06-29 13:54:25.904', '2026-06-29 13:54:26.001', '2026-06-29 13:54:25.904');

-- --------------------------------------------------------

--
-- Table structure for table `passwordrequest`
--

CREATE TABLE `passwordrequest` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'Pending',
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment`
--

CREATE TABLE `payment` (
  `id` int(11) NOT NULL,
  `paymentNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `vendorId` int(11) NOT NULL,
  `purchaseBillId` int(11) DEFAULT NULL,
  `amount` double NOT NULL,
  `paymentMode` enum('CASH','BANK','CARD','UPI','CHEQUE','OTHER') NOT NULL,
  `referenceNumber` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `cashBankAccountId` int(11) DEFAULT NULL,
  `customFields` text DEFAULT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `discountLedgerId` int(11) DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(191) NOT NULL DEFAULT 'CLEARED'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paymentbillallocation`
--

CREATE TABLE `paymentbillallocation` (
  `id` int(11) NOT NULL,
  `paymentId` int(11) NOT NULL,
  `purchaseBillId` int(11) NOT NULL,
  `amount` double NOT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paymentrecord`
--

CREATE TABLE `paymentrecord` (
  `id` int(11) NOT NULL,
  `transactionId` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customer` varchar(191) NOT NULL,
  `paymentMethod` varchar(191) NOT NULL,
  `amount` double NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'Pending',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `plan`
--

CREATE TABLE `plan` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `basePrice` double NOT NULL DEFAULT 0,
  `currency` varchar(191) NOT NULL DEFAULT 'USD',
  `invoiceLimit` varchar(191) NOT NULL DEFAULT '0',
  `additionalInvoicePrice` double NOT NULL DEFAULT 0,
  `userLimit` varchar(191) NOT NULL DEFAULT '0',
  `storageCapacity` varchar(191) NOT NULL DEFAULT '0',
  `billingCycle` varchar(191) NOT NULL DEFAULT 'Monthly',
  `status` varchar(191) NOT NULL DEFAULT 'Active',
  `modules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`modules`)),
  `totalPrice` double NOT NULL DEFAULT 0,
  `descriptions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`descriptions`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `plan`
--

INSERT INTO `plan` (`id`, `name`, `basePrice`, `currency`, `invoiceLimit`, `additionalInvoicePrice`, `userLimit`, `storageCapacity`, `billingCycle`, `status`, `modules`, `totalPrice`, `descriptions`, `createdAt`, `updatedAt`) VALUES
(1, 'Pro Plan', 100, 'USD', '10 invoices', 50, 'Unlimited', '5 GB', 'Yearly', 'Active', '[{\"name\":\"Account\",\"price\":0,\"enabled\":true},{\"name\":\"Inventory\",\"price\":0,\"enabled\":true},{\"name\":\"POS\",\"price\":0,\"enabled\":true},{\"name\":\"Sales\",\"price\":0,\"enabled\":true},{\"name\":\"Purchase\",\"price\":0,\"enabled\":true},{\"name\":\"GST Report\",\"price\":0,\"enabled\":true},{\"name\":\"User Management\",\"price\":0,\"enabled\":true}]', 100, '[\"\"]', '2026-06-29 13:06:55.513', '2026-06-29 13:06:55.513');

-- --------------------------------------------------------

--
-- Table structure for table `planrequest`
--

CREATE TABLE `planrequest` (
  `id` int(11) NOT NULL,
  `companyName` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `planId` int(11) DEFAULT NULL,
  `planName` varchar(191) DEFAULT NULL,
  `billingCycle` varchar(191) NOT NULL DEFAULT 'Monthly',
  `startDate` datetime(3) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'Pending',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `address` text DEFAULT NULL,
  `logo` longtext DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `posinvoice`
--

CREATE TABLE `posinvoice` (
  `id` int(11) NOT NULL,
  `invoiceNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customerId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `subtotal` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `taxAmount` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `paidAmount` double NOT NULL DEFAULT 0,
  `balanceAmount` double NOT NULL DEFAULT 0,
  `paymentMode` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'Paid',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customFields` text DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `posinvoiceitem`
--

CREATE TABLE `posinvoiceitem` (
  `id` int(11) NOT NULL,
  `posInvoiceId` int(11) NOT NULL,
  `productId` int(11) DEFAULT NULL,
  `warehouseId` int(11) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `amount` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `uomId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product`
--

CREATE TABLE `product` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `sku` varchar(191) DEFAULT NULL,
  `hsn` varchar(191) DEFAULT NULL,
  `barcode` varchar(191) DEFAULT NULL,
  `image` longtext DEFAULT NULL,
  `categoryId` int(11) DEFAULT NULL,
  `uomId` int(11) DEFAULT NULL,
  `unit` varchar(191) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `asOfDate` datetime(3) DEFAULT NULL,
  `taxAccount` varchar(191) DEFAULT NULL,
  `initialCost` double NOT NULL DEFAULT 0,
  `salePrice` double NOT NULL DEFAULT 0,
  `purchasePrice` double NOT NULL DEFAULT 0,
  `discount` double NOT NULL DEFAULT 0,
  `remarks` text DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `averageCost` double NOT NULL DEFAULT 0,
  `purchaseUomId` int(11) DEFAULT NULL,
  `salesUomId` int(11) DEFAULT NULL,
  `totalInventoryValue` double NOT NULL DEFAULT 0,
  `totalQty` double NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `product`
--

INSERT INTO `product` (`id`, `name`, `sku`, `hsn`, `barcode`, `image`, `categoryId`, `uomId`, `unit`, `description`, `asOfDate`, `taxAccount`, `initialCost`, `salePrice`, `purchasePrice`, `discount`, `remarks`, `companyId`, `createdAt`, `updatedAt`, `averageCost`, `purchaseUomId`, `salesUomId`, `totalInventoryValue`, `totalQty`) VALUES
(4, 'IPhone 17 Pro Max', 'MOBILE-001', '6468', '544634', 'https://res.cloudinary.com/dw48hcxi5/image/upload/v1782738691/products/mm3vmgljs4vrviywydew.png', 4, 2, NULL, 'Mobile Testing', '2026-06-29 00:00:00.000', NULL, 10, 12, 10, 0, 'Testing', 3, '2026-06-29 13:12:26.832', '2026-06-29 13:15:41.701', 10, 2, 2, 990, 99);

-- --------------------------------------------------------

--
-- Table structure for table `purchasebill`
--

CREATE TABLE `purchasebill` (
  `id` int(11) NOT NULL,
  `billNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `dueDate` datetime(3) DEFAULT NULL,
  `vendorId` int(11) NOT NULL,
  `companyId` int(11) NOT NULL,
  `subtotal` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `taxAmount` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `paidAmount` double NOT NULL DEFAULT 0,
  `balanceAmount` double NOT NULL,
  `status` enum('UNPAID','PARTIAL','PAID','CANCELLED','COMPLETED') NOT NULL DEFAULT 'UNPAID',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `grnId` int(11) DEFAULT NULL,
  `purchaseOrderId` int(11) DEFAULT NULL,
  `billingAddress` text DEFAULT NULL,
  `billingCity` varchar(191) DEFAULT NULL,
  `billingCountry` varchar(191) DEFAULT NULL,
  `billingName` varchar(191) DEFAULT NULL,
  `billingState` varchar(191) DEFAULT NULL,
  `billingZipCode` varchar(191) DEFAULT NULL,
  `overallDiscount` double NOT NULL DEFAULT 0,
  `overallDiscountType` varchar(191) NOT NULL DEFAULT 'percentage',
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingCountry` varchar(191) DEFAULT NULL,
  `shippingName` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `currency` varchar(191) DEFAULT 'USD',
  `customFields` text DEFAULT NULL,
  `exchangeRate` double DEFAULT 1,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchasebillitem`
--

CREATE TABLE `purchasebillitem` (
  `id` int(11) NOT NULL,
  `purchaseBillId` int(11) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `discount` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `productId` int(11) DEFAULT NULL,
  `warehouseId` int(11) DEFAULT NULL,
  `uomId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchaseorder`
--

CREATE TABLE `purchaseorder` (
  `id` int(11) NOT NULL,
  `orderNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expectedDate` datetime(3) DEFAULT NULL,
  `vendorId` int(11) NOT NULL,
  `quotationId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `subtotal` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `taxAmount` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `status` enum('PENDING','PARTIAL','COMPLETED','CANCELLED','CONVERTED') NOT NULL DEFAULT 'PENDING',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `billingAddress` text DEFAULT NULL,
  `billingCity` varchar(191) DEFAULT NULL,
  `billingCountry` varchar(191) DEFAULT NULL,
  `billingName` varchar(191) DEFAULT NULL,
  `billingState` varchar(191) DEFAULT NULL,
  `billingZipCode` varchar(191) DEFAULT NULL,
  `overallDiscount` double NOT NULL DEFAULT 0,
  `overallDiscountType` varchar(191) NOT NULL DEFAULT 'percentage',
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingCountry` varchar(191) DEFAULT NULL,
  `shippingName` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `customFields` text DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0,
  `terms` text DEFAULT NULL,
  `manualReference` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchaseorderitem`
--

CREATE TABLE `purchaseorderitem` (
  `id` int(11) NOT NULL,
  `orderId` int(11) NOT NULL,
  `productId` int(11) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `discount` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `warehouseId` int(11) DEFAULT NULL,
  `uomId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchasequotation`
--

CREATE TABLE `purchasequotation` (
  `id` int(11) NOT NULL,
  `quotationNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expiryDate` datetime(3) DEFAULT NULL,
  `vendorId` int(11) NOT NULL,
  `companyId` int(11) NOT NULL,
  `subtotal` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `taxAmount` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `status` enum('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED','CONVERTED') NOT NULL DEFAULT 'DRAFT',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `attachments` text DEFAULT NULL,
  `manualReference` varchar(191) DEFAULT NULL,
  `terms` text DEFAULT NULL,
  `overallDiscount` double NOT NULL DEFAULT 0,
  `overallDiscountType` varchar(191) NOT NULL DEFAULT 'percentage',
  `customFields` text DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchasequotationitem`
--

CREATE TABLE `purchasequotationitem` (
  `id` int(11) NOT NULL,
  `quotationId` int(11) NOT NULL,
  `productId` int(11) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `discount` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `warehouseId` int(11) DEFAULT NULL,
  `uomId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchasereturn`
--

CREATE TABLE `purchasereturn` (
  `id` int(11) NOT NULL,
  `returnNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `vendorId` int(11) NOT NULL,
  `purchaseBillId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `totalAmount` double NOT NULL,
  `reason` text DEFAULT NULL,
  `status` enum('Pending','Processed','Rejected','Draft') NOT NULL DEFAULT 'Pending',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customFields` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchasereturnitem`
--

CREATE TABLE `purchasereturnitem` (
  `id` int(11) NOT NULL,
  `purchaseReturnId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `amount` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `discount` double NOT NULL DEFAULT 0,
  `taxRate` double NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `receipt`
--

CREATE TABLE `receipt` (
  `id` int(11) NOT NULL,
  `receiptNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customerId` int(11) NOT NULL,
  `invoiceId` int(11) DEFAULT NULL,
  `amount` double NOT NULL,
  `paymentMode` enum('CASH','BANK','CARD','UPI','CHEQUE','OTHER') NOT NULL,
  `referenceNumber` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `cashBankAccountId` int(11) DEFAULT NULL,
  `customFields` text DEFAULT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `discountLedgerId` int(11) DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(191) NOT NULL DEFAULT 'CLEARED'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `receipt`
--

INSERT INTO `receipt` (`id`, `receiptNumber`, `date`, `customerId`, `invoiceId`, `amount`, `paymentMode`, `referenceNumber`, `companyId`, `notes`, `createdAt`, `updatedAt`, `cashBankAccountId`, `customFields`, `discountAmount`, `discountLedgerId`, `manualStatus`, `status`) VALUES
(4, 'RCV-0001', '2026-06-29 00:00:00.000', 10, 23, 13.2, 'BANK', '', 3, '', '2026-06-29 13:31:05.877', '2026-06-29 13:31:05.877', 31, '{}', 0, NULL, 0, 'CLEARED');

-- --------------------------------------------------------

--
-- Table structure for table `receiptinvoiceallocation`
--

CREATE TABLE `receiptinvoiceallocation` (
  `id` int(11) NOT NULL,
  `receiptId` int(11) NOT NULL,
  `invoiceId` int(11) NOT NULL,
  `amount` double NOT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `receiptinvoiceallocation`
--

INSERT INTO `receiptinvoiceallocation` (`id`, `receiptId`, `invoiceId`, `amount`, `companyId`, `createdAt`, `updatedAt`) VALUES
(2, 4, 23, 13.2, 3, '2026-06-29 13:31:05.892', '2026-06-29 13:31:05.892');

-- --------------------------------------------------------

--
-- Table structure for table `role`
--

CREATE TABLE `role` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `permissions` text NOT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role`
--

INSERT INTO `role` (`id`, `name`, `permissions`, `companyId`, `createdAt`, `updatedAt`) VALUES
(2, 'COMPANY', '[\"show dashboard\",\"manage voucher\",\"create voucher\",\"edit voucher\",\"delete voucher\",\"manage reports\",\"view reports\",\"manage user\",\"create user\",\"edit user\",\"delete user\",\"manage role\",\"create role\",\"edit role\",\"delete role\",\"manage settings\",\"edit settings\",\"view settings\",\"manage accounts\",\"create accounts\",\"edit accounts\",\"delete accounts\",\"view accounts\",\"manage inventory\",\"create inventory\",\"edit inventory\",\"delete inventory\",\"view inventory\",\"manage pos\",\"create pos\",\"edit pos\",\"delete pos\",\"view pos\",\"manage sales\",\"create sales\",\"edit sales\",\"delete sales\",\"show sales\",\"send sales\",\"view sales\",\"manage purchases\",\"create purchases\",\"edit purchases\",\"delete purchases\",\"view purchases\"]', 3, '2026-06-29 13:07:31.553', '2026-06-29 13:07:31.553');

-- --------------------------------------------------------

--
-- Table structure for table `salesorder`
--

CREATE TABLE `salesorder` (
  `id` int(11) NOT NULL,
  `orderNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expectedDate` datetime(3) DEFAULT NULL,
  `customerId` int(11) NOT NULL,
  `quotationId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `subtotal` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `taxAmount` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `status` enum('PENDING','PARTIAL','COMPLETED','CANCELLED','CONVERTED') NOT NULL DEFAULT 'PENDING',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `billingAddress` text DEFAULT NULL,
  `billingCity` varchar(191) DEFAULT NULL,
  `billingCountry` varchar(191) DEFAULT NULL,
  `billingName` varchar(191) DEFAULT NULL,
  `billingState` varchar(191) DEFAULT NULL,
  `billingZipCode` varchar(191) DEFAULT NULL,
  `overallDiscount` double NOT NULL DEFAULT 0,
  `overallDiscountType` varchar(191) NOT NULL DEFAULT 'percentage',
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingCountry` varchar(191) DEFAULT NULL,
  `shippingName` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `customFields` text DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0,
  `terms` text DEFAULT NULL,
  `manualReference` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesorder`
--

INSERT INTO `salesorder` (`id`, `orderNumber`, `date`, `expectedDate`, `customerId`, `quotationId`, `companyId`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `status`, `notes`, `createdAt`, `updatedAt`, `billingAddress`, `billingCity`, `billingCountry`, `billingName`, `billingState`, `billingZipCode`, `overallDiscount`, `overallDiscountType`, `shippingAddress`, `shippingCity`, `shippingCountry`, `shippingName`, `shippingState`, `shippingZipCode`, `customFields`, `manualStatus`, `terms`, `manualReference`) VALUES
(13, 'SO-0001', '2026-06-29 13:15:20.070', NULL, 10, 10, 3, 12, 0, 1.2, 13.2, 'COMPLETED', 'Quotation No: SQ-0001\nThank you for your business!', '2026-06-29 13:15:20.072', '2026-06-29 13:15:41.718', 'indore', 'indore', 'India', 'Jay', 'Madhya Pradesh', '4514465', 0, 'amount', 'indore', 'indore', 'India', 'Jay', 'Madhya Pradesh', '4514465', '{}', 0, '\"Payment is due within 15 days.\",\n\"Goods once sold will not be taken back.\"', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `salesorderitem`
--

CREATE TABLE `salesorderitem` (
  `id` int(11) NOT NULL,
  `orderId` int(11) NOT NULL,
  `productId` int(11) DEFAULT NULL,
  `serviceId` int(11) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `discount` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `warehouseId` int(11) DEFAULT NULL,
  `uomId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesorderitem`
--

INSERT INTO `salesorderitem` (`id`, `orderId`, `productId`, `serviceId`, `description`, `quantity`, `rate`, `discount`, `amount`, `taxRate`, `createdAt`, `updatedAt`, `warehouseId`, `uomId`) VALUES
(31, 13, 4, NULL, 'IPhone 17 Pro Max', 1, 12, 0, 13.2, 10, '2026-06-29 13:15:20.072', '2026-06-29 13:15:20.072', 3, 2);

-- --------------------------------------------------------

--
-- Table structure for table `salesquotation`
--

CREATE TABLE `salesquotation` (
  `id` int(11) NOT NULL,
  `quotationNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expiryDate` datetime(3) DEFAULT NULL,
  `customerId` int(11) NOT NULL,
  `companyId` int(11) NOT NULL,
  `subtotal` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT 0,
  `taxAmount` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `status` enum('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED','CONVERTED') NOT NULL DEFAULT 'DRAFT',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `billingAddress` text DEFAULT NULL,
  `billingCity` varchar(191) DEFAULT NULL,
  `billingName` varchar(191) DEFAULT NULL,
  `billingState` varchar(191) DEFAULT NULL,
  `billingZipCode` varchar(191) DEFAULT NULL,
  `overallDiscount` double NOT NULL DEFAULT 0,
  `overallDiscountType` varchar(191) NOT NULL DEFAULT 'amount',
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingName` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `customFields` text DEFAULT NULL,
  `manualStatus` tinyint(1) NOT NULL DEFAULT 0,
  `terms` text DEFAULT NULL,
  `manualReference` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesquotation`
--

INSERT INTO `salesquotation` (`id`, `quotationNumber`, `date`, `expiryDate`, `customerId`, `companyId`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `status`, `notes`, `createdAt`, `updatedAt`, `billingAddress`, `billingCity`, `billingName`, `billingState`, `billingZipCode`, `overallDiscount`, `overallDiscountType`, `shippingAddress`, `shippingCity`, `shippingName`, `shippingState`, `shippingZipCode`, `customFields`, `manualStatus`, `terms`, `manualReference`) VALUES
(10, 'SQ-0001', '2026-06-29 00:00:00.000', '2026-06-29 00:00:00.000', 10, 3, 12, 0, 1.2, 13.2, 'CONVERTED', 'Thank you for your business!', '2026-06-29 13:13:41.767', '2026-06-29 13:15:20.086', NULL, NULL, NULL, NULL, NULL, 0, 'amount', NULL, NULL, NULL, NULL, NULL, '{}', 0, '\"Payment is due within 15 days.\",\n\"Goods once sold will not be taken back.\"', '12');

-- --------------------------------------------------------

--
-- Table structure for table `salesquotationitem`
--

CREATE TABLE `salesquotationitem` (
  `id` int(11) NOT NULL,
  `quotationId` int(11) NOT NULL,
  `productId` int(11) DEFAULT NULL,
  `serviceId` int(11) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `discount` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `warehouseId` int(11) DEFAULT NULL,
  `uomId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesquotationitem`
--

INSERT INTO `salesquotationitem` (`id`, `quotationId`, `productId`, `serviceId`, `description`, `quantity`, `rate`, `discount`, `amount`, `taxRate`, `createdAt`, `updatedAt`, `warehouseId`, `uomId`) VALUES
(22, 10, 4, NULL, 'IPhone 17 Pro Max', 1, 12, 0, 13.2, 10, '2026-06-29 13:13:41.767', '2026-06-29 13:13:41.767', 3, 2);

-- --------------------------------------------------------

--
-- Table structure for table `salesreturn`
--

CREATE TABLE `salesreturn` (
  `id` int(11) NOT NULL,
  `returnNumber` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customerId` int(11) NOT NULL,
  `invoiceId` int(11) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `totalAmount` double NOT NULL,
  `reason` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `autoVoucherNo` varchar(191) DEFAULT NULL,
  `manualVoucherNo` varchar(191) DEFAULT NULL,
  `status` enum('Pending','Processed','Rejected','Draft') NOT NULL DEFAULT 'Pending',
  `customFields` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesreturn`
--

INSERT INTO `salesreturn` (`id`, `returnNumber`, `date`, `customerId`, `invoiceId`, `companyId`, `totalAmount`, `reason`, `createdAt`, `updatedAt`, `autoVoucherNo`, `manualVoucherNo`, `status`, `customFields`) VALUES
(3, 'CN-0001', '2026-06-29 00:00:00.000', 10, 23, 3, 13.2, 'Sales Return', '2026-06-29 13:54:25.932', '2026-06-29 13:54:25.932', 'SRT-000001', NULL, 'Pending', '{}');

-- --------------------------------------------------------

--
-- Table structure for table `salesreturnitem`
--

CREATE TABLE `salesreturnitem` (
  `id` int(11) NOT NULL,
  `salesReturnId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL,
  `amount` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `discount` double NOT NULL DEFAULT 0,
  `taxRate` double NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesreturnitem`
--

INSERT INTO `salesreturnitem` (`id`, `salesReturnId`, `productId`, `warehouseId`, `quantity`, `rate`, `amount`, `createdAt`, `updatedAt`, `discount`, `taxRate`) VALUES
(3, 3, 4, 3, 1, 12, 13.2, '2026-06-29 13:54:25.932', '2026-06-29 13:54:25.932', 0, 10);

-- --------------------------------------------------------

--
-- Table structure for table `service`
--

CREATE TABLE `service` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `sku` varchar(191) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `uomId` int(11) NOT NULL,
  `price` double NOT NULL,
  `taxRate` double NOT NULL DEFAULT 0,
  `allowInInvoices` tinyint(1) NOT NULL DEFAULT 1,
  `remarks` text DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shippingaddress`
--

CREATE TABLE `shippingaddress` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `address` text NOT NULL,
  `city` varchar(191) DEFAULT NULL,
  `state` varchar(191) DEFAULT NULL,
  `country` varchar(191) DEFAULT NULL,
  `zipCode` varchar(191) DEFAULT NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT 0,
  `customerId` int(11) DEFAULT NULL,
  `vendorId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shippingaddress`
--

INSERT INTO `shippingaddress` (`id`, `name`, `phone`, `address`, `city`, `state`, `country`, `zipCode`, `isDefault`, `customerId`, `vendorId`, `createdAt`, `updatedAt`) VALUES
(3, 'Jay', '5244564566678', 'indore', 'indore', 'Madhya Pradesh', 'India', '4514465', 1, 10, NULL, '2026-06-29 13:09:12.506', '2026-06-29 13:09:12.506'),
(4, 'Rahul', '94564566678', 'indore', 'indore', 'Madhya Pradesh', 'India', '4514465', 1, NULL, 10, '2026-06-29 13:10:07.349', '2026-06-29 13:10:07.349');

-- --------------------------------------------------------

--
-- Table structure for table `stock`
--

CREATE TABLE `stock` (
  `id` int(11) NOT NULL,
  `warehouseId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `quantity` double NOT NULL DEFAULT 0,
  `minOrderQty` double NOT NULL DEFAULT 0,
  `initialQty` double NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `reservedQuantity` double NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `stock`
--

INSERT INTO `stock` (`id`, `warehouseId`, `productId`, `quantity`, `minOrderQty`, `initialQty`, `createdAt`, `updatedAt`, `reservedQuantity`) VALUES
(16, 3, 4, 101, 10, 0, '2026-06-29 13:12:26.832', '2026-06-29 13:54:25.950', 0);

-- --------------------------------------------------------

--
-- Table structure for table `stocktransfer`
--

CREATE TABLE `stocktransfer` (
  `id` int(11) NOT NULL,
  `voucherNo` varchar(191) NOT NULL,
  `manualVoucherNo` varchar(191) DEFAULT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `toWarehouseId` int(11) NOT NULL,
  `narration` text DEFAULT NULL,
  `totalAmount` double NOT NULL DEFAULT 0,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stocktransferitem`
--

CREATE TABLE `stocktransferitem` (
  `id` int(11) NOT NULL,
  `stockTransferId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `fromWarehouseId` int(11) NOT NULL,
  `quantity` double NOT NULL,
  `rate` double NOT NULL DEFAULT 0,
  `amount` double NOT NULL DEFAULT 0,
  `narration` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `transaction`
--

CREATE TABLE `transaction` (
  `id` int(11) NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `debitLedgerId` int(11) NOT NULL,
  `creditLedgerId` int(11) NOT NULL,
  `amount` double NOT NULL,
  `narration` text DEFAULT NULL,
  `voucherType` enum('JOURNAL','SALES','PURCHASE','RECEIPT','PAYMENT','CONTRA','EXPENSE','INCOME','QUOTATION','SALES_ORDER','DELIVERY_CHALLAN','SALES_RETURN','CREDIT_NOTE','DEBIT_NOTE','PURCHASE_QUOTATION','PURCHASE_ORDER','GRN','PURCHASE_RETURN','POS_INVOICE') NOT NULL,
  `voucherNumber` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `journalEntryId` int(11) DEFAULT NULL,
  `invoiceId` int(11) DEFAULT NULL,
  `purchaseBillId` int(11) DEFAULT NULL,
  `receiptId` int(11) DEFAULT NULL,
  `paymentId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `posInvoiceId` int(11) DEFAULT NULL,
  `logo` longtext DEFAULT NULL,
  `signature` longtext DEFAULT NULL,
  `customFields` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `transaction`
--

INSERT INTO `transaction` (`id`, `date`, `debitLedgerId`, `creditLedgerId`, `amount`, `narration`, `voucherType`, `voucherNumber`, `companyId`, `journalEntryId`, `invoiceId`, `purchaseBillId`, `receiptId`, `paymentId`, `createdAt`, `updatedAt`, `posInvoiceId`, `logo`, `signature`, `customFields`) VALUES
(76, '2026-06-29 00:00:00.000', 33, 36, 1000, 'Opening Stock for Product: IPhone 17 Pro Max', 'JOURNAL', NULL, 3, NULL, NULL, NULL, NULL, NULL, '2026-06-29 13:12:26.809', '2026-06-29 13:12:26.809', NULL, NULL, NULL, NULL),
(77, '2026-06-29 00:00:00.000', 46, 48, 12, 'Sales to Jay', 'SALES', 'INV-0001', 3, 34, 23, NULL, NULL, NULL, '2026-06-29 13:15:41.643', '2026-06-29 13:15:41.643', NULL, NULL, NULL, NULL),
(78, '2026-06-29 00:00:00.000', 46, 34, 1.2, 'Tax on Sale: INV-0001', 'SALES', 'INV-0001', 3, 34, 23, NULL, NULL, NULL, '2026-06-29 13:15:41.667', '2026-06-29 13:15:41.667', NULL, NULL, NULL, NULL),
(79, '2026-06-29 00:00:00.000', 40, 33, 10, 'COGS for Invoice: INV-0001', 'JOURNAL', 'COGS-INV-0001', 3, 34, 23, NULL, NULL, NULL, '2026-06-29 13:15:41.710', '2026-06-29 13:15:41.710', NULL, NULL, NULL, NULL),
(80, '2026-06-29 00:00:00.000', 31, 46, 13.2, 'Payment received from Jay', 'RECEIPT', 'RCV-0001', 3, NULL, NULL, NULL, 4, NULL, '2026-06-29 13:31:05.932', '2026-06-29 13:31:05.932', NULL, NULL, NULL, NULL),
(81, '2026-06-29 00:00:00.000', 50, 46, 12, 'Sales Return (Revenue portion) from Jay for Invoice ID: 23', 'SALES_RETURN', 'SRT-000001', 3, NULL, 23, NULL, NULL, NULL, '2026-06-29 13:54:26.033', '2026-06-29 13:54:26.033', NULL, NULL, NULL, NULL),
(82, '2026-06-29 00:00:00.000', 34, 46, 1.2, 'Sales Return Tax Reversal from Jay for Invoice ID: 23', 'SALES_RETURN', 'SRT-000001', 3, NULL, 23, NULL, NULL, NULL, '2026-06-29 13:54:26.046', '2026-06-29 13:54:26.046', NULL, NULL, NULL, NULL),
(83, '2026-06-29 00:00:00.000', 33, 40, 10, 'COGS Reversal for Return: CN-0001', 'JOURNAL', 'COGS-REV-SRT-000001', 3, NULL, NULL, NULL, NULL, NULL, '2026-06-29 13:54:26.067', '2026-06-29 13:54:26.067', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `transaction_numbering`
--

CREATE TABLE `transaction_numbering` (
  `id` int(11) NOT NULL,
  `companyId` int(11) NOT NULL,
  `transactionType` varchar(191) NOT NULL,
  `prefix` varchar(191) DEFAULT '',
  `currentNumber` int(11) NOT NULL DEFAULT 0,
  `paddingLength` int(11) NOT NULL DEFAULT 4,
  `pattern` varchar(191) NOT NULL DEFAULT 'numeric',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `transaction_numbering`
--

INSERT INTO `transaction_numbering` (`id`, `companyId`, `transactionType`, `prefix`, `currentNumber`, `paddingLength`, `pattern`, `createdAt`, `updatedAt`) VALUES
(33, 3, 'salesquotation', 'SQ-', 2, 4, 'numeric', '2026-06-29 18:43:08.075', '2026-06-29 18:45:04.000'),
(34, 3, 'invoice', 'INV-', 3, 4, 'numeric', '2026-06-29 18:43:50.277', '2026-06-29 18:45:41.000'),
(35, 3, 'stocktransfer', 'ST-', 1, 4, 'numeric', '2026-06-29 18:43:50.280', '2026-06-29 18:45:04.000'),
(36, 3, 'salesorder', 'SO-', 2, 4, 'numeric', '2026-06-29 18:43:50.281', '2026-06-29 18:45:20.000'),
(37, 3, 'deliverychallan', 'DC-', 2, 4, 'numeric', '2026-06-29 18:43:50.282', '2026-06-29 18:45:33.000'),
(38, 3, 'salesreturn', 'CN-', 2, 4, 'numeric', '2026-06-29 18:43:50.290', '2026-06-29 19:24:26.000'),
(39, 3, 'purchasereturn', 'DN-', 1, 4, 'numeric', '2026-06-29 18:43:50.290', '2026-06-29 18:45:04.000'),
(40, 3, 'receipt', 'RCV-', 2, 4, 'numeric', '2026-06-29 18:43:50.286', '2026-06-29 19:01:05.000'),
(41, 3, 'purchasequotation', 'PQ-', 1, 4, 'numeric', '2026-06-29 18:43:50.290', '2026-06-29 18:45:04.000'),
(42, 3, 'posinvoice', 'POS-', 1, 4, 'numeric', '2026-06-29 18:43:50.297', '2026-06-29 18:45:04.000'),
(43, 3, 'goodsreceiptnote', 'GRN-', 1, 4, 'numeric', '2026-06-29 18:43:50.298', '2026-06-29 18:45:04.000'),
(44, 3, 'voucher', 'VCH-', 1, 4, 'numeric', '2026-06-29 18:43:50.303', '2026-06-29 18:45:04.000'),
(45, 3, 'adjustment', 'ADJ-', 1, 4, 'numeric', '2026-06-29 18:43:50.303', '2026-06-29 18:45:04.000'),
(46, 3, 'payment', 'PAY-', 1, 4, 'numeric', '2026-06-29 18:43:50.303', '2026-06-29 18:45:04.000'),
(47, 3, 'purchasebill', 'PB-', 1, 4, 'numeric', '2026-06-29 18:43:50.304', '2026-06-29 18:45:04.000'),
(48, 3, 'purchaseorder', 'PO-', 1, 4, 'numeric', '2026-06-29 18:43:50.304', '2026-06-29 18:45:04.000');

-- --------------------------------------------------------

--
-- Table structure for table `uom`
--

CREATE TABLE `uom` (
  `id` int(11) NOT NULL,
  `category` varchar(191) NOT NULL,
  `unitName` varchar(191) NOT NULL,
  `weightPerUnit` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `baseUnitId` int(11) DEFAULT NULL,
  `conversionRate` double DEFAULT NULL,
  `symbol` varchar(191) DEFAULT NULL,
  `uomType` varchar(191) NOT NULL DEFAULT 'Simple'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `uom`
--

INSERT INTO `uom` (`id`, `category`, `unitName`, `weightPerUnit`, `companyId`, `createdAt`, `updatedAt`, `baseUnitId`, `conversionRate`, `symbol`, `uomType`) VALUES
(2, 'Count', 'Box', '', 3, '2026-06-29 13:11:12.997', '2026-06-29 13:11:12.997', NULL, NULL, 'BOX', 'Simple');

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password` varchar(191) NOT NULL,
  `role` varchar(191) NOT NULL DEFAULT 'USER',
  `companyId` int(11) DEFAULT NULL,
  `avatar` longtext DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `loginEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `roleId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`id`, `name`, `email`, `password`, `role`, `companyId`, `avatar`, `createdAt`, `updatedAt`, `loginEnabled`, `roleId`) VALUES
(1, 'Super Admin', 'superadmin@gmail.com', '$2b$10$YBxU1mOYG5GRMmhrgdtdseOGOKfSAGit4b6.s4C3PgXw.hCZS2/iC', 'SUPERADMIN', NULL, NULL, '2026-01-26 09:08:39.426', '2026-01-26 09:08:39.426', 1, NULL),
(5, 'Start Company Pvt. Ltd.', 'company@gmail.com', '$2b$10$JA77IcAFil3o416uh7yXq.uh.C6LNP831Un89xLMfEw2fDxHBeF02', 'COMPANY', 3, NULL, '2026-06-29 13:07:31.564', '2026-06-29 13:07:31.564', 1, 2);

-- --------------------------------------------------------

--
-- Table structure for table `vendor`
--

CREATE TABLE `vendor` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `nameArabic` varchar(191) DEFAULT NULL,
  `companyName` varchar(191) DEFAULT NULL,
  `companyLocation` text DEFAULT NULL,
  `profileImage` longtext DEFAULT NULL,
  `anyFile` longtext DEFAULT NULL,
  `accountType` varchar(191) DEFAULT NULL,
  `balanceType` varchar(191) NOT NULL DEFAULT 'Credit',
  `accountName` varchar(191) DEFAULT NULL,
  `accountBalance` double NOT NULL DEFAULT 0,
  `creationDate` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `bankAccountNumber` varchar(191) DEFAULT NULL,
  `bankIFSC` varchar(191) DEFAULT NULL,
  `bankNameBranch` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `creditPeriod` int(11) DEFAULT NULL,
  `gstNumber` varchar(191) DEFAULT NULL,
  `gstEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `billingName` varchar(191) DEFAULT NULL,
  `billingPhone` varchar(191) DEFAULT NULL,
  `billingAddress` text DEFAULT NULL,
  `billingCity` varchar(191) DEFAULT NULL,
  `billingState` varchar(191) DEFAULT NULL,
  `billingCountry` varchar(191) DEFAULT NULL,
  `billingZipCode` varchar(191) DEFAULT NULL,
  `shippingSameAsBilling` tinyint(1) NOT NULL DEFAULT 0,
  `shippingName` varchar(191) DEFAULT NULL,
  `shippingPhone` varchar(191) DEFAULT NULL,
  `shippingAddress` text DEFAULT NULL,
  `shippingCity` varchar(191) DEFAULT NULL,
  `shippingState` varchar(191) DEFAULT NULL,
  `shippingCountry` varchar(191) DEFAULT NULL,
  `shippingZipCode` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `ledgerId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `vendor`
--

INSERT INTO `vendor` (`id`, `name`, `nameArabic`, `companyName`, `companyLocation`, `profileImage`, `anyFile`, `accountType`, `balanceType`, `accountName`, `accountBalance`, `creationDate`, `bankAccountNumber`, `bankIFSC`, `bankNameBranch`, `phone`, `email`, `creditPeriod`, `gstNumber`, `gstEnabled`, `billingName`, `billingPhone`, `billingAddress`, `billingCity`, `billingState`, `billingCountry`, `billingZipCode`, `shippingSameAsBilling`, `shippingName`, `shippingPhone`, `shippingAddress`, `shippingCity`, `shippingState`, `shippingCountry`, `shippingZipCode`, `companyId`, `ledgerId`, `createdAt`, `updatedAt`) VALUES
(10, 'Rahul', 'Rahul', 'Rahul', 'Customer Address', 'https://res.cloudinary.com/dw48hcxi5/image/upload/v1782738569/vendors/nmbrx4uuuauqgi1naivz.jpg', '', '', 'Credit', 'Rahul', 1000, '2026-06-29 00:00:00.000', 'SBI', 'SBI4152', 'SBI', '94564566678', 'rahul@gmail.com', 10, '2546308504', 1, 'Rahul', '94564566678', 'indore', 'indore', 'Madhya Pradesh', 'India', '4514465', 1, 'Rahul', '94564566678', 'indore', 'indore', 'Madhya Pradesh', 'India', '4514465', 3, 47, '2026-06-29 13:10:07.349', '2026-06-29 13:10:07.391');

-- --------------------------------------------------------

--
-- Table structure for table `voucher`
--

CREATE TABLE `voucher` (
  `id` int(11) NOT NULL,
  `voucherNumber` varchar(191) NOT NULL,
  `voucherType` enum('EXPENSE','INCOME','CONTRA','JOURNAL') NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `companyId` int(11) NOT NULL,
  `companyName` varchar(191) DEFAULT NULL,
  `logo` longtext DEFAULT NULL,
  `paidFromLedgerId` int(11) DEFAULT NULL,
  `paidToLedgerId` int(11) DEFAULT NULL,
  `paidFromAccount` varchar(191) DEFAULT NULL,
  `paidToParty` varchar(191) DEFAULT NULL,
  `vendorId` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `subtotal` double NOT NULL DEFAULT 0,
  `totalAmount` double NOT NULL,
  `notes` text DEFAULT NULL,
  `signature` longtext DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `customFields` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `voucheritem`
--

CREATE TABLE `voucheritem` (
  `id` int(11) NOT NULL,
  `voucherId` int(11) NOT NULL,
  `productId` int(11) DEFAULT NULL,
  `productName` varchar(191) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `quantity` double NOT NULL DEFAULT 1,
  `rate` double DEFAULT NULL,
  `amount` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `credit` double DEFAULT NULL,
  `debit` double DEFAULT NULL,
  `ledgerId` int(11) DEFAULT NULL,
  `ledgerName` varchar(191) DEFAULT NULL,
  `narration` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse`
--

CREATE TABLE `warehouse` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `location` varchar(191) NOT NULL,
  `addressLine1` varchar(191) DEFAULT NULL,
  `addressLine2` varchar(191) DEFAULT NULL,
  `city` varchar(191) DEFAULT NULL,
  `state` varchar(191) DEFAULT NULL,
  `postalCode` varchar(191) DEFAULT NULL,
  `country` varchar(191) DEFAULT NULL,
  `companyId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `warehouse`
--

INSERT INTO `warehouse` (`id`, `name`, `location`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country`, `companyId`, `createdAt`, `updatedAt`) VALUES
(3, 'Warehouse Hub', 'Dubai Hills Estate', 'Dubai Hills Estate', 'Dubai Hills Estate', 'City', 'State', '12345', 'Dubai', 3, '2026-06-29 13:10:56.032', '2026-06-29 13:10:56.032');

-- --------------------------------------------------------

--
-- Table structure for table `_prisma_migrations`
--

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_prisma_migrations`
--

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('16a0c5c8-d390-4b46-8ffb-412d534b95a3', '439dd5608b768a9caed7dd32849228dd5654922474d323e55f2d47f7a1160826', '2026-01-26 08:49:37.944', '20260122122920_purchase_workflow_fix_2', NULL, NULL, '2026-01-26 08:49:36.381', 1),
('2f5f69f1-333f-41cd-bff9-ae6f4a55bf0e', 'de3eb714704d486aa5e5561fe27206716004b9c2323e8c5dc0bee445fafb6d89', '2026-01-26 08:49:36.238', '20260121114319_add_inventory_config_and_reserved_qty', NULL, NULL, '2026-01-26 08:49:36.225', 1),
('52eff3f9-4401-499d-acc8-3929806f2f7a', 'f8c25529243f570b9d5e2ed6b9c8b84841d68b80a85f10b5821094fb246d184b', '2026-01-26 08:49:36.206', '20260121104517_link_invoice_to_challan', NULL, NULL, '2026-01-26 08:49:36.147', 1),
('5b9fd055-841d-419b-98d2-7e7fe405c72f', '9090595c24e9d74ca46c202635fb0f14feb46961f9bdf0006a598df9f205f43b', '2026-01-26 08:49:36.146', '20260121095406_add_discount_to_items', NULL, NULL, '2026-01-26 08:49:31.296', 1),
('60125733-15ba-430a-9870-0c082a65e7d7', 'e4f3c067bd31becc6aa8ee6bd52829b41b73d5f177a44a243ebb97d7fd7b0093', '2026-01-26 08:49:36.215', '20260121110103_add_description_to_challan_item', NULL, NULL, '2026-01-26 08:49:36.208', 1),
('b9fc95a1-9fd6-4727-9d0b-518bb90c5bd7', 'a4b59c6cfcb0f85dd58d2f1328a4c4ee200f70198302920d0d32479039d3be8b', '2026-01-26 08:49:36.371', '20260121135246_update_invoice_warehouse_relations', NULL, NULL, '2026-01-26 08:49:36.328', 1),
('c6f1bf67-4bba-4cd7-8fa5-8b26952d4ddc', '9051ef21783094ca0f7e777c0869e11eb78f4440a28e1836d9287cc04eadc76b', '2026-01-26 08:49:36.224', '20260121110224_add_shipping_fields_to_challan', NULL, NULL, '2026-01-26 08:49:36.216', 1),
('e21d8e20-b113-43b6-acdd-bc9ab4187656', '4d915ae36a2805d09545aa52b7a61d9f954f4ae545b5522a9b72cc796209f4e7', '2026-01-26 08:49:53.389', '20260126084952_add_voucher_models', NULL, NULL, '2026-01-26 08:49:52.281', 1),
('e7ff5532-a701-4321-90b1-85fdd3403be7', '12cb385fef6aec196cc726132f576ae2e9cd2f4b63ba41aac11b277d7181f83f', '2026-01-26 08:49:36.379', '20260122110723_add_fields_to_sales_return', NULL, NULL, '2026-01-26 08:49:36.372', 1),
('efde7cdc-ffd2-4b9f-9dcc-cc5e715db257', 'cb881900c6e339183973c30d1bfda670186fdeb765f6d4c453f1be003d51f8c3', NULL, '20260307085000_add_missing_fields_to_planrequest', 'A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260307085000_add_missing_fields_to_planrequest\n\nDatabase error code: 1060\n\nDatabase error:\nDuplicate column name \'phone\'\n\nPlease check the query number 1 from the migration file.\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name=\"20260307085000_add_missing_fields_to_planrequest\"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name=\"20260307085000_add_missing_fields_to_planrequest\"\n             at schema-engine\\core\\src\\commands\\apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:226', NULL, '2026-06-27 07:19:45.520', 0),
('fe2cc836-c7cd-490a-ae36-a1556fa58175', 'e0004ea46358d12f2dc6e65b017cc08d2bf0d81fdcc01130f677830f73555a6d', '2026-01-26 08:49:36.327', '20260121114437_add_warehouse_to_sales_docs', NULL, NULL, '2026-01-26 08:49:36.239', 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accountgroup`
--
ALTER TABLE `accountgroup`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `AccountGroup_companyId_name_key` (`companyId`,`name`);

--
-- Indexes for table `accountsubgroup`
--
ALTER TABLE `accountsubgroup`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `AccountSubGroup_companyId_groupId_name_key` (`companyId`,`groupId`,`name`),
  ADD KEY `AccountSubGroup_groupId_fkey` (`groupId`);

--
-- Indexes for table `auditlog`
--
ALTER TABLE `auditlog`
  ADD PRIMARY KEY (`id`),
  ADD KEY `auditlog_companyId_idx` (`companyId`),
  ADD KEY `auditlog_userId_idx` (`userId`);

--
-- Indexes for table `bankaccount`
--
ALTER TABLE `bankaccount`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `BankAccount_companyId_accountNumber_key` (`companyId`,`accountNumber`);

--
-- Indexes for table `banktransaction`
--
ALTER TABLE `banktransaction`
  ADD PRIMARY KEY (`id`),
  ADD KEY `BankTransaction_bankAccountId_fkey` (`bankAccountId`),
  ADD KEY `BankTransaction_companyId_fkey` (`companyId`);

--
-- Indexes for table `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Category_companyId_name_key` (`companyId`,`name`);

--
-- Indexes for table `company`
--
ALTER TABLE `company`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Company_email_key` (`email`),
  ADD KEY `Company_planId_fkey` (`planId`);

--
-- Indexes for table `customer`
--
ALTER TABLE `customer`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Customer_companyId_email_key` (`companyId`,`email`);

--
-- Indexes for table `dashboardannouncement`
--
ALTER TABLE `dashboardannouncement`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `deliverychallan`
--
ALTER TABLE `deliverychallan`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `DeliveryChallan_companyId_challanNumber_key` (`companyId`,`challanNumber`),
  ADD KEY `DeliveryChallan_customerId_fkey` (`customerId`),
  ADD KEY `DeliveryChallan_salesOrderId_fkey` (`salesOrderId`);

--
-- Indexes for table `deliverychallanitem`
--
ALTER TABLE `deliverychallanitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `DeliveryChallanItem_challanId_fkey` (`challanId`),
  ADD KEY `DeliveryChallanItem_productId_fkey` (`productId`),
  ADD KEY `DeliveryChallanItem_warehouseId_fkey` (`warehouseId`);

--
-- Indexes for table `expenseentry`
--
ALTER TABLE `expenseentry`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ExpenseEntry_companyId_fkey` (`companyId`);

--
-- Indexes for table `goodsreceiptnote`
--
ALTER TABLE `goodsreceiptnote`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `GoodsReceiptNote_companyId_grnNumber_key` (`companyId`,`grnNumber`),
  ADD KEY `GoodsReceiptNote_vendorId_fkey` (`vendorId`),
  ADD KEY `GoodsReceiptNote_purchaseOrderId_fkey` (`purchaseOrderId`);

--
-- Indexes for table `goodsreceiptnoteitem`
--
ALTER TABLE `goodsreceiptnoteitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `GoodsReceiptNoteItem_grnId_fkey` (`grnId`),
  ADD KEY `GoodsReceiptNoteItem_productId_fkey` (`productId`),
  ADD KEY `GoodsReceiptNoteItem_warehouseId_fkey` (`warehouseId`);

--
-- Indexes for table `incomeentry`
--
ALTER TABLE `incomeentry`
  ADD PRIMARY KEY (`id`),
  ADD KEY `IncomeEntry_companyId_fkey` (`companyId`);

--
-- Indexes for table `inventoryadjustment`
--
ALTER TABLE `inventoryadjustment`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `InventoryAdjustment_companyId_voucherNo_key` (`companyId`,`voucherNo`),
  ADD KEY `InventoryAdjustment_warehouseId_fkey` (`warehouseId`);

--
-- Indexes for table `inventoryadjustmentitem`
--
ALTER TABLE `inventoryadjustmentitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `InventoryAdjustmentItem_inventoryAdjustmentId_fkey` (`inventoryAdjustmentId`),
  ADD KEY `InventoryAdjustmentItem_productId_fkey` (`productId`),
  ADD KEY `InventoryAdjustmentItem_warehouseId_fkey` (`warehouseId`);

--
-- Indexes for table `inventorytransaction`
--
ALTER TABLE `inventorytransaction`
  ADD PRIMARY KEY (`id`),
  ADD KEY `InventoryTransaction_productId_fkey` (`productId`),
  ADD KEY `InventoryTransaction_fromWarehouseId_fkey` (`fromWarehouseId`),
  ADD KEY `InventoryTransaction_toWarehouseId_fkey` (`toWarehouseId`),
  ADD KEY `InventoryTransaction_companyId_fkey` (`companyId`),
  ADD KEY `InventoryTransaction_userId_fkey` (`userId`);

--
-- Indexes for table `inventory_batch`
--
ALTER TABLE `inventory_batch`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_batch_productId_idx` (`productId`),
  ADD KEY `inventory_batch_warehouseId_idx` (`warehouseId`),
  ADD KEY `inventory_batch_purchaseBillId_idx` (`purchaseBillId`);

--
-- Indexes for table `inventory_consumption`
--
ALTER TABLE `inventory_consumption`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_consumption_invoiceId_idx` (`invoiceId`),
  ADD KEY `inventory_consumption_productId_idx` (`productId`),
  ADD KEY `inventory_consumption_batchId_idx` (`batchId`);

--
-- Indexes for table `invoice`
--
ALTER TABLE `invoice`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Invoice_companyId_invoiceNumber_key` (`companyId`,`invoiceNumber`),
  ADD KEY `Invoice_customerId_fkey` (`customerId`),
  ADD KEY `Invoice_salesOrderId_fkey` (`salesOrderId`),
  ADD KEY `Invoice_deliveryChallanId_fkey` (`deliveryChallanId`);

--
-- Indexes for table `invoiceitem`
--
ALTER TABLE `invoiceitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `InvoiceItem_invoiceId_fkey` (`invoiceId`),
  ADD KEY `InvoiceItem_productId_fkey` (`productId`),
  ADD KEY `InvoiceItem_serviceId_fkey` (`serviceId`),
  ADD KEY `InvoiceItem_warehouseId_fkey` (`warehouseId`),
  ADD KEY `InvoiceItem_uomId_fkey` (`uomId`);

--
-- Indexes for table `journalentry`
--
ALTER TABLE `journalentry`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `JournalEntry_companyId_voucherNumber_key` (`companyId`,`voucherNumber`);

--
-- Indexes for table `ledger`
--
ALTER TABLE `ledger`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Ledger_companyId_name_key` (`companyId`,`name`),
  ADD UNIQUE KEY `Ledger_customerId_key` (`customerId`),
  ADD UNIQUE KEY `Ledger_vendorId_key` (`vendorId`),
  ADD KEY `Ledger_groupId_fkey` (`groupId`),
  ADD KEY `Ledger_subGroupId_fkey` (`subGroupId`),
  ADD KEY `Ledger_parentLedgerId_fkey` (`parentLedgerId`);

--
-- Indexes for table `passwordrequest`
--
ALTER TABLE `passwordrequest`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PasswordRequest_userId_fkey` (`userId`),
  ADD KEY `PasswordRequest_companyId_fkey` (`companyId`);

--
-- Indexes for table `payment`
--
ALTER TABLE `payment`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Payment_companyId_paymentNumber_key` (`companyId`,`paymentNumber`),
  ADD KEY `Payment_vendorId_fkey` (`vendorId`),
  ADD KEY `Payment_purchaseBillId_fkey` (`purchaseBillId`),
  ADD KEY `Payment_cashBankAccountId_fkey` (`cashBankAccountId`),
  ADD KEY `Payment_discountLedgerId_fkey` (`discountLedgerId`);

--
-- Indexes for table `paymentbillallocation`
--
ALTER TABLE `paymentbillallocation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PaymentBillAllocation_paymentId_fkey` (`paymentId`),
  ADD KEY `PaymentBillAllocation_purchaseBillId_fkey` (`purchaseBillId`);

--
-- Indexes for table `paymentrecord`
--
ALTER TABLE `paymentrecord`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `PaymentRecord_transactionId_key` (`transactionId`);

--
-- Indexes for table `plan`
--
ALTER TABLE `plan`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `planrequest`
--
ALTER TABLE `planrequest`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PlanRequest_planId_fkey` (`planId`);

--
-- Indexes for table `posinvoice`
--
ALTER TABLE `posinvoice`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `PosInvoice_companyId_invoiceNumber_key` (`companyId`,`invoiceNumber`),
  ADD KEY `PosInvoice_customerId_fkey` (`customerId`);

--
-- Indexes for table `posinvoiceitem`
--
ALTER TABLE `posinvoiceitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PosInvoiceItem_posInvoiceId_fkey` (`posInvoiceId`),
  ADD KEY `PosInvoiceItem_productId_fkey` (`productId`),
  ADD KEY `PosInvoiceItem_warehouseId_fkey` (`warehouseId`),
  ADD KEY `PosInvoiceItem_uomId_fkey` (`uomId`);

--
-- Indexes for table `product`
--
ALTER TABLE `product`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Product_companyId_name_key` (`companyId`,`name`),
  ADD KEY `Product_categoryId_fkey` (`categoryId`),
  ADD KEY `Product_uomId_fkey` (`uomId`),
  ADD KEY `Product_purchaseUomId_fkey` (`purchaseUomId`),
  ADD KEY `Product_salesUomId_fkey` (`salesUomId`);

--
-- Indexes for table `purchasebill`
--
ALTER TABLE `purchasebill`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `PurchaseBill_companyId_billNumber_key` (`companyId`,`billNumber`),
  ADD KEY `PurchaseBill_vendorId_fkey` (`vendorId`),
  ADD KEY `PurchaseBill_purchaseOrderId_fkey` (`purchaseOrderId`),
  ADD KEY `PurchaseBill_grnId_fkey` (`grnId`);

--
-- Indexes for table `purchasebillitem`
--
ALTER TABLE `purchasebillitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PurchaseBillItem_purchaseBillId_fkey` (`purchaseBillId`),
  ADD KEY `PurchaseBillItem_productId_fkey` (`productId`),
  ADD KEY `PurchaseBillItem_warehouseId_fkey` (`warehouseId`),
  ADD KEY `PurchaseBillItem_uomId_fkey` (`uomId`);

--
-- Indexes for table `purchaseorder`
--
ALTER TABLE `purchaseorder`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `PurchaseOrder_companyId_orderNumber_key` (`companyId`,`orderNumber`),
  ADD UNIQUE KEY `PurchaseOrder_quotationId_key` (`quotationId`),
  ADD KEY `PurchaseOrder_vendorId_fkey` (`vendorId`);

--
-- Indexes for table `purchaseorderitem`
--
ALTER TABLE `purchaseorderitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PurchaseOrderItem_orderId_fkey` (`orderId`),
  ADD KEY `PurchaseOrderItem_productId_fkey` (`productId`),
  ADD KEY `PurchaseOrderItem_warehouseId_fkey` (`warehouseId`),
  ADD KEY `PurchaseOrderItem_uomId_fkey` (`uomId`);

--
-- Indexes for table `purchasequotation`
--
ALTER TABLE `purchasequotation`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `PurchaseQuotation_companyId_quotationNumber_key` (`companyId`,`quotationNumber`),
  ADD KEY `PurchaseQuotation_vendorId_fkey` (`vendorId`);

--
-- Indexes for table `purchasequotationitem`
--
ALTER TABLE `purchasequotationitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PurchaseQuotationItem_quotationId_fkey` (`quotationId`),
  ADD KEY `PurchaseQuotationItem_productId_fkey` (`productId`),
  ADD KEY `PurchaseQuotationItem_warehouseId_fkey` (`warehouseId`),
  ADD KEY `PurchaseQuotationItem_uomId_fkey` (`uomId`);

--
-- Indexes for table `purchasereturn`
--
ALTER TABLE `purchasereturn`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `PurchaseReturn_companyId_returnNumber_key` (`companyId`,`returnNumber`),
  ADD KEY `PurchaseReturn_vendorId_fkey` (`vendorId`),
  ADD KEY `PurchaseReturn_purchaseBillId_fkey` (`purchaseBillId`);

--
-- Indexes for table `purchasereturnitem`
--
ALTER TABLE `purchasereturnitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PurchaseReturnItem_purchaseReturnId_fkey` (`purchaseReturnId`),
  ADD KEY `PurchaseReturnItem_productId_fkey` (`productId`),
  ADD KEY `PurchaseReturnItem_warehouseId_fkey` (`warehouseId`);

--
-- Indexes for table `receipt`
--
ALTER TABLE `receipt`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Receipt_companyId_receiptNumber_key` (`companyId`,`receiptNumber`),
  ADD KEY `Receipt_customerId_fkey` (`customerId`),
  ADD KEY `Receipt_invoiceId_fkey` (`invoiceId`),
  ADD KEY `Receipt_cashBankAccountId_fkey` (`cashBankAccountId`),
  ADD KEY `Receipt_discountLedgerId_fkey` (`discountLedgerId`);

--
-- Indexes for table `receiptinvoiceallocation`
--
ALTER TABLE `receiptinvoiceallocation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ReceiptInvoiceAllocation_receiptId_fkey` (`receiptId`),
  ADD KEY `ReceiptInvoiceAllocation_invoiceId_fkey` (`invoiceId`);

--
-- Indexes for table `role`
--
ALTER TABLE `role`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_companyId_name_key` (`companyId`,`name`),
  ADD KEY `role_companyId_idx` (`companyId`);

--
-- Indexes for table `salesorder`
--
ALTER TABLE `salesorder`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `SalesOrder_companyId_orderNumber_key` (`companyId`,`orderNumber`),
  ADD UNIQUE KEY `SalesOrder_quotationId_key` (`quotationId`),
  ADD KEY `SalesOrder_customerId_fkey` (`customerId`);

--
-- Indexes for table `salesorderitem`
--
ALTER TABLE `salesorderitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `SalesOrderItem_orderId_fkey` (`orderId`),
  ADD KEY `SalesOrderItem_productId_fkey` (`productId`),
  ADD KEY `SalesOrderItem_serviceId_fkey` (`serviceId`),
  ADD KEY `SalesOrderItem_warehouseId_fkey` (`warehouseId`),
  ADD KEY `SalesOrderItem_uomId_fkey` (`uomId`);

--
-- Indexes for table `salesquotation`
--
ALTER TABLE `salesquotation`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `SalesQuotation_companyId_quotationNumber_key` (`companyId`,`quotationNumber`),
  ADD KEY `SalesQuotation_customerId_fkey` (`customerId`);

--
-- Indexes for table `salesquotationitem`
--
ALTER TABLE `salesquotationitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `SalesQuotationItem_quotationId_fkey` (`quotationId`),
  ADD KEY `SalesQuotationItem_productId_fkey` (`productId`),
  ADD KEY `SalesQuotationItem_serviceId_fkey` (`serviceId`),
  ADD KEY `SalesQuotationItem_warehouseId_fkey` (`warehouseId`),
  ADD KEY `SalesQuotationItem_uomId_fkey` (`uomId`);

--
-- Indexes for table `salesreturn`
--
ALTER TABLE `salesreturn`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `SalesReturn_companyId_returnNumber_key` (`companyId`,`returnNumber`),
  ADD KEY `SalesReturn_customerId_fkey` (`customerId`),
  ADD KEY `SalesReturn_invoiceId_fkey` (`invoiceId`);

--
-- Indexes for table `salesreturnitem`
--
ALTER TABLE `salesreturnitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `SalesReturnItem_salesReturnId_fkey` (`salesReturnId`),
  ADD KEY `SalesReturnItem_productId_fkey` (`productId`),
  ADD KEY `SalesReturnItem_warehouseId_fkey` (`warehouseId`);

--
-- Indexes for table `service`
--
ALTER TABLE `service`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Service_companyId_name_key` (`companyId`,`name`),
  ADD KEY `Service_uomId_fkey` (`uomId`);

--
-- Indexes for table `shippingaddress`
--
ALTER TABLE `shippingaddress`
  ADD PRIMARY KEY (`id`),
  ADD KEY `shippingaddress_customerId_idx` (`customerId`),
  ADD KEY `shippingaddress_vendorId_idx` (`vendorId`);

--
-- Indexes for table `stock`
--
ALTER TABLE `stock`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Stock_warehouseId_productId_key` (`warehouseId`,`productId`),
  ADD KEY `Stock_productId_fkey` (`productId`);

--
-- Indexes for table `stocktransfer`
--
ALTER TABLE `stocktransfer`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `StockTransfer_companyId_voucherNo_key` (`companyId`,`voucherNo`),
  ADD KEY `StockTransfer_toWarehouseId_fkey` (`toWarehouseId`);

--
-- Indexes for table `stocktransferitem`
--
ALTER TABLE `stocktransferitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `StockTransferItem_stockTransferId_fkey` (`stockTransferId`),
  ADD KEY `StockTransferItem_productId_fkey` (`productId`),
  ADD KEY `StockTransferItem_fromWarehouseId_fkey` (`fromWarehouseId`);

--
-- Indexes for table `transaction`
--
ALTER TABLE `transaction`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Transaction_debitLedgerId_fkey` (`debitLedgerId`),
  ADD KEY `Transaction_creditLedgerId_fkey` (`creditLedgerId`),
  ADD KEY `Transaction_companyId_fkey` (`companyId`),
  ADD KEY `Transaction_journalEntryId_fkey` (`journalEntryId`),
  ADD KEY `Transaction_invoiceId_fkey` (`invoiceId`),
  ADD KEY `Transaction_purchaseBillId_fkey` (`purchaseBillId`),
  ADD KEY `Transaction_receiptId_fkey` (`receiptId`),
  ADD KEY `Transaction_paymentId_fkey` (`paymentId`),
  ADD KEY `Transaction_posInvoiceId_fkey` (`posInvoiceId`);

--
-- Indexes for table `transaction_numbering`
--
ALTER TABLE `transaction_numbering`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `TransactionNumbering_companyId_transactionType_key` (`companyId`,`transactionType`),
  ADD KEY `TransactionNumbering_companyId_fkey` (`companyId`);

--
-- Indexes for table `uom`
--
ALTER TABLE `uom`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `UOM_companyId_category_unitName_key` (`companyId`,`category`,`unitName`),
  ADD KEY `UOM_baseUnitId_fkey` (`baseUnitId`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `User_email_key` (`email`),
  ADD KEY `User_companyId_fkey` (`companyId`);

--
-- Indexes for table `vendor`
--
ALTER TABLE `vendor`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Vendor_companyId_email_key` (`companyId`,`email`);

--
-- Indexes for table `voucher`
--
ALTER TABLE `voucher`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `voucher_companyId_voucherNumber_key` (`companyId`,`voucherNumber`),
  ADD KEY `voucher_vendorId_idx` (`vendorId`),
  ADD KEY `voucher_customerId_idx` (`customerId`),
  ADD KEY `voucher_paidFromLedgerId_idx` (`paidFromLedgerId`),
  ADD KEY `voucher_paidToLedgerId_idx` (`paidToLedgerId`);

--
-- Indexes for table `voucheritem`
--
ALTER TABLE `voucheritem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `voucheritem_voucherId_idx` (`voucherId`),
  ADD KEY `voucheritem_productId_idx` (`productId`),
  ADD KEY `voucheritem_ledgerId_fkey` (`ledgerId`);

--
-- Indexes for table `warehouse`
--
ALTER TABLE `warehouse`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Warehouse_companyId_name_key` (`companyId`,`name`);

--
-- Indexes for table `_prisma_migrations`
--
ALTER TABLE `_prisma_migrations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accountgroup`
--
ALTER TABLE `accountgroup`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `accountsubgroup`
--
ALTER TABLE `accountsubgroup`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `auditlog`
--
ALTER TABLE `auditlog`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `bankaccount`
--
ALTER TABLE `bankaccount`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `banktransaction`
--
ALTER TABLE `banktransaction`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `category`
--
ALTER TABLE `category`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `company`
--
ALTER TABLE `company`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `customer`
--
ALTER TABLE `customer`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `dashboardannouncement`
--
ALTER TABLE `dashboardannouncement`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `deliverychallan`
--
ALTER TABLE `deliverychallan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `deliverychallanitem`
--
ALTER TABLE `deliverychallanitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `expenseentry`
--
ALTER TABLE `expenseentry`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `goodsreceiptnote`
--
ALTER TABLE `goodsreceiptnote`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `goodsreceiptnoteitem`
--
ALTER TABLE `goodsreceiptnoteitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `incomeentry`
--
ALTER TABLE `incomeentry`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventoryadjustment`
--
ALTER TABLE `inventoryadjustment`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `inventoryadjustmentitem`
--
ALTER TABLE `inventoryadjustmentitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `inventorytransaction`
--
ALTER TABLE `inventorytransaction`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `inventory_batch`
--
ALTER TABLE `inventory_batch`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `inventory_consumption`
--
ALTER TABLE `inventory_consumption`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `invoice`
--
ALTER TABLE `invoice`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `invoiceitem`
--
ALTER TABLE `invoiceitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `journalentry`
--
ALTER TABLE `journalentry`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `ledger`
--
ALTER TABLE `ledger`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `passwordrequest`
--
ALTER TABLE `passwordrequest`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `payment`
--
ALTER TABLE `payment`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `paymentbillallocation`
--
ALTER TABLE `paymentbillallocation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `paymentrecord`
--
ALTER TABLE `paymentrecord`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `plan`
--
ALTER TABLE `plan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `planrequest`
--
ALTER TABLE `planrequest`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `posinvoice`
--
ALTER TABLE `posinvoice`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `posinvoiceitem`
--
ALTER TABLE `posinvoiceitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `product`
--
ALTER TABLE `product`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `purchasebill`
--
ALTER TABLE `purchasebill`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `purchasebillitem`
--
ALTER TABLE `purchasebillitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `purchaseorder`
--
ALTER TABLE `purchaseorder`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `purchaseorderitem`
--
ALTER TABLE `purchaseorderitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `purchasequotation`
--
ALTER TABLE `purchasequotation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `purchasequotationitem`
--
ALTER TABLE `purchasequotationitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `purchasereturn`
--
ALTER TABLE `purchasereturn`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `purchasereturnitem`
--
ALTER TABLE `purchasereturnitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `receipt`
--
ALTER TABLE `receipt`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `receiptinvoiceallocation`
--
ALTER TABLE `receiptinvoiceallocation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `role`
--
ALTER TABLE `role`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `salesorder`
--
ALTER TABLE `salesorder`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `salesorderitem`
--
ALTER TABLE `salesorderitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `salesquotation`
--
ALTER TABLE `salesquotation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `salesquotationitem`
--
ALTER TABLE `salesquotationitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `salesreturn`
--
ALTER TABLE `salesreturn`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `salesreturnitem`
--
ALTER TABLE `salesreturnitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `service`
--
ALTER TABLE `service`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `shippingaddress`
--
ALTER TABLE `shippingaddress`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `stock`
--
ALTER TABLE `stock`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `stocktransfer`
--
ALTER TABLE `stocktransfer`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `stocktransferitem`
--
ALTER TABLE `stocktransferitem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `transaction`
--
ALTER TABLE `transaction`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=84;

--
-- AUTO_INCREMENT for table `transaction_numbering`
--
ALTER TABLE `transaction_numbering`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `uom`
--
ALTER TABLE `uom`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `vendor`
--
ALTER TABLE `vendor`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `voucher`
--
ALTER TABLE `voucher`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `voucheritem`
--
ALTER TABLE `voucheritem`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `warehouse`
--
ALTER TABLE `warehouse`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `accountgroup`
--
ALTER TABLE `accountgroup`
  ADD CONSTRAINT `AccountGroup_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `accountsubgroup`
--
ALTER TABLE `accountsubgroup`
  ADD CONSTRAINT `AccountSubGroup_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AccountSubGroup_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `accountgroup` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `auditlog`
--
ALTER TABLE `auditlog`
  ADD CONSTRAINT `auditlog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `auditlog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `bankaccount`
--
ALTER TABLE `bankaccount`
  ADD CONSTRAINT `BankAccount_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `banktransaction`
--
ALTER TABLE `banktransaction`
  ADD CONSTRAINT `BankTransaction_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bankaccount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BankTransaction_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `category`
--
ALTER TABLE `category`
  ADD CONSTRAINT `Category_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company`
--
ALTER TABLE `company`
  ADD CONSTRAINT `Company_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `customer`
--
ALTER TABLE `customer`
  ADD CONSTRAINT `Customer_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `deliverychallan`
--
ALTER TABLE `deliverychallan`
  ADD CONSTRAINT `DeliveryChallan_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DeliveryChallan_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `DeliveryChallan_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `salesorder` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `deliverychallanitem`
--
ALTER TABLE `deliverychallanitem`
  ADD CONSTRAINT `DeliveryChallanItem_challanId_fkey` FOREIGN KEY (`challanId`) REFERENCES `deliverychallan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DeliveryChallanItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DeliveryChallanItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `expenseentry`
--
ALTER TABLE `expenseentry`
  ADD CONSTRAINT `ExpenseEntry_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `goodsreceiptnote`
--
ALTER TABLE `goodsreceiptnote`
  ADD CONSTRAINT `GoodsReceiptNote_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GoodsReceiptNote_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchaseorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GoodsReceiptNote_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `goodsreceiptnoteitem`
--
ALTER TABLE `goodsreceiptnoteitem`
  ADD CONSTRAINT `GoodsReceiptNoteItem_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `goodsreceiptnote` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GoodsReceiptNoteItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GoodsReceiptNoteItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `incomeentry`
--
ALTER TABLE `incomeentry`
  ADD CONSTRAINT `IncomeEntry_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `inventoryadjustment`
--
ALTER TABLE `inventoryadjustment`
  ADD CONSTRAINT `InventoryAdjustment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryAdjustment_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `inventoryadjustmentitem`
--
ALTER TABLE `inventoryadjustmentitem`
  ADD CONSTRAINT `InventoryAdjustmentItem_inventoryAdjustmentId_fkey` FOREIGN KEY (`inventoryAdjustmentId`) REFERENCES `inventoryadjustment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryAdjustmentItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryAdjustmentItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `inventorytransaction`
--
ALTER TABLE `inventorytransaction`
  ADD CONSTRAINT `InventoryTransaction_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryTransaction_fromWarehouseId_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryTransaction_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryTransaction_toWarehouseId_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `inventory_batch`
--
ALTER TABLE `inventory_batch`
  ADD CONSTRAINT `inventory_batch_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_batch_purchaseBillId_fkey` FOREIGN KEY (`purchaseBillId`) REFERENCES `purchasebill` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_batch_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `inventory_consumption`
--
ALTER TABLE `inventory_consumption`
  ADD CONSTRAINT `inventory_consumption_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `inventory_batch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_consumption_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_consumption_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `invoice`
--
ALTER TABLE `invoice`
  ADD CONSTRAINT `Invoice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Invoice_deliveryChallanId_fkey` FOREIGN KEY (`deliveryChallanId`) REFERENCES `deliverychallan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Invoice_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `salesorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `invoiceitem`
--
ALTER TABLE `invoiceitem`
  ADD CONSTRAINT `InvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `InvoiceItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InvoiceItem_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InvoiceItem_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `InvoiceItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `journalentry`
--
ALTER TABLE `journalentry`
  ADD CONSTRAINT `JournalEntry_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `ledger`
--
ALTER TABLE `ledger`
  ADD CONSTRAINT `Ledger_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Ledger_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Ledger_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `accountgroup` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Ledger_parentLedgerId_fkey` FOREIGN KEY (`parentLedgerId`) REFERENCES `ledger` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Ledger_subGroupId_fkey` FOREIGN KEY (`subGroupId`) REFERENCES `accountsubgroup` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Ledger_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `passwordrequest`
--
ALTER TABLE `passwordrequest`
  ADD CONSTRAINT `PasswordRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `PasswordRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `payment`
--
ALTER TABLE `payment`
  ADD CONSTRAINT `Payment_cashBankAccountId_fkey` FOREIGN KEY (`cashBankAccountId`) REFERENCES `ledger` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_discountLedgerId_fkey` FOREIGN KEY (`discountLedgerId`) REFERENCES `ledger` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_purchaseBillId_fkey` FOREIGN KEY (`purchaseBillId`) REFERENCES `purchasebill` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `paymentbillallocation`
--
ALTER TABLE `paymentbillallocation`
  ADD CONSTRAINT `PaymentBillAllocation_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PaymentBillAllocation_purchaseBillId_fkey` FOREIGN KEY (`purchaseBillId`) REFERENCES `purchasebill` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `planrequest`
--
ALTER TABLE `planrequest`
  ADD CONSTRAINT `PlanRequest_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `posinvoice`
--
ALTER TABLE `posinvoice`
  ADD CONSTRAINT `PosInvoice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PosInvoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `posinvoiceitem`
--
ALTER TABLE `posinvoiceitem`
  ADD CONSTRAINT `PosInvoiceItem_posInvoiceId_fkey` FOREIGN KEY (`posInvoiceId`) REFERENCES `posinvoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PosInvoiceItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PosInvoiceItem_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `PosInvoiceItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `product`
--
ALTER TABLE `product`
  ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Product_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Product_purchaseUomId_fkey` FOREIGN KEY (`purchaseUomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Product_salesUomId_fkey` FOREIGN KEY (`salesUomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Product_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `purchasebill`
--
ALTER TABLE `purchasebill`
  ADD CONSTRAINT `PurchaseBill_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseBill_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `goodsreceiptnote` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseBill_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchaseorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseBill_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `purchasebillitem`
--
ALTER TABLE `purchasebillitem`
  ADD CONSTRAINT `PurchaseBillItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseBillItem_purchaseBillId_fkey` FOREIGN KEY (`purchaseBillId`) REFERENCES `purchasebill` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseBillItem_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseBillItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `purchaseorder`
--
ALTER TABLE `purchaseorder`
  ADD CONSTRAINT `PurchaseOrder_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseOrder_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `purchasequotation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseOrder_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `purchaseorderitem`
--
ALTER TABLE `purchaseorderitem`
  ADD CONSTRAINT `PurchaseOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `purchaseorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseOrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseOrderItem_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseOrderItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `purchasequotation`
--
ALTER TABLE `purchasequotation`
  ADD CONSTRAINT `PurchaseQuotation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseQuotation_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `purchasequotationitem`
--
ALTER TABLE `purchasequotationitem`
  ADD CONSTRAINT `PurchaseQuotationItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseQuotationItem_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `purchasequotation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseQuotationItem_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseQuotationItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `purchasereturn`
--
ALTER TABLE `purchasereturn`
  ADD CONSTRAINT `PurchaseReturn_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseReturn_purchaseBillId_fkey` FOREIGN KEY (`purchaseBillId`) REFERENCES `purchasebill` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseReturn_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `purchasereturnitem`
--
ALTER TABLE `purchasereturnitem`
  ADD CONSTRAINT `PurchaseReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseReturnItem_purchaseReturnId_fkey` FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchasereturn` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PurchaseReturnItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `receipt`
--
ALTER TABLE `receipt`
  ADD CONSTRAINT `Receipt_cashBankAccountId_fkey` FOREIGN KEY (`cashBankAccountId`) REFERENCES `ledger` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Receipt_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Receipt_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Receipt_discountLedgerId_fkey` FOREIGN KEY (`discountLedgerId`) REFERENCES `ledger` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Receipt_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `receiptinvoiceallocation`
--
ALTER TABLE `receiptinvoiceallocation`
  ADD CONSTRAINT `ReceiptInvoiceAllocation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ReceiptInvoiceAllocation_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `receipt` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `role`
--
ALTER TABLE `role`
  ADD CONSTRAINT `role_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `salesorder`
--
ALTER TABLE `salesorder`
  ADD CONSTRAINT `SalesOrder_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesOrder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesOrder_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `salesquotation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `salesorderitem`
--
ALTER TABLE `salesorderitem`
  ADD CONSTRAINT `SalesOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `salesorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesOrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesOrderItem_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesOrderItem_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesOrderItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `salesquotation`
--
ALTER TABLE `salesquotation`
  ADD CONSTRAINT `SalesQuotation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesQuotation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `salesquotationitem`
--
ALTER TABLE `salesquotationitem`
  ADD CONSTRAINT `SalesQuotationItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesQuotationItem_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `salesquotation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesQuotationItem_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesQuotationItem_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesQuotationItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `salesreturn`
--
ALTER TABLE `salesreturn`
  ADD CONSTRAINT `SalesReturn_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesReturn_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesReturn_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `salesreturnitem`
--
ALTER TABLE `salesreturnitem`
  ADD CONSTRAINT `SalesReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesReturnItem_salesReturnId_fkey` FOREIGN KEY (`salesReturnId`) REFERENCES `salesreturn` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesReturnItem_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `service`
--
ALTER TABLE `service`
  ADD CONSTRAINT `Service_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Service_uomId_fkey` FOREIGN KEY (`uomId`) REFERENCES `uom` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `shippingaddress`
--
ALTER TABLE `shippingaddress`
  ADD CONSTRAINT `shippingaddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `shippingaddress_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `stock`
--
ALTER TABLE `stock`
  ADD CONSTRAINT `Stock_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Stock_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `stocktransfer`
--
ALTER TABLE `stocktransfer`
  ADD CONSTRAINT `StockTransfer_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StockTransfer_toWarehouseId_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `warehouse` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `stocktransferitem`
--
ALTER TABLE `stocktransferitem`
  ADD CONSTRAINT `StockTransferItem_fromWarehouseId_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `warehouse` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `StockTransferItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `StockTransferItem_stockTransferId_fkey` FOREIGN KEY (`stockTransferId`) REFERENCES `stocktransfer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `transaction`
--
ALTER TABLE `transaction`
  ADD CONSTRAINT `Transaction_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_creditLedgerId_fkey` FOREIGN KEY (`creditLedgerId`) REFERENCES `ledger` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_debitLedgerId_fkey` FOREIGN KEY (`debitLedgerId`) REFERENCES `ledger` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journalentry` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_posInvoiceId_fkey` FOREIGN KEY (`posInvoiceId`) REFERENCES `posinvoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_purchaseBillId_fkey` FOREIGN KEY (`purchaseBillId`) REFERENCES `purchasebill` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `receipt` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `transaction_numbering`
--
ALTER TABLE `transaction_numbering`
  ADD CONSTRAINT `TransactionNumbering_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `uom`
--
ALTER TABLE `uom`
  ADD CONSTRAINT `UOM_baseUnitId_fkey` FOREIGN KEY (`baseUnitId`) REFERENCES `uom` (`id`),
  ADD CONSTRAINT `UOM_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user`
--
ALTER TABLE `user`
  ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `vendor`
--
ALTER TABLE `vendor`
  ADD CONSTRAINT `Vendor_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `voucher`
--
ALTER TABLE `voucher`
  ADD CONSTRAINT `voucher_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `voucher_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `voucher_paidFromLedgerId_fkey` FOREIGN KEY (`paidFromLedgerId`) REFERENCES `ledger` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `voucher_paidToLedgerId_fkey` FOREIGN KEY (`paidToLedgerId`) REFERENCES `ledger` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `voucher_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `voucheritem`
--
ALTER TABLE `voucheritem`
  ADD CONSTRAINT `voucheritem_ledgerId_fkey` FOREIGN KEY (`ledgerId`) REFERENCES `ledger` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `voucheritem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `voucheritem_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `voucher` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `warehouse`
--
ALTER TABLE `warehouse`
  ADD CONSTRAINT `Warehouse_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
