"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

export interface CatalogCategory {
  id: string;
  name: string;
  color: string;
}

export interface CatalogProduct {
  code: string;
  name: string;
  price: number | null;
  size: string | null;
  color: string | null;
  description: string | null;
  images: string[];
  categoryId: string;
  variants: { id: string; name: string; price: number }[];
}

export interface ShopLinks {
  name: string;
  phone: string | null;
  zalo: string | null;
  facebook: string | null;
  messenger: string | null;
  tiktok: string | null;
}

const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
const productPrice = (p: CatalogProduct, variant?: CatalogProduct["variants"][number] | null) => variant?.price ?? p.variants[0]?.price ?? p.price;
const priceText = (p: CatalogProduct, variant?: CatalogProduct["variants"][number] | null) => {
  const price = productPrice(p, variant);
  return price === null ? "Liên hệ báo giá" : money(price);
};
const slugOf = (p: CatalogProduct) => p.code.toLowerCase();
const orderMessage = (p: CatalogProduct, variant?: CatalogProduct["variants"][number] | null) => {
  const price = productPrice(p, variant);
  return `Mình muốn đặt mẫu ${p.code} · ${p.name}${variant ? ` · ${variant.name}` : ""}${price === null ? "" : ` (${money(price)})`}`;
};

const motionOK = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The photo can fly from the card into the sheet only where View Transitions exist. */
const canFly = () => motionOK() && typeof document.startViewTransition === "function";
const vtName = (el: HTMLElement, name: string) => (name ? el.style.setProperty("view-transition-name", name) : el.style.removeProperty("view-transition-name"));
const sheetEl = () => document.querySelector<HTMLDialogElement>("dialog.sheet");

/** Card photo: shimmers while loading and fades in from a blur. Photos already loaded show at once. */
function CardPhoto({ src }: { src?: string }) {
  const done = (e: React.SyntheticEvent<HTMLImageElement>) => delete e.currentTarget.parentElement?.dataset.state;
  return (
    <span className="card-photo">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          ref={(img) => {
            if (img && !(img.complete && img.naturalWidth) && motionOK() && img.parentElement) img.parentElement.dataset.state = "loading";
          }}
          onLoad={done}
          onError={done}
        />
      ) : null}
    </span>
  );
}

const CONTACT_LOGOS = {
  phone: "/contact-icons/phone.png",
  zalo: "/contact-icons/zalo-transparent.png",
  facebook: "/contact-icons/facebook.png",
  tiktok: "/contact-icons/tiktok.png",
  order: "/contact-icons/order-chat.png",
} as const;
type ContactLogoKind = keyof typeof CONTACT_LOGOS;

const ContactLogo = ({ kind }: { kind: ContactLogoKind }) => (
  <span className={`contact-logo-frame contact-logo-frame--${kind}`} aria-hidden="true">
    <Image className={`contact-logo contact-logo--${kind}`} src={CONTACT_LOGOS[kind]} alt="" width={32} height={32} loading="eager" />
  </span>
);

type LinkKind = "phone" | "zalo" | "facebook" | "messenger" | "tiktok";
const missingLabel: Record<LinkKind, string> = { phone: "số điện thoại", zalo: "Zalo", facebook: "Facebook", messenger: "Facebook", tiktok: "TikTok" };
const linkFor = (shop: ShopLinks, kind: LinkKind) => (kind === "phone" ? (shop.phone ? `tel:${shop.phone}` : null) : shop[kind]);

interface ContactProps {
  shop: ShopLinks;
  kind: "phone" | "zalo" | "facebook" | "tiktok";
  label: string;
  main?: boolean;
  onMissing: (msg: string) => void;
}

/** Link to a contact channel; a channel the owner has not set yet shows a toast instead. */
function Contact({ shop, kind, label, main, onMissing }: ContactProps) {
  const href = linkFor(shop, kind);
  const cls = main ? "contact-btn is-main" : "contact-btn";
  if (!href)
    return (
      <button className={cls} type="button" onClick={() => onMissing(`Shop chưa cập nhật ${missingLabel[kind]}`)}>
        <ContactLogo kind={kind} />
        {label}
      </button>
    );
  return (
    <a className={cls} href={href} {...(kind === "phone" ? {} : { target: "_blank", rel: "noopener" })}>
      <ContactLogo kind={kind} />
      {label}
    </a>
  );
}

