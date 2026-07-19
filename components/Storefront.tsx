"use client";

/**
 * OnlyCrabs — a demo storefront that pays with the Click hooks.
 *
 * The vanilla OnlyCrabs page, rebuilt in React so its "Pay with crypto in one
 * Click" buttons call our checkout directly (no browser extension, no merchant
 * SDK bridge). "Account" opens the Click dashboard; a buy either opens login
 * (signed out) or charges silently and shows only a status card (signed in).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./StoreProvider";
import { formatUsd } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  tag?: string;
  desc: string;
  crab: React.ReactNode;
}

/* ---- Crab illustrations (ported 1:1 from the vanilla storefront) ---- */

const CrabLegs = () => (
  <>
    <g className="crab-stroke">
      <path d="M70 122 q-28 2 -44 -6" />
      <path d="M72 132 q-26 10 -42 10" />
      <path d="M76 140 q-22 16 -32 28" />
      <path d="M150 122 q28 2 44 -6" />
      <path d="M148 132 q26 10 42 10" />
      <path d="M144 140 q22 16 32 28" />
      <path d="M74 106 q-30 -2 -44 -24" />
      <path d="M146 106 q30 -2 44 -24" />
    </g>
    <ellipse className="crab-fill" cx="22" cy="66" rx="20" ry="10" transform="rotate(-28 22 66)" />
    <ellipse className="crab-fill" cx="26" cy="86" rx="20" ry="10" transform="rotate(24 26 86)" />
    <ellipse className="crab-fill" cx="198" cy="66" rx="20" ry="10" transform="rotate(28 198 66)" />
    <ellipse className="crab-fill" cx="194" cy="86" rx="20" ry="10" transform="rotate(-24 194 86)" />
  </>
);

const LarryCrab = () => (
  <svg className="crab crab--line" viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Larry the Larval crab">
    <CrabLegs />
    <path className="crab-stroke" d="M96 70 L92 44" />
    <path className="crab-stroke" d="M124 70 L128 44" />
    <ellipse className="crab-fill" cx="110" cy="104" rx="62" ry="42" />
    <circle className="crab-eye" cx="92" cy="42" r="11" />
    <circle className="crab-eye" cx="128" cy="42" r="11" />
    <circle className="crab-pupil" cx="92" cy="42" r="5" />
    <circle className="crab-pupil" cx="128" cy="42" r="5" />
    <path className="crab-line-thin" d="M96 112 q14 12 28 0" />
    <path className="crab-line-thin" d="M150 30 l4 -8 M158 34 l8 -5 M162 44 l9 -1" />
  </svg>
);

const PinchCrab = () => (
  <svg className="crab crab--line" viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sir Pinch-a-Lot crab">
    <CrabLegs />
    <path className="crab-stroke" d="M96 70 L92 44" />
    <path className="crab-stroke" d="M124 70 L128 44" />
    <ellipse className="crab-fill" cx="110" cy="104" rx="62" ry="42" />
    <circle className="crab-eye" cx="92" cy="42" r="11" />
    <circle className="crab-eye" cx="128" cy="42" r="11" />
    <circle className="crab-pupil" cx="92" cy="42" r="5" />
    <circle className="crab-pupil" cx="128" cy="42" r="5" />
    <path className="crab-line-thin" d="M100 114 q10 7 18 -2" />
    <circle className="acc-stroke" cx="128" cy="42" r="16" />
    <path className="acc-stroke" d="M138 54 q4 14 -4 24" />
    <path className="acc-fill" d="M84 30 h36 v3 h10 v6 h-56 v-6 h10 z" />
    <rect className="acc-fill" x="90" y="8" width="24" height="24" />
    <rect className="acc-band" x="90" y="24" width="24" height="5" />
  </svg>
);

const NoirCrab = () => (
  <svg className="crab crab--solid" viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Crabbe Noir crab">
    <CrabLegs />
    <path className="crab-stroke" d="M96 70 L92 44" />
    <path className="crab-stroke" d="M124 70 L128 44" />
    <ellipse className="crab-fill" cx="110" cy="104" rx="62" ry="42" />
    <rect className="glass" x="76" y="34" width="30" height="18" rx="5" />
    <rect className="glass" x="114" y="34" width="30" height="18" rx="5" />
    <path className="glare" d="M106 43 h8" />
    <path className="glare" d="M82 39 l6 0 M120 39 l6 0" />
  </svg>
);

const PRODUCTS: Product[] = [
  {
    id: "larry",
    name: "Larry the Larval",
    price: 0.1,
    tag: "FRESH",
    desc: "A humble hatchling with big dreams and even bigger claws. Ethically doodled, zero bycatch.",
    crab: <LarryCrab />,
  },
  {
    id: "pinch",
    name: "Sir Pinch-a-Lot",
    price: 0.12,
    desc: "Old-money crustacean. Owns a monocle, several tide pools, and precisely zero chill.",
    crab: <PinchCrab />,
  },
  {
    id: "noir",
    name: "Crabbé Noir",
    price: 0.15,
    tag: "TOP",
    desc: "Too cool for the reef. Snips first, apologizes never. Ships exclusively in noir.",
    crab: <NoirCrab />,
  },
];

const CART_LABEL = "Cart";

