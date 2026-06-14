# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Module – input variables
# Requirements: 4.1, 4.2, 4.5, 4.6, 4.7
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
  description = "List of private subnet IDs in which the ElastiCache subnet group will be created."
  type        = list(string)
}

variable "redis_sg_id" {
  description = "ID of the Redis security group (redis-sg) to attach to the replication group."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager
# ─────────────────────────────────────────────────────────────────────────────

variable "redis_auth_secret_arn" {
  description = "ARN of the Secrets Manager secret that contains the Redis auth token JSON ({\"token\":\"...\"})."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────

variable "sns_topic_arn" {
  description = "ARN of the SNS topic for ElastiCache event notifications. Leave empty to disable notifications."
  type        = string
  default     = ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Tags
# ─────────────────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Additional tags to merge onto every resource created by this module."
  type        = map(string)
  default     = {}
}
