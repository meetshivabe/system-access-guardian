
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AddSystemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string) => void;
}

const AddSystemDialog = ({ isOpen, onClose, onAdd }: AddSystemDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim(), description.trim());
      setName("");
      setDescription("");
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New System</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="system-name" className="text-sm font-medium">
              System Name *
            </Label>
            <Input
              id="system-name"
              placeholder="e.g., Production Server Alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="system-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="system-description"
              placeholder="Brief description of the system's purpose and specifications"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              Add System
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSystemDialog;
