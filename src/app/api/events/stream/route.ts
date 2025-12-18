import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE endpoint for real-time updates
// Clients connect and receive events as they happen
export async function GET(req: NextRequest) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return new Response("Unauthorized", { status: 401 });
  }
  const orgId = guard.orgId!;

  // Get optional filters from query params
  const searchParams = req.nextUrl.searchParams;
  const invoiceId = searchParams.get("invoice_id");
  const clientId = searchParams.get("client_id");

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let lastEventTime = new Date().toISOString();
  let isActive = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", org_id: orgId })}\n\n`)
      );

      // Poll for events every 2 seconds for up to 30 seconds
      // After 30 seconds, close connection (client will reconnect)
      const maxDuration = 30000;
      const pollInterval = 2000;
      const startTime = Date.now();

      const pollForEvents = async () => {
        if (!isActive || Date.now() - startTime > maxDuration) {
          // Send keepalive before closing
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
          controller.close();
          return;
        }

        try {
          const supabase = await supabaseServer();

          // Query for new events since last check
          let query = supabase
            .from("realtime_events")
            .select("*")
            .eq("org_id", orgId)
            .gt("created_at", lastEventTime)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: true });

          // Apply optional filters
          if (invoiceId) {
            query = query.eq("invoice_id", invoiceId);
          }
          if (clientId) {
            query = query.eq("client_id", clientId);
          }

          const { data: events, error } = await query;

          if (error) {
            console.error("[SSE] Error fetching events:", error);
          } else if (events && events.length > 0) {
            // Send each event
            for (const event of events) {
              const sseMessage = `event: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(sseMessage));
              lastEventTime = event.created_at;
            }
          }

          // Send periodic keepalive to prevent timeout
          if (Date.now() - startTime > 10000) {
            controller.enqueue(encoder.encode(`: keepalive ${new Date().toISOString()}\n\n`));
          }

          // Schedule next poll
          setTimeout(pollForEvents, pollInterval);
        } catch (err) {
          console.error("[SSE] Poll error:", err);
          controller.close();
        }
      };

      // Start polling
      pollForEvents();
    },

    cancel() {
      isActive = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering for nginx
    },
  });
}
