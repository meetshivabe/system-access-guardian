
import { useState } from "react";
import { Plus, Server, Clock, User, Trash2, Calendar, CalendarDays, Edit, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow, format } from "date-fns";
import BookingModal from "@/components/BookingModal";
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
  bookingStart?: Date | null;
  bookingEnd?: Date | null;
  bookings?: Array<{
    id: string;
    start: Date;
    end: Date;
    user: string;
  }>;
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
    id: string;
    start: Date;
    end: Date;
    user: string;
  }>;
}

interface SystemCardProps {
  system: System;
  currentUser: string;
  onBookSystem: (systemId: string, startDate: Date, endDate: Date, isSubsystem?: boolean) => void;
  onAddSubsystem: (systemId: string, subsystemName: string) => void;
  onDeleteSystem: (systemId: string) => void;
  onDeleteSubsystem: (systemId: string, subsystemId: string) => void;
  onUpdateDescription?: (systemId: string, description: string) => void;
  onUpdateSystemName?: (systemId: string, name: string) => void;
  onUpdateSubsystemName?: (subsystemId: string, name: string) => void;
  isAdmin: boolean;
}

const SystemCard = ({ 
  system, 
  currentUser, 
  onBookSystem,
  onAddSubsystem, 
  onDeleteSystem, 
  onDeleteSubsystem,
  onUpdateDescription,
  onUpdateSystemName,
  onUpdateSubsystemName,
  isAdmin 
}: SystemCardProps) => {
  const [showAddSubsystem, setShowAddSubsystem] = useState(false);
  const [subsystemName, setSubsystemName] = useState("");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingTarget, setBookingTarget] = useState<{ id: string; name: string; isSubsystem: boolean } | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(system.description);
  const [isEditingSystemName, setIsEditingSystemName] = useState(false);
  const [editedSystemName, setEditedSystemName] = useState(system.name);
  const [editingSubsystemId, setEditingSubsystemId] = useState<string | null>(null);
  const [editedSubsystemName, setEditedSubsystemName] = useState("");

  const handleAddSubsystem = () => {
    if (subsystemName.trim()) {
      onAddSubsystem(system.id, subsystemName.trim());
      setSubsystemName("");
      setShowAddSubsystem(false);
    }
  };

  const handleSaveDescription = () => {
    if (onUpdateDescription) {
      onUpdateDescription(system.id, editedDescription);
      setIsEditingDescription(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedDescription(system.description);
    setIsEditingDescription(false);
  };

  const handleSaveSystemName = () => {
    if (onUpdateSystemName && editedSystemName.trim()) {
      onUpdateSystemName(system.id, editedSystemName.trim());
      setIsEditingSystemName(false);
    }
  };

  const handleCancelSystemNameEdit = () => {
    setEditedSystemName(system.name);
    setIsEditingSystemName(false);
  };

  const handleSaveSubsystemName = (subsystemId: string) => {
    if (onUpdateSubsystemName && editedSubsystemName.trim()) {
      onUpdateSubsystemName(subsystemId, editedSubsystemName.trim());
      setEditingSubsystemId(null);
      setEditedSubsystemName("");
    }
  };

  const handleCancelSubsystemNameEdit = () => {
    setEditingSubsystemId(null);
    setEditedSubsystemName("");
  };

  const getStatusColor = (isLocked: boolean, lockedBy: string | null, bookings?: Array<{ start: Date; end: Date; user: string }>) => {
    const now = new Date();
    const futureBooking = bookings?.find(b => b.start > now);
    
    if (!isLocked && futureBooking) {
      return "bg-orange-100 text-orange-800 border-orange-200";
    }
    if (!isLocked) return "bg-green-100 text-green-800 border-green-200";
    if (lockedBy === currentUser) return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getStatusText = (isLocked: boolean, lockedBy: string | null, bookings?: Array<{ start: Date; end: Date; user: string }>) => {
    const now = new Date();
    const futureBooking = bookings?.find(b => b.start > now);
    const activeBooking = bookings?.find(b => b.start <= now && b.end > now);
    
    if (!isLocked && futureBooking) {
      return `Booked from ${format(futureBooking.start, 'MMM dd')}`;
    }
    if (!isLocked) return "Available";
    if (lockedBy === currentUser) return "Locked by You";
    // Show who has it locked for clarity
    if (lockedBy) return `Locked by ${lockedBy}`;
    // If we have an active booking but no lockedBy, show booking user
    if (activeBooking) return `Locked by ${activeBooking.user}`;
    return "Locked";
  };

  const isLockedByOthers = system.isLocked && system.lockedBy !== currentUser;
  const shouldDisableActions = !isAdmin && isLockedByOthers;

  return (
    <Card className={`hover:shadow-lg transition-all duration-300 border-2 ${shouldDisableActions ? 'opacity-60 hover:border-gray-200' : 'hover:border-blue-200'}`}>
      <CardHeader className="pb-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            {isEditingSystemName && isAdmin ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedSystemName}
                  onChange={(e) => setEditedSystemName(e.target.value)}
                  className="h-8 text-lg font-semibold"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleSaveSystemName();
                    if (e.key === 'Escape') handleCancelSystemNameEdit();
                  }}
                />
                <Button size="sm" onClick={handleSaveSystemName}>
                  <Save className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelSystemNameEdit}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <CardTitle 
                className={`text-lg font-semibold text-slate-800 whitespace-nowrap ${isAdmin ? 'cursor-pointer hover:text-blue-600' : ''}`}
                onClick={() => isAdmin && setIsEditingSystemName(true)}
              >
                {system.name}
                {isAdmin && (
                  <Edit className="inline-block h-3 w-3 ml-2 opacity-50" />
                )}
              </CardTitle>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`${getStatusColor(system.isLocked, system.lockedBy, system.bookings)} font-medium`}
            >
              {getStatusText(system.isLocked, system.lockedBy, system.bookings)}
            </Badge>
            {isAdmin && onUpdateDescription && !isEditingDescription && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingDescription(true)}
                title="Edit Description"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
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
        {isEditingDescription ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Enter system description..."
              className="min-h-[60px] text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveDescription}
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{system.description}</p>
        )}
        
        {system.isLocked && system.lockedBy && system.lockedAt && (
          <div className="flex flex-col gap-1 text-xs text-slate-500 mt-2">
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span>{system.lockedBy}</span>
              <Clock className="h-3 w-3 ml-2" />
              <span>{formatDistanceToNow(system.lockedAt, { addSuffix: true })}</span>
            </div>
            {system.bookingEnd && (
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3 w-3" />
                <span>Booked until: {format(system.bookingEnd, 'MMM dd')}</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setBookingTarget({ id: system.id, name: system.name, isSubsystem: false });
              setShowBookingModal(true);
            }}
            disabled={shouldDisableActions}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            <Calendar className="mr-2 h-4 w-4" />
            {shouldDisableActions ? 'Locked by Others' : 'Book System'}
          </Button>
        </div>

        {/* Show future bookings for admins */}
        {isAdmin && system.bookings && system.bookings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Future Bookings</h4>
            <div className="space-y-1">
              {system.bookings
                .filter(booking => booking.start > new Date())
                .map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-2 bg-orange-50 rounded-md text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-orange-600" />
                      <span>{format(booking.start, 'MMM dd')} - {format(booking.end, 'MMM dd')}</span>
                      <span className="text-slate-600">by {booking.user}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {system.subsystems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <span>Subsystems ({system.subsystems.length}/8)</span>
            </h4>
            <div className="space-y-2">
              {system.subsystems.map((subsystem) => {
                const isSubsystemLockedByOthers = subsystem.isLocked && subsystem.lockedBy !== currentUser;
                const shouldDisableSubsystem = !isAdmin && isSubsystemLockedByOthers;
                
                return (
                <div
                  key={subsystem.id}
                  className={`flex items-center justify-between p-2 rounded-lg border ${shouldDisableSubsystem ? 'bg-gray-50 opacity-60' : 'bg-slate-50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-nowrap">
                      {editingSubsystemId === subsystem.id && isAdmin ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editedSubsystemName}
                            onChange={(e) => setEditedSubsystemName(e.target.value)}
                            className="h-7 text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') handleSaveSubsystemName(subsystem.id);
                              if (e.key === 'Escape') handleCancelSubsystemNameEdit();
                            }}
                          />
                          <Button size="sm" className="h-7 px-2" onClick={() => handleSaveSubsystemName(subsystem.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleCancelSubsystemNameEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span 
                          className={`text-sm font-medium text-slate-700 truncate ${isAdmin ? 'cursor-pointer hover:text-blue-600' : ''}`} 
                          title={subsystem.name}
                          onClick={() => {
                            if (isAdmin) {
                              setEditingSubsystemId(subsystem.id);
                              setEditedSubsystemName(subsystem.name);
                            }
                          }}
                        >
                          {subsystem.name}
                          {isAdmin && (
                            <Edit className="inline-block h-3 w-3 ml-1 opacity-50" />
                          )}
                        </span>
                      )}
                      {editingSubsystemId !== subsystem.id && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs flex-shrink-0 ${getStatusColor(subsystem.isLocked, subsystem.lockedBy, subsystem.bookings)}`}
                        >
                          {getStatusText(subsystem.isLocked, subsystem.lockedBy, subsystem.bookings)}
                        </Badge>
                      )}
                    </div>
                    {subsystem.isLocked && subsystem.lockedBy && subsystem.lockedAt && (
                      <div className="flex flex-col gap-1 text-xs text-slate-500 mt-1">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{subsystem.lockedBy}</span>
                          <Clock className="h-3 w-3 ml-1" />
                          <span>{formatDistanceToNow(subsystem.lockedAt, { addSuffix: true })}</span>
                        </div>
                        {subsystem.bookingEnd && (
                          <div className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            <span>Until: {format(subsystem.bookingEnd, 'MMM dd')}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show future bookings for this subsystem (admin only) */}
                    {isAdmin && subsystem.bookings && subsystem.bookings.filter(b => b.start > new Date()).length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-orange-600">
                        <Calendar className="h-3 w-3" />
                        <span>{subsystem.bookings.filter(b => b.start > new Date()).length} future booking(s)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBookingTarget({ id: subsystem.id, name: subsystem.name, isSubsystem: true });
                        setShowBookingModal(true);
                      }}
                      disabled={shouldDisableSubsystem}
                      title={shouldDisableSubsystem ? "Locked by others" : "Book subsystem"}
                      className="border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Calendar className="h-3 w-3" />
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
              )})}
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

      {bookingTarget && (
        <BookingModal
          key={`booking-modal-${bookingTarget.id}-${system.bookings?.length || 0}-${system.subsystems.reduce((acc, s) => acc + (s.bookings?.length || 0), 0)}`}
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setBookingTarget(null);
          }}
          onConfirm={(startDate, endDate) => {
            onBookSystem(bookingTarget.id, startDate, endDate, bookingTarget.isSubsystem);
            setShowBookingModal(false);
            setBookingTarget(null);
          }}
          systemName={bookingTarget.name}
          isSubsystem={bookingTarget.isSubsystem}
          isAdmin={isAdmin}
          currentBooking={
            bookingTarget.isSubsystem
              ? system.subsystems.find(s => s.id === bookingTarget.id)?.bookingEnd
                ? {
                    start: system.subsystems.find(s => s.id === bookingTarget.id)!.bookingStart || new Date(),
                    end: system.subsystems.find(s => s.id === bookingTarget.id)!.bookingEnd!,
                    user: system.subsystems.find(s => s.id === bookingTarget.id)!.lockedBy || ''
                  }
                : null
              : system.bookingEnd
                ? {
                    start: system.bookingStart || new Date(),
                    end: system.bookingEnd,
                    user: system.lockedBy || ''
                  }
                : null
          }
          existingBookings={
            bookingTarget.isSubsystem
              ? system.subsystems.find(s => s.id === bookingTarget.id)?.bookings || []
              : system.bookings || []
          }
        />
      )}
    </Card>
  );
};

export default SystemCard;
