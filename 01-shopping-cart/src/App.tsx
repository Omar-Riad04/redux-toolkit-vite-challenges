import React from 'react';
import { useAppDispatch, useAppSelector } from './app/store';
import {
  addItem, removeItem, updateQuantity, undoRemoval, applyCoupon,
  setCouponInput, setShippingMethod, clearCart,
  toggleGiftWrap, toggleSelected, toggleSelectAll, setGiftWrapForSelected,
  selectItemCount, selectSubtotal, selectDiscount, selectShippingCost,
  selectGiftWrapTotal, selectTotal,
  NewCartItem,
} from './features/cartSlice';
import './style.css';

const PRODUCTS: { label: string; item: NewCartItem }[] = [
  { label: 'Add Blue Shirt (M)', item: { productId: 'shirt', name: 'Shirt', size: 'M', color: 'Blue', unitPrice: 25, stock: 8 } },
  { label: 'Add Red Shirt (L)', item: { productId: 'shirt', name: 'Shirt', size: 'L', color: 'Red', unitPrice: 30, stock: 5 } },
];

export default function App() {
  const dispatch = useAppDispatch();
  const { items, coupon, couponInput, couponError, shippingMethod, lastRemovedItem, selected } =
    useAppSelector(s => s.cart);

  const itemCount = useAppSelector(selectItemCount);
  const subtotal = useAppSelector(selectSubtotal);
  const discount = useAppSelector(selectDiscount);
  const shippingCost = useAppSelector(selectShippingCost);
  const giftWrapTotal = useAppSelector(selectGiftWrapTotal);
  const total = useAppSelector(selectTotal);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(applyCoupon(couponInput));
  };

  return (
    <main className="container">
      <p className="eyebrow">Redux Toolkit · Challenge 01</p>
      <h1>Advanced Shopping Cart</h1>

      {lastRemovedItem && (
        <div role="status" style={{ background: '#fff3cd', color: '#000', padding: '10px 15px', borderRadius: 6, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Removed <strong>{lastRemovedItem.name} ({lastRemovedItem.size}/{lastRemovedItem.color})</strong>.</span>
          <button onClick={() => dispatch(undoRemoval())} style={{ background: '#ffc107', color: '#000', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
            Undo
          </button>
        </div>
      )}

      <section className="panel">
        <h2>Your Shopping Cart</h2>
        <p>Total Items: {itemCount}</p>



        {items.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          items.map(item => (
            <div key={item.key} style={{ borderBottom: '1px solid #344056', paddingBottom: 12, marginBottom: 12 }}>
              <h3>{item.name} — {item.size} / {item.color}</h3>
              <label style={{ marginRight: 12 }}>
              </label>
              <label>
                <input type="checkbox" checked={item.giftWrap} onChange={() => dispatch(toggleGiftWrap(item.key))} /> Gift wrap (+$3)
              </label>
              <p>Price: ${item.unitPrice.toFixed(2)} | Stock: {item.stock}</p>
              <p>
                Quantity: {item.quantity}
                {item.quantity >= item.stock && <em style={{ marginLeft: 8, color: '#ffc107' }}>(max stock reached)</em>}
              </p>

              <button
                aria-label={`Increase ${item.name}`}
                disabled={item.quantity >= item.stock}
                onClick={() => dispatch(updateQuantity({ key: item.key, quantity: item.quantity + 1 }))}
              >
                +
              </button>
              <button
                aria-label={`Decrease ${item.name}`}
                style={{ marginLeft: 5 }}
                onClick={() => dispatch(updateQuantity({ key: item.key, quantity: item.quantity - 1 }))}
              >
                -
              </button>
              <button
                onClick={() => dispatch(removeItem(item.key))}
                style={{ marginLeft: 10, background: '#ff4d4d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          ))
        )}

        <div style={{ margin: '20px 0' }}>
          <strong>Shipping: </strong>
          <label style={{ marginLeft: 10, cursor: 'pointer' }}>
            <input type="radio" name="shipping" checked={shippingMethod === 'standard'} onChange={() => dispatch(setShippingMethod('standard'))} /> Standard ($5)
          </label>
          <label style={{ marginLeft: 15, cursor: 'pointer' }}>
            <input type="radio" name="shipping" checked={shippingMethod === 'express'} onChange={() => dispatch(setShippingMethod('express'))} /> Express ($15)
          </label>
        </div>

        <form onSubmit={handleApplyCoupon} style={{ margin: '20px 0' }}>
          <input
            type="text"
            placeholder="SAVE10 or FLAT20"
            value={couponInput}
            onChange={e => dispatch(setCouponInput(e.target.value))}
            aria-invalid={!!couponError}
            style={{ padding: 8, marginRight: 8, background: '#2d3950', border: `1px solid ${couponError ? '#ff4d4d' : '#344056'}`, color: '#e9eefa', borderRadius: 6 }}
          />
          <button type="submit">Apply Coupon</button>
          {coupon && <span style={{ marginLeft: 10, color: '#91b3ff', fontWeight: 'bold' }}>Active: {coupon}</span>}
          {coupon && (
            <button type="button" onClick={() => dispatch(applyCoupon(null))} style={{ marginLeft: 10, fontSize: 12, background: '#344056', color: '#e9eefa' }}>
              Remove
            </button>
          )}
          {couponError && <p role="alert" style={{ color: '#ff4d4d', margin: '8px 0 0' }}>{couponError}</p>}
        </form>

        <div style={{ background: '#000b17', padding: 20, borderRadius: 12, marginTop: 20, border: '1px solid #344056' }}>
          <h3 style={{ marginTop: 0 }}>Order Summary</h3>
          <p>Subtotal: ${subtotal.toFixed(2)}</p>
          <p>Discount: -${discount.toFixed(2)}</p>
          <p>Shipping: ${shippingCost.toFixed(2)}</p>
          <p>Gift wrap: ${giftWrapTotal.toFixed(2)}</p>
          <hr style={{ borderColor: '#344056' }} />
          <h2>Total: ${total.toFixed(2)}</h2>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PRODUCTS.map(p => (
            <button key={p.label} onClick={() => dispatch(addItem(p.item))}>{p.label}</button>
          ))}
          <button onClick={() => dispatch(clearCart())} style={{ background: '#dc3545', color: '#fff' }}>
            Clear Cart
          </button>
        </div>
      </section>
    </main>
  );
}