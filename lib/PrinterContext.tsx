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
import { useToast } from "@/components/ToastProvider";

import { db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export type PrinterConnectionType = "usb" | "bluetooth" | null;

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
}

interface PrinterContextType {
  isConnected: boolean;
  connectionType: PrinterConnectionType;
  deviceName: string | null;
  isConnecting: boolean;
  isPrinting: boolean;
  settings: PrinterSettings;
  updateSettings: (newSettings: Partial<PrinterSettings>) => Promise<void>;
  connectUSB: () => Promise<boolean>;
  connectBluetooth: () => Promise<boolean>;
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
        setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
      const savedDevice = localStorage.getItem("pos_thermal_last_device_name");
      const savedType = localStorage.getItem("pos_thermal_last_connection_type");
      if (savedDevice && savedType) {
        setDeviceName(savedDevice);
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
      // Prompt user to pick USB printer
      const nav: any = navigator;
      const device = await nav.usb.requestDevice({
        filters: [], // Allow user to select any USB device
      });

      if (!device) {
        setIsConnecting(false);
        return false;
      }

      await device.open();

      // Select configuration 1 if needed
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Find printer interface or interface 0
      let chosenInterface = 0;
      let endpointNum = 1;

      if (device.configuration && device.configuration.interfaces) {
        for (const iface of device.configuration.interfaces) {
          for (const alt of iface.alternates) {
            // Find OUT endpoint for writing data
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
      // Request Bluetooth device with all standard thermal printer services
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

      // Discover primary services and find a writable characteristic
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
        throw new Error(
          "Could not find a writable data channel on this Bluetooth printer."
        );
      }

      setBluetoothDevice(device);
      setBluetoothCharacteristic(writeChar);
      setIsConnected(true);
      setConnectionType("bluetooth");
      const name = device.name || "Bluetooth Thermal Printer";
      setDeviceName(name);

      localStorage.setItem("pos_thermal_last_device_name", name);
      localStorage.setItem("pos_thermal_last_connection_type", "bluetooth");

      // Handle disconnect event
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
   * Disconnect Active Printer
   */
  const disconnect = async () => {
    try {
      if (connectionType === "usb" && usbDevice) {
        await usbDevice.close();
      } else if (connectionType === "bluetooth" && bluetoothDevice?.gatt?.connected) {
        bluetoothDevice.gatt.disconnect();
      }
    } catch (e) {
      console.warn("Error during disconnect:", e);
    } finally {
      setUsbDevice(null);
      setBluetoothDevice(null);
      setBluetoothCharacteristic(null);
      setIsConnected(false);
      setConnectionType(null);
      toast.info("Thermal printer disconnected.");
    }
  };

  /**
   * Send Raw ESC/POS byte buffer to the active printer (chunked for Bluetooth)
   */
  const printRawBytes = async (bytes: Uint8Array): Promise<boolean> => {
    if (!isConnected) {
      toast.error("No thermal printer connected. Please connect via USB or Bluetooth in Settings.");
      return false;
    }

    setIsPrinting(true);
    try {
      if (connectionType === "usb" && usbDevice) {
        // Send USB Bulk Transfer
        await usbDevice.transferOut(usbEndpointNumber, bytes);
      } else if (connectionType === "bluetooth" && bluetoothCharacteristic) {
        // Send chunked Bluetooth data (chunks of 128 bytes with short delay to avoid buffer overflow)
        const CHUNK_SIZE = 128;
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const chunk = bytes.slice(i, i + CHUNK_SIZE);
          if (bluetoothCharacteristic.properties.writeWithoutResponse) {
            await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
          } else {
            await bluetoothCharacteristic.writeValue(chunk);
          }
          // Small delay for printer buffer
          await new Promise((res) => setTimeout(res, 20));
        }
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
   * Print Formatted Invoice
   */
  const printInvoice = async (
    invoice: Invoice,
    branchName?: string
  ): Promise<boolean> => {
    const receiptOpts: ReceiptOptions = {
      paperWidth: settings.paperWidth,
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      storeGst: settings.storeGst,
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
    const bytes = generateTestReceiptBytes({
      paperWidth: settings.paperWidth,
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
        updateSettings,
        connectUSB,
        connectBluetooth,
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
