import { useEffect, useState } from 'react';
import api from '../api';

const STOCK_API = import.meta.env.VITE_STOCK_URL || 'http://localhost:3003';

/* Shared neomorphic button for stock items */
function StockBtn({ label, colorRgb, onClick, style }) {
    const base = `rgba(${colorRgb}, 0.4)`;
    const hover = `rgba(${colorRgb}, 0.65)`;

    const bsRest = `8px 8px 20px rgba(0,0,0,0.5), -5px -5px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.15)`;
    const bsHover = `10px 10px 26px rgba(0,0,0,0.5), -6px -6px 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 18px rgba(${colorRgb}, 0.18)`;
    const bsDown = `inset 6px 6px 16px rgba(0,0,0,0.45), inset -4px -4px 12px rgba(0,0,0,0.05), 0 0 10px rgba(${colorRgb}, 0.1)`;

    return (
        <button
            onClick={onClick}
            style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#FFD6B6',
                background: 'transparent',
                border: `1.5px solid ${base}`,
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textShadow: `0 0 8px rgba(${colorRgb}, 0.55), 0 2px 4px rgba(0,0,0,0.7)`,
                boxShadow: bsRest,
                transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                ...style
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = hover;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = bsHover;
                e.currentTarget.style.textShadow = `0 0 12px rgba(${colorRgb}, 0.75), 0 2px 4px rgba(0,0,0,0.8)`;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = base;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = bsRest;
                e.currentTarget.style.textShadow = `0 0 8px rgba(${colorRgb}, 0.55), 0 2px 4px rgba(0,0,0,0.7)`;
            }}
            onMouseDown={e => {
                e.currentTarget.style.transform = 'translateY(1px)';
                e.currentTarget.style.boxShadow = bsDown;
            }}
            onMouseUp={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = bsHover;
            }}
        >
            {label}
        </button>
    );
}

