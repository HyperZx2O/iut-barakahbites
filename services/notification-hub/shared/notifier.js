/**
 * Shared Notification Utility
 * Standardizes status updates across microservices
 */

async function notifyHub(studentId, orderId, status, items = []) {
    const hubUrl = process.env.NOTIFICATION_HUB_URL || 'http://notification-hub:3005';
    const url = `${hubUrl.replace(/\/+$/, '')}/notify`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, orderId, status, items }),
            // Node 20 global fetch doesn't support timeout natively easily without AbortController
            // but choosing to keep it simple as per current implementation
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Hub notification failed with status ${response.status}: ${errorText}`);
        }
    } catch (err) {
        console.error(`Failed to notify hub [${status}] for order ${orderId}:`, err.message);
    }
}

module.exports = { notifyHub };
