import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientNotification, sendBusinessNotification, createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint should be called by a cron job daily
export async function POST(req: Request) {
  try {
    // Verify this is being called by a legitimate cron job
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`[cron] Running payment reminders check for ${todayStr}`);

    // Get all payment plan installments that need attention
    const { data: installments, error } = await supabase
      .from('invoice_payment_plans')
      .select(`
        id,
        invoice_id,
        installment_label,
        amount_cents,
        due_date,
        grace_period_days,
        status,
        stripe_payment_link_url,
        invoices!inner(
          invoice_number,
          client_id,
          org_id,
          clients!inner(name, email, phone)
        )
      `)
      .eq('status', 'pending')
      .not('due_date', 'is', null);

    if (error) {
      console.error('[cron] Error fetching installments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!installments || installments.length === 0) {
      console.log('[cron] No pending installments found');
      return NextResponse.json({ message: "No pending installments" });
    }

    let dueTodayCount = 0;
    let overdueCount = 0;

    for (const installment of installments) {
      const dueDate = new Date(installment.due_date);
      const gracePeriodEnd = new Date(dueDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + (installment.grace_period_days || 0));
      
      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const isOverdue = today > gracePeriodEnd;
      const isDueToday = dueDate.toISOString().split('T')[0] === todayStr;

      const invoice = installment.invoices;
      const client = (invoice as any).clients;

      // Send payment due reminder (on due date)
      if (isDueToday) {
        await sendClientNotification('payment_due', {
          invoice_id: installment.invoice_id,
          invoice_number: (invoice as any).invoice_number,
          client_name: client.name,
          client_email: client.email,
          installment_id: installment.id,
          installment_label: installment.installment_label,
          amount_cents: installment.amount_cents,
          due_date: installment.due_date,
          payment_link_url: installment.stripe_payment_link_url || '',
          grace_period_days: installment.grace_period_days
        });

        dueTodayCount++;
        console.log(`[cron] Sent due payment reminder for installment ${installment.id}`);
      }

      // Send overdue notification (first day after grace period)
      if (isOverdue && daysDiff === (installment.grace_period_days || 0) + 1) {
        await sendClientNotification('payment_overdue', {
          invoice_id: installment.invoice_id,
          invoice_number: (invoice as any).invoice_number,
          client_name: client.name,
          client_email: client.email,
          installment_id: installment.id,
          installment_label: installment.installment_label,
          amount_cents: installment.amount_cents,
          due_date: installment.due_date,
          payment_link_url: installment.stripe_payment_link_url || '',
          days_overdue: daysDiff - (installment.grace_period_days || 0)
        });

        // Also notify business owner
        await sendBusinessNotification('payment_overdue', {
          invoice_id: installment.invoice_id,
          client_name: client.name,
          invoice_number: (invoice as any).invoice_number,
          amount_cents: installment.amount_cents,
          installment_label: installment.installment_label
        });

        // Create in-app notification
        const invoiceOrgId = (invoice as any).org_id;
        if (invoiceOrgId) {
          createNotification({
            orgId: invoiceOrgId,
            type: 'payment_overdue',
            title: `Payment overdue - ${client.name}`,
            body: `${(invoice as any).invoice_number} - ${installment.installment_label} - $${(installment.amount_cents / 100).toFixed(2)}`,
            link: `/dashboard/invoices/${installment.invoice_id}`,
          }).catch(err => console.error('[cron] In-app notification error:', err));
        }

        // Update installment status to overdue
        await supabase
          .from('invoice_payment_plans')
          .update({ status: 'overdue' })
          .eq('id', installment.id);

        overdueCount++;
        console.log(`[cron] Sent overdue notification for installment ${installment.id}`);
      }

      // Send weekly overdue reminders (every 7 days after initial overdue)
      if (isOverdue && daysDiff > (installment.grace_period_days || 0) + 1) {
        const daysOverdue = daysDiff - (installment.grace_period_days || 0);
        
        // Send weekly reminders (day 7, 14, 21, etc.)
        if (daysOverdue % 7 === 0) {
          await sendClientNotification('payment_overdue', {
            invoice_id: installment.invoice_id,
            invoice_number: (invoice as any).invoice_number,
            client_name: client.name,
            client_email: client.email,
            installment_id: installment.id,
            installment_label: installment.installment_label,
            amount_cents: installment.amount_cents,
            due_date: installment.due_date,
            payment_link_url: installment.stripe_payment_link_url || '',
            days_overdue: daysOverdue
          });

          console.log(`[cron] Sent weekly overdue reminder (${daysOverdue} days) for installment ${installment.id}`);
        }
      }
    }

    const summary = {
      date: todayStr,
      total_installments_checked: installments.length,
      due_today_notifications: dueTodayCount,
      overdue_notifications: overdueCount,
      message: `Processed ${installments.length} installments, sent ${dueTodayCount} due notifications and ${overdueCount} overdue notifications`
    };

    console.log('[cron] Payment reminders complete:', summary);
    return NextResponse.json(summary);

  } catch (error) {
    console.error('[cron] Payment reminders error:', error);
    return NextResponse.json({ 
      error: "Cron job failed", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET endpoint for manual testing
export async function GET() {
  return NextResponse.json({
    message: "Payment reminders cron job endpoint",
    usage: "POST with authorization header to run payment reminders"
  });
}