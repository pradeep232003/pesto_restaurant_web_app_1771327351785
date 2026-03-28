-- Locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Menu items table with location reference
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    image_url TEXT,
    image_alt TEXT,
    category TEXT NOT NULL DEFAULT 'mains',
    dietary TEXT[] DEFAULT ARRAY[]::TEXT[],
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    featured BOOLEAN DEFAULT false,
    rating DECIMAL(3,1) DEFAULT 4.0,
    review_count INTEGER DEFAULT 0,
    prep_time INTEGER DEFAULT 15,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_locations_slug ON public.locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_is_active ON public.locations(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_items_location_id ON public.menu_items(location_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON public.menu_items(is_available);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Public read access for locations
DROP POLICY IF EXISTS "public_read_locations" ON public.locations;
CREATE POLICY "public_read_locations" ON public.locations
FOR SELECT TO public USING (true);

-- Public read access for menu items
DROP POLICY IF EXISTS "public_read_menu_items" ON public.menu_items;
CREATE POLICY "public_read_menu_items" ON public.menu_items
FOR SELECT TO public USING (true);

-- Insert sample data
DO $$
DECLARE
    loc_timperley UUID := gen_random_uuid();
    loc_howe_bridge UUID := gen_random_uuid();
    loc_chaddesden UUID := gen_random_uuid();
    loc_oakmere UUID := gen_random_uuid();
    loc_willowmere UUID := gen_random_uuid();
BEGIN
    -- Insert locations
    INSERT INTO public.locations (id, name, slug, address, sort_order) VALUES
        (loc_timperley, 'Timperley, Altrincham', 'timperley-altrincham', 'Timperley, Altrincham', 1),
        (loc_howe_bridge, 'Howe Bridge, Atherton', 'howe-bridge-atherton', 'Howe Bridge, Atherton', 2),
        (loc_chaddesden, 'Chaddesden, Derby', 'chaddesden-derby', 'Chaddesden, Derby', 3),
        (loc_oakmere, 'Oakmere, Handforth', 'oakmere-handforth', 'Oakmere, Handforth', 4),
        (loc_willowmere, 'Willowmere, Middlewich', 'willowmere-middlewich', 'Willowmere, Middlewich', 5)
    ON CONFLICT (slug) DO NOTHING;

    -- Menu items for Timperley, Altrincham
    INSERT INTO public.menu_items (location_id, name, subtitle, description, price, original_price, image_url, image_alt, category, dietary, tags, featured, rating, review_count, prep_time) VALUES
        (loc_timperley, 'Truffle Mushroom Risotto', 'Creamy Arborio rice with wild mushrooms', 'A rich and creamy risotto made with Arborio rice, wild mushrooms, truffle oil, and Parmesan cheese.', 28.99, 32.99, 'https://images.unsplash.com/photo-1692348023709-47ff577f7277', 'Creamy mushroom risotto garnished with fresh herbs', 'mains', ARRAY['vegetarian','gluten-free'], ARRAY['signature','premium'], true, 4.8, 124, 25),
        (loc_timperley, 'Grilled Atlantic Salmon', 'Fresh salmon with lemon herb butter', 'Fresh Atlantic salmon grilled to perfection with seasonal vegetables and roasted potatoes.', 34.99, NULL, 'https://images.unsplash.com/photo-1722865382854-c2ac135189f5', 'Grilled salmon fillet with roasted vegetables', 'mains', ARRAY['gluten-free','keto'], ARRAY['healthy','protein-rich'], false, 4.6, 89, 20),
        (loc_timperley, 'Crispy Calamari Rings', 'Golden fried squid with marinara', 'Fresh squid rings lightly battered and fried to golden perfection with house-made marinara sauce.', 16.99, NULL, 'https://images.unsplash.com/photo-1639024469010-44d77e559f7d', 'Golden-brown crispy calamari rings with marinara', 'appetizers', ARRAY[]::TEXT[], ARRAY['crispy','seafood'], true, 4.4, 156, 12),
        (loc_timperley, 'Classic Tiramisu', 'Traditional Italian dessert', 'Layers of coffee-soaked ladyfingers and mascarpone cream, dusted with cocoa powder.', 12.99, NULL, 'https://images.unsplash.com/photo-1712262582604-4cbafeeca156', 'Slice of tiramisu with distinct layers', 'desserts', ARRAY['vegetarian'], ARRAY['traditional','coffee'], false, 4.7, 203, 5),
        (loc_timperley, 'Craft Beer Selection', 'Local brewery favorites', 'Rotating selection of craft beers from local breweries.', 8.99, NULL, 'https://images.unsplash.com/photo-1565291133543-2c86c724f847', 'Three different craft beer glasses', 'beverages', ARRAY['vegan'], ARRAY['local','craft'], true, 4.3, 67, 2),
        (loc_timperley, 'Chocolate Lava Cake', 'Warm cake with molten center', 'Decadent chocolate cake with a molten chocolate center, served with vanilla ice cream.', 11.99, NULL, 'https://images.unsplash.com/photo-1457823622778-ccdb4b7aa62d', 'Chocolate lava cake with molten chocolate flowing out', 'desserts', ARRAY['vegetarian'], ARRAY['warm','chocolate'], true, 4.9, 287, 8),
        (loc_timperley, 'Buffalo Chicken Wings', 'Spicy wings with blue cheese', 'Crispy chicken wings tossed in our signature buffalo sauce with celery sticks.', 15.99, NULL, 'https://images.unsplash.com/photo-1624726175512-19b9baf9fbd1', 'Golden-brown buffalo chicken wings', 'appetizers', ARRAY['gluten-free'], ARRAY['spicy','wings'], false, 4.3, 178, 15),
        (loc_timperley, 'Fresh Fruit Smoothie', 'Blend of seasonal fruits', 'Refreshing smoothie made with seasonal fresh fruits, yogurt, and honey.', 7.99, NULL, 'https://images.unsplash.com/photo-1662130187270-a4d52c700eb6', 'Three colorful fruit smoothies in tall glasses', 'beverages', ARRAY['vegetarian','gluten-free'], ARRAY['healthy','fresh'], false, 4.1, 45, 5)
    ON CONFLICT (id) DO NOTHING;

    -- Menu items for Howe Bridge, Atherton
    INSERT INTO public.menu_items (location_id, name, subtitle, description, price, original_price, image_url, image_alt, category, dietary, tags, featured, rating, review_count, prep_time) VALUES
        (loc_howe_bridge, 'BBQ Pulled Pork Sandwich', 'Slow-cooked pork with house BBQ sauce', 'Tender pulled pork slow-cooked for 12 hours and tossed in our signature BBQ sauce on a brioche bun.', 18.99, NULL, 'https://images.unsplash.com/photo-1545196353-e431cf8d0803', 'BBQ pulled pork sandwich on brioche bun', 'mains', ARRAY[]::TEXT[], ARRAY['bbq','comfort'], true, 4.4, 112, 18),
        (loc_howe_bridge, 'Spinach & Artichoke Dip', 'Creamy dip with tortilla chips', 'Our signature creamy spinach and artichoke dip served hot with crispy tortilla chips.', 14.99, NULL, 'https://images.unsplash.com/photo-1703219339970-98cd69cc896f', 'Creamy spinach artichoke dip in cast iron skillet', 'appetizers', ARRAY['vegetarian'], ARRAY['sharing','comfort'], false, 4.2, 134, 10),
        (loc_howe_bridge, 'Mediterranean Quinoa Bowl', 'Healthy grain bowl with fresh vegetables', 'Nutritious quinoa bowl topped with roasted vegetables, chickpeas, feta cheese, and tahini dressing.', 19.99, NULL, 'https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf', 'Colorful quinoa bowl with roasted vegetables', 'mains', ARRAY['vegetarian','gluten-free'], ARRAY['healthy','mediterranean'], false, 4.5, 91, 15),
        (loc_howe_bridge, 'Vanilla Bean Creme Brulee', 'Classic French dessert', 'Rich vanilla custard topped with caramelized sugar, served with fresh seasonal berries.', 13.99, NULL, 'https://images.unsplash.com/photo-1607235780843-a196b94386b4', 'Creme brulee in white ramekin with caramelized sugar', 'desserts', ARRAY['vegetarian','gluten-free'], ARRAY['french','classic'], false, 4.6, 95, 3),
        (loc_howe_bridge, 'Grilled Chicken Burger', 'Juicy chicken with house sauce', 'Tender grilled chicken breast with lettuce, tomato, and our signature house sauce on a toasted bun.', 16.99, NULL, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd', 'Grilled chicken burger with fresh toppings', 'mains', ARRAY[]::TEXT[], ARRAY['grilled','popular'], true, 4.5, 201, 15),
        (loc_howe_bridge, 'Iced Latte', 'Smooth cold coffee with milk', 'Freshly brewed espresso poured over ice with your choice of milk.', 5.99, NULL, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735', 'Iced latte in tall glass with ice', 'beverages', ARRAY['vegetarian'], ARRAY['coffee','cold'], true, 4.7, 312, 3),
        (loc_howe_bridge, 'Garlic Bread', 'Toasted bread with garlic butter', 'Freshly baked bread toasted with our house garlic butter and herbs.', 6.99, NULL, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c', 'Golden garlic bread slices with herbs', 'appetizers', ARRAY['vegetarian'], ARRAY['bread','sharing'], false, 4.2, 88, 8)
    ON CONFLICT (id) DO NOTHING;

    -- Menu items for Chaddesden, Derby
    INSERT INTO public.menu_items (location_id, name, subtitle, description, price, original_price, image_url, image_alt, category, dietary, tags, featured, rating, review_count, prep_time) VALUES
        (loc_chaddesden, 'Fish and Chips', 'Classic British favourite', 'Beer-battered cod fillet served with thick-cut chips, mushy peas, and tartar sauce.', 17.99, NULL, 'https://images.unsplash.com/photo-1579208570378-8c970854bc23', 'Classic fish and chips with mushy peas', 'mains', ARRAY[]::TEXT[], ARRAY['classic','british'], true, 4.7, 345, 20),
        (loc_chaddesden, 'Chicken Tikka Masala', 'Rich and creamy curry', 'Tender chicken pieces in a rich, creamy tomato-based sauce with aromatic spices. Served with basmati rice.', 16.99, NULL, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641', 'Chicken tikka masala with basmati rice', 'mains', ARRAY['gluten-free'], ARRAY['curry','spicy'], true, 4.8, 289, 25),
        (loc_chaddesden, 'Prawn Cocktail', 'Classic starter with Marie Rose sauce', 'Plump prawns served on a bed of crisp lettuce with our house Marie Rose sauce and brown bread.', 12.99, NULL, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0', 'Prawn cocktail with Marie Rose sauce', 'appetizers', ARRAY['gluten-free'], ARRAY['classic','seafood'], false, 4.3, 112, 8),
        (loc_chaddesden, 'Sticky Toffee Pudding', 'Warm British classic', 'Moist sponge pudding drenched in warm toffee sauce, served with vanilla ice cream.', 9.99, NULL, 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e', 'Sticky toffee pudding with toffee sauce', 'desserts', ARRAY['vegetarian'], ARRAY['british','warm'], true, 4.9, 198, 10),
        (loc_chaddesden, 'English Breakfast Tea', 'Traditional loose-leaf brew', 'A proper cup of English Breakfast tea served with milk and your choice of sweetener.', 3.99, NULL, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc', 'English breakfast tea in white ceramic cup', 'beverages', ARRAY['vegan','gluten-free'], ARRAY['tea','british'], false, 4.5, 156, 5),
        (loc_chaddesden, 'Cheese and Onion Toastie', 'Melted cheese with caramelised onion', 'Thick-cut bread filled with mature cheddar and sweet caramelised onions, toasted to perfection.', 8.99, NULL, 'https://images.unsplash.com/photo-1528736235302-52922df5c122', 'Cheese and onion toastie cut in half', 'appetizers', ARRAY['vegetarian'], ARRAY['comfort','cheese'], false, 4.4, 134, 10),
        (loc_chaddesden, 'Lamb Shank', 'Slow-braised with root vegetables', 'Tender lamb shank slow-braised in red wine with root vegetables and fresh herbs. Served with mashed potato.', 24.99, NULL, 'https://images.unsplash.com/photo-1544025162-d76694265947', 'Slow-braised lamb shank with mashed potato', 'mains', ARRAY['gluten-free'], ARRAY['premium','slow-cooked'], false, 4.6, 87, 30)
    ON CONFLICT (id) DO NOTHING;

    -- Menu items for Oakmere, Handforth
    INSERT INTO public.menu_items (location_id, name, subtitle, description, price, original_price, image_url, image_alt, category, dietary, tags, featured, rating, review_count, prep_time) VALUES
        (loc_oakmere, 'Avocado Toast', 'Smashed avocado on sourdough', 'Creamy smashed avocado on toasted sourdough with cherry tomatoes, feta, and a poached egg.', 13.99, NULL, 'https://images.unsplash.com/photo-1541519227354-08fa5d50c820', 'Avocado toast on sourdough with poached egg', 'appetizers', ARRAY['vegetarian'], ARRAY['healthy','brunch'], true, 4.6, 234, 10),
        (loc_oakmere, 'Pesto Pasta', 'Fresh basil pesto with linguine', 'Al dente linguine tossed in our house-made basil pesto with pine nuts and Parmesan shavings.', 15.99, NULL, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601', 'Pesto pasta with pine nuts and parmesan', 'mains', ARRAY['vegetarian'], ARRAY['pasta','italian'], true, 4.5, 167, 15),
        (loc_oakmere, 'Halloumi Fries', 'Crispy fried halloumi with dip', 'Golden-fried halloumi sticks served with sweet chilli dipping sauce and fresh mint yoghurt.', 11.99, NULL, 'https://images.unsplash.com/photo-1601050690597-df0568f70950', 'Crispy halloumi fries with dipping sauce', 'appetizers', ARRAY['vegetarian','gluten-free'], ARRAY['crispy','cheese'], true, 4.7, 289, 10),
        (loc_oakmere, 'Vegan Buddha Bowl', 'Nourishing plant-based bowl', 'A vibrant bowl of roasted sweet potato, edamame, pickled red cabbage, avocado, and tahini dressing.', 16.99, NULL, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd', 'Colourful vegan buddha bowl with tahini', 'mains', ARRAY['vegan','gluten-free'], ARRAY['healthy','plant-based'], false, 4.4, 145, 15),
        (loc_oakmere, 'Matcha Latte', 'Japanese green tea with steamed milk', 'Premium ceremonial grade matcha whisked with steamed oat milk. Available hot or iced.', 5.99, NULL, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a', 'Matcha latte in ceramic cup with latte art', 'beverages', ARRAY['vegan'], ARRAY['matcha','healthy'], false, 4.5, 178, 5),
        (loc_oakmere, 'Lemon Tart', 'Zesty French-style tart', 'Crisp pastry shell filled with silky smooth lemon curd, topped with fresh raspberries and icing sugar.', 8.99, NULL, 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13', 'Lemon tart with raspberries and icing sugar', 'desserts', ARRAY['vegetarian'], ARRAY['citrus','french'], true, 4.8, 156, 5),
        (loc_oakmere, 'Smoked Salmon Bagel', 'Classic New York style', 'Toasted sesame bagel with cream cheese, smoked salmon, capers, and red onion.', 14.99, NULL, 'https://images.unsplash.com/photo-1553909489-cd47e0907980', 'Smoked salmon bagel with cream cheese and capers', 'mains', ARRAY['gluten-free'], ARRAY['brunch','salmon'], false, 4.6, 123, 8)
    ON CONFLICT (id) DO NOTHING;

    -- Menu items for Willowmere, Middlewich
    INSERT INTO public.menu_items (location_id, name, subtitle, description, price, original_price, image_url, image_alt, category, dietary, tags, featured, rating, review_count, prep_time) VALUES
        (loc_willowmere, 'Sunday Roast', 'Traditional roast with all the trimmings', 'Slow-roasted beef served with roast potatoes, Yorkshire pudding, seasonal vegetables, and rich gravy.', 22.99, NULL, 'https://images.unsplash.com/photo-1544025162-d76694265947', 'Traditional Sunday roast with Yorkshire pudding', 'mains', ARRAY[]::TEXT[], ARRAY['traditional','sunday'], true, 4.9, 412, 35),
        (loc_willowmere, 'Homemade Soup of the Day', 'Fresh seasonal soup', 'Our chef''s daily soup made with fresh seasonal ingredients, served with crusty bread and butter.', 8.99, NULL, 'https://images.unsplash.com/photo-1547592180-85f173990554', 'Bowl of homemade soup with crusty bread', 'appetizers', ARRAY['vegetarian'], ARRAY['seasonal','homemade'], false, 4.5, 234, 10),
        (loc_willowmere, 'Beef Lasagne', 'Hearty Italian classic', 'Layers of slow-cooked beef ragu, bechamel sauce, and pasta sheets, topped with melted mozzarella.', 17.99, NULL, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3', 'Beef lasagne with melted cheese on top', 'mains', ARRAY[]::TEXT[], ARRAY['italian','comfort'], true, 4.7, 198, 25),
        (loc_willowmere, 'Scones with Clotted Cream', 'Traditional afternoon tea treat', 'Freshly baked plain and fruit scones served with clotted cream and strawberry jam.', 7.99, NULL, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35', 'Freshly baked scones with clotted cream and jam', 'desserts', ARRAY['vegetarian'], ARRAY['afternoon-tea','british'], true, 4.8, 267, 5),
        (loc_willowmere, 'Hot Chocolate', 'Rich and indulgent', 'Velvety hot chocolate made with premium Belgian chocolate, topped with whipped cream and marshmallows.', 4.99, NULL, 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed', 'Rich hot chocolate with whipped cream and marshmallows', 'beverages', ARRAY['vegetarian'], ARRAY['chocolate','warm'], false, 4.6, 189, 5),
        (loc_willowmere, 'Prawn and Chorizo Skewers', 'Smoky and spicy starter', 'Juicy king prawns and smoky chorizo threaded on skewers, grilled and served with aioli.', 13.99, NULL, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0', 'Prawn and chorizo skewers with aioli', 'appetizers', ARRAY['gluten-free'], ARRAY['smoky','seafood'], false, 4.4, 134, 12),
        (loc_willowmere, 'Mushroom Wellington', 'Elegant vegetarian centrepiece', 'Portobello mushroom and spinach wrapped in golden puff pastry, served with red wine jus.', 19.99, NULL, 'https://images.unsplash.com/photo-1574484284002-952d92456975', 'Mushroom wellington with red wine jus', 'mains', ARRAY['vegetarian'], ARRAY['elegant','vegetarian'], false, 4.5, 89, 30)
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Sample data insertion failed: %', SQLERRM;
END $$;
