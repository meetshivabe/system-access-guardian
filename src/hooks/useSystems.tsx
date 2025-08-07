import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

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

export const useSystems = () => {
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchSystems = async () => {
    try {
      // Fetch systems with locked_by profile info
      const { data: systemsData, error: systemsError } = await supabase
        .from('systems')
        .select(`
          *,
          locked_by_profile:profiles!systems_locked_by_fkey(username)
        `)
        .order('created_at', { ascending: false });

      if (systemsError) throw systemsError;

      // Fetch subsystems with locked_by profile info
      const { data: subsystemsData, error: subsystemsError } = await supabase
        .from('subsystems')
        .select(`
          *,
          locked_by_profile:profiles!subsystems_locked_by_fkey(username)
        `)
        .order('created_at', { ascending: false });

      if (subsystemsError) throw subsystemsError;

      // Combine systems with their subsystems
      const systemsWithSubsystems = systemsData?.map(system => ({
        id: system.id,
        name: system.name,
        description: system.description || '',
        isLocked: system.is_locked,
        lockedBy: system.locked_by_profile?.username || null,
        lockedAt: system.locked_at ? new Date(system.locked_at) : null,
        subsystems: subsystemsData?.filter(sub => sub.system_id === system.id)
          .map(sub => ({
            id: sub.id,
            name: sub.name,
            isLocked: sub.is_locked,
            lockedBy: sub.locked_by_profile?.username || null,
            lockedAt: sub.locked_at ? new Date(sub.locked_at) : null
          })) || []
      })) || [];

      setSystems(systemsWithSubsystems);
    } catch (error) {
      console.error('Error fetching systems:', error);
      toast({
        title: 'Error',
        description: 'Failed to load systems',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystems();
  }, []);

  const addSystem = async (name: string, description: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('systems')
        .insert({
          name,
          description
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'System added successfully',
      });

      fetchSystems();
    } catch (error) {
      console.error('Error adding system:', error);
      toast({
        title: 'Error',
        description: 'Failed to add system',
        variant: 'destructive',
      });
    }
  };

  const addSubsystem = async (systemId: string, name: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('subsystems')
        .insert({
          system_id: systemId,
          name
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Subsystem added successfully',
      });

      fetchSystems();
    } catch (error) {
      console.error('Error adding subsystem:', error);
      toast({
        title: 'Error',
        description: 'Failed to add subsystem',
        variant: 'destructive',
      });
    }
  };

  const lockSystem = async (systemId: string, isSubsystem = false) => {
    if (!user) return;

    try {
      const table = isSubsystem ? 'subsystems' : 'systems';
      
      // Get current lock status
      const { data: current, error: fetchError } = await supabase
        .from(table)
        .select('is_locked, locked_by')
        .eq('id', systemId)
        .single();

      if (fetchError) throw fetchError;

      const isCurrentlyLocked = current?.is_locked;
      const currentLockedBy = current?.locked_by;

      // Determine new lock state
      const newLockState = !isCurrentlyLocked || currentLockedBy === user.id;
      const newLockedBy = newLockState ? user.id : null;
      const newLockedAt = newLockState ? new Date().toISOString() : null;

      const { error } = await supabase
        .from(table)
        .update({
          is_locked: newLockState,
          locked_by: newLockedBy,
          locked_at: newLockedAt
        })
        .eq('id', systemId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${isSubsystem ? 'Subsystem' : 'System'} ${newLockState ? 'locked' : 'unlocked'} successfully`,
      });

      fetchSystems();
    } catch (error) {
      console.error('Error toggling lock:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle lock',
        variant: 'destructive',
      });
    }
  };

  const deleteSystem = async (systemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('systems')
        .delete()
        .eq('id', systemId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'System deleted successfully',
      });

      fetchSystems();
    } catch (error) {
      console.error('Error deleting system:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete system',
        variant: 'destructive',
      });
    }
  };

  const deleteSubsystem = async (subsystemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('subsystems')
        .delete()
        .eq('id', subsystemId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Subsystem deleted successfully',
      });

      fetchSystems();
    } catch (error) {
      console.error('Error deleting subsystem:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete subsystem',
        variant: 'destructive',
      });
    }
  };

  return {
    systems,
    loading,
    addSystem,
    addSubsystem,
    lockSystem,
    deleteSystem,
    deleteSubsystem,
    refetch: fetchSystems
  };
};