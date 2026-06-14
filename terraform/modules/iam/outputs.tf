# ─────────────────────────────────────────────────────────────────────────────
# IAM module – output values
# ─────────────────────────────────────────────────────────────────────────────

# ── ECS Task Execution Role ──────────────────────────────────────────────────

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS Task Execution Role (ecsTaskExecutionRole). Pass to ECS task definitions as executionRoleArn."
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_execution_role_name" {
  description = "Name of the ECS Task Execution Role."
  value       = aws_iam_role.ecs_task_execution.name
}

# ── ECS Task Role ────────────────────────────────────────────────────────────

output "ecs_task_role_arn" {
  description = "ARN of the ECS Task Role (ecsTaskRole). Pass to ECS task definitions as taskRoleArn."
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_task_role_name" {
  description = "Name of the ECS Task Role."
  value       = aws_iam_role.ecs_task.name
}

# ── GitHub Actions OIDC (only populated when create_github_actions_role=true) ─

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role. Empty string when create_github_actions_role is false."
  value       = var.create_github_actions_role ? aws_iam_role.github_actions[0].arn : ""
}

output "github_actions_role_name" {
  description = "Name of the GitHub Actions IAM role. Empty string when create_github_actions_role is false."
  value       = var.create_github_actions_role ? aws_iam_role.github_actions[0].name : ""
}
