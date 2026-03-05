-- ============================================================================
-- DEMO ACCOUNT SEED SCRIPT
-- Creates a full demo account with realistic freelance web dev business data
-- Login: demo@nunez.dev / demo1234
-- ============================================================================

-- Step 1: Create the demo user in auth.users
-- NOTE: You must create the user via Supabase Dashboard or CLI first:
--   Email: demo@nunez.dev  |  Password: demo1234
-- Then grab the user UUID and replace the placeholder below.

-- After creating the user in Supabase Auth, paste the UUID here:
DO $$
DECLARE
  demo_user_id UUID := '3f0097fd-2d96-40b5-b4f7-c791edea5c89';
BEGIN
  INSERT INTO organizations (id, name)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'NunezDev Demo Agency')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES ('a0000000-0000-0000-0000-000000000001', demo_user_id, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;
END $$;

-- ============================================================================
-- Clients (8 realistic clients across all statuses)
-- ============================================================================
INSERT INTO clients (id, org_id, name, email, phone, company, status, tags, created_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Marcus Rivera', 'marcus@riveraproperty.com', '(512) 555-0142', 'Rivera Property Group',
   'Active', ARRAY['web-design','seo','priority'],
   NOW() - INTERVAL '8 months'),

  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Sarah Chen', 'sarah@bloomwellness.co', '(737) 555-0287', 'Bloom Wellness Studio',
   'Active', ARRAY['web-design','e-commerce','maintenance'],
   NOW() - INTERVAL '6 months'),

  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'James Thornton', 'james@thorntonlaw.com', '(210) 555-0391', 'Thornton & Associates Law',
   'Active', ARRAY['web-design','hosting','retainer'],
   NOW() - INTERVAL '11 months'),

  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Daniela Ortiz', 'daniela@casaortiz.com', '(512) 555-0564', 'Casa Ortiz Catering',
   'Prospect', ARRAY['web-design','photography'],
   NOW() - INTERVAL '2 weeks'),

  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Kevin Park', 'kevin@parkfitness.io', '(832) 555-0718', 'Park Fitness',
   'Lead', ARRAY['web-app','booking-system'],
   NOW() - INTERVAL '3 days'),

  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'Amanda Foster', 'amanda@fosterinteriors.com', '(469) 555-0823', 'Foster Interiors',
   'Past', ARRAY['web-design','portfolio'],
   NOW() - INTERVAL '14 months'),

  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'Roberto Garza', 'roberto@garzaauto.com', '(956) 555-0945', 'Garza Auto Repair',
   'Active', ARRAY['web-design','google-ads','seo'],
   NOW() - INTERVAL '4 months'),

  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'Lisa Nakamura', 'lisa@nakamuraphoto.com', '(512) 555-1067', 'Nakamura Photography',
   'Prospect', ARRAY['portfolio','web-design','gallery'],
   NOW() - INTERVAL '1 week')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Invoices (mix of paid, sent, overdue, draft)
