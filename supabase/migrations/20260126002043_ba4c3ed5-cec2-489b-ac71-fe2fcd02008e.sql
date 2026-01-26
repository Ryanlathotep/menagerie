-- Create admin role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles (only admins can manage roles)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Game data overrides table
CREATE TABLE public.game_data_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type TEXT NOT NULL, -- 'moves', 'equipment', 'recipes', 'monsters', 'sprites'
  data_key TEXT NOT NULL, -- e.g., move ID, equipment ID
  data_value JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (data_type, data_key)
);

-- Enable RLS
ALTER TABLE public.game_data_overrides ENABLE ROW LEVEL SECURITY;

-- Everyone can read game data
CREATE POLICY "Anyone can read game data"
  ON public.game_data_overrides FOR SELECT
  USING (true);

-- Only admins can modify game data
CREATE POLICY "Admins can insert game data"
  ON public.game_data_overrides FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game data"
  ON public.game_data_overrides FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game data"
  ON public.game_data_overrides FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_game_data_overrides_updated_at
  BEFORE UPDATE ON public.game_data_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Sprite storage table for custom sprites
CREATE TABLE public.custom_sprites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprite_key TEXT NOT NULL UNIQUE, -- e.g., 'species_slime', 'element_fire'
  sprite_data JSONB NOT NULL, -- layers, pixel data, etc.
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_sprites ENABLE ROW LEVEL SECURITY;

-- Everyone can read sprites
CREATE POLICY "Anyone can read sprites"
  ON public.custom_sprites FOR SELECT
  USING (true);

-- Only admins can modify sprites
CREATE POLICY "Admins can insert sprites"
  ON public.custom_sprites FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sprites"
  ON public.custom_sprites FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sprites"
  ON public.custom_sprites FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_custom_sprites_updated_at
  BEFORE UPDATE ON public.custom_sprites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();