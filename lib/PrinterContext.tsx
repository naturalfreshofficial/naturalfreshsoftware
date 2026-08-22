"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Invoice } from "./types";
import {
  generateInvoiceReceiptBytes,
  generateTestReceiptBytes,
  ReceiptOptions,
} from "./escpos";
import { qzTray } from "./qzTray";
import { useToast } from "@/components/ToastProvider";
import { db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export type PrinterConnectionType = "usb" | "bluetooth" | "qz_tray" | "epson_network" | null;

export interface PrinterSettings {
  paperWidth: 58 | 80;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  tagline: string;
  enableGst: boolean;
  storeGst: string;
  cgstPercent: number;
  sgstPercent: number;
  footerMessage: string;
  autoPrintOnSale: boolean;
  qzPrinterName?: string;
  epsonPrinterIp?: string;
  epsonPort?: number;
  epsonDeviceId?: string;
}

interface PrinterContextType {
  isConnected: boolean;
  connectionType: PrinterConnectionType;
  deviceName: string | null;
  isConnecting: boolean;
  isPrinting: boolean;
  settings: PrinterSettings;
  qzPrintersList: string[];
  selectedQZPrinter: string;
  setSelectedQZPrinter: (name: string) => void;
  updateSettings: (newSettings: Partial<PrinterSettings>) => Promise<void>;
  connectUSB: () => Promise<boolean>;
  connectBluetooth: () => Promise<boolean>;
  connectQZTray: (targetPrinterName?: string) => Promise<boolean>;
  connectEpsonNetwork: (ip: string, port?: number) => Promise<boolean>;
  fetchQZPrinters: () => Promise<string[]>;
  disconnect: () => Promise<void>;
  printInvoice: (invoice: Invoice, branchName?: string) => Promise<boolean>;
  printTestReceipt: () => Promise<boolean>;
  printRawBytes: (bytes: Uint8Array) => Promise<boolean>;
  isWebUsbSupported: boolean;
  isWebBluetoothSupported: boolean;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  paperWidth: 58,
  storeName: "NATURAL FRESH",
  storeAddress: "Guntur, Andhra Pradesh",
  storePhone: "9398638314",
  storeEmail: "contact@naturalfresh.com",
  tagline: "Pure Naturals & Fresh Delight",
  enableGst: true,
  storeGst: "37AAAAA0000A1Z5",
  cgstPercent: 2.5,
  sgstPercent: 2.5,
  footerMessage: "Thank you for visiting! Please visit again!",
  autoPrintOnSale: false,
  qzPrinterName: "",
  epsonPrinterIp: "192.168.1.100",
  epsonPort: 80,
  epsonDeviceId: "local_printer",
};

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

// Known thermal printer Bluetooth GATT Services & Characteristics
const BLUETOOTH_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Standard Thermal POS Service
  "0000ffe0-0000-1000-8000-00805f9b34fb", // Common HM-10 / MPT-II Service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent Service
  "0000ff00-0000-1000-8000-00805f9b34fb", // Custom POS Printer Service
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Mobile POS Printer Service
  0x18f0,
  0xffe0,
  0xff00,
];

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const toast = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Active raw device handles
  const [usbDevice, setUsbDevice] = useState<any>(null);
  const [usbEndpointNumber, setUsbEndpointNumber] = useState<number>(1);
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [bluetoothCharacteristic, setBluetoothCharacteristic] = useState<any>(null);

  // QZ Tray State
  const [qzPrintersList, setQzPrintersList] = useState<string[]>([]);
  const [selectedQZPrinter, setSelectedQZPrinter] = useState<string>("");

  // Settings State
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);

  // Feature detection
  const isWebUsbSupported =
    typeof window !== "undefined" && "usb" in navigator;
  const isWebBluetoothSupported =
    typeof window !== "undefined" && "bluetooth" in navigator;

  // Load saved settings from Firestore & localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pos_thermal_printer_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
        if (parsed.qzPrinterName) {
          setSelectedQZPrinter(parsed.qzPrinterName);
        }
      }
      const savedDevice = localStorage.getItem("pos_thermal_last_device_name");
      const savedType = localStorage.getItem("pos_thermal_last_connection_type") as PrinterConnectionType;
      if (savedDevice && savedType) {
        setDeviceName(savedDevice);
        setConnectionType(savedType);
        if (savedType === "epson_network") {
          setIsConnected(true);
        }
      }
    } catch (e) {
      console.warn("Failed to load printer settings from localStorage:", e);
    }

    // Subscribe to Firestore settings/business doc
    const unsub = onSnapshot(doc(db, "settings", "business"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<PrinterSettings>;
        setSettings((prev) => {
          const merged = { ...prev, ...data };
          if (data.qzPrinterName) {
            setSelectedQZPrinter(data.qzPrinterName);
          }
          try {
            localStorage.setItem("pos_thermal_printer_settings", JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
    });

    return () => unsub();
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<PrinterSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    try {
      localStorage.setItem("pos_thermal_printer_settings", JSON.stringify(updated));
    } catch (e) {}

    try {
      await setDoc(doc(db, "settings", "business"), updated, { merge: true });
      toast.success("Settings saved and synced across all devices!");
    } catch (e) {
      console.warn("Firestore settings sync error:", e);
      toast.success("Settings saved locally!");
    }
  }, [settings, toast]);

  /**
   * Connect via WebUSB
   */
  const connectUSB = async (): Promise<boolean> => {
    if (!isWebUsbSupported) {
      toast.error("WebUSB is not supported in this browser. Please use Chrome or Edge.");
      return false;
    }

    setIsConnecting(true);
    try {
      const nav: any = navigator;
      const device = await nav.usb.requestDevice({
        filters: [],
      });

      if (!device) {
        setIsConnecting(false);
        return false;
      }

      await device.open();

      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      let chosenInterface = 0;
      let endpointNum = 1;

      if (device.configuration && device.configuration.interfaces) {
        for (const iface of device.configuration.interfaces) {
          for (const alt of iface.alternates) {
            const outEndpoint = alt.endpoints.find(
              (ep: any) => ep.direction === "out"
            );
            if (outEndpoint) {
              chosenInterface = iface.interfaceNumber;
              endpointNum = outEndpoint.endpointNumber;
              break;
            }
          }
        }
      }

      await device.claimInterface(chosenInterface);

      setUsbDevice(device);
      setUsbEndpointNumber(endpointNum);
      setIsConnected(true);
      setConnectionType("usb");
      const name = device.productName || device.manufacturerName || "USB Thermal Printer";
      setDeviceName(name);

      localStorage.setItem("pos_thermal_last_device_name", name);
      localStorage.setItem("pos_thermal_last_connection_type", "usb");

      toast.success(`Connected to USB Printer: ${name}`);
      return true;
    } catch (err: any) {
      console.error("USB Connect error:", err);
      if (err.name !== "NotFoundError") {
        toast.error("Failed to connect USB printer: " + (err.message || err));
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Connect via Web Bluetooth
   */
  const connectBluetooth = async (): Promise<boolean> => {
    if (!isWebBluetoothSupported) {
      toast.error("Web Bluetooth is not supported in this browser. Please use Chrome or Edge.");
      return false;
    }

    setIsConnecting(true);
    try {
      const nav: any = navigator;
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLUETOOTH_SERVICES,
      });

      if (!device) {
        setIsConnecting(false);
        return false;
      }

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("Could not connect to Bluetooth GATT server.");
      }

      const services = await server.getPrimaryServices();
      let writeChar: any = null;

      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (ch.properties.write || ch.properties.writeWithoutResponse) {
            writeChar = ch;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error("Could not find a writable data channel on this Bluetooth printer.");
      }

      setBluetoothDevice(device);
      setBluetoothCharacteristic(writeChar);
      setIsConnected(true);
      setConnectionType("bluetooth");
      const name = device.name || "Bluetooth Thermal Printer";
      setDeviceName(name);

      localStorage.setItem("pos_thermal_last_device_name", name);
      localStorage.setItem("pos_thermal_last_connection_type", "bluetooth");

      device.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        setConnectionType(null);
        toast.error("Bluetooth printer disconnected.");
      });

      toast.success(`Connected to Bluetooth Printer: ${name}`);
      return true;
    } catch (err: any) {
      console.error("Bluetooth Connect error:", err);
      if (err.name !== "NotFoundError") {
        toast.error("Failed to connect Bluetooth printer: " + (err.message || err));
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Connect via USB QZ Tray Desktop Service
   */
  const connectQZTray = async (targetPrinterName?: string): Promise<boolean> => {
    setIsConnecting(true);
    try {
      const printers = await qzTray.connect();
      setQzPrintersList(printers);

      const printerToUse = targetPrinterName || selectedQZPrinter || (printers.length > 0 ? printers[0] : "");
      if (printerToUse) {
        setSelectedQZPrinter(printerToUse);
        qzTray.setActivePrinter(printerToUse);
      }

      setIsConnected(true);
      setConnectionType("qz_tray");
      const name = printerToUse ? `QZ Tray (${printerToUse})` : "QZ Tray";
      setDeviceName(name);

      localStorage.setItem("pos_thermal_last_device_name", name);
      localStorage.setItem("pos_thermal_last_connection_type", "qz_tray");
      if (printerToUse) {
        await updateSettings({ qzPrinterName: printerToUse });
      }

      toast.success(`Connected to USB QZ Tray! ${printers.length} installed printers found.`);
      return true;
    } catch (err: any) {
      console.error("QZ Tray connect error:", err);
      toast.error(err.message || "Failed to connect to QZ Tray");
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Connect / Configure Epson Direct Network (LAN / Wi-Fi) Printer
   */
  const connectEpsonNetwork = async (ip: string, port = 80): Promise<boolean> => {
    const cleanIp = ip.trim();
    if (!cleanIp) {
      toast.warning("Please enter your Epson printer's IP address (e.g. 192.168.1.100)");
      return false;
    }

    setIsConnecting(true);
    try {
      // Test connectivity by sending a test ping to the API route
      const res = await fetch("/api/print-epson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerIp: cleanIp,
          port,
          deviceId: settings.epsonDeviceId || "local_printer",
          isTest: true,
          settings,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not reach Epson printer at " + cleanIp);
      }

      setIsConnected(true);
      setConnectionType("epson_network");
      const name = `Epson ePOS (${cleanIp})`;
      setDeviceName(name);

      localStorage.setItem("pos_thermal_last_device_name", name);
      localStorage.setItem("pos_thermal_last_connection_type", "epson_network");
      await updateSettings({ epsonPrinterIp: cleanIp, epsonPort: port });

      toast.success(`Connected to Epson ePOS Network Printer (${cleanIp})! Test print sent.`);
      return true;
    } catch (err: any) {
      console.warn("Epson network connect warning:", err.message);
      toast.error(
        err.message ||
          "Epson printer connection timed out. If your printer is connected via USB cable, please use 'Pair WebUSB' instead."
      );
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Fetch installed printers list from QZ Tray
   */
  const fetchQZPrinters = async (): Promise<string[]> => {
    try {
      const printers = await qzTray.findPrinters();
      setQzPrintersList(printers);
      return printers;
    } catch (e) {
      return [];
    }
  };

  /**
   * Disconnect Active Printer
   */
  const disconnect = async () => {
    try {
      if (connectionType === "usb" && usbDevice) {
        await usbDevice.close();
      } else if (connectionType === "bluetooth" && bluetoothDevice?.gatt?.connected) {
        bluetoothDevice.gatt.disconnect();
      } else if (connectionType === "qz_tray") {
        qzTray.disconnect();
      }
    } catch (e) {
      console.warn("Error during disconnect:", e);
    } finally {
      setUsbDevice(null);
      setBluetoothDevice(null);
      setBluetoothCharacteristic(null);
      setIsConnected(false);
      setConnectionType(null);
      localStorage.removeItem("pos_thermal_last_connection_type");
      toast.info("Thermal printer disconnected.");
    }
  };

  /**
   * Send Raw ESC/POS byte buffer to the active printer (USB / Bluetooth / QZ Tray)
   */
  const printRawBytes = async (bytes: Uint8Array): Promise<boolean> => {
    if (!isConnected) {
      toast.error("No thermal printer connected. Please select a connection mode in Settings.");
      return false;
    }

    setIsPrinting(true);
    try {
      if (connectionType === "usb" && usbDevice) {
        // Direct WebUSB bulk transfer
        await usbDevice.transferOut(usbEndpointNumber, bytes);
      } else if (connectionType === "bluetooth" && bluetoothCharacteristic) {
        // Chunked Web Bluetooth
        const CHUNK_SIZE = 128;
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const chunk = bytes.slice(i, i + CHUNK_SIZE);
          if (bluetoothCharacteristic.properties.writeWithoutResponse) {
            await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
          } else {
            await bluetoothCharacteristic.writeValue(chunk);
          }
          await new Promise((res) => setTimeout(res, 20));
        }
      } else if (connectionType === "qz_tray") {
        // USB QZ Tray Desktop Service
        const targetPrinter = selectedQZPrinter || settings.qzPrinterName || (qzPrintersList[0] || "");
        if (!targetPrinter) {
          throw new Error("No specific QZ Tray printer selected. Please choose a printer in Settings.");
        }
        await qzTray.printRaw(targetPrinter, bytes);
      }

      toast.success("Receipt printed successfully!");
      return true;
    } catch (err: any) {
      console.error("Print raw bytes error:", err);
      toast.error("Printing failed: " + (err.message || err));
      return false;
    } finally {
      setIsPrinting(false);
    }
  };

  /**
   * Print Formatted Invoice across USB, Bluetooth, QZ Tray, or Epson Direct LAN
   */
  const printInvoice = async (
    invoice: Invoice,
    branchName?: string
  ): Promise<boolean> => {
    if (connectionType === "epson_network") {
      setIsPrinting(true);
      try {
        const ip = settings.epsonPrinterIp || "192.168.1.100";
        const res = await fetch("/api/print-epson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerIp: ip,
            port: settings.epsonPort || 80,
            deviceId: settings.epsonDeviceId || "local_printer",
            invoice,
            settings,
            branchName,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Epson print failed");
        }
        toast.success(`Printed successfully on Epson Printer (${ip})!`);
        return true;
      } catch (err: any) {
        console.error("Epson print invoice error:", err);
        toast.error("Epson printing failed: " + (err.message || err));
        return false;
      } finally {
        setIsPrinting(false);
      }
    }

    const receiptOpts: ReceiptOptions = {
      paperWidth: settings.paperWidth,
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      storeEmail: settings.storeEmail,
      storeGst: settings.storeGst,
      enableGst: settings.enableGst,
      cgstPercent: settings.cgstPercent,
      sgstPercent: settings.sgstPercent,
      footerMessage: settings.footerMessage,
    };

    if (branchName) {
      invoice = { ...invoice, branchName };
    }

    const bytes = generateInvoiceReceiptBytes(invoice, receiptOpts);
    return await printRawBytes(bytes);
  };

  /**
   * Print Test Receipt
   */
  const printTestReceipt = async (): Promise<boolean> => {
    if (connectionType === "epson_network") {
      return await connectEpsonNetwork(settings.epsonPrinterIp || "192.168.1.100", settings.epsonPort || 80);
    }

    const bytes = generateTestReceiptBytes({
      paperWidth: settings.paperWidth,
      storeName: settings.storeName,
      footerMessage: settings.footerMessage,
    });
    return await printRawBytes(bytes);
  };

  return (
    <PrinterContext.Provider
      value={{
        isConnected,
        connectionType,
        deviceName,
        isConnecting,
        isPrinting,
        settings,
        qzPrintersList,
        selectedQZPrinter,
        setSelectedQZPrinter,
        updateSettings,
        connectUSB,
        connectBluetooth,
        connectQZTray,
        connectEpsonNetwork,
        fetchQZPrinters,
        disconnect,
        printInvoice,
        printTestReceipt,
        printRawBytes,
        isWebUsbSupported,
        isWebBluetoothSupported,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
};

export const usePrinter = () => {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return context;
};
