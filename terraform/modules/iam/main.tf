# ─────────────────────────────────────────────────────────────────────────────
# IAM module
#
# Creates:
#   • ecsTaskExecutionRole  – used by ECS agent to pull images & write logs
#   • ecsTaskRole           – assumed by the running application containers
#   • (optional) GitHub Actions OIDC provider + github-actions-role for CI/CD
#
# Requirements: 12.6, 12.7, 12.8, 16.5
# ─────────────────────────────────────────────────────────────────────────────

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Reusable trust-policy document for ECS tasks
  ecs_task_trust_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowECSTasksToAssume"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Task Execution Role
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "ecs_task_execution" {
  name               = "ecsTaskExecutionRole-${var.project_name}-${var.environment}"
  assume_role_policy = local.ecs_task_trust_policy

  tags = merge(local.common_tags, {
    Name = "ecsTaskExecutionRole-${var.project_name}-${var.environment}"
    Role = "ECSTaskExecution"
  })
}

# ECR pull permissions – resource must be "*" for GetAuthorizationToken
resource "aws_iam_policy" "ecr_pull" {
  name        = "${var.project_name}-${var.environment}-ecr-pull"
  description = "Allows ECS task execution role to pull images from ECR."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuthToken"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        # GetAuthorizationToken does not support resource-level permissions
        Resource = ["*"]
      },
      {
        Sid    = "ECRImagePull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
        ]
        Resource = ["*"]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecr_pull" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.ecr_pull.arn
}

# CloudWatch Logs – scoped to /ecs/* log groups
resource "aws_iam_policy" "cloudwatch_logs_ecs" {
  name        = "${var.project_name}-${var.environment}-cloudwatch-logs-ecs"
  description = "Allows ECS task execution role to write logs to /ecs/* log groups."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogsECS"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = ["arn:aws:logs:*:*:log-group:/ecs/*"]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "cloudwatch_logs_ecs" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.cloudwatch_logs_ecs.arn
}

# Secrets Manager – execution role needs to inject secrets into containers at startup
resource "aws_iam_policy" "secrets_execution" {
  name        = "${var.project_name}-${var.environment}-secrets-execution"
  description = "Allows ECS task execution role to read application secrets at container startup."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerGetExecutionSecrets"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          var.db_password_secret_arn,
          var.jwt_secret_arn,
          var.twilio_secret_arn,
          var.redis_auth_secret_arn,
          var.google_oauth_secret_arn,
        ]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "secrets_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.secrets_execution.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Task Role
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "ecs_task" {
  name               = "ecsTaskRole-${var.project_name}-${var.environment}"
  assume_role_policy = local.ecs_task_trust_policy

  tags = merge(local.common_tags, {
    Name = "ecsTaskRole-${var.project_name}-${var.environment}"
    Role = "ECSTask"
  })
}

# S3 – scoped to the specific file-storage bucket
resource "aws_iam_policy" "s3_file_storage" {
  name        = "${var.project_name}-${var.environment}-s3-file-storage"
  description = "Allows ECS task role to read/write objects in the file-storage S3 bucket."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3ObjectOperations"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        # Scope to objects within the bucket
        Resource = ["${var.s3_bucket_arn}/*"]
      },
      {
        Sid    = "S3ListBucket"
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        # ListBucket operates on the bucket itself, not objects
        Resource = [var.s3_bucket_arn]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "s3_file_storage" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.s3_file_storage.arn
}

# Secrets Manager – task role allows app code to call GetSecretValue for Twilio
resource "aws_iam_policy" "secrets_task" {
  name        = "${var.project_name}-${var.environment}-secrets-task"
  description = "Allows running ECS tasks to retrieve Twilio credentials at runtime."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SecretsManagerGetTwilio"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [var.twilio_secret_arn]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "secrets_task" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.secrets_task.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# GitHub Actions OIDC (conditional – disabled by default)
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_iam_openid_connect_provider" "github_actions" {
  count = var.create_github_actions_role ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # Thumbprint list for token.actions.githubusercontent.com
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = merge(local.common_tags, {
    Name = "github-actions-oidc-provider"
  })
}

resource "aws_iam_role" "github_actions" {
  count = var.create_github_actions_role ? 1 : 0

  name = "github-actions-role-${var.project_name}-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowGitHubActionsOIDC"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions[0].arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Allows any branch/PR from the specified org/repo
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "github-actions-role-${var.project_name}-${var.environment}"
    Role = "GitHubActionsCI"
  })
}

# GitHub Actions needs ECR push + ECS deployment permissions
resource "aws_iam_policy" "github_actions_ci" {
  count = var.create_github_actions_role ? 1 : 0

  name        = "${var.project_name}-${var.environment}-github-actions-ci"
  description = "Allows GitHub Actions to push images to ECR and deploy to ECS."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
        ]
        Resource = ["*"]
      },
      {
        Sid    = "ECSDeployment"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
        ]
        Resource = ["*"]
      },
      {
        Sid    = "PassRoleForECS"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn,
        ]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "github_actions_ci" {
  count = var.create_github_actions_role ? 1 : 0

  role       = aws_iam_role.github_actions[0].name
  policy_arn = aws_iam_policy.github_actions_ci[0].arn
}