-- ============================================================================
INSERT INTO invoices (id, org_id, client_id, invoice_number, title, status, amount_cents, total_paid_cents, line_items, issued_at, due_at, paid_at, created_at) VALUES
  -- Rivera Property: paid website build
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'INV-2025-001', 'Website Redesign - Rivera Property',
   'paid', 750000, 750000,
   '[{"description":"Custom WordPress to Next.js migration","quantity":1,"unit_price_cents":450000},{"description":"SEO audit & implementation","quantity":1,"unit_price_cents":150000},{"description":"Responsive design & testing","quantity":1,"unit_price_cents":150000}]'::jsonb,
   NOW() - INTERVAL '7 months', NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months' + INTERVAL '5 days',
   NOW() - INTERVAL '7 months'),

  -- Rivera Property: monthly retainer (paid)
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'INV-2025-008', 'Monthly Maintenance - Feb 2026',
   'paid', 50000, 50000,
   '[{"description":"Monthly hosting & maintenance","quantity":1,"unit_price_cents":50000}]'::jsonb,
   NOW() - INTERVAL '1 month', NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days',
   NOW() - INTERVAL '1 month'),

  -- Bloom Wellness: e-commerce site (paid)
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002', 'INV-2025-002', 'E-Commerce Website - Bloom Wellness',
   'paid', 1200000, 1200000,
   '[{"description":"Shopify custom theme development","quantity":1,"unit_price_cents":650000},{"description":"Product photography integration","quantity":1,"unit_price_cents":200000},{"description":"Payment gateway setup (Stripe)","quantity":1,"unit_price_cents":150000},{"description":"Inventory management system","quantity":1,"unit_price_cents":200000}]'::jsonb,
   NOW() - INTERVAL '5 months', NOW() - INTERVAL '4 months', NOW() - INTERVAL '4 months' + INTERVAL '3 days',
   NOW() - INTERVAL '5 months'),

  -- Bloom Wellness: monthly retainer (sent, not yet paid)
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002', 'INV-2026-003', 'Monthly Maintenance - Mar 2026',
   'sent', 75000, 0,
   '[{"description":"E-commerce hosting & maintenance","quantity":1,"unit_price_cents":75000}]'::jsonb,
   NOW() - INTERVAL '3 days', NOW() + INTERVAL '27 days', NULL,
   NOW() - INTERVAL '3 days'),

  -- Thornton Law: website build (paid)
  ('10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003', 'INV-2025-003', 'Law Firm Website - Thornton & Associates',
   'paid', 850000, 850000,
   '[{"description":"Professional law firm website design","quantity":1,"unit_price_cents":500000},{"description":"Attorney profile pages","quantity":5,"unit_price_cents":50000},{"description":"Blog/resources section","quantity":1,"unit_price_cents":100000}]'::jsonb,
   NOW() - INTERVAL '10 months', NOW() - INTERVAL '9 months', NOW() - INTERVAL '9 months' + INTERVAL '7 days',
   NOW() - INTERVAL '10 months'),

  -- Thornton Law: SEO retainer (overdue)
  ('10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003', 'INV-2026-001', 'SEO Monthly Retainer - Jan 2026',
   'overdue', 100000, 0,
   '[{"description":"Monthly SEO optimization & reporting","quantity":1,"unit_price_cents":100000}]'::jsonb,
   NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 month', NULL,
   NOW() - INTERVAL '2 months'),

  -- Garza Auto: website (partially paid)
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000007', 'INV-2025-006', 'Business Website - Garza Auto',
   'partially_paid', 450000, 225000,
   '[{"description":"Business website with appointment booking","quantity":1,"unit_price_cents":300000},{"description":"Google Business Profile optimization","quantity":1,"unit_price_cents":75000},{"description":"Google Ads landing page","quantity":1,"unit_price_cents":75000}]'::jsonb,
   NOW() - INTERVAL '3 months', NOW() - INTERVAL '2 months', NULL,
   NOW() - INTERVAL '3 months'),

  -- Foster Interiors: final invoice (paid, past client)
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000006', 'INV-2024-012', 'Portfolio Website - Foster Interiors',
   'paid', 550000, 550000,
   '[{"description":"Portfolio website with gallery","quantity":1,"unit_price_cents":400000},{"description":"Contact form & lead capture","quantity":1,"unit_price_cents":75000},{"description":"Mobile optimization","quantity":1,"unit_price_cents":75000}]'::jsonb,
   NOW() - INTERVAL '13 months', NOW() - INTERVAL '12 months', NOW() - INTERVAL '12 months' + INTERVAL '2 days',
   NOW() - INTERVAL '13 months'),

  -- Ortiz Catering: proposal converted to draft invoice
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000004', 'INV-2026-004', 'Catering Website - Casa Ortiz',
   'draft', 600000, 0,
   '[{"description":"Restaurant/catering website design","quantity":1,"unit_price_cents":350000},{"description":"Online menu with ordering","quantity":1,"unit_price_cents":150000},{"description":"Catering event inquiry form","quantity":1,"unit_price_cents":100000}]'::jsonb,
   NULL, NULL, NULL,
   NOW() - INTERVAL '5 days'),

  -- Garza Auto: monthly maintenance (paid)
  ('10000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000007', 'INV-2026-002', 'Monthly Maintenance - Feb 2026',
   'paid', 50000, 50000,
   '[{"description":"Website hosting & maintenance","quantity":1,"unit_price_cents":50000}]'::jsonb,
   NOW() - INTERVAL '1 month', NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days',
   NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Invoice Payments
-- ============================================================================
INSERT INTO invoice_payments (id, invoice_id, amount_cents, payment_method, paid_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 750000, 'card', NOW() - INTERVAL '6 months' + INTERVAL '5 days'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 50000, 'card', NOW() - INTERVAL '12 days'),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 1200000, 'card', NOW() - INTERVAL '4 months' + INTERVAL '3 days'),
  ('b0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', 850000, 'bank_transfer', NOW() - INTERVAL '9 months' + INTERVAL '7 days'),
  -- Garza Auto partial payment (50% deposit)
  ('b0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000007', 225000, 'card', NOW() - INTERVAL '2 months' + INTERVAL '5 days'),
  ('b0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008', 550000, 'card', NOW() - INTERVAL '12 months' + INTERVAL '2 days'),
  ('b0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000010', 50000, 'card', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Payment Plans (Garza Auto: 50/50 split)
-- ============================================================================
DELETE FROM invoice_payment_plans WHERE invoice_id = '10000000-0000-0000-0000-000000000007';
INSERT INTO invoice_payment_plans (id, invoice_id, plan_type, installment_number, installment_label, amount_cents, due_date, status, paid_at) VALUES
  ('bb000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '50_50', 1, 'First Payment (50%)', 225000,
   (NOW() - INTERVAL '2 months')::date, 'paid', NOW() - INTERVAL '2 months' + INTERVAL '5 days'),
  ('bb000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', '50_50', 2, 'Final Payment (50%)', 225000,
   (NOW() + INTERVAL '2 weeks')::date, 'pending', NULL);

-- ============================================================================
-- Recurring Invoices (active retainers)
-- ============================================================================
INSERT INTO recurring_invoices (id, org_id, client_id, title, line_items, amount_cents, frequency, start_date, next_invoice_date, status, total_invoices_sent, payment_terms) VALUES
  ('21000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'Monthly Hosting & Maintenance - Rivera Property',
   '[{"description":"Website hosting, SSL, backups & maintenance","quantity":1,"unit_price_cents":50000}]'::jsonb,
   50000, 'monthly', (NOW() - INTERVAL '6 months')::date, (NOW() + INTERVAL '27 days')::date,
   'active', 6, 15),

  ('21000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002', 'Monthly E-Commerce Hosting - Bloom Wellness',
   '[{"description":"E-commerce hosting, SSL, backups & maintenance","quantity":1,"unit_price_cents":75000}]'::jsonb,
   75000, 'monthly', (NOW() - INTERVAL '4 months')::date, (NOW() + INTERVAL '27 days')::date,
   'active', 4, 15),

  ('21000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003', 'Monthly SEO Retainer - Thornton Law',
   '[{"description":"SEO optimization, reporting & content updates","quantity":1,"unit_price_cents":100000}]'::jsonb,
   100000, 'monthly', (NOW() - INTERVAL '9 months')::date, (NOW() + INTERVAL '27 days')::date,
   'active', 9, 30)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Proposals
-- ============================================================================
INSERT INTO proposals (id, org_id, client_id, proposal_number, title, description, line_items, subtotal_cents, amount_cents, status, created_at, valid_until, sent_at, viewed_at, project_overview, technology_stack, payment_terms) VALUES
  -- Accepted proposal for Ortiz
  ('b2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000004', 'PROP-2026-001', 'Catering Website & Online Ordering',
   'Full-service website with online menu and catering inquiry system.',
   '[{"description":"Custom website design & development","quantity":1,"unit_price_cents":350000},{"description":"Online menu with daily specials","quantity":1,"unit_price_cents":150000},{"description":"Catering event inquiry & booking form","quantity":1,"unit_price_cents":100000}]'::jsonb,
   600000, 600000, 'accepted',
   NOW() - INTERVAL '10 days', (NOW() + INTERVAL '20 days')::date,
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days',
   'A modern, mobile-first website for Casa Ortiz Catering featuring an interactive menu, online ordering capabilities, and a catering event inquiry system.',
   'Next.js, Tailwind CSS, Supabase, Stripe',
   'Net 30'),

  -- Sent proposal for Park Fitness
  ('b2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000005', 'PROP-2026-002', 'Fitness Booking Web App',
   'Custom web application with class scheduling and membership management.',
   '[{"description":"Web app design & development","quantity":1,"unit_price_cents":800000},{"description":"Class booking & scheduling system","quantity":1,"unit_price_cents":300000},{"description":"Membership portal & payment integration","quantity":1,"unit_price_cents":250000},{"description":"Mobile-responsive PWA optimization","quantity":1,"unit_price_cents":150000}]'::jsonb,
   1500000, 1500000, 'sent',
   NOW() - INTERVAL '2 days', (NOW() + INTERVAL '28 days')::date,
   NOW() - INTERVAL '1 day', NULL,
   'A comprehensive fitness booking platform enabling class scheduling, trainer management, membership tracking, and integrated payment processing.',
   'Next.js, React, Supabase, Stripe, Tailwind CSS',
   '40/30/30 payment plan'),

  -- Sent proposal for Nakamura
  ('b2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000008', 'PROP-2026-003', 'Photography Portfolio & Client Gallery',
   'Portfolio website with password-protected client galleries and print ordering.',
   '[{"description":"Portfolio website design","quantity":1,"unit_price_cents":400000},{"description":"Client gallery system with password protection","quantity":1,"unit_price_cents":200000},{"description":"Print ordering integration","quantity":1,"unit_price_cents":150000}]'::jsonb,
   750000, 750000, 'viewed',
   NOW() - INTERVAL '5 days', (NOW() + INTERVAL '25 days')::date,
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days',
   'An elegant photography portfolio showcasing work across weddings, portraits, and commercial shoots, with secure client galleries for proofing and print ordering.',
   'Next.js, Cloudinary, Supabase, Stripe',
   'Net 30')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Appointments (past and upcoming)
-- ============================================================================
INSERT INTO appointments (id, meeting_type, scheduled_date, scheduled_time, duration_minutes, client_name, client_email, client_phone, company_name, meeting_platform, project_details, status, meeting_notes) VALUES
  -- Completed appointments
  ('ab000000-0000-0000-0000-000000000001', 'discovery-call',
   (NOW() - INTERVAL '2 weeks')::date, '10:00', 30,
   'Daniela Ortiz', 'daniela@casaortiz.com', '(512) 555-0564', 'Casa Ortiz Catering',
   'zoom', 'Interested in a website with online menu and catering booking.', 'completed',
   'Great call. Daniela wants a modern site to showcase her catering menu and accept event inquiries online. Sent proposal PROP-2026-001.'),

  ('ab000000-0000-0000-0000-000000000002', 'project-planning',
   (NOW() - INTERVAL '1 week')::date, '14:00', 60,
   'Daniela Ortiz', 'daniela@casaortiz.com', '(512) 555-0564', 'Casa Ortiz Catering',
   'zoom', 'Project kickoff after accepted proposal.', 'completed',
   'Reviewed scope, timeline, and deliverables. Starting with design mockups next week.'),

  ('ab000000-0000-0000-0000-000000000003', 'discovery-call',
   (NOW() - INTERVAL '3 days')::date, '11:00', 30,
   'Kevin Park', 'kevin@parkfitness.io', '(832) 555-0718', 'Park Fitness',
   'google-meet', 'Looking for a booking system for fitness classes.', 'completed',
   'Kevin runs 3 fitness studios. Needs class booking, membership management, and payment processing. Sent proposal.'),

  -- Upcoming appointments
  ('ab000000-0000-0000-0000-000000000004', 'technical-review',
   (NOW() + INTERVAL '2 days')::date, '15:00', 45,
   'Marcus Rivera', 'marcus@riveraproperty.com', '(512) 555-0142', 'Rivera Property Group',
   'zoom', 'Quarterly website performance review.', 'confirmed', NULL),

  ('ab000000-0000-0000-0000-000000000005', 'discovery-call',
   (NOW() + INTERVAL '4 days')::date, '10:30', 30,
   'Lisa Nakamura', 'lisa@nakamuraphoto.com', '(512) 555-1067', 'Nakamura Photography',
   'zoom', 'Follow up on proposal for portfolio site.', 'scheduled', NULL),

  ('ab000000-0000-0000-0000-000000000006', 'strategy-session',
   (NOW() + INTERVAL '1 week')::date, '13:00', 60,
   'Sarah Chen', 'sarah@bloomwellness.co', '(737) 555-0287', 'Bloom Wellness Studio',
   'google-meet', 'Q2 marketing strategy and website updates.', 'scheduled', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Notes (client notes)
-- ============================================================================
INSERT INTO notes (id, org_id, relates_to, relates_id, body, created_at) VALUES
  ('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000001',
   'Marcus is very happy with the site redesign. Seeing 40% more leads since launch. Interested in adding a virtual tour feature for property listings.',
   NOW() - INTERVAL '2 months'),

  ('40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000002',
   'Bloom Wellness e-commerce launched successfully. First month: $12K in online sales. Sarah wants to add a subscription box feature in Q2.',
   NOW() - INTERVAL '3 months'),

  ('40000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000003',
   'James mentioned the firm is expanding to San Antonio. Will need a location-specific landing page for the new office.',
   NOW() - INTERVAL '3 weeks'),

  ('40000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000007',
   'Roberto''s Google Ads campaign generating ~50 calls/month. ROI is strong. Wants to explore adding online appointment scheduling.',
   NOW() - INTERVAL '2 weeks'),

  ('40000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000004',
   'Daniela accepted the proposal! She wants to feature seasonal menus and a photo gallery of past events. Starting design phase this week.',
   NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Tasks
-- ============================================================================
INSERT INTO tasks (id, org_id, relates_to, relates_id, title, due_at, done, created_at) VALUES
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000004',
   'Design homepage mockup for Casa Ortiz', NOW() + INTERVAL '5 days', false, NOW() - INTERVAL '3 days'),

  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000004',
   'Gather menu content and food photography', NOW() + INTERVAL '1 week', false, NOW() - INTERVAL '3 days'),

  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000001',
   'Add virtual tour feature to property listings', NOW() + INTERVAL '2 weeks', false, NOW() - INTERVAL '1 week'),

  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000003',
   'Create San Antonio landing page for Thornton Law', NOW() + INTERVAL '3 weeks', false, NOW() - INTERVAL '2 weeks'),

  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000002',
   'Research subscription box plugins for Bloom Wellness', NOW() + INTERVAL '10 days', false, NOW() - INTERVAL '1 week'),

  -- Completed tasks
  ('50000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000007',
   'Set up Google Ads campaign for Garza Auto', NOW() - INTERVAL '2 months', true, NOW() - INTERVAL '3 months'),

  ('50000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000001',
   'Migrate Rivera Property from WordPress to Next.js', NOW() - INTERVAL '6 months', true, NOW() - INTERVAL '8 months'),

  ('50000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'client', 'c0000000-0000-0000-0000-000000000003',
   'Follow up on overdue SEO retainer invoice', NOW() + INTERVAL '2 days', false, NOW() - INTERVAL '1 week')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Expenses
