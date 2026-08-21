import { NextRequest, NextResponse } from "next/server";
import imagekit from "@/lib/imagekit";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customFileName = (formData.get("fileName") as string) || `product_${Date.now()}`;
    const folder = (formData.get("folder") as string) || "/retailnext_products";

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: customFileName.replace(/[^a-zA-Z0-9._-]/g, "_"),
      folder: folder,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      success: true,
      url: uploadResponse.url,
      fileId: uploadResponse.fileId,
      name: uploadResponse.name,
      thumbnailUrl: uploadResponse.thumbnailUrl,
    });
  } catch (error: any) {
    console.error("ImageKit upload error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to upload image to ImageKit",
      },
      { status: 500 }
    );
  }
}
