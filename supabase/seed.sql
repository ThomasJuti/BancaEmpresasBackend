-- Seed de demo (ambientes locales / preview). Datos ficticios.
insert into company_managers (company_id, name, email)
values
  ('empresa-demo-001', 'Gerente Demo Uno', 'gerente1@example.com'),
  ('empresa-demo-001', 'Gerente Demo Dos', 'gerente2@example.com'),
  ('empresa-demo-002', 'Gerente Demo Tres', 'gerente3@example.com')
on conflict (company_id, email) do nothing;
