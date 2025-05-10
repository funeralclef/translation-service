-- Add customer_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'order_assignments' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE order_assignments ADD COLUMN customer_id UUID;
    END IF;
END $$;

-- Update existing records with customer_id from orders table
UPDATE order_assignments oa
SET customer_id = o.customer_id
FROM orders o
WHERE oa.order_id = o.id AND oa.customer_id IS NULL;

-- Add foreign key constraint if it doesn't exist (correctly checked)
DO $$
DECLARE
    fk_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_assignments_customer_id_fkey'
    ) INTO fk_exists;

    IF NOT fk_exists THEN
        ALTER TABLE order_assignments 
        ADD CONSTRAINT order_assignments_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES users(id);
    END IF;
END $$;

-- Add assigned_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'order_assignments' AND column_name = 'assigned_at'
    ) THEN
        ALTER TABLE order_assignments ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;
