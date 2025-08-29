
import { useState } from "react";
import { Lock, LockOpen, Plus, Server, Clock, User, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

interface SystemCardProps {
  system: System;
  currentUser: string;
  onLockSystem: (systemId: string, isSubsystem?: boolean, parentId?: string) => void;
  onAddSubsystem: (systemId: string, subsystemName: string) => void;
  onDeleteSystem: (systemId: string) => void;
  onDeleteSubsystem: (systemId: string, subsystemId: string) => void;
  isAdmin: boolean;
}

const SystemCard = ({ 
  system, 
  currentUser, 
  onLockSystem, 
  onAddSubsystem, 
  onDeleteSystem, 
  onDeleteSubsystem,
  isAdmin 
}: SystemCardProps) => {
  const [showAddSubsystem, setShowAddSubsystem] = useState(false);
  const [subsystemName, setSubsystemName] = useState("");

  const handleAddSubsystem = () => {
    if (subsystemName.trim()) {
      onAddSubsystem(system.id, subsystemName.trim());
      setSubsystemName("");
      setShowAddSubsystem(false);
    }
  };

  const getStatusColor = (isLocked: boolean, lockedBy: string | null) => {
    if (!isLocked) return "bg-green-100 text-green-800 border-green-200";
    if (lockedBy === currentUser) return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getStatusText = (isLocked: boolean, lockedBy: string | null) => {
    if (!isLocked) return "Available";
    if (lockedBy === currentUser) return "Locked by You";
    return "Locked";
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg font-semibold text-slate-800">
              {system.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`${getStatusColor(system.isLocked, system.lockedBy)} font-medium`}
            >
              {getStatusText(system.isLocked, system.lockedBy)}
            </Badge>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete System</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{system.name}"? This action cannot be undone and will also delete all subsystems.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDeleteSystem(system.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{system.description}</p>
        
        {system.isLocked && system.lockedBy && system.lockedAt && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
            <User className="h-3 w-3" />
            <span>{system.lockedBy}</span>
            <Clock className="h-3 w-3 ml-2" />
            <span>{formatDistanceToNow(system.lockedAt, { addSuffix: true })}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <Button
          onClick={() => onLockSystem(system.id)}
          className={`w-full ${
            system.isLocked && system.lockedBy !== currentUser && !isAdmin
              ? "bg-red-600 hover:bg-red-700"
              : system.isLocked && (system.lockedBy === currentUser || isAdmin)
              ? "bg-orange-600 hover:bg-orange-700"
              : "bg-green-600 hover:bg-green-700"
          } text-white transition-colors`}
          disabled={system.isLocked && system.lockedBy !== currentUser && !isAdmin}
        >
          {system.isLocked ? (
            <>
              {system.lockedBy === currentUser || isAdmin ? (
                <>
                  <LockOpen className="mr-2 h-4 w-4" />
                  Unlock System
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Locked
                </>
              )}
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Lock System
            </>
          )}
        </Button>

        {system.subsystems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <span>Subsystems ({system.subsystems.length}/8)</span>
            </h4>
            <div className="space-y-2">
              {system.subsystems.map((subsystem) => (
                <div
                  key={subsystem.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">
                        {subsystem.name}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getStatusColor(subsystem.isLocked, subsystem.lockedBy)}`}
                      >
                        {getStatusText(subsystem.isLocked, subsystem.lockedBy)}
                      </Badge>
                    </div>
                    {subsystem.isLocked && subsystem.lockedBy && subsystem.lockedAt && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <User className="h-3 w-3" />
                        <span>{subsystem.lockedBy}</span>
                        <Clock className="h-3 w-3 ml-1" />
                        <span>{formatDistanceToNow(subsystem.lockedAt, { addSuffix: true })}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant={subsystem.isLocked && (subsystem.lockedBy === currentUser || isAdmin) ? "default" : "outline"}
                      onClick={() => onLockSystem(subsystem.id, true, system.id)}
                      disabled={
                        system.isLocked || // Disable if parent system is locked
                        (subsystem.isLocked && subsystem.lockedBy !== currentUser && !isAdmin)
                      }
                      title={
                        system.isLocked ? 
                          "Cannot access subsystem while main system is locked" :
                          subsystem.isLocked ? 
                            (subsystem.lockedBy === currentUser || isAdmin ? "Click to unlock" : "Locked by another user") : 
                            "Click to lock"
                      }
                      className={
                        system.isLocked ? 
                          "opacity-50 cursor-not-allowed" :
                          subsystem.isLocked && (subsystem.lockedBy === currentUser || isAdmin) ? 
                            "bg-orange-600 hover:bg-orange-700 text-white" : ""
                      }
                    >
                      {subsystem.isLocked ? (
                        subsystem.lockedBy === currentUser || isAdmin ? (
                          <LockOpen className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Subsystem</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{subsystem.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onDeleteSubsystem(system.id, subsystem.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {system.subsystems.length < 8 && isAdmin && (
          <div className="space-y-2">
            {!showAddSubsystem ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddSubsystem(true)}
                className="w-full border-dashed"
              >
                <Plus className="mr-2 h-3 w-3" />
                Add Subsystem
              </Button>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Subsystem name"
                  value={subsystemName}
                  onChange={(e) => setSubsystemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSubsystem()}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleAddSubsystem}>
                  Add
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddSubsystem(false);
                    setSubsystemName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemCard;