export function Storefront() {
  const store = useStore();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const p = PRODUCTS.find((x) => x.id === id)!;
          return { ...p, qty };
        }),
    [cart]
  );
  const count = items.reduce((n, i) => n + i.qty, 0);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  // Transient "added to cart" toast (keyed so the animation replays each time).
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast({ id: Date.now(), msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const add = (id: string) => {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
    const p = PRODUCTS.find((x) => x.id === id);
    if (p) showToast(`${p.name} added to cart`);
  };
  const inc = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const dec = (id: string) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) }));

  const payCart = () => {
    if (count === 0) return;
    store.pay(total, `${CART_LABEL} · ${count} item${count > 1 ? "s" : ""}`);
  };

  // Empty the cart once a cart payment settles.
  useEffect(() => {
    if (store.status?.kind === "success" && store.status.label.startsWith(CART_LABEL)) {
      setCart({});
      setDrawerOpen(false);
    }
  }, [store.status]);

  const heroPay = () => {
    if (count > 0) payCart();
    else document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  };

  const busy = store.charging;

  return (
    <div className="oc-root">
        {/* HEADER */}
        <header className="site-header">
          <div className="container header-inner">
            <a href="#" className="logo">OnlyCrabs</a>
            <nav className="nav">
              <a href="#products">Crabs</a>
              <a href="#contacts">Contacts</a>
            </nav>
            <div className="header-actions">
              <button className="account-btn" onClick={store.openAccount}>
                {store.auth === "in" && <span className="account-dot" />}
                Account
              </button>
              <button className="cart-btn" onClick={() => setDrawerOpen(true)}>
                Cart <span key={count} className="cart-count">{count}</span>
              </button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="container">
            <p className="hero-eyebrow">HAND-DRAWN · FRESHLY PINCHED · 100% CRAB</p>
            <h1 className="hero-title">Three crabs.<br />Infinite claws.</h1>
            <p className="hero-sub">
              Artisanal crustaceans, doodled one claw at a time. Built on OpenClaw
              and loosely supervised by a very responsible Claude. Adopt a crab —
              or check out in a single pinch.
            </p>
            <div className="hero-actions">
              <a href="#products" className="btn btn-outline">Browse the tank</a>
              <button className="btn btn-pay" onClick={heroPay} disabled={busy}>
                Pay with crypto in one Click
              </button>
            </div>
          </div>
        </section>

        {/* PRODUCTS */}
        <section className="section" id="products">
          <div className="container">
            <div className="section-head">
              <h2 className="section-title">The Tank</h2>
              <span className="section-index">01 / 03</span>
            </div>

            <div className="grid">
              {PRODUCTS.map((p) => (
                <article className="card" key={p.id}>
                  <div className="card-media">
                    {p.tag && <span className="card-tag">{p.tag}</span>}
                    {p.crab}
                  </div>
                  <div className="card-body">
                    <h3 className="card-title">{p.name}</h3>
                    <p className="card-desc">{p.desc}</p>
                    <div className="card-foot">
                      <span className="price">{formatUsd(p.price)}</span>
                      <div className="card-actions">
                        <button className="btn btn-dark" onClick={() => add(p.id)}>
                          Add to cart
                        </button>
                        <button
                          className="btn btn-pay btn-pay-sm"
                          onClick={() => store.pay(p.price, p.name)}
                          disabled={busy}
                        >
                          Pay with crypto in one Click
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="site-footer" id="contacts">
          <div className="container footer-inner">
            <div>
              <div className="logo">OnlyCrabs</div>
              <p className="footer-note">
                A demo storefront for testing payments. No real crabs were harmed —
                every last one is a drawing.
              </p>
            </div>
            <div className="footer-cols">
              <a href="#products">Crabs</a>
              <a href="#">Terms</a>
              <a href="#">Privacy</a>
            </div>
          </div>
          <div className="container footer-bottom">© 2026 OnlyCrabs. All claws reserved.</div>
        </footer>

        {/* CART DRAWER */}
        <div
          className={`drawer-overlay${drawerOpen ? " open" : ""}`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside className={`drawer${drawerOpen ? " open" : ""}`} aria-hidden={!drawerOpen}>
          <div className="drawer-head">
            <h3>Cart</h3>
            <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
          </div>
          <div className="drawer-items">
            {items.length === 0 ? (
              <p className="drawer-empty">Your tank is empty.</p>
            ) : (
              items.map((i) => (
                <div className="cart-item" key={i.id}>
                  <div className="cart-item-info">
                    <span className="cart-item-name">{i.name}</span>
                    <span className="cart-item-price">{formatUsd(i.price)} each</span>
                  </div>
                  <div className="cart-item-qty">
                    <button className="qty-btn" onClick={() => dec(i.id)}>−</button>
                    <span>{i.qty}</span>
                    <button className="qty-btn" onClick={() => inc(i.id)}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="drawer-foot">
            <div className="drawer-total">
              <span>Total</span>
              <span>{formatUsd(total)}</span>
            </div>
            <button
              className="btn btn-pay btn-block"
              onClick={payCart}
              disabled={busy || count === 0}
            >
              Pay with crypto in one Click
            </button>
          </div>
        </aside>

        {/* ADD-TO-CART TOAST */}
        {toast && (
          <div key={toast.id} className="oc-toast" role="status">
            <span className="oc-toast-crab" aria-hidden>
              🦀
            </span>
            {toast.msg}
          </div>
        )}
    </div>
  );
}
