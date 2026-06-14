# ─────────────────────────────────────────────────────────────────────────────
# IAM module – input variables
# ─────────────────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region where resources are provisioned."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short project identifier used for naming and tagging resources."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# S3
# ─────────────────────────────────────────────────────────────────────────────

variable "s3_bucket_arn" {
  description = "ARN of the S3 file-storage bucket (e.g. arn:aws:s3:::realtime-collab-files-<account>)."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager ARNs (for ecsTaskExecutionRole)
# ─────────────────────────────────────────────────────────────────────────────

variable "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds the RDS database password."
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds the JWT signing key."
  type        = string
}

variable "twilio_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds Twilio API credentials."
  type        = string
}

variable "redis_auth_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds the ElastiCache Redis auth token."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# GitHub Actions OIDC (optional – disabled by default)
# ─────────────────────────────────────────────────────────────────────────────

variable "create_github_actions_role" {
  description = "Set to true to create the GitHub Actions OIDC provider and IAM role for CI/CD."
  type        = bool
  default     = false
}

variable "github_org" {
  description = "GitHub organisation name used to scope the OIDC trust policy."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository name (without org prefix) used to scope the OIDC trust policy."
  type        = string
  default     = ""
}
