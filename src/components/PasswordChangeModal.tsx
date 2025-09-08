import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: {
    id: string;
    email: string;
    username: string;
  } | null;
  isAdminReset?: boolean;
}

const PasswordChangeModal = ({
  isOpen,
  onClose,
  targetUser = null,
  isAdminReset = false,
}: PasswordChangeModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user } = useAuth();

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validatePassword = () => {
    if (!isAdminReset && !currentPassword) {
      setError('Current password is required');
      return false;
    }

    if (!newPassword) {
      setError('New password is required');
      return false;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (!isAdminReset && currentPassword === newPassword) {
      setError('New password must be different from current password');
      return false;
    }

    return true;
  };

  const handlePasswordChange = async () => {
    if (!validatePassword()) return;

    setLoading(true);
    setError('');

    try {
      if (isAdminReset && targetUser) {
        // Admin resetting another user's password
        const { error } = await supabase.auth.admin.updateUserById(
          targetUser.id,
          { password: newPassword }
        );

        if (error) {
          // Fallback to RPC function if direct admin API fails
          const { error: rpcError } = await supabase.rpc('admin_reset_user_password', {
            target_user_id: targetUser.id,
            new_password: newPassword
          });

          if (rpcError) throw rpcError;
        }

        toast({
          title: 'Success',
          description: `Password reset successfully for ${targetUser.username}`,
        });
      } else {
        // User changing their own password
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (updateError) {
          // If simple update fails, try with current password verification
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user?.email || '',
            password: currentPassword
          });

          if (signInError) {
            throw new Error('Current password is incorrect');
          }

          // Try updating again after verification
          const { error: retryError } = await supabase.auth.updateUser({
            password: newPassword
          });

          if (retryError) throw retryError;
        }

        toast({
          title: 'Success',
          description: 'Your password has been changed successfully',
        });
      }

      handleClose();
    } catch (error: any) {
      console.error('Error changing password:', error);
      setError(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {isAdminReset && targetUser 
              ? `Reset Password for ${targetUser.username}`
              : 'Change Password'
            }
          </DialogTitle>
          <DialogDescription>
            {isAdminReset && targetUser
              ? `Set a new password for ${targetUser.username}. They will need to use this password on their next login.`
              : 'Enter your current password and choose a new password.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!isAdminReset && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handlePasswordChange} disabled={loading}>
            {loading ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordChangeModal;