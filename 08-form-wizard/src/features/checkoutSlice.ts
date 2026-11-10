
import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export type DeliveryMethod = 'shipping' | 'pickup';

export type StepId =
  | 'contact'
  | 'shipping'
  | 'pickup'
  | 'preferences'
  | 'review';

export type CheckoutDraft = {
  name: string;
  email: string;
  phone: string;
  delivery: DeliveryMethod;
  address: string;
  city: string;
  postalCode: string;
  pickupLocation: string;
  giftWrap: boolean;
  deliveryInstructions: string;
};

export type CheckoutOrder = {
  id: string;
  createdAt: number;
  draft: CheckoutDraft;
};

export type CheckoutState = {
  draft: CheckoutDraft;
  step: StepId;
  visited: StepId[];
  errors: Record<string, string>;
  orders: CheckoutOrder[];
  completed: boolean;
  submitting: boolean;
};

export const CHECKOUT_STORAGE_KEY = 'challenge08-checkout';

export const initialDraft: CheckoutDraft = {
  name: '',
  email: '',
  phone: '',
  delivery: 'shipping',
  address: '',
  city: '',
  postalCode: '',
  pickupLocation: '',
  giftWrap: false,
  deliveryInstructions: '',
};

export const getSteps = (delivery: DeliveryMethod): StepId[] => {
  const steps: StepId[] = ['contact', 'shipping'];

  if (delivery === 'pickup') {
    steps.push('pickup');
  }

  steps.push('preferences', 'review');

  return steps;
};

const defaultState = (): CheckoutState => ({
  draft: { ...initialDraft },
  step: 'contact',
  visited: ['contact'],
  errors: {},
  orders: [],
  completed: false,
  submitting: false,
});

export function loadCheckoutState(): CheckoutState {
  const state = defaultState();

  try {
    if (typeof localStorage === 'undefined') return state;

    const saved = localStorage.getItem(CHECKOUT_STORAGE_KEY);

    if (!saved) return state;

    const parsed = JSON.parse(saved) as Partial<CheckoutState>;

    if (parsed.draft && typeof parsed.draft === 'object') {
      state.draft = {
        ...initialDraft,
        ...parsed.draft,
      };
    }

    if (
      parsed.draft?.delivery !== 'shipping' &&
      parsed.draft?.delivery !== 'pickup'
    ) {
      state.draft.delivery = 'shipping';
    }

    const validSteps = getSteps(state.draft.delivery);

    if (
      parsed.step &&
      validSteps.includes(parsed.step)
    ) {
      state.step = parsed.step;
    }

    if (Array.isArray(parsed.visited)) {
      state.visited = parsed.visited.filter(
        (step): step is StepId =>
          validSteps.includes(step as StepId),
      );

      if (!state.visited.includes('contact')) {
        state.visited.unshift('contact');
      }
    }

    if (Array.isArray(parsed.orders)) {
      state.orders = parsed.orders.filter(
        order =>
          order &&
          typeof order.id === 'string' &&
          typeof order.createdAt === 'number' &&
          order.draft &&
          typeof order.draft === 'object',
      );
    }

    state.completed = Boolean(parsed.completed);
  } catch {
    // Ignore invalid or unavailable local storage data.
  }

  // Never restore an in-progress submission.
  state.submitting = false;
  state.errors = {};

  return state;
}

export function saveCheckoutState(state: CheckoutState) {
  try {
    if (typeof localStorage === 'undefined') return;

    localStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        draft: state.draft,
        step: state.step,
        visited: state.visited,
        orders: state.orders,
        completed: state.completed,
      }),
    );
  } catch {
    // Ignore unavailable storage or quota errors.
  }
}

