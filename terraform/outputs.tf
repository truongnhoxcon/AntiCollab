# ─────────────────────────────────────────────────────────────────────────────
# Root outputs – exposed after `terraform apply` and consumed by CI/CD pipelines
# ─────────────────────────────────────────────────────────────────────────────

# ALB
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer."
  value       = module.alb.alb_dns_name
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
