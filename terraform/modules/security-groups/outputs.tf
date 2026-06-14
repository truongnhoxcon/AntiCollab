# ─────────────────────────────────────────────────────────────────────────────
# Security Groups Module Outputs
# Exports all security group IDs for consumption by other modules (ALB, ECS,
# RDS, ElastiCache) and the root configuration.
# ─────────────────────────────────────────────────────────────────────────────

output "alb_sg_id" {
  description = "ID of the ALB security group. Used by the ALB module and referenced as the inbound source by backend security groups."
  value       = aws_security_group.alb_sg.id
}

output "core_backend_sg_id" {
  description = "ID of the Core Backend ECS task security group. Passed to the ECS service network configuration and referenced by RDS/Redis inbound rules."
  value       = aws_security_group.core_backend_sg.id
}

output "realtime_backend_sg_id" {
  description = "ID of the Realtime Backend ECS task security group. Passed to the ECS service network configuration and referenced by RDS/Redis inbound rules."
  value       = aws_security_group.realtime_backend_sg.id
}

output "rds_sg_id" {
  description = "ID of the RDS PostgreSQL security group. Passed to the RDS module."
  value       = aws_security_group.rds_sg.id
}

output "redis_sg_id" {
  description = "ID of the ElastiCache Redis security group. Passed to the ElastiCache module."
  value       = aws_security_group.redis_sg.id
}
