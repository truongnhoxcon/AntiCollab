# ECS module variables – defined in tasks 6.1, 11.1, 11.2

variable "environment" {
  description = "Deployment environment name (dev, staging, prod)."
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

# ─── Task 11.1 additions ──────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region where resources are deployed."
  type        = string
  default     = "us-east-1"
}

variable "ecs_task_execution_role_arn" {
  description = "ARN of the ECS Task Execution Role. Passed to ECS task definitions as executionRoleArn."
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ARN of the ECS Task Role. Passed to ECS task definitions as taskRoleArn."
  type        = string
}

variable "core_backend_image" {
  description = "Docker image URI for the core-backend container (e.g. ECR repository URL with tag)."
  type        = string
  default     = "PLACEHOLDER/core-backend:latest"
}

variable "realtime_backend_image" {
  description = "Docker image URI for the realtime-backend container (e.g. ECR repository URL with tag)."
  type        = string
  default     = "PLACEHOLDER/realtime-backend:latest"
}

variable "db_host" {
  description = "RDS PostgreSQL endpoint hostname passed to containers as DB_HOST."
  type        = string
}

variable "redis_host" {
  description = "ElastiCache Redis primary endpoint hostname passed to containers as REDIS_HOST."
  type        = string
}

variable "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds the RDS master password (db-password)."
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds the JWT signing secret (jwt-secret)."
  type        = string
}

variable "twilio_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds Twilio API credentials (twilio/api-credentials)."
  type        = string
}

# ─── Frontend additions ───────────────────────────────────────────────────────

variable "frontend_image" {
  description = "Docker image URI for the frontend container (Nginx SPA, port 80)."
  type        = string
  default     = "PLACEHOLDER/frontend:latest"
}

variable "frontend_sg_id" {
  description = "Security group ID for frontend ECS tasks."
  type        = string
}

variable "frontend_tg_arn" {
  description = "ARN of the ALB target group for the frontend (port 80)."
  type        = string
}

# ─── Task 11.2 additions ──────────────────────────────────────────────────────

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS task networking."
  type        = list(string)
}

variable "core_backend_sg_id" {
  description = "Security group ID for core-backend ECS tasks."
  type        = string
}

variable "realtime_backend_sg_id" {
  description = "Security group ID for realtime-backend ECS tasks."
  type        = string
}

variable "core_backend_tg_arn" {
  description = "ARN of the ALB target group for core-backend (port 3000)."
  type        = string
}

variable "realtime_backend_tg_arn" {
  description = "ARN of the ALB target group for realtime-backend (port 4000)."
  type        = string
}

variable "alb_https_listener_arn" {
  description = "ARN of the ALB HTTPS listener. Used to establish explicit dependency so ECS services are created after ALB listener rules."
  type        = string
}

# ─── Task 12.1 additions ──────────────────────────────────────────────────────

variable "alert_email" {
  description = "Email address for SNS alert subscription. Receives notifications for all CloudWatch alarms."
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metric dimensions (e.g. \"app/realtime-collab-alb/abc123\"). Obtained from the ALB module output."
  type        = string
}

variable "core_backend_tg_arn_suffix" {
  description = "core-backend target group ARN suffix for CloudWatch metric dimensions (e.g. \"targetgroup/core-backend-tg/abc123\"). Obtained from the ALB module output."
  type        = string
}

variable "realtime_backend_tg_arn_suffix" {
  description = "realtime-backend target group ARN suffix for CloudWatch metric dimensions (e.g. \"targetgroup/realtime-backend-tg/abc123\"). Obtained from the ALB module output."
  type        = string
}

variable "rds_instance_id" {
  description = "RDS DB instance identifier for CloudWatch metric dimensions. Obtained from the RDS module output."
  type        = string
}

variable "redis_replication_group_id" {
  description = "ElastiCache replication group ID for CloudWatch metric dimensions. Obtained from the ElastiCache module output."
  type        = string
}
