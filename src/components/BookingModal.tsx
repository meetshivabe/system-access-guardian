import { useState, useMemo, useEffect } from 'react';
import { Calendar, AlertCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, addDays, isBefore, differenceInDays, startOfDay, endOfDay } from 'date-fns';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (startDate: Date, endDate: Date) => void;
  systemName: string;
  isSubsystem?: boolean;
  isAdmin?: boolean;
  currentBooking?: {
    start: Date;
    end: Date;
    user: string;
  } | null;
  existingBookings?: Array<{
    start: Date;
    end: Date;
    user: string;
  }>;
}

const BookingModal = ({
  isOpen,
  onClose,
  onConfirm,
  systemName,
  isSubsystem = false,
  isAdmin = false,
  currentBooking = null,
  existingBookings = [],
}: BookingModalProps) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [warning, setWarning] = useState<string>('');
  const [remainingBookings, setRemainingBookings] = useState<number | null>(null);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchRemainingBookings = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .rpc('get_user_remaining_bookings', { p_user_id: user.id });
      
      if (!error && data !== null) {
        setRemainingBookings(data);
      }
    };
    
    if (isOpen) {
      fetchRemainingBookings();
    }
  }, [isOpen, user]);

  const validateBooking = () => {
    setError('');
    setWarning('');

    if (!startDate || !endDate) {
      setError('Please fill in both start and end dates');
      return false;
    }

    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    const now = startOfDay(new Date());

    // Check if start date is in the past
    if (isBefore(start, now)) {
      setError('Booking start time cannot be in the past');
      return false;
    }

    // Check if end date is before start date
    if (isBefore(end, start)) {
      setError('End time must be after start time');
      return false;
    }

    // Check if booking exceeds 2 days
    // We use startOfDay for comparison since we apply endOfDay to the end date
    const daysDiff = differenceInDays(startOfDay(end), startOfDay(start));
    if (daysDiff > 2) {
      setError('Booking duration cannot exceed 2 days');
      return false;
    }

    // Check for conflicts with current booking
    if (currentBooking) {
      const currentStart = new Date(currentBooking.start);
      const currentEnd = new Date(currentBooking.end);
      
      const conflictsWithCurrent = 
        (start <= currentEnd && end >= currentStart);
      
      if (conflictsWithCurrent) {
        if (isAdmin) {
          setWarning(`Warning: This will override the current booking by ${currentBooking.user}`);
        } else {
          setError(`This system is already booked by ${currentBooking.user} for these dates`);
          return false;
        }
      }
    }

    // Check for conflicts with existing bookings
    const conflictingBookings = existingBookings.filter(booking => {
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);
      
      return (
        (start >= bookingStart && start < bookingEnd) ||
        (end > bookingStart && end <= bookingEnd) ||
        (start <= bookingStart && end >= bookingEnd)
      );
    });

    if (conflictingBookings.length > 0) {
      if (isAdmin) {
        const users = [...new Set(conflictingBookings.map(b => b.user))].join(', ');
        setWarning(`Warning: This will override bookings by: ${users}`);
      } else {
        setError('This time slot conflicts with existing bookings');
        return false;
      }
    }

    return true;
  };

  const handleConfirm = () => {
    if (validateBooking()) {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      onConfirm(start, end);
      resetForm();
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setError('');
    setWarning('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  
  // Set max date to 30 days from now (reasonable limit for future bookings)
  const maxDate = addDays(new Date(), 30).toISOString().split('T')[0];
  
  // Generate list of booked dates for visual indication
  const bookedDates = useMemo(() => {
    const dates = new Set<string>();
    
    // Add dates from existing bookings (filter out any past bookings)
    const now = new Date();
    existingBookings
      .filter(booking => new Date(booking.end) > now) // Only include bookings that haven't ended
      .forEach(booking => {
        const start = startOfDay(new Date(booking.start));
        const end = startOfDay(new Date(booking.end));
        
        let current = start;
        while (current <= end) {
          dates.add(current.toISOString().split('T')[0]);
          current = addDays(current, 1);
        }
      });
    
    // Add dates from current booking if exists and not expired
    if (currentBooking && new Date(currentBooking.end) > now) {
      const start = startOfDay(new Date(currentBooking.start));
      const end = startOfDay(new Date(currentBooking.end));
      
      let current = start;
      while (current <= end) {
        dates.add(current.toISOString().split('T')[0]);
        current = addDays(current, 1);
      }
    }
    
    return dates;
  }, [existingBookings, currentBooking]);

  return (
    <>
      <style>{`
        /* Style for unavailable dates - this is a visual hint since native date pickers don't support custom date styling */
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
        }
        
        /* Custom validation styling */
        .date-input-error {
          border-color: rgb(239 68 68) !important;
        }
        
        .date-input-warning {
          border-color: rgb(251 146 60) !important;
        }
      `}</style>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Book {isSubsystem ? 'Subsystem' : 'System'}: {systemName}
          </DialogTitle>
          <DialogDescription>
            Schedule a time to lock this {isSubsystem ? 'subsystem' : 'system'} for your exclusive use.
            Maximum booking duration is 2 days.
          </DialogDescription>
          {remainingBookings !== null && (
            <div className={`flex items-center gap-2 mt-2 text-sm ${remainingBookings === 0 ? 'text-red-600' : 'text-blue-600'}`}>
              <Info className="h-4 w-4" />
              <span>
                {remainingBookings === 0 
                  ? 'You have reached the maximum of 5 active bookings'
                  : `You have ${remainingBookings} booking slot${remainingBookings === 1 ? '' : 's'} remaining (max 5)`
                }
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <div className="relative">
              <input
                id="start-date"
                type="date"
                className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${
                  bookedDates.has(startDate) ? (isAdmin ? 'date-input-warning' : 'date-input-error') : ''
                }`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
                max={maxDate}
                style={{
                  colorScheme: 'light'
                }}
              />
              {bookedDates.has(startDate) && !isAdmin && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                </div>
              )}
            </div>
            {bookedDates.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Orange dates have existing bookings (admin can override)" : "Red dates are unavailable"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <div className="relative">
              <input
                id="end-date"
                type="date"
                className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${
                  bookedDates.has(endDate) ? (isAdmin ? 'date-input-warning' : 'date-input-error') : ''
                }`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
                max={maxDate}
                style={{
                  colorScheme: 'light'
                }}
              />
              {bookedDates.has(endDate) && !isAdmin && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          {bookedDates.size > 0 && (
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Unavailable Dates:</p>
              <div className="flex flex-wrap gap-1">
                {Array.from(bookedDates).sort().slice(0, 10).map((date) => (
                  <span 
                    key={date} 
                    className={`px-2 py-1 text-xs rounded ${
                      isAdmin ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {format(new Date(date), 'MMM dd')}
                  </span>
                ))}
                {bookedDates.size > 10 && (
                  <span className="px-2 py-1 text-xs text-muted-foreground">
                    +{bookedDates.size - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {warning && !error && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">{warning}</AlertDescription>
            </Alert>
          )}

          {existingBookings.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Bookings</Label>
              <div className="max-h-32 overflow-y-auto space-y-1 text-sm border rounded-md p-2">
                {existingBookings.map((booking, index) => {
                  const bookingStart = new Date(booking.start);
                  const bookingEnd = new Date(booking.end);
                  const isConflict = startDate && endDate && 
                    new Date(startDate) <= bookingEnd && 
                    new Date(endDate) >= bookingStart;
                  
                  return (
                    <div 
                      key={index} 
                      className={`flex items-center gap-2 ${isConflict ? (isAdmin ? 'text-orange-600' : 'text-red-600') : 'text-muted-foreground'}`}
                    >
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(bookingStart, 'MMM dd')} - 
                        {format(bookingEnd, 'MMM dd')} 
                        ({booking.user})
                      </span>
                      {isConflict && (
                        <span className="text-xs">
                          {isAdmin ? '(will override)' : '(conflict)'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={remainingBookings === 0}
            className={warning ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            {remainingBookings === 0 ? "No Booking Slots" : warning ? "Override & Book" : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default BookingModal;