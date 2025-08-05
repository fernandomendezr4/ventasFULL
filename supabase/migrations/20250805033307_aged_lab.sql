/*
  # Create get_table_metadata function

  1. New Functions
    - `get_table_metadata()` - Returns metadata for all tables in the public schema
      - Returns table name, type, column count, row count, size, and constraint information
      - Used by the database export functionality to analyze schema structure

  2. Security
    - Function is accessible to authenticated users
    - Uses SECURITY DEFINER to access system catalogs safely
*/

CREATE OR REPLACE FUNCTION public.get_table_metadata()
RETURNS TABLE (
    table_name text,
    table_type text,
    column_count bigint,
    row_count bigint,
    size_bytes bigint,
    has_primary_key boolean,
    has_foreign_keys boolean,
    has_indexes boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.relname::text AS table_name,
        CASE c.relkind
            WHEN 'r' THEN 'BASE TABLE'
            WHEN 'v' THEN 'VIEW'
            WHEN 'm' THEN 'MATERIALIZED VIEW'
            WHEN 'f' THEN 'FOREIGN TABLE'
            WHEN 'p' THEN 'PARTITIONED TABLE'
            ELSE c.relkind::text
        END AS table_type,
        (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_count,
        COALESCE(c.reltuples, 0)::bigint AS row_count,
        COALESCE(pg_total_relation_size(c.oid), 0)::bigint AS size_bytes,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = c.oid AND contype = 'p') AS has_primary_key,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = c.oid AND contype = 'f') AS has_foreign_keys,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = c.relname) AS has_indexes
    FROM
        pg_class c
    JOIN
        pg_namespace n ON n.oid = c.relnamespace
    WHERE
        c.relkind IN ('r', 'v', 'm', 'f', 'p')
        AND n.nspname = 'public'
        AND c.relname NOT LIKE 'pg_%'
        AND c.relname NOT LIKE 'sql_%'
    ORDER BY
        c.relname;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_table_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_metadata() TO anon;