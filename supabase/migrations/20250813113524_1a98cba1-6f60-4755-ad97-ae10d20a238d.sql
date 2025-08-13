-- Add utilization tracking tables
CREATE TABLE public.system_utilization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN unlocked_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (unlocked_at - locked_at)) / 60
      ELSE 
        NULL
    END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.subsystem_utilization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subsystem_id UUID NOT NULL REFERENCES public.subsystems(id) ON DELETE CASCADE,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN unlocked_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (unlocked_at - locked_at)) / 60
      ELSE 
        NULL
    END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_utilization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsystem_utilization ENABLE ROW LEVEL SECURITY;

-- RLS policies for system_utilization
CREATE POLICY "Users can view all utilization data" 
ON public.system_utilization 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert utilization records" 
ON public.system_utilization 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update utilization records" 
ON public.system_utilization 
FOR UPDATE 
USING (true);

-- RLS policies for subsystem_utilization
CREATE POLICY "Users can view all subsystem utilization data" 
ON public.subsystem_utilization 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert subsystem utilization records" 
ON public.subsystem_utilization 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update subsystem utilization records" 
ON public.subsystem_utilization 
FOR UPDATE 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_system_utilization_system_id ON public.system_utilization(system_id);
CREATE INDEX idx_system_utilization_user_id ON public.system_utilization(user_id);
CREATE INDEX idx_subsystem_utilization_subsystem_id ON public.subsystem_utilization(subsystem_id);
CREATE INDEX idx_subsystem_utilization_system_id ON public.subsystem_utilization(system_id);
CREATE INDEX idx_subsystem_utilization_user_id ON public.subsystem_utilization(user_id);