// jspdf is loaded via CDN in index.html and available globally as window.jspdf

window.generatePDF = function (companyId) {
    const company = window.Store.getCompany(companyId);
    if (!company) return alert('Company not found');

    const logs = window.Store.getLogs().filter(l => l.companyId === companyId);

    // Sort logs by date desc
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const primaryColor = [40, 44, 52]; // Dark Slate
    const accentColor = [99, 102, 241]; // Indigo

    // --- Header ---
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text(company.name, 14, 25);

    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    const dateStr = new Date().toLocaleDateString();
    doc.text('Order Growth Performance Report', 14, 32);
    doc.text(`Generated: ${dateStr}`, 196, 25, { align: 'right' });

    let finalY = 50;

    // --- 1. Product & Stock Overview ---
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('1. Product & Stock Overview', 14, finalY);

    const productRows = company.products.map(p => [
        p.sku,
        p.fsn,
        p.openingStock,
        p.totalDispatched,
        p.currentStock,
        p.currentStock > 0 ? 'In Stock' : 'Out of Stock'
    ]);

    // Add Totals Row
    const totalOpening = company.products.reduce((sum, p) => sum + p.openingStock, 0);
    const totalDispatchedStock = company.products.reduce((sum, p) => sum + p.totalDispatched, 0);
    const totalCurrent = company.products.reduce((sum, p) => sum + p.currentStock, 0);

    doc.autoTable({
        startY: finalY + 5,
        head: [['SKU', 'FSN Number', 'Opening', 'Dispatched', 'Remaining', 'Status']],
        body: [
            ...productRows,
            [
                { content: 'TOTALS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalOpening, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalDispatchedStock, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalCurrent, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: '', styles: { fillColor: [240, 240, 240] } }
            ]
        ],
        theme: 'plain',
        headStyles: {
            fillColor: [240, 240, 240],
            textColor: 80,
            fontSize: 10,
            fontStyle: 'bold',
            cellPadding: 6
        },
        bodyStyles: {
            fontSize: 10,
            textColor: 40,
            cellPadding: 6
        },
        columnStyles: {
            0: { fontStyle: 'bold' }
        }
    });

    finalY = doc.lastAutoTable.finalY + 15;

    // --- 2. Performance Summary ---
    doc.setFontSize(14);
    doc.text('2. Order Growth & Price', 14, finalY);

    // 4. Product Performance Table
    const productPerformanceRows = company.products.map(p => [
        p.sku,
        p.totalReceived,
        p.totalDispatched,
        `Rs. ${p.earnings}`
    ]);

    // Add Grand Total Row
    productPerformanceRows.push([
        { content: 'GRAND TOTAL', colSpan: 1, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: company.stats.totalReceived, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: company.stats.totalDispatched, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: `Rs. ${company.stats.earnings}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 128, 0] } } // Green color for Price
    ]);

    doc.autoTable({
        startY: finalY + 5,
        head: [['Product (SKU)', 'Orders Received', 'Orders Dispatched', 'Price (Rs.)']],
        body: productPerformanceRows,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5 },
        alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    finalY = doc.lastAutoTable.finalY + 15;

    // 5. Total Price Summary (Bottom Right)
    // Add a background box for emphasis
    doc.setFillColor(245, 255, 245); // Light green background
    doc.setDrawColor(0, 128, 0); // Green border
    doc.roundedRect(120, finalY, 76, 20, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Price Generated:', 188, finalY + 7, { align: 'right' });

    doc.setFontSize(18);
    doc.setTextColor(0, 128, 0); // Dark Green
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${company.stats.earnings}`, 188, finalY + 16, { align: 'right' });

    finalY = finalY + 30; // Push next section down

    // --- 3. Activity Log ---
    if (logs.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('3. Detailed Activity Log', 14, finalY);

        const logRows = logs.map(log => {
            const product = company.products.find(p => p.id === log.productId);
            const sku = product ? product.sku : 'Unknown';
            return [
                new Date(log.date).toLocaleDateString(),
                sku,
                log.receivedOrders,
                log.dispatchedOrders,
                `Rs. ${parseInt(log.receivedOrders) * 2}`
            ];
        });

        doc.autoTable({
            startY: finalY + 5,
            head: [['Date', 'Product (SKU)', 'Orders In', 'Dispatched', 'Price']],
            body: logRows,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                1: { fontStyle: 'italic' },
                4: { fontStyle: 'bold' }
            }
        });
        finalY = doc.lastAutoTable.finalY + 15;
    }


    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Order Growth Tracking System | Professional Business Unit', 14, 285);
        doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
    }

    doc.save(`${company.name}_GrowthReport.pdf`);
}
