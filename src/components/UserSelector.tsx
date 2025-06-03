
import { useState } from "react";
import { User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface UserSelectorProps {
  currentUser: string;
  onUserChange: (user: string) => void;
}

const users = [
  "current.user@example.com",
  "john.doe@example.com",
  "jane.smith@example.com",
  "admin@example.com",
  "developer@example.com"
];

const UserSelector = ({ currentUser, onUserChange }: UserSelectorProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="bg-white hover:bg-slate-50 border-slate-200">
          <User className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">{currentUser}</span>
          <span className="sm:hidden">User</span>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-white border-slate-200">
        {users.map((user) => (
          <DropdownMenuItem
            key={user}
            onClick={() => onUserChange(user)}
            className="flex items-center justify-between p-3 hover:bg-slate-50"
          >
            <span className="text-sm">{user}</span>
            {user === currentUser && (
              <Badge variant="secondary" className="text-xs">
                Current
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserSelector;
