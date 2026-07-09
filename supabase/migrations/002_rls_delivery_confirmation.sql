-- RLS en tablas de delivery-confirmation y pipeline.
-- Solo el backend (service role) accede; la anon key queda bloqueada.

alter table pipeline_cases enable row level security;
alter table company_managers enable row level security;
alter table delivery_confirmation_cases enable row level security;
alter table delivery_confirmation_emails enable row level security;
