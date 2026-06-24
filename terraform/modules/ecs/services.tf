# ─────────────────────────────────────────────────────────────────────────────
# ECS Services with Auto-Scaling – core-backend and realtime-backend
# Task 11.2
# Requirements: 1.3, 1.4, 1.6, 1.7, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
# ─────────────────────────────────────────────────────────────────────────────

# ─── core-backend ECS service ────────────────────────────────────────────────

resource "aws_ecs_service" "core_backend" {
  name            = "${var.project_name}-core-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.core_backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.core_backend_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    # Implicit dependency on the ALB target group (and transitively on the
    # HTTPS listener) is established here. Terraform resolves ordering from
    # the root module wiring, so an explicit depends_on is not required.
    target_group_arn = var.core_backend_tg_arn
    container_name   = "core-backend"
    container_port   = 3000
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_ecs_managed_tags = true

  tags = {
    Name        = "${var.project_name}-core-backend-service"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── realtime-backend ECS service ────────────────────────────────────────────

resource "aws_ecs_service" "realtime_backend" {
  name            = "${var.project_name}-realtime-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.realtime_backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.realtime_backend_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.realtime_backend_tg_arn
    container_name   = "realtime-backend"
    container_port   = 4000
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_ecs_managed_tags = true

  tags = {
    Name        = "${var.project_name}-realtime-backend-service"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── Auto-scaling: core-backend ──────────────────────────────────────────────

resource "aws_appautoscaling_target" "core_backend" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.core_backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "core_backend_cpu" {
  name               = "${var.project_name}-core-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.core_backend.resource_id
  scalable_dimension = aws_appautoscaling_target.core_backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.core_backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}

# ─── Auto-scaling: realtime-backend ──────────────────────────────────────────
# Lower CPU target (60) vs core-backend (70) because WebSocket connections
# create sustained CPU load at lower utilisation levels; earlier scale-out
# prevents connection drops under bursty traffic.

resource "aws_appautoscaling_target" "realtime_backend" {
  max_capacity       = 20
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.realtime_backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "realtime_backend_cpu" {
  name               = "${var.project_name}-realtime-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.realtime_backend.resource_id
  scalable_dimension = aws_appautoscaling_target.realtime_backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.realtime_backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}
