import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, Server, Trash2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { format, isAfter, isBefore } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Booking {
  id: string;
  system_id?: string;
  subsystem_id?: string;
  user_id: string;
  booking_start: string;
  booking_end: string;
  status: 'active' | 'cancelled' | 'completed';
  created_at: string;
  system?: {
    name: string;
  };
  subsystem?: {
    name: string;
  };
  user?: {
    username: string;
    email: string;
  };
}

const AdminBookingsList = () => {
  const [systemBookings, setSystemBookings] = useState<Booking[]>([]);
  const [subsystemBookings, setSubsystemBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchAllBookings();
  }, []);

  const fetchAllBookings = async () => {
    try {
      setLoading(true);
      const now = new Date();

      // Fetch system bookings with related data
      const { data: sysBookings, error: sysError } = await supabase
        .from('system_bookings')
        .select(`
          *,
          system:systems(name),
          user:profiles(username, email)
        `)
        .gte('booking_end', now.toISOString())
        .order('booking_start', { ascending: true });

      if (sysError) throw sysError;

      // Fetch subsystem bookings with related data
      const { data: subBookings, error: subError } = await supabase
        .from('subsystem_bookings')
        .select(`
          *,
          subsystem:subsystems(name),
          system:systems(name),
          user:profiles(username, email)
        `)
        .gte('booking_end', now.toISOString())
        .order('booking_start', { ascending: true });

      if (subError) throw subError;

      setSystemBookings(sysBookings || []);
      setSubsystemBookings(subBookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch bookings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const syncBookingStatus = async () => {
    setSyncing(true);
    try {
      const now = new Date().toISOString();
      
      // First, get all systems with booking data
      const { data: systems, error: systemsError } = await supabase
        .from('systems')
        .select('id, booking_start, booking_end, is_locked, locked_by');
      
      if (systemsError) throw systemsError;
      
      // Get all active system bookings
      const { data: activeBookings, error: bookingsError } = await supabase
        .from('system_bookings')
        .select('*')
        .eq('status', 'active');
      
      if (bookingsError) throw bookingsError;
      
      // Process each system
      for (const system of systems || []) {
        const activeBooking = activeBookings?.find(b => 
          b.system_id === system.id &&
          b.booking_start <= now &&
          b.booking_end > now
        );
        
        if (!activeBooking && (system.booking_start || system.booking_end)) {
          // System has booking fields but no active booking - clear them
          const { error } = await supabase
            .from('systems')
            .update({
              booking_start: null,
              booking_end: null,
              is_locked: false,
              locked_by: null,
              locked_at: null
            })
            .eq('id', system.id);
          
          if (error) console.error('Error clearing system booking:', error);
        } else if (activeBooking) {
          // Ensure system fields match the active booking
          const { error } = await supabase
            .from('systems')
            .update({
              booking_start: activeBooking.booking_start,
              booking_end: activeBooking.booking_end,
              is_locked: true,
              locked_by: activeBooking.user_id,
              locked_at: activeBooking.booking_start
            })
            .eq('id', system.id);
          
          if (error) console.error('Error updating system booking:', error);
        }
      }
      
      // Do the same for subsystems
      const { data: subsystems, error: subsystemsError } = await supabase
        .from('subsystems')
        .select('id, booking_start, booking_end, is_locked, locked_by');
      
      if (subsystemsError) throw subsystemsError;
      
      const { data: activeSubBookings, error: subBookingsError } = await supabase
        .from('subsystem_bookings')
        .select('*')
        .eq('status', 'active');
      
      if (subBookingsError) throw subBookingsError;
      
      for (const subsystem of subsystems || []) {
        const activeBooking = activeSubBookings?.find(b => 
          b.subsystem_id === subsystem.id &&
          b.booking_start <= now &&
          b.booking_end > now
        );
        
        if (!activeBooking && (subsystem.booking_start || subsystem.booking_end)) {
          // Subsystem has booking fields but no active booking - clear them
          const { error } = await supabase
            .from('subsystems')
            .update({
              booking_start: null,
              booking_end: null,
              is_locked: false,
              locked_by: null,
              locked_at: null
            })
            .eq('id', subsystem.id);
          
          if (error) console.error('Error clearing subsystem booking:', error);
        } else if (activeBooking) {
          // Ensure subsystem fields match the active booking
          const { error } = await supabase
            .from('subsystems')
            .update({
              booking_start: activeBooking.booking_start,
              booking_end: activeBooking.booking_end,
              is_locked: true,
              locked_by: activeBooking.user_id,
              locked_at: activeBooking.booking_start
            })
            .eq('id', subsystem.id);
          
          if (error) console.error('Error updating subsystem booking:', error);
        }
      }
      
      // Mark expired bookings as completed
      const { error: expireError } = await supabase
        .from('system_bookings')
        .update({ status: 'completed' })
        .eq('status', 'active')
        .lt('booking_end', now);
      
      if (expireError) console.error('Error expiring bookings:', expireError);
      
      const { error: expireSubError } = await supabase
        .from('subsystem_bookings')
        .update({ status: 'completed' })
        .eq('status', 'active')
        .lt('booking_end', now);
      
      if (expireSubError) console.error('Error expiring subsystem bookings:', expireSubError);
      
      toast({
        title: 'Sync Complete',
        description: 'Booking status has been synchronized successfully.',
      });
      
      // Refresh the bookings list
      await fetchAllBookings();
      
      // Trigger a refresh of the main systems view after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error syncing booking status:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync booking status. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const cancelBooking = async (bookingId: string, isSubsystem: boolean) => {
    try {
      // Use the proper RPC function that handles all the cleanup
      const functionName = isSubsystem ? 'cancel_subsystem_booking' : 'cancel_system_booking';
      
      const { data, error } = await supabase
        .rpc(functionName, { p_booking_id: bookingId });

      if (error) throw error;

      if (data) {
        toast({
          title: 'Booking Cancelled',
          description: 'The booking has been cancelled and the system has been unlocked if it was active.',
        });
      } else {
        toast({
          title: 'Warning',
          description: 'Booking not found or already cancelled.',
          variant: 'default',
        });
      }

      // Refresh bookings after a short delay to ensure database updates are complete
      setTimeout(() => {
        fetchAllBookings();
      }, 500);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel booking. Make sure you have admin privileges.',
        variant: 'destructive',
      });
    }
  };

  const getBookingStatus = (booking: Booking) => {
    const now = new Date();
    const start = new Date(booking.booking_start);
    const end = new Date(booking.booking_end);

    if (booking.status === 'cancelled') {
      return { label: 'Cancelled', variant: 'secondary' as const };
    }
    
    if (isBefore(now, start)) {
      return { label: 'Upcoming', variant: 'default' as const };
    }
    
    if (isAfter(now, end)) {
      return { label: 'Completed', variant: 'outline' as const };
    }
    
    return { label: 'Active', variant: 'success' as const };
  };

  const BookingCard = ({ booking, isSubsystem = false }: { booking: Booking, isSubsystem?: boolean }) => {
    const status = getBookingStatus(booking);
    const isActive = status.label === 'Active';
    const isUpcoming = status.label === 'Upcoming';
    const canCancel = booking.status === 'active' && (isActive || isUpcoming);

    return (
      <div className={`p-4 border rounded-lg ${isActive ? 'bg-green-50 border-green-200' : 'bg-card'}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {isSubsystem ? (
              <div className="flex items-center gap-1">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{booking.subsystem?.name}</span>
                <span className="text-sm text-muted-foreground">({booking.system?.name})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Server className="h-4 w-4 text-primary" />
                <span className="font-medium">{booking.system?.name}</span>
              </div>
            )}
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{booking.user?.username || 'Unknown'}</span>
            <span className="text-xs">({booking.user?.email})</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {format(new Date(booking.booking_start), 'MMM dd, yyyy HH:mm')} - 
              {format(new Date(booking.booking_end), 'MMM dd, yyyy HH:mm')}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Created: {format(new Date(booking.created_at), 'MMM dd, yyyy HH:mm')}</span>
          </div>
        </div>

        {canCancel && (
          <div className="mt-3 flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Cancel Booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this booking for {booking.user?.username}? 
                    This will free up the {isSubsystem ? 'subsystem' : 'system'} for others to book.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelBooking(booking.id, isSubsystem)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancel Booking
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading bookings...</div>
        </CardContent>
      </Card>
    );
  }

  const activeSystemBookings = systemBookings.filter(b => getBookingStatus(b).label === 'Active');
  const upcomingSystemBookings = systemBookings.filter(b => getBookingStatus(b).label === 'Upcoming');
  const activeSubsystemBookings = subsystemBookings.filter(b => getBookingStatus(b).label === 'Active');
  const upcomingSubsystemBookings = subsystemBookings.filter(b => getBookingStatus(b).label === 'Upcoming');

  return (
    <div className="space-y-6">
      {/* Sync Button */}
      <div className="flex justify-end">
        <Button
          onClick={syncBookingStatus}
          disabled={syncing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Booking Status'}
        </Button>
      </div>

      {/* Current Active Bookings */}
      {(activeSystemBookings.length > 0 || activeSubsystemBookings.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-green-600" />
              Currently Active Bookings
            </CardTitle>
            <CardDescription>
              Systems and subsystems that are currently locked for exclusive use
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeSystemBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
              {activeSubsystemBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isSubsystem />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Bookings
          </CardTitle>
          <CardDescription>
            Future scheduled bookings across all systems and subsystems
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingSystemBookings.length === 0 && upcomingSubsystemBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No upcoming bookings scheduled
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSystemBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
              {upcomingSubsystemBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isSubsystem />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBookingsList;