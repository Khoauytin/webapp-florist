import type { ChannelKey } from "@/lib/labels";

/** Shared by the server pages that prepare the order form and the client form itself. */
export interface PickProduct {
  id: string;
  code: string;
  name: string;
  price: number | null;
  imageUrl: string | null;
  variants: { id: string; name: string; price: number }[];
}

export interface PickCategory {
  id: string;
  name: string;
}

export interface FormLine {
  key: string;
  /** existing order line when editing (keeps its price snapshot) */
  id?: string;
  productId: string;
  productVariantId: string | null;
  variantName: string | null;
  code: string;
  name: string;
  price: number | null;
  /** Only catalog items without a listed price need a quote entered on this new line. */
  isPriceEditable: boolean;
  imageUrl: string | null;
  qty: number;
  note: string;
}

export interface OrderFormValues {
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  sameRecipient: boolean;
  recipientName: string;
  recipientPhone: string;
  channel: ChannelKey;
  receiveType: "DELIVERY" | "PICKUP";
  deliveryAddress: string;
  deliveryDate: string;
  deliveryTimeFrom: string;
  deliveryTimeTo: string;
  courierName: string;
  shippingFee: number;
  discount: number;
  deposit: number;
  cardMessage: string;
  note: string;
  lines: FormLine[];
}

export function emptyOrder(date: string): OrderFormValues {
  return {
    customerId: null,
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    sameRecipient: true,
    recipientName: "",
    recipientPhone: "",
    channel: "FACEBOOK",
    receiveType: "DELIVERY",
    deliveryAddress: "",
    deliveryDate: date,
    deliveryTimeFrom: "",
    deliveryTimeTo: "",
    courierName: "",
    shippingFee: 0,
    discount: 0,
    deposit: 0,
    cardMessage: "",
    note: "",
    lines: [],
  };
}
