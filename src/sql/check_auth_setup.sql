-- Check authentication and organization setup
-- Run this to see if you have proper access configured

-- Check if you have any organizations
SELECT 'Organizations Check' as report_type,
       COUNT(*) as total_orgs,
       string_agg(name, ', ') as org_names
FROM organizations;

-- Check if you have any org members 
SELECT 'Org Members Check' as report_type,
       COUNT(*) as total_members,
       COUNT(CASE WHEN role = 'owner' THEN 1 END) as owner_count,
       COUNT(CASE WHEN role = 'member' THEN 1 END) as member_count
FROM org_members;

-- Check what users exist in auth.users (you might not see this if RLS is enabled)
-- This will only work if you have direct access to the auth schema
SELECT 'Auth Users Check' as report_type,
       COUNT(*) as total_users
FROM auth.users;

-- Show detailed org membership (replace USER_ID with your actual user ID if known)
SELECT 'Detailed Membership' as report_type,
       om.user_id,
       om.role,
       o.name as org_name,
       om.created_at
FROM org_members om
JOIN organizations o ON o.id = om.org_id
ORDER BY om.created_at DESC;

-- If you need to create an organization and make yourself owner:
-- First, find your user ID from Supabase auth dashboard, then run:

-- INSERT INTO organizations (name) VALUES ('Your Organization Name');
-- INSERT INTO org_members (org_id, user_id, role) 
-- VALUES (
--   (SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1),
--   'YOUR-USER-ID-FROM-SUPABASE-AUTH',
--   'owner'
-- );