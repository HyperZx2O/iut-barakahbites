# Implementation Plan: Generate Receipt PDF (v2.1)

This plan outlines the steps to implement a neomorphic "Generate Receipt" button in the Student Dashboard and the corresponding logic to create a downloadable PDF receipt, simplified by removing QR code generation.

## 1. Overview

When an order status changes to "Order Ready for Pickup" (or is loaded as `READY`), a new neomorphic button will appear. Clicking this button will generate a PDF receipt containing order details, branding, and transaction data.

## 2. Dependencies

- **jspdf**: Lightweight library for client-side PDF generation.
- **jspdf-autotable**: Plugin for table formatting within the PDF.

## 3. UI/UX Changes (Student Dashboard)

- **Component**: `frontend/student-ui/src/components/StatusTracker.jsx`
- **Logic**:
  - Add a conditional section that renders only when the order status is `READY`.
  - Implement a neomorphic button styled to match the dark-red themed `StatusTracker`.
  - **Styles**:
    - Background: `linear-gradient(145deg, #EA7362 0%, #B04A3C 100%)`
    - Shadow: `4px 4px 10px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(255,255,255,0.2)`
    - Hover: Scale `1.02`, Brighten slightly.
  - **Label**: "Generate Receipt"
  - **Icon**: `FileText` (from Lucide-react)

## 4. PDF Structure & Design

The generated PDF should include:

1. **Header**: "IUT BarakahBites" (Centered, Bold).
2. **Order Info**: Token/Order ID and Timestamp.
3. **Customer Info**: Student ID.
4. **Items Table**:
    - Columns: Item Name, Quantity, Price (Unit), Subtotal.
5. **Summary**: Total Cost (Bold).
6. **Footer**: "Thank you for ordering! - Team PoweredByPatience"

## 5. Technical Implementation Steps

### Phase A: Setup

1. Install dependencies:

    ```bash
    cd frontend/student-ui
    npm install jspdf jspdf-autotable
    ```

### Phase B: Backend Data Enrichment (CRITICAL)

Currently, the notification payload lacks price data.

1. **Shared Library**: Update `services/shared/notifier.js` to accept a `metadata` object (containing `totalPrice` and `itemsWithPrice`).
2. **Order Gateway**: In `POST /order`, fetch unit prices from `stock-service` (or a config) and include them in the `notifyHub` call.
3. **Notification Hub**: Ensure the SSE broadcast forwards this metadata to the frontend.

### Phase C: Frontend Logic

1. Create a utility function `generateReceipt(orderData)` in a new file `frontend/student-ui/src/utils/pdfGenerator.js`.
2. In `StatusTracker.jsx`, import this function.
3. Add the "Generate Receipt" button to the order card specifically below the `READY` status.
4. Wire the button's `onClick` to call `generateReceipt` with the `orderId`, `items`, and `metadata`.

### Phase D: PDF Styling

1. Use `jspdf-autotable` to create the items list.
2. Apply the BarakahBites color palette (Red/Cream) to the table headers/styling.

## 6. Testing Strategy

1. Place a standard order.
2. Force set the status to `READY` (via Admin Dashboard or Kitchen Worker).
3. Verify the button appears only on the specific `READY` order.
4. Click the button and check the downloaded PDF for:
    - Accurate pricing and subtotals.
    - Branding alignment ("IUT BarakahBites").
    - Professional layout and readable fonts.
