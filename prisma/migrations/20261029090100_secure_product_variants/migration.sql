-- Supabase exposes public tables over REST. Keep variant data server-only like the rest of the app.
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
