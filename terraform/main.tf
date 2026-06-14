terraform {
  required_version = "~> 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager – no dependencies
# ─────────────────────────────────────────────────────────────────────────────

module "secrets" {
  source       = "./modules/secrets"
  project_name = var.project_name
  environment  = var.environment
}

# ─────────────────────────────────────────────────────────────────────────────
# VPC – no dependencies
# ─────────────────────────────────────────────────────────────────────────────

module "vpc" {
  source       = "./modules/vpc"
  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
  vpc_cidr     = var.vpc_cidr
}

# ─────────────────────────────────────────────────────────────────────────────
# Security Groups – depends on VPC
# ─────────────────────────────────────────────────────────────────────────────

module "security_groups" {
  source       = "./modules/security-groups"
  vpc_id       = module.vpc.vpc_id
  project_name = var.project_name
  environment  = var.environment
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 – needs account_id, domain_name
# ─────────────────────────────────────────────────────────────────────────────

module "s3" {
  source       = "./modules/s3"
  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
  account_id   = var.account_id
  app_domain   = "https://${var.domain_name}"
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM – depends on S3 and Secrets
# ─────────────────────────────────────────────────────────────────────────────

module "iam" {
  source                 = "./modules/iam"
  project_name           = var.project_name
  environment            = var.environment
  aws_region             = var.aws_region
  s3_bucket_arn          = module.s3.files_bucket_arn
  db_password_secret_arn = module.secrets.db_password_secret_arn
  jwt_secret_arn         = module.secrets.jwt_secret_arn
  twilio_secret_arn      = module.secrets.twilio_credentials_secret_arn
  redis_auth_secret_arn  = module.secrets.redis_auth_token_secret_arn

  depends_on = [module.s3, module.secrets]
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS – depends on VPC, Security Groups, Secrets
# ─────────────────────────────────────────────────────────────────────────────

module "rds" {
  source                 = "./modules/rds"
  project_name           = var.project_name
  environment            = var.environment
  aws_region             = var.aws_region
  private_subnet_ids     = module.vpc.private_subnet_ids
  rds_sg_id              = module.security_groups.rds_sg_id
  db_password_secret_arn = module.secrets.db_password_secret_arn
}

# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache – depends on VPC, Security Groups, Secrets
# sns_topic_arn is left empty to avoid a circular dependency with the ECS
# monitoring module (which creates the SNS topic in monitoring.tf).
# ─────────────────────────────────────────────────────────────────────────────

module "elasticache" {
  source                = "./modules/elasticache"
  project_name          = var.project_name
  environment           = var.environment
  aws_region            = var.aws_region
  private_subnet_ids    = module.vpc.private_subnet_ids
  redis_sg_id           = module.security_groups.redis_sg_id
  redis_auth_secret_arn = module.secrets.redis_auth_token_secret_arn
  sns_topic_arn         = "" # SNS topic created in ECS monitoring module; omit here to avoid circular dependency
}

# ─────────────────────────────────────────────────────────────────────────────
# ALB – depends on VPC, Security Groups, S3
# ─────────────────────────────────────────────────────────────────────────────

module "alb" {
  source            = "./modules/alb"
  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  alb_sg_id         = module.security_groups.alb_sg_id
  domain_name       = var.domain_name
  alb_logs_bucket   = module.s3.alb_logs_bucket_id
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS – depends on all preceding modules
# ─────────────────────────────────────────────────────────────────────────────

module "ecs" {
  source = "./modules/ecs"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  # IAM
  ecs_task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn           = module.iam.ecs_task_role_arn

  # Container images
  core_backend_image     = var.core_backend_image
  realtime_backend_image = var.realtime_backend_image

  # Runtime endpoints
  db_host    = module.rds.db_endpoint
  redis_host = module.elasticache.redis_endpoint

  # Secrets
  db_password_secret_arn = module.secrets.db_password_secret_arn
  jwt_secret_arn         = module.secrets.jwt_secret_arn
  twilio_secret_arn      = module.secrets.twilio_credentials_secret_arn

  # Networking
  private_subnet_ids     = module.vpc.private_subnet_ids
  core_backend_sg_id     = module.security_groups.core_backend_sg_id
  realtime_backend_sg_id = module.security_groups.realtime_backend_sg_id

  # ALB integration
  core_backend_tg_arn     = module.alb.core_backend_tg_arn
  realtime_backend_tg_arn = module.alb.realtime_backend_tg_arn
  alb_https_listener_arn  = module.alb.https_listener_arn

  # Monitoring / alerting
  alert_email                    = var.alert_email
  alb_arn_suffix                 = module.alb.alb_arn
  core_backend_tg_arn_suffix     = module.alb.core_backend_tg_arn
  realtime_backend_tg_arn_suffix = module.alb.realtime_backend_tg_arn
  rds_instance_id                = module.rds.db_instance_id
  redis_replication_group_id     = module.elasticache.redis_replication_group_id
}
