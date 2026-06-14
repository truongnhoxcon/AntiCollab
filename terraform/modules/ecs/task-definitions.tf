# ─────────────────────────────────────────────────────────────────────────────
# ECS Task Definitions – core-backend and realtime-backend
# Task 11.1
# Requirements: 1.1, 1.2, 1.5, 13.1, 13.2
# ─────────────────────────────────────────────────────────────────────────────

# ─── core-backend task definition ────────────────────────────────────────────

resource "aws_ecs_task_definition" "core_backend" {
  family                   = "${var.project_name}-core-backend"
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "core-backend"
      image = var.core_backend_image

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV",    value = "production" },
        { name = "DB_HOST",     value = var.db_host },
        { name = "REDIS_HOST",  value = var.redis_host },
        { name = "AWS_REGION",  value = var.aws_region }
      ]

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = var.db_password_secret_arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = var.jwt_secret_arn
        },
        {
          name      = "TWILIO_ACCOUNT_SID"
          valueFrom = "${var.twilio_secret_arn}:accountSid::"
        },
        {
          name      = "TWILIO_AUTH_TOKEN"
          valueFrom = "${var.twilio_secret_arn}:authToken::"
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/core-backend"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-core-backend"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── realtime-backend task definition ────────────────────────────────────────

resource "aws_ecs_task_definition" "realtime_backend" {
  family                   = "${var.project_name}-realtime-backend"
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "realtime-backend"
      image = var.realtime_backend_image

      portMappings = [
        {
          containerPort = 4000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV",    value = "production" },
        { name = "REDIS_HOST",  value = var.redis_host },
        { name = "DB_HOST",     value = var.db_host },
        { name = "AWS_REGION",  value = var.aws_region }
      ]

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = var.db_password_secret_arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = var.jwt_secret_arn
        },
        {
          name      = "TWILIO_ACCOUNT_SID"
          valueFrom = "${var.twilio_secret_arn}:accountSid::"
        },
        {
          name      = "TWILIO_AUTH_TOKEN"
          valueFrom = "${var.twilio_secret_arn}:authToken::"
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:4000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/realtime-backend"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-realtime-backend"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
