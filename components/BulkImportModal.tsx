"use client";

import { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Package,
  Layers,
  Search,
  Check,
  FileText,
} from "lucide-react";
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  SAMPLE_300_PRODUCTS,
  SampleProductData,
  downloadSampleExcel,
  downloadBlankTemplate,
  parseExcelProducts,
} from "@/lib/sampleProducts";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCategories: { id: string; name: string }[];
  onImportComplete?: () => void;
}

export default function BulkImportModal({
  isOpen,
  onClose,
  existingCategories,
  onImportComplete,
}: BulkImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedProducts, setParsedProducts] = useState<SampleProductData[]>([]);
  const [detectedCategories, setDetectedCategories] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [newCategoriesCreated, setNewCategoriesCreated] = useState<number>(0);
  const [previewSearch, setPreviewSearch] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle file selection and parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processSelectedFile(file);
  };

  const processSelectedFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseErrors([]);
    setImportSuccessCount(null);

    try {
      const buffer = await file.arrayBuffer();
      const { products, categories, errors } = parseExcelProducts(buffer);

      setParsedProducts(products);
      setDetectedCategories(Array.from(categories));
      setParseErrors(errors);
    } catch (err: any) {
      console.error("Excel parse error:", err);
      setParseErrors([`Failed to parse Excel file: ${err.message || "Unknown error"}`]);
    } finally {
      setIsParsing(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Quick direct import of the 300 sample catalog
  const handleDirectImport300 = () => {
    setSelectedFile(null);
    setParsedProducts(SAMPLE_300_PRODUCTS);
    const catSet = new Set(SAMPLE_300_PRODUCTS.map((p) => p.category));
    setDetectedCategories(Array.from(catSet));
    setParseErrors([]);
    setImportSuccessCount(null);
  };

  // Perform Batched Firestore Import
  const handleExecuteImport = async () => {
    if (parsedProducts.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportStatusText("Checking categories...");

    try {
      // 1. Fetch current categories from Firestore to find missing ones
      const existingCategoryNames = new Set(
        existingCategories.map((c) => c.name.toLowerCase().trim())
      );

      // Also query Firestore once to be 100% up-to-date
      try {
        const catSnap = await getDocs(collection(db, "categories"));
        catSnap.forEach((doc) => {
          const data = doc.data();
          if (data?.name) existingCategoryNames.add(data.name.toLowerCase().trim());
        });
      } catch (e) {
        console.warn("Category check warning:", e);
      }

      // Collect categories to create
      const missingCategories: string[] = [];
      detectedCategories.forEach((catName) => {
        if (!existingCategoryNames.has(catName.toLowerCase().trim())) {
          missingCategories.push(catName.trim());
          existingCategoryNames.add(catName.toLowerCase().trim());
        }
      });

      // Write missing categories in batch
      if (missingCategories.length > 0) {
        setImportStatusText(`Creating ${missingCategories.length} new categories...`);
        const catBatch = writeBatch(db);
        missingCategories.forEach((catName) => {
          const newCatRef = doc(collection(db, "categories"));
          catBatch.set(newCatRef, {
            name: catName,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await catBatch.commit();
        setNewCategoriesCreated(missingCategories.length);
      }

      // 2. Batch write products (Firestore limit is 500 ops per batch, so we use chunks of 400)
      const chunkSize = 400;
      const totalProducts = parsedProducts.length;
      let importedCount = 0;

      for (let i = 0; i < totalProducts; i += chunkSize) {
        const chunk = parsedProducts.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const productRef = doc(collection(db, "products"));
          batch.set(productRef, {
            name: item.name,
            category: item.category || "General",
            price: Number(item.price) || 0,
            barcode: item.barcode,
            stock: Number(item.stock) || 0,
            bufferStock: Number(item.bufferStock) || 0,
            status: item.status || "active",
            isFavorite: Boolean(item.isFavorite),
            imageUrl: item.imageUrl || "/logo.png",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        setImportStatusText(
          `Writing products batch (${Math.min(i + chunkSize, totalProducts)} of ${totalProducts})...`
        );

        await batch.commit();
        importedCount += chunk.length;
        setImportProgress(Math.round((importedCount / totalProducts) * 100));
      }

      setImportSuccessCount(importedCount);
      setImportStatusText("Import completed successfully!");
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      console.error("Bulk import failed:", err);
      alert("Bulk import error: " + (err.message || "Failed to write to database"));
    } finally {
      setIsImporting(false);
    }
  };

  // Filter preview items
  const filteredPreview = parsedProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(previewSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(previewSearch.toLowerCase()) ||
      p.barcode.includes(previewSearch)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 md:px-6 md:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Bulk Import Products</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                  Excel & CSV
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Import multiple products in bulk, download sample catalog, or load 300 pre-configured items.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="h-[36px] w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 text-xs scrollbar-thin">
          {/* Top Quick Actions: Download Sample Excel / Template / Quick 300 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Action 1: Download 300 Sample Excel */}
            <div className="bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-[6px] p-3.5 flex flex-col justify-between hover:border-blue-300 transition-all shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>300 Sample Products Excel</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Download a complete spreadsheet with 300 realistic products, barcodes, categories & prices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadSampleExcel()}
                className="mt-3 h-[34px] px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-[5px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample .XLSX (300)</span>
              </button>
            </div>

            {/* Action 2: Download Blank Template */}
            <div className="bg-slate-50 border border-slate-200 rounded-[6px] p-3.5 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Blank Template File</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Clean template with formatted column headers to fill in your store&apos;s custom inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadBlankTemplate()}
                className="mt-3 h-[34px] px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-[5px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download Blank Template</span>
              </button>
            </div>

            {/* Action 3: Quick Direct Load 300 */}
            <div className="bg-linear-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-[6px] p-3.5 flex flex-col justify-between hover:border-amber-300 transition-all shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Direct 1-Click 300 Load</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Instantly load the 300 catalog items directly into the import preview without manual file selection.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDirectImport300}
                className="mt-3 h-[34px] px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-[5px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load 300 Into Preview</span>
              </button>
            </div>
          </div>

          {/* Upload Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Upload Excel (.xlsx, .xls) or CSV File
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-[8px] p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 bg-slate-50/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {selectedFile ? selectedFile.name : "Click to browse or drag & drop file here"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB — Click to change file`
                    : "Supports Microsoft Excel (.xlsx, .xls) and CSV spreadsheet files"}
                </p>
              </div>
            </div>
          </div>

          {/* Parsing State */}
          {isParsing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-[6px] flex items-center justify-center gap-2 text-blue-700">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="font-semibold">Reading spreadsheet rows...</span>
            </div>
          )}

          {/* Parse Errors or Warnings */}
          {parseErrors.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-[6px] space-y-1">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Notice ({parseErrors.length} rows adjusted or skipped):</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-700 space-y-0.5 max-h-24 overflow-y-auto">
                {parseErrors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {parseErrors.length > 10 && <li>...and {parseErrors.length - 10} more rows.</li>}
              </ul>
            </div>
          )}

          {/* Success Box after Import Complete */}
          {importSuccessCount !== null && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-[8px] text-emerald-800 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-emerald-900">
                  Import Successful! {importSuccessCount} Products Added
                </h4>
                <p className="text-xs text-emerald-700">
                  All {importSuccessCount} products have been saved to your Firestore database.
                  {newCategoriesCreated > 0 &&
                    ` Created ${newCategoriesCreated} new product categories.`}
                  {" "}Products without images will display the default system logo (/logo.png).
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-[32px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[5px] text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close & View Products
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {parsedProducts.length > 0 && (
            <div className="border border-slate-200 rounded-[8px] overflow-hidden bg-white shadow-2xs space-y-0">
              {/* Preview Stats Bar */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 text-sm">
                      {parsedProducts.length}
                    </span>
                    <span className="text-slate-500 text-xs">Products to import</span>
                  </div>
                  <div className="h-4 w-px bg-slate-300"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-700 text-xs">
                      {detectedCategories.length}
                    </span>
                    <span className="text-slate-500 text-xs">Categories detected</span>
                  </div>
                  <div className="h-4 w-px bg-slate-300"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-xs">Default Image:</span>
                    <span className="font-mono text-[11px] text-slate-700 font-semibold bg-slate-200 px-1.5 py-0.5 rounded-[3px]">
                      /logo.png
                    </span>
                  </div>
                </div>

                {/* Search preview */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search in preview..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full h-[30px] pl-8 pr-2.5 bg-white border border-slate-200 rounded-[5px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Preview Table */}
              <div className="max-h-72 overflow-y-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 z-5 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Barcode ID</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-center">Stock</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreview.slice(0, 100).map((prod, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-[4px] bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                              <img
                                src={prod.imageUrl || "/logo.png"}
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/logo.png";
                                }}
                              />
                            </div>
                            <span className="font-semibold text-slate-800 truncate max-w-xs">
                              {prod.name}
                            </span>
                            {prod.isFavorite && (
                              <span className="text-amber-500 text-[11px]">★</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                            {prod.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                          {prod.barcode}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          ₹{Number(prod.price).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-700 font-semibold">
                          {prod.stock}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-[3px] text-[10px] font-semibold border ${
                              prod.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {prod.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredPreview.length > 100 && (
                <div className="p-2 bg-slate-50 text-center text-slate-500 text-[11px] border-t border-slate-200">
                  Showing first 100 of {filteredPreview.length} items. All {parsedProducts.length} items will be imported.
                </div>
              )}
            </div>
          )}

          {/* Progress Bar during Import */}
          {isImporting && (
            <div className="space-y-2 bg-blue-50 border border-blue-200 p-4 rounded-[6px]">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  {importStatusText}
                </span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-200 rounded-full"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {parsedProducts.length > 0 ? (
              <span>Ready to write <strong>{parsedProducts.length} products</strong> to Firestore</span>
            ) : (
              <span>Upload an Excel/CSV file or select 300 Sample Products</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="h-[36px] px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting || parsedProducts.length === 0}
              className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Import {parsedProducts.length > 0 ? `(${parsedProducts.length} Items)` : "Products"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
