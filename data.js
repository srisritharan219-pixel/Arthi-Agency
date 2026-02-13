/**
 * Data Management Module
 * Handles storage and retrieval of Companies, Orders, and Stock data using LocalStorage.
 */

const STORAGE_KEY = 'growth_tracker_data';

const defaultData = {
    companies: [], // { id, name }
    products: [],  // { id, companyId, sku, fsn, openingStock }
    stockLogs: [], // { id, productId, amount, date }
    orders: [],    // { id, companyId, productId, date, received, dispatched }
    settings: {
        ratePerOrder: 2
    }
};

class DataManager {
    constructor() {
        this.data = this.loadData();
        this.migrateData(); // Ensure old data is converted
    }

    loadData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : defaultData;
    }

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    migrateData() {
        let migrated = false;

        if (!this.data.settings) {
            this.data.settings = defaultData.settings;
            migrated = true;
        }

        if (!this.data.stockLogs) {
            this.data.stockLogs = [];
            migrated = true;
        }

        if (!this.data.products) {
            this.data.products = [];
            migrated = true;
        }

        // --- NEW: ID Repair Migration ---
        // Ensure all products have UNIQUE IDs. If duplicates found, regenerate and update logs.
        const seenIds = new Set();
        this.data.products.forEach(p => {
            if (seenIds.has(p.id)) {
                const oldId = p.id;
                p.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);

                // Update corresponding logs
                this.data.orders.forEach(o => {
                    if (o.productId === oldId) o.productId = p.id;
                });
                if (this.data.stockLogs) {
                    this.data.stockLogs.forEach(s => {
                        if (s.productId === oldId) s.productId = p.id;
                    });
                }
                migrated = true;
            }
            seenIds.add(p.id);
        });

        this.data.companies.forEach(c => {
            // Migration: Add status if missing
            if (!c.status) {
                c.status = 'active';
                migrated = true;
            }

            if (c.sku && c.fsn) {
                // Check if this product already exists to avoid duplicates on multiple reloads
                const exists = this.data.products.find(p => p.companyId === c.id && p.sku === c.sku);
                if (!exists) {
                    this.data.products.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        companyId: c.id,
                        sku: c.sku,
                        fsn: c.fsn,
                        openingStock: parseInt(c.openingStock || 0)
                    });
                }
                // Clean up old properties
                delete c.sku;
                delete c.fsn;
                delete c.openingStock;
                delete c.currentStock;
                migrated = true;
            }
        });

        // Migration: Ensure orders have productId if possible (Older logs might be tricky, we'll assign to first product found for company)
        this.data.orders.forEach(order => {
            if (!order.productId) {
                const product = this.data.products.find(p => p.companyId === order.companyId);
                if (product) {
                    order.productId = product.id;
                    migrated = true;
                }
            }
        });

        if (migrated) this.saveData();
    }

    // --- Company Methods ---
    addCompany(name, initialProducts = []) {
        const newCompany = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            name: name,
            status: 'active'
        };
        this.data.companies.push(newCompany);

        if (Array.isArray(initialProducts)) {
            initialProducts.forEach(product => {
                if (product.sku && product.fsn) {
                    this.addProduct({
                        companyId: newCompany.id,
                        sku: product.sku,
                        fsn: product.fsn,
                        openingStock: product.openingStock || 0
                    });
                }
            });
        }

        this.saveData();
        return newCompany;
    }

    toggleCompanyStatus(id) {
        const company = this.data.companies.find(c => c.id === id);
        if (company) {
            company.status = company.status === 'active' ? 'inactive' : 'active';
            this.saveData();
            return company;
        }
        return null;
    }

    getCompanies() {
        // Return companies with their products attached
        return this.data.companies.map(c => this.getCompany(c.id));
    }

    getCompany(id) {
        const c = this.data.companies.find(c => c.id === id);
        if (!c) return null;

        const products = this.data.products.filter(p => p.companyId === id);

        // Enhance products with their specific stats
        const enhancedProducts = products.map(p => {
            const stats = this.getProductStats(p.id);
            return { ...p, ...stats };
        });

        const companyStats = this.getCompanyStats(id);

        return {
            ...c,
            products: enhancedProducts,
            stats: companyStats
        };
    }

    // --- Product Methods ---
    addProduct(productData) { // { companyId, sku, fsn, openingStock }
        const newProduct = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            ...productData,
            openingStock: parseInt(productData.openingStock)
        };
        this.data.products.push(newProduct);
        this.saveData();
        return newProduct;
    }

    getProduct(productId) {
        return this.data.products.find(p => p.id === productId);
    }

    // --- Stock Methods ---
    addStockLog(productId, amount) {
        const newLog = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            productId,
            amount: parseInt(amount),
            date: new Date().toISOString()
        };
        this.data.stockLogs.push(newLog);
        this.saveData();
        return newLog;
    }

    // --- Order Methods ---
    addDailyLog(log) { // { companyId, productId, date, receivedOrders, dispatchedOrders }
        const newLog = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ...log
        };
        this.data.orders.push(newLog);
        this.saveData();
        return newLog;
    }

    addBulkDailyLogs(logs) {
        if (!Array.isArray(logs)) return;

        logs.forEach(log => {
            this.data.orders.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                timestamp: new Date().toISOString(),
                ...log
            });
        });

        this.saveData();
    }

    getLogs() {
        return this.data.orders;
    }

    // --- Stats & Calculations ---

    getProductStats(productId) {
        const product = this.data.products.find(p => p.id === productId);
        if (!product) return { currentStock: 0, totalReceived: 0, totalDispatched: 0, earnings: 0, totalAddedStock: 0 };

        const logs = this.data.orders.filter(l => l.productId === productId);
        const stockLogs = this.data.stockLogs ? this.data.stockLogs.filter(l => l.productId === productId) : [];

        const totalReceived = logs.reduce((sum, l) => sum + parseInt(l.receivedOrders || 0), 0);
        const totalDispatched = logs.reduce((sum, l) => sum + parseInt(l.dispatchedOrders || 0), 0);
        const totalAddedStock = stockLogs.reduce((sum, l) => sum + parseInt(l.amount || 0), 0);

        const currentStock = (parseInt(product.openingStock) + totalAddedStock) - totalDispatched;
        const earnings = totalReceived * this.data.settings.ratePerOrder;

        return {
            totalReceived,
            totalDispatched,
            currentStock,
            earnings,
            totalAddedStock
        };
    }

    getCompanyStats(companyId) {
        // Aggregate stats from all products of this company
        const products = this.data.products.filter(p => p.companyId === companyId);

        let totalReceived = 0;
        let totalDispatched = 0;
        let currentStock = 0;
        let earnings = 0;

        products.forEach(p => {
            const pStats = this.getProductStats(p.id);
            totalReceived += pStats.totalReceived;
            totalDispatched += pStats.totalDispatched;
            currentStock += pStats.currentStock;
            earnings += pStats.earnings;
        });

        return {
            totalReceived,
            totalDispatched,
            currentStock,
            earnings
        };
    }

    getDashboardStats() {
        const companies = this.data.companies;
        let totalOrders = 0;
        let totalDispatched = 0;
        let totalEarnings = 0;

        companies.forEach(c => {
            const stats = this.getCompanyStats(c.id);
            totalOrders += stats.totalReceived;
            totalDispatched += stats.totalDispatched;
            totalEarnings += stats.earnings;
        });

        return {
            totalOrders,
            totalDispatched,
            totalEarnings,
            activeCompanies: companies.length
        };
    }

    resetData() {
        this.data = JSON.parse(JSON.stringify(defaultData)); // Deep copy to avoid reference issues
        this.saveData();
    }
}

// Global Assignment
window.Store = new DataManager();
