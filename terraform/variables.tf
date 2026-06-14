# ─────────────────────────────────────────────────────────────────────────────
# General / global variables
# ─────────────────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region where all resources will be provisioned."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name. Must be one of: dev, staging, prod."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Short project identifier used as a prefix/suffix for resource names and tags."
  type        = string
  default     = "realtime-collab"
}

variable "account_id" {
  description = "AWS account ID. Used for globally unique resource names such as S3 buckets."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# Networking
# ─────────────────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Must be at least /20 to accommodate all subnets."
  type        = string
  default     = "10.0.0.0/16"
}

# ─────────────────────────────────────────────────────────────────────────────
# Application images (ECR URIs)
# ─────────────────────────────────────────────────────────────────────────────

variable "core_backend_image" {
  description = "Full ECR image URI for the core-backend service, e.g. <account>.dkr.ecr.<region>.amazonaws.com/core-backend:<tag>."
  type        = string
  default     = ""
}

variable "realtime_backend_image" {
  description = "Full ECR image URI for the realtime-backend service, e.g. <account>.dkr.ecr.<region>.amazonaws.com/realtime-backend:<tag>."
  type        = string
  default     = ""
}

# ─────────────────────────────────────────────────────────────────────────────
# DNS / ACM
# ─────────────────────────────────────────────────────────────────────────────

variable "domain_name" {
  description = "Fully-qualified domain name for the ALB HTTPS listener certificate, e.g. app.yourdomain.com."
  type        = string
}

# ─────────────────────────────────────────────────────────────────────────────
# Alerting
# ─────────────────────────────────────────────────────────────────────────────

variable "alert_email" {
  description = "Email address that receives CloudWatch alarm notifications via SNS."
  type        = string
}
