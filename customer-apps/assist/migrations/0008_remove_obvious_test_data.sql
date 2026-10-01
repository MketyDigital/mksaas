-- Production cleanup requested after Assist bring-up.
-- Deliberately narrow: obvious test/demo/sample customers and orphan test identities only.
DELETE FROM customers
WHERE lower(slug) IN ('test','demo','sample','browser-test')
   OR lower(slug) LIKE 'test-%'
   OR lower(slug) LIKE 'demo-%'
   OR lower(slug) LIKE 'sample-%'
   OR lower(name) LIKE 'test %'
   OR lower(name) LIKE 'demo %'
   OR lower(name) LIKE 'sample %';

DELETE FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM customer_users cu WHERE cu.user_id=users.id
)
AND (
  lower(email) LIKE '%@example.com'
  OR lower(email) LIKE 'test%@%'
  OR lower(email) LIKE 'demo%@%'
);
