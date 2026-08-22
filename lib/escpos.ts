import { Invoice } from "./types";

export interface ReceiptOptions {
  paperWidth?: 58 | 80; // in mm, 58mm = 32 cols, 80mm = 48 cols
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGst?: string;
  footerMessage?: string;
}

// ESC/POS Command Byte Constants
const ESC = 0x1b;
const GS = 0x1d;

export const ESC_POS = {
  // Hardware & State
  INIT: new Uint8Array([ESC, 0x40]), // Initialize printer
  CUT: new Uint8Array([GS, 0x56, 0x41, 0x03]), // Full cut with 3 line feeds
  PARTIAL_CUT: new Uint8Array([GS, 0x56, 0x01]), // Partial cut
  FEED_LINES: (n: number) => new Uint8Array([ESC, 0x64, n]), // Feed n lines

  // Alignment
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),

  // Text Formats & Embellishments
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  UNDERLINE_ON: new Uint8Array([ESC, 0x2d, 0x01]),
  UNDERLINE_OFF: new Uint8Array([ESC, 0x2d, 0x00]),
  INVERT_ON: new Uint8Array([GS, 0x42, 0x01]),
  INVERT_OFF: new Uint8Array([GS, 0x42, 0x00]),

  // Font Sizing
  NORMAL: new Uint8Array([GS, 0x21, 0x00]),
  DOUBLE_HEIGHT: new Uint8Array([GS, 0x21, 0x01]),
  DOUBLE_WIDTH: new Uint8Array([GS, 0x21, 0x10]),
  DOUBLE_BOTH: new Uint8Array([GS, 0x21, 0x11]),
  TRIPLE_BOTH: new Uint8Array([GS, 0x21, 0x22]),
};

/**
 * Helper class to build ESC/POS command byte buffers
 */
export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  private cols: number;

  constructor(paperWidth: 58 | 80 = 58) {
    this.cols = paperWidth === 80 ? 48 : 32;
    this.add(ESC_POS.INIT);
  }

  public getColumns(): number {
    return this.cols;
  }

  public add(data: Uint8Array): this {
    this.chunks.push(data);
    return this;
  }

  public text(str: string): this {
    // Clean string to standard ASCII printable characters
    const clean = str
      .replace(/₹/g, "Rs.")
      .replace(/[^\x20-\x7E\n\r]/g, "");
    const encoder = new TextEncoder();
    this.chunks.push(encoder.encode(clean));
    return this;
  }

  public textLn(str: string = ""): this {
    this.text(str + "\n");
    return this;
  }

  public align(alignment: "left" | "center" | "right"): this {
    if (alignment === "center") this.add(ESC_POS.ALIGN_CENTER);
    else if (alignment === "right") this.add(ESC_POS.ALIGN_RIGHT);
    else this.add(ESC_POS.ALIGN_LEFT);
    return this;
  }

  public bold(enable: boolean = true): this {
    this.add(enable ? ESC_POS.BOLD_ON : ESC_POS.BOLD_OFF);
    return this;
  }

  public size(size: "normal" | "double-height" | "double-width" | "double-both" | "triple"): this {
    if (size === "double-height") this.add(ESC_POS.DOUBLE_HEIGHT);
    else if (size === "double-width") this.add(ESC_POS.DOUBLE_WIDTH);
    else if (size === "double-both") this.add(ESC_POS.DOUBLE_BOTH);
    else if (size === "triple") this.add(ESC_POS.TRIPLE_BOTH);
    else this.add(ESC_POS.NORMAL);
    return this;
  }

  public divider(char: string = "-"): this {
    const line = char.repeat(this.cols);
    this.align("left").textLn(line);
    return this;
  }

  public doubleDivider(): this {
    return this.divider("=");
  }

  /**
   * Two columns row (e.g. "Subtotal" on left, "Rs. 250.00" on right)
   */
  public twoColumns(left: string, right: string, bold: boolean = false): this {
    if (bold) this.bold(true);
    const rightLen = right.length;
    const maxLeftLen = Math.max(1, this.cols - rightLen - 1);
    const truncatedLeft = left.length > maxLeftLen ? left.substring(0, maxLeftLen) : left;
    const spaces = Math.max(1, this.cols - truncatedLeft.length - rightLen);
    const line = truncatedLeft + " ".repeat(spaces) + right;
    this.align("left").textLn(line);
    if (bold) this.bold(false);
    return this;
  }

  /**
   * Table row for invoice items (Item, Qty, Rate, Total)
   */
  public itemRow(name: string, qty: number, price: number, total: number): this {
    const qtyStr = `${qty}`;
    const priceStr = price.toFixed(2);
    const totalStr = total.toFixed(2);

    if (this.cols === 32) {
      // 58mm Paper (32 columns total):
      // Format:
      // Line 1: Item Name (wrap if needed)
      // Line 2: "  Qty: X  @ Price" -> Right aligned Total
      this.align("left").bold(true).textLn(name).bold(false);
      const detailLeft = `  ${qtyStr} x ${priceStr}`;
      const spaces = Math.max(1, this.cols - detailLeft.length - totalStr.length);
      this.textLn(detailLeft + " ".repeat(spaces) + totalStr);
    } else {
      // 80mm Paper (48 columns total):
      // Col 1 (Item): 22 chars, Col 2 (Qty): 5 chars, Col 3 (Price): 10 chars, Col 4 (Total): 11 chars
      const colItem = 22;
      const colQty = 5;
      const colPrice = 10;
      const colTotal = 11;

      const itemShort = name.length > colItem ? name.substring(0, colItem - 1) + "." : name.padEnd(colItem);
      const qtyPadded = qtyStr.padStart(colQty);
      const pricePadded = priceStr.padStart(colPrice);
      const totalPadded = totalStr.padStart(colTotal);

      this.align("left").textLn(`${itemShort}${qtyPadded}${pricePadded}${totalPadded}`);
    }
    return this;
  }

  public feed(n: number = 3): this {
    this.add(ESC_POS.FEED_LINES(n));
    return this;
  }

  public cut(): this {
    this.feed(3);
    this.add(ESC_POS.CUT);
    return this;
  }

  public build(): Uint8Array {
    // Calculate total buffer length
    const totalLen = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const buffer = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of this.chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return buffer;
  }
}