-- ============================================================================
INSERT INTO expenses (id, org_id, description, amount_cents, expense_date, category, client_id, is_billable, is_tax_deductible, tax_category, payment_method, vendor, notes) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Vercel Pro Plan', 2000, (NOW() - INTERVAL '1 month')::date,
   'hosting', NULL, false, true, 'business_expense', 'card', 'Vercel', 'Monthly hosting for all client sites'),

  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Figma Professional', 1500, (NOW() - INTERVAL '1 month')::date,
   'software', NULL, false, true, 'business_expense', 'card', 'Figma', 'Design tool subscription'),

  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Supabase Pro Plan', 2500, (NOW() - INTERVAL '1 month')::date,
   'software', NULL, false, true, 'business_expense', 'card', 'Supabase', 'Database hosting'),

  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Stock photos for Rivera Property', 4900, (NOW() - INTERVAL '3 months')::date,
   'marketing', 'c0000000-0000-0000-0000-000000000001', true, true, 'business_expense', 'card', 'Shutterstock', 'Property listing hero images'),

  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Google Workspace Business', 1200, (NOW() - INTERVAL '1 month')::date,
   'software', NULL, false, true, 'business_expense', 'card', 'Google', 'Email & workspace tools'),

  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'Domain renewal - riveraproperty.com', 1499, (NOW() - INTERVAL '2 months')::date,
   'hosting', 'c0000000-0000-0000-0000-000000000001', true, true, 'business_expense', 'card', 'Cloudflare', 'Annual domain renewal'),

  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'Google Ads spend - Garza Auto', 50000, (NOW() - INTERVAL '1 month')::date,
   'marketing', 'c0000000-0000-0000-0000-000000000007', true, true, 'business_expense', 'card', 'Google Ads', 'Monthly ad budget pass-through'),

  ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'Networking event - Austin Tech Meetup', 3500, (NOW() - INTERVAL '3 weeks')::date,
   'marketing', NULL, false, true, 'business_expense', 'card', 'Austin Tech Alliance', 'Sponsorship & attendance')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Recurring Expenses
