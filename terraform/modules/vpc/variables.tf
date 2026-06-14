# ─────────────────────────────────────────────────────────────────────────────
# VPC Module Variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Name of the project, used as a prefix for all resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)."
  type        = string
}

variable "aws_region" {
  description = "AWS region where resources are created. Used to derive AZ names (e.g. us-east-1 → us-east-1a/b)."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Must be large enough to contain all public and private subnets."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid IPv4 CIDR block."
  }
}

variable "flow_logs_retention_days" {
  description = "Number of days to retain VPC Flow Log entries in CloudWatch Logs."
  type        = number
  default     = 30

  validation {
    condition     = contains([0, 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653], var.flow_logs_retention_days)
    error_message = "flow_logs_retention_days must be one of the CloudWatch Logs supported retention values."
  }
}

variable "tags" {
  description = "Additional tags to merge onto every resource created by this module."
  type        = map(string)
  default     = {}
}
