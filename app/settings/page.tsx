import SettingsPageClient from "@/components/SettingsPageClient";

export const metadata = {
  title: "Printer & System Settings - Natural Fresh",
  description: "Configure WebUSB and Web Bluetooth thermal printers, paper roll size, and store receipt details",
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
