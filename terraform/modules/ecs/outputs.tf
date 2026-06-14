# ECS module outputs – defined in tasks 11.1, 11.2

# ─────────────────────────────────────────────────────────────────────────────
# ECR outputs (task 6.1)
# ─────────────────────────────────────────────────────────────────────────────

output "core_backend_ecr_repository_url" {
  description = "ECR repository URL for core-backend. Used in ECS task definitions and GitHub Actions."
  value       = aws_ecr_repository.core_backend.repository_url
}

output "realtime_backend_ecr_repository_url" {
  description = "ECR repository URL for realtime-backend. Used in ECS task definitions and GitHub Actions."
  value       = aws_ecr_repository.realtime_backend.repository_url
}

output "core_backend_ecr_repository_arn" {
  description = "ECR repository ARN for core-backend. Used in IAM policies."
  value       = aws_ecr_repository.core_backend.arn
}

output "realtime_backend_ecr_repository_arn" {
  description = "ECR repository ARN for realtime-backend. Used in IAM policies."
  value       = aws_ecr_repository.realtime_backend.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Cluster outputs (task 11.1)
# ─────────────────────────────────────────────────────────────────────────────

output "ecs_cluster_id" {
  description = "ID of the ECS cluster."
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = aws_ecs_cluster.main.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster."
  value       = aws_ecs_cluster.main.name
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Task Definition outputs (task 11.1)
# ─────────────────────────────────────────────────────────────────────────────

output "core_backend_task_definition_arn" {
  description = "ARN of the core-backend ECS task definition (latest revision)."
  value       = aws_ecs_task_definition.core_backend.arn
}

output "realtime_backend_task_definition_arn" {
  description = "ARN of the realtime-backend ECS task definition (latest revision)."
  value       = aws_ecs_task_definition.realtime_backend.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Service outputs (task 11.2)
# ─────────────────────────────────────────────────────────────────────────────

output "core_backend_service_name" {
  description = "Name of the core-backend ECS service."
  value       = aws_ecs_service.core_backend.name
}

output "realtime_backend_service_name" {
  description = "Name of the realtime-backend ECS service."
  value       = aws_ecs_service.realtime_backend.name
}

output "core_backend_service_id" {
  description = "ID of the core-backend ECS service."
  value       = aws_ecs_service.core_backend.id
}

output "realtime_backend_service_id" {
  description = "ID of the realtime-backend ECS service."
  value       = aws_ecs_service.realtime_backend.id
}

# ─────────────────────────────────────────────────────────────────────────────
# Monitoring outputs (task 12.1)
# ─────────────────────────────────────────────────────────────────────────────

output "sns_topic_arn" {
  description = "ARN of the realtime-collab-alerts SNS topic. Used by CloudWatch alarms and can be referenced by other modules for additional subscriptions."
  value       = aws_sns_topic.alerts.arn
}

output "cloudwatch_dashboard_name" {
  description = "Name of the RealTime-Collaboration-Overview CloudWatch dashboard."
  value       = aws_cloudwatch_dashboard.overview.dashboard_name
}
