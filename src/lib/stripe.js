// src/lib/stripe.js
import { loadStripe } from "@stripe/stripe-js";
import { api } from "./api.js";
import { ssrModuleExportsKey } from "vite/module-runner";

let stripe;
let elements;
let paymentElement;
let currentIntentId; // for your telemetry if you want

function openModal() {
  const m = document.getElementById("stripe-modal");
  m.hidden = false;
}
function closeModal() {
  const m = document.getElementById("stripe-modal");
  m.hidden = true;
  const container = document.getElementById("payment-element");
  if (container) container.innerHTML = ""; // unmount
  elements = paymentElement = null;
}

export function wireModalClose() {
  document.querySelectorAll("#stripe-modal [data-close]").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });
}

export async function startCheckout({ packType: inPackType, packCredits }) {
  // Ask backend to create a PaymentIntent bound to this pack (avoid trusting client price).
  const { intent } = await api("/api/credits/create-payment-intent", {
    method: "POST",
    body: { packType: inPackType },
  });

  const {
    id,
    stripeIntentId,
    clientSecret,
    packType: outPackType,
    status,
    createdAt,
    updatedAt,
  } = intent;
  currentIntentId = stripeIntentId;

  // Lazy init Stripe
  if (!stripe) {
    stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  }

  // Build Payment Element
  elements = stripe.elements({ clientSecret });
  paymentElement = elements.create("payment", { layout: "tabs" });
  paymentElement.mount("#payment-element");

  openModal();

  // Handle form submit
  const form = document.getElementById("payment-form");
  const submitBtn = document.getElementById("submit-payment");
  const messages = document.getElementById("payment-messages");

  async function onSubmit(e) {
    e.preventDefault();
    submitBtn.disabled = true;
    messages.textContent = "Processing...";

    const { error, paymentIntent: stripePaymentIntent } =
      await stripe.confirmPayment({
        elements,
        redirect: "if_required", // keep users on the page (3DS may still overlay)
        // (optional) billing details:
        // confirmParams: { payment_method_data: { billing_details: { email: ... } } }
      });

    submitBtn.disabled = false;

    if (error) {
      messages.textContent = error.message || "Payment failed.";
      return;
    } else {
      messages.textContent = "Payment captured. Updating credits...";
    }

    try {
      // Ask backend to finalize (or no-op if webhook already did).
      await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
      const res = await api("/api/credits/finalize", {
        method: "POST",
        body: {
          id: id,
          sid: stripePaymentIntent?.id || currentIntentId,
        },
      });
      console.log(JSON.stringify({ res: res }));
      closeModal();
      location.reload(); // refresh balance UI
    } catch (e2) {
      const errMessage = "Error while calling finalize: ";
      messages.textContent = errMessage + e2.message;
    }
  }

  form.addEventListener("submit", onSubmit, { once: true });
}
