-- Extend space_nodes.type to include: link, todo_list, file_card, drawing, column, table
DO $$
DECLARE
    cname text;
BEGIN
    SELECT tc.constraint_name INTO cname
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public' AND tc.table_name = 'space_nodes' AND tc.constraint_type = 'CHECK';
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.space_nodes DROP CONSTRAINT %I', cname);
    END IF;
END $$;

ALTER TABLE public.space_nodes
    ADD CONSTRAINT space_nodes_type_check CHECK (type IN (
        'sticky_note', 'text', 'shape', 'frame', 'connector', 'image', 'comment',
        'link', 'todo_list', 'file_card', 'drawing', 'column', 'table'
    ));
