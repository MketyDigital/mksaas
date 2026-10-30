ALTER TABLE saas_template.deployment_requests
  ADD COLUMN promotion_deployment_id uuid;

ALTER TABLE saas_template.deployment_requests
  ADD CONSTRAINT deployment_requests_promotion_deployment_id_deployments_id_fk
  FOREIGN KEY (promotion_deployment_id)
  REFERENCES saas_template.deployments(id)
  ON DELETE SET NULL;

CREATE INDEX deployment_requests_promotion_deployment_idx
  ON saas_template.deployment_requests (promotion_deployment_id);