export default function StockManager() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // New Item State
    const [newItemMode, setNewItemMode] = useState(false); // false, 'item', 'combo'
    const [newItem, setNewItem] = useState({ itemId: '', name: '', quantity: 0, price: 0, contents: '' });
    const [creating, setCreating] = useState(false);

    // Selected Item State
    const [selectedItemId, setSelectedItemId] = useState('');

    const fetchStock = async () => {
        try {
            const res = await api.get(`${STOCK_API}/stock`);
            const sortedItems = res.data.sort((a, b) => a.name.localeCompare(b.name));
            setItems(sortedItems);
            setError(null);
        } catch (err) {
            setError('Failed to fetch stock items.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
        const id = setInterval(fetchStock, 3000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (items.length > 0 && !selectedItemId) {
            setSelectedItemId(items[0].item_id);
        }
    }, [items, selectedItemId]);

    const handleUpdateStock = async (itemId, currentQty) => {
        const qtyStr = prompt(`Enter new quantity for ${itemId}:`, currentQty);
        if (qtyStr === null) return;
        const quantity = parseInt(qtyStr, 10);
        if (isNaN(quantity) || quantity < 0) {
            alert('Invalid quantity. Must be a non-negative integer.');
            return;
        }
        try {
            await api.post(`${STOCK_API}/stock/${itemId}/set`, { quantity });
            fetchStock();
        } catch (err) {
            alert('Failed to update stock.');
        }
    };

    const handleUpdateName = async (itemId, currentName) => {
        const name = prompt(`Enter new name for ${itemId}:`, currentName);
        if (!name?.trim()) return;
        try {
            await api.patch(`${STOCK_API}/stock/${itemId}`, { name: name.trim() });
            fetchStock();
        } catch (err) {
            alert('Failed to update name.');
        }
    };

    const handleDelete = async (itemId) => {
        if (!confirm(`Are you sure you want to delete ${itemId}?`)) return;
        try {
            await api.delete(`${STOCK_API}/stock/${itemId}`);
            setSelectedItemId(''); // Reset selection
            fetchStock();
        } catch (err) {
            alert('Failed to delete item.');
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            let parsedContents = [];
            if (newItemMode === 'combo' && newItem.contents.trim()) {
                parsedContents = newItem.contents.split('\n').map(s => s.trim()).filter(Boolean);
            }

            const payload = {
                itemId: newItem.itemId.trim(),
                name: newItem.name.trim(),
                quantity: parseInt(newItem.quantity, 10) || 0,
                price: parseInt(newItem.price, 10) || 0,
                contents: parsedContents
            };

            await api.post(`${STOCK_API}/stock`, payload);
            setNewItemMode(false);
            setNewItem({ itemId: '', name: '', quantity: 0, price: 0, contents: '' });
            setSelectedItemId(payload.itemId);
            fetchStock();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create item.');
        } finally {
            setCreating(false);
        }
    };

    const selectedItem = items.find(it => it.item_id === selectedItemId);

    return (
        <section
            className="neomorph-card enter"
            style={{ flex: 1, minWidth: '320px', maxWidth: '100%', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '3px', height: '22px', background: '#EA7362', borderRadius: '9999px', display: 'block' }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>Stock Inventory</h2>
                </div>
                {!newItemMode && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <StockBtn
                            label="+ Item"
                            colorRgb="255, 214, 182"
                            onClick={() => setNewItemMode('item')}
                            style={{ padding: '6px 12px', fontSize: '10px' }}
                        />
                        <StockBtn
                            label="+ Combo"
                            colorRgb="234, 115, 98"
                            onClick={() => setNewItemMode('combo')}
                            style={{ padding: '6px 12px', fontSize: '10px' }}
                        />
                    </div>
                )}
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: '12px', paddingBottom: '10px' }}>{error}</div>}

            {newItemMode && (
                <form onSubmit={handleCreate} style={{
                    background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(234,115,98,0.2)', marginBottom: '16px'
                }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', color: '#EA7362' }}>
                        Add New {newItemMode === 'combo' ? 'Combo Box' : 'Item'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <input
                            required placeholder="Item ID (e.g. burger-1)" className="input-field"
                            value={newItem.itemId} onChange={e => setNewItem(p => ({ ...p, itemId: e.target.value }))}
                        />
                        <input
                            required placeholder="Display Name" className="input-field"
                            value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                        />
                        <input
                            required type="number" min="0" placeholder="Initial Quantity" className="input-field"
                            value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
                        />
                        <input
                            required type="number" min="0" placeholder="Price (BDT)" className="input-field"
                            value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                        />
                    </div>
                    {newItemMode === 'combo' && (
                        <textarea
                            placeholder="Contents (one per line, e.g. Dates (3 pcs))"
                            className="input-field"
                            style={{ minHeight: '80px', marginBottom: '12px', resize: 'vertical' }}
                            value={newItem.contents} onChange={e => setNewItem(p => ({ ...p, contents: e.target.value }))}
                        />
                    )}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setNewItemMode(false)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', borderColor: 'rgba(255,214,182,0.2)', color: 'rgba(255,214,182,0.6)' }}>Cancel</button>
                        <button type="submit" disabled={creating} className="btn-primary" style={{ padding: '6px 16px', fontSize: '11px' }}>{creating ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            )}

            {/* View/Edit State */}
            {!newItemMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                    {loading && items.length === 0 ? (
                        <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px', fontSize: '12px' }}>Loading inventory...</div>
                    ) : items.length === 0 ? (
                        <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px', fontSize: '12px' }}>Inventory is empty.</div>
                    ) : (
                        <>
                            {/* Dropdown for selecting items */}
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    className="input-field"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        fontFamily: "'DM Sans', system-ui, sans-serif",
                                        appearance: 'none',
                                        cursor: 'pointer',
                                        color: '#FFD6B6',
                                        background: 'linear-gradient(145deg, rgba(70, 25, 25, 0.95) 0%, rgba(90, 30, 30, 0.9) 100%)',
                                        fontWeight: 600
                                    }}
                                >
                                    {items.map(it => (
                                        <option key={it.item_id} value={it.item_id} style={{ background: '#3A1818', color: '#FFD6B6' }}>
                                            {it.name} (QTY: {it.quantity})
                                        </option>
                                    ))}
                                </select>
                                <div style={{
                                    position: 'absolute',
                                    right: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    pointerEvents: 'none',
                                    color: '#EA7362',
                                    fontSize: '10px'
                                }}>▼</div>
                            </div>

                            {/* Selected Item View matching Chaos Controls design */}
                            {selectedItem && (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px',
                                        padding: '16px 14px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(145deg, rgba(140,50,50,0.8) 0%, rgba(100,35,35,0.75) 100%)',
                                        border: '1px solid rgba(234,115,98,0.08)',
                                        boxShadow: '6px 6px 16px rgba(0,0,0,0.45), -3px -3px 10px rgba(183,66,66,0.07), inset 0 1px 0 rgba(255,214,182,0.04)',
                                        transition: 'border-color 0.3s ease',
                                    }}
                                >
                                    {/* Left: Info */}
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{
                                                fontSize: '15px',
                                                fontWeight: 800,
                                                color: '#FFD6B6',
                                                fontFamily: "'DM Sans', system-ui, sans-serif",
                                            }}>
                                                {selectedItem.name}
                                            </span>
                                            <span style={{ fontSize: '10px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,214,182,0.5)' }}>
                                                ID: {selectedItem.item_id}
                                            </span>
                                            {Array.isArray(selectedItem.contents) && selectedItem.contents.length > 0 && (
                                                <span style={{ fontSize: '9px', background: 'rgba(234,115,98,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#EA7362', textTransform: 'uppercase' }}>
                                                    Combo
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#EA7362', fontFamily: 'JetBrains Mono, monospace', marginTop: '6px' }}>
                                            Price: {selectedItem.price > 0 ? `৳${selectedItem.price}` : 'Free'}
                                            <span style={{ marginLeft: '12px', color: selectedItem.quantity <= 0 ? '#ef4444' : '#4ade80' }}>
                                                QTY: {selectedItem.quantity}
                                            </span>
                                        </div>
                                        {Array.isArray(selectedItem.contents) && selectedItem.contents.length > 0 && (
                                            <div style={{ fontSize: '10px', color: 'rgba(255,214,182,0.5)', marginTop: '6px', lineHeight: 1.4 }}>
                                                Contains: {selectedItem.contents.join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Actions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <StockBtn label="Edit Name" colorRgb="255, 214, 182" onClick={() => handleUpdateName(selectedItem.item_id, selectedItem.name)} />
                                            <StockBtn label="Set QTY" colorRgb="234, 115, 98" onClick={() => handleUpdateStock(selectedItem.item_id, selectedItem.quantity)} />
                                        </div>
                                        <StockBtn label="Delete" colorRgb="239, 68, 68" style={{ width: '100%' }} onClick={() => handleDelete(selectedItem.item_id)} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
