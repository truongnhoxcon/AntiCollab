# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Module – output values
# Requirements: 4.1, 4.2, 4.5, 4.6, 4.7
# ─────────────────────────────────────────────────────────────────────────────

output "redis_endpoint" {
  description = "Primary endpoint address of the Redis replication group. Use this as REDIS_HOST in ECS task definitions."
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Port the Redis cluster listens on (6379)."
  value       = 6379
}

output "redis_replication_group_id" {
  description = "Replication group identifier. Useful for CloudWatch dashboards and alarms."
  value       = aws_elasticache_replication_group.main.id
}
