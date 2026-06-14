# ─────────────────────────────────────────────────────────────────────────────
# VPC Module Outputs
# ─────────────────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC."
  value       = aws_vpc.main.cidr_block
}

# ─── Subnet IDs ──────────────────────────────────────────────────────────────

output "public_subnet_ids" {
  description = "List of public subnet IDs (one per AZ). Used by ALB and NAT Gateway."
  value       = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

output "private_subnet_ids" {
  description = "List of private subnet IDs (one per AZ). Used by ECS tasks, RDS, and ElastiCache."
  value       = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

output "public_subnet_1_id" {
  description = "ID of public subnet in the first AZ (us-east-1a)."
  value       = aws_subnet.public_1.id
}

output "public_subnet_2_id" {
  description = "ID of public subnet in the second AZ (us-east-1b)."
  value       = aws_subnet.public_2.id
}

output "private_subnet_1_id" {
  description = "ID of private subnet in the first AZ (us-east-1a)."
  value       = aws_subnet.private_1.id
}

output "private_subnet_2_id" {
  description = "ID of private subnet in the second AZ (us-east-1b)."
  value       = aws_subnet.private_2.id
}

# ─── Gateway IDs ─────────────────────────────────────────────────────────────

output "internet_gateway_id" {
  description = "ID of the Internet Gateway attached to the VPC."
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_id" {
  description = "ID of the NAT Gateway (located in public-subnet-1)."
  value       = aws_nat_gateway.main.id
}

output "nat_gateway_public_ip" {
  description = "Public Elastic IP address associated with the NAT Gateway."
  value       = aws_eip.nat.public_ip
}

# ─── Route Table IDs ─────────────────────────────────────────────────────────

output "public_route_table_id" {
  description = "ID of the public route table (routes 0.0.0.0/0 → Internet Gateway)."
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "ID of the private route table (routes 0.0.0.0/0 → NAT Gateway)."
  value       = aws_route_table.private.id
}

# ─── Flow Logs ───────────────────────────────────────────────────────────────

output "flow_log_id" {
  description = "ID of the VPC Flow Log resource."
  value       = aws_flow_log.main.id
}

output "flow_log_cloudwatch_log_group_name" {
  description = "Name of the CloudWatch Log Group receiving VPC Flow Log records."
  value       = aws_cloudwatch_log_group.vpc_flow_logs.name
}