/**
 * Generate ESC/POS receipt byte buffer for an invoice
 */
export function generateInvoiceReceiptBytes(
  invoice: Invoice,
  options: ReceiptOptions = {}
): Uint8Array {
  const width = options.paperWidth || 58;
  const builder = new EscPosBuilder(width);

  const storeName = options.storeName || "NATURAL FRESH";
  const branchName = invoice.branchName || "Main Store";
  const address = options.storeAddress || "Guntur, Andhra Pradesh";
  const phone = options.storePhone || "9398638314";
  const gstin = options.storeGst || "37AAAAA0000A1Z5";
  const footer = options.footerMessage || "Thank you for visiting! Visit Again!";

  // 1. Header
  builder
    .align("center")
    .size("double-both")
    .bold(true)
    .textLn(storeName)
    .size("normal")
    .bold(false)
    .textLn(`Outlet: ${branchName}`)
    .textLn(address)
    .textLn(`Ph: ${phone}`)
    .textLn(`GSTIN: ${gstin}`)
    .doubleDivider();

  // 2. Invoice Details
  const invoiceDate = invoice.createdAt?.toDate
    ? invoice.createdAt.toDate()
    : new Date();
  const dateStr = invoiceDate.toLocaleDateString("en-IN");
  const timeStr = invoiceDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  builder
    .twoColumns("Bill No:", invoice.invoiceNumber, true)
    .twoColumns("Date & Time:", `${dateStr} ${timeStr}`);

  if (invoice.customer?.name && invoice.customer.name !== "Walk-in Customer") {
    builder.twoColumns("Customer:", invoice.customer.name);
    if (invoice.customer.phone) {
      builder.twoColumns("Mobile:", invoice.customer.phone);
    }
  }

  builder.divider();

  // 3. Items Header
  if (width === 80) {
    builder
      .bold(true)
      .textLn("Item                  Qty     Rate      Total")
      .bold(false)
      .divider();
  } else {
    builder
      .bold(true)
      .textLn("Items Description / Qty / Total")
      .bold(false)
      .divider();
  }

  // 4. Items List
  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((item) => {
      builder.itemRow(item.name, item.quantity, item.price, item.total);
    });
  }

  builder.divider();

  // 5. Calculations Breakdown
  builder.twoColumns("Item Count / Qty:", `${invoice.items?.length || 0} items`);
  builder.twoColumns("Subtotal:", `Rs. ${Number(invoice.subtotal).toFixed(2)}`);

  if (invoice.discountAmount && Number(invoice.discountAmount) > 0) {
    builder.twoColumns(
      `Discount (${invoice.discountPercent}%):`,
      `- Rs. ${Number(invoice.discountAmount).toFixed(2)}`
    );
  }

  if (invoice.taxAmount && Number(invoice.taxAmount) > 0) {
    builder.twoColumns(
      `GST Tax (${invoice.taxPercent || 5}%):`,
      `Rs. ${Number(invoice.taxAmount).toFixed(2)}`
    );
  }

  builder.doubleDivider();

  // 6. Net Total Payable
  builder
    .size("double-height")
    .bold(true)
    .twoColumns("NET PAYABLE:", `Rs. ${Number(invoice.totalPayable).toFixed(2)}`)
    .size("normal")
    .bold(false);

  builder.twoColumns("Payment Mode:", invoice.paymentMethod.toUpperCase(), true);

  builder.divider();

  // 7. Footer message
  builder
    .align("center")
    .textLn(footer)
    .textLn("Software by GamaNext")
    .cut();

  return builder.build();
}

/**
 * Generate Test Receipt for Thermal Printer connection check
 */
export function generateTestReceiptBytes(
  options: ReceiptOptions = {}
): Uint8Array {
  const width = options.paperWidth || 58;
  const builder = new EscPosBuilder(width);

  builder
    .align("center")
    .size("double-both")
    .bold(true)
    .textLn("NATURAL FRESH")
    .size("normal")
    .bold(false)
    .textLn("Thermal Printer Test")
    .doubleDivider()
    .align("left")
    .twoColumns("Connection:", "SUCCESSFUL", true)
    .twoColumns("Paper Mode:", `${width}mm (${builder.getColumns()} cols)`)
    .twoColumns("Timestamp:", new Date().toLocaleTimeString("en-IN"))
    .divider()
    .align("center")
    .textLn("Printer is Ready for Fast POS Billing!")
    .doubleDivider()
    .cut();

  return builder.build();
}
