import { NextRequest, NextResponse } from "next/server";
import { wrapText, getItemDisplayName } from "@/lib/escpos";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      printerIp,
      port = 80,
      deviceId = "local_printer",
      invoice,
      isTest,
      settings,
      branchName,
    } = body;

    if (!printerIp) {
      return NextResponse.json(
        { success: false, error: "Printer IP address is required" },
        { status: 400 }
      );
    }

    // Clean details from settings
    const storeName = (settings?.storeName || "NATURAL FRESH").trim();
    const address = (settings?.storeAddress || "Guntur, Andhra Pradesh").trim();
    const phone = (settings?.storePhone || "").trim();
    const gstin = (settings?.storeGst || "").trim();
    const isGst = settings?.enableGst !== false;
    const footer = (
      settings?.footerMessage || "Thank you for visiting! Please visit again!"
    ).trim();
    const branch = (branchName || invoice?.branchName || "Main Store").trim();

    let eposXml = "";

    if (isTest) {
      eposXml = `
        <text align="center" width="2" height="2" smooth="true">${escapeXml(storeName)}&#10;</text>
        <text width="1" height="1" align="center">Epson ePOS Direct LAN/Wi-Fi Test&#10;</text>
        <text>================================&#10;</text>
        <text align="left">Status:       SUCCESSFUL&#10;</text>
        <text>Connection:   Direct Epson ePOS&#10;</text>
        <text>IP Address:   ${escapeXml(printerIp)}&#10;</text>
        <text>Date:         ${new Date().toLocaleString("en-IN")}&#10;</text>
        <text>--------------------------------&#10;</text>
        <text align="center">Epson Printer is Ready for Fast POS Billing!&#10;</text>
        <text>${escapeXml(footer)}&#10;</text>
        <text>================================&#10;</text>
        <cut type="feed"/>
      `;
    } else if (invoice) {
      const invoiceDate = invoice.createdAt?.toDate
        ? invoice.createdAt.toDate()
        : invoice.createdAt instanceof Date
        ? invoice.createdAt
        : invoice.createdAt?.seconds
        ? new Date(invoice.createdAt.seconds * 1000)
        : new Date();

      const dateStr = invoiceDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timeStr = invoiceDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Wrapped Address
      const addressLines = wrapText(address, 32);
      const addressXml = addressLines
        .map((l) => `<text>${escapeXml(l)}&#10;</text>`)
        .join("");

      // Items list with clean formatting and no repeated variant names
      let itemsXml = "";
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((it: any) => {
          const displayName = getItemDisplayName(it.name, it.variantName);
          const qty = it.quantity;
          const price = Number(it.price).toFixed(2);
          const total = Number(it.total).toFixed(2);

          const nameLines = wrapText(displayName, 32);
          nameLines.forEach((nl) => {
            itemsXml += `<text align="left" bold="true">${escapeXml(nl)}&#10;</text>`;
          });

          const detailLeft = `  ${qty} x Rs.${price}`;
          const rightVal = `Rs.${total}`;
          const spaces = Math.max(1, 32 - detailLeft.length - rightVal.length);
          itemsXml += `<text>${escapeXml(detailLeft + " ".repeat(spaces) + rightVal)}&#10;</text>`;
        });
      }

      // Wrapped Footer
      const footerLines = wrapText(footer, 32);
      const footerXml = footerLines
        .map((l) => `<text>${escapeXml(l)}&#10;</text>`)
        .join("");

      // Subtotal & Totals formatting
      const subtotalVal = `Rs. ${Number(invoice.subtotal).toFixed(2)}`;
      const subtotalSpaces = Math.max(1, 32 - "Subtotal:".length - subtotalVal.length);

      let discountXml = "";
      if (invoice.discountAmount && Number(invoice.discountAmount) > 0) {
        const discLabel = `Discount (${invoice.discountPercent}%):`;
        const discVal = `- Rs. ${Number(invoice.discountAmount).toFixed(2)}`;
        const discSpaces = Math.max(1, 32 - discLabel.length - discVal.length);
        discountXml = `<text>${escapeXml(discLabel + " ".repeat(discSpaces) + discVal)}&#10;</text>`;
      }

      let gstXml = "";
      if (isGst && invoice.taxAmount && Number(invoice.taxAmount) > 0) {
        const cgstRate = invoice.cgstPercent ?? 2.5;
        const sgstRate = invoice.sgstPercent ?? 2.5;
        const cgstAmt = Number(invoice.cgstAmount ?? invoice.taxAmount / 2).toFixed(2);
        const sgstAmt = Number(invoice.sgstAmount ?? invoice.taxAmount / 2).toFixed(2);
        const totalGstAmt = Number(invoice.taxAmount).toFixed(2);

        const cgstLabel = `CGST (${cgstRate}%):`;
        const cgstVal = `Rs. ${cgstAmt}`;
        const cgstSpaces = Math.max(1, 32 - cgstLabel.length - cgstVal.length);

        const sgstLabel = `SGST (${sgstRate}%):`;
        const sgstVal = `Rs. ${sgstAmt}`;
        const sgstSpaces = Math.max(1, 32 - sgstLabel.length - sgstVal.length);

        const gstTotalLabel = `Total GST:`;
        const gstTotalVal = `Rs. ${totalGstAmt}`;
        const gstTotalSpaces = Math.max(1, 32 - gstTotalLabel.length - gstTotalVal.length);

        gstXml = `
          <text>${escapeXml(cgstLabel + " ".repeat(cgstSpaces) + cgstVal)}&#10;</text>
          <text>${escapeXml(sgstLabel + " ".repeat(sgstSpaces) + sgstVal)}&#10;</text>
          <text>${escapeXml(gstTotalLabel + " ".repeat(gstTotalSpaces) + gstTotalVal)}&#10;</text>
        `;
      }

      const grandTotalVal = `Rs. ${Number(invoice.totalPayable).toFixed(2)}`;
      const grandTotalSpaces = Math.max(1, 32 - "GRAND TOTAL:".length - grandTotalVal.length);

      const payMode = (invoice.paymentMethod || "CASH").toUpperCase();
      const payModeSpaces = Math.max(1, 32 - "Payment Mode:".length - payMode.length);

      eposXml = `
        <text align="center" width="2" height="2" smooth="true">${escapeXml(storeName)}&#10;</text>
        <text width="1" height="1" align="center">Outlet: ${escapeXml(branch)}&#10;</text>
        ${addressXml}
        ${phone ? `<text align="center">Phone: ${escapeXml(phone)}&#10;</text>` : ""}
        ${isGst && gstin ? `<text align="center">GSTIN: ${escapeXml(gstin)}&#10;</text>` : ""}
        <text>================================&#10;</text>
        <text align="left" bold="true">Bill No:        ${escapeXml(invoice.invoiceNumber)}&#10;</text>
        <text>Date &amp; Time:    ${dateStr} ${timeStr}&#10;</text>
        ${
          invoice.customer?.name && invoice.customer.name !== "Walk-in Customer"
            ? `<text>Customer:       ${escapeXml(invoice.customer.name)}${invoice.customer.phone ? ` (${escapeXml(invoice.customer.phone)})` : ""}&#10;</text>`
            : ""
        }
        <text>--------------------------------&#10;</text>
        <text bold="true">Item / Qty / Price / Total&#10;</text>
        <text>--------------------------------&#10;</text>
        ${itemsXml}
        <text>--------------------------------&#10;</text>
        <text bold="true">${escapeXml("Subtotal:" + " ".repeat(subtotalSpaces) + subtotalVal)}&#10;</text>
        ${discountXml}
        ${gstXml}
        <text>================================&#10;</text>
        <text width="2" height="2" bold="true">${escapeXml("TOTAL: " + grandTotalVal)}&#10;</text>
        <text width="1" height="1" bold="true">${escapeXml("Payment Mode:" + " ".repeat(payModeSpaces) + payMode)}&#10;</text>
        <text>--------------------------------&#10;</text>
        <text align="center">${footerXml}</text>
        <text align="center">Software by GamaNext&#10;</text>
        <cut type="feed"/>
      `;
    }

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
      ${eposXml}
    </epos-print>
  </s:Body>
</s:Envelope>`;

    const endpointUrl = `http://${printerIp}:${port}/cgi-bin/epos/service.cgi?devid=${deviceId}&timeout=10000`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '""',
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Epson printer returned HTTP ${res.status}: ${res.statusText}`);
    }

    const resText = await res.text();
    if (resText.includes('success="false"')) {
      return NextResponse.json(
        { success: false, error: "Epson printer reported an error executing the print job." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Printed successfully on Epson network printer!",
    });
  } catch (err: any) {
    console.error("Epson print error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err.name === "AbortError"
            ? "Connection to Epson printer timed out. Please check the printer IP address and ensure it is on the same local Wi-Fi / LAN."
            : err.message || "Failed to print to Epson network printer",
      },
      { status: 500 }
    );
  }
}

function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
