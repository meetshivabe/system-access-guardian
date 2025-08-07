import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSystems } from "@/hooks/useSystems";
import SystemCard from "@/components/SystemCard";
import AddSystemDialog from "@/components/AddSystemDialog";

const Index = () => {
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { 
    systems, 
    loading: systemsLoading, 
    addSystem, 
    addSubsystem, 
    lockSystem, 
    deleteSystem, 
    deleteSubsystem 
  } = useSystems();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || systemsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              System Resource Manager
            </h1>
            <p className="text-slate-600 text-lg">
              Manage and allocate shared Linux systems efficiently
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-4 md:mt-0">
            {user && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-2 rounded-lg border">
                <span>Welcome, {user.email}</span>
              </div>
            )}
            {isAdmin && (
              <Button 
                onClick={() => navigate('/admin')}
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin Panel
              </Button>
            )}
            <Button 
              onClick={signOut}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {systems.map((system) => (
            <SystemCard
              key={system.id}
              system={system}
              currentUser={user?.email || ''}
              onLockSystem={(id, isSubsystem) => lockSystem(id, isSubsystem)}
              onAddSubsystem={addSubsystem}
              onDeleteSystem={deleteSystem}
              onDeleteSubsystem={(_, subsystemId) => deleteSubsystem(subsystemId)}
              isAdmin={isAdmin}
            />
          ))}
        </div>

        {systems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-slate-400 text-6xl mb-4">🖥️</div>
            <h3 className="text-xl font-semibold text-slate-600 mb-2">
              No Systems Available
            </h3>
            <p className="text-slate-500 mb-6">
              {isAdmin ? "Add your first system to get started with resource management." : "No systems available. Contact an admin to add systems."}
            </p>
            {isAdmin && (
              <AddSystemDialog
                onAddSystem={(name, description) => addSystem(name, description)}
              />
            )}
          </div>
        )}

        {isAdmin && systems.length > 0 && (
          <div className="fixed bottom-6 right-6">
            <AddSystemDialog
              onAddSystem={(name, description) => addSystem(name, description)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;