-- ============================================================================
INSERT INTO recurring_expenses (id, org_id, description, amount_cents, frequency, day_of_month, start_date, category, is_tax_deductible, tax_category, payment_method, vendor, is_active) VALUES
  ('2e000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Vercel Pro Plan', 2000, 'monthly', 1, (NOW() - INTERVAL '12 months')::date,
   'hosting', true, 'business_expense', 'card', 'Vercel', true),

  ('2e000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Figma Professional', 1500, 'monthly', 1, (NOW() - INTERVAL '18 months')::date,
   'software', true, 'business_expense', 'card', 'Figma', true),

  ('2e000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Supabase Pro Plan', 2500, 'monthly', 1, (NOW() - INTERVAL '12 months')::date,
   'software', true, 'business_expense', 'card', 'Supabase', true),

  ('2e000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Google Workspace Business', 1200, 'monthly', 1, (NOW() - INTERVAL '24 months')::date,
   'software', true, 'business_expense', 'card', 'Google', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Time Entries (recent work log)
-- ============================================================================
INSERT INTO time_entries (id, org_id, client_id, description, duration_minutes, entry_date, billable, hourly_rate_cents, status, project, tags) VALUES
  ('7e000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Monthly maintenance - security updates and plugin patches', 45,
   (NOW() - INTERVAL '5 days')::date, true, 15000, 'logged', 'Rivera Property Maintenance', ARRAY['maintenance']),

  ('7e000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Performance optimization - image lazy loading and caching', 90,
   (NOW() - INTERVAL '4 days')::date, true, 15000, 'logged', 'Rivera Property Maintenance', ARRAY['performance','optimization']),

  ('7e000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002',
   'E-commerce bug fix - checkout flow not calculating tax correctly', 120,
   (NOW() - INTERVAL '3 days')::date, true, 15000, 'billed', 'Bloom Wellness Maintenance', ARRAY['bug-fix','e-commerce']),

  ('7e000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000004',
   'Discovery call and project scoping for catering website', 60,
   (NOW() - INTERVAL '2 weeks')::date, false, NULL, 'logged', 'Casa Ortiz Pre-Sales', ARRAY['sales','discovery']),

  ('7e000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000004',
   'Wireframes and sitemap for Casa Ortiz catering site', 180,
   (NOW() - INTERVAL '2 days')::date, true, 15000, 'logged', 'Casa Ortiz Website', ARRAY['design','wireframes']),

  ('7e000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000007',
   'Google Ads campaign optimization and keyword research', 75,
   (NOW() - INTERVAL '1 week')::date, true, 15000, 'logged', 'Garza Auto Marketing', ARRAY['seo','google-ads']),

  ('7e000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003',
   'Monthly SEO report and content recommendations', 60,
   (NOW() - INTERVAL '6 days')::date, true, 15000, 'logged', 'Thornton Law SEO', ARRAY['seo','reporting']),

  ('7e000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   NULL,
   'Internal: Updating project management workflows and templates', 90,
   (NOW() - INTERVAL '1 day')::date, false, NULL, 'logged', 'Internal Operations', ARRAY['internal','admin'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Leads
-- ============================================================================
INSERT INTO leads (id, email, name, phone, company, source, tags, status, last_contact, next_followup, notes) VALUES
  ('60000000-0000-0000-0000-000000000001',
   'kevin@parkfitness.io', 'Kevin Park', '(832) 555-0718', 'Park Fitness',
   'appointment', ARRAY['web-app','high-value'], 'qualified',
   NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days',
   'Runs 3 fitness studios. Looking for class booking system with membership management. Proposal sent - $15K project.'),

  ('60000000-0000-0000-0000-000000000002',
   'lisa@nakamuraphoto.com', 'Lisa Nakamura', '(512) 555-1067', 'Nakamura Photography',
   'contact_form', ARRAY['portfolio','photography'], 'nurturing',
   NOW() - INTERVAL '5 days', NOW() + INTERVAL '3 days',
   'Submitted contact form. Wants portfolio site with client galleries. Proposal viewed but not yet accepted.'),

  ('60000000-0000-0000-0000-000000000003',
   'tom.bradley@austineats.com', 'Tom Bradley', '(512) 555-1189', 'Austin Eats Food Truck',
   'contact_form', ARRAY['web-design','food-service'], 'new',
   NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days',
   'Filled out contact form. Wants a simple site for his food truck with menu and schedule.'),

  ('60000000-0000-0000-0000-000000000004',
   'priya@studiopriya.com', 'Priya Sharma', '(737) 555-1342', 'Studio Priya Yoga',
   'appointment', ARRAY['web-design','booking'], 'nurturing',
   NOW() - INTERVAL '4 days', NOW() + INTERVAL '5 days',
   'Had a discovery call. Wants booking integration and blog. Budget may be tight - exploring options.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Lead Interactions
-- ============================================================================
INSERT INTO lead_interactions (id, lead_id, interaction_type, details, created_at) VALUES
  ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'appointment_booked',
   '{"meeting_type": "discovery-call", "date": "2026-03-01"}'::jsonb, NOW() - INTERVAL '5 days'),
  ('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'email_sent',
   '{"subject": "Proposal: Fitness Booking Web App", "template": "proposal_followup"}'::jsonb, NOW() - INTERVAL '2 days'),

  ('61000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', 'email_sent',
   '{"subject": "Your Photography Portfolio Proposal", "template": "proposal_sent"}'::jsonb, NOW() - INTERVAL '4 days'),
  ('61000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000002', 'email_opened',
   '{"subject": "Your Photography Portfolio Proposal"}'::jsonb, NOW() - INTERVAL '2 days'),

  ('61000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003', 'email_sent',
   '{"subject": "Thanks for reaching out!", "template": "welcome_sequence_1"}'::jsonb, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- Onboarding Projects
-- ============================================================================
INSERT INTO onboarding_projects (id, client_id, project_type, template_id, status, estimated_completion_date, created_at) VALUES
  ('08000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',
   'Website Build', 'website-standard', 'active',
   NOW() + INTERVAL '6 weeks', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO onboarding_tasks (id, project_id, task_id, title, description, category, order_index, is_required, estimated_time_minutes, status, assigned_to) VALUES
  ('07000000-0000-0000-0000-000000000001', '08000000-0000-0000-0000-000000000001',
   'collect-branding', 'Collect branding assets', 'Gather logo, colors, fonts from client', 'client', 1, true, 30, 'completed', 'client'),

  ('07000000-0000-0000-0000-000000000002', '08000000-0000-0000-0000-000000000001',
   'collect-content', 'Collect website content', 'Menu items, photos, about text, contact info', 'client', 2, true, 60, 'in_progress', 'client'),

  ('07000000-0000-0000-0000-000000000003', '08000000-0000-0000-0000-000000000001',
   'setup-hosting', 'Set up hosting environment', 'Provision Vercel project and Supabase instance', 'technical', 3, true, 30, 'completed', 'admin'),

  ('07000000-0000-0000-0000-000000000004', '08000000-0000-0000-0000-000000000001',
   'design-mockups', 'Create design mockups', 'Homepage and inner page designs in Figma', 'admin', 4, true, 240, 'in_progress', 'admin'),

  ('07000000-0000-0000-0000-000000000005', '08000000-0000-0000-0000-000000000001',
   'develop-site', 'Develop website', 'Build the site in Next.js based on approved designs', 'technical', 5, true, 960, 'pending', 'admin'),

  ('07000000-0000-0000-0000-000000000006', '08000000-0000-0000-0000-000000000001',
   'client-review', 'Client review & feedback', 'Present staging site for client approval', 'client', 6, true, 60, 'pending', 'client'),

  ('07000000-0000-0000-0000-000000000007', '08000000-0000-0000-0000-000000000001',
   'launch', 'Launch website', 'DNS configuration, go-live, and post-launch checklist', 'technical', 7, true, 120, 'pending', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Done! Summary of seeded data:
-- ============================================================================
-- Organization: NunezDev Demo Agency
-- Clients: 8 (3 Active, 2 Prospect, 1 Lead, 1 Past, 1 Active)
-- Invoices: 10 (5 paid, 1 sent, 1 overdue, 1 partially_paid, 1 draft, 1 paid)
-- Invoice Payments: 7
-- Payment Plans: 1 (50/50 for Garza Auto)
-- Recurring Invoices: 3 (active retainers)
-- Proposals: 3 (1 accepted, 1 sent, 1 viewed)
-- Appointments: 6 (3 completed, 3 upcoming)
-- Notes: 5
-- Tasks: 8 (5 open, 3 completed)
-- Expenses: 8
-- Recurring Expenses: 4
-- Time Entries: 8
-- Leads: 4
-- Lead Interactions: 5
-- Deals: 5 (various stages)
-- Onboarding Projects: 1 (with 7 tasks)
-- Total revenue: ~$47,250 | Outstanding: ~$3,500
