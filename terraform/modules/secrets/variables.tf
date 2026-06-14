# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager module – input variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Short project identifier used as a prefix for secret names and tags (e.g. 'realtime-collab')."
  type        = string
}

variable "environment" {
  description = "Deployment environment. Used as part of the secret name prefix (e.g. 'dev', 'staging', 'prod')."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Rotation
# ─────────────────────────────────────────────────────────────────────────────

variable "db_rotation_lambda_arn" {
  description = <<-EOT
    ARN of the Lambda function used to rotate the db-password secret.
    When this is set to a non-empty string, an aws_secretsmanager_secret_rotation
    resource is created for the db-password secret with a 90-day rotation schedule.
    Leave empty (default) to skip rotation – useful for environments where the
    rotation Lambda has not been deployed yet.
  EOT
  type        = string
  default     = ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Tagging
# ─────────────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Additional tags to apply to all Secrets Manager resources. Merged with module-managed tags (Project, Environment, ManagedBy)."
  type        = map(string)
  default     = {}
}
