import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function DebugAuth() {
  try {
    const supabase = await supabaseServer();
    
    // Check user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Check org membership if user exists
    let orgMembership = null;
    let orgError = null;
    
    if (user) {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, role, created_at, organizations(name)")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .order("created_at", { ascending: false })
        .limit(1);
      
      orgMembership = data;
      orgError = error;
    }

    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-bold">Authentication Debug</h1>
        
        <div className="border p-4 rounded">
          <h2 className="font-semibold">User Status:</h2>
          {userError ? (
            <p className="text-red-600">Error: {userError.message}</p>
          ) : user ? (
            <div className="space-y-2">
              <p className="text-green-600">✅ User authenticated</p>
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Created:</strong> {user.created_at}</p>
            </div>
          ) : (
            <p className="text-red-600">❌ No user found</p>
          )}
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold">Organization Membership:</h2>
          {!user ? (
            <p className="text-gray-500">No user to check</p>
          ) : orgError ? (
            <p className="text-red-600">Error: {orgError.message}</p>
          ) : orgMembership && orgMembership.length > 0 ? (
            <div className="space-y-2">
              <p className="text-green-600">✅ Owner access found</p>
              <p><strong>Org ID:</strong> {orgMembership[0].org_id}</p>
              <p><strong>Role:</strong> {orgMembership[0].role}</p>
              <p><strong>Org Name:</strong> {(orgMembership[0] as any).organizations?.name || 'Unknown'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-red-600">❌ No owner access found</p>
              <p>User ID {user.id} is not an owner of any organization</p>
            </div>
          )}
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold">Action Required:</h2>
          {!user ? (
            <p>Please log in first</p>
          ) : !orgMembership || orgMembership.length === 0 ? (
            <div className="space-y-2">
              <p>You need to be added as an owner to an organization. Run this SQL in Supabase:</p>
              <pre className="bg-gray-100 p-2 text-sm rounded overflow-x-auto">
{`-- First, create an organization if none exists
INSERT INTO organizations (name) VALUES ('Your Company Name');

-- Then add yourself as owner (replace with your user ID)
INSERT INTO org_members (org_id, user_id, role) 
VALUES (
  (SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1),
  '${user.id}',
  'owner'
);`}
              </pre>
            </div>
          ) : (
            <p className="text-green-600">✅ Everything looks good! You should be able to access the dashboard.</p>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-red-600">Debug Error</h1>
        <pre className="bg-red-50 p-4 rounded mt-4">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </div>
    );
  }
}