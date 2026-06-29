variable "project_name" {
  description = "Short project identifier used as a prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
}

variable "alb_dns_name" {
  description = "Raw DNS name of the ALB (without protocol prefix, e.g. my-alb.us-east-1.elb.amazonaws.com)."
  type        = string
}
