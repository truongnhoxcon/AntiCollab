# ─────────────────────────────────────────────────────────────────────────────
# CloudWatch Monitoring – Log Groups, SNS, Alarms, Dashboard
# Task 12.1
# Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9
# ─────────────────────────────────────────────────────────────────────────────

# ─── CloudWatch Log Groups ────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "ecs_core_backend" {
  name              = "/ecs/core-backend"
  retention_in_days = 30

  tags = {
    Name        = "/ecs/core-backend"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

resource "aws_cloudwatch_log_group" "ecs_realtime_backend" {
  name              = "/ecs/realtime-backend"
  retention_in_days = 30

  tags = {
    Name        = "/ecs/realtime-backend"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/realtime-collab-db/postgresql"
  retention_in_days = 7

  tags = {
    Name        = "/aws/rds/realtime-collab-db/postgresql"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── SNS Topic & Email Subscription ──────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"

  tags = {
    Name        = "${var.project_name}-alerts"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ─── Critical Alarms ──────────────────────────────────────────────────────────

# ECS: High CPU utilization across the cluster
resource "aws_cloudwatch_metric_alarm" "ecs_high_cpu" {
  alarm_name          = "${var.project_name}-ECS-HighCPU"
  alarm_description   = "ECS cluster average CPU utilization exceeds 80%."
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-ECS-HighCPU"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ECS: core-backend service has no running tasks
resource "aws_cloudwatch_metric_alarm" "ecs_core_service_down" {
  alarm_name          = "${var.project_name}-ECS-CoreServiceDown"
  alarm_description   = "core-backend ECS service has fewer than 1 running task."
  namespace           = "AWS/ECS"
  metric_name         = "RunningTaskCount"
  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  period              = 60
  evaluation_periods  = 1
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.core_backend.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-ECS-CoreServiceDown"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ECS: realtime-backend service has no running tasks
resource "aws_cloudwatch_metric_alarm" "ecs_realtime_service_down" {
  alarm_name          = "${var.project_name}-ECS-RealtimeServiceDown"
  alarm_description   = "realtime-backend ECS service has fewer than 1 running task."
  namespace           = "AWS/ECS"
  metric_name         = "RunningTaskCount"
  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  period              = 60
  evaluation_periods  = 1
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.realtime_backend.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-ECS-RealtimeServiceDown"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ALB: high 5xx error rate
resource "aws_cloudwatch_metric_alarm" "alb_high_error_rate" {
  alarm_name          = "${var.project_name}-ALB-HighErrorRate"
  alarm_description   = "ALB 5xx error count exceeds threshold in a 2-minute window."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 1
  period              = 120
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.core_backend_tg_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-ALB-HighErrorRate"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# RDS: high CPU utilization
resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  alarm_name          = "${var.project_name}-RDS-HighCPU"
  alarm_description   = "RDS instance CPU utilization exceeds 85% for 10 minutes."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 85
  period              = 600
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-RDS-HighCPU"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# RDS: low free storage (< 10 GB)
resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  alarm_name          = "${var.project_name}-RDS-LowStorage"
  alarm_description   = "RDS instance free storage space is below 10 GB."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = 10737418240 # 10 GB in bytes
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-RDS-LowStorage"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# Redis: high memory usage
resource "aws_cloudwatch_metric_alarm" "redis_high_memory" {
  alarm_name          = "${var.project_name}-Redis-HighMemory"
  alarm_description   = "ElastiCache Redis memory usage exceeds 90%."
  namespace           = "AWS/ElastiCache"
  metric_name         = "DatabaseMemoryUsagePercentage"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 90
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-Redis-HighMemory"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# Redis: high connection count
resource "aws_cloudwatch_metric_alarm" "redis_high_connections" {
  alarm_name          = "${var.project_name}-Redis-HighConnections"
  alarm_description   = "ElastiCache Redis current connections exceed 9000."
  namespace           = "AWS/ElastiCache"
  metric_name         = "CurrConnections"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 9000
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-Redis-HighConnections"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── Warning Alarms ───────────────────────────────────────────────────────────

# ALB: high p95 latency (> 500ms)
resource "aws_cloudwatch_metric_alarm" "alb_high_latency" {
  alarm_name          = "${var.project_name}-ALB-HighLatency"
  alarm_description   = "ALB p95 target response time exceeds 500ms."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0.5
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-ALB-HighLatency"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# RDS: high connection count
resource "aws_cloudwatch_metric_alarm" "rds_high_connections" {
  alarm_name          = "${var.project_name}-RDS-HighConnections"
  alarm_description   = "RDS database connections exceed 800."
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 800
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-RDS-HighConnections"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─── CloudWatch Dashboard ─────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "overview" {
  dashboard_name = "RealTime-Collaboration-Overview"

  dashboard_body = jsonencode({
    widgets = [
      # ── ECS: CPU & Memory ──────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ECS CPU Utilization"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.core_backend.name, { label = "core-backend CPU" }],
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.realtime_backend.name, { label = "realtime-backend CPU" }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ECS Memory Utilization"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.core_backend.name, { label = "core-backend Memory" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.realtime_backend.name, { label = "realtime-backend Memory" }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      # ── ALB ────────────────────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB Request Count"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", label = "Request Count" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB 5XX Error Count"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", label = "5XX Errors" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB Target Response Time (p95)"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p95", label = "p95 Latency" }]
          ]
        }
      },
      # ── RDS ────────────────────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "RDS CPU Utilization"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id, { label = "RDS CPU" }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "RDS Database Connections"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_instance_id, { label = "DB Connections" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "RDS Free Storage Space"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.rds_instance_id, { label = "Free Storage (bytes)" }]
          ]
        }
      },
      # ── Redis ──────────────────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 6
        height = 6
        properties = {
          title  = "Redis Current Connections"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ElastiCache", "CurrConnections", "ReplicationGroupId", var.redis_replication_group_id, { label = "Connections" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 18
        width  = 6
        height = 6
        properties = {
          title  = "Redis Memory Usage %"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "ReplicationGroupId", var.redis_replication_group_id, { label = "Memory %" }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 6
        height = 6
        properties = {
          title  = "Redis Cache Hits"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ElastiCache", "CacheHits", "ReplicationGroupId", var.redis_replication_group_id, { stat = "Sum", label = "Cache Hits" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 18
        width  = 6
        height = 6
        properties = {
          title  = "Redis Cache Misses"
          region = var.aws_region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ElastiCache", "CacheMisses", "ReplicationGroupId", var.redis_replication_group_id, { stat = "Sum", label = "Cache Misses" }]
          ]
        }
      }
    ]
  })
}
