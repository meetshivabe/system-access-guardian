import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Server, Trash2, Clock } from 'lucide-react';
import { format, isAfter, isBefore } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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
}

const UserBookings = () => {
  const { user } = useAuth();
  const [systemBookings, setSystemBookings] = useState<Booking[]>([]);
  const [subsystemBookings, setSubsystemBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserBookings();
    }
  }, [user]);

  const fetchUserBookings = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const now = new Date();

      // Fetch user's system bookings
      const { data: sysBookings, error: sysError } = await supabase
        .from('system_bookings')
        .select(`
          *,
          system:systems(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('booking_end', now.toISOString())
        .order('booking_start', { ascending: true });

      if (sysError) throw sysError;

      // Fetch user's subsystem bookings
      const { data: subBookings, error: subError } = await supabase
        .from('subsystem_bookings')
        .select(`
          *,
          subsystem:subsystems(name),
          system:systems(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('booking_end', now.toISOString())
        .order('booking_start', { ascending: true });

      if (subError) throw subError;

      setSystemBookings(sysBookings || []);
      setSubsystemBookings(subBookings || []);
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch your bookings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId: string, isSubsystem: boolean) => {
    if (!user) return;
    
    try {
      // First try to use the RPC function if it exists
      const functionName = isSubsystem 
        ? 'cancel_user_subsystem_booking' 
        : 'cancel_user_system_booking';
      
      const { data: rpcData, error: rpcError } = await supabase
        .rpc(functionName, { 
          p_booking_id: bookingId,
          p_user_id: user.id 
        });

      if (!rpcError) {
        if (rpcData) {
          toast({
            title: 'Booking Cancelled',
            description: 'Your booking has been cancelled successfully.',
          });
        } else {
          toast({
            title: 'Error',
            description: 'Unable to cancel this booking.',
            variant: 'destructive',
          });
        }
      } else {
        // Fallback: Direct database operations if RPC function doesn't exist
        console.log('RPC function not available, using direct method');
        
        const table = isSubsystem ? 'subsystem_bookings' : 'system_bookings';
        
        // First verify the booking belongs to the user
        const { data: booking, error: fetchError } = await supabase
          .from(table)
          .select('*')
          .eq('id', bookingId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (fetchError || !booking) {
          toast({
            title: 'Error',
            description: 'Booking not found or you do not have permission to cancel it.',
            variant: 'destructive',
          });
          return;
        }
        
        // Cancel the booking
        const { error: updateError } = await supabase
          .from(table)
          .update({ status: 'cancelled' })
          .eq('id', bookingId)
          .eq('user_id', user.id);
        
        if (updateError) throw updateError;
        
        // Clear the system/subsystem booking fields if this was an active booking
        const now = new Date();
        const bookingStart = new Date(booking.booking_start);
        const bookingEnd = new Date(booking.booking_end);
        
        if (bookingStart <= now && bookingEnd > now) {
          // Booking is currently active, need to unlock
          if (isSubsystem) {
            await supabase
              .from('subsystems')
              .update({
                booking_start: null,
                booking_end: null,
                is_locked: false,
                locked_by: null,
                locked_at: null
              })
              .eq('id', booking.subsystem_id)
              .eq('locked_by', user.id);
          } else {
            await supabase
              .from('systems')
              .update({
                booking_start: null,
                booking_end: null,
                is_locked: false,
                locked_by: null,
                locked_at: null
              })
              .eq('id', booking.system_id)
              .eq('locked_by', user.id);
          }
        }
        
        toast({
          title: 'Booking Cancelled',
          description: 'Your booking has been cancelled successfully.',
        });
      }

      // Refresh bookings
      fetchUserBookings();
      
      // Trigger a page refresh to update the main view
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel booking.',
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading your bookings...</div>
        </CardContent>
      </Card>
    );
  }

  const totalBookings = systemBookings.length + subsystemBookings.length;

  if (totalBookings === 0) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-4 w-4" />
            My Bookings
          </CardTitle>
          <CardDescription className="text-xs">
            No active or upcoming bookings
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-4 w-4" />
          My Bookings ({totalBookings})
        </CardTitle>
        <CardDescription className="text-xs">
          Manage your reservations
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-300px)] overflow-y-auto">
        <div className="space-y-2">
          {/* System Bookings */}
          {systemBookings.map((booking) => {
            const status = getBookingStatus(booking);
            const canCancel = booking.status === 'active' && (status.label === 'Active' || status.label === 'Upcoming');

            return (
              <div
                key={booking.id}
                className={`p-3 border rounded-lg ${status.label === 'Active' ? 'bg-green-50 border-green-200' : 'bg-card'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <Server className="h-3 w-3 text-primary" />
                    <span className="font-medium text-sm">{booking.system?.name}</span>
                  </div>
                  <Badge variant={status.variant} className="text-xs px-2 py-0">{status.label}</Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className="line-clamp-1">
                      {format(new Date(booking.booking_start), 'MMM dd HH:mm')} - 
                      {format(new Date(booking.booking_end), 'MMM dd HH:mm')}
                    </span>
                  </div>
                </div>

                {canCancel && (
                  <div className="mt-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="w-full text-xs py-1">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel your booking for {booking.system?.name}? 
                            This will free up the system for others to book.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => cancelBooking(booking.id, false)}
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
          })}

          {/* Subsystem Bookings */}
          {subsystemBookings.map((booking) => {
            const status = getBookingStatus(booking);
            const canCancel = booking.status === 'active' && (status.label === 'Active' || status.label === 'Upcoming');

            return (
              <div
                key={booking.id}
                className={`p-3 border rounded-lg ${status.label === 'Active' ? 'bg-green-50 border-green-200' : 'bg-card'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-sm">{booking.subsystem?.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">({booking.system?.name})</span>
                  </div>
                  <Badge variant={status.variant} className="text-xs px-2 py-0">{status.label}</Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className="line-clamp-1">
                      {format(new Date(booking.booking_start), 'MMM dd HH:mm')} - 
                      {format(new Date(booking.booking_end), 'MMM dd HH:mm')}
                    </span>
                  </div>
                </div>

                {canCancel && (
                  <div className="mt-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="w-full text-xs py-1">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel your booking for {booking.subsystem?.name}? 
                            This will free up the subsystem for others to book.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => cancelBooking(booking.id, true)}
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
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserBookings;