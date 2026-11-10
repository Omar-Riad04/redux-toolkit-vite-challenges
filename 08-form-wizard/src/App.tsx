
import { useAppDispatch, useAppSelector } from './app/store';

import {
  nextStep,
  previousStep,
  goToStep,
  updateDraft,
  placeOrder,
  resetCheckout,
  selectCheckoutSteps,
  selectLatestOrder,
  type StepId,
} from './features/checkoutSlice';

import './style.css';

const stepLabels: Record<StepId, string> = {
  contact: 'Contact',
  shipping: 'Shipping',
  pickup: 'Pickup location',
  preferences: 'Preferences',
  review: 'Review',
};

export default function App() {
  const dispatch = useAppDispatch();

  const {
    draft,
    step,
    visited,
    errors,
    orders,
    completed,
    submitting,
  } = useAppSelector(state => state.checkout);

  const steps = useAppSelector(selectCheckoutSteps);
  const latestOrder = useAppSelector(selectLatestOrder);

  const update = (field: keyof typeof draft, value: string | boolean) => {
    dispatch(updateDraft({ [field]: value }));
  };

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '10px',
    marginTop: '6px',
    marginBottom: '12px',
    boxSizing: 'border-box' as const,
  };

  const fieldError = (field: string) =>
    errors[field] ? (
      <p style={{ color: '#dc2626', marginTop: '-8px' }}>
        {errors[field]}
      </p>
    ) : null;

  const textField = (
    label: string,
    field: keyof typeof draft,
    type = 'text',
  ) => (
    <label style={{ display: 'block', marginTop: '12px' }}>
      {label}
      <input
        type={type}
        value={String(draft[field])}
        onChange={event => update(field, event.target.value)}
        style={inputStyle}
        disabled={completed}
      />
      {fieldError(field)}
    </label>
  );

  const renderContact = () => (
    <>
      <h2>Contact information</h2>
      {textField('Full name', 'name')}
      {textField('Email address', 'email', 'email')}
      {textField('Phone number (optional)', 'phone', 'tel')}
    </>
  );

  const renderShipping = () => (
    <>
      <h2>Shipping method</h2>

      <label>
        Delivery method
        <select
          value={draft.delivery}
          onChange={event =>
            update(
              'delivery',
              event.target.value as 'shipping' | 'pickup',
            )
          }
          style={inputStyle}
          disabled={completed}
        >
          <option value="shipping">Home delivery</option>
          <option value="pickup">Store pickup</option>
        </select>
      </label>

      {draft.delivery === 'shipping' && (
        <>
          <h3>Shipping address</h3>
          {textField('Street address', 'address')}
          {textField('City', 'city')}
          {textField('Postal code', 'postalCode')}
        </>
      )}

      {draft.delivery === 'pickup' && (
        <p>
          You will choose your pickup location in the next step.
        </p>
      )}
    </>
  );

  const renderPickup = () => (
    <>
      <h2>Choose a pickup location</h2>

      <label>
        Pickup location
        <select
          value={draft.pickupLocation}
          onChange={event =>
            update('pickupLocation', event.target.value)
          }
          style={inputStyle}
          disabled={completed}
        >
          <option value="">Select a location</option>
          <option value="Cairo Downtown">Cairo Downtown</option>
          <option value="Nasr City">Nasr City</option>
          <option value="New Cairo">New Cairo</option>
          <option value="Giza">Giza</option>
        </select>
      </label>

      {fieldError('pickupLocation')}
    </>
  );

  const renderPreferences = () => (
    <>
      <h2>Preferences</h2>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '16px 0',
        }}
      >
        <input
          type="checkbox"
          checked={draft.giftWrap}
          onChange={event =>
            update('giftWrap', event.target.checked)
          }
          disabled={completed}
        />
        Add gift wrapping
      </label>

      <label>
        Delivery instructions (optional)
        <textarea
          value={draft.deliveryInstructions}
          onChange={event =>
            update('deliveryInstructions', event.target.value)
          }
          maxLength={300}
          rows={4}
          style={inputStyle}
          disabled={completed}
        />
      </label>

      <p>
        {draft.deliveryInstructions.length}/200 characters recommended
      </p>
      {fieldError('deliveryInstructions')}
    </>
  );

  const renderReview = () => (
    <>
      <h2>{completed ? 'Order confirmation' : 'Review your order'}</h2>

      <p>
        {completed
          ? 'Your mock order has been placed. You can still edit the confirmation details below.'
          : 'Check your details before placing your order. You can edit any field here.'}
      </p>

      <h3>Contact details</h3>
      {textField('Full name', 'name')}
      {textField('Email address', 'email', 'email')}
      {textField('Phone number', 'phone', 'tel')}

      <h3>Delivery details</h3>

      <label>
        Delivery method
        <select
          value={draft.delivery}
          onChange={event =>
            update(
              'delivery',
              event.target.value as 'shipping' | 'pickup',
            )
          }
          style={inputStyle}
          disabled={completed}
        >
          <option value="shipping">Home delivery</option>
          <option value="pickup">Store pickup</option>
        </select>
      </label>

      {draft.delivery === 'shipping' ? (
        <>
          {textField('Street address', 'address')}
          {textField('City', 'city')}
          {textField('Postal code', 'postalCode')}
        </>
      ) : (
        <>
          <label>
            Pickup location
            <select
              value={draft.pickupLocation}
              onChange={event =>
                update('pickupLocation', event.target.value)
              }
              style={inputStyle}
              disabled={completed}
            >
              <option value="">Select a location</option>
              <option value="Cairo Downtown">Cairo Downtown</option>
              <option value="Nasr City">Nasr City</option>
              <option value="New Cairo">New Cairo</option>
              <option value="Giza">Giza</option>
            </select>
          </label>
          {fieldError('pickupLocation')}
        </>
      )}

      <h3>Preferences</h3>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '16px 0',
        }}
      >
        <input
          type="checkbox"
          checked={draft.giftWrap}
          onChange={event =>
            update('giftWrap', event.target.checked)
          }
          disabled={completed}
        />
        Gift wrapping
      </label>

      <label>
        Delivery instructions
        <textarea
          value={draft.deliveryInstructions}
          onChange={event =>
            update('deliveryInstructions', event.target.value)
          }
          rows={3}
          style={inputStyle}
          disabled={completed}
        />
      </label>
      {fieldError('deliveryInstructions')}

      {fieldError('name')}
      {fieldError('email')}
      {fieldError('address')}
      {fieldError('city')}
      {fieldError('postalCode')}

      {completed && latestOrder && (
        <p>
          Order reference: <strong>{latestOrder.id}</strong>
        </p>
      )}
    </>
  );

  const renderStep = () => {
    switch (step) {
      case 'contact':
        return renderContact();
      case 'shipping':
        return renderShipping();
      case 'pickup':
        return renderPickup();
      case 'preferences':
        return renderPreferences();
      case 'review':
        return renderReview();
    }
  };

  return (
    <main className="container">
      <p className="eyebrow">
        Redux Toolkit · Challenge 08 · Medium–Hard
      </p>

      <h1>Multi-Step Checkout Wizard</h1>

      <p className="subtitle">
        Draft persistence, validation, cross-step state
      </p>

      {completed ? (
        <section className="panel">
          <h2>Order placed successfully!</h2>
          <p>
            This is a local mock order. No payment or external request
            was made.
          </p>
          <p>
            Your confirmation details remain editable below.
          </p>
        </section>
      ) : (
        <section className="panel">
          <h2>Checkout progress</h2>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            {steps.map((stepId, index) => (
              <button
                type="button"
                key={stepId}
                onClick={() => dispatch(goToStep(stepId))}
                disabled={
                  !visited.includes(stepId) ||
                  index > steps.indexOf(step)
                }
                style={{
                  opacity: step === stepId ? 1 : 0.65,
                  fontWeight: step === stepId ? 'bold' : 'normal',
                }}
              >
                {index + 1}. {stepLabels[stepId]}
              </button>
            ))}
          </div>

          <p>
            Step {steps.indexOf(step) + 1} of {steps.length}: {stepLabels[step]}
          </p>
        </section>
      )}

      <section className="panel">
        {renderStep()}

        {!completed && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '20px',
            }}
          >
            <button
              type="button"
              onClick={() => dispatch(previousStep())}
              disabled={steps.indexOf(step) === 0 || submitting}
            >
              Back
            </button>

            {step !== 'review' ? (
              <button
                type="button"
                onClick={() => dispatch(nextStep())}
                disabled={submitting}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dispatch(placeOrder())}
                disabled={submitting}
              >
                {submitting ? 'Placing order...' : 'Place order'}
              </button>
            )}

            <button
              type="button"
              onClick={() => dispatch(resetCheckout())}
            >
              Reset checkout
            </button>
          </div>
        )}

        {completed && (
          <button
            type="button"
            onClick={() => dispatch(resetCheckout())}
          >
            Start a new checkout
          </button>
        )}
      </section>

      <section className="panel">
        <h2>Local order history</h2>

        {orders.length === 0 ? (
          <p>No orders have been placed yet.</p>
        ) : (
          orders.map(order => (
            <article
              key={order.id}
              style={{
                padding: '12px',
                border: '1px solid currentColor',
                borderRadius: '8px',
                marginBottom: '10px',
              }}
            >
              <strong>Order {order.id}</strong>
              <p>{order.draft.name}</p>
              <p>{order.draft.email}</p>
              <p>
                {order.draft.delivery === 'pickup'
                  ? `Pickup: ${order.draft.pickupLocation}`
                  : `Shipping: ${order.draft.address}, ${order.draft.city}`}
              </p>
              <small>
                {new Date(order.createdAt).toLocaleString()}
              </small>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
