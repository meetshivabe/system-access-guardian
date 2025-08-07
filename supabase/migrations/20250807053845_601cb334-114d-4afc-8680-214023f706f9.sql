-- Create systems table
CREATE TABLE public.systems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES public.profiles(id),
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subsystems table
CREATE TABLE public.subsystems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES public.profiles(id),
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsystems ENABLE ROW LEVEL SECURITY;

-- Create policies for systems table
CREATE POLICY "Anyone can view systems" 
ON public.systems 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert systems" 
ON public.systems 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update systems" 
ON public.systems 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete systems" 
ON public.systems 
FOR DELETE 
USING (is_admin());

-- Create policies for subsystems table
CREATE POLICY "Anyone can view subsystems" 
ON public.subsystems 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert subsystems" 
ON public.subsystems 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update subsystems" 
ON public.subsystems 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete subsystems" 
ON public.subsystems 
FOR DELETE 
USING (is_admin());

-- Create triggers for updated_at
CREATE TRIGGER update_systems_updated_at
BEFORE UPDATE ON public.systems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subsystems_updated_at
BEFORE UPDATE ON public.subsystems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_systems_locked_by ON public.systems(locked_by);
CREATE INDEX idx_subsystems_system_id ON public.subsystems(system_id);
CREATE INDEX idx_subsystems_locked_by ON public.subsystems(locked_by);