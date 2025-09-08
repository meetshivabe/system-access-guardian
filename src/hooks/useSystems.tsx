import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SubSystem {
  id: string;
  name: string;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: Date | null;
  bookingStart?: Date | null;
  bookingEnd?: Date | null;
}

interface System {
  id: string;
  name: string;
  description: string;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: Date | null;
  bookingStart?: Date | null;
  bookingEnd?: Date | null;
  subsystems: SubSystem[];
  bookings?: Array<{
    start: Date;
    end: Date;
    user: string;
  }>;
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

      // Fetch system bookings (only if table exists)
      let systemBookings: any[] = [];
      const { data: sysBookings, error: bookingsError } = await supabase
        .from('system_bookings')
        .select(`
          *,
          user:profiles!system_bookings_user_id_fkey(username)
        `)
        .eq('status', 'active');

      if (!bookingsError || !bookingsError.message?.includes('does not exist')) {
        systemBookings = sysBookings || [];
      }

      // Fetch subsystems with locked_by profile info
      const { data: subsystemsData, error: subsystemsError } = await supabase
        .from('subsystems')
        .select(`
          *,
          locked_by_profile:profiles!subsystems_locked_by_fkey(username)
        `)
        .order('created_at', { ascending: false });

      if (subsystemsError) throw subsystemsError;

      // Fetch subsystem bookings (only if table exists)
      let subsystemBookings: any[] = [];
      const { data: subBookings, error: subsystemBookingsError } = await supabase
        .from('subsystem_bookings')
        .select(`
          *,
          user:profiles!subsystem_bookings_user_id_fkey(username)
        `)
        .eq('status', 'active');

      if (!subsystemBookingsError || !subsystemBookingsError.message?.includes('does not exist')) {
        subsystemBookings = subBookings || [];
      }

      // Combine systems with their subsystems and bookings
      const systemsWithSubsystems = systemsData?.map(system => {
        const sysBookings = systemBookings?.filter(b => b.system_id === system.id) || [];
        
        // Find the current active booking if any
        const now = new Date();
        const activeBooking = sysBookings.find(b => 
          new Date(b.booking_start) <= now && new Date(b.booking_end) > now
        );
        
        // Use booking data as source of truth, fall back to system fields only if consistent
        const bookingStart = activeBooking 
          ? new Date(activeBooking.booking_start) 
          : (system.booking_start && system.is_locked ? new Date(system.booking_start) : null);
        const bookingEnd = activeBooking 
          ? new Date(activeBooking.booking_end)
          : (system.booking_end && system.is_locked ? new Date(system.booking_end) : null);
        
        return {
          id: system.id,
          name: system.name,
          description: system.description || '',
          isLocked: system.is_locked,
          lockedBy: system.locked_by_profile?.username || null,
          lockedAt: system.locked_at ? new Date(system.locked_at) : null,
          bookingStart: bookingStart,
          bookingEnd: bookingEnd,
          bookings: sysBookings.map(b => ({
            id: b.id,
            start: new Date(b.booking_start),
            end: new Date(b.booking_end),
            user: b.user?.username || 'Unknown'
          })),
          subsystems: subsystemsData?.filter(sub => sub.system_id === system.id)
            .map(sub => {
              const subBookings = subsystemBookings?.filter(b => b.subsystem_id === sub.id) || [];
              
              // Find the current active booking if any
              const activeSubBooking = subBookings.find(b => 
                new Date(b.booking_start) <= now && new Date(b.booking_end) > now
              );
              
              // Use booking data as source of truth
              const subBookingStart = activeSubBooking 
                ? new Date(activeSubBooking.booking_start)
                : (sub.booking_start && sub.is_locked ? new Date(sub.booking_start) : null);
              const subBookingEnd = activeSubBooking 
                ? new Date(activeSubBooking.booking_end)
                : (sub.booking_end && sub.is_locked ? new Date(sub.booking_end) : null);
              
              return {
                id: sub.id,
                name: sub.name,
                isLocked: sub.is_locked,
                lockedBy: sub.locked_by_profile?.username || null,
                lockedAt: sub.locked_at ? new Date(sub.locked_at) : null,
                bookingStart: subBookingStart,
                bookingEnd: subBookingEnd,
                bookings: subBookings.map(b => ({
                  id: b.id,
                  start: new Date(b.booking_start),
                  end: new Date(b.booking_end),
                  user: b.user?.username || 'Unknown'
                }))
              };
            }) || []
        };
      }) || [];

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
      const newLockState = !isCurrentlyLocked; // Toggle the current state
      const newLockedBy = newLockState ? user.id : null;
      const newLockedAt = newLockState ? new Date().toISOString() : null;

