# ─────────────────────────────────────────────────────────────────────────────
# Remote Backend – S3 + DynamoDB state locking
#
# Prerequisites (bootstrap once per AWS account):
#
#   aws s3api create-bucket \
#     --bucket realtime-collab-terraform-state-655103423690 \
#     --region us-east-1
#
#   aws s3api put-bucket-versioning \
#     --bucket realtime-collab-terraform-state-655103423690 \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket realtime-collab-terraform-state-655103423690 \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws dynamodb create-table \
#     --table-name realtime-collab-terraform-locks \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region us-east-1
#
# After bootstrap, run:
#   terraform init        (migrates any existing local state to S3)
#
# Per-environment state paths:
#   dev:     environments/dev/terraform.tfstate
#   staging: environments/staging/terraform.tfstate
#   prod:    environments/prod/terraform.tfstate
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  backend "s3" {
    bucket         = "realtime-collab-terraform-state-655103423690"
    key            = "environments/staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "realtime-collab-terraform-locks"
  }
}
