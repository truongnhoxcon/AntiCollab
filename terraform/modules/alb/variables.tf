# ─────────────────────────────────────────────────────────────────────────────
# ALB Module Variables
# ─────────────────────────────────────────────────────────────────────────────

variable "vpc_id" {
  type        = string
  description = "ID of the VPC in which the ALB and target groups are deployed."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "List of public subnet IDs across availability zones for the ALB."
}

variable "alb_sg_id" {
  type        = string
  description = "ID of the security group attached to the ALB (allows inbound 80/443)."
}

variable "domain_name" {
  type        = string
  description = "Domain name for the ACM certificate (e.g. app.example.com)."
}

variable "alb_logs_bucket" {
  type        = string
  description = "S3 bucket name for ALB access logs (must have the ELB log-delivery policy)."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev | staging | prod)."
  default     = "dev"
}

variable "project_name" {
  type        = string
  description = "Project name used as a prefix for all resource names and tags."
  default     = "realtime-collab"
}
