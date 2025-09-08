import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, Shield, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import AdminBookingsList from '@/components/AdminBookingsList';
import PasswordChangeModal from '@/components/PasswordChangeModal';
import { Key } from 'lucide-react';

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  user_roles: { role: string }[];
}


const Admin = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<User | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Then get user roles for each user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            ...profile,
            user_roles: roles || []
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Create user through Supabase Admin API
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          full_name: fullName,
          username: email.split('@')[0]
        },
        email_confirm: true
      });

      if (error) throw error;

      // If user should be admin, add admin role
      if (role === 'admin' && data.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: 'admin'
          });

        if (roleError) {
          console.error('Error assigning admin role:', roleError);
        }
      }

      toast({
        title: 'User Created',
        description: `${email} has been created successfully.`,
      });

      setEmail('');
      setPassword('');
      setFullName('');
      setRole('user');
      fetchUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleUserRole = async (userId: string, currentRoles: { role: string }[]) => {
    try {
      const hasAdminRole = currentRoles.some(r => r.role === 'admin');
      
      if (hasAdminRole) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        
        if (error) throw error;
        
        toast({
          title: 'Role Updated',
          description: 'Admin role removed from user.',
        });
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'admin'
          });
        
        if (error) throw error;
        
        toast({
          title: 'Role Updated',
          description: 'Admin role granted to user.',
        });
      }
      
      fetchUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user role.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) throw error;
      
      toast({
        title: 'User Deleted',
        description: `${userEmail} has been deleted.`,
      });
      
      fetchUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };


  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-xl font-bold text-slate-800">
              Access Denied
            </CardTitle>
            <CardDescription>
              You need admin privileges to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Admin Dashboard
          </h1>
          <p className="text-slate-600">
            Manage users and their permissions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Create User Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create New User
              </CardTitle>
              <CardDescription>
                Add a new user to the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-fullname">Full Name</Label>
                  <Input
                    id="new-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-role">Role</Label>
                  <Select value={role} onValueChange={(value: 'user' | 'admin') => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create User'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Users List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Users ({users.length})
                </CardTitle>
                <CardDescription>
                  Manage existing users and their roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No users found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((user) => {
                      const isCurrentUser = user.id === currentUser?.id;
                      const hasAdminRole = user.user_roles?.some(r => r.role === 'admin');
                      
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-card"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-foreground">
                                {user.full_name || user.username}
                              </span>
                              {hasAdminRole && (
                                <Badge variant="secondary">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Admin
                                </Badge>
                              )}
                              {isCurrentUser && (
                                <Badge variant="outline">You</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Created: {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!isCurrentUser && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleUserRole(user.id, user.user_roles || [])}
                                >
                                  {hasAdminRole ? 'Remove Admin' : 'Make Admin'}
                                </Button>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPasswordResetTarget(user);
                                    setShowPasswordModal(true);
                                  }}
                                  title="Reset Password"
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete {user.email}? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteUser(user.id, user.email)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bookings Management Section */}
        <AdminBookingsList />
      </div>
      
      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordResetTarget(null);
        }}
        targetUser={passwordResetTarget}
        isAdminReset={true}
      />
    </div>
  );
};

export default Admin;