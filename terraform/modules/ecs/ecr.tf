# ─────────────────────────────────────────────────────────────────────────────
# ECR Repositories – core-backend and realtime-backend
# Task 6.1
# ─────────────────────────────────────────────────────────────────────────────

locals {
  ecr_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep only 30 most recent tagged images"
        selection = {
          tagStatus      = "tagged"
          tagPrefixList  = ["v", "latest", "sha-"]
          countType      = "imageCountMoreThan"
          countNumber    = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ─── core-backend ECR repository ─────────────────────────────────────────────

resource "aws_ecr_repository" "core_backend" {
  name                 = "core-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "core-backend"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_ecr_lifecycle_policy" "core_backend" {
  repository = aws_ecr_repository.core_backend.name
  policy     = local.ecr_lifecycle_policy
}

# ─── realtime-backend ECR repository ─────────────────────────────────────────

resource "aws_ecr_repository" "realtime_backend" {
  name                 = "realtime-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "realtime-backend"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_ecr_lifecycle_policy" "realtime_backend" {
  repository = aws_ecr_repository.realtime_backend.name
  policy     = local.ecr_lifecycle_policy
}