function validateContact(draft: CheckoutDraft) {
  const errors: Record<string, string> = {};

  if (!draft.name.trim()) {
    errors.name = 'Full name is required.';
  }

  if (!draft.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
}

function validateShipping(draft: CheckoutDraft) {
  const errors: Record<string, string> = {};

  if (draft.delivery === 'shipping') {
    if (!draft.address.trim()) {
      errors.address = 'Street address is required.';
    }

    if (!draft.city.trim()) {
      errors.city = 'City is required.';
    }

    if (!draft.postalCode.trim()) {
      errors.postalCode = 'Postal code is required.';
    }
  }

  return errors;
}

function validatePickup(draft: CheckoutDraft) {
  const errors: Record<string, string> = {};

  if (
    draft.delivery === 'pickup' &&
    !draft.pickupLocation.trim()
  ) {
    errors.pickupLocation = 'Choose a pickup location.';
  }

  return errors;
}

function validatePreferences(draft: CheckoutDraft) {
  const errors: Record<string, string> = {};

  if (draft.deliveryInstructions.length > 200) {
    errors.deliveryInstructions =
      'Instructions must be 200 characters or fewer.';
  }

  return errors;
}

function validateStep(
  draft: CheckoutDraft,
  step: StepId,
): Record<string, string> {
  switch (step) {
    case 'contact':
      return validateContact(draft);

    case 'shipping':
      return validateShipping(draft);

    case 'pickup':
      return validatePickup(draft);

    case 'preferences':
      return validatePreferences(draft);

    case 'review':
      return {
        ...validateContact(draft),
        ...validateShipping(draft),
        ...validatePickup(draft),
        ...validatePreferences(draft),
      };
  }
}

function firstInvalidStep(
  draft: CheckoutDraft,
  steps: StepId[],
): StepId {
  return (
    steps.find(step => Object.keys(validateStep(draft, step)).length > 0) ??
    'review'
  );
}

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: loadCheckoutState(),

  reducers: {
    updateDraft(state, action: PayloadAction<Partial<CheckoutDraft>>) {
      Object.assign(state.draft, action.payload);

      for (const field of Object.keys(action.payload)) {
        delete state.errors[field];
      }

      // If delivery changes from pickup to shipping,
      // remove the now-irrelevant pickup step.
      if (
        action.payload.delivery === 'shipping' &&
        state.step === 'pickup'
      ) {
        state.step = 'preferences';
        state.visited = state.visited.filter(
          step => step !== 'pickup',
        );
        delete state.errors.pickupLocation;
      }

      // Keep the latest order's confirmation editable.
      if (state.completed && state.orders.length > 0) {
        state.orders[0].draft = { ...state.draft };
      }
    },

    nextStep(state) {
      if (state.completed || state.submitting) return;

      const steps = getSteps(state.draft.delivery);
      const errors = validateStep(state.draft, state.step);

      state.errors = {
        ...state.errors,
        ...errors,
      };

      if (Object.keys(errors).length > 0) return;

      const currentIndex = steps.indexOf(state.step);

      if (currentIndex < 0 || currentIndex >= steps.length - 1) {
        return;
      }

      const next = steps[currentIndex + 1];

      state.step = next;

      if (!state.visited.includes(next)) {
        state.visited.push(next);
      }
    },

    previousStep(state) {
      if (state.completed || state.submitting) return;

      const steps = getSteps(state.draft.delivery);
      const currentIndex = steps.indexOf(state.step);

      if (currentIndex > 0) {
        state.step = steps[currentIndex - 1];
      }
    },

    goToStep(state, action: PayloadAction<StepId>) {
      if (state.completed || state.submitting) return;

      const steps = getSteps(state.draft.delivery);
      const targetIndex = steps.indexOf(action.payload);
      const currentIndex = steps.indexOf(state.step);

      // Only allow navigation to the current or a previous step.
      if (
        targetIndex >= 0 &&
        targetIndex <= currentIndex
      ) {
        state.step = action.payload;
      }
    },

    validateCurrentStep(state) {
      state.errors = {
        ...state.errors,
        ...validateStep(state.draft, state.step),
      };
    },

    placeOrder: {
      prepare() {
        return {
          payload: {
            id: nanoid(),
            createdAt: Date.now(),
          },
        };
      },

      reducer(
        state,
        action: PayloadAction<{ id: string; createdAt: number }>,
      ) {
        if (state.completed || state.submitting) return;

        const steps = getSteps(state.draft.delivery);
        const errors = validateStep(state.draft, 'review');

        if (Object.keys(errors).length > 0) {
          state.errors = errors;
          state.step = firstInvalidStep(state.draft, steps);

          if (!state.visited.includes(state.step)) {
            state.visited.push(state.step);
          }

          return;
        }

        state.submitting = true;

        const order: CheckoutOrder = {
          ...action.payload,
          draft: { ...state.draft },
        };

        state.orders.unshift(order);
        state.completed = true;
        state.submitting = false;
        state.errors = {};
      },
    },

    resetCheckout(state) {
      const orders = state.orders;

      Object.assign(state, defaultState(), { orders });
    },

    clearOrderHistory(state) {
      state.orders = [];
    },
  },
});

export const {
  updateDraft,
  nextStep,
  previousStep,
  goToStep,
  validateCurrentStep,
  placeOrder,
  resetCheckout,
  clearOrderHistory,
} = checkoutSlice.actions;

export default checkoutSlice.reducer;

export const selectCheckoutSteps = (state: {
  checkout: CheckoutState;
}) => getSteps(state.checkout.draft.delivery);

export const selectCurrentStep = (state: {
  checkout: CheckoutState;
}) => state.checkout.step;

export const selectCheckoutErrors = (state: {
  checkout: CheckoutState;
}) => state.checkout.errors;

export const selectOrderHistory = (state: {
  checkout: CheckoutState;
}) => state.checkout.orders;

export const selectLatestOrder = (state: {
  checkout: CheckoutState;
}) => state.checkout.orders[0] ?? null;
