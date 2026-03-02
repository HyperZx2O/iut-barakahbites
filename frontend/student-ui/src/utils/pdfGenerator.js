/**
 * PDF Receipt Generator for IUT BarakahBites
 * Generates a downloadable receipt when order status is READY.
 *
 * PDF Structure (from pdfplan.md):
 *  1. Header — "IUT BarakahBites" (Centered, Bold)
 *  2. Order Info — Token/Order ID and Timestamp
 *  3. Customer Info — Student ID
 *  4. Items Table — Item Name, Quantity, Price (Unit), Subtotal
 *  5. Summary — Total Cost (Bold)
 *  6. Footer — "Thank you for ordering! - Team PoweredByPatience"
 */
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Fallback price map (mirrors backend PRICE_MAP / frontend OrderForm)
const FALLBACK_PRICES = {
    'iftar-box-1': 250,
    'iftar-box-2': 250,
    'jilapi': 10,
    'dates': 15,
    'piyaju': 10,
    'beguni': 15,
    'chop': 20,
    'juice': 30,
    'parata': 10,
    'chicken-biriyani': 100,
    'halim': 50,
    'beef-biriyani': 150,
    'chola': 20,
};

// Friendly name lookup
const ITEM_NAMES = {
    'iftar-box-1': 'Iftar Box 1',
    'iftar-box-2': 'Iftar Box 2',
    'jilapi': 'Jilapi',
    'dates': 'Dates',
    'piyaju': 'Piyaju',
    'beguni': 'Beguni',
    'chop': 'Chop',
    'juice': 'Juice',
    'parata': 'Parata',
    'chicken-biriyani': 'Chicken Biriyani',
    'halim': 'Halim',
    'beef-biriyani': 'Beef Biriyani',
    'chola': 'Chola',
};

/**
 * @param {object} orderData
 * @param {string} orderData.orderId
 * @param {Array}  orderData.items     – [{itemName, itemId, quantity}]
 * @param {object} [orderData.metadata] – {itemsWithPrice, totalPrice}
 * @param {string} [orderData.studentId]
 * @param {Array}  [orderData.events]
 */
export function generateReceipt(orderData) {
    const { orderId, items, metadata, studentId, events } = orderData;

    // ── Build items table rows ──
    let tableRows = [];
    let totalPrice = 0;

    if (metadata && metadata.itemsWithPrice && metadata.itemsWithPrice.length > 0) {
        tableRows = metadata.itemsWithPrice.map(function (it) {
            const name = it.itemName || ITEM_NAMES[it.itemId] || it.itemId || 'Item';
            const qty = Number(it.quantity) || 1;
            const unit = Number(it.unitPrice) || 0;
            const sub = Number(it.subtotal) || (unit * qty);
            return [name, String(qty), unit + ' BDT', sub + ' BDT'];
        });
        totalPrice = Number(metadata.totalPrice) || 0;
        if (totalPrice === 0) {
            for (var i = 0; i < metadata.itemsWithPrice.length; i++) {
                totalPrice += Number(metadata.itemsWithPrice[i].subtotal) || 0;
            }
        }
    } else if (items && items.length > 0) {
        for (var j = 0; j < items.length; j++) {
            var it = items[j];
            var id = it.itemId || '';
            var name = it.itemName || ITEM_NAMES[id] || id || 'Item';
            var qty = Number(it.quantity) || 1;
            var unit = FALLBACK_PRICES[id] || 0;
            var sub = unit * qty;
            totalPrice += sub;
            tableRows.push([name, String(qty), unit + ' BDT', sub + ' BDT']);
        }
    }

    // ── Timestamps ──
    var orderTime = '';
    if (events && events.length > 0) {
        var pendingEvent = null;
        for (var k = 0; k < events.length; k++) {
            if (events[k].status === 'PENDING') { pendingEvent = events[k]; break; }
        }
        if (pendingEvent && pendingEvent.timestamp) {
            try {
                orderTime = new Date(pendingEvent.timestamp).toLocaleString('en-GB', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                });
            } catch (e) {
                orderTime = pendingEvent.timestamp;
            }
        }
    }
    if (!orderTime) {
        orderTime = new Date().toLocaleString('en-GB', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        });
    }

    var shortId = orderId ? orderId.slice(-6).toUpperCase() : '------';

    // ── Create PDF (A5 portrait — good receipt size) ──
    var doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
    });

    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 14;
    var y = 0;

    // ── Brand colors ──
    var brandRed = [176, 74, 60];
    var brandRedLight = [234, 115, 98];
    var white = [255, 255, 255];
    var cream = [255, 248, 240];
    var darkText = [50, 30, 25];
    var mutedText = [120, 100, 90];

    // ── Top brand bar ──
    doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.rect(0, 0, pageWidth, 8, 'F');

    // ── Header ──
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.text('IUT BarakahBites', pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Order Receipt', pageWidth / 2, y, { align: 'center' });

    // ── Separator line ──
    y += 5;
    doc.setDrawColor(brandRedLight[0], brandRedLight[1], brandRedLight[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    // ── Order Info section ──
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text('Order ID:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('#' + shortId, margin + 22, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Date/Time:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(orderTime, margin + 22, y);

    // ── Customer Info ──
    if (studentId) {
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text('Student ID:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(studentId), margin + 22, y);
    }

    // ── Separator ──
    y += 7;
    doc.setDrawColor(brandRedLight[0], brandRedLight[1], brandRedLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // ── Items Table ──
    if (tableRows.length > 0) {
        doc.autoTable({
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Item Name', 'Qty', 'Price (Unit)', 'Subtotal']],
            body: tableRows,
            theme: 'grid',
            styles: {
                fontSize: 9,
                textColor: [50, 30, 25],
                cellPadding: 3,
                lineColor: [220, 200, 190],
                lineWidth: 0.2,
            },
            headStyles: {
                fillColor: [brandRed[0], brandRed[1], brandRed[2]],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'center',
            },
            bodyStyles: {
                fillColor: [cream[0], cream[1], cream[2]],
            },
            alternateRowStyles: {
                fillColor: [255, 255, 255],
            },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right', fontStyle: 'bold' },
            },
        });
        y = doc.lastAutoTable.finalY + 5;
    } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
        doc.text('No items recorded for this order.', pageWidth / 2, y + 5, { align: 'center' });
        y += 15;
    }

    // ── Total line ──
    doc.setDrawColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.text('Total:', margin, y);
    doc.text(totalPrice + ' BDT', pageWidth - margin, y, { align: 'right' });

    // ── Bottom separator ──
    y += 8;
    doc.setDrawColor(brandRedLight[0], brandRedLight[1], brandRedLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    // ── Footer ──
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Thank you for ordering!', pageWidth / 2, y, { align: 'center' });

    y += 5;
    doc.setFontSize(9);
    doc.text('- Team PoweredByPatience', pageWidth / 2, y, { align: 'center' });

    // ── Bottom brand bar ──
    y += 10;
    doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.rect(0, y, pageWidth, 5, 'F');

    // ── Save ──
    doc.save('BarakahBites_Receipt_' + shortId + '.pdf');
}
