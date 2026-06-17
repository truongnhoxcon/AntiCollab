# ─────────────────────────────────────────────────────────────────────────────
# ECS Frontend – Nginx SPA (port 80)
#
# Serves the React frontend via Nginx.
# The ALB default action forwards all non-API, non-WS paths here.
# ─────────────────────────────────────────────────────────────────────────────

# ─── CloudWatch Log Group ────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/frontend"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── Task Definition ─────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = var.frontend_image

      portMappings = [
        {
          containerPort = 80
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:80/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/frontend"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-frontend"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── ECS Service ─────────────────────────────────────────────────────────────

resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.frontend_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.frontend_tg_arn
    container_name   = "frontend"
    container_port   = 80
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_ecs_managed_tags = true

  tags = {
    Name        = "${var.project_name}-frontend-service"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
