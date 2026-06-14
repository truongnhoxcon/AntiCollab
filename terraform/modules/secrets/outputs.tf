# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager module – output values
#
# All four secret ARNs and names are exported so that downstream modules
# (iam, rds, elasticache, ecs) can reference them without hard-coding paths.
# ─────────────────────────────────────────────────────────────────────────────

# ── db-password ───────────────────────────────────────────────────────────────

output "db_password_secret_arn" {
  description = "ARN of the db-password Secrets Manager secret. Pass to IAM policies and RDS module."
  value       = aws_secretsmanager_secret.db_password.arn
}

output "db_password_secret_name" {
  description = "Name of the db-password Secrets Manager secret."
  value       = aws_secretsmanager_secret.db_password.name
}

# ── jwt-secret ────────────────────────────────────────────────────────────────

output "jwt_secret_arn" {
  description = "ARN of the jwt-secret Secrets Manager secret. Pass to IAM policies and ECS task definitions."
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "jwt_secret_name" {
  description = "Name of the jwt-secret Secrets Manager secret."
  value       = aws_secretsmanager_secret.jwt_secret.name
}

# ── twilio/api-credentials ────────────────────────────────────────────────────

output "twilio_credentials_secret_arn" {
  description = "ARN of the twilio/api-credentials Secrets Manager secret. Pass to IAM policies and ECS task definitions."
  value       = aws_secretsmanager_secret.twilio_credentials.arn
}

output "twilio_credentials_secret_name" {
  description = "Name of the twilio/api-credentials Secrets Manager secret."
  value       = aws_secretsmanager_secret.twilio_credentials.name
}

# ── redis-auth-token ──────────────────────────────────────────────────────────

output "redis_auth_token_secret_arn" {
  description = "ARN of the redis-auth-token Secrets Manager secret. Pass to IAM policies and ElastiCache module."
  value       = aws_secretsmanager_secret.redis_auth_token.arn
}

output "redis_auth_token_secret_name" {
  description = "Name of the redis-auth-token Secrets Manager secret."
  value       = aws_secretsmanager_secret.redis_auth_token.name
}
