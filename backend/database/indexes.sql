CREATE INDEX idx_clients_location ON clients(latitude, longitude);

CREATE INDEX idx_technicians_location ON technicians(current_latitude, current_longitude);

CREATE INDEX idx_technicians_specializations ON technicians USING GIN(specializations);

CREATE INDEX idx_work_orders_status ON work_orders(status);

CREATE INDEX idx_work_orders_scheduled_date ON work_orders(scheduled_start);

CREATE INDEX idx_work_orders_client_id ON work_orders(client_id);

CREATE INDEX idx_work_orders_technician_id ON work_orders(assigned_technician_id);

CREATE INDEX idx_documents_related ON documents(related_id, related_type);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

CREATE INDEX idx_notifications_is_read ON notifications(is_read);

CREATE INDEX idx_work_orders_date_range ON work_orders USING btree (scheduled_start, scheduled_end);

CREATE INDEX idx_payments_date ON payments USING btree (payment_date);

CREATE INDEX idx_audit_logs_entity ON audit_logs USING btree (entity_type, entity_id);

CREATE INDEX idx_notifications_created_at ON notifications USING btree (created_at);

CREATE INDEX idx_invoice_due_date ON invoices USING btree (due_date);