      // Handle utilization tracking
      if (newLockState) {
        // Locking - start utilization tracking
        if (isSubsystem) {
          // Get parent system ID for subsystem
          const { data: subsystemData } = await supabase
            .from('subsystems')
            .select('system_id')
            .eq('id', systemId)
            .single();
          
          if (subsystemData) {
            await supabase
              .from('subsystem_utilization')
              .insert({
                subsystem_id: systemId,
                system_id: subsystemData.system_id,
                user_id: user.id,
                locked_at: new Date().toISOString(),
              });
          }
        } else {
          await supabase
            .from('system_utilization')
            .insert({
              system_id: systemId,
              user_id: user.id,
              locked_at: new Date().toISOString(),
            });
        }
      } else {
        // Unlocking - end utilization tracking
        if (isSubsystem) {
          await supabase
            .from('subsystem_utilization')
            .update({ unlocked_at: new Date().toISOString() })
            .eq('subsystem_id', systemId)
            .eq('user_id', user.id)
            .is('unlocked_at', null);
        } else {
          await supabase
            .from('system_utilization')
            .update({ unlocked_at: new Date().toISOString() })
            .eq('system_id', systemId)
            .eq('user_id', user.id)
            .is('unlocked_at', null);
        }
      }

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

  const updateSystemDescription = async (systemId: string, description: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('systems')
        .update({ description })
        .eq('id', systemId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'System description updated successfully',
      });

