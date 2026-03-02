import { useEffect, useState } from 'react';
import api from '../api';

/* Chunk an array into groups of n */
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export default function OrderForm() {
  const [stockMap, setStockMap] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [expanded, setExpanded] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastChangedId, setLastChangedId] = useState(null);

  const fetchStock = () =>
    api.get('/items')
      .then(r => {
        const map = {};
        const items = [];
        r.data.forEach(it => {
          map[it.item_id || it.id] = it.quantity ?? it.stock ?? 0;
          items.push({
            id: it.item_id || it.id,
            name: it.name,
            price: it.price || 0,
            contents: Array.isArray(it.contents) ? it.contents : []
          });
        });
        setStockMap(map);
        // Sort items: combo boxes first, then alphabetically
        setMenuItems(items.sort((a, b) => {
          if (a.contents.length > 0 && b.contents.length === 0) return -1;
          if (a.contents.length === 0 && b.contents.length > 0) return 1;
          return a.name.localeCompare(b.name);
        }));
      })
      .catch(() => { });

  useEffect(() => { fetchStock(); }, []);

  const changeQty = (id, val) => {
    const newVal = Math.max(0, Number(val));
    const isIncrease = newVal > (quantities[id] || 0);
    setQuantities(prev => ({ ...prev, [id]: newVal }));
    if (isIncrease) {
      setLastChangedId(id);
      setTimeout(() => setLastChangedId(null), 600);
    }
  };

  const toggleExpand = id =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const submitOrder = async (e) => {
    e.preventDefault();
    const selected = menuItems.filter(it => quantities[it.id] > 0);
    if (!selected.length) { setStatus('Select at least one item.'); return; }
    const orderItems = selected.map(it => ({ itemId: it.id, itemName: it.name, quantity: quantities[it.id] }));
    setLoading(true);
    setStatus(null);
    try {
      await api.post('/order', { items: orderItems });
      setStatus('Order placed! Check the status tracker.');
      setQuantities({});
      fetchStock();
    } catch (err) {
      setStatus(err.response?.data?.error ?? err.response?.data?.msg ?? 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  const BOX_W = '460px';
  const BOX_H = '460px';

  /* ── Shared styles ── */
  const itemRowBase = (active, outOfStock) => ({
    borderRadius: '12px',
    flexShrink: 0,
    background: active
      ? 'linear-gradient(145deg, rgba(234,115,98,0.18) 0%, rgba(140,50,50,0.85) 100%)'
      : 'linear-gradient(145deg, rgba(140,50,50,0.8) 0%, rgba(100,35,35,0.75) 100%)',
    border: active ? '1px solid rgba(234,115,98,0.4)' : '1px solid rgba(234,115,98,0.08)',
    boxShadow: active
      ? '0 0 12px rgba(234,115,98,0.15), 6px 6px 16px rgba(0,0,0,0.5)'
      : '6px 6px 16px rgba(0,0,0,0.45), -3px -3px 10px rgba(183,66,66,0.07)',
    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
    overflow: 'hidden',
    opacity: outOfStock ? 0.5 : 1,
  });

  const renderQtyStepper = (it, outOfStock) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button type="button" onClick={() => changeQty(it.id, (quantities[it.id] || 0) - 1)}
        className="button-press-effect"
        style={{
          width: '28px', height: '28px', borderRadius: '7px',
          border: '1.5px solid rgba(255,214,182,0.25)',
          background: 'rgba(0,0,0,0.35)',
          color: '#FFD6B6', fontSize: '17px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
      >−</button>
      <span
        key={`${it.id}-${quantities[it.id]}`}
        className={lastChangedId === it.id ? 'count-animate' : ''}
        style={{ minWidth: '26px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#FFD6B6', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {quantities[it.id] || 0}
      </span>
      <button type="button" disabled={outOfStock} onClick={() => changeQty(it.id, (quantities[it.id] || 0) + 1)}
        className="button-press-effect"
        style={{
          width: '28px', height: '28px', borderRadius: '7px',
          border: outOfStock ? '1.5px solid rgba(255,214,182,0.08)' : '1.5px solid rgba(234,115,98,0.75)',
          background: outOfStock ? 'rgba(0,0,0,0.15)' : 'rgba(234,115,98,0.28)',
          color: outOfStock ? '#555' : '#EA7362',
          fontSize: '17px', fontWeight: 700,
          cursor: outOfStock ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: outOfStock ? 'none' : '0 0 8px rgba(234,115,98,0.25)',
          transition: 'all 0.15s ease',
        }}
      >+</button>
    </div>
  );

  const renderStockBadge = (id) => {
    const stock = stockMap[id];
    if (typeof stock !== 'number') return null;
    const out = stock <= 0;
    return (
      <span style={{ fontSize: '10px', color: out ? '#B74242' : '#FFD6B6', fontFamily: 'JetBrains Mono, monospace', opacity: 0.7 }}>
        {out ? '✗ Out of stock' : `${stock} left`}
      </span>
    );
  };

  return (
    <section
      className="neomorph-card enter"
      style={{ width: BOX_W, height: BOX_H, maxWidth: '100%', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexShrink: 0 }}>
        <span style={{ width: '3px', height: '22px', background: '#EA7362', borderRadius: '9999px', display: 'block' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif", textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          Menu
        </h2>
      </div>

      {/* ── Status banner ── */}
      {status && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', flexShrink: 0, borderRadius: '12px', border: `1px solid ${status.includes('placed') ? 'rgba(234,115,98,0.3)' : 'rgba(183,66,66,0.3)'}`, background: status.includes('placed') ? 'rgba(234,115,98,0.08)' : 'rgba(183,66,66,0.08)', color: status.includes('placed') ? '#EA7362' : '#B74242', fontSize: '13px' }}>
          {status}
        </div>
      )}

      <form onSubmit={submitOrder} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px', flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(234,115,98,0.3) transparent' }}>

          {/* ── COMBO BOXES ── */}
          {menuItems.some(it => it.contents.length > 0) && (
            <div style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: '#FFD6B6', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.12em', paddingLeft: '2px' }}>
              Combo Boxes
            </div>
          )}

          {menuItems.filter(it => it.contents.length > 0).map(it => {
            const active = quantities[it.id] > 0;
            const stock = stockMap[it.id];
            const outOfStock = typeof stock === 'number' && stock <= 0;
            const open = !!expanded[it.id];
            const rows = chunk(it.contents, 3);

            return (
              <div
                key={it.id}
                style={itemRowBase(active, outOfStock)}
                className={lastChangedId === it.id ? 'item-added-glow' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif", letterSpacing: '-0.01em' }}>
                      {it.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                      <span style={{ fontSize: '11px', color: '#EA7362', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>৳{it.price}</span>
                      {renderStockBadge(it.id)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {renderQtyStepper(it, outOfStock)}
                    <button type="button" onClick={() => toggleExpand(it.id)} title={open ? 'Hide contents' : 'Show contents'}
                      style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid rgba(234,115,98,0.2)', background: open ? 'rgba(234,115,98,0.14)' : 'rgba(0,0,0,0.2)', color: '#EA7362', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >▾</button>
                  </div>
                </div>

                {open && (
                  <div style={{ borderTop: '1px solid rgba(255,214,182,0.07)', padding: '10px 14px 12px' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: '#FFD6B6', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Includes</div>
                    {rows.map((row, ri) => (
                      <div key={ri} style={{ display: 'flex', gap: '6px', marginBottom: ri < rows.length - 1 ? '6px' : 0 }}>
                        {row.map((item, ci) => (
                          <div key={ci} style={{ flex: 1, padding: '5px 8px', borderRadius: '7px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,214,182,0.05)', fontSize: '10.5px', color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: 1.35 }}>
                            {item}
                          </div>
                        ))}
                        {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => <div key={`pad-${i}`} style={{ flex: 1 }} />)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── INDIVIDUAL ITEMS ── */}
          {menuItems.some(it => it.contents.length === 0) && (
            <div style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: '#FFD6B6', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.12em', paddingLeft: '2px', marginTop: '4px' }}>
              À la carte
            </div>
          )}

          {menuItems.filter(it => it.contents.length === 0).map(it => {
            const active = quantities[it.id] > 0;
            const stock = stockMap[it.id];
            const outOfStock = typeof stock === 'number' && stock <= 0;

            return (
              <div
                key={it.id}
                style={itemRowBase(active, outOfStock)}
                className={lastChangedId === it.id ? 'item-added-glow' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                      {it.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: '#EA7362', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>৳{it.price}</span>
                      {renderStockBadge(it.id)}
                    </div>
                  </div>
                  {renderQtyStepper(it, outOfStock)}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Submit ── */}
        <div style={{ borderTop: '1px solid rgba(255,214,182,0.05)', paddingTop: '16px', flexShrink: 0 }}>
          {(() => {
            const selectedCount = Object.values(quantities).reduce((acc, qty) => acc + (qty || 0), 0);
            const isCartEmpty = selectedCount === 0;

            return (
              <button
                type="submit"
                disabled={loading || isCartEmpty}
                className="btn-primary button-press-effect"
                title={isCartEmpty ? "Add items to confirm" : ""}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '14px',
                  borderRadius: '16px',
                  opacity: isCartEmpty ? 0.35 : 1,
                  cursor: isCartEmpty ? 'not-allowed' : 'pointer',
                  /* Enhanced Neomorph Button */
                  background: isCartEmpty
                    ? 'rgba(70, 25, 25, 0.3)'
                    : 'linear-gradient(145deg, rgba(234, 115, 98, 0.1) 0%, rgba(140, 50, 50, 0.4) 100%)',
                  boxShadow: isCartEmpty
                    ? 'inset 4px 4px 10px rgba(0,0,0,0.4)'
                    : '8px 8px 24px rgba(0, 0, 0, 0.7), -6px -6px 20px rgba(234, 115, 98, 0.05), inset 0 1px 0 rgba(255, 214, 182, 0.08)',
                  border: isCartEmpty
                    ? '1.5px solid rgba(234, 115, 98, 0.1)'
                    : '1.5px solid rgba(234, 115, 98, 0.45)',
                  transform: (loading || isCartEmpty) ? 'none' : undefined,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {loading ? 'Processing Order…' : 'Confirm Order'}
              </button>
            );
          })()}
        </div>
      </form>
    </section>
  );
}
