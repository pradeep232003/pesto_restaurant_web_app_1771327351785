-- Add categories array to menu_items for multi-category support
-- and add admin write policies

-- Add categories column (array of category slugs) to support multi-category items
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Populate categories from existing category column
UPDATE public.menu_items
SET categories = ARRAY[category]
WHERE categories = ARRAY[]::TEXT[] OR categories IS NULL;

-- Add index for categories array
CREATE INDEX IF NOT EXISTS idx_menu_items_categories ON public.menu_items USING GIN(categories);

-- Admin write policies for locations (authenticated users can manage)
DROP POLICY IF EXISTS "admin_write_locations" ON public.locations;
CREATE POLICY "admin_write_locations" ON public.locations
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Admin write policies for menu_items (authenticated users can manage)
DROP POLICY IF EXISTS "admin_write_menu_items" ON public.menu_items;
CREATE POLICY "admin_write_menu_items" ON public.menu_items
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Update existing items to have proper multi-category data
-- Breakfast items (items that could be breakfast)
UPDATE public.menu_items
SET categories = ARRAY['breakfast', 'mains']
WHERE name IN ('Full English Breakfast', 'Avocado Toast', 'Smoked Salmon Bagel', 'Cheese and Onion Toastie')
  AND categories = ARRAY[category];

-- Lunch and dinner items
UPDATE public.menu_items
SET categories = ARRAY['lunch', 'dinner', 'mains']
WHERE category = 'mains'
  AND name NOT IN ('Full English Breakfast', 'Avocado Toast', 'Smoked Salmon Bagel', 'Cheese and Onion Toastie');

-- Dessert items
UPDATE public.menu_items
SET categories = ARRAY['dessert']
WHERE category = 'desserts';

-- Beverage items
UPDATE public.menu_items
SET categories = ARRAY['beverage']
WHERE category = 'beverages';

-- Appetizer items available for lunch
UPDATE public.menu_items
SET categories = ARRAY['lunch', 'appetizer']
WHERE category = 'appetizers';

-- Scones available for breakfast and dessert
UPDATE public.menu_items
SET categories = ARRAY['breakfast', 'dessert']
WHERE name ILIKE '%scone%';

-- Soup available for lunch and dinner
UPDATE public.menu_items
SET categories = ARRAY['lunch', 'dinner', 'appetizer']
WHERE name ILIKE '%soup%';

-- Hot drinks available for breakfast and beverage
UPDATE public.menu_items
SET categories = ARRAY['breakfast', 'beverage']
WHERE category = 'beverages' AND (name ILIKE '%tea%' OR name ILIKE '%coffee%' OR name ILIKE '%latte%' OR name ILIKE '%chocolate%');