      fetchSystems();
    } catch (error) {
      console.error('Error updating system description:', error);
      toast({
        title: 'Error',
        description: 'Failed to update system description',
        variant: 'destructive',
      });
    }
  };

  const updateSystemName = async (systemId: string, name: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('systems')
        .update({ name })
        .eq('id', systemId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'System name updated successfully',
      });

      fetchSystems();
    } catch (error) {
      console.error('Error updating system name:', error);
      toast({
        title: 'Error',
        description: 'Failed to update system name',
        variant: 'destructive',
      });
    }
  };

  const updateSubsystemName = async (subsystemId: string, name: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('subsystems')
        .update({ name })
        .eq('id', subsystemId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Subsystem name updated successfully',
      });

      fetchSystems();
    } catch (error) {
      console.error('Error updating subsystem name:', error);
      toast({
        title: 'Error',
        description: 'Failed to update subsystem name',
        variant: 'destructive',
      });
    }
  };

  const bookSystem = async (systemId: string, startDate: Date, endDate: Date, isSubsystem = false) => {
    if (!user) return;

    try {
      const systemTable = isSubsystem ? 'subsystems' : 'systems';
      
      // Check if user is admin
      const { data: isAdminData } = await supabase
        .rpc('is_admin');
      
      const userIsAdmin = isAdminData === true;
      
      // Check user's remaining booking slots
      const { data: remainingBookings, error: remainingError } = await supabase
        .rpc('get_user_remaining_bookings', { p_user_id: user.id });
      
      if (!remainingError && remainingBookings !== null && remainingBookings <= 0) {
        toast({
          title: 'Booking Limit Reached',
          description: 'You have reached the maximum of 5 active bookings. Please wait for some bookings to complete or cancel existing ones.',
          variant: 'destructive',
        });
        return;
      }
      
      // Check if the booking tables exist
      const { error: tableCheckError } = await supabase
        .from(isSubsystem ? 'subsystem_bookings' : 'system_bookings')
        .select('id')
        .limit(1);
      
      const bookingTablesExist = !tableCheckError || !tableCheckError.message?.includes('does not exist');
      
      if (bookingTablesExist) {
        // Check for existing bookings to provide proper warnings/errors
        const table = isSubsystem ? 'subsystem_bookings' : 'system_bookings';
        const idField = isSubsystem ? 'subsystem_id' : 'system_id';
        
        // Get existing bookings with user information
        const { data: existingBookings } = await supabase
          .from(table)
          .select(`
            booking_start, 
            booking_end, 
            user_id,
            profiles!inner(username)
          `)
          .eq(idField, systemId)
          .eq('status', 'active');
        
        if (existingBookings && existingBookings.length > 0) {
          for (const booking of existingBookings) {
            const bookingStart = new Date(booking.booking_start);
            const bookingEnd = new Date(booking.booking_end);
            
            const hasConflict = 
              (startDate <= bookingEnd && endDate >= bookingStart);
            
            if (hasConflict && booking.user_id !== user.id) {
              const conflictingUser = booking.profiles?.username || 'another user';
              
              // Non-admins cannot override
              if (!userIsAdmin) {
                toast({
                  title: 'Booking Conflict',
                  description: `This time slot is already booked by ${conflictingUser}. Only admins can override existing bookings.`,
                  variant: 'destructive',
                });
                return;
              } else {
                // Admin warning - booking will proceed and override
                toast({
                  title: 'Admin Override',
                  description: `Overriding existing booking by ${conflictingUser}`,
                  variant: 'default',
                });
              }
            }
          }
        }
        
        let bookingData: any = {
          [idField]: systemId,
          user_id: user.id,
          booking_start: startDate.toISOString(),
          booking_end: endDate.toISOString(),
          status: 'active'
        };

        if (isSubsystem) {
          const { data: subsystemData } = await supabase
            .from('subsystems')
            .select('system_id')
            .eq('id', systemId)
            .single();
          
          if (subsystemData) {
            bookingData.system_id = subsystemData.system_id;
          }
        }

        const { error: bookingError } = await supabase
          .from(table)
          .insert(bookingData);

        if (bookingError) {
          console.error('Booking error:', bookingError);
          
          // Handle specific error cases
          if (bookingError.message?.includes('already booked') || 
              bookingError.message?.includes('conflicts') || 
              bookingError.message?.includes('overlapping')) {
            toast({
              title: 'Booking Conflict',
              description: 'This time slot conflicts with an existing booking. Please choose different dates.',
              variant: 'destructive',
            });
            return;
          } else if (!bookingError.message?.includes('does not exist')) {
            // Only show generic error if it's not about missing table
            toast({
              title: 'Booking Error',
              description: bookingError.message || 'Failed to create booking',
              variant: 'destructive',
            });
            return;
          }
        }
      }

      // Only lock immediately if booking starts now or in the past
      const now = new Date();
      const shouldLockNow = startDate <= now;
      
      // First, try to update with booking columns (if they exist)
      let updateData: any = {};
      
      if (shouldLockNow) {
        // Lock immediately if booking starts now or in the past
        updateData.is_locked = true;
        updateData.locked_by = user.id;
        updateData.locked_at = new Date().toISOString();
      }
      
      // Check if booking columns exist by trying a select first
      const { data: checkData, error: checkError } = await supabase
        .from(systemTable)
        .select('id, booking_start, booking_end')
        .eq('id', systemId)
        .single();
      
      // If no error or the error isn't about missing columns, include booking dates
      if (!checkError || !checkError.message?.includes('column')) {
        updateData.booking_start = startDate.toISOString();
        updateData.booking_end = endDate.toISOString();
      }
      
      const { error: lockError } = await supabase
        .from(systemTable)
        .update(updateData)
        .eq('id', systemId);

      if (lockError) {
        console.error('Error locking system for booking:', lockError);
        // If error is about missing columns, try again without booking dates
        if (lockError.message?.includes('column')) {
          const { error: retryError } = await supabase
            .from(systemTable)
            .update({
              is_locked: true,
              locked_by: user.id,
              locked_at: lockTime
            })
            .eq('id', systemId);
          
          if (retryError) {
            console.error('Error locking system (retry):', retryError);
            toast({
              title: 'Error',
              description: 'Failed to lock the system',
              variant: 'destructive',
            });
            return;
          }
        } else {
          toast({
            title: 'Error',
            description: 'Failed to lock the system',
            variant: 'destructive',
          });
          return;
        }
      }

      // Add utilization tracking (only if table exists and booking starts now)
      if (shouldLockNow) {
        const utilizationTable = isSubsystem ? 'subsystem_utilization' : 'system_utilization';
        const { error: utilizationCheckError } = await supabase
          .from(utilizationTable)
          .select('id')
          .limit(1);
        
        if (!utilizationCheckError || !utilizationCheckError.message?.includes('does not exist')) {
          if (isSubsystem) {
            const { data: subsystemData } = await supabase
              .from('subsystems')
              .select('system_id')
              .eq('id', systemId)
              .single();
            
            if (subsystemData) {
              await supabase
                .from('subsystem_utilization')
                .insert({
                  subsystem_id: systemId,
                  system_id: subsystemData.system_id,
                  user_id: user.id,
                  locked_at: new Date().toISOString(),
                });
            }
          } else {
            await supabase
              .from('system_utilization')
              .insert({
                system_id: systemId,
                user_id: user.id,
                locked_at: new Date().toISOString(),
              });
          }
        }
      }

      const isFutureBooking = startDate > now;
      
      toast({
        title: 'Success',
        description: isFutureBooking 
          ? `${isSubsystem ? 'Subsystem' : 'System'} booked for ${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')}`
          : `${isSubsystem ? 'Subsystem' : 'System'} booked and locked successfully`,
      });

      fetchSystems();
    } catch (error) {
      console.error('Error booking system:', error);
      toast({
        title: 'Error',
        description: 'Failed to book system',
        variant: 'destructive',
      });
    }
  };

  const cancelBooking = async (bookingId: string, bookingType: 'system' | 'subsystem') => {
    if (!user) return;

    try {
      // Check if user is admin
      const { data: isAdminData } = await supabase
        .rpc('is_admin');
      
      if (isAdminData !== true) {
        toast({
          title: 'Permission Denied',
          description: 'Only administrators can cancel bookings',
          variant: 'destructive',
        });
        return;
      }

      const functionName = bookingType === 'system' 
        ? 'cancel_system_booking' 
        : 'cancel_subsystem_booking';

      const { data, error } = await supabase
        .rpc(functionName, { p_booking_id: bookingId });

      if (error) throw error;

      if (data) {
        toast({
          title: 'Success',
          description: 'Booking cancelled successfully',
        });
        // Add a small delay to ensure database updates are complete
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchSystems();
      } else {
        toast({
          title: 'Error',
          description: 'Booking not found or already cancelled',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel booking',
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
    bookSystem,
    cancelBooking,
    deleteSystem,
    deleteSubsystem,
    updateSystemDescription,
    updateSystemName,
    updateSubsystemName,
    refetch: fetchSystems
  };
};