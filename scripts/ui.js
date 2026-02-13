window.UI = {
    // Icons initialization
    initIcons() {
        lucide.createIcons();
    },

    // View Switching
    switchView(viewName) {
        // Update Sidebar
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === viewName);
        });

        // Update Content
        const contentArea = document.getElementById('content-area');
        const pageTitle = document.getElementById('page-title');

        pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
        contentArea.innerHTML = '';

        switch (viewName) {
            case 'dashboard':
                this.renderDashboard(contentArea);
                break;
            case 'inventory':
                this.renderInventory(contentArea);
                break;
            case 'orders':
                this.renderOrders(contentArea);
                break;
            case 'stock':
                this.renderStock(contentArea);
                break;
            case 'reports':
                this.renderReports(contentArea);
                break;
        }

        this.initIcons();
    },

    // Renders
    renderDashboard(container) {
        const stats = window.Store.getDashboardStats();

        container.innerHTML = `
            <div class="stats-grid">
                <div class="card stat-card">
                    <div class="stat-header">
                        <span>Total Earnings</span>
                        <i data-lucide="indian-rupee" class="text-success"></i>
                    </div>
                    <div class="stat-value">₹${stats.totalEarnings}</div>
                    <div class="stat-trend trend-up">
                        <i data-lucide="trending-up" size="16"></i> Based on order count
                    </div>
                </div>
                <div class="card stat-card">
                    <div class="stat-header">
                        <span>Orders Received</span>
                        <i data-lucide="shopping-bag" class="text-primary"></i>
                    </div>
                    <div class="stat-value">${stats.totalOrders}</div>
                    <div class="stat-header" style="margin-top: auto">
                         <span>Rate: ₹2/order</span>
                    </div>
                </div>
                <div class="card stat-card">
                    <div class="stat-header">
                        <span>Dispatched</span>
                        <i data-lucide="truck" class="text-warning"></i>
                    </div>
                    <div class="stat-value">${stats.totalDispatched}</div>
                    <div class="stat-trend">
                        <span>Out for delivery</span>
                    </div>
                </div>
                <div class="card stat-card">
                    <div class="stat-header">
                        <span>Active Companies</span>
                        <i data-lucide="building-2" class="text-muted"></i>
                    </div>
                    <div class="stat-value">${stats.activeCompanies}</div>
                </div>
            </div>

            <div class="card">
                <h3>Recent Activity</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Company</th>
                                <th>Product</th>
                                <th>Orders In</th>
                                <th>Dispatched</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.getRecentActivityRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    getRecentActivityRows() {
        const logs = [...window.Store.getLogs()].reverse().slice(0, 5);
        if (logs.length === 0) return '<tr><td colspan="5" class="text-muted" style="text-align:center">No activity yet</td></tr>';

        return logs.map(log => {
            const company = window.Store.getCompany(log.companyId);
            const product = window.Store.getProduct(log.productId);
            return `
                <tr>
                    <td>${new Date(log.date).toLocaleDateString()}</td>
                    <td>${company ? company.name : 'Unknown'}</td>
                    <td>
                        <div style="font-weight: 500;">${product ? product.sku : 'Unknown'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${product ? product.fsn : '--'}</div>
                    </td>
                    <td>${log.receivedOrders}</td>
                    <td>${log.dispatchedOrders}</td>
                </tr>
            `;
        }).join('');
    },

    renderInventory(container) {
        const companies = window.Store.getCompanies();
        const activeCompanies = companies.filter(c => c.status !== 'inactive');
        const inactiveCompanies = companies.filter(c => c.status === 'inactive');

        container.innerHTML = `
            <div style="display: flex; justify-content: flex-end; margin-bottom: var(--space-md);">
                <button id="btn-add-company" class="btn btn-primary">
                    <i data-lucide="building-2"></i> Add Company
                </button>
            </div>

            <!-- Add Company Modal -->
            <div id="modal-add-company" class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Add New Company</h3>
                        <button class="close-modal"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-add-company">
                        <div class="form-group">
                            <label>Company Name</label>
                            <input type="text" name="name" required placeholder="e.g. Alpha Traders">
                        </div>
                        
                        <div id="initial-products-container">
                            <h4 style="margin: 1rem 0 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Initial Products</h4>
                            <div class="product-entry-row" style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--border);">
                                <div class="form-row">
                                     <div class="form-group">
                                        <label>SKU ID</label>
                                        <input type="text" name="sku[]" required placeholder="SKU-1234">
                                    </div>
                                    <div class="form-group">
                                        <label>FSN Number</label>
                                        <input type="text" name="fsn[]" required placeholder="FSN-XYZ">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Opening Stock</label>
                                    <input type="number" name="openingStock[]" required min="0" placeholder="0">
                                </div>
                            </div>
                        </div>

                        <button type="button" class="btn btn-outline btn-sm" id="btn-add-product-row" style="margin-bottom: 1.5rem; width: 100%;">
                            <i data-lucide="plus"></i> Add Another Product
                        </button>

                        <button type="submit" class="btn btn-primary" style="width: 100%;">Save Company & Products</button>
                    </form>
                </div>
            </div>

            <!-- Add Product Modal -->
            <div id="modal-add-product" class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Add Product to <span id="add-product-company-name"></span></h3>
                        <button class="close-modal"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-add-product">
                        <input type="hidden" name="companyId" id="add-product-company-id">
                        <div class="form-row">
                             <div class="form-group">
                                <label>SKU ID</label>
                                <input type="text" name="sku" required placeholder="SKU-1234">
                            </div>
                            <div class="form-group">
                                <label>FSN Number</label>
                                <input type="text" name="fsn" required placeholder="FSN-XYZ">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Opening Stock</label>
                            <input type="number" name="openingStock" required min="0" placeholder="0">
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: -0.5rem; margin-bottom: 1rem;">
                            <input type="checkbox" id="keep-adding-product" style="width: auto; margin: 0;">
                            <label for="keep-adding-product" style="margin: 0; font-size: 0.9rem; cursor: pointer;">Keep adding products?</label>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Product</button>
                    </form>
                </div>
            </div>

            <!-- Add Stock Modal -->
            <div id="modal-add-stock" class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Update Stock</h3>
                        <button class="close-modal"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-add-stock">
                        <input type="hidden" name="productId" id="add-stock-product-id">
                        <div class="form-group">
                            <p class="text-secondary" style="margin-bottom: var(--space-md)">
                                Adding stock for SKU: <strong id="add-stock-sku" class="text-primary"></strong>
                            </p>
                            <label>Stock to Add</label>
                            <input type="number" name="amount" required min="1" placeholder="e.g. 50">
                            <small class="text-muted">This will be added to the current inventory.</small>
                        </div>
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="package-plus"></i> Add Stock
                        </button>
                    </form>
                </div>
            </div>

            <!-- Active Companies List -->
            <h4 class="text-muted" style="margin-bottom: 1rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.1em;">Active Projects</h4>
            <div class="company-list">
                ${activeCompanies.map(c => this.renderCompanyCard(c)).join('')}
                ${activeCompanies.length === 0 ? '<div class="text-center text-muted" style="padding: 2rem; border: 1px dashed var(--border); border-radius: var(--radius-md); margin-bottom: 2rem;">No active companies.</div>' : ''}
            </div>

            <!-- Inactive Companies List -->
            ${inactiveCompanies.length > 0 ? `
                <h4 class="text-muted" style="margin-top: 2rem; margin-bottom: 1rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.1em;">Completed / Inactive</h4>
                <div class="company-list" style="opacity: 0.7;">
                    ${inactiveCompanies.map(c => this.renderCompanyCard(c)).join('')}
                </div>
            ` : ''}
        `;

        this.attachInventoryListeners();
        // Attach View Details Click
        document.querySelectorAll('.btn-view-details').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView('company', btn.dataset.id);
            });
        });
    },

    renderCompanyDetails(companyId) {
        const company = window.Store.getCompany(companyId);
        if (!company) return this.switchView('inventory');

        const container = document.getElementById('company-view'); // Assuming 'company-view' is the container for company details
        const isInactive = company.status === 'inactive';

        // Calculate Stats
        const stats = window.Store.getCompanyStats(companyId);

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h1 style="margin:0; font-size: 2.5rem; background: var(--gold-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${company.name}</h1>
                    <span style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em;">
                        ${isInactive ? 'Archived Project' : 'Active Project'}
                    </span>
                </div>
                <div style="display: flex; gap: 1rem;">
                     <button class="btn btn-primary" onclick="window.generatePDF('${company.id}')">
                        <i data-lucide="download"></i> Download Report
                    </button>
                    ${!isInactive ? `
                    <button class="btn btn-outline btn-add-product" data-id="${company.id}" data-name="${company.name}">
                        <i data-lucide="plus"></i> Add Product
                    </button>` : ''}
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="card stat-card">
                    <div class="stat-header">Total Price</div>
                    <div class="stat-value">Rs. ${stats.earnings}</div>
                    <div class="stat-trend trend-up"><i data-lucide="trending-up" width="16"></i> Lifetime Revenue</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-header">Orders Received</div>
                    <div class="stat-value">${stats.totalReceived}</div>
                    <div class="stat-trend"><i data-lucide="package" width="16"></i> Total Volume</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-header">Total Dispatched</div>
                    <div class="stat-value">${stats.totalDispatched}</div>
                    <div class="stat-trend"><i data-lucide="truck" width="16"></i> Completed Orders</div>
                </div>
                 <div class="card stat-card">
                    <div class="stat-header">Stock Remaining</div>
                    <div class="stat-value">${company.products.reduce((acc, p) => acc + p.currentStock, 0)}</div>
                    <div class="stat-trend"><i data-lucide="box" width="16"></i> Across all SKUs</div>
                </div>
            </div>

            <!-- Products Table -->
            <div class="card" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1.5rem; color: var(--primary);">Product Inventory</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>FSN Number</th>
                                <th>Opening</th>
                                <th>Added</th>
                                <th>Dispatched</th>
                                <th>Remaining</th>
                                <th>Price (Rs.)</th>
                                ${!isInactive ? '<th>Actions</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${company.products.map(p => `
                                <tr>
                                    <td style="font-weight: bold; color: var(--primary);">${p.sku}</td>
                                    <td>${p.fsn}</td>
                                    <td>${p.openingStock}</td>
                                    <td>${p.totalAddedStock || 0}</td>
                                    <td>${p.totalDispatched}</td>
                                    <td>
                                        <span class="${p.currentStock < 10 ? 'text-danger' : 'text-success'}">${p.currentStock}</span>
                                    </td>
                                    <td style="color: var(--success); font-weight: bold;">Rs. ${p.earnings}</td>
                                    ${!isInactive ? `
                                    <td>
                                        <button class="btn-icon-sm btn-update-stock" data-id="${p.id}" data-sku="${p.sku}" title="Add Stock" style="color: var(--success); border-color: var(--success);">
                                            <i data-lucide="plus"></i>
                                        </button>
                                    </td>` : ''}
                                </tr>
                            `).join('')}
                             ${company.products.length === 0 ? '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No products added yet.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        lucide.createIcons();
        this.attachDynamicListeners(); // Re-attach for new buttons
    },

    attachDynamicListeners() {
        // Re-attach listeners for dynamically created elements like "Add Product" or "Update Stock" buttons
        document.querySelectorAll('.btn-add-product').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('add-product-company-id').value = btn.dataset.id;
                document.getElementById('add-product-company-name').textContent = btn.dataset.name;
                document.getElementById('modal-add-product').classList.add('open');
            });
        });

        document.querySelectorAll('.btn-update-stock').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('add-stock-product-id').value = btn.dataset.id;
                document.getElementById('add-stock-sku').textContent = btn.dataset.sku;
                document.getElementById('modal-add-stock').classList.add('open');
            });
        });
    },

    renderCompanyCard(company) {
        const isInactive = company.status === 'inactive';

        // Only show simplified card for inventory view
        return `
            <div class="card" style="margin-bottom: 1.5rem; opacity: ${isInactive ? '0.8' : '1'}; border-left: 3px solid ${isInactive ? 'var(--text-muted)' : 'var(--primary)'}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <h3 style="margin:0; font-size: 1.25rem;">${company.name}</h3>
                        ${isInactive ? '<span style="font-size: 0.7em; background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">ARCHIVED</span>' : ''}
                    </div>
                     <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary btn-sm btn-view-details" data-id="${company.id}">
                            View Dashboard
                        </button>
                        <button class="btn btn-outline btn-sm btn-toggle-status" data-id="${company.id}" title="${isInactive ? 'Activate' : 'Mark as Inactive'}" style="width: 32px; padding: 0;">
                            <i data-lucide="${isInactive ? 'rotate-ccw' : 'archive'}"></i>
                        </button>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                    <div class="stat-mini">
                        <span class="label">Products</span>
                        <span class="value" style="color: var(--primary);">${company.products.length}</span>
                    </div>
                     <div class="stat-mini">
                        <span class="label">Total Orders</span>
                        <span class="value">${company.stats.totalReceived}</span>
                    </div>
                     <div class="stat-mini">
                        <span class="label">Dispatched</span>
                        <span class="value">${company.stats.totalDispatched}</span>
                    </div>
                     <div class="stat-mini">
                        <span class="label">Price</span>
                        <span class="value" style="color: var(--success);">Rs. ${company.stats.earnings}</span>
                    </div>
                </div>
            </div>
        `;
    },

    attachInventoryListeners() {
        // Company Modal
        const companyModal = document.getElementById('modal-add-company');
        document.getElementById('btn-add-company').addEventListener('click', () => companyModal.classList.add('open'));
        companyModal.querySelector('.close-modal').addEventListener('click', () => companyModal.classList.remove('open'));

        // Add Product Row Logic
        const addRowBtn = document.getElementById('btn-add-product-row');
        const productsContainer = document.getElementById('initial-products-container');

        addRowBtn.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'product-entry-row';
            row.style = 'background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--border); position: relative;';
            row.innerHTML = `
                <button type="button" class="btn-icon-sm remove-row" style="position: absolute; top: 0.5rem; right: 0.5rem; color: var(--danger);">
                    <i data-lucide="trash-2"></i>
                </button>
                <div class="form-row">
                    <div class="form-group">
                        <label>SKU ID</label>
                        <input type="text" name="sku[]" required placeholder="SKU-1234">
                    </div>
                    <div class="form-group">
                        <label>FSN Number</label>
                        <input type="text" name="fsn[]" required placeholder="FSN-XYZ">
                    </div>
                </div>
                <div class="form-group">
                    <label>Opening Stock</label>
                    <input type="number" name="openingStock[]" required min="0" placeholder="0">
                </div>
            `;
            productsContainer.appendChild(row);
            lucide.createIcons();

            row.querySelector('.remove-row').addEventListener('click', () => row.remove());
        });

        document.getElementById('form-add-company').addEventListener('submit', (e) => {
            e.preventDefault();
            const form = e.target;
            const name = form.querySelector('[name="name"]').value;

            // Collect all products
            const products = [];
            const rows = form.querySelectorAll('.product-entry-row');

            rows.forEach(row => {
                products.push({
                    sku: row.querySelector('[name="sku[]"]').value,
                    fsn: row.querySelector('[name="fsn[]"]').value,
                    openingStock: row.querySelector('[name="openingStock[]"]').value
                });
            });

            window.Store.addCompany(name, products);
            companyModal.classList.remove('open');
            this.switchView('inventory');
        });

        // Toggle Status Logic
        document.querySelectorAll('.btn-toggle-status').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Are you sure you want to change the status of this company?')) {
                    window.Store.toggleCompanyStatus(btn.dataset.id);
                    this.switchView('inventory');
                }
            });
        });

        // Back to Inventory Button
        const backBtn = document.getElementById('btn-back-inventory');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.switchView('inventory');
            });
        }

        // Product Modal Logic
        const productModal = document.getElementById('modal-add-product');
        document.querySelectorAll('.btn-add-product').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('add-product-company-id').value = btn.dataset.id;
                document.getElementById('add-product-company-name').textContent = btn.dataset.name;
                productModal.classList.add('open');
            });
        });

        productModal.querySelector('.close-modal').addEventListener('click', () => productModal.classList.remove('open'));

        document.getElementById('form-add-product').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const keepAdding = document.getElementById('keep-adding-product').checked;

            window.Store.addProduct({
                companyId: formData.get('companyId'),
                sku: formData.get('sku'),
                fsn: formData.get('fsn'),
                openingStock: formData.get('openingStock')
            });

            if (keepAdding) {
                // Reset SKU, FSN and Opening Stock but keep the modal open and maintain company ID
                e.target.querySelector('[name="sku"]').value = '';
                e.target.querySelector('[name="fsn"]').value = '';
                e.target.querySelector('[name="openingStock"]').value = '';
                e.target.querySelector('[name="sku"]').focus();
            } else {
                productModal.classList.remove('open');
            }

            // Re-render the view to show the new product
            const companyDetailsContainer = document.getElementById('company-details-container');
            if (companyDetailsContainer && document.getElementById('company-view').style.display !== 'none') {
                this.renderCompanyDetails(formData.get('companyId'));
            } else {
                this.switchView('inventory');
            }
        });

        // Stock Update Modal Logic
        const stockModal = document.getElementById('modal-add-stock');
        // We use event delegation or re-attach logic for dynamic buttons, but since we re-render full view:
        // Actually renderInventory re-renders everything. We need listeners on the new buttons.
        // Wait, attachInventoryListeners is called AFTER render. So standard querySelectorAll is fine.

        document.querySelectorAll('.btn-update-stock').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('add-stock-product-id').value = btn.dataset.id;
                document.getElementById('add-stock-sku').textContent = btn.dataset.sku;
                stockModal.classList.add('open');
            });
        });

        stockModal.querySelector('.close-modal').addEventListener('click', () => stockModal.classList.remove('open'));

        document.getElementById('form-add-stock').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            window.Store.addStockLog(
                formData.get('productId'),
                formData.get('amount')
            );
            stockModal.classList.remove('open');
            this.switchView('inventory'); // Re-render to show updated stock
        });
    },

    renderOrders(container) {
        const companies = window.Store.getCompanies().filter(c => c.status !== 'inactive');

        if (companies.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <i data-lucide="alert-circle" size="48" class="text-muted" style="margin-bottom: 1rem;"></i>
                    <h3>No Active Companies</h3>
                    <p class="text-muted">Please add or activate companies in the Inventory section.</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="document.querySelector('[data-view=inventory]').click()">
                        Go to Inventory
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="card">
                <h3>Log Daily Activity</h3>
                <div class="form-group" style="max-width: 400px; margin-bottom: 2rem;">
                    <label>Select Company</label>
                    <select id="select-company-logs" required>
                        <option value="">-- Choose Company --</option>
                        ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>

                <div id="logs-list-container" style="display: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 id="logs-company-name" class="text-primary"></h4>
                        <div class="form-group" style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                            <label style="margin:0">Action Date:</label>
                            <input type="date" id="log-date" value="${new Date().toISOString().split('T')[0]}" style="width: auto">
                        </div>
                    </div>

                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU / FSN Number</th>
                                    <th>Available Stock</th>
                                    <th>Orders In</th>
                                    <th>Dispatched</th>
                                </tr>
                            </thead>
                            <tbody id="logs-table-body">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top: 1.5rem; text-align: right;">
                        <button id="btn-save-all-logs" class="btn btn-primary btn-lg">
                            <i data-lucide="save"></i> Save All Logs
                        </button>
                    </div>
                </div>
            </div>
        `;

        const companySelect = document.getElementById('select-company-logs');
        const logsContainer = document.getElementById('logs-list-container');
        const tableBody = document.getElementById('logs-table-body');
        const companyLabel = document.getElementById('logs-company-name');

        companySelect.addEventListener('change', (e) => {
            const companyId = e.target.value;
            if (!companyId) {
                logsContainer.style.display = 'none';
                return;
            }

            const company = window.Store.getCompany(companyId);
            companyLabel.textContent = company.name;
            this.refreshLogsTable(company, tableBody);
            logsContainer.style.display = 'block';
            lucide.createIcons();
        });

        // Attach listener to single save button (Once, in renderOrders)
        const saveAllBtn = document.getElementById('btn-save-all-logs');
        saveAllBtn.addEventListener('click', () => {
            const companyId = companySelect.value;
            if (!companyId) return;

            const date = document.getElementById('log-date').value;
            const rows = tableBody.querySelectorAll('tr');
            const bulkLogs = [];

            rows.forEach(row => {
                const productId = row.querySelector('.received-input').dataset.id;
                const received = row.querySelector('.received-input').value || 0;
                const dispatched = row.querySelector('.dispatched-input').value || 0;

                if (parseInt(received) > 0 || parseInt(dispatched) > 0) {
                    bulkLogs.push({
                        companyId,
                        productId,
                        date,
                        receivedOrders: parseInt(received),
                        dispatchedOrders: parseInt(dispatched)
                    });
                }
            });

            if (bulkLogs.length === 0) {
                alert('Please enter quantities for at least one product.');
                return;
            }

            window.Store.addBulkDailyLogs(bulkLogs);
            alert(`Logs saved for ${bulkLogs.length} product(s)!`);

            // Refresh table to show new stock
            const updatedCompany = window.Store.getCompany(companyId);
            this.refreshLogsTable(updatedCompany, tableBody);
            lucide.createIcons();
        });
    },

    refreshLogsTable(company, tableBody) {
        const today = new Date().toISOString().split('T')[0];
        const allLogs = window.Store.getLogs();

        tableBody.innerHTML = company.products.map(p => {
            const stats = window.Store.getProductStats(p.id);
            const currentStock = stats ? stats.currentStock : p.openingStock;

            // Calculate what's already been logged today for this product
            const todayLogs = allLogs.filter(l => l.productId === p.id && l.date === today);
            const loggedIn = todayLogs.reduce((sum, l) => sum + (l.receivedOrders || 0), 0);
            const loggedOut = todayLogs.reduce((sum, l) => sum + (l.dispatchedOrders || 0), 0);

            return `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${p.sku}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${p.fsn}</div>
                    </td>
                    <td>
                        <span class="badge ${currentStock < 10 ? 'badge-danger' : 'badge-success'}">
                            ${currentStock} Units
                        </span>
                        ${(loggedIn > 0 || loggedOut > 0) ? `
                            <div style="font-size: 0.7rem; margin-top: 0.4rem; color: var(--text-secondary);">
                                Today: <span class="text-primary">${loggedIn} In</span> | <span class="text-warning">${loggedOut} Out</span>
                            </div>
                        ` : ''}
                    </td>
                    <td style="width: 120px;">
                        <input type="number" class="received-input" data-id="${p.id}" min="0" placeholder="0" style="padding: 4px 8px; font-size: 0.9rem;">
                    </td>
                    <td style="width: 120px;">
                        <input type="number" class="dispatched-input" data-id="${p.id}" min="0" placeholder="0" style="padding: 4px 8px; font-size: 0.9rem;">
                    </td>
                </tr>
            `;
        }).join('');
    },

    renderStock(container) {
        const companies = window.Store.getCompanies();

        container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h3>FSN Inventory Summary</h3>
                        <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.25rem;">Detailed stock tracking per individual FSN Number</p>
                    </div>
                    <div class="form-group" style="margin: 0; width: 300px;">
                        <input type="text" id="stock-search" placeholder="Search SKU, FSN, or Company..." style="padding: 0.6rem 1rem;">
                    </div>
                </div>

                <div class="table-container">
                    <table id="stock-summary-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>SKU / FSN</th>
                                <th style="text-align: center;">Opening</th>
                                <th style="text-align: center;">Manual Add</th>
                                <th style="text-align: center; color: var(--primary);">Orders In</th>
                                <th style="text-align: center; color: var(--warning);">Dispatched</th>
                                <th style="text-align: center;">Available Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${companies.map(c => c.products.map(p => {
            const stats = window.Store.getProductStats(p.id);
            const currentStock = stats ? stats.currentStock : p.openingStock;
            const totalOrdersIn = stats ? stats.totalReceived : 0;
            const totalDispatched = stats ? stats.totalDispatched : 0;
            const totalManualAdd = stats ? stats.totalAddedStock : 0;
            return `
                                    <tr>
                                        <td><strong class="text-primary">${c.name}</strong></td>
                                        <td>
                                            <div style="font-weight: 600;">${p.sku}</div>
                                            <div style="font-size: 0.8rem; color: var(--text-muted);">${p.fsn}</div>
                                        </td>
                                        <td style="text-align: center;">${p.openingStock}</td>
                                        <td style="text-align: center;">${totalManualAdd}</td>
                                        <td style="text-align: center; font-weight: 600; color: var(--primary);">${totalOrdersIn}</td>
                                        <td style="text-align: center; font-weight: 600; color: var(--warning);">${totalDispatched}</td>
                                        <td style="text-align: center;">
                                            <span class="badge ${currentStock < 5 ? 'badge-danger' : (currentStock < 20 ? 'badge-warning' : 'badge-success')}" style="font-size: 1rem; min-width: 60px; text-align: center;">
                                                ${currentStock}
                                            </span>
                                        </td>
                                    </tr>
                                `;
        }).join('')).join('')}
                            ${companies.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No companies/products found.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Add Search Functionality
        const searchInput = document.getElementById('stock-search');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#stock-summary-table tbody tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    },

    renderReports(container) {
        container.innerHTML = `
            <div class="card">
                <h3>Generate Reports</h3>
                <p class="text-muted" style="margin-bottom: var(--space-lg)">Download detailed PDF reports for each company including earnings and stock details.</p>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Total Orders</th>
                                <th>Total Earnings</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${window.Store.getCompanies().map(c => {
            return `
                                    <tr>
                                        <td>
                                            <strong>${c.name}</strong>
                                            <div style="font-size:0.8rem; color:var(--text-muted)">Products: ${c.products.length}</div>
                                        </td>
                                        <td>${c.stats.totalReceived}</td>
                                        <td>₹${c.stats.earnings}</td>
                                        <td>
                                            <button class="btn btn-outline btn-sm btn-download" data-id="${c.id}">
                                                <i data-lucide="download"></i> Download PDF
                                            </button>
                                        </td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
       `;

        // Attach PDF generation listeners
        container.querySelectorAll('.btn-download').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                if (window.generatePDF) {
                    window.generatePDF(id);
                } else {
                    alert('PDF generation module not loaded.');
                }
            });
        });
    }
};
