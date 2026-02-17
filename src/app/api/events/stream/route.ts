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
  let controllerRef: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;

      // Send initial connection event
      try {
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", org_id: orgId })}\n\n`)
        );
      } catch {
        return;
      }

      // Poll for events every 2 seconds for up to 30 seconds
      const maxDuration = 30000;
      const pollInterval = 2000;
      const startTime = Date.now();

      const pollForEvents = async () => {
        // Check if we should stop
        if (!isActive || !controllerRef) {
          return;
        }

        // Check if max duration exceeded
        if (Date.now() - startTime > maxDuration) {
          try {
            controllerRef.enqueue(encoder.encode(`: keepalive\n\n`));
            controllerRef.close();
          } catch {
            // Ignore - already closed
          }
          controllerRef = null;
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

          // If table doesn't exist, just keep connection alive without querying
          if (error?.code === '42P01') {
            // Table doesn't exist - silently continue
          } else if (error) {
            console.error("[SSE] Error fetching events:", error.message);
          } else if (events && events.length > 0 && isActive && controllerRef) {
            // Send each event
            for (const event of events) {
              if (!isActive || !controllerRef) break;
              try {
                const sseMessage = `event: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`;
                controllerRef.enqueue(encoder.encode(sseMessage));
                lastEventTime = event.created_at;
              } catch {
                controllerRef = null;
                return;
              }
            }
          }

          // Send periodic keepalive to prevent timeout
          if (isActive && controllerRef && Date.now() - startTime > 10000) {
            try {
              controllerRef.enqueue(encoder.encode(`: keepalive ${new Date().toISOString()}\n\n`));
            } catch {
              controllerRef = null;
              return;
            }
          }

          // Schedule next poll if still active
          if (isActive && controllerRef) {
            setTimeout(pollForEvents, pollInterval);
          }
        } catch (err) {
          console.error("[SSE] Poll error:", err);
          try {
            controllerRef?.close();
          } catch {
            // Ignore
          }
          controllerRef = null;
        }
      };

      // Start polling
      pollForEvents();
    },

    cancel() {
      isActive = false;
      controllerRef = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
