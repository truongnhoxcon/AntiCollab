# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager module
#
# Creates:
#   • db-password              – RDS PostgreSQL master credentials (with rotation)
#   • jwt-secret               – JWT signing secret
#   • twilio/api-credentials   – Twilio Network Traversal Service credentials
#   • redis-auth-token         – ElastiCache Redis AUTH token
#
# Requirements: 8.7, 16.7, 16.8, 16.9
# ─────────────────────────────────────────────────────────────────────────────

locals {
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  })

  # Name prefix for all secrets (e.g. "realtime-collab-prod")
  name_prefix = "${var.project_name}-${var.environment}"
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. db-password – RDS PostgreSQL master credentials
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db_password" {
  name        = "${local.name_prefix}/db-password"
  description = "RDS PostgreSQL master password for ${var.project_name} (${var.environment})"

  # Allow re-creation after deletion without waiting the full recovery window
  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}/db-password"
    Purpose = "database-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id

  # Placeholder – replace with real credentials before first use
  secret_string = jsonencode({
    username = "postgres"
    password = "CHANGE_ME"
  })

  # Prevent Terraform from constantly re-applying the placeholder once the
  # value has been updated outside of Terraform (e.g. via Secrets Manager
  # rotation or manual update).
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. jwt-secret – JWT signing secret
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${local.name_prefix}/jwt-secret"
  description = "JWT signing secret for ${var.project_name} (${var.environment})"

  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}/jwt-secret"
    Purpose = "jwt-signing"
  })
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id

  secret_string = jsonencode({
    secret = "CHANGE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. twilio/api-credentials – Twilio Network Traversal Service credentials
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "twilio_credentials" {
  # Use the path-style name matching the design doc (twilio/api-credentials)
  name        = "${local.name_prefix}/twilio/api-credentials"
  description = "Twilio Network Traversal Service credentials for ${var.project_name} (${var.environment})"

  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}/twilio/api-credentials"
    Purpose = "twilio-stun-turn"
  })
}

resource "aws_secretsmanager_secret_version" "twilio_credentials" {
  secret_id = aws_secretsmanager_secret.twilio_credentials.id

  secret_string = jsonencode({
    accountSid   = "CHANGE_ME"
    authToken    = "CHANGE_ME"
    apiKeySid    = "CHANGE_ME"
    apiKeySecret = "CHANGE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. redis-auth-token – ElastiCache Redis AUTH token
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "redis_auth_token" {
  name        = "${local.name_prefix}/redis-auth-token"
  description = "Redis AUTH token for ElastiCache in ${var.project_name} (${var.environment})"

  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}/redis-auth-token"
    Purpose = "redis-auth"
  })
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.redis_auth_token.id

  secret_string = jsonencode({
    token = "CHANGE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. Automatic rotation for db-password (90-day schedule)
#    Conditionally created – only when var.db_rotation_lambda_arn is provided.
#    The rotation Lambda must exist before apply (typically managed by AWS or
#    a separate Terraform module for Secrets Manager rotation).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret_rotation" "db_password" {
  count = var.db_rotation_lambda_arn != "" ? 1 : 0

  secret_id           = aws_secretsmanager_secret.db_password.id
  rotation_lambda_arn = var.db_rotation_lambda_arn

  rotation_rules {
    # Rotate every 90 days as per Requirement 16.9
    automatically_after_days = 90
  }
}
