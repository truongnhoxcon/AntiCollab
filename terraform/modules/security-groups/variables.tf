# ─────────────────────────────────────────────────────────────────────────────
# Security Groups Module Variables
# ─────────────────────────────────────────────────────────────────────────────

variable "vpc_id" {
  description = "ID of the VPC in which all security groups will be created."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Name of the project, used as a prefix for all resource names."
  type        = string
  default     = "realtime-collab"
}

variable "tags" {
  description = "Additional tags to merge onto every resource created by this module."
  type        = map(string)
  default     = {}
}
