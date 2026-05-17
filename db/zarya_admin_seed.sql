BEGIN;

INSERT INTO admin_user (email, password_hash, full_name, role, is_active)
VALUES
    ('admin@zarya.local', '$2b$10$D4i4ZeUAO9w3LqPkhUGhYONxuMkFgLIuEY516q94yZtbl0MrvLvgS', 'Администратор', 'super_admin', true)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

DELETE FROM admin_user
WHERE email IN ('editor@zarya.local', 'manager@zarya.local');

COMMIT;
