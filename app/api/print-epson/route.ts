import { NextRequest, NextResponse } from "next/server";

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
      const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
      const dateStr = invoiceDate.toLocaleDateString("en-IN");
      const timeStr = invoiceDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      let itemsXml = "";
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((it: any) => {
          const name = it.variantName ? `${it.name} (${it.variantName})` : it.name;
          const qty = it.quantity;
          const price = Number(it.price).toFixed(2);
          const total = Number(it.total).toFixed(2);

          itemsXml += `<text align="left" bold="true">${escapeXml(name)}&#10;</text>`;
          itemsXml += `<text>  ${qty} x Rs.${price}                Rs.${total}&#10;</text>`;
        });
      }

      eposXml = `
        <text align="center" width="2" height="2" smooth="true">${escapeXml(storeName)}&#10;</text>
        <text width="1" height="1" align="center">Outlet: ${escapeXml(branch)}&#10;</text>
        <text>${escapeXml(address)}&#10;</text>
        ${phone ? `<text>Ph: ${escapeXml(phone)}&#10;</text>` : ""}
        ${isGst && gstin ? `<text>GSTIN: ${escapeXml(gstin)}&#10;</text>` : ""}
        <text>================================&#10;</text>
        <text align="left" bold="true">Bill No: ${escapeXml(invoice.invoiceNumber)}&#10;</text>
        <text>Date &amp; Time: ${dateStr} ${timeStr}&#10;</text>
        ${
          invoice.customer?.name && invoice.customer.name !== "Walk-in Customer"
            ? `<text>Customer: ${escapeXml(invoice.customer.name)} (${escapeXml(invoice.customer.phone || "")})&#10;</text>`
            : ""
        }
        <text>--------------------------------&#10;</text>
        <text bold="true">Item / Qty / Rate / Total&#10;</text>
        <text>--------------------------------&#10;</text>
        ${itemsXml}
        <text>--------------------------------&#10;</text>
        <text align="left">Subtotal:                     Rs.${Number(invoice.subtotal).toFixed(2)}&#10;</text>
        ${
          invoice.discountAmount > 0
            ? `<text>Discount (${invoice.discountPercent}%):         - Rs.${Number(invoice.discountAmount).toFixed(2)}&#10;</text>`
            : ""
        }
        ${
          isGst && invoice.taxAmount > 0
            ? `
          <text>CGST (${invoice.cgstPercent || 2.5}%):             Rs.${Number(invoice.cgstAmount || invoice.taxAmount / 2).toFixed(2)}&#10;</text>
          <text>SGST (${invoice.sgstPercent || 2.5}%):             Rs.${Number(invoice.sgstAmount || invoice.taxAmount / 2).toFixed(2)}&#10;</text>
          <text>Total GST:                    Rs.${Number(invoice.taxAmount).toFixed(2)}&#10;</text>
        `
            : ""
        }
        <text>================================&#10;</text>
        <text width="2" height="2" bold="true">TOTAL: Rs.${Number(invoice.totalPayable).toFixed(2)}&#10;</text>
        <text width="1" height="1">Payment Mode: ${escapeXml((invoice.paymentMethod || "UPI").toUpperCase())}&#10;</text>
        <text>--------------------------------&#10;</text>
        <text align="center">${escapeXml(footer)}&#10;</text>
        <text>Software by GamaNext&#10;</text>
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
