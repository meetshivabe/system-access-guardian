import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import SystemCard from "@/components/SystemCard";
import AddSystemDialog from "@/components/AddSystemDialog";
import UserSelector from "@/components/UserSelector";

interface SubSystem {
  id: string;
  name: string;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: Date | null;
}

interface System {
  id: string;
  name: string;
  description: string;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: Date | null;
  subsystems: SubSystem[];
}

const Index = () => {
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [systems, setSystems] = useState<System[]>([
    {
      id: "1",
      name: "Production Server Alpha",
      description: "Main production environment for web applications",
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      subsystems: [
        {
          id: "1-1",
          name: "Database Cluster",
          isLocked: true,
          lockedBy: "john.doe@example.com",
          lockedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          id: "1-2",
          name: "Web Server Pool",
          isLocked: false,
          lockedBy: null,
          lockedAt: null
        }
      ]
    },
    {
      id: "2",
      name: "Development Environment",
      description: "Isolated development and testing environment",
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      subsystems: [
        {
          id: "2-1",
          name: "Test Database",
          isLocked: false,
          lockedBy: null,
          lockedAt: null
        }
      ]
    }
  ]);

  const [currentUser, setCurrentUser] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (user) {
      setCurrentUser(user.email || '');
    }
  }, [user, loading, navigate]);

  const handleLockSystem = (systemId: string, isSubsystem: boolean = false, parentId?: string) => {
    setSystems(prevSystems => 
      prevSystems.map(system => {
        if (!isSubsystem && system.id === systemId) {
          if (system.isLocked) {
            if (system.lockedBy === currentUser) {
              toast({
                title: "System Unlocked",
                description: `${system.name} is now available for others to use.`
              });
              return {
                ...system,
                isLocked: false,
                lockedBy: null,
                lockedAt: null
              };
            } else {
              toast({
                title: "Access Denied",
                description: `This system is locked by ${system.lockedBy}`,
                variant: "destructive"
              });
              return system;
            }
          } else {
            toast({
              title: "System Locked",
              description: `${system.name} is now locked for your exclusive use.`
            });
            return {
              ...system,
              isLocked: true,
              lockedBy: currentUser,
              lockedAt: new Date()
            };
          }
        } else if (isSubsystem && system.id === parentId) {
          return {
            ...system,
            subsystems: system.subsystems.map(subsystem => {
              if (subsystem.id === systemId) {
                if (subsystem.isLocked) {
                  if (subsystem.lockedBy === currentUser) {
                    toast({
                      title: "Subsystem Unlocked",
                      description: `${subsystem.name} is now available.`
                    });
                    return {
                      ...subsystem,
                      isLocked: false,
                      lockedBy: null,
                      lockedAt: null
                    };
                  } else {
                    toast({
                      title: "Access Denied",
                      description: `This subsystem is locked by ${subsystem.lockedBy}`,
                      variant: "destructive"
                    });
                    return subsystem;
                  }
                } else {
                  toast({
                    title: "Subsystem Locked",
                    description: `${subsystem.name} is now locked for your use.`
                  });
                  return {
                    ...subsystem,
                    isLocked: true,
                    lockedBy: currentUser,
                    lockedAt: new Date()
                  };
                }
              }
              return subsystem;
            })
          };
        }
        return system;
      })
    );
  };

  const handleDeleteSystem = (systemId: string) => {
    setSystems(prevSystems => {
      const systemToDelete = prevSystems.find(system => system.id === systemId);
      const updatedSystems = prevSystems.filter(system => system.id !== systemId);
      
      if (systemToDelete) {
        toast({
          title: "System Deleted",
          description: `${systemToDelete.name} has been permanently deleted.`,
        });
      }
      
      return updatedSystems;
    });
  };

  const handleDeleteSubsystem = (systemId: string, subsystemId: string) => {
    setSystems(prevSystems => 
      prevSystems.map(system => {
        if (system.id === systemId) {
          const subsystemToDelete = system.subsystems.find(sub => sub.id === subsystemId);
          const updatedSubsystems = system.subsystems.filter(sub => sub.id !== subsystemId);
          
          if (subsystemToDelete) {
            toast({
              title: "Subsystem Deleted",
              description: `${subsystemToDelete.name} has been permanently deleted.`,
            });
          }
          
          return {
            ...system,
            subsystems: updatedSubsystems
          };
        }
        return system;
      })
    );
  };

  const handleAddSystem = (name: string, description: string) => {
    const newSystem: System = {
      id: Date.now().toString(),
      name,
      description,
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      subsystems: []
    };

    setSystems(prev => [...prev, newSystem]);
    setIsAddDialogOpen(false);
    toast({
      title: "System Added",
      description: `${name} has been added to the system list.`
    });
  };

  const handleAddSubsystem = (systemId: string, subsystemName: string) => {
    setSystems(prevSystems => 
      prevSystems.map(system => {
        if (system.id === systemId) {
          if (system.subsystems.length >= 8) {
            toast({
              title: "Limit Reached",
              description: "Maximum of 8 subsystems allowed per system.",
              variant: "destructive"
            });
            return system;
          }

          const newSubsystem: SubSystem = {
            id: `${systemId}-${Date.now()}`,
            name: subsystemName,
            isLocked: false,
            lockedBy: null,
            lockedAt: null
          };

          toast({
            title: "Subsystem Added",
            description: `${subsystemName} has been added to ${system.name}.`
          });

          return {
            ...system,
            subsystems: [...system.subsystems, newSubsystem]
          };
        }
        return system;
      })
    );
  };

  if (loading) {
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
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add System
            </Button>
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
              currentUser={currentUser}
              onLockSystem={handleLockSystem}
              onAddSubsystem={handleAddSubsystem}
              onDeleteSystem={handleDeleteSystem}
              onDeleteSubsystem={handleDeleteSubsystem}
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
              Add your first system to get started with resource management.
            </p>
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Your First System
            </Button>
          </div>
        )}

        <AddSystemDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onAdd={handleAddSystem}
        />
      </div>
    </div>
  );
};

export default Index;
