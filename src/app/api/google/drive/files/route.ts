import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { driveService } from "@/lib/google";

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get org
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgId = memberships?.[0]?.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  if (!driveService.isAvailable()) {
    return NextResponse.json(
      { error: "Google Drive integration not available" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const clientName = searchParams.get("client");

  try {
    if (clientName) {
      // List files for a specific client
      const files = await driveService.listClientFiles(clientName);
      return NextResponse.json({ files });
    }

    // List all files in root
    const folders = await driveService.ensureRootFolders();
    if (!folders) {
      return NextResponse.json({ files: [] });
    }

    const result = await driveService.listFiles(folders.clientsId);
    return NextResponse.json({ files: result.files });
  } catch (error: any) {
    console.error("Failed to list files:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list files" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get org
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgId = memberships?.[0]?.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  if (!driveService.isAvailable()) {
    return NextResponse.json(
      { error: "Google Drive integration not available" },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const clientName = formData.get("clientName") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!clientName) {
      return NextResponse.json({ error: "Client name required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await driveService.uploadToClientFolder(
      clientName,
      file.name,
      file.type,
      buffer
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      webViewLink: result.webViewLink,
    });
  } catch (error: any) {
    console.error("File upload failed:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
