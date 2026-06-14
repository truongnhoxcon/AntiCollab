# ─────────────────────────────────────────────────────────────────────────────
# RDS Module – input variables
# Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Short project identifier used for naming and tagging resources."
  type        = string
  default     = "realtime-collab"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region where resources are provisioned."
  type        = string
  default     = "us-east-1"
}

# ─────────────────────────────────────────────────────────────────────────────
# Networking
# ─────────────────────────────────────────────────────────────────────────────

variable "private_subnet_ids" {
  description = "List of private subnet IDs in which the DB subnet group will be created."
  type        = list(string)
}

variable "rds_sg_id" {
  description = "ID of the RDS security group (rds-sg) to attach to the DB instance."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager
# ─────────────────────────────────────────────────────────────────────────────

variable "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret that contains the RDS master password JSON ({\"username\":\"...\",\"password\":\"...\"})."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# Tags
# ─────────────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Additional tags to merge onto every resource created by this module."
  type        = map(string)
  default     = {}
}
