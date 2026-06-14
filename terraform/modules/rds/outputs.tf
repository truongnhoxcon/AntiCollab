# ─────────────────────────────────────────────────────────────────────────────
# RDS Module – output values
# Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2
# ─────────────────────────────────────────────────────────────────────────────

output "db_endpoint" {
  description = "DNS endpoint of the RDS instance. Use this as DB_HOST in ECS task definitions."
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "Port the RDS PostgreSQL instance listens on (5432)."
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Name of the application database created on the RDS instance."
  value       = aws_db_instance.main.db_name
}

output "db_instance_id" {
  description = "RDS instance identifier. Useful for CloudWatch dashboards and alarms."
  value       = aws_db_instance.main.identifier
}