export function CatalogApp({ categories, products, shop }: { categories: CatalogCategory[]; products: CatalogProduct[]; shop: ShopLinks }) {
  const [active, setActive] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<CatalogProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const bySlug = useCallback((slug: string) => products.find((p) => slugOf(p) === slug) ?? null, [products]);

  const toast = (msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
  };

  const term = q.trim().toLowerCase();
  const list = products.filter((p) => (active === "all" || p.categoryId === active) && (!term || p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)));

  // Each product has its own link (#bo-012): the phone's Back button closes the sheet.
  useEffect(() => {
    const sync = () => {
      let slug = "";
      try {
        slug = decodeURIComponent(location.hash.slice(1));
      } catch {
        // malformed hash: show the list
      }
      const p = bySlug(slug);
      setOpen(p);
      setSelectedVariantId(p?.variants[0]?.id ?? null);
      setPicking(false);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [bySlug]);

  // ----- Motion: sliding tab pill, sticky-bar shadow, contact bar that steps aside while scrolling down -----
  const tabsRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const tabsWrapRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const inkPlaced = useRef(false);
  const sourcePhoto = useRef<HTMLElement | null>(null);

  const placeInk = useCallback((animate: boolean) => {
    const tabs = tabsRef.current;
    const ink = inkRef.current;
    const t = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!tabs || !ink || !t) return;
    ink.style.transition = animate && motionOK() ? "" : "none";
    ink.style.setProperty("--x", t.offsetLeft + "px");
    ink.style.setProperty("--y", t.offsetTop + "px");
    ink.style.setProperty("--w", t.offsetWidth + "px");
    ink.style.setProperty("--h", t.offsetHeight + "px");
    ink.style.setProperty("--ink-c", t.style.getPropertyValue("--c"));
    tabs.classList.add("has-ink");
  }, []);

  useLayoutEffect(() => {
    placeInk(inkPlaced.current);
    if (inkPlaced.current) {
      tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: motionOK() ? "smooth" : "auto" });
    }
    inkPlaced.current = true;
  }, [active, placeInk]);

  useEffect(() => {
    const again = () => placeInk(false);
    window.addEventListener("resize", again);
    document.fonts?.ready.then(again);
    return () => window.removeEventListener("resize", again);
  }, [placeInk]);

  useEffect(() => {
    const intro = introRef.current;
    const wrap = tabsWrapRef.current;
    if (!intro || !wrap) return;
    const io = new IntersectionObserver(([e]) => wrap.classList.toggle("stuck", !e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(intro);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 40;
        if (Math.abs(dy) > 6 || atEnd) {
          bar.classList.toggle("away", dy > 0 && y > 240 && !atEnd && motionOK());
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openProduct = (p: CatalogProduct, photo?: HTMLElement | null) => {
    const go = () => {
      history.pushState({ sheet: slugOf(p) }, "", "#" + slugOf(p));
      setPicking(false);
      setSelectedVariantId(p.variants[0]?.id ?? null);
      setOpen(p);
    };
    sourcePhoto.current = photo ?? null;
    if (!photo || !canFly()) return go();
    // Old state: the card photo carries the name. New state: the sheet's first photo carries it.
    vtName(photo, "vt-photo");
    const t = document.startViewTransition(() => {
      vtName(photo, "");
      flushSync(go);
      const d = sheetEl();
      if (!d) return;
      // "arriving" holds the other photos back until the flying one has landed.
      d.classList.add("vt", "is-open", "arriving");
      vtName(d, "vt-sheet");
      const first = d.querySelector<HTMLElement>(".slide");
      if (first) vtName(first, "vt-photo");
    });
    // If the browser skips the flight (another tap, a hidden tab), the DOM update still runs:
    // fall back to the plain slide-up so the sheet never just pops in.
    t.ready.catch(() =>
      t.updateCallbackDone
        .then(() => {
          const d = sheetEl();
          if (!d?.open) return;
          d.classList.remove("vt", "is-open");
          d.getBoundingClientRect();
          d.classList.add("is-open");
        })
        .catch(() => {}),
    );
    t.finished.catch(() => {}).finally(() => {
      const d = sheetEl();
      if (!d) return;
      vtName(d, "");
      d.querySelectorAll<HTMLElement>(".slide").forEach((s) => vtName(s, ""));
      d.classList.remove("vt");
      requestAnimationFrame(() => d.classList.remove("arriving"));
    });
  };
  const leaveSheet = () => {
    if (history.state?.sheet) history.back();
    else {
      history.replaceState(null, "", location.pathname + location.search);
      setOpen(null);
    }
  };
  const closeSheet = () => {
    const d = sheetEl();
    const photo = sourcePhoto.current;
    // The photo flies back to its card when the first photo is showing; a dragged-away sheet just slides off.
    if (!d?.open || !photo?.isConnected || d.classList.contains("dismissing") || !canFly()) return leaveSheet();
    const gallery = d.querySelector<HTMLElement>(".gallery");
    const first = gallery && gallery.scrollLeft < 8 ? d.querySelector<HTMLElement>(".slide") : null;
    if (first) vtName(first, "vt-photo");
    vtName(d, "vt-sheet");
    d.classList.add("vt");
    const t = document.startViewTransition(() => {
      if (first) {
        vtName(first, "");
        vtName(photo, "vt-photo");
      }
      vtName(d, "");
      flushSync(() => setOpen(null));
      d.close();
    });
    t.ready.catch(() => {});
    t.finished.catch(() => {}).finally(() => {
      vtName(photo, "");
      d.classList.remove("vt");
      if (history.state?.sheet) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    });
  };

  // The copy starts inside the tap itself and the chat opens through a real link, so phone
  // browsers (iOS Safari, in-app browsers) neither block the clipboard nor the new tab.
  const copyOrder = (kind: "messenger" | "zalo" | "tiktok") => {
    if (!open) return;
    const selectedVariant = open.variants.find((variant) => variant.id === selectedVariantId) ?? open.variants[0] ?? null;
    const msg = orderMessage(open, selectedVariant);
    const done = linkFor(shop, kind) ? "Đã sao chép tin nhắn, dán vào khung chat để gửi" : `Đã sao chép tin nhắn. Shop chưa cập nhật ${missingLabel[kind]}.`;
    if (!navigator.clipboard) return toast(msg);
    navigator.clipboard.writeText(msg).then(
      () => toast(done),
      () => toast(msg),
    );
  };
  const orderLink = (kind: "messenger" | "zalo" | "tiktok", label: string) => {
    const url = linkFor(shop, kind);
    const logo = kind === "messenger" ? "facebook" : kind;
    return url ? (
      <a className="contact-btn" href={url} target="_blank" rel="noopener" onClick={() => copyOrder(kind)}>
        <ContactLogo kind={logo} />
        {label}
      </a>
    ) : (
      <button className="contact-btn" type="button" onClick={() => copyOrder(kind)}>
        <ContactLogo kind={logo} />
        {label}
      </button>
    );
  };
  const toastEl = (
    <div className={toastMsg ? "toast show" : "toast"} role="status" aria-live="polite">
      {toastMsg}
    </div>
  );

  return (
    <>
      <header className="hero">
        <div className="hero-copy">
          <h1>
            {shop.name.replace(/\s*Florist$/i, "")} <em>Florist</em>
          </h1>
          <p className="hero-slogan">Hoa lụa, hoa sáp handmade cao cấp</p>
          <a className="hero-cta" href="#mau-hoa">
            Xem mẫu hoa
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </a>
        </div>
        <div className="hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero.webp" alt="Bó hoa nhiều màu giơ lên giữa trời xanh" width={2000} height={1408} fetchPriority="high" />
        </div>
      </header>

      <main>
        <section className="intro" aria-label="Giới thiệu" ref={introRef}>
          <p>{shop.name} là tiệm hoa handmade tại Hà Nội, chuyên hoa lụa và hoa sáp được kết thủ công bằng tay.</p>
          <p>Hoa giữ dáng, giữ màu lâu và không cần tưới nước, hợp để tặng hoặc trang trí. Bạn xem mẫu bên dưới, thích mẫu nào thì bấm Đặt mẫu này để nhắn shop.</p>
        </section>

        <div className="tabs-wrap" id="mau-hoa" ref={tabsWrapRef}>
          <div className="tabs" role="tablist" aria-label="Dòng sản phẩm" ref={tabsRef}>
            <span className="tab-ink" aria-hidden="true" ref={inkRef} />
            {[{ id: "all", name: "Tất cả", color: "#8DBDE3" }, ...categories].map((c) => (
              <button
                key={c.id}
                className="tab"
                role="tab"
                type="button"
                aria-controls="catalog"
                aria-selected={active === c.id}
                style={{ "--c": c.color } as React.CSSProperties}
                onClick={() => setActive(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="search-wrap">
            <label className="search">
              <span className="sr">Tìm mẫu hoa</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input type="search" placeholder="Tìm mẫu theo tên hoặc mã" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </div>

        <section className="catalog" id="catalog" role="tabpanel" aria-live="polite">
          <p className="catalog-hint">
            {list.length ? `${list.length} mẫu · Chạm vào mẫu để xem thêm ảnh` : term ? "Không tìm thấy mẫu phù hợp. Thử từ khác hoặc nhắn shop nhé." : "Dòng này chưa có mẫu. Bạn nhắn shop để xem các mẫu mới nhất nhé."}
          </p>
          {/* Keyed by category so switching tabs replays the staggered entrance. */}
          <ul className="grid" key={active}>
            {list.map((p, i) => (
              <li key={p.code} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <button
                  className="card"
                  type="button"
                  style={{ "--c": catById.get(p.categoryId)?.color } as React.CSSProperties}
                  onClick={(e) => openProduct(p, e.currentTarget.querySelector<HTMLElement>(".card-photo"))}
                >
                  <CardPhoto src={p.images[0]} />
                  <span className="card-name">{p.name}</span>
                  <span className="card-price">{priceText(p)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="foot">
        <p className="foot-name">{shop.name}</p>
        <p>Hoa lụa, hoa sáp handmade cao cấp · Hà Nội</p>
      </footer>

      <nav className="contact-bar" aria-label="Liên hệ shop" ref={barRef}>
        <Contact shop={shop} onMissing={toast} kind="phone" label="Gọi" main />
        <Contact shop={shop} onMissing={toast} kind="zalo" label="Zalo" />
        <Contact shop={shop} onMissing={toast} kind="facebook" label="Facebook" />
        <Contact shop={shop} onMissing={toast} kind="tiktok" label="TikTok" />
      </nav>

      <ProductSheet
        product={open}
        category={open ? catById.get(open.categoryId) : undefined}
        selectedVariantId={selectedVariantId}
        onVariantChange={setSelectedVariantId}
        onClose={closeSheet}
        toast={open ? toastEl : null}
      >
        {open ? (
          picking ? (
            <div className="order-pick">
              <p>Chọn cách liên hệ. Tin nhắn đặt mẫu sẽ được sao chép sẵn, bạn chỉ cần dán vào khung chat và gửi.</p>
              <div className="grid4">
                {orderLink("messenger", "Facebook")}
                {orderLink("zalo", "Zalo")}
                {orderLink("tiktok", "TikTok")}
                <Contact shop={shop} onMissing={toast} kind="phone" label="Gọi điện" main />
              </div>
              <button className="back-link" type="button" onClick={() => setPicking(false)}>
                Quay lại
              </button>
            </div>
          ) : (
            <button className="contact-btn is-main" type="button" onClick={() => setPicking(true)}>
              <ContactLogo kind="order" />
              Đặt mẫu này
            </button>
          )
        ) : null}
      </ProductSheet>

      {/* A modal dialog sits in the top layer, so while it is open the toast must live inside it. */}
      {open ? null : toastEl}
    </>
  );
}

function resetDrag(d: HTMLDialogElement) {
  d.classList.remove("dragging", "drag-dim", "dismissing", "arriving", "vt");
  d.style.removeProperty("--drag");
  d.style.removeProperty("--p");
}

/** Bottom sheet (dialog) with gallery, specs and the action area. */
function ProductSheet({
  product,
  category,
  selectedVariantId,
  onVariantChange,
  onClose,
  toast,
  children,
}: {
  product: CatalogProduct | null;
  category?: CatalogCategory;
  selectedVariantId: string | null;
  onVariantChange: (id: string) => void;
  onClose: () => void;
  toast: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  // Keep the last product rendered while the sheet animates closed.
  const [shown, setShown] = useState<CatalogProduct | null>(product);
  const [slide, setSlide] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (product && product !== shown) {
    setShown(product);
    setSlide(0);
  }
  // Every opening starts at the first photo: the gallery is remounted, so a photo swiped to
  // earlier (same product or another one) does not carry over.
  const [openCount, setOpenCount] = useState(product ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(!!product);
  if (!!product !== wasOpen) {
    setWasOpen(!!product);
    if (product) {
      setOpenCount(openCount + 1);
      setSlide(0);
    }
  }

  // Layout effect: when the photo flies in (View Transition), the dialog must be open in the same frame.
  useLayoutEffect(() => {
    const d = ref.current!;
    clearTimeout(closeTimer.current);
    if (product) {
      if (!d.open) {
        resetDrag(d);
        d.showModal();
        d.focus();
      }
      document.documentElement.classList.add("sheet-open");
      requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("is-open")));
    } else if (d.open) {
      d.classList.remove("is-open");
      document.documentElement.classList.remove("sheet-open");
      closeTimer.current = setTimeout(() => {
        d.close();
        resetDrag(d);
      }, 340);
    }
  }, [product]);

  // Drag the handle down to close (phones); the backdrop lightens with the finger.
  const drag = useRef<{ y0: number; y: number; t: number; v: number } | null>(null);
  const onGrabDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".sheet-close") || matchMedia("(min-width: 900px)").matches) return;
    drag.current = { y0: e.clientY, y: e.clientY, t: performance.now(), v: 0 };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone; the move/up handlers still work without capture
    }
    ref.current!.classList.add("dragging", "drag-dim");
  };
  const onGrabMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = drag.current;
    if (!s) return;
    const now = performance.now();
    s.v = (e.clientY - s.y) / Math.max(1, now - s.t);
    s.y = e.clientY;
    s.t = now;
    const d = ref.current!;
    const dy = Math.max(0, e.clientY - s.y0);
    d.style.setProperty("--drag", dy + "px");
    d.style.setProperty("--p", String(Math.max(0, 1 - dy / (d.offsetHeight || 1))));
  };
  const onGrabEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = drag.current;
    if (!s) return;
    drag.current = null;
    const d = ref.current!;
    d.classList.remove("dragging");
    const dy = Math.max(0, e.clientY - s.y0);
    // Close after a long pull, or a quick flick that has moved a little (a tiny twitch does not count).
    if (dy > d.offsetHeight * 0.3 || (s.v > 0.6 && dy > 48)) {
      d.style.setProperty("--drag", d.offsetHeight + "px");
      d.style.setProperty("--p", "0");
      d.classList.add("dismissing");
      onClose();
    } else {
      resetDrag(d);
    }
  };

  const p = product ?? shown;
  const selectedVariant = p?.variants.find((variant) => variant.id === selectedVariantId) ?? p?.variants[0] ?? null;
  const specs = p ? ([["Kích thước", p.size], ["Màu sắc", p.color]] as const).filter((s) => s[1]) : [];
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      tabIndex={-1}
      style={{ "--c": category?.color } as React.CSSProperties}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-grab" onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabEnd} onPointerCancel={onGrabEnd}>
        <button className="sheet-close" type="button" aria-label="Đóng" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {p ? (
        <>
          <div className="sheet-body">
            <div className="sheet-view">
              <div>
                <div
                  key={openCount}
                  className="gallery"
                  ref={gallery}
                  tabIndex={0}
                  aria-label="Ảnh sản phẩm, vuốt ngang để xem thêm"
                  onScroll={(e) => {
                    const g = e.currentTarget;
                    const items = [...g.children] as HTMLElement[];
                    if (!items.length) return;
                    const x = g.scrollLeft + items[0].offsetLeft;
                    let nearest = 0;
                    items.forEach((el, i) => {
                      if (Math.abs(el.offsetLeft - x) < Math.abs(items[nearest].offsetLeft - x)) nearest = i;
                    });
                    if (g.scrollLeft + g.clientWidth >= g.scrollWidth - 2) nearest = items.length - 1;
                    setSlide(nearest);
                  }}
                >
                  {(p.images.length ? p.images : [null]).map((src, i) => (
                    <div className={i === slide ? "slide on" : "slide"} key={src ?? i}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {src ? <img src={src} alt={`${p.name}, ảnh ${i + 1}`} /> : null}
                    </div>
                  ))}
                </div>
                {p.images.length > 1 ? (
                  <div className="dots" aria-hidden="true">
                    {p.images.map((src, i) => (
                      <i key={src} className={i === slide ? "on" : undefined} />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="info">
                <span className="info-cat">{category?.name}</span>
                <h2 id="sheet-title">{p.name}</h2>
                <p className="info-code">Mã mẫu {p.code}</p>
                {p.variants.length ? (
                  <div className="variant-options" role="group" aria-label="Chọn biến thể">
                    {p.variants.map((variant, index) => (
                      <button key={variant.id} type="button" className="variant-option" aria-pressed={variant.id === selectedVariant?.id} onClick={() => onVariantChange(variant.id)}>
                        <span>
                          {variant.name}
                          {index === 0 ? <small>Mặc định</small> : null}
                        </span>
                        <b>{money(variant.price)}</b>
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="info-price">{priceText(p, selectedVariant)}</p>
                {specs.length ? (
                  <dl className="specs">
                    {specs.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {p.description ? <p className="info-note">{p.description}</p> : null}
              </div>
            </div>
          </div>
          <div className="sheet-actions" style={{ gridTemplateColumns: "1fr" }}>
            {children}
          </div>
        </>
      ) : null}
      {toast}
    </dialog>
  );
}
