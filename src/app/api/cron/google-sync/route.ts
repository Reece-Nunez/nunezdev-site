import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncEngine, googleServiceFactory } from "@/lib/google";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if Google services are available
  if (!googleServiceFactory.isAvailable()) {
    return NextResponse.json({
      success: false,
      message: "Google Workspace integration not configured",
    });
  }

  try {
    // Get all organizations that need syncing
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id");

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    const results = {
      success: true,
      synced: 0,
      errors: [] as string[],
      details: [] as Array<{
        orgId: string;
        contacts: { created: number; updated: number; errors: number };
      }>,
    };

    // Sync each organization
    for (const org of orgs || []) {
      try {
        // Sync contacts
        const contactsResult = await syncEngine.syncContacts({
          orgId: org.id,
          fullSync: false,
          conflictResolution: "newest_wins",
        });

        results.details.push({
          orgId: org.id,
          contacts: {
            created: contactsResult.created,
            updated: contactsResult.updated,
            errors: contactsResult.errors.length,
          },
        });

        if (contactsResult.errors.length > 0) {
          results.errors.push(...contactsResult.errors.map(e => `[${org.id}] ${e}`));
        }

        results.synced++;

        // Emit sync event
        await syncEngine.emitSyncEvent(org.id, "contact_synced", {
          source: "cron",
          created: contactsResult.created,
          updated: contactsResult.updated,
        });
      } catch (error: any) {
        results.errors.push(`[${org.id}] ${error.message}`);
      }
    }

    console.log(`Google sync completed: ${results.synced} orgs synced, ${results.errors.length} errors`);

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Google sync cron failed:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: Request) {
  return GET(req);
}
