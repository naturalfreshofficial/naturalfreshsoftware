"use client";

import { useState, useEffect } from "react";
import { usePrinter } from "@/lib/PrinterContext";
import { useToast } from "@/components/ToastProvider";
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
  Building2,
  Percent,
  Calculator,
  Mail,
  MapPin,
  FileSpreadsheet,
  AlertCircle,
  ShieldCheck,
  Check,
} from "lucide-react";

type SettingsTab = "business" | "gst" | "printer";

export default function SettingsPageClient() {
  const toast = useToast();
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

  // Active Tab State
  const [activeTab, setActiveTab] = useState<SettingsTab>("business");
  const [isSaving, setIsSaving] = useState(false);

  // Form State initialized from settings
  const [formData, setFormData] = useState({
    // Business Details
    storeName: settings.storeName || "NATURAL FRESH",
    tagline: settings.tagline || "Pure Naturals & Fresh Delight",
    storePhone: settings.storePhone || "9398638314",
    storeEmail: settings.storeEmail || "contact@naturalfresh.com",
    storeAddress: settings.storeAddress || "Guntur, Andhra Pradesh",
    footerMessage: settings.footerMessage || "Thank you for visiting! Please visit again!",

    // GST Settings
    enableGst: settings.enableGst !== undefined ? settings.enableGst : true,
    storeGst: settings.storeGst || "37AAAAA0000A1Z5",
    cgstPercent: settings.cgstPercent !== undefined ? settings.cgstPercent : 2.5,
    sgstPercent: settings.sgstPercent !== undefined ? settings.sgstPercent : 2.5,

    // Printer Settings
    paperWidth: settings.paperWidth || 58,
    autoPrintOnSale: settings.autoPrintOnSale || false,
  });

  // Sync formData when settings load from Firestore
  useEffect(() => {
    setFormData({
      storeName: settings.storeName || "NATURAL FRESH",
      tagline: settings.tagline || "Pure Naturals & Fresh Delight",
      storePhone: settings.storePhone || "9398638314",
      storeEmail: settings.storeEmail || "contact@naturalfresh.com",
      storeAddress: settings.storeAddress || "Guntur, Andhra Pradesh",
      footerMessage: settings.footerMessage || "Thank you for visiting! Please visit again!",
      enableGst: settings.enableGst !== undefined ? settings.enableGst : true,
      storeGst: settings.storeGst || "37AAAAA0000A1Z5",
      cgstPercent: settings.cgstPercent !== undefined ? settings.cgstPercent : 2.5,
      sgstPercent: settings.sgstPercent !== undefined ? settings.sgstPercent : 2.5,
      paperWidth: settings.paperWidth || 58,
      autoPrintOnSale: settings.autoPrintOnSale || false,
    });
  }, [settings]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(formData);
    } catch (err: any) {
      toast.error("Failed to save settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const totalGstPercent = formData.enableGst
    ? Number(formData.cgstPercent || 0) + Number(formData.sgstPercent || 0)
    : 0;

  return (
    <div className="min-h-full p-4 lg:p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-[10px] border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[8px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Settings & Store Configuration
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your business profile, GST tax rates, and thermal receipt printer hardware.
            </p>
          </div>
        </div>

        {/* Live Thermal Printer Status Pill */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Printer: {connectionType?.toUpperCase()} ({deviceName || "Ready"})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Thermal Printer: Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("business")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "business"
              ? "border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-[6px]"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>1. Business Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gst")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "gst"
              ? "border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-[6px]"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>2. GST & Tax Setup</span>
          {formData.enableGst && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold">
              Active ({totalGstPercent}%)
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("printer")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "printer"
              ? "border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-[6px]"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>3. Thermal Printer</span>
          {isConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BUSINESS DETAILS */}
      {/* ========================================================================= */}
      {activeTab === "business" && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-[8px] border border-slate-200 p-5 lg:p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                <span>Store Profile & Branding</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                These business details appear on customer invoices, billing receipts, and thermal printouts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              {/* Store Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Store / Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="e.g. NATURAL FRESH OFFICIAL"
                  className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Tagline / Subtitle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tagline / Brand Subtitle
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. 100% Pure Naturals & Fresh Delight"
                  className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Support / Store Mobile Number</span>
                </label>
                <input
                  type="text"
                  value={formData.storePhone}
                  onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
                  placeholder="e.g. +91 93986 38314"
                  className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Official Business Email</span>
                </label>
                <input
                  type="email"
                  value={formData.storeEmail}
                  onChange={(e) => setFormData({ ...formData, storeEmail: e.target.value })}
                  placeholder="e.g. contact@naturalfresh.com"
                  className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Store Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Store Street Address</span>
                </label>
                <input
                  type="text"
                  value={formData.storeAddress}
                  onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                  placeholder="e.g. 4/1 Brodipet, Near Main Road, Guntur, Andhra Pradesh - 522002"
                  className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Receipt Footer Message */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span>Receipt Footer Note / Greetings</span>
                </label>
                <input
                  type="text"
                  value={formData.footerMessage}
                  onChange={(e) => setFormData({ ...formData, footerMessage: e.target.value })}
                  placeholder="e.g. Thank you for visiting Natural Fresh! Please visit again!"
                  className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="h-[42px] px-6 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-[6px] text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Business Details</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GST & TAX CONFIGURATION */}
      {/* ========================================================================= */}
      {activeTab === "gst" && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-[8px] border border-slate-200 p-5 lg:p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-blue-600" />
                  <span>GST (Goods & Services Tax) Configuration</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enable GST to automatically apply CGST and SGST percentages on POS billing receipts.
                </p>
              </div>

              {/* Enable / Disable Toggle Switch */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">
                  {formData.enableGst ? "GST Enabled" : "GST Disabled"}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, enableGst: !formData.enableGst })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    formData.enableGst ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      formData.enableGst ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* If GST is Disabled */}
            {!formData.enableGst ? (
              <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-[8px] flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-900">GST Billing is Currently Turned Off</h3>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    When GST is disabled, POS bills and thermal printouts will show product prices directly without separate CGST and SGST tax line items.
                    To collect and print GST on bills, toggle the switch above to <strong>&quot;GST Enabled&quot;</strong>.
                  </p>
                </div>
              </div>
            ) : (
              /* If GST is Enabled */
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                  {/* GST Number (GSTIN) */}
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>GSTIN / GST Number</span>
                        <span className="text-red-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">15-digit alphanumeric</span>
                    </label>
                    <input
                      type="text"
                      required={formData.enableGst}
                      value={formData.storeGst}
                      onChange={(e) =>
                        setFormData({ ...formData, storeGst: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. 37AAAAA0000A1Z5"
                      className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-mono font-bold text-slate-800 tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase transition-all"
                    />
                  </div>

                  {/* CGST Percentage */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CGST Percentage (%) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required={formData.enableGst}
                        value={formData.cgstPercent}
                        onChange={(e) =>
                          setFormData({ ...formData, cgstPercent: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="2.5"
                        className="w-full h-[40px] px-3 pr-8 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                  </div>

                  {/* SGST Percentage */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SGST Percentage (%) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required={formData.enableGst}
                        value={formData.sgstPercent}
                        onChange={(e) =>
                          setFormData({ ...formData, sgstPercent: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="2.5"
                        className="w-full h-[40px] px-3 pr-8 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                  </div>

                  {/* Total GST Summary Card */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Total Combined GST Rate
                    </label>
                    <div className="h-[40px] px-3 bg-emerald-50 border border-emerald-200 rounded-[6px] flex items-center justify-between text-emerald-800 font-mono font-extrabold text-sm">
                      <span>Total Tax:</span>
                      <span>{totalGstPercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Example Card */}
                <div className="p-4 bg-slate-50 rounded-[8px] border border-slate-200 space-y-2">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <span>Live Tax Calculation Preview (On a ₹100.00 Item)</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <p className="text-[10px] text-slate-400">Subtotal</p>
                      <p className="font-bold text-slate-800 font-mono">₹ 100.00</p>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <p className="text-[10px] text-slate-400">CGST ({formData.cgstPercent}%)</p>
                      <p className="font-bold text-blue-600 font-mono">
                        ₹ {((100 * formData.cgstPercent) / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <p className="text-[10px] text-slate-400">SGST ({formData.sgstPercent}%)</p>
                      <p className="font-bold text-blue-600 font-mono">
                        ₹ {((100 * formData.sgstPercent) / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                      <p className="text-[10px] text-emerald-700 font-bold">Total Bill</p>
                      <p className="font-extrabold text-emerald-700 font-mono">
                        ₹ {(100 + (100 * totalGstPercent) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="h-[42px] px-6 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-[6px] text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save GST Configuration</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: THERMAL PRINTER HARDWARE */}
      {/* ========================================================================= */}
      {activeTab === "printer" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Hardware Connection Card (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-[8px] border border-slate-200 p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Hardware Connection Center
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Connect your POS receipt printer directly via driverless WebUSB or Bluetooth.
                    </p>
                  </div>
                </div>

                {isConnected && (
                  <button
                    type="button"
                    onClick={disconnect}
                    className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-[5px] text-xs font-bold transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              {/* 2 Connect Action Cards: USB & Bluetooth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1: WebUSB */}
                <div
                  className={`p-4 rounded-[8px] border transition-all flex flex-col justify-between gap-4 ${
                    isConnected && connectionType === "usb"
                      ? "border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-[6px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Usb className="w-4 h-4" />
                      </div>
                      {isConnected && connectionType === "usb" && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Active USB
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">USB Cable Connection</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Connect desktop/laptop thermal printers directly using a USB cable.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={connectUSB}
                    disabled={isConnecting || isPrinting}
                    className="w-full h-[38px] bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-[6px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isConnecting && connectionType === "usb" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Usb className="w-4 h-4" />
                    )}
                    <span>{isConnected && connectionType === "usb" ? "Reconnect USB" : "Pair USB Printer"}</span>
                  </button>
                </div>

                {/* Option 2: Web Bluetooth */}
                <div
                  className={`p-4 rounded-[8px] border transition-all flex flex-col justify-between gap-4 ${
                    isConnected && connectionType === "bluetooth"
                      ? "border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-[6px] bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Bluetooth className="w-4 h-4" />
                      </div>
                      {isConnected && connectionType === "bluetooth" && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Active BLE
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">Bluetooth Wireless</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Pair wireless mobile thermal printers (MPT-II, ESC/POS, Sunmi).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={connectBluetooth}
                    disabled={isConnecting || isPrinting}
                    className="w-full h-[38px] bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-[6px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isConnecting && connectionType === "bluetooth" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bluetooth className="w-4 h-4" />
                    )}
                    <span>{isConnected && connectionType === "bluetooth" ? "Reconnect Bluetooth" : "Pair Bluetooth"}</span>
                  </button>
                </div>
              </div>

              {/* Hardware Test Action */}
              <div className="p-4 bg-slate-50 rounded-[8px] border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                  <p className="text-xs font-bold text-slate-800">Print Test Receipt</p>
                  <p className="text-[11px] text-slate-500">
                    Send ESC/POS test commands, formatting, and alignment test print.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={printTestReceipt}
                  disabled={!isConnected || isPrinting}
                  className="w-full sm:w-auto h-[36px] px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {isPrinting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>Test Receipt Print</span>
                </button>
              </div>
            </div>

            {/* Paper Roll & Auto Print Settings */}
            <form onSubmit={handleSave} className="bg-white rounded-[8px] border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>Paper Roll Dimensions & Automation</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Paper Roll Width Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Paper Roll Width (ESC/POS)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, paperWidth: 58 })}
                      className={`h-[42px] rounded-[6px] border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                        formData.paperWidth === 58
                          ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500/30"
                          : "border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <span>58 mm</span>
                      <span className="text-[9px] font-normal text-slate-500">(32 Columns)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, paperWidth: 80 })}
                      className={`h-[42px] rounded-[6px] border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                        formData.paperWidth === 80
                          ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500/30"
                          : "border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <span>80 mm</span>
                      <span className="text-[9px] font-normal text-slate-500">(48 Columns)</span>
                    </button>
                  </div>
                </div>

                {/* Auto Print Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Auto-Print Behavior
                  </label>
                  <label className="flex items-center gap-2.5 h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.autoPrintOnSale}
                      onChange={(e) => setFormData({ ...formData, autoPrintOnSale: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Auto-Print on POS Sale Completion
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-[38px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Printer Settings</span>
                </button>
              </div>
            </form>
          </div>

          {/* Thermal Receipt Simulation Preview (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-[8px] border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900">Receipt Format Preview</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold">
                  {formData.paperWidth}mm Mode
                </span>
              </div>

              {/* Thermal Paper Look-alike Container */}
              <div className="bg-amber-50/40 p-4 rounded-[6px] border border-dashed border-amber-300 font-mono text-[11px] text-slate-800 space-y-2 shadow-inner">
                {/* Header */}
                <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                  <p className="font-extrabold text-xs text-slate-900 uppercase">{formData.storeName || "NATURAL FRESH"}</p>
                  <p className="text-[10px] text-slate-600">{formData.tagline || "Pure Naturals & Fresh Delight"}</p>
                  <p className="text-[10px] text-slate-600">{formData.storeAddress || "Guntur, Andhra Pradesh"}</p>
                  <p className="text-[10px] text-slate-600">Ph: {formData.storePhone || "9398638314"}</p>
                  {formData.enableGst && formData.storeGst && (
                    <p className="text-[10px] text-slate-700 font-bold">GSTIN: {formData.storeGst}</p>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex justify-between text-[10px] text-slate-600 border-b border-dashed border-slate-300 pb-1.5">
                  <span>Inv: INV-20260822-1001</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>

                {/* Items */}
                <div className="space-y-1 py-1 border-b border-dashed border-slate-300 text-[10px]">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>ITEM</span>
                    <span>QTY  PRICE  AMT</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="truncate max-w-[120px]">Sitaphal 500ml</span>
                    <span>1  120.00 120.00</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="truncate max-w-[120px]">Tender Coconut</span>
                    <span>2   90.00 180.00</span>
                  </div>
                </div>

                {/* Totals & Tax */}
                <div className="space-y-0.5 text-[10px] text-slate-700 border-b border-dashed border-slate-300 pb-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹ 300.00</span>
                  </div>
                  {formData.enableGst ? (
                    <>
                      <div className="flex justify-between">
                        <span>CGST ({formData.cgstPercent}%):</span>
                        <span>₹ {((300 * formData.cgstPercent) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST ({formData.sgstPercent}%):</span>
                        <span>₹ {((300 * formData.sgstPercent) / 100).toFixed(2)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between font-extrabold text-xs text-slate-900 pt-1 border-t border-slate-300">
                    <span>TOTAL PAYABLE:</span>
                    <span>₹ {(300 + (300 * totalGstPercent) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Payment Mode:</span>
                    <span>UPI (Online)</span>
                  </div>
                </div>

                {/* Footer Message */}
                <div className="text-center pt-1 text-[10px] text-slate-500 italic">
                  <p>{formData.footerMessage || "Thank you for visiting! Please visit again!"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
