# ─────────────────────────────────────────────────────────────────────────────
# S3 Module – Input Variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Short project identifier used to prefix all resource names (e.g. 'realtime-collab')."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. 'dev', 'staging', 'prod')."
  type        = string
}

variable "aws_region" {
  description = "AWS region where the buckets are created. Used to select the correct ELB service account for ALB log delivery."
  type        = string
  default     = "us-east-1"
}

variable "account_id" {
  description = "AWS account ID. Appended to bucket names to guarantee global uniqueness."
  type        = string
}

variable "app_domain" {
  description = "Full origin URL of the application (e.g. 'https://app.yourdomain.com'). Used in the S3 CORS configuration to restrict which origins may make cross-origin requests."
  type        = string
}

variable "tags" {
  description = "Map of additional tags to merge onto every resource created by this module."
  type        = map(string)
  default     = {}
}
