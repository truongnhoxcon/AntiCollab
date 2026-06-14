# ─────────────────────────────────────────────────────────────────────────────
# Staging environment variable overrides
# ─────────────────────────────────────────────────────────────────────────────

aws_region   = "us-east-1"
environment  = "staging"
project_name = "realtime-collab"

# Set your actual AWS account ID before running terraform apply
account_id = "123456789012"

# Networking – staging uses 10.2.0.0/16
vpc_cidr = "10.2.0.0/16"

# Application images – updated by CI/CD pipeline on each deploy
core_backend_image     = ""
realtime_backend_image = ""

# DNS
domain_name = "staging.yourdomain.com"

# Alerting
alert_email = "devops@yourdomain.com"
