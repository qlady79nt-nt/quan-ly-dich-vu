ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS work_start_time TIME;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS work_end_time TIME;
