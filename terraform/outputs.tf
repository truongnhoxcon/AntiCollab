# ─────────────────────────────────────────────────────────────────────────────
# Root outputs – exposed after `terraform apply` and consumed by CI/CD pipelines
# ─────────────────────────────────────────────────────────────────────────────

# CloudFront (primary access URL — HTTPS, no custom domain needed)
output "app_url" {
  description = "HTTPS URL of the application via CloudFront (*.cloudfront.net). Use this to access the app."
  value       = module.cloudfront.cloudfront_https_url
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name (e.g. d1234abcd.cloudfront.net)."
  value       = module.cloudfront.cloudfront_domain
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID. Used for cache invalidation in CI/CD."
  value       = module.cloudfront.cloudfront_distribution_id
}

# ALB (internal use only — do not access directly, use CloudFront URL above)
output "alb_dns_name" {
  description = "Plain HTTP URL of the ALB (internal only — access app via CloudFront URL)."
  value       = module.alb.alb_dns_name
}

output "alb_api_url" {
  description = "Base URL for REST API calls from the frontend."
  value       = "${module.alb.alb_dns_name}/api"
}

output "alb_ws_url" {
  description = "WebSocket endpoint URL (internal). Frontend uses wss://<cloudfront_domain>/ws instead."
  value       = "wss://${module.cloudfront.cloudfront_domain}/ws"
}

# ECS
output "ecs_cluster_name" {
  description = "Name of the ECS Fargate cluster."
  value       = module.ecs.ecs_cluster_name
}

output "core_backend_service_name" {
  description = "ECS service name for the core-backend."
  value       = module.ecs.core_backend_service_name
}

output "realtime_backend_service_name" {
  description = "ECS service name for the realtime-backend."
  value       = module.ecs.realtime_backend_service_name
}

# RDS
output "rds_endpoint" {
  description = "Connection endpoint for the RDS PostgreSQL instance."
  value       = module.rds.db_endpoint
  sensitive   = true
}

# ElastiCache Redis
output "redis_endpoint" {
  description = "Primary endpoint for the ElastiCache Redis replication group."
  value       = module.elasticache.redis_endpoint
  sensitive   = true
}

# ECR repositories
output "core_backend_ecr_url" {
  description = "ECR repository URL for the core-backend image."
  value       = module.ecs.core_backend_ecr_repository_url
}

output "realtime_backend_ecr_url" {
  description = "ECR repository URL for the realtime-backend image."
  value       = module.ecs.realtime_backend_ecr_repository_url
}

# GitHub Actions
output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions OIDC IAM role."
  value       = module.iam.github_actions_role_arn
}
