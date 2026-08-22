"use client";

import { useState } from "react";
import { usePrinter } from "@/lib/PrinterContext";
import {
  Printer,
  Usb,
  Bluetooth,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Store,
  Phone,
  Receipt,
  Save,
  HelpCircle,
  Sparkles,
  Zap,
} from "lucide-react";

export default function SettingsPageClient() {
  const {
    isConnected,
    connectionType,
    deviceName,
    isConnecting,
    isPrinting,
    settings,
    updateSettings,
    connectUSB,
    connectBluetooth,
    disconnect,
    printTestReceipt,
    isWebUsbSupported,
    isWebBluetoothSupported,
  } = usePrinter();

  // Local Form State for Receipt Settings
  const [formData, setFormData] = useState({
    paperWidth: settings.paperWidth,
    storeName: settings.storeName,
    storeAddress: settings.storeAddress,
    storePhone: settings.storePhone,
    storeGst: settings.storeGst,
    footerMessage: settings.footerMessage,
    autoPrintOnSale: settings.autoPrintOnSale,
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  return (
    <div className="min-h-full p-4 lg:p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-[8px] border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[8px] bg-blue-50 text-blue-600 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Printer & System Settings
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure direct WebUSB and Web Bluetooth thermal printers, paper roll size, and receipt headers.
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Connected ({connectionType?.toUpperCase()}: {deviceName || "Thermal Printer"})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>No Printer Connected</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Thermal Printer Hardware Connection (8 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* Hardware Connection Card */}
          <div className="bg-white rounded-[8px] border border-slate-200 p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Thermal Printer Connection
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                Direct ESC/POS Driverless
              </span>
            </div>

            {/* Connection Method Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* WebUSB Connection Card */}
              <div
                className={`p-4 rounded-[8px] border transition-all flex flex-col justify-between gap-3 ${
                  connectionType === "usb" && isConnected
                    ? "bg-blue-50/70 border-blue-400 ring-2 ring-blue-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[6px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Usb className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">WebUSB Connection</p>
                      <p className="text-[10px] text-slate-500">USB cable to printer</p>
                    </div>
                  </div>
                  {connectionType === "usb" && isConnected && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>

                <div className="text-[11px] text-slate-600">
                  {isWebUsbSupported ? (
                    <p className="text-emerald-700 font-medium">✓ Browser Supported</p>
                  ) : (
                    <p className="text-amber-700 font-medium">⚠ Not supported (Use Chrome/Edge)</p>
                  )}
                </div>

                {connectionType === "usb" && isConnected ? (
                  <button
                    type="button"
                    onClick={disconnect}
                    className="w-full h-[36px] bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Disconnect USB</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={connectUSB}
                    disabled={isConnecting || !isWebUsbSupported}
                    className="w-full h-[36px] bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Usb className="w-3.5 h-3.5" />
                    )}
                    <span>Connect USB Printer</span>
                  </button>
                )}
              </div>

              {/* Web Bluetooth Connection Card */}
              <div
                className={`p-4 rounded-[8px] border transition-all flex flex-col justify-between gap-3 ${
                  connectionType === "bluetooth" && isConnected
                    ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[6px] bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Bluetooth className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Web Bluetooth</p>
                      <p className="text-[10px] text-slate-500">Wireless Bluetooth paired</p>
                    </div>
                  </div>
                  {connectionType === "bluetooth" && isConnected && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  )}
                </div>

                <div className="text-[11px] text-slate-600">
                  {isWebBluetoothSupported ? (
                    <p className="text-emerald-700 font-medium">✓ Browser Supported</p>
                  ) : (
                    <p className="text-amber-700 font-medium">⚠ Not supported (Use Chrome/Android)</p>
                  )}
                </div>

                {connectionType === "bluetooth" && isConnected ? (
                  <button
                    type="button"
                    onClick={disconnect}
                    className="w-full h-[36px] bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Disconnect Bluetooth</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={connectBluetooth}
                    disabled={isConnecting || !isWebBluetoothSupported}
                    className="w-full h-[36px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bluetooth className="w-3.5 h-3.5" />
                    )}
                    <span>Connect Bluetooth</span>
                  </button>
                )}
              </div>
            </div>

            {/* Test Print Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Test Alignment:</span> Verify that ESC/POS commands print correctly on your roll.
              </div>
              <button
                type="button"
                onClick={printTestReceipt}
                disabled={!isConnected || isPrinting}
                className="h-[36px] px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {isPrinting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>Print Test Receipt</span>
              </button>
            </div>
          </div>

          {/* Paper Roll Format Card */}
          <div className="bg-white rounded-[8px] border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Paper Roll Dimensions
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-[8px] border cursor-pointer transition-all flex items-start gap-3 ${
                  formData.paperWidth === 58
                    ? "bg-blue-50/60 border-blue-500 ring-2 ring-blue-200"
                    : "bg-slate-50 border-slate-200 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="paperWidth"
                  checked={formData.paperWidth === 58}
                  onChange={() => {
                    setFormData((prev) => ({ ...prev, paperWidth: 58 }));
                    updateSettings({ paperWidth: 58 });
                  }}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">58mm (2-inch Roll)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    32 Columns. Standard for portable Bluetooth & compact POS billing printers.
                  </p>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-[8px] border cursor-pointer transition-all flex items-start gap-3 ${
                  formData.paperWidth === 80
                    ? "bg-blue-50/60 border-blue-500 ring-2 ring-blue-200"
                    : "bg-slate-50 border-slate-200 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="paperWidth"
                  checked={formData.paperWidth === 80}
                  onChange={() => {
                    setFormData((prev) => ({ ...prev, paperWidth: 80 }));
                    updateSettings({ paperWidth: 80 });
                  }}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">80mm (3-inch Roll)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    48 Columns. Full counter thermal printers with dedicated itemized tables.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Receipt Store Details & Header/Footer (5 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSaveSettings}
            className="bg-white rounded-[8px] border border-slate-200 p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Receipt Branding & Header
              </h2>
            </div>

            {/* Store Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Store Title on Receipt
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, storeName: e.target.value }))
                }
                required
                className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Store Address
              </label>
              <input
                type="text"
                value={formData.storeAddress}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, storeAddress: e.target.value }))
                }
                required
                className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Phone & GSTIN */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.storePhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, storePhone: e.target.value }))
                  }
                  required
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GSTIN No.
                </label>
                <input
                  type="text"
                  value={formData.storeGst}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, storeGst: e.target.value }))
                  }
                  required
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Footer Message */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receipt Footer Tagline
              </label>
              <input
                type="text"
                value={formData.footerMessage}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, footerMessage: e.target.value }))
                }
                className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="w-full h-[38px] bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save Receipt Details</span>
            </button>
          </form>

          {/* Quick Help Card */}
          <div className="p-4 bg-blue-50/60 rounded-[8px] border border-blue-200 text-xs space-y-2 text-blue-900">
            <div className="flex items-center gap-1.5 font-bold">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>Supported Printers</span>
            </div>
            <p className="text-[11px] leading-relaxed text-blue-800">
              Compatible with all standard ESC/POS USB and Bluetooth thermal receipt printers (TVS, Epson, Xprinter, Everycom, Retsol, NGX, HoIN, MPT-II, etc.).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
