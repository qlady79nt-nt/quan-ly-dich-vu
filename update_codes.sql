-- Add invoice_code to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_code TEXT;

-- Update existing invoices with a generated invoice_code if they don't have one
-- (Using a simple generation logic: HD + 2 digit year + 4 random digits)
UPDATE invoices 
SET invoice_code = 'HD' || to_char(created_at, 'YY') || lpad(floor(random() * 10000)::text, 4, '0')
WHERE invoice_code IS NULL;

-- Make invoice_code unique
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_code_key UNIQUE (invoice_code);

-- Add session_code to service_sessions just in case
ALTER TABLE service_sessions ADD COLUMN IF NOT EXISTS session_code TEXT;

-- Update existing sessions
UPDATE service_sessions 
SET session_code = 'P' || lpad(floor(random() * 100)::text, 2, '0') || substring(id::text from 1 for 6)
WHERE session_code IS NULL;
